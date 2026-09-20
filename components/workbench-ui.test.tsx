import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RightPanel } from './RightPanel';
import { TaskOverview } from './TaskOverview';
import { Conversation } from './Conversation';
import { InputBar } from './InputBar';

// SSR 渲染时 useEffect 不执行，useLocale 取默认中文，用于校验默认（中文）视图与结构。

describe('右侧面板默认状态', () => {
  it('四个模块默认可见且内容默认展开', () => {
    const markup = renderToStaticMarkup(
      <RightPanel visible={{ todo: true, results: true, compute: true, notes: true }} onVisibilityChange={() => undefined} />,
    );
    for (const id of ['todo', 'results', 'compute', 'notes']) expect(markup).toContain(`tracker-section-${id}`);
    expect(markup).toContain('待办');
    expect(markup).toContain('结果');
    expect(markup).toContain('计算');
    expect(markup).toContain('笔记');
    expect(markup).toContain('aria-expanded="true"');
  });

  it('无可见模块时整个面板收起', () => {
    const markup = renderToStaticMarkup(
      <RightPanel visible={{ todo: false, results: false, compute: false, notes: false }} onVisibilityChange={() => undefined} />,
    );
    expect(markup).toContain('tracker-panel-hidden');
    expect(markup).toContain('aria-hidden="true"');
  });
});

describe('任务总览', () => {
  it('渲染中文标题、搜索与状态筛选控件（空列表显示空状态）', () => {
    const markup = renderToStaticMarkup(<TaskOverview onSelectTask={() => undefined} />);
    expect(markup).toContain('任务总览');
    expect(markup).toContain('搜索任务');
    expect(markup).toContain('全部状态');
    expect(markup).toContain('没有找到匹配的任务');
  });
});

describe('会话空状态', () => {
  it('显示本地化提示且不再包含冗余后端标识', () => {
    const markup = renderToStaticMarkup(<Conversation />);
    expect(markup).toContain('选择左侧任务');
    expect(markup).not.toContain('mock');
    expect(markup).not.toContain('Qoder Agent');
    expect(markup).not.toContain('后端为真实');
  });
});

describe('输入区文案', () => {
  it('占位符与工具项使用本地化文案', () => {
    const markup = renderToStaticMarkup(<InputBar />);
    expect(markup).toContain('问我任何问题');
    expect(markup).toContain('自动');
    expect(markup).toContain('添加到消息');
  });
});
