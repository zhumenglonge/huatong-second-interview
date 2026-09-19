import { create } from 'zustand';
import { applyEventToBlocks } from './reducer';
import type { AgentRunOptions, ArtifactRow, Block, ServerEvent, TaskRow, TaskStatus, UploadRef } from './types';

interface TaskState {
  tasks: TaskRow[];
  currentId: string | null;
  blocks: Block[];
  artifacts: ArtifactRow[];
  status: TaskStatus | null;
  taskError: string | null;
  lastSeq: number;
  connected: boolean;

  refreshTasks: () => Promise<void>;
  newTask: () => void;
  selectTask: (id: string) => Promise<void>;
  send: (input: string, options?: AgentRunOptions, attachments?: UploadRef[]) => Promise<boolean>;
  cancel: () => Promise<void>;
  retry: () => Promise<void>;
}

let es: EventSource | null = null;

function closeEs() {
  if (es) {
    es.close();
    es = null;
  }
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  currentId: null,
  blocks: [],
  artifacts: [],
  status: null,
  taskError: null,
  lastSeq: 0,
  connected: false,

  refreshTasks: async () => {
    const res = await fetch('/api/tasks');
    if (!res.ok) return;
    const { tasks } = (await res.json()) as { tasks: TaskRow[] };
    set({ tasks });
  },

  newTask: () => {
    closeEs();
    set({
      currentId: null,
      blocks: [],
      artifacts: [],
      status: null,
      taskError: null,
      lastSeq: 0,
      connected: false,
    });
  },

  selectTask: async (id) => {
    closeEs();
    set({ currentId: id, blocks: [], artifacts: [], status: null, taskError: null, lastSeq: 0 });
    await reloadSnapshot(id);
    openStream(id);
  },

  send: async (input, options, attachments = []) => {
    const currentId = get().currentId;
    const endpoint = currentId ? `/api/tasks/${currentId}/messages` : '/api/tasks';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, options, attachments }),
    });
    if (!res.ok) return false;

    if (currentId) {
      // The existing EventSource receives the appended user block and the
      // continued agent run. Resync as a backstop when the stream is offline.
      if (!get().connected) await reloadSnapshot(currentId);
      await get().refreshTasks();
      return true;
    }

    const { task } = (await res.json()) as { task: TaskRow };
    await get().refreshTasks();
    await get().selectTask(task.id);
    return true;
  },

  cancel: async () => {
    const id = get().currentId;
    if (!id) return;
    await fetch(`/api/tasks/${id}/cancel`, { method: 'POST' });
  },

  retry: async () => {
    const id = get().currentId;
    if (!id) return;
    await fetch(`/api/tasks/${id}/retry`, { method: 'POST' });
  },
}));

// ---------------------------------------------------------------------------
// SSE + refresh recovery
// ---------------------------------------------------------------------------

async function reloadSnapshot(id: string) {
  const res = await fetch(`/api/tasks/${id}`);
  if (!res.ok) return;
  const snap = (await res.json()) as {
    task: TaskRow;
    artifacts: ArtifactRow[];
    blocks: Block[];
    lastSeq: number;
  };
  useTaskStore.setState({
    blocks: snap.blocks,
    artifacts: snap.artifacts,
    status: snap.task.status,
    taskError: snap.task.error,
    lastSeq: snap.lastSeq,
  });
}

function openStream(id: string) {
  closeEs();
  const source = new EventSource(`/api/tasks/${id}/stream?after=0`);
  es = source;

  source.onopen = () => {
    useTaskStore.setState({ connected: true });
    // On every (re)connect, resync from the persisted snapshot so replayed
    // deltas can never double-apply; the seq guard drops anything folded in.
    void reloadSnapshot(id);
  };
  source.onerror = () => useTaskStore.setState({ connected: false });

  source.onmessage = (e) => {
    if (useTaskStore.getState().currentId !== id) return;
    let ev: ServerEvent;
    try {
      ev = JSON.parse(e.data) as ServerEvent;
    } catch {
      return;
    }
    applyEvent(ev);
  };
}

function applyEvent(ev: ServerEvent) {
  const cur = useTaskStore.getState();
  if (ev.seq <= cur.lastSeq) return; // de-dup replay vs live

  if (ev.type === 'task.status') {
    useTaskStore.setState({ status: ev.status, taskError: ev.error ?? null, lastSeq: ev.seq });
    void cur.refreshTasks();
    return;
  }

  const { payload } = split(ev);
  const draft = cur.blocks.map(cloneBlock);
  applyEventToBlocks(draft, ev.type, payload);

  if (ev.type === 'artifact.add') {
    useTaskStore.setState({
      blocks: draft,
      artifacts: [...cur.artifacts, ev.artifact],
      lastSeq: ev.seq,
    });
    return;
  }
  useTaskStore.setState({ blocks: draft, lastSeq: ev.seq });
}

function split(ev: ServerEvent): { payload: Record<string, any> } {
  const { seq: _s, type: _t, ...rest } = ev as any;
  return { payload: rest };
}

function cloneBlock(b: Block): Block {
  return { ...b, meta: b.meta ? { ...b.meta } : b.meta };
}
