import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LayoutPopover } from './LayoutPopover';

describe('布局配置', () => {
  it('exposes the layout trigger and all module switches', () => {
    const markup = renderToStaticMarkup(
      <LayoutPopover
        open
        visibility={{ todo: false, results: false, compute: true, notes: false }}
        onOpenChange={() => undefined}
        onVisibilityChange={() => undefined}
      />,
    );
    expect(markup).toContain('aria-label="布局"');
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-label="待办"');
    expect(markup).toContain('aria-label="结果"');
    expect(markup).toContain('aria-label="计算"');
    expect(markup).toContain('aria-label="笔记"');
    expect(markup).toContain('checked');
  });
});
