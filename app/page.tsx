'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CanvasView } from '@/components/CanvasView';
import { Conversation } from '@/components/Conversation';
import { IconRail } from '@/components/IconRail';
import { InputBar } from '@/components/InputBar';
import { LayoutPopover, type LayoutSectionId, type LayoutVisibility } from '@/components/LayoutPopover';
import { RightPanel } from '@/components/RightPanel';
import { Sidebar } from '@/components/Sidebar';
import { TaskOverview } from '@/components/TaskOverview';
import { startBlankChat, type MainView } from '@/lib/blank-chat';
import { useTaskStore } from '@/lib/store';

export default function Page() {
  const refreshTasks = useTaskStore((s) => s.refreshTasks);
  const newTask = useTaskStore((s) => s.newTask);
  const [view, setView] = useState<MainView>('conv');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [layoutVisibility, setLayoutVisibility] = useState<LayoutVisibility>({
    todo: false,
    results: false,
    compute: false,
    notes: false,
  });
  const router = useRouter();

  const handleNewChat = () => startBlankChat(newTask, setView);

  useEffect(() => {
    void refreshTasks();
  }, [refreshTasks]);

  return (
    <div className="app-shell">
      <IconRail onNewChat={handleNewChat} onProjectClick={() => setSidebarCollapsed(false)} onHubClick={() => router.push('/skills')} />
      <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} onShowOverview={() => setView('overview')} onShowConversation={() => setView('conv')} />
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
          <LayoutPopover
            open={layoutOpen}
            visibility={layoutVisibility}
            onOpenChange={setLayoutOpen}
            onVisibilityChange={(id: LayoutSectionId, value: boolean) => setLayoutVisibility((state) => ({ ...state, [id]: value }))}
          />
          <span className="muted">real QoderCN Agent backend</span>
        </div>
        {view === 'conv' ? <Conversation /> : view === 'canvas' ? <CanvasView /> : <TaskOverview onSelectTask={() => setView('conv')} />}
        {view !== 'overview' && <InputBar />}
      </main>
      <RightPanel
        visible={layoutVisibility}
        onVisibilityChange={(id, value) => setLayoutVisibility((state) => ({ ...state, [id]: value }))}
      />
    </div>
  );
}
