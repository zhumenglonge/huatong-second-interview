import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ArtifactRow,
  Block,
  EventRow,
  ProjectRow,
  StepRow,
  TaskRow,
  TaskSnapshot,
} from './types';
import { applyEventToBlocks } from './reducer';

// ---------------------------------------------------------------------------
// Storage location
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR || '.data');
export const SANDBOX_ROOT = path.join(DATA_DIR, 'sandboxes');
export const DEFAULT_PROJECT_ID = 'quick-tasks';

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(SANDBOX_ROOT, { recursive: true });
}

// Survive Next.js dev HMR: keep a single connection on globalThis.
const globalForDb = globalThis as unknown as { __biomniDb?: DatabaseSync };

function getDb(): DatabaseSync {
  if (globalForDb.__biomniDb) return globalForDb.__biomniDb;
  ensureDirs();
  const db = new DatabaseSync(path.join(DATA_DIR, 'biomni.db'));
  db.prepare('PRAGMA journal_mode = WAL').get();
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      input TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_seq INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS steps (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      ord INTEGER NOT NULL,
      detail TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      size INTEGER NOT NULL,
      path TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS skill_settings (
      skill_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_task_seq ON events (task_id, seq);
    CREATE INDEX IF NOT EXISTS idx_steps_task ON steps (task_id, ord);
    CREATE INDEX IF NOT EXISTS idx_artifacts_task ON artifacts (task_id, created_at);
  `);
  const taskColumns = db.prepare(`PRAGMA table_info(tasks)`).all() as { name: string }[];
  if (!taskColumns.some((c) => c.name === 'project_id')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN project_id TEXT`);
  }
  if (!taskColumns.some((c) => c.name === 'notes')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN notes TEXT`);
  }
  const now = Date.now();
  db.prepare(
    `INSERT OR IGNORE INTO projects (id, name, created_at, updated_at, is_default)
     VALUES (?, ?, ?, ?, 1)`,
  ).run(DEFAULT_PROJECT_ID, '快速任务', now, now);
  db.prepare(`UPDATE tasks SET project_id = ? WHERE project_id IS NULL OR project_id = ''`).run(DEFAULT_PROJECT_ID);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_project_created ON tasks (project_id, created_at DESC)`);
  globalForDb.__biomniDb = db;
  return db;
}

export function getSkillEnablement(skillId: string): boolean | undefined {
  const row = getDb().prepare(`SELECT enabled FROM skill_settings WHERE skill_id = ?`).get(skillId) as { enabled?: number } | undefined;
  return row ? Boolean(row.enabled) : undefined;
}

