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
import { listSkills, loadEnabledSkills } from './skills';

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

/**
 * Build the system prompt for a run. `cwd` is the task's assigned sandbox
 * directory; it is injected verbatim so the model treats that exact path as
 * its only workspace and stops scattering deliverables to absolute paths like
 * /tmp/sandbox (which the Results scanner would then miss).
 */
function systemPrompt(cwd: string): string {
  return `You are a general-purpose research & data-analysis agent running inside an isolated sandbox.
The user gives you a task in natural language.
Working-directory rules (STRICT):
- Your assigned working directory is exactly: ${cwd}
- Treat that directory as your ONLY workspace. Every file you create (datasets, scripts, figures, reports) MUST be written inside it.
- ALWAYS use relative paths (e.g. ./orders.csv, ./report.md) so files land in the working directory.
- NEVER write outputs to any absolute path outside the working directory — do not use /tmp, ~ , or other directories. If you need a scratch dir, create one inside the working directory.
- When you run shell commands, operate from within the working directory first (e.g. \`cd ${cwd} && ...\`) and keep all generated artifacts there.
- Do not read or modify files outside the working directory.
Execution rules:
- Decompose the task into concrete steps and execute them with your tools (read/write files, run commands, search).
- Keep each visible message concise: state what you are doing, then do it.
- End with a short summary of findings plus a list of the files you produced (as paths relative to the working directory).`;
}

export type AgentMode = 'plan' | 'execute';

