'use client';

import { useEffect, useRef } from 'react';
import { useTaskStore } from '@/lib/store';
import { useLocale } from '@/lib/i18n';
import { BlockView } from './BlockView';

export function Conversation() {
  const blocks = useTaskStore((s) => s.blocks);
  const currentId = useTaskStore((s) => s.currentId);
  const { t } = useLocale();
  const boxRef = useRef<HTMLDivElement>(null);

  // stick to bottom while streaming (unless the user scrolled up)
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [blocks]);

  return (
    <div className="col-body" ref={boxRef}>
      <div className="conv">
        {!currentId && (
          <div className="empty">
            {t.convEmpty}
          </div>
        )}
        {blocks.map((b) => (
          <BlockView key={b.id} block={b} />
        ))}
      </div>
    </div>
  );
}
