'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useTaskStore } from '@/lib/store';
import type { TaskStatus } from '@/lib/types';

const STATUS_LABELS: Record<TaskStatus, string> = {
  queued: '排队中', running: '运行中', waiting: '等待输入', planning: '规划中',
  awaiting_approval: '等待审批', success: '成功', failed: '失败', cancelled: '已取消',
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function TaskOverview({ onSelectTask }: { onSelectTask: () => void }) {
  const tasks = useTaskStore((state) => state.tasks);
  const selectTask = useTaskStore((state) => state.selectTask);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | TaskStatus>('all');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesText = !normalized || `${task.title} ${task.input}`.toLowerCase().includes(normalized);
      return matchesText && (status === 'all' || task.status === status);
    });
  }, [query, status, tasks]);

  const openTask = async (id: string) => {
    await selectTask(id);
    onSelectTask();
  };

  return (
    <div className="task-overview">
      <div className="task-overview-head">
        <div><div className="task-overview-eyebrow">PROJECT</div><h2>任务总览</h2></div>
        <span className="task-overview-count">{filtered.length} / {tasks.length}</span>
      </div>
      <div className="task-overview-toolbar">
        <label className="task-overview-search"><Search size={16} /><input aria-label="搜索任务" placeholder="搜索任务" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" aria-label="清空搜索" onClick={() => setQuery('')}><X size={14} /></button>}</label>
        <select aria-label="任务状态筛选" value={status} onChange={(event) => setStatus(event.target.value as 'all' | TaskStatus)}>
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((key) => <option key={key} value={key}>{STATUS_LABELS[key]}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? <div className="task-overview-empty">没有找到匹配的任务</div> : <div className="task-overview-table-wrap"><table className="task-overview-table"><thead><tr><th>名称</th><th>状态</th><th>最近活动</th><th>创建时间</th></tr></thead><tbody>{filtered.map((task) => <tr key={task.id} tabIndex={0} onClick={() => void openTask(task.id)} onKeyDown={(event) => { if (event.key === 'Enter') void openTask(task.id); }}><td className="task-overview-name">{task.title}</td><td><span className={`overview-status status-${task.status}`}>{STATUS_LABELS[task.status]}</span></td><td>{formatTime(task.updatedAt)}</td><td>{formatTime(task.createdAt)}</td></tr>)}</tbody></table></div>}
    </div>
  );
}
