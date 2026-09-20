# Proposal

## Why

点击图标栏中的“中心”目前没有任何响应，项目也没有可管理的业务技能来源。现有技能选择仅是输入框内的硬编码选项，无法被发现、查看、启用或持久化，也不能清晰区分 Skill 定义与执行任务的 Agent。

本变更将建立项目本地 `skills/` 注册表和真实的 `/skills` Skill Hub，使技能成为可维护、可复用且会实际影响 Agent 上下文的项目能力。

## What Changes

- 新增项目根目录 `skills/` 本地技能注册表，每个技能使用独立目录和 `skill.md` 定义元数据及指令。
- 新增技能读取、校验、列表和启用状态持久化能力，离线运行，不依赖远程 Biomni 技能市场。
- 为图标栏“中心”接入 `/skills` 路由和 Skill Hub 页面，支持搜索、分类、详情和启用/停用。
- 让任务创建和后续 Agent 运行读取已启用的本地 skill 定义，而不是依赖输入框中的硬编码技能数组。
- 保留 Agent 作为执行者的职责边界：Skill 提供能力定义和约束，Qoder Agent 负责实际执行。
- 更新 `analysis.md`，将 Skill Hub 从静态列表降级方案改为本地技能注册表方案，并记录目录结构和运行链路。

## Capabilities

### New Capabilities

- `local-skill-registry`: 定义本地 `skills/` 目录、`skill.md` 格式、技能发现、校验和启用状态。
- `skill-hub`: 定义 `/skills` 页面、中心入口、技能列表/详情/搜索及启用管理行为。
- `agent-skill-context`: 定义已启用 Skill 如何进入任务创建和 Agent 执行上下文。

### Modified Capabilities

- None.

## Impact

- 前端：`components/IconRail.tsx`、新增 `/skills` 页面及 Skill Hub 组件、相关样式。
- 服务端：新增技能注册表读取/API 与本地启用状态存储；任务创建和 Agent provider 读取技能内容。
- Agent 集成：调整 `lib/provider.ts` 和任务选项的技能来源，避免 UI 与执行逻辑各自维护一套硬编码列表。
- 文档：更新 `analysis.md`，必要时补充 README 的本地技能使用说明。
- 不新增远程服务或第三方依赖；现有项目/任务上下文能力保持不变。
