import { NextResponse } from 'next/server';
import { cancelTask } from '@/lib/runner';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await cancelTask(id);
  if (!ok) return NextResponse.json({ error: 'task not running' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
