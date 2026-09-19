'use client';

import { useEffect, useRef } from 'react';
import { useTaskStore } from '@/lib/store';
import { BlockView } from './BlockView';

export function Conversation() {
  const blocks = useTaskStore((s) => s.blocks);
  const currentId = useTaskStore((s) => s.currentId);
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
            选择左侧任务，或在下方输入一个研究任务开始。
            <br />
            后端为真实 Qoder Agent（非 mock），会在沙箱中规划、执行并产出文件。
          </div>
        )}
        {blocks.map((b) => (
          <BlockView key={b.id} block={b} />
        ))}
      </div>
    </div>
  );
}
