# 左侧栏改造实现规格书（Sidebar Implementation Spec）

> **执行者**：AI 编码助手（Codex / Cursor / Copilot）
> **前置阅读**：`PROJECT_CONTEXT.md`（项目全局上下文）
> **范围**：仅左侧（图标栏 + 侧栏），不动聊天区 / 右栏 / 画布 / 数据层
> **最后更新**：2026-09-19

---

## 0. 已确认决策

| # | 决策点 | 结论 |
|---|---|---|
| 1 | 改造范围 | **只改左侧**（图标栏 + 侧栏），聊天区/右栏/画布不动 |
| 2 | 图标库 | **引入 `lucide-react`**（`npm install lucide-react`） |
| 3 | CSS 方案 | **纯 CSS**，新样式追加到 `app/globals.css`，不引入 Tailwind |
| 4 | 云盘区 | **做空态 stub**（显示 "No files yet"，不接真实文件上传） |
| 5 | 图标栏 | **完整 4 图标**：项目(FolderOpen) / 中心(Blocks) / 帮助(CircleHelp) / 账号(User) |
| 6 | 项目切换器 | **可点击弹 dialog**（简单模态框，显示项目列表/新建项目） |

---

## 1. 目标视觉（对齐 Biomni 实测）

```
┌─ 60px 图标栏 ─┐┌──────────── 320px 侧栏 ─────────────────────┐
│               ││                                                │
│  [Logo/品牌]  ││  ┌─ 项目切换器 ─────────────────┐ [折叠按钮] │
│               ││  │ PROJECT (小字 uppercase)      │            │
│  📁 项目 ←激活││  │ Quick Tasks (大字号)     ▾   │            │
│  🧱 中心      ││  └───────────────────────────────┘            │
│               ││                                                │
│               ││  ┌─ 任务 section ─────────────────────────────┐│
│               ││  │ [▾] 任务              [搜索] [查看全部]    ││
│               ││  │ ═══ 2px primary 粗底线 ═══                 ││
│               ││  │                                            ││
│               ││  │ ▾ 等待输入  2                              ││
│               ││  │ ┃ ● Analyze gene expression…  17h ago ←激活││
│               ││  │ ┃ ● Explore a GEO dataset     17h ago      ││
│               ││  │                                            ││
│               ││  │ ▾ 最近                                     ││
│               ││  │   ○ What can Biomni help…     14h ago      ││
│               ││  └────────────────────────────────────────────┘│
│               ││                                                │
│               ││  ┌─ 云盘 section ─────────────────────────────┐│
│  ❓ 帮助      ││  │ [▾] 云盘              [上传]               ││
│               ││  │ ═══ 2px primary 粗底线 ═══                 ││
│  👤 账号      ││  │                                            ││
│               ││  │         No files yet                       ││
│               ││  └────────────────────────────────────────────┘│
└───────────────┘└────────────────────────────────────────────────┘
```

---

## 2. 文件改动清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `package.json` | 修改 | 添加 `lucide-react` 依赖 |
| `app/globals.css` | 修改 | 追加图标栏 + 侧栏新样式（**不删除/不修改现有 `.canvas-*` `.rf-*` 段**） |
| `app/page.tsx` | 修改 | shell 结构改为：IconRail + Sidebar + main + RightPanel |
| `app/layout.tsx` | 不动 | — |
| `components/IconRail.tsx` | **新建** | 60px 图标栏组件 |
| `components/Sidebar.tsx` | **新建** | 320px 侧栏组件（项目切换器 + 任务区 + 云盘区 + 折叠 + 拖拽） |
| `components/TaskList.tsx` | **删除或废弃** | 被 `Sidebar.tsx` 替代 |
| `components/Conversation.tsx` | 不动 | — |
| `components/InputBar.tsx` | 不动 | — |
| `components/RightPanel.tsx` | 不动 | — |
| `components/BlockView.tsx` | 不动 | — |
| `components/CanvasView.tsx` | **绝对不动** | 画布 = 创新点 |
| `components/StepNode.tsx` | **绝对不动** | 画布节点 |
| `components/StatusBadge.tsx` | 不动（右栏/输入区仍在用） | — |
| `lib/*` | 不动 | — |
| `app/api/*` | 不动 | — |

---

## 3. 逐步实现

### Step 1：安装依赖

```bash
npm install lucide-react
```

