import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  addArtifact,
  addStep,
  appendEvent,
  listArtifacts,
  listSteps,
  listTasks,
  SANDBOX_ROOT,
  updateStep,
  updateTaskStatus,
} from './db';
import { publish } from './events';
import { runQoderAgent, type AgentHandle, type AgentMode } from './provider';
import type { AgentRunOptions, TaskStatus } from './types';

/**
 * Background task runner. Owns the lifecycle of a real Qoder agent session:
 * persists every event to SQLite (for refresh recovery), publishes to SSE,
 * maintains step/artifact tables, and supports cancel + retry.
 */

interface RunningTask {
  abort: AbortController;
  handle?: AgentHandle;
}

const globalForRunner = globalThis as unknown as {
  __biomniRunning?: Map<string, RunningTask>;
  __biomniCleaned?: boolean;
};

function registry(): Map<string, RunningTask> {
  if (!globalForRunner.__biomniRunning) globalForRunner.__biomniRunning = new Map();
  return globalForRunner.__biomniRunning;
}

// On (re)start, any task still marked running/queued but not present in the
// in-memory registry was killed by the server restart -> mark it failed so the
// UI never shows a phantom "running" task after refresh.
if (!globalForRunner.__biomniCleaned) {
  globalForRunner.__biomniCleaned = true;
  try {
    for (const t of listTasks()) {
      if ((t.status === 'running' || t.status === 'queued') && !registry().has(t.id)) {
        updateTaskStatus(t.id, 'failed', 'interrupted by server restart');
        appendEvent(t.id, 'task.status', { taskId: t.id, status: 'failed', error: 'interrupted by server restart' });
      }
    }
  } catch {
    // db not ready yet; ignore
  }
}

export function isRunning(taskId: string): boolean {
  return registry().has(taskId);
}

/** Persist + broadcast one event. Returns the assigned seq. */
function emit(taskId: string, type: string, payload: Record<string, any>): number {
  const seq = appendEvent(taskId, type, payload);
  publish(taskId, { seq, type, ...payload } as any);
  return seq;
}

function setTaskStatus(taskId: string, status: TaskStatus, error?: string | null) {
  updateTaskStatus(taskId, status, error);
  emit(taskId, 'task.status', { taskId, status, error: error ?? null });
}

export function sandboxFor(taskId: string): string {
  const dir = path.join(SANDBOX_ROOT, taskId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Start (or restart for retry) the real agent for a task.
 * Fire-and-forget: returns immediately; the session runs in the background.
 */
export function startTask(
  taskId: string,
  input: string,
  options: AgentRunOptions = { model: 'Auto', skills: [], auto: false },
  mode: AgentMode = 'execute',
) {
  if (registry().has(taskId)) return;

  const cwd = sandboxFor(taskId);
  const abort = new AbortController();
  const entry: RunningTask = { abort };
  registry().set(taskId, entry);

  setTaskStatus(taskId, 'running');

  // Emit wrapper that also maintains the steps / artifacts tables.
  const emitWithTables = (type: string, payload: Record<string, any>): number => {
      if (type === 'block.add' && payload.block?.kind === 'step') {
        const b = payload.block;
        addStep({
          id: b.id,
          taskId,
          name: b.name ?? 'step',
          status: b.status ?? 'running',
          ord: b.meta?.ord ?? 0,
          detail: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      } else if (type === 'block.status' && String(payload.id).startsWith('step-')) {
        updateStep(payload.id, { status: payload.status });
      } else if (type === 'block.patch' && String(payload.id).startsWith('trace-')) {
        const stepId = `step-${String(payload.id).slice('trace-'.length)}`;
        updateStep(stepId, { detail: payload.patch?.meta?.output ?? null });
      } else if (type === 'artifact.add') {
        const a = payload.artifact;
        addArtifact({
          id: a.id,
          taskId,
          name: a.name,
          kind: a.kind ?? 'file',
          size: a.size ?? 0,
          path: a.path ?? '',
          createdAt: Date.now(),
        });
      }
      return emit(taskId, type, payload);
    };

  void (async () => {
    try {
      const res = await runQoderAgent({
        input,
        options,
        mode,
        cwd,
        signal: abort.signal,
        emit: emitWithTables,
        onReady: (h) => {
          entry.handle = h;
        },
      });

      // Fallback artifact discovery: anything the agent wrote into the sandbox
      // that the SDK did not report as an artifact still shows in Results.
      scanSandboxArtifacts(taskId, cwd, emitWithTables);

      if (abort.signal.aborted) {
        setTaskStatus(taskId, 'cancelled');
      } else if (res.outcome === 'waiting') {
        setTaskStatus(taskId, 'waiting');
      } else if (res.outcome === 'awaiting_approval') {
        setTaskStatus(taskId, 'awaiting_approval');
      } else if (res.ok) {
        setTaskStatus(taskId, 'success');
      } else {
        setTaskStatus(taskId, 'failed', res.error ?? 'agent failed');
        emit(taskId, 'block.add', {
          block: { id: `err-${randomUUID()}`, kind: 'error', text: res.error ?? 'agent failed' },
        });
      }
    } catch (e) {
      setTaskStatus(taskId, 'failed', (e as Error).message);
      emit(taskId, 'block.add', {
        block: { id: `err-${randomUUID()}`, kind: 'error', text: (e as Error).message },
      });
    } finally {
      registry().delete(taskId);
    }
  })();
}

export async function cancelTask(taskId: string): Promise<boolean> {
  const entry = registry().get(taskId);
  if (!entry) return false;
  try {
    await entry.handle?.interrupt();
  } catch {
    // ignore interrupt errors; abort below is the backstop
  }
  entry.abort.abort();
  // mark in-flight steps cancelled
  for (const s of listSteps(taskId)) {
    if (s.status === 'running' || s.status === 'pending') {
      updateStep(s.id, { status: 'cancelled' });
      emit(taskId, 'block.status', { id: s.id, status: 'cancelled' });
    }
  }
  setTaskStatus(taskId, 'cancelled');
  registry().delete(taskId);
  return true;
}

/** Retry = re-run the same input in the same task, appending to history. */
export function retryTask(taskId: string, input: string) {
  if (registry().has(taskId)) return;
  emit(taskId, 'block.add', {
    block: { id: `text-${randomUUID()}`, kind: 'agent_text', text: '— retrying task —' },
  });
  startTask(taskId, input);
}

// ---------------------------------------------------------------------------

function scanSandboxArtifacts(
  taskId: string,
  cwd: string,
  emitFn: (type: string, payload: Record<string, any>) => number,
) {
  const known = new Set(listArtifacts(taskId).map((a) => a.path));
  const walk = (dir: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (!known.has(full)) {
        known.add(full);
        let size = 0;
        try {
          size = fs.statSync(full).size;
        } catch {
          // ignore
        }
        emitFn('artifact.add', {
          artifact: {
            id: `art-${randomUUID()}`,
            name: path.relative(cwd, full),
            kind: path.extname(full).slice(1) || 'file',
            size,
            path: full,
          },
        });
      }
    }
  };
  walk(cwd);
}
