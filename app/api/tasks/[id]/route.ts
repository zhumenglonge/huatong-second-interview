import { NextResponse } from 'next/server';
import { buildSnapshot, getProject, DEFAULT_PROJECT_ID } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = new URL(_req.url).searchParams.get('projectId') || DEFAULT_PROJECT_ID;
  if (!getProject(projectId)) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  const snap = buildSnapshot(id, projectId);
  if (!snap) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(snap);
}
