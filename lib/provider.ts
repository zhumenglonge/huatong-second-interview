import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  accessTokenFromEnv,
  qodercliAuth,
  query,
  type Query,
} from '@qodercn-ai/qodercn-agent-sdk';
import type { AgentRunOptions } from './types';

/**
 * Real-agent provider backed by the QoderCN Agent SDK (CN endpoints, quota).
 *
 * Translates the SDK's streamed SDKMessage protocol into our internal
 * block/artifact/task events (the same vocabulary the SSE layer + SQLite
 * event log use). No mock: every step/trace/artifact below comes from a live
 * agent session running in a per-task sandbox directory.
 * Auth: QODERCN_PERSONAL_ACCESS_TOKEN (server env) or local `qoderclicn login`.
 */

export type Emit = (type: string, payload: Record<string, any>) => void;

export interface AgentHandle {
  interrupt(): Promise<void>;
}

const SYSTEM_PROMPT = `You are a general-purpose biomedical research agent inside an integrated
biology environment. The user gives you a research task in natural language.
Rules:
- Work ONLY inside the current working directory (your sandbox). Never touch files outside it.
- Decompose the task into concrete steps and execute them with your tools (read/write files, run commands, search).
- Write every deliverable (datasets, csv/tsv, figures, and a final markdown report) into the working directory.
- Keep each visible message concise: state what you are doing, then do it.
- End with a short summary of findings plus a list of the files you produced.`;

const SKILL_GUIDANCE: Record<string, string> = {
  literature: 'Search, compare, and synthesize biomedical literature with explicit citations and evidence quality.',
  pubmed: 'Use PubMed-oriented query design, PMID tracking, and structured evidence extraction.',
  geo: 'Work as a GEO/SRA dataset specialist: accession discovery, metadata inspection, download planning, and reproducible analysis.',
  differential_expression: 'Use rigorous differential-expression workflows, QC, appropriate statistics, multiple-testing correction, and volcano/heatmap outputs.',
  single_cell: 'Apply single-cell RNA-seq best practices including QC, normalization, clustering, annotation, and marker analysis.',
  protein_design: 'Apply protein sequence/structure analysis and rational design principles; clearly label computational hypotheses.',
};

function systemPromptFor(options: AgentRunOptions): string {
  const selected = options.skills.map((skill) => SKILL_GUIDANCE[skill]).filter(Boolean);
  const skillSection = selected.length
    ? `\nSelected specialist skills for this turn:\n${selected.map((item) => `- ${item}`).join('\n')}`
    : '';
  const autoSection = options.auto
    ? '\nAuto mode is enabled: make safe, reasonable assumptions when clarification is optional, and continue autonomously.'
    : '';
  return `${SYSTEM_PROMPT}${skillSection}${autoSection}`;
}

/**
 * Prefer the verified bundled CN CLI binary (process transport) over the
 * in-process Worker runtime: it exactly mirrors the `qoderclicn` invocation
 * that is known to work with the local login state.
 */
function resolveCliPath(): string | undefined {
  const candidate = path.join(
    process.cwd(),
    'node_modules/@qodercn-ai/qodercn-agent-sdk/dist/_bundled/qoderclicn',
  );
  return fs.existsSync(candidate) ? candidate : undefined;
}

