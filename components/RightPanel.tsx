'use client';

import { useTaskStore } from '@/lib/store';

export function RightPanel() {
  const blocks = useTaskStore((s) => s.blocks);
  const artifacts = useTaskStore((s) => s.artifacts);
  const taskError = useTaskStore((s) => s.taskError);

  const steps = blocks.filter((b) => b.kind === 'step');

  return (
    <aside className="col">
      <div className="col-head">
        <span>追踪</span>
      </div>
      <div className="col-body">
        <div className="panel-section">
          <h4>待办 / 步骤</h4>
          {steps.length === 0 && <div className="muted">暂无步骤</div>}
          {steps.map((s) => (
            <div className="todo-row" key={s.id}>
              <span className={`dot ${s.status ?? 'pending'}`} />
              <span className="name">{s.name}</span>
            </div>
          ))}
        </div>

        <div className="panel-section">
          <h4>结果文件</h4>
          {artifacts.length === 0 && <div className="muted">暂无产物</div>}
          {artifacts.map((a) => (
            <div className="todo-row" key={a.id}>
              <span>📄</span>
              <span className="name" title={a.path}>
                {a.name}
              </span>
            </div>
          ))}
        </div>

        {taskError && (
          <div className="panel-section">
            <h4>错误</h4>
            <div className="error-box">{taskError}</div>
          </div>
        )}
      </div>
    </aside>
  );
}