### Step 2：修改 `app/globals.css`

在文件**末尾**追加以下样式（不修改/不删除任何现有样式）：

```css
/* ============================================================
   SIDEBAR ALIGNMENT — Biomni-style left panel
   Added: 2026-09-19. Do NOT remove .canvas-* / .rf-* above.
   ============================================================ */

/* ---- CSS 变量补充 ---- */
:root {
  --sidebar-w: 320px;
  --rail-w: 60px;
  --section-header-bg: color-mix(in srgb, var(--muted) 8%, transparent);
  --task-active-bg: color-mix(in srgb, var(--accent) 30%, transparent);
  --task-hover-bg: color-mix(in srgb, var(--accent) 15%, transparent);
}

/* ---- 图标栏 ---- */
.icon-rail {
  width: var(--rail-w);
  height: 100vh;
  background: var(--panel);
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  flex-shrink: 0;
  z-index: 10;
}
.icon-rail .rail-logo {
  margin-bottom: 24px;
  margin-top: 8px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
  color: var(--accent-ink);
  background: var(--accent);
  border-radius: 10px;
}
.icon-rail .rail-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding-top: 8px;
}
.icon-rail .rail-bottom {
  margin-top: auto;
  padding-bottom: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.rail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 0;
  width: 100%;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--muted);
  font-size: 11px;
  transition: color 0.2s, background-color 0.2s;
  border-radius: 0;
}
.rail-item:hover {
  color: var(--ink);
  background: color-mix(in srgb, var(--muted) 8%, transparent);
}
.rail-item.active {
  color: var(--ink);
  font-weight: 600;
}
.rail-item svg {
  width: 18px;
  height: 18px;
}
.rail-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}

/* ---- 侧栏容器 ---- */
.sidebar {
  width: var(--sidebar-w);
  height: 100vh;
  overflow: hidden;
  position: relative;
  transition: width 0.3s ease-in-out;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border-right: 1px solid var(--line);
}
.sidebar.collapsed {
  width: 0;
  border-right: none;
}
.sidebar-inner {
  width: var(--sidebar-w);
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 侧栏右边缘拖拽条 */
.sidebar-resizer {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  z-index: 10;
  transition: background-color 0.2s;
}
.sidebar-resizer:hover {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
}
.sidebar-resizer:active {
  background: color-mix(in srgb, var(--accent) 30%, transparent);
}

/* ---- 项目切换器 ---- */
.project-switcher {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 12px 12px 16px;
  gap: 8px;
  flex-shrink: 0;
}
.project-switcher-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  flex: 1;
  min-width: 0;
  padding: 8px;
  margin-left: -8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: none;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
  text-align: left;
}
.project-switcher-btn:hover {
  background: var(--task-hover-bg);
  border-color: var(--line);
}
.project-switcher-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  font-weight: 500;
}
.project-switcher-name {
  font-size: 20px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sidebar-collapse-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 6px;
  color: var(--muted);
  flex-shrink: 0;
  transition: background-color 0.2s, color 0.2s;
}
.sidebar-collapse-btn:hover {
  background: var(--task-hover-bg);
  color: var(--ink);
}

/* ---- Section 通用 ---- */
.sidebar-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}
.sidebar-section + .sidebar-section {
  border-top: 1px solid var(--line);
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  min-height: 40px;
  background: var(--section-header-bg);
  border-bottom: 2px solid var(--accent);  /* ★ Biomni 签名：2px primary 粗底线 */
  flex-shrink: 0;
  user-select: none;
}
.section-header-left {
  display: flex;
  align-items: center;
  gap: 4px;
}
.section-header-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--ink);
}
.section-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.section-icon-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 4px;
  color: var(--muted);
  transition: background-color 0.2s, color 0.2s;
  padding: 0;
}
.section-icon-btn:hover {
  background: var(--task-hover-bg);
  color: var(--ink);
}
.section-icon-btn svg {
  width: 14px;
  height: 14px;
}
.section-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 4px 0;
}

/* ---- 任务分组 ---- */
.task-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
  user-select: none;
}
.task-group-header:hover {
  color: var(--ink);
}
.task-group-header .group-title {
  font-weight: 600;
  flex: 1;
}
.task-group-header .group-count {
  font-size: 12px;
  color: var(--muted);
  opacity: 0.7;
}
.task-group-header svg {
  width: 14px;
  height: 14px;
  transition: transform 0.2s;
}
.task-group-header.collapsed svg {
  transform: rotate(-90deg);
}

/* ---- 任务项 ---- */
.task-item-v2 {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  margin-left: 8px;
  border-radius: 6px;
  border-left: 2px solid transparent;  /* ★ Biomni 签名：左 accent 条 */
  cursor: pointer;
  transition: background-color 0.5s, border-color 0.5s;  /* duration-500 慢速 */
}
.task-item-v2:hover {
  background: var(--task-hover-bg);
}
.task-item-v2.active {
  border-left-color: var(--accent);
  background: var(--task-active-bg);
}
.task-item-v2.active:hover {
  background: color-mix(in srgb, var(--accent) 40%, transparent);
}
.task-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid var(--muted);
  flex-shrink: 0;
  opacity: 0.7;
}
.task-dot.status-running {
  border-color: var(--run);
  background: var(--run);
  animation: pulse 1.1s infinite;
}
.task-dot.status-success {
  border-color: var(--ok);
  background: var(--ok);
}
.task-dot.status-failed {
  border-color: var(--fail);
  background: var(--fail);
}
.task-dot.status-waiting {
  border-color: var(--wait);
  background: var(--wait);
}
.task-dot.status-cancelled {
  border-color: var(--cancel);
  background: var(--cancel);
}
.task-item-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--ink);
}
.task-item-time {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  flex-shrink: 0;
}

/* ---- 云盘空态 ---- */
.cloud-empty {
  padding: 16px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--muted);
}

/* ---- 项目切换 Dialog ---- */
.project-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.project-dialog {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 20px;
  min-width: 320px;
  max-width: 420px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}
.project-dialog h3 {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
}
.project-dialog-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  font-size: 14px;
  color: var(--ink);
  transition: background-color 0.15s;
}
.project-dialog-item:hover {
  background: var(--task-hover-bg);
}
.project-dialog-item.current {
  background: var(--task-active-bg);
  font-weight: 500;
}

/* ---- 主区让位（侧栏折叠时） ---- */
.main-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  transition: padding-left 0.3s ease-in-out;
}

/* ---- 新 shell 布局 ---- */
.app-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
}
```

