'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTaskStore } from '@/lib/store';
import { IoNode, StepNode } from './StepNode';

type CNode = Node<{ label: string; status?: string; sub?: string }>;

const nodeTypes: NodeTypes = { step: StepNode, io: IoNode };

const GAP_Y = 110;

/**
 * Task canvas (innovation, option 1).
 * - live mode: derives a DAG from the persisted/streamed step blocks; node
 *   colour reflects 等待/执行中/成功/失败/已取消 in real time. Drag = layout
 *   only; zoom/pan always on.
 * - edit mode: user orchestrates a plan (add/drag/connect/delete nodes); on
 *   submit the graph is compiled into the prompt sent to the real agent.
 */
export function CanvasView() {
  const blocks = useTaskStore((s) => s.blocks);
  const artifacts = useTaskStore((s) => s.artifacts);
  const currentId = useTaskStore((s) => s.currentId);
  const status = useTaskStore((s) => s.status);
  const send = useTaskStore((s) => s.send);

  const [mode, setMode] = useState<'live' | 'edit'>('live');
  const [goal, setGoal] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState<CNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const positions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const nodeSeq = useRef(0);

  // ---- live derivation (single source of truth = blocks) ----
  const liveNodes = useMemo<CNode[]>(() => {
    const steps = blocks.filter((b) => b.kind === 'step');
    const out: CNode[] = [];
    const pos = (id: string, i: number) => positions.current.get(id) ?? { x: 40, y: i * GAP_Y };
    out.push({
      id: 'input',
      type: 'io',
      position: pos('input', 0),
      data: { label: '任务输入', sub: currentId ? '已提交' : '—' },
    });
    steps.forEach((b, i) => {
      out.push({
        id: b.id,
        type: 'step',
        position: pos(b.id, i + 1),
        data: { label: b.name ?? 'step', status: b.status ?? 'pending' },
      });
    });
    if (artifacts.length > 0 || status === 'success') {
      out.push({
        id: 'output',
        type: 'io',
        position: pos('output', steps.length + 1),
        data: { label: '结果产物', sub: `${artifacts.length} 个文件` },
      });
    }
    return out;
  }, [blocks, artifacts, status, currentId]);

  const liveEdges = useMemo<Edge[]>(() => {
    const ids = liveNodes.map((n) => n.id);
    const es: Edge[] = [];
    for (let i = 0; i < ids.length - 1; i++) {
      es.push({ id: `e-${ids[i]}-${ids[i + 1]}`, source: ids[i], target: ids[i + 1] });
    }
    return es;
  }, [liveNodes]);

  useEffect(() => {
    if (mode !== 'live') return;
    setNodes(liveNodes);
    setEdges(liveEdges);
  }, [mode, liveNodes, liveEdges, setNodes, setEdges]);

  // reset to live whenever a task is opened
  useEffect(() => {
    if (currentId) setMode('live');
  }, [currentId]);

  // ---- change handlers (live = layout only; edit = full orchestration) ----
  const handleNodesChange = useCallback(
    (changes: NodeChange<CNode>[]) => {
      const allowed =
        mode === 'live' ? changes.filter((c) => c.type !== 'remove') : changes;
      onNodesChange(allowed);
    },
    [mode, onNodesChange],
  );
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const allowed =
        mode === 'live' ? changes.filter((c) => c.type !== 'remove') : changes;
      onEdgesChange(allowed);
    },
    [mode, onEdgesChange],
  );
  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, id: `e-${c.source}-${c.target}` }, eds)),
    [setEdges],
  );
  const persistPosition = useCallback((id: string, x: number, y: number) => {
    positions.current.set(id, { x, y });
  }, []);
  const handleDragStop = useCallback(
    (_: unknown, node: CNode) => persistPosition(node.id, node.position.x, node.position.y),
    [persistPosition],
  );

  // ---- edit-mode actions ----
  const addNode = () => {
    nodeSeq.current += 1;
    const id = `plan-${nodeSeq.current}`;
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: 'step',
        position: { x: 40 + (ns.length % 3) * 160, y: 40 + Math.floor(ns.length / 3) * GAP_Y },
        data: { label: `步骤 ${nodeSeq.current}`, status: 'pending' },
      },
    ]);
  };
  const clearPlan = () => {
    setNodes([]);
    setEdges([]);
  };
  const runPlan = async () => {
    if (nodes.length === 0) return;
    const ordered = [...nodes].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
    const lines = ordered.map((n, i) => {
      const deps = edges.filter((e) => e.target === n.id).map((e) => nodes.find((x) => x.id === e.source)?.data.label);
      return `${i + 1}. ${n.data.label}${deps.length ? `（依赖: ${deps.join(', ')}）` : ''}`;
    });
    const NL = '\n';
    const head = goal.trim() ? goal.trim() + NL + NL : '';
    const prompt = head + '建议执行计划（按依赖顺序）:' + NL + lines.join(NL);
    setMode('live');
    await send(prompt);
  };

  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <div className="canvas-toolbar">
        <button className={mode === 'live' ? 'primary' : ''} onClick={() => setMode('live')}>
          实时视图
        </button>
        <button className={mode === 'edit' ? 'primary' : ''} onClick={() => setMode('edit')}>
          编排计划
        </button>
        {mode === 'edit' && (
          <>
            <input
              className="canvas-goal"
              placeholder="任务目标（可选）"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
            <button onClick={addNode}>+ 节点</button>
            <button onClick={clearPlan}>清空</button>
            <button className="primary" onClick={() => void runPlan()} disabled={nodes.length === 0}>
              按此计划执行
            </button>
          </>
        )}
        <span className="muted">
          {mode === 'live'
            ? '节点颜色=步骤状态；拖拽=布局，滚轮缩放/空白平移'
            : '拖拽节点、从圆点连线编排；Backspace 删除选中'}
        </span>
      </div>

      {mode === 'live' && !currentId && (
        <div className="canvas-empty">
          暂无运行中的任务。切到「编排计划」画一个执行计划，或回会话流输入任务。
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={mode === 'edit' ? onConnect : undefined}
        onNodeDragStop={handleDragStop}
        nodesConnectable={mode === 'edit'}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
