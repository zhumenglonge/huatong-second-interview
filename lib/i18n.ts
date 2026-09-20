'use client';

import { useEffect, useState } from 'react';

export type Locale = 'zh' | 'en';
export type ThemeName = 'light' | 'dark';

const messages = {
  zh: {
    title: 'Biomni Lab · 改进版原型',
    conv: '会话流', canvas: '任务画布', layout: '布局', layoutConfig: '布局配置',
    todo: '待办', results: '结果', compute: '计算', notes: '笔记',
    themeLight: '浅色主题', themeDark: '深色主题', language: '语言',
    switchToEn: '切换到英文界面', switchToZh: '切换到中文界面',
    newChat: '新建空白问答会话', project: '项目', hub: '中心', help: '帮助', account: '账号',
    composerTip: '在输入框中输入 @ 可提及数据库、文件、工具或技能', send: '发送', stop: '停止', add: '添加到消息',
    searchSkills: '搜索技能和工具', uploadFiles: '上传文件', attachFolder: '附加文件夹', skillsTools: '技能和工具',
    mentionCapability: '提及专业能力', attachTask: '将文件附加到此任务', uploadFolder: '递归上传文件夹',
    askAnything: '问我任何问题...', auto: '自动', autoHelp: '自动回答澄清问题并批准计划审核。', retry: '重试', uploading: '上传中…',
    remove: '移除', search: '搜索', clear: '清空', allStatuses: '全部状态',
    projectLabel: '项目', projectEyebrow: '项目', tasks: '任务', waitingInput: '等待输入', recent: '最近', cloud: '云盘', noFiles: '暂无文件',
    noTasks: '暂无任务', noMatchingTasks: '没有找到匹配的任务', selectProject: '选择项目', projectSettings: '项目设置',
    collapsePanel: '折叠面板', viewAll: '查看全部', newTask: '新建任务', upload: '上传',
    taskOverview: '任务总览', taskName: '名称', status: '状态', recentActivity: '最近活动', createdAt: '创建时间', noMatch: '没有找到匹配的任务',
    close: '关闭', collapse: '折叠', collapseTasks: '折叠任务', preview: '预览', download: '下载',
    refreshResults: '从存储刷新结果', computeHelp: '计算资源说明',
    todoEmptyTitle: '暂无待办列表', todoEmptyDesc: '多步骤任务会显示待办项',
    resultsEmptyTitle: '暂无结果', resultsEmptyDesc: '文件将显示在此处',
    computeEmptyTitle: '暂无计算作业', computeEmptyDesc: 'Agent 运行时将显示资源状态',
    notesEmptyTitle: '暂无笔记', notesEmptyDesc: '任务笔记将显示在此处',
    convEmpty: '选择左侧任务，或在下方输入一个研究任务开始。',
    newProject: '新建项目', projectName: '项目名称', newProjectName: '新项目名称', create: '创建', cancel: '取消',
    saveName: '保存名称', deleteProject: '删除项目', delete: '删除', confirmDelete: '确认删除？', confirm: '确认',
    deleteReasonDefault: '默认项目不可删除', deleteReasonHasTasks: '请先处理项目中的任务', deleteReasonNone: '删除后无法恢复',
    searchTasks: '搜索任务', viewAllTasks: '查看全部任务', clearSearch: '清空搜索', statusFilter: '任务状态筛选',
    loadingQueued: '任务已提交，等待 Agent 启动…', loadingPlanning: 'Agent 正在生成执行计划…', loadingRunning: 'Agent 正在分析并执行任务…',
    sendError: '发送失败，请检查服务连接后重试。', uploadError: '上传失败',
    quickTasks: '快速任务', justNow: '刚刚',
    status_queued: '排队中', status_running: '运行中', status_waiting: '等待输入', status_planning: '规划中',
    status_awaiting_approval: '等待审批', status_success: '成功', status_failed: '失败', status_cancelled: '已取消',
  },
  en: {
    title: 'Biomni Lab · Improved prototype',
    conv: 'Conversation', canvas: 'Task canvas', layout: 'Layout', layoutConfig: 'Layout settings',
    todo: 'To-do', results: 'Results', compute: 'Compute', notes: 'Notes',
    themeLight: 'Light theme', themeDark: 'Dark theme', language: 'Language',
    switchToEn: 'Switch to English', switchToZh: 'Switch to Chinese',
    newChat: 'New chat', project: 'Projects', hub: 'Skills', help: 'Help', account: 'Account',
    composerTip: 'Type @ in the input to mention databases, files, tools, or skills', send: 'Send', stop: 'Stop', add: 'Add to your message',
    searchSkills: 'Search skills and tools', uploadFiles: 'Upload files', attachFolder: 'Attach folder', skillsTools: 'Skills and tools',
    mentionCapability: 'Mention a specialist capability', attachTask: 'Attach files to this task', uploadFolder: 'Upload a folder recursively',
    askAnything: 'Ask me anything...', auto: 'Auto', autoHelp: 'Auto-answers clarifying questions and approves plan reviews.', retry: 'Retry', uploading: 'Uploading…',
    remove: 'Remove', search: 'Search', clear: 'Clear', allStatuses: 'All statuses',
    projectLabel: 'Project', projectEyebrow: 'Project', tasks: 'Tasks', waitingInput: 'Waiting for input', recent: 'Recent', cloud: 'Cloud drive', noFiles: 'No files yet',
    noTasks: 'No tasks yet', noMatchingTasks: 'No matching tasks', selectProject: 'Select project', projectSettings: 'Project settings',
    collapsePanel: 'Collapse panel', viewAll: 'View all', newTask: 'New task', upload: 'Upload',
    taskOverview: 'Task overview', taskName: 'Name', status: 'Status', recentActivity: 'Recent activity', createdAt: 'Created', noMatch: 'No matching tasks',
    close: 'Close', collapse: 'Collapse', collapseTasks: 'Collapse tasks', preview: 'Preview', download: 'Download',
    refreshResults: 'Refresh results from storage', computeHelp: 'Compute resource details',
    todoEmptyTitle: 'No to-do items', todoEmptyDesc: 'Multi-step tasks list their to-dos here',
    resultsEmptyTitle: 'No results yet', resultsEmptyDesc: 'Files will appear here',
    computeEmptyTitle: 'No compute jobs', computeEmptyDesc: 'Resource status appears while the agent runs',
    notesEmptyTitle: 'No notes yet', notesEmptyDesc: 'Task notes will appear here',
    convEmpty: 'Select a task on the left, or type a research task below to begin.',
    newProject: 'New project', projectName: 'Project name', newProjectName: 'New project name', create: 'Create', cancel: 'Cancel',
    saveName: 'Save name', deleteProject: 'Delete project', delete: 'Delete', confirmDelete: 'Confirm delete?', confirm: 'Confirm',
    deleteReasonDefault: 'The default project cannot be deleted', deleteReasonHasTasks: 'Resolve this project’s tasks first', deleteReasonNone: 'This cannot be undone',
    searchTasks: 'Search tasks', viewAllTasks: 'View all tasks', clearSearch: 'Clear search', statusFilter: 'Filter by status',
    loadingQueued: 'Task submitted, waiting for the agent to start…', loadingPlanning: 'The agent is drafting the plan…', loadingRunning: 'The agent is analyzing and running the task…',
    sendError: 'Send failed. Check the connection and retry.', uploadError: 'Upload failed',
    quickTasks: 'Quick Tasks', justNow: 'just now',
    status_queued: 'Queued', status_running: 'Running', status_waiting: 'Waiting', status_planning: 'Planning',
    status_awaiting_approval: 'Awaiting approval', status_success: 'Success', status_failed: 'Failed', status_cancelled: 'Cancelled',
  },
} as const;

