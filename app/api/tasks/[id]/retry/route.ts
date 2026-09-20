import { NextResponse } from 'next/server';
import { getTaskForProject, DEFAULT_PROJECT_ID } from '@/lib/db';
import { retryTask } from '@/lib/runner';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = new URL(_req.url).searchParams.get('projectId') || DEFAULT_PROJECT_ID;
  const task = getTaskForProject(id, projectId);
  if (!task) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (task.status === 'running' || task.status === 'queued') {
    return NextResponse.json({ error: 'task already running' }, { status: 409 });
  }
  retryTask(id, task.input);
  return NextResponse.json({ ok: true });
}
