import type { ServerEvent } from './types';

/**
 * In-memory per-task pub/sub bus bridging the background Runner and any number
 * of open SSE connections. Survives Next dev HMR via globalThis.
 */
type Listener = (ev: ServerEvent) => void;

const globalForBus = globalThis as unknown as {
  __biomniBus?: Map<string, Set<Listener>>;
};

function buses(): Map<string, Set<Listener>> {
  if (!globalForBus.__biomniBus) globalForBus.__biomniBus = new Map();
  return globalForBus.__biomniBus;
}

export function subscribe(taskId: string, fn: Listener): () => void {
  const map = buses();
  let set = map.get(taskId);
  if (!set) {
    set = new Set();
    map.set(taskId, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) map.delete(taskId);
  };
}

export function publish(taskId: string, ev: ServerEvent) {
  const set = buses().get(taskId);
  if (!set) return;
  for (const fn of [...set]) {
    try {
      fn(ev);
    } catch {
      // a dead subscriber must not break the runner
    }
  }
}
