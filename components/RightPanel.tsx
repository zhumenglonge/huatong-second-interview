'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Cpu,
  FileText,
  Flashlight,
  Network,
  NotebookPen,
  RefreshCw,
  RotateCcw,
  X,
} from 'lucide-react';
import { useTaskStore } from '@/lib/store';

type SectionId = 'todo' | 'results' | 'compute' | 'notes';

const SECTION_LABELS: Record<SectionId, string> = {
  todo: '待办',
  results: '结果',
  compute: '计算',
  notes: '笔记',
};

function PanelSection({
  id,
  title,
  open,
  onToggle,
  onClose,
  actions,
  children,
}: {
  id: SectionId;
  title: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`tracker-section tracker-section-${id} ${open ? 'open' : 'collapsed'}`}>
      <div className="tracker-section-head">
        <button className="tracker-section-toggle" type="button" onClick={onToggle} aria-expanded={open}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>{title}</span>
        </button>
        <div className="tracker-section-actions">
          {actions}
          <button type="button" title="关闭" onClick={onClose}><X size={15} /></button>
        </div>
      </div>
      {open && <div className="tracker-section-body">{children}</div>}
    </section>
  );
}

function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="tracker-empty">
      <div className="tracker-empty-icon">{icon}</div>
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function RightPanel() {
  const blocks = useTaskStore((state) => state.blocks);
  const artifacts = useTaskStore((state) => state.artifacts);
  const taskError = useTaskStore((state) => state.taskError);
  const currentId = useTaskStore((state) => state.currentId);
  const selectTask = useTaskStore((state) => state.selectTask);

  const [panelWidth, setPanelWidth] = useState(368);
  const widthRef = useRef(panelWidth);
  const resizing = useRef(false);
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    todo: true,
    results: true,
    compute: false,
    notes: false,
  });
  const [visible, setVisible] = useState<Record<SectionId, boolean>>({
    todo: true,
    results: true,
    compute: true,
    notes: true,
  });

  const steps = blocks.filter((block) => block.kind === 'step');

  useEffect(() => { widthRef.current = panelWidth; }, [panelWidth]);
  useEffect(() => {
    const saved = Number(localStorage.getItem('right-panel-w'));
    if (Number.isFinite(saved) && saved >= 300 && saved <= 520) setPanelWidth(saved);
  }, []);

  const onResizeStart = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    resizing.current = true;
    const startX = event.clientX;
    const startWidth = widthRef.current;
    document.body.classList.add('right-panel-resizing');

    const onMove = (moveEvent: MouseEvent) => {
      if (!resizing.current) return;
      const width = Math.max(300, Math.min(520, startWidth + startX - moveEvent.clientX));
      widthRef.current = width;
      setPanelWidth(width);
    };
    const onUp = () => {
      resizing.current = false;
      localStorage.setItem('right-panel-w', String(widthRef.current));
      document.body.classList.remove('right-panel-resizing');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const toggle = (id: SectionId) => setOpen((state) => ({ ...state, [id]: !state[id] }));
  const close = (id: SectionId) => setVisible((state) => ({ ...state, [id]: false }));
  const hidden = (Object.keys(visible) as SectionId[]).filter((id) => !visible[id]);

  return (
    <aside className="tracker-panel" style={{ width: panelWidth }}>
      <div className="tracker-resizer" onMouseDown={onResizeStart} />

      <div className="tracker-sections">
        {visible.todo && (
          <PanelSection id="todo" title="待办" open={open.todo} onToggle={() => toggle('todo')} onClose={() => close('todo')}>
            {steps.length === 0 ? (
              <EmptyState icon={<Flashlight size={54} />} title="暂无待办列表" description="多步骤任务会显示待办项" />
            ) : (
              <div className="tracker-list">
                {steps.map((step, index) => (
                  <div className="tracker-step" key={step.id}>
                    <span className={`tracker-status status-${step.status ?? 'pending'}`} />
                    <span className="tracker-step-index">{index + 1}</span>
                    <span className="tracker-item-name">{step.name}</span>
                  </div>
                ))}
              </div>
            )}
          </PanelSection>
        )}

        {visible.results && (
          <PanelSection
            id="results"
            title="结果"
            open={open.results}
            onToggle={() => toggle('results')}
            onClose={() => close('results')}
            actions={
              <button type="button" title="从存储刷新结果" disabled={!currentId} onClick={() => currentId && void selectTask(currentId)}>
                <RefreshCw size={14} />
              </button>
            }
          >
            {artifacts.length === 0 ? (
              <EmptyState icon={<Network size={58} />} title="暂无结果" description="文件将显示在此处" />
            ) : (
              <div className="tracker-list artifact-list">
                {artifacts.map((artifact) => (
                  <div className="tracker-artifact" key={artifact.id} title={artifact.path}>
                    <span className="tracker-file-icon"><FileText size={16} /></span>
                    <span className="tracker-item-name">{artifact.name}</span>
                    <span className="tracker-file-size">{formatSize(artifact.size)}</span>
                  </div>
                ))}
              </div>
            )}
            {taskError && <div className="tracker-error">{taskError}</div>}
          </PanelSection>
        )}

        {visible.compute && (
          <PanelSection
            id="compute"
            title="计算"
            open={open.compute}
            onToggle={() => toggle('compute')}
            onClose={() => close('compute')}
            actions={<button type="button" title="计算资源说明"><CircleHelp size={14} /></button>}
          >
            <EmptyState icon={<Cpu size={48} />} title="暂无计算作业" description="Agent 运行时将显示资源状态" />
          </PanelSection>
        )}

        {visible.notes && (
          <PanelSection id="notes" title="笔记" open={open.notes} onToggle={() => toggle('notes')} onClose={() => close('notes')}>
            <EmptyState icon={<NotebookPen size={46} />} title="暂无笔记" description="任务笔记将显示在此处" />
          </PanelSection>
        )}
      </div>

      {hidden.length > 0 && (
        <div className="tracker-restore">
          <RotateCcw size={13} />
          <span>恢复</span>
          {hidden.map((id) => (
            <button type="button" key={id} onClick={() => setVisible((state) => ({ ...state, [id]: true }))}>
              {SECTION_LABELS[id]}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
