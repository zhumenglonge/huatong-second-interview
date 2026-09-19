'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  FolderOpen,
  List,
  PanelLeft,
  Search,
  Upload,
} from 'lucide-react';
import { useTaskStore } from '@/lib/store';
import type { TaskRow } from '@/lib/types';

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

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
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="project-dialog-overlay" onClick={onClose} role="presentation">
      <div
        className="project-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="project-dialog-title">选择项目</h3>
        {PROJECTS.map((project) => (
          <button
            key={project.id}
            className={`project-dialog-item ${project.id === current ? 'current' : ''}`}
            onClick={() => {
              onSelect(project.id);
              onClose();
            }}
            type="button"
          >
            <FolderOpen size={16} />
            <span>{project.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

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
    <button
      className={`task-item-v2 ${active ? 'active' : ''}`}
      onClick={onClick}
      data-session-id={task.id}
      data-active={active}
      type="button"
    >
      <span className={`task-dot status-${task.status}`} />
      <span className="task-item-title">{task.title}</span>
      <span className="task-item-time">{timeAgo(task.updatedAt)}</span>
    </button>
  );
}

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
      <button
        className={`task-group-header ${open ? '' : 'collapsed'}`}
        onClick={() => setOpen((value) => !value)}
        type="button"
        aria-expanded={open}
      >
        <ChevronDown />
        <span className="group-title">{title}</span>
        {count !== undefined && <span className="group-count">{count}</span>}
      </button>
      {open &&
        tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            active={task.id === currentId}
            onClick={() => onSelect(task.id)}
          />
        ))}
    </div>
  );
}

export function Sidebar() {
  const tasks = useTaskStore((state) => state.tasks);
  const currentId = useTaskStore((state) => state.currentId);
  const selectTask = useTaskStore((state) => state.selectTask);
  const newTask = useTaskStore((state) => state.newTask);

  const [collapsed, setCollapsed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [project, setProject] = useState('quick');
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [cloudOpen, setCloudOpen] = useState(true);
  const resizing = useRef(false);
  const widthRef = useRef(sidebarWidth);

  useEffect(() => {
    widthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    const saved = Number(localStorage.getItem('sidebar-w'));
    if (Number.isFinite(saved) && saved >= 240 && saved <= 480) {
      setSidebarWidth(saved);
    }
  }, []);

  const onMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    resizing.current = true;
    const startX = event.clientX;
    const startWidth = widthRef.current;
    document.body.classList.add('sidebar-resizing');

    const onMove = (moveEvent: MouseEvent) => {
      if (!resizing.current) return;
      const width = Math.max(240, Math.min(480, startWidth + moveEvent.clientX - startX));
      widthRef.current = width;
      setSidebarWidth(width);
    };
    const onUp = () => {
      resizing.current = false;
      localStorage.setItem('sidebar-w', String(widthRef.current));
      document.body.classList.remove('sidebar-resizing');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const waitingTasks = tasks.filter((task) => task.status === 'waiting');
  const otherTasks = tasks.filter((task) => task.status !== 'waiting');
  const projectName = PROJECTS.find((item) => item.id === project)?.name ?? 'Quick Tasks';

  return (
    <>
      <aside
        className={`sidebar ${collapsed ? 'collapsed' : ''}`}
        style={{ width: collapsed ? 0 : sidebarWidth }}
      >
        <div className="sidebar-inner" style={{ width: sidebarWidth }}>
          <div className="project-switcher">
            <button
              className="project-switcher-btn"
              onClick={() => setDialogOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={dialogOpen}
              aria-label="选择项目"
              type="button"
            >
              <span className="project-switcher-label">Project</span>
              <span className="project-switcher-name">{projectName}</span>
            </button>
            <button
              className="sidebar-collapse-btn"
              onClick={() => setCollapsed(true)}
              title="折叠面板"
              type="button"
            >
              <PanelLeft size={16} />
            </button>
          </div>

          <section className="sidebar-section">
            <div className="section-header">
              <div className="section-header-left">
                <button className="section-icon-btn" title="新建任务" onClick={newTask} type="button">
                  <ChevronDown size={14} />
                </button>
                <span className="section-header-title">任务</span>
              </div>
              <div className="section-header-actions">
                <button className="section-icon-btn" title="搜索" type="button">
                  <Search size={14} />
                </button>
                <button className="section-icon-btn" title="查看全部" type="button">
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
          </section>

          <section className="sidebar-section">
            <div className="section-header">
              <div className="section-header-left">
                <button
                  className={`section-icon-btn ${cloudOpen ? '' : 'collapsed'}`}
                  title="折叠"
                  onClick={() => setCloudOpen((value) => !value)}
                  type="button"
                  aria-expanded={cloudOpen}
                >
                  <ChevronDown size={14} />
                </button>
                <span className="section-header-title">云盘</span>
              </div>
              <div className="section-header-actions">
                <button className="section-icon-btn" title="上传" type="button">
                  <Upload size={14} />
                </button>
              </div>
            </div>
            {cloudOpen && (
              <div className="section-body">
                <div className="cloud-empty">No files yet</div>
              </div>
            )}
          </section>
        </div>

        {!collapsed && <div className="sidebar-resizer" onMouseDown={onMouseDown} />}
      </aside>

      {collapsed && (
        <button
          className="sidebar-collapse-btn sidebar-expand-btn"
          onClick={() => setCollapsed(false)}
          title="展开面板"
          type="button"
        >
          <PanelLeft size={16} />
        </button>
      )}

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
