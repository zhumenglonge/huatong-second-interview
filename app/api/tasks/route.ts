import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { appendEvent, createTask, listTasks } from '@/lib/db';
import { publish } from '@/lib/events';
import { startTask } from '@/lib/runner';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ tasks: listTasks() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { input?: string } | null;
  const input = String(body?.input ?? '').trim();
  if (!input) return NextResponse.json({ error: 'input required' }, { status: 400 });

  const id = randomUUID();
  const task = createTask(id, input.slice(0, 40), input);

  // persist + broadcast the user's message as the first conversation block
  const seq = appendEvent(id, 'block.add', {
    block: { id: `user-${id}`, kind: 'user', text: input },
  });
  publish(id, { seq, type: 'block.add', block: { id: `user-${id}`, kind: 'user', text: input } } as any);

  // fire-and-forget: the real agent session runs in the background
  startTask(id, input);

  return NextResponse.json({ task }, { status: 201 });
}
