// Shared domain types (server + client).

export type TaskStatus =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'planning'
  | 'awaiting_approval'
  | 'success'
  | 'failed'
  | 'cancelled';

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export type ModelProfile =
  | 'Auto'
  | 'Qwen3.8-Max'
  | 'Qwen3.8-Flash'
  | 'Qwen3.7-Max'
  | 'Qwen3.7-Plus'
  | 'Qwen3.7-Flash'
  | 'DeepSeek-V4-Pro'
  | 'DeepSeek-Flash'
  | 'GLM-5.3'
  | 'GLM-5.3-Flash'
  | 'GLM-5.2'
  | 'Kimi-K3'
  | 'Kimi-K2.8-Preview'
  | 'MiniMax-M2.7';

export interface AgentRunOptions {
  model: ModelProfile;
  skills: string[];
  auto: boolean;
}

export interface UploadRef {
  token: string;
  name: string;
  size: number;
}

export interface TaskRow {
  id: string;
  projectId?: string;
  title: string;
  input: string;
  status: TaskStatus;
  error: string | null;
  createdAt: number;
  updatedAt: number;
  lastSeq: number;
}

export interface ProjectRow {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  isDefault: boolean;
}

export interface StepRow {
  id: string;
  taskId: string;
  name: string;
  status: StepStatus;
  ord: number;
  detail: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ArtifactRow {
  id: string;
  taskId: string;
  name: string;
  kind: string;
  size: number;
  path: string;
  createdAt: number;
}

export interface EventRow {
  id: number;
  taskId: string;
  seq: number;
  type: string;
  payload: unknown;
  createdAt: number;
}

/**
 * A conversational / process block rendered in the middle column.
 * Kept as a single JSON-friendly shape so it survives SSE + SQLite serialization.
 */
export interface Block {
  id: string;
  kind: 'user' | 'agent_text' | 'step' | 'trace' | 'plan' | 'clarification' | 'artifact' | 'error';
  /** user text / accumulated agent text / trace content / error message */
  text?: string;
  /** step name / artifact name / plan title */
  name?: string;
  status?: StepStatus;
  meta?: Record<string, unknown>;
}

/** Server -> client streaming events (SSE). `seq` is monotonic per task. */
export type ServerEvent =
  | { seq: number; type: 'task.status'; taskId: string; status: TaskStatus; error?: string | null }
  | { seq: number; type: 'block.add'; block: Block }
  | { seq: number; type: 'block.delta'; id: string; delta: string }
  | { seq: number; type: 'block.status'; id: string; status: StepStatus }
  | { seq: number; type: 'block.patch'; id: string; patch: Partial<Block> }
  | { seq: number; type: 'artifact.add'; artifact: ArtifactRow };

export interface TaskSnapshot {
  task: TaskRow;
  steps: StepRow[];
  artifacts: ArtifactRow[];
  blocks: Block[];
  lastSeq: number;
}
