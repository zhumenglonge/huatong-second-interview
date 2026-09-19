import { NextResponse } from 'next/server';
import { appendEvent, buildSnapshot, getTask } from '@/lib/db';
import { publish } from '@/lib/events';
import { isRunning, startTask } from '@/lib/runner';
import type { AgentRunOptions, Block, ModelProfile } from '@/lib/types';

export const dynamic = 'force-dynamic';

function parseOptions(value?: Partial<AgentRunOptions>): AgentRunOptions {
  const availableModels: ModelProfile[] = [
    'Auto', 'Qwen3.8-Max', 'Qwen3.8-Flash', 'Qwen3.7-Max', 'Qwen3.7-Plus',
    'Qwen3.7-Flash', 'DeepSeek-V4-Pro', 'DeepSeek-Flash', 'GLM-5.3',
    'GLM-5.3-Flash', 'GLM-5.2', 'Kimi-K3', 'Kimi-K2.8-Preview', 'MiniMax-M2.7',
  ];
  const requestedModel = value?.model;
  const model = availableModels.includes(requestedModel as ModelProfile)
    ? (requestedModel as ModelProfile)
    : 'Auto';
  return {
    model,
    skills: Array.isArray(value?.skills) ? value.skills.map(String).filter(Boolean).slice(0, 8) : [],
    auto: Boolean(value?.auto),
  };
}

function conversationContext(blocks: Block[], nextInput: string): string {
  const history = blocks
    .filter((block) => block.kind === 'user' || block.kind === 'agent_text')
    .slice(-12)
    .map((block) => `${block.kind === 'user' ? 'User' : 'Assistant'}: ${block.text ?? ''}`)
    .join('\n\n');

  return `Continue the existing conversation in the same task and working directory.
Use the prior context below, but respond only to the new user message.

Prior conversation:
${history || '(no prior conversational text)'}

New user message:
${nextInput}`;
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const task = getTask(id);
  if (!task) return NextResponse.json({ error: 'task not found' }, { status: 404 });
  if (isRunning(id)) return NextResponse.json({ error: 'task is already running' }, { status: 409 });

  const body = (await req.json().catch(() => null)) as
    | { input?: string; options?: Partial<AgentRunOptions> }
    | null;
  const input = String(body?.input ?? '').trim();
  if (!input) return NextResponse.json({ error: 'input required' }, { status: 400 });

  const snapshot = buildSnapshot(id);
  const priorBlocks = snapshot?.blocks ?? [];
  const block = { id: `user-${id}-${Date.now()}`, kind: 'user' as const, text: input };
  const seq = appendEvent(id, 'block.add', { block });
  publish(id, { seq, type: 'block.add', block } as any);

  startTask(id, conversationContext(priorBlocks, input), parseOptions(body?.options));
  return NextResponse.json({ ok: true, taskId: id }, { status: 202 });
}
