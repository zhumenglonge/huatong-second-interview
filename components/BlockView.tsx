'use client';

import type { Block } from '@/lib/types';

function fmtSize(n: number): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'user':
      return <div className="bubble-user">{block.text}</div>;

    case 'agent_text':
      return <div className="agent-text">{block.text}</div>;

    case 'step':
      return (
        <div className="step-row">
          <span className={`dot ${block.status ?? 'pending'}`} />
          <span>{block.name}</span>
        </div>
      );

    case 'trace': {
      const out = block.meta?.output as string | undefined;
      return (
        <details className="trace">
          <summary>Show traces · {block.name}</summary>
          {block.text ? <pre>{block.text}</pre> : null}
          {out ? (
            <pre>
              {block.meta?.failed ? '✗ ' : '✓ '}
              {out}
            </pre>
          ) : null}
        </details>
      );
    }

    case 'artifact':
      return (
        <div className="artifact-row">
          <span>📄</span>
          <span>{block.name}</span>
          <span className="muted">{fmtSize(Number(block.meta?.size ?? 0))}</span>
        </div>
      );

    case 'error':
      return <div className="error-box">{block.text}</div>;

    default:
      return null;
  }
}
