import { NextResponse } from 'next/server';
import { cancelTask } from '@/lib/runner';
import { getTaskForProject, DEFAULT_PROJECT_ID } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = new URL(_req.url).searchParams.get('projectId') || DEFAULT_PROJECT_ID;
  if (!getTaskForProject(id, projectId)) return NextResponse.json({ error: 'task not found' }, { status: 404 });
  const ok = await cancelTask(id);
  if (!ok) return NextResponse.json({ error: 'task not running' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
