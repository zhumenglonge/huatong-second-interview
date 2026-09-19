import { listEvents } from '@/lib/db';
import { subscribe } from '@/lib/events';
import type { ServerEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * SSE stream for a task.
 *
 * Refresh-recovery protocol: subscribe FIRST, then replay persisted events
 * with seq > `after`. Because the runner appends to SQLite *before* publishing,
 * every event published before we subscribe is already in the DB (caught by
 * replay), and every event after is caught by the listener. A monotonic
 * `lastSent` guard de-duplicates the overlap.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const after = Number(new URL(req.url).searchParams.get('after') ?? 0) || 0;

  const encoder = new TextEncoder();
  let lastSent = after;
  let closed = false;
  let teardown = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (ev: ServerEvent) => {
        if (closed || ev.seq <= lastSent) return;
        lastSent = ev.seq;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // 1) live tail first (catches anything published during/after replay)
      const unsubscribe = subscribe(id, send);
      // 2) replay persisted history for refresh recovery
      for (const e of listEvents(id, after)) {
        send({ seq: e.seq, type: e.type, ...(e.payload as object) } as ServerEvent);
      }

      const ping = setInterval(() => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            closed = true;
          }
        }
      }, 15000);

      teardown = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener('abort', teardown);
    },
    cancel() {
      teardown();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
