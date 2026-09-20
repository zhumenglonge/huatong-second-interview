# Proposal

## Why

当前工作台的核心流程已经可运行，但界面仍存在语言混用、缺少主题选择、右侧任务信息默认不可见以及顶部存在冗余技术文案等问题。这些问题会增加认知负担，削弱国际化使用场景下的清晰度，也让任务状态和结果不够容易被发现。

## What Changes

- 增加中文/英文界面切换，并持久化用户选择。
- 增加浅色/深色主题切换，并持久化用户选择。
- 将待办、结果、计算、笔记四个右侧模块默认设置为显示且内容默认展开。
- 保留布局入口，允许用户分别关闭或折叠右侧模块，并保留已有宽度与折叠状态行为。
- 移除顶部 `real QoderCN Agent backend` 文案。
- 统一用户可见文案，避免无意的中英文混用；模型名称、技能名称等专有名词除外。
- 为语言和主题控件提供清晰的无障碍名称和当前状态反馈。

## Capabilities

### New Capabilities

- `ui-localization-and-theme`: 提供工作台的中英文切换、浅色/深色主题切换及其持久化行为。

### Modified Capabilities

- `right-panel-layout`: 将首次打开工作区时右侧四个模块默认隐藏，修改为四个模块默认显示且内容默认展开；保留按需关闭、折叠和宽度记忆。

## Impact

- 影响 `app/page.tsx`、`app/globals.css`、`components/LayoutPopover.tsx`、`components/RightPanel.tsx`、`components/InputBar.tsx`、`components/Sidebar.tsx`、`components/TaskOverview.tsx` 及新增的界面文案/偏好状态模块。
- 不改变任务 API、SSE 协议、SQLite 数据模型或 Agent 执行逻辑。
- 主题需要覆盖现有核心工作区组件的背景、边框、文字、输入控件和状态反馈颜色。
