import { NextResponse } from 'next/server';
import { appendEvent, buildSnapshot, getTaskForProject, DEFAULT_PROJECT_ID } from '@/lib/db';
import { publish } from '@/lib/events';
import { isRunning, startTask } from '@/lib/runner';
import type { AgentRunOptions } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = new URL(_req.url).searchParams.get('projectId') || DEFAULT_PROJECT_ID;
  const task = getTaskForProject(id, projectId);
  if (!task) return NextResponse.json({ error: 'task not found' }, { status: 404 });
  if (isRunning(id)) return NextResponse.json({ error: 'task is already running' }, { status: 409 });

  const snapshot = buildSnapshot(id, projectId);
  const plan = [...(snapshot?.blocks ?? [])].reverse().find((block) => block.kind === 'plan');
  if (!plan) return NextResponse.json({ error: 'plan not found' }, { status: 409 });
  const options = plan.meta?.options as AgentRunOptions | undefined;
  const executionPrompt = String(plan.meta?.executionPrompt ?? task.input);

  const seq = appendEvent(id, 'block.patch', { id: plan.id, patch: { meta: { ...plan.meta, approved: true } } });
  publish(id, { seq, type: 'block.patch', id: plan.id, patch: { meta: { ...plan.meta, approved: true } } } as any);
  startTask(id, `Execute the approved plan below.\n\n${plan.text ?? ''}\n\nOriginal request:\n${executionPrompt}`, options, 'execute');
  return NextResponse.json({ ok: true }, { status: 202 });
}