export async function runQoderAgent(opts: {
  input: string;
  options: AgentRunOptions;
  cwd: string;
  signal: AbortSignal;
  emit: Emit;
  onReady?: (handle: AgentHandle) => void;
}): Promise<{ ok: boolean; error?: string }> {
  const { input, options, cwd, signal, emit, onReady } = opts;

  const abortController = new AbortController();
  const onAbort = () => abortController.abort();
  if (signal.aborted) onAbort();
  else signal.addEventListener('abort', onAbort, { once: true });

  const auth = process.env.QODERCN_PERSONAL_ACCESS_TOKEN
    ? accessTokenFromEnv()
    : qodercliAuth();

  let q: Query;
  try {
    q = query({
      prompt: input,
      options: {
        cwd,
        auth,
        abortController,
        includePartialMessages: true,
        maxTurns: 30,
        model: options.model,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        systemPrompt: systemPromptFor(options),
        ...(resolveCliPath() ? { pathToQoderCLIExecutable: resolveCliPath() } : {}),
        stderr: (data) => console.error('[qodercn:stderr]', data),
      },
    });
  } catch (e) {
    return { ok: false, error: `failed to start Qoder agent: ${(e as Error).message}` };
  }

  onReady?.({ interrupt: () => q.interrupt().then(() => undefined) });

  // ---- per-session translation state ----
  let currentTextBlockId: string | null = null;
  let turnHadDelta = false;
  let emittedTextBlocks = 0;
  let stepOrd = 0;
  const toolUseToStep = new Map<string, string>();
  const seenArtifacts = new Set<string>();

  const ensureTextBlock = () => {
    if (!currentTextBlockId) {
      currentTextBlockId = `text-${randomUUID()}`;
      emit('block.add', { block: { id: currentTextBlockId, kind: 'agent_text', text: '' } });
      emittedTextBlocks += 1;
    }
    return currentTextBlockId;
  };

  try {
    for await (const msg of q) {
      if (signal.aborted) break;

      switch (msg.type) {
        case 'stream_event': {
          const ev = (msg as { event?: { type?: string; delta?: any } }).event;
          const deltaText =
            ev?.type === 'content_block_delta' && ev?.delta?.type === 'text_delta'
              ? (ev.delta.text as string)
              : null;
          if (deltaText) {
            turnHadDelta = true;
            emit('block.delta', { id: ensureTextBlock(), delta: deltaText });
          }
          break;
        }

        case 'assistant': {
          const content = (msg as any).message?.content as any[] | undefined;
          for (const block of content ?? []) {
            if (block.type === 'tool_use') {
              const stepId = `step-${block.id}`;
              toolUseToStep.set(block.id, stepId);
              stepOrd += 1;
              emit('block.add', {
                block: { id: stepId, kind: 'step', name: block.name, status: 'running', meta: { ord: stepOrd, input: block.input } },
              });
              emit('block.add', {
                block: {
                  id: `trace-${block.id}`,
                  kind: 'trace',
                  name: block.name,
                  text: safeStringify(block.input),
                },
              });
            } else if (block.type === 'text' && typeof block.text === 'string') {
              if (!turnHadDelta && block.text.trim()) {
                emit('block.add', {
                  block: { id: `text-${(msg as any).uuid ?? randomUUID()}`, kind: 'agent_text', text: block.text },
                });
                emittedTextBlocks += 1;
              }
            }
          }
          // turn boundary: next deltas start a fresh text block
          turnHadDelta = false;
          currentTextBlockId = null;
          break;
        }

        case 'user': {
          const content = (msg as any).message?.content;
          const blocks = Array.isArray(content) ? content : [];
          for (const block of blocks) {
            if (block.type !== 'tool_result') continue;
            const stepId = toolUseToStep.get(block.tool_use_id);
            if (!stepId) continue;
            const failed = Boolean(block.is_error);
            emit('block.status', { id: stepId, status: failed ? 'failed' : 'success' });
            emit('block.patch', {
              id: `trace-${block.tool_use_id}`,
              patch: { meta: { output: truncate(stringifyUnknown(block.content), 4000), failed } },
            });
          }
          break;
        }

        case 'system': {
          const sub = (msg as any).subtype;
          if (sub === 'artifacts_update') {
            for (const a of (msg as any).artifacts ?? []) {
              const key = a.path ?? a.name;
              if (seenArtifacts.has(key)) continue;
              seenArtifacts.add(key);
              emit('artifact.add', {
                artifact: {
                  id: `art-${randomUUID()}`,
                  name: a.name,
                  kind: a.mime ?? 'file',
                  size: a.size ?? 0,
                  path: a.path,
                },
              });
            }
          } else if (sub === 'permission_denied') {
            emit('block.add', {
              block: { id: `err-${randomUUID()}`, kind: 'error', text: `permission denied: ${(msg as any).tool_name} — ${(msg as any).message}` },
            });
          }
          break;
        }

        case 'result': {
          const r = msg as any;
          if (r.subtype === 'success') {
            if (emittedTextBlocks === 0 && typeof r.result === 'string' && r.result.trim()) {
              emit('block.add', { block: { id: `text-${randomUUID()}`, kind: 'agent_text', text: r.result } });
            }
            return { ok: true };
          }
          return { ok: false, error: (r.errors ?? []).join('; ') || `agent error: ${r.subtype}` };
        }

        default:
          break;
      }
    }
    // stream ended without an explicit result message
    return { ok: !signal.aborted, error: signal.aborted ? undefined : 'agent stream ended without a result' };
  } catch (e) {
    if (signal.aborted) return { ok: false };
    return { ok: false, error: (e as Error).message };
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

// ---------------------------------------------------------------------------

function safeStringify(v: unknown): string {
  return truncate(stringifyUnknown(v), 2000);
}

function stringifyUnknown(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    // tool_result content is often [{type:'text',text}]
    return v.map((x) => (x && typeof x === 'object' && 'text' in x ? String((x as any).text) : stringifyUnknown(x))).join('\n');
  }
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}\n… (truncated)` : s;
}
