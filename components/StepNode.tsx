'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface StepNodeData {
  label: string;
  status?: string;
  sub?: string;
  [key: string]: unknown;
}

const STATUS_TEXT: Record<string, string> = {
  pending: '等待',
  running: '执行中',
  success: '成功',
  failed: '失败',
  cancelled: '已取消',
};

/** Custom React Flow node reflecting a live agent step state. */
export function StepNode({ data, selected }: NodeProps) {
  const d = data as unknown as StepNodeData;
  const status = d.status ?? 'pending';
  return (
    <div className={`rf-node rf-${status} ${selected ? 'rf-selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="rf-row">
        <span className={`dot ${status}`} />
        <span className="rf-label">{d.label}</span>
      </div>
      <div className="rf-sub">{STATUS_TEXT[status] ?? status}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

/** Neutral node for the task input / final outputs. */
export function IoNode({ data, selected }: NodeProps) {
  const d = data as unknown as StepNodeData;
  return (
    <div className={`rf-node rf-io ${selected ? 'rf-selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="rf-label">{d.label}</div>
      {d.sub ? <div className="rf-sub">{d.sub}</div> : null}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
