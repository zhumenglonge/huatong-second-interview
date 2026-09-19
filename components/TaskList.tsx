'use client';

import { useTaskStore } from '@/lib/store';
import { StatusBadge } from './StatusBadge';

export function TaskList() {
  const tasks = useTaskStore((s) => s.tasks);
  const currentId = useTaskStore((s) => s.currentId);
  const selectTask = useTaskStore((s) => s.selectTask);
  const newTask = useTaskStore((s) => s.newTask);

  return (
    <aside className="col">
      <div className="col-head">
        <span>任务</span>
        <button className="primary" onClick={newTask}>
          + 新建
        </button>
      </div>
      <div className="col-body">
        {tasks.length === 0 && <div className="empty">暂无任务</div>}
        {tasks.map((t) => (
          <div
            key={t.id}
            className={`task-item ${t.id === currentId ? 'active' : ''}`}
            onClick={() => selectTask(t.id)}
          >
            <span className="task-title">{t.title}</span>
            <StatusBadge status={t.status} />
          </div>
        ))}
      </div>
    </aside>
  );
}
