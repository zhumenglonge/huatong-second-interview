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
  X,
  Download,
  ExternalLink,
} from 'lucide-react';
import { useTaskStore } from '@/lib/store';
import { useLocale } from '@/lib/i18n';

import type { LayoutSectionId, LayoutVisibility } from './LayoutPopover';

type SectionId = LayoutSectionId;

function PanelSection({
  id,
  title,
  open,
  onToggle,
  onClose,
  closeLabel,
  actions,
  children,
}: {
  id: SectionId;
  title: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  closeLabel: string;
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
          <button type="button" title={closeLabel} onClick={onClose}><X size={15} /></button>
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

export function RightPanel({
  visible,
  onVisibilityChange,
}: {
  visible: LayoutVisibility;
  onVisibilityChange: (id: SectionId, value: boolean) => void;
}) {
  const blocks = useTaskStore((state) => state.blocks);
  const artifacts = useTaskStore((state) => state.artifacts);
  const taskError = useTaskStore((state) => state.taskError);
  const currentId = useTaskStore((state) => state.currentId);
  const selectTask = useTaskStore((state) => state.selectTask);
  const { t } = useLocale();

  const [panelWidth, setPanelWidth] = useState(368);
  const widthRef = useRef(panelWidth);
  const resizing = useRef(false);
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    todo: true, results: true, compute: true, notes: true,
  });

  const steps = blocks.filter((block) => block.kind === 'step');
  const hasVisibleSections = Object.values(visible).some(Boolean);

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
  const close = (id: SectionId) => onVisibilityChange(id, false);

  return (
    <aside
      className={`tracker-panel ${hasVisibleSections ? '' : 'tracker-panel-hidden'}`}
      style={{ width: hasVisibleSections ? panelWidth : 0, minWidth: hasVisibleSections ? 300 : 0 }}
      aria-hidden={!hasVisibleSections}
    >
      <div className="tracker-resizer" onMouseDown={onResizeStart} />

      <div className="tracker-sections">
        {visible.todo && (
          <PanelSection id="todo" title={t.todo} open={open.todo} onToggle={() => toggle('todo')} onClose={() => close('todo')} closeLabel={t.close}>
            {steps.length === 0 ? (
              <EmptyState icon={<Flashlight size={54} />} title={t.todoEmptyTitle} description={t.todoEmptyDesc} />
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
            title={t.results}
            open={open.results}
            onToggle={() => toggle('results')}
            onClose={() => close('results')}
            closeLabel={t.close}
            actions={
              <button type="button" title={t.refreshResults} disabled={!currentId} onClick={() => currentId && void selectTask(currentId)}>
                <RefreshCw size={14} />
              </button>
            }
          >
            {artifacts.length === 0 ? (
              <EmptyState icon={<Network size={58} />} title={t.resultsEmptyTitle} description={t.resultsEmptyDesc} />
            ) : (
              <div className="tracker-list artifact-list">
                {artifacts.map((artifact) => (
                  <div className="tracker-artifact" key={artifact.id} title={artifact.path}>
                    <span className="tracker-file-icon"><FileText size={16} /></span>
                    <span className="tracker-item-name">{artifact.name}</span>
                    <span className="tracker-file-size">{formatSize(artifact.size)}</span>
                    <a
                      className="tracker-file-action"
                      href={`/api/tasks/${artifact.taskId}/artifacts/${artifact.id}`}
                      target="_blank"
                      rel="noreferrer"
                      title={t.preview}
                    ><ExternalLink size={14} /></a>
                    <a
                      className="tracker-file-action"
                      href={`/api/tasks/${artifact.taskId}/artifacts/${artifact.id}?download=1`}
                      title={t.download}
                    ><Download size={14} /></a>
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
            title={t.compute}
            open={open.compute}
            onToggle={() => toggle('compute')}
            onClose={() => close('compute')}
            closeLabel={t.close}
            actions={<button type="button" title={t.computeHelp}><CircleHelp size={14} /></button>}
          >
            <EmptyState icon={<Cpu size={48} />} title={t.computeEmptyTitle} description={t.computeEmptyDesc} />
          </PanelSection>
        )}

        {visible.notes && (
          <PanelSection id="notes" title={t.notes} open={open.notes} onToggle={() => toggle('notes')} onClose={() => close('notes')} closeLabel={t.close}>
            <EmptyState icon={<NotebookPen size={46} />} title={t.notesEmptyTitle} description={t.notesEmptyDesc} />
          </PanelSection>
        )}
      </div>

    </aside>
  );
}
