import { NextResponse } from 'next/server';
import { createProject, listProjects } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ projects: listProjects() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  const name = String(body?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (name.length > 80) return NextResponse.json({ error: 'name too long' }, { status: 400 });
  const project = createProject(name);
  return NextResponse.json({ project }, { status: 201 });
}
