import { NextResponse } from 'next/server';
import { getTaskForProject, updateTaskNotes, DEFAULT_PROJECT_ID } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Persist the right-panel Notes text for a task. Notes are user-authored
 * metadata (not part of the agent event stream), so they live on the task row
 * rather than the event log. Project-scoped like every other task endpoint.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = new URL(req.url).searchParams.get('projectId') || DEFAULT_PROJECT_ID;
  if (!getTaskForProject(id, projectId)) {
    return NextResponse.json({ error: 'task not found' }, { status: 404 });
  }
  let body: { notes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const notes = typeof body.notes === 'string' ? body.notes : null;
  if (notes === null) return NextResponse.json({ error: 'notes must be a string' }, { status: 400 });
  const task = updateTaskNotes(id, notes);
  return NextResponse.json({ task });
}
