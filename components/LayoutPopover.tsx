'use client';

import React, { useEffect, useRef } from 'react';
import { Cpu, FileText, ListTodo, NotebookPen, SlidersHorizontal } from 'lucide-react';

export type LayoutSectionId = 'todo' | 'results' | 'compute' | 'notes';
export type LayoutVisibility = Record<LayoutSectionId, boolean>;

const ITEMS: Array<{ id: LayoutSectionId; label: string; Icon: typeof ListTodo }> = [
  { id: 'todo', label: '待办', Icon: ListTodo },
  { id: 'results', label: '结果', Icon: FileText },
  { id: 'compute', label: '计算', Icon: Cpu },
  { id: 'notes', label: '笔记', Icon: NotebookPen },
];

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
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) onOpenChange(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, onOpenChange]);

  return (
    <div className="layout-control" ref={rootRef}>
      <button
        className="layout-trigger"
        type="button"
        aria-label="布局"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <SlidersHorizontal size={16} />
        <span>布局</span>
      </button>
      {open && (
        <div className="layout-popover" role="dialog" aria-label="布局配置">
          <h3>布局配置</h3>
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
