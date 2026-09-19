# Biomni Lab · 改进版原型

> 华通科技 AI-Native 前端 & 分析工程师二面作业。逆向 [Biomni](https://biomni.stanford.edu/)（Stanford SNAP 出品的通用生物医学 AI Agent），在其"自然语言对话驱动科研任务"的基础上，补上 Biomni 网页版最缺的一块：**可视化的任务执行画布（工作流 DAG）**，并把后端接成**真实的 QoderCN Agent**（非 mock）。

- 产品与需求分析：见 [`analysis.md`](./analysis.md)
- AI 协作说明：见 [`ai_usage.md`](./ai_usage.md)

---

## 一、这是什么

一个 Next.js 全栈应用。用户在输入框用自然语言下达一个科研任务（例如"创建 data.csv 并计算基因表达均值，写入 report.md"），后端把它交给**真实的 Qoder Agent**在独立沙箱目录里执行；前端通过 **SSE 实时流式**呈现 Agent 的思考正文、工具调用步骤、执行轨迹与产出文件，并可切换到**任务画布**用 DAG 观察/编排执行过程。

核心特性（对应作业五态与工程要求）：

| 能力 | 说明 |
|---|---|
| 真实 Agent | 后端调用 `@qodercn-ai/qodercn-agent-sdk`，每个任务在 `.data/sandboxes/<taskId>` 独立目录内真实规划 + 工具调用 + 落盘产物 |
| 前后端 API | REST（创建/列表/快照/取消/重试）+ SSE（实时事件流） |
| 持久化 | `node:sqlite` 事件溯源：所有事件先落库再广播 |
| 五态 | `queued / running / success / failed / cancelled` 全部真实触发 |
| 刷新恢复 | 事件溯源 + seq 去重续传，刷新/重连后画面与实时流一致 |
| 加载/失败/重试/取消 | 输入框与右栏提供完整交互，取消为真 `interrupt()` |
| 任务画布 | React Flow DAG：节点=步骤、状态实时变色；编排模式可拖拽/连线并把计划编译进 Agent prompt |

---

## 二、快速开始

### 环境要求

- **Node.js ≥ 22**（使用内置 `node:sqlite`；开发验证于 Node 26）
- npm
- 一个**有额度的 QoderCN 账号**（`qoder.cn`）

### 安装

```bash
npm install
# 下载 SDK 自带的 CN CLI 二进制（登录与 process transport 都用到它）
npm run setup:cli
```

### 授权（二选一）

**方式 A · 复用本机 CLI 登录（推荐，无需把 Token 写进任何文件）**

```bash
./node_modules/@qodercn-ai/qodercn-agent-sdk/dist/_bundled/qoderclicn login
# 浏览器打开 qoder.cn 授权页，用有额度的 QoderCN 账号确认
# 登录态写入 ~/.qoder-cn，后端 qodercliAuth() 自动复用
```

**方式 B · Personal Access Token**

```bash
cp .env.example .env
# 编辑 .env，填入 QODERCN_PERSONAL_ACCESS_TOKEN=pt-xxxx
```

> Token 只在服务端使用，绝不进入前端 bundle，也绝不提交进仓库（`.env` 已在 `.gitignore`）。

### 启动

```bash
npm run dev
# 打开 http://localhost:3000
```

### 其它脚本

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest run（reducer 纯函数单测）
npm run build       # 生产构建
npm run lint        # eslint
```

---

## 三、技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 框架 | Next.js 15 App Router（Route Handlers）+ React 19 | 全栈一体，API 与 UI 同仓 |
| 语言 | TypeScript（strict） | 事件/block 形状跨端共享，编译期兜底 |
| 状态 | Zustand | 轻量，SSE 事件直接驱动 store |
| 实时 | SSE（`EventSource`） | 单向服务端推流，比 WebSocket 简单、天然穿透刷新恢复 |
| 持久化 | `node:sqlite`（`DatabaseSync`） | Node 内置、零原生编译（替代在 Node 26 编译失败的 better-sqlite3） |
| Agent | `@qodercn-ai/qodercn-agent-sdk` | 真实 QoderCN Agent（CN 端点/额度） |
| 画布 | `@xyflow/react`（React Flow 12） | 成熟的 DAG 交互（拖拽/连线/缩放/MiniMap） |
| 测试 | Vitest | 覆盖跨端共享的纯 reducer |

---

## 四、架构

```
┌─────────────┐   REST    ┌──────────────────────────────────────────┐
│  Browser    │──────────▶│  Next.js Route Handlers (app/api/tasks)   │
│  (React +   │           │   · POST   /api/tasks        创建+启动     │
│   Zustand)  │   SSE     │   · GET    /api/tasks        列表          │
│             │◀──────────│   · GET    /api/tasks/[id]   快照(重放)    │
│ 三栏 + 画布  │           │   · GET    /api/tasks/[id]/stream  SSE    │
└─────────────┘           │   · POST   /api/tasks/[id]/cancel 取消    │
                          │   · POST   /api/tasks/[id]/retry  重试    │
                          └───────────────┬──────────────────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
             ┌───────────┐        ┌──────────────┐      ┌──────────────┐
             │  runner   │───────▶│   provider   │─────▶│ QoderCN SDK  │
             │ 生命周期   │ emit   │ 消息→事件映射 │ query │ 真实 Agent   │
             └─────┬─────┘        └──────────────┘      └──────┬───────┘
                   │ appendEvent(先落库)                        │ 工具调用
                   ▼                                            ▼
             ┌───────────┐   publish   ┌──────────┐    ┌────────────────┐
             │  SQLite   │────────────▶│  events  │    │ 沙箱目录        │
             │ EventLog  │             │ pub/sub  │    │.data/sandboxes │
             └───────────┘             └──────────┘    └────────────────┘
```

### 关键设计

**1. 事件溯源 = 刷新恢复的根基。** Runner 产生的每个事件先 `appendEvent` 写入 SQLite `EventLog`（单调 `seq`），再 `publish` 到内存总线。SSE 连接时**先订阅实时流、再重放 `after=seq` 的历史事件**，用单调 `lastSent` 去重；客户端 `onopen` 时重载快照并对 `ev.seq <= lastSeq` 的事件丢弃。因此断线/刷新后重连，画面与实时流严格一致。

**2. 纯 reducer 跨端共享。** [`lib/reducer.ts`](./lib/reducer.ts) 的 `applyEventToBlocks` 是无 `node:*` 依赖的纯函数：服务端用它重放事件构建快照，客户端用它把实时事件折叠进 block 列表。同一份逻辑保证 "刷新恢复" 与 "实时流" 渲染完全相同（见 [`lib/reducer.test.ts`](./lib/reducer.test.ts)）。

**3. Block 模型。** 会话流用单一 JSON-friendly 的 `Block` 表达：`user / agent_text / step / trace / plan / artifact / error`，能无损穿过 SSE + SQLite 序列化。

**4. SDK 消息 → 内部事件映射**（[`lib/provider.ts`](./lib/provider.ts)）：

| SDK 消息 | 内部事件 |
|---|---|
| `stream_event`（text_delta） | `block.delta`（增量正文） |
| `assistant`（tool_use） | `block.add` step + trace |
| `assistant`（text，无 delta 时） | `block.add` agent_text |
| `user`（tool_result） | `block.status` + `block.patch`（轨迹输出） |
| `system:artifacts_update` | `artifact.add` |
| `result`（success/error） | 任务终态 |

**5. 沙箱隔离。** 每个任务在 `.data/sandboxes/<taskId>` 独立目录内执行；任务结束时递归扫描沙箱补录未上报的产物文件。

**6. 抗 HMR / 重启。** Runner registry 与事件总线挂 `globalThis`；服务重启时把残留的 `running/queued` 任务标记为 `failed`（避免僵尸态）。

---

## 五、目录结构

```
app/
  page.tsx                     三栏布局（会话/画布切换）
  layout.tsx  globals.css      全局样式
  api/tasks/
    route.ts                   列表 + 创建(启动)
    [id]/route.ts              快照(事件重放)
    [id]/stream/route.ts       SSE(订阅+重放+去重)
    [id]/cancel/route.ts       取消(真 interrupt)
    [id]/retry/route.ts        重试(同任务追加历史重跑)
components/
  TaskList  Conversation  InputBar  RightPanel   三栏 UI
  BlockView  StatusBadge                          block 渲染 / 状态徽章
  CanvasView  StepNode                            任务画布(React Flow)
lib/
  types.ts      跨端共享领域类型
  db.ts         node:sqlite + 快照构建
  reducer.ts    纯 reducer(跨端)  + reducer.test.ts
  events.ts     内存 pub/sub
  provider.ts   QoderCN SDK 适配器(消息→事件)
  runner.ts     任务生命周期(start/cancel/retry/持久化)
  store.ts      Zustand + SSE + 刷新恢复
analysis.md     产品/需求分析与方案
ai_usage.md     AI 协作说明
```

---

## 六、已知限制

- **单机内存态运行**：Runner 在 Next.js 进程内 fire-and-forget 执行，未做分布式队列；多实例部署需把 runner 外置为独立 worker。
- **SSE 单向**：仅服务端→客户端推流；用户中途追加指令通过"重试/新任务"表达，未做运行中插话。
- **画布编排为 prompt 注入**：编排模式把 DAG 编译成"建议执行计划"文本注入 Agent prompt，属于软约束（Agent 仍自主决策），而非硬性的步骤级调度引擎。
- **产物预览**：右栏列出产物文件名/大小，未内联渲染图片/表格内容。
- **鉴权**：原型无用户体系与多租户隔离，授权依赖本机 CLI 登录态或服务端 env Token。

---

## 七、验证记录

真实 QoderCN Agent（Qwen3.8）全链路已跑通：

- 真实执行：`Bash→Write→Bash→Write→Bash` 全部 success，沙箱落盘 `data.csv` + `report.md`
- 流式正文：增量 delta 实时推送
- 持久化/刷新恢复：112 条事件入库，快照 + seq 去重续传
- 五态：`queued/running/success/failed/cancelled` 全部真实触发
- 真取消：running 中 `POST cancel` → `interrupt()` 生效 → `cancelled`
- 画布：浏览器实测实时 DAG（输入→5 步骤绿框→产物）与编排模式（加节点/连线/删除）
- 单测：`npm test` 10/10 通过；`npm run typecheck` 0 错
