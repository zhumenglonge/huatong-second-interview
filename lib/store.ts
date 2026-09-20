import { create } from 'zustand';
import { applyEventToBlocks } from './reducer';
import type { AgentRunOptions, ArtifactRow, Block, ProjectRow, ServerEvent, TaskRow, TaskStatus, UploadRef } from './types';

interface TaskState {
  projects: ProjectRow[];
  activeProjectId: string | null;
  tasks: TaskRow[];
  currentId: string | null;
  blocks: Block[];
  artifacts: ArtifactRow[];
  status: TaskStatus | null;
  taskError: string | null;
  lastSeq: number;
  connected: boolean;

  loadProjects: () => Promise<void>;
  switchProject: (id: string) => Promise<void>;
  refreshTasks: () => Promise<void>;
  newTask: () => void;
  selectTask: (id: string) => Promise<void>;
  send: (input: string, options?: AgentRunOptions, attachments?: UploadRef[]) => Promise<boolean>;
  cancel: () => Promise<void>;
  retry: () => Promise<void>;
}

let es: EventSource | null = null;
let refreshToken = 0;

function closeEs() {
  if (es) {
    es.close();
    es = null;
  }
}

export const useTaskStore = create<TaskState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  tasks: [],
  currentId: null,
  blocks: [],
  artifacts: [],
  status: null,
  taskError: null,
  lastSeq: 0,
  connected: false,

  loadProjects: async () => {
    const res = await fetch('/api/projects');
    if (!res.ok) return;
    const body = (await res.json()) as { projects?: ProjectRow[] };
    const projects = Array.isArray(body.projects) ? body.projects : [];
    const current = get().activeProjectId;
    const activeProjectId = projects.some((project) => project.id === current)
      ? current
      : projects[0]?.id ?? null;
    if (current && current !== activeProjectId) {
      ++refreshToken;
      closeEs();
      set({
        projects,
        activeProjectId,
        tasks: [],
        currentId: null,
        blocks: [],
        artifacts: [],
        status: null,
        taskError: null,
        lastSeq: 0,
        connected: false,
      });
      return;
    }
    set({ projects, activeProjectId });
  },

  switchProject: async (id) => {
    const projects = get().projects;
    if (projects.length && !projects.some((project) => project.id === id)) return;
    const token = ++refreshToken;
    closeEs();
    set({
      activeProjectId: id,
      tasks: [],
      currentId: null,
      blocks: [],
      artifacts: [],
      status: null,
      taskError: null,
      lastSeq: 0,
      connected: false,
    });
    await get().refreshTasks();
    if (token !== refreshToken) return;
  },

  refreshTasks: async () => {
    if (!get().projects.length) await get().loadProjects();
    const projectId = get().activeProjectId;
    // Never fall back to the unscoped task endpoint: an unavailable project
    // must not expose another project's tasks.
    if (!projectId) {
      set({ tasks: [], currentId: null, blocks: [], artifacts: [], status: null, taskError: null });
      return;
    }
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    const token = refreshToken;
    const res = await fetch(`/api/tasks${query}`);
    if (!res.ok) return;
    const { tasks } = (await res.json()) as { tasks: TaskRow[] };
    if (token !== refreshToken || projectId !== get().activeProjectId) return;
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
    const task = get().tasks.find((item) => item.id === id);
    if (!task || (task.projectId && task.projectId !== get().activeProjectId)) return;
    closeEs();
    set({ currentId: id, blocks: [], artifacts: [], status: null, taskError: null, lastSeq: 0 });
    await reloadSnapshot(id, get().activeProjectId);
    if (get().currentId === id) openStream(id, get().activeProjectId);
  },

  send: async (input, options, attachments = []) => {
    const currentId = get().currentId;
    const endpoint = currentId ? `/api/tasks/${currentId}/messages` : '/api/tasks';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, options, attachments, projectId: get().activeProjectId }),
    });
    if (!res.ok) return false;

    if (currentId) {
      // The existing EventSource receives the appended user block and the
      // continued agent run. Resync as a backstop when the stream is offline.
      if (!get().connected) await reloadSnapshot(currentId, get().activeProjectId);
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
    await fetch(`/api/tasks/${id}/cancel?projectId=${encodeURIComponent(get().activeProjectId ?? '')}`, { method: 'POST' });
  },

  retry: async () => {
    const id = get().currentId;
    if (!id) return;
    await fetch(`/api/tasks/${id}/retry?projectId=${encodeURIComponent(get().activeProjectId ?? '')}`, { method: 'POST' });
  },
}));

// ---------------------------------------------------------------------------
// SSE + refresh recovery
// ---------------------------------------------------------------------------

async function reloadSnapshot(id: string, projectId: string | null) {
  const suffix = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  const res = await fetch(`/api/tasks/${id}${suffix}`);
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

function openStream(id: string, projectId: string | null) {
  closeEs();
  const params = new URLSearchParams({ after: '0' });
  if (projectId) params.set('projectId', projectId);
  const source = new EventSource(`/api/tasks/${id}/stream?${params.toString()}`);
  es = source;

  source.onopen = () => {
    useTaskStore.setState({ connected: true });
    // On every (re)connect, resync from the persisted snapshot so replayed
    // deltas can never double-apply; the seq guard drops anything folded in.
    void reloadSnapshot(id, projectId);
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
