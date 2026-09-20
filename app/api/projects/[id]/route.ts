import { NextResponse } from 'next/server';
import { deleteProject, getProject, renameProject } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  const name = String(body?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const project = renameProject(id, name);
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  return NextResponse.json({ project });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = deleteProject(id);
  if (result === 'not_found') return NextResponse.json({ error: 'project not found' }, { status: 404 });
  if (result === 'default') return NextResponse.json({ error: 'default project cannot be deleted' }, { status: 409 });
  if (result === 'not_empty') return NextResponse.json({ error: 'project has tasks' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