export type Messages = { readonly [K in keyof (typeof messages)['zh']]: string };

/** Exported for tests and locale parity checks. */
export const uiMessages = messages;

export function useLocale() {
  const [locale, setLocale] = useState<Locale>('zh');
  useEffect(() => {
    const stored = window.localStorage.getItem('biomni-locale') as Locale | null;
    if (stored === 'zh' || stored === 'en') setLocale(stored);
    const onLocale = (event: Event) => {
      const next = (event as CustomEvent<Locale>).detail;
      if (next === 'zh' || next === 'en') setLocale(next);
    };
    window.addEventListener('biomni-locale-change', onLocale);
    return () => window.removeEventListener('biomni-locale-change', onLocale);
  }, []);
  const update = (next: Locale) => {
    setLocale(next);
    window.localStorage.setItem('biomni-locale', next);
    window.dispatchEvent(new CustomEvent('biomni-locale-change', { detail: next }));
  };
  return { locale, setLocale: update, t: messages[locale] };
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeName>('light');
  useEffect(() => {
    const stored = window.localStorage.getItem('biomni-theme') as ThemeName | null;
    if (stored === 'light' || stored === 'dark') setTheme(stored);
    const onTheme = (event: Event) => {
      const next = (event as CustomEvent<ThemeName>).detail;
      if (next === 'light' || next === 'dark') setTheme(next);
    };
    window.addEventListener('biomni-theme-change', onTheme);
    return () => window.removeEventListener('biomni-theme-change', onTheme);
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const update = (next: ThemeName) => {
    setTheme(next);
    window.localStorage.setItem('biomni-theme', next);
    window.dispatchEvent(new CustomEvent('biomni-theme-change', { detail: next }));
  };
  const toggle = () => update(theme === 'light' ? 'dark' : 'light');
  return { theme, setTheme: update, toggle };
}

/** Locale-aware relative time, e.g. "刚刚" / "just now", "5m ago" / "5 分钟前". */
export function timeAgo(ts: number, locale: Locale, t: Messages): string {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  const fmt = (n: number, unit: string) => (locale === 'zh' ? `${n} ${unit}前` : `${n}${unit} ago`);
  if (mins < 1) return t.justNow;
  if (mins < 60) return locale === 'zh' ? fmt(mins, '分钟') : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return locale === 'zh' ? fmt(hours, '小时') : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return locale === 'zh' ? fmt(days, '天') : `${days}d ago`;
}

/** Locale-aware absolute timestamp for tabular views. */
export function formatDateTime(ts: number, locale: Locale): string {
  return new Date(ts).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
}