function systemPromptFor(options: AgentRunOptions, mode: AgentMode, cwd: string): string {
  const selected = loadEnabledSkills(options.skills).map((skill) => `[${skill.id}] ${skill.instructions}`);
  const skillSection = selected.length
    ? `\nSelected specialist skills for this turn:\n${selected.map((item) => `- ${item}`).join('\n')}`
    : '';
  const autoSection = options.auto
    ? '\nAuto mode is enabled: make safe, reasonable assumptions when clarification is optional, and continue autonomously.'
    : '';
  const modeSection = mode === 'plan'
    ? `\nYou are in planning mode. Do not edit files or execute the research workflow yet.
First inspect only what is necessary, ask one concise structured question with AskUserQuestion if critical information is missing, then produce a concrete numbered execution plan and call ExitPlanMode.`
    : '\nThe plan has been approved. Execute the requested workflow now and produce the deliverables.';
  return `${systemPrompt(cwd)}${skillSection}${autoSection}${modeSection}`;
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
  mode?: AgentMode;
  cwd: string;
  signal: AbortSignal;
  emit: Emit;
  onReady?: (handle: AgentHandle) => void;
}): Promise<{ ok: boolean; error?: string; outcome?: 'waiting' | 'awaiting_approval' }> {
  const { input, options, mode = 'execute', cwd, signal, emit, onReady } = opts;
  const appliedSkills = loadEnabledSkills(options.skills).map((skill) => skill.id);
  const requestedSkills = options.skills.length ? new Set(options.skills) : null;
  const skippedSkills = requestedSkills
    ? listSkills().filter((skill) => requestedSkills.has(skill.id) && (!skill.valid || !skill.enabled)).map((skill) => skill.id)
    : [];
  if (skippedSkills.length) {
    emit('block.add', { block: { id: `skill-warning-${randomUUID()}`, kind: 'error', text: `Skipped unavailable skills: ${skippedSkills.join(', ')}` } });
  }

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
        planMode: mode === 'plan',
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        systemPrompt: systemPromptFor(options, mode, cwd),
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
  let planText = '';

  const emitPlan = (fallback?: string) => {
    const text = planText.trim() || fallback?.trim() || 'Plan generated. Review and approve to continue.';
    emit('block.add', {
      block: {
        id: `plan-${randomUUID()}`,
        kind: 'plan',
        name: '执行计划',
        text,
        meta: { approved: false, executionPrompt: input, options: { ...options, skills: appliedSkills }, appliedSkills },
      },
    });
  };

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
            if (mode === 'plan') {
              planText += deltaText;
              break;
            }
            turnHadDelta = true;
            emit('block.delta', { id: ensureTextBlock(), delta: deltaText });
          }
          break;
        }

        case 'assistant': {
          const content = (msg as any).message?.content as any[] | undefined;
          for (const block of content ?? []) {
            if (block.type === 'tool_use') {
              const toolName = String(block.name ?? '').toLowerCase();
              if (mode === 'plan' && toolName.includes('askuserquestion')) {
                const { question, options: optionsList } = parseClarification(block.input);
                emit('block.add', {
                  block: {
                    id: `clarification-${randomUUID()}`,
                    kind: 'clarification',
                    name: '需要补充信息',
                    text: question,
                    meta: { question, options: optionsList },
                  },
                });
                return { ok: true, outcome: 'waiting' };
              }
              if (mode === 'plan' && toolName.includes('exitplanmode')) {
                emitPlan();
                return { ok: true, outcome: 'awaiting_approval' };
              }
              const stepId = `step-${block.id}`;
              toolUseToStep.set(block.id, stepId);
              stepOrd += 1;
              const stepTitle = summarizeToolCall(block.name, block.input);
              emit('block.add', {
                block: { id: stepId, kind: 'step', name: stepTitle, status: 'running', meta: { ord: stepOrd, input: block.input, tool: block.name } },
              });
              emit('block.add', {
                block: {
                  id: `trace-${block.id}`,
                  kind: 'trace',
                  name: stepTitle,
                  text: safeStringify(block.input),
                },
              });
            } else if (block.type === 'text' && typeof block.text === 'string') {
              if (mode === 'plan') {
                if (!turnHadDelta && block.text.trim()) planText += block.text;
                continue;
              }
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
            if (mode === 'plan') {
              emitPlan(typeof r.result === 'string' ? r.result : undefined);
              return { ok: true, outcome: 'awaiting_approval' };
            }
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

/** Last path segment of a posix/windows-ish path or file name. */
function baseName(p: unknown): string {
  if (typeof p !== 'string' || !p.trim()) return '';
  const parts = p.split(/[/\\]+/).filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

/** Turn a raw shell command into a short Chinese, human-readable intent. */
function humanizeBash(command: string): string {
  // Drop leading `cd <dir> &&` hops and env prefixes like `FOO=bar cmd`.
  let cmd = command.trim().replace(/^(?:cd\s+\S+\s*(?:&&|;)\s*)+/i, '');
  cmd = cmd.replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)+/, '');
  const lower = cmd.toLowerCase();

  const fileAfter = (re: RegExp) => { const m = cmd.match(re); return m ? baseName(m[1]) : ''; };

  if (/^(python3?|pypy)\b/.test(lower)) {
    const py = fileAfter(/([\w./@+-]+\.py)/i);
    return py ? `运行脚本 ${py}` : '运行 Python 脚本';
  }
  if (/^node\s+.*\.js/i.test(lower)) { return `运行脚本 ${fileAfter(/([\w./@-]+\.js)/i) || 'script.js'}`; }
  if (/^(pip3?|uv|poetry|conda)\b/.test(lower) || /^(npm|pnpm|yarn)\s+install\b/.test(lower)) return '安装依赖';
  if (/^(npm|pnpm|yarn)\s+run\b/.test(lower)) return '运行构建/脚本任务';
  if (/^git\b/.test(lower)) { const sub = cmd.split(/\s+/)[1]; return sub ? `执行 Git（${sub}）` : '执行 Git 操作'; }
  if (/^(curl|wget)\b/.test(lower)) return '访问网络资源';
  if (/^ls\b/.test(lower)) return '查看目录内容';
  if (/^cat\b/.test(lower)) { const f = fileAfter(/\bcat\s+([^\s|&;]+)/i); return f ? `查看文件 ${f}` : '查看文件内容'; }
  if (/^mkdir\b/.test(lower)) return '创建目录';
  if (/^(cd|pwd|export|source|echo)\b/.test(lower)) return '准备运行环境';

  const firstLine = cmd.split('\n')[0].trim();
  return `执行命令：${truncate(firstLine, 48)}`;
}

/**
 * Build a short Chinese, human-readable step title from a tool call instead of
 * the raw SDK tool name + absolute path ("Write: /Users/…/.data/sandboxes/xxx"),
 * which is unreadable to end users. Falls back to a trimmed command line.
 */
function summarizeToolCall(name: unknown, input: unknown): string {
  const tool = String(name || 'tool').toLowerCase();
  const obj = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  const file = baseName(obj.file_path ?? obj.path ?? obj.notebook_path);
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');

  if (tool.includes('write')) return file ? `写入文件 ${file}` : '写入文件';
  if (tool.includes('edit')) return file ? `修改文件 ${file}` : '修改文件';
  if (tool.includes('read')) return file ? `读取文件 ${file}` : '读取文件';
  if (tool.includes('glob')) { const p = str(obj.query) || str(obj.pattern); return p ? `查找文件 ${truncate(p, 30)}` : '查找文件'; }
  if (tool.includes('grep')) { const p = str(obj.pattern) || str(obj.query); return p ? `搜索代码 ${truncate(p, 30)}` : '搜索代码'; }
  if (tool.includes('websearch')) { const q = str(obj.query); return q ? `联网搜索 ${truncate(q, 30)}` : '联网搜索'; }
  if (tool.includes('webfetch')) { const host = str(obj.url).replace(/^https?:\/\//, '').split('/')[0]; return host ? `访问网页 ${truncate(host, 30)}` : '访问网页'; }
  if (tool.includes('bash') || typeof obj.command === 'string') {
    const cmd = str(obj.command);
    return cmd ? humanizeBash(cmd) : '执行命令';
  }

  for (const key of ['query', 'pattern', 'prompt', 'description', 'url', 'name']) {
    const v = str(obj[key]);
    if (v) return `${name}: ${truncate(v, 40)}`;
  }
  return String(name || '工具调用');
}

/**
 * Extract the real question + option labels from an AskUserQuestion tool input.
 * The SDK passes a { questions: [{ question, header, options: [{ label, description }] }] }
 * array; the previous code only read a flat { question, options }, so the actual
 * (often Chinese) question was dropped and the UI fell back to an English
 * placeholder. Handle both shapes and never surface the English fallback.
 */
function parseClarification(input: unknown): { question: string; options: string[] } {
  const obj = (input && typeof input === 'object') ? input as Record<string, unknown> : {};

  const questions = Array.isArray(obj.questions) ? obj.questions : [];
  if (questions.length > 0) {
    const first = (questions[0] && typeof questions[0] === 'object') ? questions[0] as Record<string, unknown> : {};
    const text =
      typeof first.question === 'string' && first.question.trim() ? first.question.trim()
        : typeof first.header === 'string' && first.header.trim() ? first.header.trim() : '';
    const options = extractClarificationOptions(first.options);
    if (text) return { question: text, options };
    if (options.length) return { question: options.join(' / '), options };
  }

  const flatQuestion = typeof obj.question === 'string' && obj.question.trim() ? obj.question.trim() : '';
  const flatOptions = extractClarificationOptions(obj.options);
  if (flatQuestion) return { question: flatQuestion, options: flatOptions };
  if (flatOptions.length) return { question: flatOptions.join(' / '), options: flatOptions };

  return { question: '我需要你补充一些信息才能继续，请说明你的偏好或提供缺失的内容。', options: [] };
}

function extractClarificationOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((opt) => {
      if (typeof opt === 'string') return opt.trim();
      if (opt && typeof opt === 'object') {
        const o = opt as Record<string, unknown>;
        const label = typeof o.label === 'string' ? o.label.trim() : '';
        const desc = typeof o.description === 'string' ? o.description.trim() : '';
        return label || desc;
      }
      return '';
    })
    .filter((s) => s.length > 0);
}

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