export function setSkillEnablement(skillId: string, enabled: boolean) {
  getDb().prepare(`INSERT INTO skill_settings (skill_id, enabled, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(skill_id) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at`)
    .run(skillId, enabled ? 1 : 0, Date.now());
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export function listProjects(): ProjectRow[] {
  const rows = getDb().prepare(`SELECT * FROM projects ORDER BY is_default DESC, created_at ASC`).all() as Record<string, unknown>[];
  return rows.map(mapProject);
}

export function getProject(id: string): ProjectRow | undefined {
  const row = getDb().prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? mapProject(row) : undefined;
}

export function createProject(name: string, id = `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`): ProjectRow {
  const now = Date.now();
  getDb()
    .prepare(`INSERT INTO projects (id, name, created_at, updated_at, is_default) VALUES (?, ?, ?, ?, 0)`)
    .run(id, name.trim(), now, now);
  return getProject(id)!;
}

export function renameProject(id: string, name: string): ProjectRow | undefined {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const result = getDb()
    .prepare(`UPDATE projects SET name = ?, updated_at = ? WHERE id = ?`)
    .run(trimmed, Date.now(), id);
  if (!result.changes) return undefined;
  return getProject(id);
}

export type DeleteProjectResult = 'deleted' | 'not_found' | 'default' | 'not_empty';

export function deleteProject(id: string): DeleteProjectResult {
  const project = getProject(id);
  if (!project) return 'not_found';
  if (project.isDefault) return 'default';
  const row = getDb().prepare(`SELECT COUNT(*) AS count FROM tasks WHERE project_id = ?`).get(id) as { count: number };
  if (Number(row?.count ?? 0) > 0) return 'not_empty';
  getDb().prepare(`DELETE FROM projects WHERE id = ?`).run(id);
  return 'deleted';
}

export function createTask(id: string, title: string, input: string, projectId = DEFAULT_PROJECT_ID): TaskRow {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO tasks (id, title, input, project_id, status, error, created_at, updated_at, last_seq)
       VALUES (?, ?, ?, ?, 'queued', NULL, ?, ?, 0)`,
    )
    .run(id, title, input, projectId, now, now);
  return getTask(id)!;
}

export function getTask(id: string): TaskRow | undefined {
  const row = getDb().prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapTask(row) : undefined;
}

export function getTaskForProject(id: string, projectId: string): TaskRow | undefined {
  const row = getDb().prepare(`SELECT * FROM tasks WHERE id = ? AND project_id = ?`).get(id, projectId) as Record<string, unknown> | undefined;
  return row ? mapTask(row) : undefined;
}

export function listTasks(projectId?: string): TaskRow[] {
  const rows = getDb()
    .prepare(projectId ? `SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC LIMIT 100` : `SELECT * FROM tasks ORDER BY created_at DESC LIMIT 100`)
    .all(...(projectId ? [projectId] : [])) as Record<string, unknown>[];
  return rows.map(mapTask);
}

export function updateTaskStatus(id: string, status: TaskRow['status'], error?: string | null) {
  getDb()
    .prepare(`UPDATE tasks SET status = ?, error = ?, updated_at = ? WHERE id = ?`)
    .run(status, error ?? null, Date.now(), id);
}

/** Persist the user-authored note text for a task (right-panel Notes editor). */
export function updateTaskNotes(id: string, notes: string): TaskRow | undefined {
  getDb()
    .prepare(`UPDATE tasks SET notes = ?, updated_at = ? WHERE id = ?`)
    .run(notes, Date.now(), id);
  return getTask(id);
}

export function taskBelongsToProject(taskId: string, projectId: string): boolean {
  const row = getDb().prepare(`SELECT 1 FROM tasks WHERE id = ? AND project_id = ?`).get(taskId, projectId);
  return Boolean(row);
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

export function addStep(step: StepRow) {
  getDb()
    .prepare(
      `INSERT INTO steps (id, task_id, name, status, ord, detail, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(step.id, step.taskId, step.name, step.status, step.ord, step.detail, step.createdAt, step.updatedAt);
}

export function updateStep(id: string, patch: Partial<Pick<StepRow, 'status' | 'detail'>>) {
  const cur = getDb().prepare(`SELECT * FROM steps WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  if (!cur) return;
  getDb()
    .prepare(`UPDATE steps SET status = ?, detail = ?, updated_at = ? WHERE id = ?`)
    .run(
      (patch.status as string) ?? (cur.status as string),
      (patch.detail as string | null) ?? (cur.detail as string | null),
      Date.now(),
      id,
    );
}

export function listSteps(taskId: string): StepRow[] {
  const rows = getDb()
    .prepare(`SELECT * FROM steps WHERE task_id = ? ORDER BY ord ASC`)
    .all(taskId) as Record<string, unknown>[];
  return rows.map(mapStep);
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

export function addArtifact(a: ArtifactRow) {
  getDb()
    .prepare(
      `INSERT INTO artifacts (id, task_id, name, kind, size, path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(a.id, a.taskId, a.name, a.kind, a.size, a.path, a.createdAt);
}

export function listArtifacts(taskId: string): ArtifactRow[] {
  const rows = getDb()
    .prepare(`SELECT * FROM artifacts WHERE task_id = ? ORDER BY created_at ASC`)
    .all(taskId) as Record<string, unknown>[];
  return rows.map(mapArtifact);
}

// ---------------------------------------------------------------------------
// Event log (drives SSE replay + refresh recovery)
// ---------------------------------------------------------------------------

export function appendEvent(taskId: string, type: string, payload: unknown): number {
  const db = getDb();
  const seq =
    ((db.prepare(`SELECT MAX(seq) AS m FROM events WHERE task_id = ?`).get(taskId) as { m: number | null })
      ?.m ?? 0) + 1;
  db.prepare(
    `INSERT INTO events (task_id, seq, type, payload, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(taskId, seq, type, JSON.stringify(payload), Date.now());
  db.prepare(`UPDATE tasks SET last_seq = ?, updated_at = ? WHERE id = ?`).run(seq, Date.now(), taskId);
  return seq;
}

export function listEvents(taskId: string, afterSeq = 0): EventRow[] {
  const rows = getDb()
    .prepare(`SELECT * FROM events WHERE task_id = ? AND seq > ? ORDER BY seq ASC`)
    .all(taskId, afterSeq) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as number,
    taskId: r.task_id as string,
    seq: r.seq as number,
    type: r.type as string,
    payload: JSON.parse(r.payload as string),
    createdAt: r.created_at as number,
  }));
}

// ---------------------------------------------------------------------------
// Snapshot (for refresh recovery)
// ---------------------------------------------------------------------------

/**
 * Rebuild the conversation block list by replaying the persisted event log.
 * This is the same reducer the client uses live, guaranteeing refresh == live.
 */
export function buildSnapshot(taskId: string, projectId?: string): TaskSnapshot | undefined {
  const task = projectId ? getTaskForProject(taskId, projectId) : getTask(taskId);
  if (!task) return undefined;
  const events = listEvents(taskId, 0);
  const blocks: Block[] = [];
  for (const ev of events) applyEventToBlocks(blocks, ev.type, ev.payload);
  return {
    task,
    steps: listSteps(taskId),
    artifacts: listArtifacts(taskId),
    blocks,
    lastSeq: task.lastSeq,
  };
}

/** Pure reducer re-exported for convenience (impl lives in ./reducer). */
export { applyEventToBlocks } from './reducer';

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapTask(r: Record<string, unknown>): TaskRow {
  return {
    id: r.id as string,
    projectId: (r.project_id as string) || DEFAULT_PROJECT_ID,
    title: r.title as string,
    input: r.input as string,
    status: r.status as TaskRow['status'],
    error: (r.error as string | null) ?? null,
    notes: (r.notes as string | null) ?? '',
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
    lastSeq: r.last_seq as number,
  };
}

function mapProject(r: Record<string, unknown>): ProjectRow {
  return {
    id: r.id as string,
    name: r.name as string,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
    isDefault: Boolean(r.is_default),
  };
}

function mapStep(r: Record<string, unknown>): StepRow {
  return {
    id: r.id as string,
    taskId: r.task_id as string,
    name: r.name as string,
    status: r.status as StepRow['status'],
    ord: r.ord as number,
    detail: (r.detail as string | null) ?? null,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
  };
}

function mapArtifact(r: Record<string, unknown>): ArtifactRow {
  return {
    id: r.id as string,
    taskId: r.task_id as string,
    name: r.name as string,
    kind: r.kind as string,
    size: r.size as number,
    path: r.path as string,
    createdAt: r.created_at as number,
  };
}
