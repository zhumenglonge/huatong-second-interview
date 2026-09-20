'use client';

import React, { useRef, useCallback } from 'react';
import { Cpu, FileText, ListTodo, NotebookPen, SlidersHorizontal } from 'lucide-react';
import { useLocale } from '@/lib/i18n';

export type LayoutSectionId = 'todo' | 'results' | 'compute' | 'notes';
export type LayoutVisibility = Record<LayoutSectionId, boolean>;

const CLOSE_DELAY = 200;

export function LayoutPopover({
  open,
  visibility,
  onOpenChange,
  onVisibilityChange,
}: {
  open: boolean;
  visibility: LayoutVisibility;
  onOpenChange: (open: boolean) => void;
  onVisibilityChange: (id: LayoutSectionId, value: boolean) => void;
}) {
  const { t } = useLocale();
  const ITEMS: Array<{ id: LayoutSectionId; label: string; Icon: typeof ListTodo }> = [
    { id: 'todo', label: t.todo, Icon: ListTodo }, { id: 'results', label: t.results, Icon: FileText },
    { id: 'compute', label: t.compute, Icon: Cpu }, { id: 'notes', label: t.notes, Icon: NotebookPen },
  ];
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    onOpenChange(true);
  }, [onOpenChange]);

  const handleLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => onOpenChange(false), CLOSE_DELAY);
  }, [onOpenChange]);

  return (
    <div
      className="layout-control"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        className="layout-trigger"
        type="button"
        aria-label={t.layout}
        title={t.layout}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <SlidersHorizontal size={16} />
      </button>
      {open && (
        <div className="layout-popover" role="dialog" aria-label={t.layoutConfig}>
          <h3>{t.layoutConfig}</h3>
          <div className="layout-options">
            {ITEMS.map(({ id, label, Icon }) => (
              <label className="layout-option" key={id}>
                <span className="layout-option-label"><Icon size={18} /><span>{label}</span></span>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label={label}
                  checked={visibility[id]}
                  onChange={(event) => onVisibilityChange(id, event.target.checked)}
                />
                <span className="layout-switch" aria-hidden="true"><span /></span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
