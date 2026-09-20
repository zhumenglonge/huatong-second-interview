'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useTaskStore } from '@/lib/store';
import { formatDateTime, useLocale } from '@/lib/i18n';
import type { TaskStatus } from '@/lib/types';

export function TaskOverview({ onSelectTask }: { onSelectTask: () => void }) {
  const tasks = useTaskStore((state) => state.tasks);
  const selectTask = useTaskStore((state) => state.selectTask);
  const { locale, t } = useLocale();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | TaskStatus>('all');

  const statusLabels: Record<TaskStatus, string> = {
    queued: t.status_queued, running: t.status_running, waiting: t.status_waiting, planning: t.status_planning,
    awaiting_approval: t.status_awaiting_approval, success: t.status_success, failed: t.status_failed, cancelled: t.status_cancelled,
  };
  const formatTime = (ts: number) => formatDateTime(ts, locale);

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
        <div><div className="task-overview-eyebrow">{t.projectLabel}</div><h2>{t.taskOverview}</h2></div>
        <span className="task-overview-count">{filtered.length} / {tasks.length}</span>
      </div>
      <div className="task-overview-toolbar">
        <label className="task-overview-search"><Search size={16} /><input aria-label={t.searchTasks} placeholder={t.searchTasks} value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" aria-label={t.clearSearch} onClick={() => setQuery('')}><X size={14} /></button>}</label>
        <select aria-label={t.statusFilter} value={status} onChange={(event) => setStatus(event.target.value as 'all' | TaskStatus)}>
          <option value="all">{t.allStatuses}</option>
          {(Object.keys(statusLabels) as TaskStatus[]).map((key) => <option key={key} value={key}>{statusLabels[key]}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? <div className="task-overview-empty">{t.noMatch}</div> : <div className="task-overview-table-wrap"><table className="task-overview-table"><thead><tr><th>{t.taskName}</th><th>{t.status}</th><th>{t.recentActivity}</th><th>{t.createdAt}</th></tr></thead><tbody>{filtered.map((task) => <tr key={task.id} tabIndex={0} onClick={() => void openTask(task.id)} onKeyDown={(event) => { if (event.key === 'Enter') void openTask(task.id); }}><td className="task-overview-name">{task.title}</td><td><span className={`overview-status status-${task.status}`}>{statusLabels[task.status]}</span></td><td>{formatTime(task.updatedAt)}</td><td>{formatTime(task.createdAt)}</td></tr>)}</tbody></table></div>}
    </div>
  );
}
