'use client';

import { useState } from 'react';
import { useTaskStore } from '@/lib/store';
import { StatusBadge } from './StatusBadge';

export function InputBar() {
  const [text, setText] = useState('');
  const status = useTaskStore((s) => s.status);
  const connected = useTaskStore((s) => s.connected);
  const currentId = useTaskStore((s) => s.currentId);
  const send = useTaskStore((s) => s.send);
  const cancel = useTaskStore((s) => s.cancel);
  const retry = useTaskStore((s) => s.retry);

  const running = status === 'running' || status === 'queued';
  const failed = status === 'failed';

  const submit = async () => {
    const v = text.trim();
    if (!v || running) return;
    setText('');
    await send(v);
  };

  return (
    <div className="inputbar">
      <textarea
        value={text}
        placeholder="问我任何研究问题…（真实 Qoder Agent 执行）"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
        disabled={running}
      />
      <div className="row">
        <StatusBadge status={status} />
        <span className="muted">{connected ? 'SSE 已连接' : 'SSE 断开'}</span>
        <span className="spacer" />
        {failed && currentId && <button onClick={() => void retry()}>重试</button>}
        {running && <button onClick={() => void cancel()}>取消</button>}
        <button className="primary" onClick={() => void submit()} disabled={running || !text.trim()}>
          发送
        </button>
      </div>
    </div>
  );
}
