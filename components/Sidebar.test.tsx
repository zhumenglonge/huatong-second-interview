import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { Sidebar } from './Sidebar';

describe('项目侧栏控件', () => {
  it('renders project selector, settings, and collapse controls', () => {
    const markup = renderToStaticMarkup(<Sidebar />);
    expect(markup).toContain('aria-label="选择项目"');
    expect(markup).toContain('aria-label="项目设置"');
    expect(markup).toContain('title="折叠面板"');
    expect(markup).toContain('title="搜索"');
    expect(markup).toContain('title="查看全部"');
    expect(markup).toContain('title="新建任务"');
  });
});
