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

/**
 * Short fallback caption for the auth-required state. The interactive login
 * button lives in BlockView's AuthRequiredCard (keyed off meta.code);
 * this text is only what a plain renderer (or history after refresh) shows.
 */
const AUTH_REQUIRED_GUIDE = '未检测到 Qoder CN 登录授权,请登录后重试。';

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
  const startedAt = Date.now();
  // Absolute directories this run's tool calls referenced (outside cwd). Used
  // as a fallback so artifacts the agent scattered elsewhere still surface.
  const extraRoots = new Set<string>();
  const abort = new AbortController();
  const entry: RunningTask = { abort };
  registry().set(taskId, entry);

  setTaskStatus(taskId, 'running');

  // Emit wrapper that also maintains the steps / artifacts tables.
  const emitWithTables = (type: string, payload: Record<string, any>): number => {
      if (type === 'block.add' && payload.block?.kind === 'step') {
        const b = payload.block;
        collectArtifactDirs(b.meta?.input, cwd, extraRoots);
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
        // Stamp the owning task so the streamed/persisted artifact block can
        // build a valid /api/tasks/<taskId>/artifacts/<id> preview URL. The SDK
        // artifact payload and the sandbox scan omit this; without it the block
        // renders a dead `/api/tasks/undefined/...` link.
        a.taskId = a.taskId ?? taskId;
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
      scanSandboxArtifacts(taskId, cwd, extraRoots, startedAt, emitWithTables);

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
        const isAuth = res.code === 'auth_required';
        const errorText = isAuth ? AUTH_REQUIRED_GUIDE : (res.error ?? 'agent failed');
        emit(taskId, 'block.add', {
          block: {
            id: `err-${randomUUID()}`,
            kind: 'error',
            text: errorText,
            // Tag auth failures so BlockView renders the in-place login button;
            // other errors stay as plain text.
            meta: isAuth ? { code: 'auth_required', taskId } : undefined,
          },
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
  extraRoots: Set<string>,
  startedAt: number,
  emitFn: (type: string, payload: Record<string, any>) => number,
) {
  const known = new Set(listArtifacts(taskId).map((a) => a.path));
  const emitted = new Set<string>();

  const emitArtifact = (full: string, root: string, size: number) => {
    if (known.has(full) || emitted.has(full)) return;
    emitted.add(full);
    const rel = path.relative(root, full);
    const name = rel && !rel.startsWith('..') ? rel : path.basename(full);
    emitFn('artifact.add', {
      artifact: {
        id: `art-${randomUUID()}`,
        name,
        kind: path.extname(full).slice(1) || 'file',
        size,
        path: full,
      },
    });
  };

  const walk = (dir: string, root: string, requireRecent: boolean) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full, root, requireRecent);
        continue;
      }
      let size = 0;
      let mtimeMs = 0;
      try {
        const st = fs.statSync(full);
        size = st.size;
        mtimeMs = st.mtimeMs;
      } catch {
        continue;
      }
      // Shared out-of-sandbox dirs (e.g. a reused /tmp/sandbox) are only trusted
      // for files this run actually touched, so another task's leftovers never leak.
      if (requireRecent && mtimeMs < startedAt - 2000) continue;
      emitArtifact(full, root, size);
    }
  };

  // Primary: the task's own sandbox (always surfaced, no time gate).
  walk(cwd, cwd, false);

  // Fallback: absolute directories this run's commands/files referenced but that
  // sit outside the sandbox. Ancestors of cwd are skipped to avoid sibling-task
  // leakage; everything else is time-gated to this run.
  for (const raw of extraRoots) {
    const root = path.normalize(raw);
    if (root === cwd || root.startsWith(cwd + path.sep) || cwd.startsWith(root + path.sep)) continue;
    let st: fs.Stats;
    try {
      st = fs.statSync(root);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(root, root, true);
    else emitArtifact(root, path.dirname(root), st.size);
  }
}

// Absolute-path tokens inside a shell command (best-effort; ASCII paths).
const ABS_PATH_TOKEN = /(?:^|[\s'"=;()<>|,])((?:\/[A-Za-z0-9._@+~-]+)+)/g;

/**
 * Remember out-of-sandbox directories a tool call pointed at, so the final
 * artifact scan can look there even if the model ignored the cwd instruction.
 * In-sandbox paths are skipped (already covered by the primary scan).
 */
function collectArtifactDirs(input: unknown, cwd: string, out: Set<string>): void {
  if (!input || typeof input !== 'object') return;
  const obj = input as Record<string, unknown>;

  const pushDir = (p: string) => {
    const norm = path.normalize(p);
    if (!path.isAbsolute(norm)) return;
    if (norm === cwd || norm.startsWith(cwd + path.sep)) return;
    out.add(norm);
  };

  for (const key of ['file_path', 'path', 'notebook_path']) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim() && path.isAbsolute(v)) pushDir(path.dirname(v));
  }

  const cmd = obj.command;
  if (typeof cmd === 'string' && cmd) {
    ABS_PATH_TOKEN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ABS_PATH_TOKEN.exec(cmd))) {
      const norm = path.normalize(m[1]);
      const base = norm.split('/').pop() ?? '';
      const looksLikeFile = /\.[A-Za-z0-9]+$/.test(base);
      pushDir(looksLikeFile ? path.dirname(norm) : norm);
    }
  }
}
