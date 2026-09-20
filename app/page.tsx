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
import { useLocale, useTheme } from '@/lib/i18n';

export default function Page() {
  const refreshTasks = useTaskStore((s) => s.refreshTasks);
  const newTask = useTaskStore((s) => s.newTask);
  const [view, setView] = useState<MainView>('conv');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [layoutVisibility, setLayoutVisibility] = useState<LayoutVisibility>({
    todo: true,
    results: true,
    compute: true,
    notes: true,
  });
  const { locale, setLocale, t } = useLocale();
  const { theme, toggle: toggleTheme } = useTheme();
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
          <span>{t.title}</span>
          <span className="tabs">
            <button className={view === 'conv' ? 'primary' : ''} onClick={() => setView('conv')}>
              {t.conv}
            </button>
            <button className={view === 'canvas' ? 'primary' : ''} onClick={() => setView('canvas')}>
              {t.canvas}
            </button>
          </span>
          <span className="header-actions">
            <LayoutPopover
              open={layoutOpen}
              visibility={layoutVisibility}
              onOpenChange={setLayoutOpen}
              onVisibilityChange={(id: LayoutSectionId, value: boolean) => setLayoutVisibility((state) => ({ ...state, [id]: value }))}
            />
            <button className="header-tool" type="button" onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')} aria-label={locale === 'zh' ? t.switchToEn : t.switchToZh} title={locale === 'zh' ? t.switchToEn : t.switchToZh}>{locale === 'zh' ? 'EN' : '中'}</button>
            <button className="header-tool" type="button" onClick={toggleTheme} aria-label={theme === 'light' ? t.themeDark : t.themeLight} title={theme === 'light' ? t.themeDark : t.themeLight}>{theme === 'light' ? '☾' : '☀'}</button>
          </span>
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