> **注意**：以上样式使用 `color-mix(in srgb, ...)` 实现半透明色（现代浏览器均支持）。如需兼容旧浏览器，可替换为 `rgba()` 硬编码值。

### Step 3：新建 `components/IconRail.tsx`

```tsx
'use client';

import { FolderOpen, Blocks, CircleHelp, User } from 'lucide-react';

interface IconRailProps {
  activeItem?: string;
}

const NAV_ITEMS = [
  { id: 'project', label: '项目', icon: FolderOpen },
  { id: 'hub', label: '中心', icon: Blocks },
] as const;

const BOTTOM_ITEMS = [
  { id: 'help', label: '帮助', icon: CircleHelp },
] as const;

export function IconRail({ activeItem = 'project' }: IconRailProps) {
  return (
    <div className="icon-rail">
      {/* Logo */}
      <div className="rail-logo">B</div>

      {/* 主导航 */}
      <nav className="rail-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`rail-item ${activeItem === item.id ? 'active' : ''}`}
            title={item.label}
          >
            <item.icon />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* 底部：帮助 + 账号 */}
      <div className="rail-bottom">
        {BOTTOM_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`rail-item ${activeItem === item.id ? 'active' : ''}`}
            title={item.label}
          >
            <item.icon />
            <span>{item.label}</span>
          </button>
        ))}
        <button className="rail-avatar" title="账号">
          <User size={16} />
        </button>
      </div>
    </div>
  );
}
```

### Step 4：新建 `components/Sidebar.tsx`

```tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  PanelLeft,
  Search,
  List,
  Upload,
  FolderOpen,
} from 'lucide-react';
import { useTaskStore } from '@/lib/store';
import type { TaskRow } from '@/lib/types';

// ---- 工具函数 ----

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---- 项目切换 Dialog ----

const PROJECTS = [
  { id: 'quick', name: 'Quick Tasks' },
  { id: 'proj_1', name: 'RNA-seq 分析' },
  { id: 'proj_2', name: '蛋白理性设计' },
];

function ProjectDialog({
  current,
  onSelect,
  onClose,
}: {
  current: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="project-dialog-overlay" onClick={onClose}>
      <div className="project-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>选择项目</h3>
        {PROJECTS.map((p) => (
          <button
            key={p.id}
            className={`project-dialog-item ${p.id === current ? 'current' : ''}`}
            onClick={() => { onSelect(p.id); onClose(); }}
          >
            <FolderOpen size={16} />
            <span>{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- 任务项 ----

function TaskItem({
  task,
  active,
  onClick,
}: {
  task: TaskRow;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`task-item-v2 ${active ? 'active' : ''}`}
      onClick={onClick}
      data-session-id={task.id}
      data-active={active}
    >
      <span className={`task-dot status-${task.status}`} />
      <span className="task-item-title">{task.title}</span>
      <span className="task-item-time">{timeAgo(task.updatedAt)}</span>
    </div>
  );
}

// ---- 任务分组 ----

function TaskGroup({
  title,
  count,
  tasks,
  currentId,
  onSelect,
  defaultOpen = true,
}: {
  title: string;
  count?: number;
  tasks: TaskRow[];
  currentId: string | null;
  onSelect: (id: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <div
        className={`task-group-header ${open ? '' : 'collapsed'}`}
        onClick={() => setOpen(!open)}
      >
        <ChevronDown />
        <span className="group-title">{title}</span>
        {count !== undefined && <span className="group-count">{count}</span>}
      </div>
      {open && tasks.map((t) => (
        <TaskItem
          key={t.id}
          task={t}
          active={t.id === currentId}
          onClick={() => onSelect(t.id)}
        />
      ))}
    </div>
  );
}

// ---- 主组件 ----

export function Sidebar() {
  const tasks = useTaskStore((s) => s.tasks);
  const currentId = useTaskStore((s) => s.currentId);
  const selectTask = useTaskStore((s) => s.selectTask);
  const newTask = useTaskStore((s) => s.newTask);

  const [collapsed, setCollapsed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [project, setProject] = useState('quick');
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const resizing = useRef(false);

  // 拖拽调宽
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const w = Math.max(240, Math.min(480, startW + ev.clientX - startX));
      setSidebarWidth(w);
    };
    const onUp = () => {
      resizing.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      localStorage.setItem('sidebar-w', String(sidebarWidth));
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  // 恢复宽度
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-w');
    if (saved) setSidebarWidth(Number(saved));
  }, []);

  // 任务分组：waiting 为一组，其余为"最近"
  const waitingTasks = tasks.filter((t) => t.status === 'waiting');
  const otherTasks = tasks.filter((t) => t.status !== 'waiting');

  const projectName = PROJECTS.find((p) => p.id === project)?.name ?? 'Quick Tasks';

  return (
    <>
      <aside
        className={`sidebar ${collapsed ? 'collapsed' : ''}`}
        style={{ width: collapsed ? 0 : sidebarWidth }}
      >
        <div className="sidebar-inner" style={{ width: sidebarWidth }}>
          {/* 项目切换器 + 折叠按钮 */}
          <div className="project-switcher">
            <button
              className="project-switcher-btn"
              onClick={() => setDialogOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={dialogOpen}
              aria-label="选择项目"
            >
              <span className="project-switcher-label">Project</span>
              <span className="project-switcher-name">{projectName}</span>
            </button>
            <button
              className="sidebar-collapse-btn"
              onClick={() => setCollapsed(true)}
              title="折叠面板"
            >
              <PanelLeft size={16} />
            </button>
          </div>

          {/* 任务 section */}
          <div className="sidebar-section">
            <div className="section-header">
              <div className="section-header-left">
                <button className="section-icon-btn" title="新建任务" onClick={newTask}>
                  <ChevronDown size={14} />
                </button>
                <span className="section-header-title">任务</span>
              </div>
              <div className="section-header-actions">
                <button className="section-icon-btn" title="搜索">
                  <Search size={14} />
                </button>
                <button className="section-icon-btn" title="查看全部">
                  <List size={14} />
                </button>
              </div>
            </div>
            <div className="section-body">
              {tasks.length === 0 && <div className="cloud-empty">暂无任务</div>}
              {waitingTasks.length > 0 && (
                <TaskGroup
                  title="等待输入"
                  count={waitingTasks.length}
                  tasks={waitingTasks}
                  currentId={currentId}
                  onSelect={(id) => void selectTask(id)}
                />
              )}
              {otherTasks.length > 0 && (
                <TaskGroup
                  title="最近"
                  tasks={otherTasks}
                  currentId={currentId}
                  onSelect={(id) => void selectTask(id)}
                />
              )}
            </div>
          </div>

          {/* 云盘 section */}
          <div className="sidebar-section">
            <div className="section-header">
              <div className="section-header-left">
                <button className="section-icon-btn" title="折叠">
                  <ChevronDown size={14} />
                </button>
                <span className="section-header-title">云盘</span>
              </div>
              <div className="section-header-actions">
                <button className="section-icon-btn" title="上传">
                  <Upload size={14} />
                </button>
              </div>
            </div>
            <div className="section-body">
              <div className="cloud-empty">No files yet</div>
            </div>
          </div>
        </div>

        {/* 拖拽调宽条 */}
        {!collapsed && (
          <div className="sidebar-resizer" onMouseDown={onMouseDown} />
        )}
      </aside>

      {/* 折叠后的展开按钮（浮动在图标栏右侧） */}
      {collapsed && (
        <button
          className="sidebar-collapse-btn"
          style={{ position: 'absolute', left: 'var(--rail-w)', top: 12, zIndex: 20 }}
          onClick={() => setCollapsed(false)}
          title="展开面板"
        >
          <PanelLeft size={16} />
        </button>
      )}

      {/* 项目切换 Dialog */}
      {dialogOpen && (
        <ProjectDialog
          current={project}
          onSelect={setProject}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  );
}
```

