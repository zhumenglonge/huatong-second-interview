import { NextResponse } from 'next/server';
import { appendEvent, buildSnapshot, getTaskForProject, DEFAULT_PROJECT_ID } from '@/lib/db';
import { publish } from '@/lib/events';
import { isRunning, startTask } from '@/lib/runner';
import type { AgentRunOptions, Block, ModelProfile } from '@/lib/types';
import type { UploadRef } from '@/lib/types';
import { consumeUploads, promptWithAttachments } from '@/lib/uploads';

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
  const projectId = new URL(req.url).searchParams.get('projectId') || DEFAULT_PROJECT_ID;
  const task = getTaskForProject(id, projectId);
  if (!task) return NextResponse.json({ error: 'task not found' }, { status: 404 });
  if (isRunning(id)) return NextResponse.json({ error: 'task is already running' }, { status: 409 });

  const body = (await req.json().catch(() => null)) as
    | { input?: string; options?: Partial<AgentRunOptions>; attachments?: UploadRef[] }
    | null;
  const input = String(body?.input ?? '').trim();
  if (!input) return NextResponse.json({ error: 'input required' }, { status: 400 });

  const snapshot = buildSnapshot(id, projectId);
  const priorBlocks = snapshot?.blocks ?? [];
  const attachmentNames = consumeUploads(id, Array.isArray(body?.attachments) ? body.attachments : []);
  const block = {
    id: `user-${id}-${Date.now()}`,
    kind: 'user' as const,
    text: input,
    meta: attachmentNames.length ? { attachments: attachmentNames } : undefined,
  };
  const seq = appendEvent(id, 'block.add', { block });
  publish(id, { seq, type: 'block.add', block } as any);

  // When this message answers a pending clarification, mark the original card
  // as answered (mirrors how approve patches the plan block). This collapses
  // the card so it can no longer be submitted twice.
  const pendingClarification = [...priorBlocks]
    .reverse()
    .find((b) => b.kind === 'clarification' && b.meta?.answered !== true);
  if (pendingClarification) {
    const patch = { meta: { ...pendingClarification.meta, answered: true, answer: input } };
    const patchSeq = appendEvent(id, 'block.patch', { id: pendingClarification.id, patch });
    publish(id, { seq: patchSeq, type: 'block.patch', id: pendingClarification.id, patch } as any);
  }

  startTask(
    id,
    conversationContext(priorBlocks, promptWithAttachments(input, attachmentNames)),
    parseOptions(body?.options),
    body?.options?.auto ? 'execute' : 'plan',
  );
  return NextResponse.json({ ok: true, taskId: id }, { status: 202 });
}
