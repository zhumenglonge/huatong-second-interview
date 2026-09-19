import { NextResponse } from 'next/server';
import { buildSnapshot } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snap = buildSnapshot(id);
  if (!snap) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(snap);
}