### Step 5：修改 `app/page.tsx`

将现有 shell 结构替换为新的四区布局。**注意保留画布分支不动**。

```tsx
'use client';

import { useEffect, useState } from 'react';
import { CanvasView } from '@/components/CanvasView';
import { Conversation } from '@/components/Conversation';
import { IconRail } from '@/components/IconRail';
import { InputBar } from '@/components/InputBar';
import { RightPanel } from '@/components/RightPanel';
import { Sidebar } from '@/components/Sidebar';
import { useTaskStore } from '@/lib/store';

export default function Page() {
  const refreshTasks = useTaskStore((s) => s.refreshTasks);
  const [view, setView] = useState<'conv' | 'canvas'>('conv');

  useEffect(() => {
    void refreshTasks();
  }, [refreshTasks]);

  return (
    <div className="app-shell">
      <IconRail />
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
```

> **关键**：`<CanvasView />` 和 `<Conversation />` 的渲染位置、`<InputBar />`、`<RightPanel />` 完全不变。只是外层 shell 从 `.app`（grid 三列）变成 `.app-shell`（flex 四区）。

### Step 6：处理旧 `TaskList.tsx`

两种选择（推荐 A）：
- **A**：删除 `components/TaskList.tsx`（功能已被 `Sidebar.tsx` 完全替代）
- **B**：保留文件但不再 import（避免 git 历史断裂）

如果选 A，同时删除 `globals.css` 中 `.task-item` `.task-title` `.task-time` 的旧样式（可选，不删也不影响）。

### Step 7：验证

```bash
npm run dev
```

检查清单：
- [ ] 页面显示 4 区：60px 图标栏 + 320px 侧栏 + 聊天区 + 300px 右栏
- [ ] 图标栏 4 个图标（项目/中心/帮助/账号），"项目" 高亮
- [ ] 项目切换器显示 "PROJECT" 小字 + "Quick Tasks" 大字，点击弹 dialog
- [ ] Dialog 列出 3 个项目，可切换，点外部关闭
- [ ] 任务 section header 有 2px 粗底线（accent 色）+ 半透明背景
- [ ] 任务按 "等待输入" / "最近" 分组，各组可折叠
- [ ] 任务项有左 2px accent 条（激活态）、状态圆点、time-ago
- [ ] 云盘 section 显示 "No files yet" 空态
- [ ] 侧栏折叠按钮可用（折叠/展开有 300ms 过渡）
- [ ] 侧栏右边缘可拖拽调宽（240~480px），刷新后保持
- [ ] **切到"任务画布" tab，画布功能完全正常**（重点回归）
- [ ] 新建任务 / 选择任务 / SSE 流式 / 重试 / 取消 均正常
- [ ] `npm run build` 无报错
- [ ] `npm run typecheck` 无报错

---

## 4. 不动的部分（再次强调）

