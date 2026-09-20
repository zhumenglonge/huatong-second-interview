import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { appendEvent, createTask, listProjects, getProject, listTasks, DEFAULT_PROJECT_ID } from '@/lib/db';
import { publish } from '@/lib/events';
import { startTask } from '@/lib/runner';
import type { AgentRunOptions, ModelProfile } from '@/lib/types';
import type { UploadRef } from '@/lib/types';
import { consumeUploads, promptWithAttachments } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get('projectId') || DEFAULT_PROJECT_ID;
  if (!getProject(projectId)) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  return NextResponse.json({ projects: listProjects(), activeProjectId: projectId, tasks: listTasks(projectId) });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { input?: string; projectId?: string; options?: Partial<AgentRunOptions>; attachments?: UploadRef[] }
    | null;
  const input = String(body?.input ?? '').trim();
  if (!input) return NextResponse.json({ error: 'input required' }, { status: 400 });
  const projectId = String(body?.projectId || DEFAULT_PROJECT_ID);
  if (!getProject(projectId)) return NextResponse.json({ error: 'project not found' }, { status: 404 });

  const availableModels: ModelProfile[] = [
    'Auto', 'Qwen3.8-Max', 'Qwen3.8-Flash', 'Qwen3.7-Max', 'Qwen3.7-Plus',
    'Qwen3.7-Flash', 'DeepSeek-V4-Pro', 'DeepSeek-Flash', 'GLM-5.3',
    'GLM-5.3-Flash', 'GLM-5.2', 'Kimi-K3', 'Kimi-K2.8-Preview', 'MiniMax-M2.7',
  ];
  const requestedModel = body?.options?.model;
  const model = availableModels.includes(requestedModel as ModelProfile)
    ? (requestedModel as ModelProfile)
    : 'Auto';
  const options: AgentRunOptions = {
    model,
    skills: Array.isArray(body?.options?.skills)
      ? body.options.skills.map(String).filter(Boolean).slice(0, 8)
      : [],
    auto: Boolean(body?.options?.auto),
  };

  const id = randomUUID();
  const task = createTask(id, input.slice(0, 40), input, projectId);
  const attachmentNames = consumeUploads(id, Array.isArray(body?.attachments) ? body.attachments : []);

  // persist + broadcast the user's message as the first conversation block
  const userBlock = {
    id: `user-${id}`,
    kind: 'user' as const,
    text: input,
    meta: attachmentNames.length ? { attachments: attachmentNames } : undefined,
  };
  const seq = appendEvent(id, 'block.add', { block: userBlock });
  publish(id, { seq, type: 'block.add', block: userBlock } as any);

  // fire-and-forget: the real agent session runs in the background
  startTask(id, promptWithAttachments(input, attachmentNames), options, options.auto ? 'execute' : 'plan');

  return NextResponse.json({ task }, { status: 201 });
}
