import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { IconRail } from '../components/IconRail';
import { startBlankChat, type MainView } from './blank-chat';
import { useTaskStore } from './store';
import type { TaskRow } from './types';

describe('blank chat entry', () => {
  it('renders the rail logo as an accessible native button', () => {
    const markup = renderToStaticMarkup(<IconRail onNewChat={() => undefined} />);

    expect(markup).toContain('<button class="rail-logo"');
    expect(markup).toContain('aria-label="新建空白问答会话"');
    expect(markup).toContain('title="新建空白问答会话"');
    expect(markup).toContain('type="button"');
  });

  it('resets the selected task before returning to the conversation view', () => {
    const resetTaskSelection = vi.fn();
    let view: MainView = 'canvas';

    startBlankChat(resetTaskSelection, (nextView) => {
      view = nextView;
    });

    expect(resetTaskSelection).toHaveBeenCalledOnce();
    expect(view).toBe('conv');
  });

  it('clears task-specific state while preserving task history', () => {
    const task: TaskRow = {
      id: 'task-1',
      projectId: 'quick-tasks',
      title: 'Running task',
      input: 'question',
      status: 'running',
      error: null,
      notes: '',
      createdAt: 1,
      updatedAt: 1,
      lastSeq: 3,
    };
    useTaskStore.setState({
      tasks: [task],
      currentId: task.id,
      blocks: [{ id: 'block-1', kind: 'user', text: 'question' }],
      artifacts: [{ id: 'artifact-1', taskId: task.id, name: 'result', kind: 'file', size: 1, path: '/tmp/result', createdAt: 1 }],
      status: 'running',
      taskError: 'temporary',
      lastSeq: 3,
      connected: true,
    });

    useTaskStore.getState().newTask();

    const state = useTaskStore.getState();
    expect(state.tasks).toEqual([task]);
    expect(state.currentId).toBeNull();
    expect(state.blocks).toEqual([]);
    expect(state.artifacts).toEqual([]);
    expect(state.status).toBeNull();
    expect(state.taskError).toBeNull();
    expect(state.connected).toBe(false);
  });
});