| 文件 | 原因 |
|---|---|
| `components/CanvasView.tsx` | 任务画布 = 差异化创新 |
| `components/StepNode.tsx` | 画布节点 |
| `globals.css` 中 `.canvas-toolbar` `.canvas-goal` `.canvas-empty` `.rf-node` `.rf-row` `.rf-label` `.rf-sub` `.rf-selected` `.rf-running` `.rf-success` `.rf-failed` `.rf-cancelled` `.rf-pending` `.rf-io` | 画布样式 |
| `lib/*` 全部 | 数据层 |
| `app/api/*` 全部 | 后端 API |
| `components/Conversation.tsx` | 聊天区（本期不改） |
| `components/InputBar.tsx` | 输入区（本期不改） |
| `components/RightPanel.tsx` | 右栏（本期不改） |
| `components/BlockView.tsx` | 消息块（本期不改） |
| `components/StatusBadge.tsx` | 徽章（右栏/输入区仍在用） |

---

## 5. Biomni 实测参考数据（供对照）

以下为从 Biomni 真实 DOM 中提取的关键 class / 结构，实现时应**视觉对齐**但**不必逐字复制 class 名**（因为本地是纯 CSS，不是 Tailwind）：

| Biomni 元素 | Biomni class（Tailwind） | 本地对应 class |
|---|---|---|
| 图标栏 | `w-[60px] h-screen bg-sidebar border-r flex flex-col items-center py-3` | `.icon-rail` |
| 侧栏 | `overflow-hidden relative transition-all duration-300 ease-in-out` | `.sidebar` |
| 侧栏拖拽条 | `absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30` | `.sidebar-resizer` |
| 项目切换器 | `flex min-w-0 flex-1 h-auto px-2 py-2 -ml-2 border border-transparent rounded-md hover:bg-accent/50` | `.project-switcher-btn` |
| Section header | `flex items-center justify-between px-3 bg-muted/50 min-h-[40px] border-b-2 border-b-primary` | `.section-header` |
| 任务项（激活） | `group px-3 py-1.5 cursor-pointer flex items-center gap-2 rounded-md ml-2 border-l-2 bg-primary/30 border-primary hover:bg-primary/40 transition-colors duration-500` | `.task-item-v2.active` |
| 任务项（普通） | `… border-l-2 border-transparent … hover:bg-accent/50 transition-colors duration-500` | `.task-item-v2` |
| 状态圆点 | `lucide lucide-circle h-2.5 w-2.5 text-muted-foreground/70` | `.task-dot` |
| 分组 header | `group/header w-full px-3 py-1.5 flex items-center gap-1.5 text-sm text-muted-foreground` | `.task-group-header` |
| 云盘空态 | `px-3 py-4 text-center text-sm text-muted-foreground` → "No files yet" | `.cloud-empty` |
| 折叠按钮 | `rounded-md h-8 w-8 p-0` + lucide `panel-left` | `.sidebar-collapse-btn` |

---

## 6. 注意事项

1. **`color-mix()` 兼容性**：Chrome 111+ / Safari 16.2+ / Firefox 113+ 支持。如需兼容更旧浏览器，将 `color-mix(in srgb, var(--accent) 30%, transparent)` 替换为具体 rgba 值（如 `rgba(216, 236, 79, 0.3)`）。
2. **lucide-react 引入方式**：使用具名 import（`import { FolderOpen } from 'lucide-react'`），tree-shaking 自动生效。
3. **侧栏折叠时的展开按钮**：使用 `position: absolute` 浮动在图标栏右侧。如果 `app-shell` 没有 `position: relative`，需加上。
4. **画布回归测试**：改完 shell 后**必须**切到画布 tab 验证 React Flow 正常渲染（高度撑满、节点可拖拽、minimap 显示）。画布容器依赖父级 `flex: 1; min-height: 0; position: relative`——`main-area` 的 flex-col 布局已保证。
5. **旧 `.app` grid 样式**：`page.tsx` 不再使用 `.app` class，但 `globals.css` 中的 `.app` 定义可保留（不冲突），也可删除。
6. **TaskList 的 `newTask` 功能**：已迁移到 Sidebar 的 section header 按钮（ChevronDown 图标旁）。确保新建任务功能不丢失。

---

*本规格书基于 Biomni `sess_af4b00031712` 的 DOM 实测数据编写。实现时以视觉对齐为目标，不必像素级复制。*
