'use client';

import React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  FolderOpen,
  List,
  PanelLeft,
  Search,
  Settings2,
  Pencil,
  Trash2,
  X,
  Upload,
  Plus,
} from 'lucide-react';
import { useTaskStore } from '@/lib/store';
import { timeAgo, useLocale } from '@/lib/i18n';
import type { ProjectRow, TaskRow } from '@/lib/types';

type Project = ProjectRow;

function ProjectDialog({
  projects,
  current,
  onSelect,
  onClose,
  onCreate,
}: {
  projects: Project[];
  current: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const { t } = useLocale();
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
        <h3 id="project-dialog-title">{t.selectProject}</h3>
        {projects.map((project) => (
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
        {!creating ? (
          <button className="project-dialog-item project-create-item" onClick={() => setCreating(true)} type="button">
            <Plus size={16} />
            <span>{t.newProject}</span>
          </button>
        ) : (
          <form className="project-create-form" onSubmit={async (event) => { event.preventDefault(); if (!name.trim()) return; await onCreate(name.trim()); }}>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t.projectName} maxLength={80} autoFocus aria-label={t.newProjectName} />
            <div className="project-create-actions">
              <button className="project-primary-btn" type="submit" disabled={!name.trim()}>{t.create}</button>
              <button className="project-secondary-btn" type="button" onClick={() => { setCreating(false); setName(''); }}>{t.cancel}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ProjectSettingsDialog({
  project,
  hasTasks,
  onRename,
  onDelete,
  onClose,
}: {
  project: Project;
  hasTasks: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { t } = useLocale();
  const canDelete = !project.isDefault && !hasTasks;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="project-dialog-overlay" onClick={onClose} role="presentation">
      <div className="project-dialog project-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="project-settings-title" onClick={(event) => event.stopPropagation()}>
        <div className="project-dialog-heading">
          <h3 id="project-settings-title">{t.projectSettings}</h3>
          <button className="dialog-close-btn" onClick={onClose} type="button" aria-label={t.close}>
            <X size={16} />
          </button>
        </div>
        <label className="project-setting-field">
          <span>{t.projectName}</span>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoFocus />
        </label>
        <button className="project-primary-btn" type="button" disabled={!name.trim() || name.trim() === project.name} onClick={() => { onRename(name.trim()); onClose(); }}>
          <Pencil size={14} /> {t.saveName}
        </button>
        <div className="project-danger-zone">
          <div>
            <strong>{t.deleteProject}</strong>
            <span>{project.id === 'quick' ? t.deleteReasonDefault : hasTasks ? t.deleteReasonHasTasks : t.deleteReasonNone}</span>
          </div>
          {!confirmDelete ? (
            <button className="project-danger-btn" disabled={!canDelete} type="button" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} /> {t.delete}
            </button>
          ) : (
            <div className="project-delete-confirm">
              <span>{t.confirmDelete}</span>
              <button className="project-danger-btn" type="button" onClick={() => { onDelete(); onClose(); }}>{t.confirm}</button>
              <button className="project-secondary-btn" type="button" onClick={() => setConfirmDelete(false)}>{t.cancel}</button>
            </div>
          )}
        </div>
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
  const { locale, t } = useLocale();
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
      <span className="task-item-time">{timeAgo(task.updatedAt, locale, t)}</span>
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

export function Sidebar({ collapsed, onCollapsedChange, onShowOverview }: { collapsed?: boolean; onCollapsedChange?: (collapsed: boolean) => void; onShowOverview?: () => void; onShowConversation?: () => void } = {}) {
  const projects = useTaskStore((state) => state.projects);
  const activeProjectId = useTaskStore((state) => state.activeProjectId);
  const loadProjects = useTaskStore((state) => state.loadProjects);
  const switchProject = useTaskStore((state) => state.switchProject);
  const tasks = useTaskStore((state) => state.tasks);
  const currentId = useTaskStore((state) => state.currentId);
  const selectTask = useTaskStore((state) => state.selectTask);
  const newTask = useTaskStore((state) => state.newTask);
  const { t } = useLocale();

  const [localCollapsed, setLocalCollapsed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [cloudOpen, setCloudOpen] = useState(true);
  const [tasksOpen, setTasksOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const resizing = useRef(false);
  const widthRef = useRef(sidebarWidth);
  const isCollapsed = collapsed ?? localCollapsed;
  const setCollapsed = (value: boolean) => {
    if (onCollapsedChange) onCollapsedChange(value);
    else setLocalCollapsed(value);
  };

  useEffect(() => {
    widthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    const saved = Number(localStorage.getItem('sidebar-w'));
    if (Number.isFinite(saved) && saved >= 240 && saved <= 480) {
      setSidebarWidth(saved);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSearchQuery('');
        setSearchOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [searchOpen]);

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

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleTasks = normalizedQuery ? tasks.filter((task) => `${task.title} ${task.input}`.toLowerCase().includes(normalizedQuery)) : tasks;
  const waitingTasks = visibleTasks.filter((task) => task.status === 'waiting');
  const otherTasks = visibleTasks.filter((task) => task.status !== 'waiting');
  const availableProjects = projects.length ? projects : [{ id: 'quick-tasks', name: t.quickTasks, createdAt: 0, updatedAt: 0, isDefault: true } satisfies ProjectRow];
  const project = activeProjectId ?? availableProjects[0]?.id ?? 'quick';
  const currentProject = availableProjects.find((item) => item.id === project) ?? availableProjects[0];
  const projectName = currentProject?.name ?? t.quickTasks;
  const currentProjectHasTasks = tasks.length > 0;

  const renameProject = (name: string) => {
    void fetch(`/api/projects/${encodeURIComponent(project)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    }).then(() => loadProjects());
  };
  const deleteProject = () => {
    void fetch(`/api/projects/${encodeURIComponent(project)}`, { method: 'DELETE' }).then(() => loadProjects());
  };
  const createProject = async (name: string) => {
    const response = await fetch('/api/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    });
    if (!response.ok) return;
    const body = (await response.json()) as { project?: ProjectRow };
    await loadProjects();
    if (body.project) await switchProject(body.project.id);
    setDialogOpen(false);
  };

  return (
    <>
      <aside
        className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}
        style={{ width: isCollapsed ? 0 : sidebarWidth }}
      >
        <div className="sidebar-inner" style={{ width: sidebarWidth }}>
          <div className="project-switcher">
            <button
              className="project-switcher-btn"
              onClick={() => setDialogOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={dialogOpen}
              aria-label={t.selectProject}
              type="button"
            >
              <span className="project-switcher-label">{t.projectEyebrow}</span>
              <span className="project-switcher-name">{projectName}</span>
            </button>
            <button
              className="project-action-btn"
              onClick={() => setSettingsOpen(true)}
              title={t.projectSettings}
              aria-label={t.projectSettings}
              type="button"
            >
              <Settings2 size={16} />
            </button>
            <button
              className="sidebar-collapse-btn"
              onClick={() => setCollapsed(true)}
              title={t.collapsePanel}
              type="button"
            >
              <PanelLeft size={16} />
            </button>
          </div>

          <section className="sidebar-section">
            <div className="section-header">
              <div className="section-header-left">
                <button className={`section-icon-btn ${tasksOpen ? '' : 'collapsed'}`} title={t.collapseTasks} aria-label={t.collapseTasks} aria-expanded={tasksOpen} onClick={() => setTasksOpen((value) => !value)} type="button">
                  <ChevronDown size={14} />
                </button>
                <span className="section-header-title">{t.tasks}</span>
              </div>
              <div className="section-header-actions">
                <button className="section-icon-btn" title={t.search} aria-label={t.searchTasks} aria-expanded={searchOpen} onClick={() => setSearchOpen((value) => !value)} type="button">
                  <Search size={14} />
                </button>
                <button className="section-icon-btn" title={t.viewAll} aria-label={t.viewAllTasks} type="button" onClick={() => onShowOverview?.()}>
                  <List size={14} />
                </button>
                <button className="section-icon-btn" title={t.newTask} aria-label={t.newTask} onClick={newTask} type="button"><Plus size={14} /></button>
              </div>
            </div>
            {tasksOpen && <div className="section-body">
              {searchOpen && <div className="sidebar-task-search"><Search size={14} /><input autoFocus aria-label={t.searchTasks} placeholder={t.searchTasks} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /><button type="button" aria-label={t.clearSearch} onClick={() => { setSearchQuery(''); setSearchOpen(false); }}><X size={14} /></button></div>}
              {visibleTasks.length === 0 && <div className="cloud-empty">{tasks.length ? t.noMatchingTasks : t.noTasks}</div>}
              {waitingTasks.length > 0 && (
                <TaskGroup
                  title={t.waitingInput}
                  count={waitingTasks.length}
                  tasks={waitingTasks}
                  currentId={currentId}
                  onSelect={(id) => void selectTask(id)}
                />
              )}
              {otherTasks.length > 0 && (
                <TaskGroup
                  title={t.recent}
                  tasks={otherTasks}
                  currentId={currentId}
                  onSelect={(id) => void selectTask(id)}
                />
              )}
            </div>}
          </section>

          <section className="sidebar-section">
            <div className="section-header">
              <div className="section-header-left">
                <button
                  className={`section-icon-btn ${cloudOpen ? '' : 'collapsed'}`}
                  title={t.collapse}
                  onClick={() => setCloudOpen((value) => !value)}
                  type="button"
                  aria-expanded={cloudOpen}
                >
                  <ChevronDown size={14} />
                </button>
                <span className="section-header-title">{t.cloud}</span>
              </div>
              <div className="section-header-actions">
                <button className="section-icon-btn" title={t.upload} type="button">
                  <Upload size={14} />
                </button>
              </div>
            </div>
            {cloudOpen && (
              <div className="section-body">
                <div className="cloud-empty">{t.noFiles}</div>
              </div>
            )}
          </section>
        </div>

        {!isCollapsed && <div className="sidebar-resizer" onMouseDown={onMouseDown} />}
      </aside>

      {dialogOpen && (
        <ProjectDialog
          projects={availableProjects}
          current={project}
          onSelect={(id) => void switchProject(id)}
          onCreate={createProject}
          onClose={() => setDialogOpen(false)}
        />
      )}
      {settingsOpen && currentProject && (
        <ProjectSettingsDialog
          project={currentProject}
          hasTasks={currentProjectHasTasks}
          onRename={renameProject}
          onDelete={deleteProject}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}
