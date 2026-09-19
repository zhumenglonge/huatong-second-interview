# PROJECT_CONTEXT.md — 项目全局上下文

> 本文档供 AI 编码助手（Codex / Cursor / Copilot 等）快速理解本项目。
> 最后更新：2026-09-19

---

## 1. 项目定位

**华通科技二面作业**：复刻并改进 [Biomni Lab](https://biomni.phylo.bio/)（一个 AI 生物医学研究 Agent 平台）的前端原型。

核心卖点：
- 后端接入**真实 QoderCN Agent SDK**（非 mock），Agent 在本地沙箱目录中规划、执行、产出文件
- 前端通过 **SSE 流式推送** 实时展示 Agent 执行过程
- 新增**任务画布**（React Flow DAG 编排）——这是相对 Biomni 的差异化创新，Biomni 本身没有画布

---

## 2. 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 框架 | Next.js (App Router) | ^15.3.3 |
| UI | React | ^19.1.0 |
| 状态管理 | Zustand | ^5.0.5 |
| 画布 | @xyflow/react (React Flow) | ^12.11.6 |
| Agent 后端 | @qodercn-ai/qodercn-agent-sdk | ^1.0.43 |
| 数据库 | SQLite (Node.js 内置 `node:sqlite`) | — |
| 样式 | **纯手写 CSS**（`app/globals.css`，无 Tailwind） | — |
| 语言 | TypeScript (strict) | ^5.8.3 |
| 测试 | Vitest | ^3.2.7 |
| 包管理 | npm | — |

> **重要**：当前项目**不使用 Tailwind CSS**。所有样式在 `app/globals.css` 中手写。后续改造也继续用纯 CSS（已确认）。

---

## 3. 目录结构与文件职责

```
华通科技二面/
├── app/
│   ├── api/tasks/
│   │   ├── route.ts              # GET 列表 / POST 新建任务（触发 Agent）
│   │   └── [id]/
│   │       ├── route.ts          # GET 任务快照（refresh recovery）
│   │       ├── cancel/route.ts   # POST 取消运行中任务
│   │       ├── retry/route.ts    # POST 重试失败任务
│   │       └── stream/route.ts   # GET SSE 流（订阅 + 历史重放）
│   ├── globals.css               # ★ 全部样式（409 行，含画布样式）
│   ├── layout.tsx                # Root layout（html lang=zh-CN）
│   └── page.tsx                  # 主页面 shell（三列布局 + 会话流/画布切换）
├── components/
│   ├── BlockView.tsx             # 消息块渲染（user/agent_text/step/trace/artifact/error）
│   ├── CanvasView.tsx            # ★ 任务画布（React Flow）— 不要修改
│   ├── Conversation.tsx          # 会话流容器（滚动 + 消息列表）
│   ├── InputBar.tsx              # 底部输入区（textarea + 状态 + 发送/取消/重试）
│   ├── RightPanel.tsx            # 右侧面板（待办/步骤 + 结果文件 + 错误）
│   ├── StatusBadge.tsx           # 状态徽章（queued/running/waiting/success/failed/cancelled）
│   ├── StepNode.tsx              # ★ 画布自定义节点 — 不要修改
│   └── TaskList.tsx              # 左侧任务列表（当前改造目标）
├── lib/
│   ├── db.ts                     # SQLite 数据层（tasks/steps/artifacts/events CRUD + 快照重建）
│   ├── events.ts                 # 内存 pub/sub 总线（Runner → SSE）
│   ├── provider.ts               # QoderCN Agent SDK 封装（SDK 消息 → 内部 block/event 协议）
│   ├── reducer.ts                # 纯函数 reducer（event → blocks 折叠，前后端共用）
│   ├── runner.ts                 # 后台任务 Runner（生命周期：start/cancel/retry + 产物扫描）
│   ├── store.ts                  # Zustand 前端 store（SSE 订阅 + 快照恢复 + 去重）
│   └── types.ts                  # 共享类型定义（TaskRow/StepRow/ArtifactRow/Block/ServerEvent）
├── .data/
│   ├── biomni.db                 # SQLite 数据库文件（运行时生成）
│   └── sandboxes/                # 每个任务的沙箱工作目录
├── .env.example                  # 环境变量模板
├── next.config.mjs               # Next.js 配置（serverExternalPackages）
├── tsconfig.json                 # TS 配置（strict, paths: @/* → ./*）
├── package.json
├── analysis.md                   # 产品分析文档（Biomni 功能/状态机/取舍）
├── ui-alignment-plan.md          # UI 对齐总方案（全局规划，未执行）
└── sidebar-comparison.md         # 左侧栏对比 + 实现规格书（★ 当前执行目标）
```

---

## 4. 核心数据流

```
用户输入 → POST /api/tasks → createTask(SQLite) → startTask(runner)
                                                        │
                                                        ▼
                                              runQoderAgent(provider)
                                                        │
                                          SDK 流式消息（stream_event/assistant/user/system/result）
                                                        │
                                                        ▼
                                              emit(type, payload)
                                                   │         │
                                                   ▼         ▼
                                          appendEvent     publish
                                          (SQLite 持久)   (内存 bus)
                                                               │
                                                               ▼
                                                    SSE /api/tasks/[id]/stream
                                                               │
                                                               ▼
                                                    前端 EventSource (store.ts)
                                                               │
                                                               ▼
                                                    applyEvent → Zustand store → React 渲染
```

**刷新恢复协议**：
1. 前端 `selectTask(id)` → 先 `GET /api/tasks/[id]`（快照 = SQLite 事件重放）
2. 再 `new EventSource(/stream?after=0)`（订阅实时 + 重放历史）
3. `lastSeq` 单调递增去重，保证 snapshot 和 live 不重复

---

## 5. Block 协议（会话流数据模型）

```typescript
interface Block {
  id: string;
  kind: 'user' | 'agent_text' | 'step' | 'trace' | 'plan' | 'artifact' | 'error';
  text?: string;       // 用户输入 / Agent 文本 / trace 内容 / 错误信息
  name?: string;       // 步骤名 / 产物名 / 计划标题
  status?: StepStatus; // pending | running | success | failed | cancelled
  meta?: Record<string, unknown>;
}
```

SSE 事件类型：
- `task.status` — 任务状态变更
- `block.add` — 新块
- `block.delta` — 流式文本追加（打字机效果）
- `block.status` — 步骤状态变更
- `block.patch` — 块属性补丁（如 trace 输出）
- `artifact.add` — 新产物文件

---

## 6. 前端 Store（Zustand）

```typescript
interface TaskState {
  tasks: TaskRow[];          // 任务列表
  currentId: string | null;  // 当前选中任务
  blocks: Block[];           // 当前任务的会话块
  artifacts: ArtifactRow[];  // 当前任务的产物
  status: TaskStatus | null; // 当前任务状态
  taskError: string | null;
  lastSeq: number;           // SSE 去重序号
  connected: boolean;        // SSE 连接状态

  refreshTasks(): Promise<void>;
  newTask(): void;
  selectTask(id): Promise<void>;
  send(input): Promise<void>;
  cancel(): Promise<void>;
  retry(): Promise<void>;
}
```

---

## 7. 页面布局（当前）

```
┌─────────────────────────────────────────────────────┐
│ .app (display: grid; grid-template-columns: 240px 1fr 300px)│
│                                                     │
│ ┌─ TaskList ─┐ ┌─ main.col ──────────┐ ┌─ Right ─┐│
│ │ 240px      │ │ .col-head (tabs)     │ │ Panel   ││
│ │            │ │ Conversation|Canvas  │ │ 300px   ││
│ │            │ │ InputBar             │ │         ││
│ └────────────┘ └──────────────────────┘ └─────────┘│
└─────────────────────────────────────────────────────┘
```

- `page.tsx` 有一个 `view` state 切换 `会话流` / `任务画布`
- 画布使用 `@xyflow/react`（React Flow），有 live/edit 两种模式
- 所有样式在 `globals.css`，无 CSS Modules / Tailwind / styled-components

---

## 8. 环境变量

| 变量 | 用途 | 必填 |
|---|---|---|
| `QODERCN_PERSONAL_ACCESS_TOKEN` | QoderCN Agent SDK 认证令牌 | 否（空则用本地 `qoderclicn login` 态） |
| `DATA_DIR` | SQLite + 沙箱存储目录 | 否（默认 `.data`） |

---

## 9. 运行方式

```bash
npm install
# 如需 Agent 后端：确保 qoderclicn 已登录，或设置 QODERCN_PERSONAL_ACCESS_TOKEN
npm run dev        # → http://localhost:3000
npm run build      # 生产构建
npm run typecheck  # TS 类型检查
npm run lint       # ESLint
```

---

## 10. 设计约束与禁区

### 绝对不动的文件/代码段
| 文件 | 原因 |
|---|---|
| `components/CanvasView.tsx` | 任务画布 = 本项目差异化创新，已完成 |
| `components/StepNode.tsx` | 画布自定义节点 |
| `globals.css` 中 `.canvas-toolbar` `.canvas-goal` `.canvas-empty` `.rf-*` 段 | 画布样式 |
| `lib/*` 全部 | 数据层/后端逻辑，UI 改造不涉及 |
| `app/api/*` 全部 | API 路由，UI 改造不涉及 |

### 设计原则
- **纯 CSS**：不引入 Tailwind / CSS Modules / styled-components。新样式追加到 `globals.css`
- **图标**：允许引入 `lucide-react`（已确认）
- **组件库**：不引入 shadcn/ui / Radix / MUI。手写组件
- **状态管理**：继续用 Zustand，不换
- **数据层零改动**：UI 改造只动 `components/` 和 `app/globals.css`、`app/page.tsx`、`app/layout.tsx`

---

## 11. Biomni 真身参考（DOM 实测摘要）

> 完整数据见 `sidebar-comparison.md`。以下为关键事实。

- **技术栈**：Next.js App Router + Tailwind CSS + shadcn/ui (Radix) + lucide-react + Sentry
- **布局**：60px 图标栏 + 320px 侧栏(可拖拽/可折叠) + 聊天区 + 8px 拖拽条 + 368px 右栏(4 折叠卡)
- **侧栏**：项目切换器(dialog) + 任务 section(分组:等待输入+最近) + 云盘 section(空态)
- **签名样式**：section header `border-b-2 border-b-primary` + `bg-muted/50`；任务项 `border-l-2` 左 accent
- **图标**：全部 lucide-react（folder-open, blocks, circle-help, chevron-down, panel-left, circle）
- **过渡**：`transition-all duration-300`（侧栏折叠）、`transition-colors duration-500`（任务项）
- **Biomni 没有 React Flow 画布**——本项目的画布是真正的差异化创新

---

## 12. 当前改造任务

**目标**：对齐 Biomni 左侧栏样式（仅左侧，不动聊天区/右栏/画布）。

**详细实现规格书**：见 `sidebar-comparison.md`（已更新为可执行 spec）。

**已确认决策**：
1. 范围：只改左侧
2. 图标：引入 `lucide-react`
3. CSS：纯 CSS（不引入 Tailwind）
4. 云盘：做空态 stub
5. 图标栏：完整 4 图标（项目/中心/帮助/账号）
6. 项目切换器：可点击弹 dialog

---

*本文档由 Qoder IDE 生成，供后续 AI 编码助手使用。*
