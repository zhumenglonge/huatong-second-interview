'use client';

import { useEffect, useState } from 'react';
import { CanvasView } from '@/components/CanvasView';
import { Conversation } from '@/components/Conversation';
import { IconRail } from '@/components/IconRail';
import { InputBar } from '@/components/InputBar';
import { RightPanel } from '@/components/RightPanel';
import { Sidebar } from '@/components/Sidebar';
import { startBlankChat, type MainView } from '@/lib/blank-chat';
import { useTaskStore } from '@/lib/store';

export default function Page() {
  const refreshTasks = useTaskStore((s) => s.refreshTasks);
  const newTask = useTaskStore((s) => s.newTask);
  const [view, setView] = useState<MainView>('conv');

  const handleNewChat = () => startBlankChat(newTask, setView);

  useEffect(() => {
    void refreshTasks();
  }, [refreshTasks]);

  return (
    <div className="app-shell">
      <IconRail onNewChat={handleNewChat} />
      <Sidebar />
      <main className="main-area">
        <div className="col-head">
          <span>Biomni Lab · 改进版原型</span>
          <span className="tabs">
            <button className={view === 'conv' ? 'primary' : ''} onClick={() => setView('conv')}>
              会话流
            </button>
            <button className={view === 'canvas' ? 'primary' : ''} onClick={() => setView('canvas')}>
              任务画布
            </button>
          </span>
          <span className="muted">real QoderCN Agent backend</span>
        </div>
        {view === 'conv' ? <Conversation /> : <CanvasView />}
        <InputBar />
      </main>
      <RightPanel />
    </div>
  );
}
