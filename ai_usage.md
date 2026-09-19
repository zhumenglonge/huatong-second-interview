# AI 使用说明（ai_usage.md）

本文件说明两件事：

1. **产品内的 AI 如何工作** —— 运行时真实 Agent 的调用方式、System Prompt、画布计划如何注入。
2. **本项目如何用 AI 协作构建** —— 开发过程中如何与 AI 结对，以及关键决策的取舍。

---

## 一、产品内的 AI（运行时）

### 1.1 真实 Agent，不是 mock

后端**不使用任何 mock/假数据**。每个任务都通过 `@qodercn-ai/qodercn-agent-sdk` 的 `query()` 发起一次真实的 Agent 会话，由 QoderCN（验证账号使用 Qwen3.8 系列模型）真实地规划、调用工具（Bash/Write/Read 等）、并在沙箱目录内落盘产物。

调用入口：[`lib/provider.ts`](./lib/provider.ts) 的 `runQoderAgent()`。

```ts
const auth = process.env.QODERCN_PERSONAL_ACCESS_TOKEN
  ? accessTokenFromEnv()   // 方式 B：服务端 env Token
  : qodercliAuth();        // 方式 A：复用本机 ~/.qoder-cn 登录态

q = query({
  prompt: input,
  options: {
    cwd,                                   // 每任务独立沙箱目录
    auth,
    abortController,                       // 支持真取消
    includePartialMessages: true,          // 打开流式增量
    maxTurns: 30,                          // 防止无限循环
    permissionMode: 'bypassPermissions',   // 沙箱内自动放行工具
    allowDangerouslySkipPermissions: true,
    systemPrompt: SYSTEM_PROMPT,
    pathToQoderCLIExecutable: <bundled CN CLI>,  // process transport（比默认 Worker 运行时更稳）
    stderr: (data) => console.error('[qodercn:stderr]', data),
  },
});
```

> **为什么显式指定 `pathToQoderCLIExecutable`**：SDK 默认的 in-process Worker 运行时在本环境会返回泛化错误（"The request could not be completed"），而直接用 SDK 自带的 CN CLI 二进制（process transport）与手动 `qoderclicn -p` 一致可正常工作。故优先解析并指向 `node_modules/@qodercn-ai/qodercn-agent-sdk/dist/_bundled/qoderclicn`。

### 1.2 System Prompt 设计

Agent 的行为由 [`lib/provider.ts`](./lib/provider.ts) 中的 `SYSTEM_PROMPT` 约束，核心规则：

- 定位为"集成生物学环境中的通用生物医学研究 Agent"（对齐 Biomni 产品语境）。
- **只在当前工作目录（沙箱）内工作**，绝不触碰目录外文件 —— 这是安全边界。
- 把任务拆成具体步骤并用工具执行。
- 所有交付物（数据集、csv/tsv、图表、最终 markdown 报告）写进工作目录。
- 每条可见消息简洁：先说要做什么，再做。
- 结尾给出发现摘要 + 产出文件清单。

设计意图：让 Agent 的输出天然适配前端的 block 模型（正文 / 步骤 / 轨迹 / 产物），并保证产物一定落在沙箱里可被扫描补录。

### 1.3 SDK 消息 → 前端事件的翻译

Agent 流式返回的 `SDKMessage` 被翻译成内部事件词汇（`block.add / block.delta / block.status / block.patch / artifact.add / task.status`），这套词汇同时被 SSE 层和 SQLite 事件日志使用。映射表见 [`README.md` §四](./README.md#四架构)。翻译逻辑集中在 `runQoderAgent` 的 `for await (const msg of q)` 循环内，维护每会话状态（当前正文 block、轮次是否已有 delta、步骤序号、tool_use→step 映射、已见产物集合）。

### 1.4 画布"编排计划"如何影响 AI

任务画布（[`components/CanvasView.tsx`](./components/CanvasView.tsx)）的**编排模式**允许用户拖拽节点、连线，构造一个执行计划 DAG。点击"按此计划执行"时，DAG 被**编译成一段结构化文本**（目标 + 按依赖顺序排列的建议步骤），拼接进用户 prompt 一起交给真实 Agent。

```
<用户目标>

建议执行计划（按依赖顺序）:
1. <节点A>
2. <节点B>
...
```

> **取舍**：这是**软约束**（prompt 注入），Agent 仍保留自主决策权，而非硬性的步骤级调度引擎。对 2 天时限的原型而言，这既展示了"可视化编排影响真实执行"的产品价值，又避免了实现一个完整的 DAG 调度器。详见 [`README.md` §六 已知限制](./README.md#六已知限制)。

### 1.5 AI 安全与成本控制

- **Token 只在服务端**：`QODERCN_PERSONAL_ACCESS_TOKEN` 通过 env 读取，绝不进入前端 bundle，`.env` 已 gitignore。
- **沙箱隔离**：每任务独立目录 `.data/sandboxes/<taskId>`，System Prompt 强约束不得越界。
- **回合上限**：`maxTurns: 30` 防止 Agent 无限循环烧额度。
- **可中断**：`abortController` + `query.interrupt()` 支持用户随时真取消，立即停止消耗。

---

## 二、本项目如何用 AI 协作构建

本项目全程与 AI 编码助手结对完成。以下是协作方式与关键节点，供复盘。

### 2.1 协作流程

| 阶段 | 人做什么 | AI 做什么 |
|---|---|---|
| 需求分析 | 提供二面作业 docx | 解压读取正文 + 4 张内嵌图，产出评分点/技术栈/数据模型/状态机/API 的 review |
| 方案定型 | 拍板"走方案一（任务画布）" | 调研 Biomni 产品背景，产出 `analysis.md`（7 问全答 + 流程图/状态图 + 取舍表） |
| P0 闭环 | 要求"接真实 SDK，不要 mock" | 搭脚手架、数据层、事件溯源、SSE、五态、三栏 UI |
| 授权排障 | 反馈"Qoder 无额度、QoderCN 有" | 定位品牌是编译期常量，切换到 CN 版 SDK/CLI，完成登录与真实任务验收 |
| P1 画布 | 确认"可以" | React Flow 实时 DAG + 编排模式 + 状态色，浏览器实测 |
| 收尾 | 确认"可以" | 补 vitest 单测、README、ai_usage.md |

### 2.2 让 AI 高效工作的几个做法

- **给足上下文再动手**：先让 AI 读作业原文与内嵌图、读 SDK 的 `.d.ts` 类型定义（而非猜测消息形状），再写映射代码 —— 避免了大量返工。
- **小步验证**：每个里程碑用 `tsc --noEmit` + 冒烟脚本（curl 建任务→轮询快照→SSE 重放）+ 浏览器实测三件套验收，问题当场暴露。
- **让 AI 记录可复用经验**：如"Qoder 与 QoderCN 是编译期双品牌、包不可混用"这类踩坑，沉淀为经验避免重复。

### 2.3 AI 协作中踩过的坑（真实记录）

| 坑 | 根因 | 解法 |
|---|---|---|
| better-sqlite3 编译失败 | Node 26 下 node-gyp 报 V8_DEPRECATED | 改用 Node 内置 `node:sqlite`（`DatabaseSync`） |
| "No qodercli login found" | IDE 登录态 ≠ CLI 登录态；且全球版包读 `~/.qoder` | 用对应品牌 CLI 完成一次 `login` |
| Qoder 全球版无额度 | 账号额度在 QoderCN | 换 `@qodercn-ai/qodercn-agent-sdk`（品牌是编译期常量，运行时 env 切不了） |
| SDK 返回泛化错误 | 默认 Worker 运行时在本环境不稳 | 显式 `pathToQoderCLIExecutable` 指向 bundled CLI（process transport） |
| 模板串里 `\n` 被写成真实换行 | 生成代码时转义丢失 | 抽 `const NL='\n'` 显式拼接 |

### 2.4 复现本项目的 AI 用法

若要在此基础上继续用 AI 迭代，建议的 prompt 骨架：

- 改后端事件映射：「读 `lib/provider.ts` 与 SDK 的 `types/messages.d.ts`，把 `<某类 SDK 消息>` 映射成 `<某内部事件>`，保持 reducer 与类型同步。」
- 加画布节点类型：「在 `components/StepNode.tsx` 增加一种节点，并在 `CanvasView.tsx` 的 DAG 派生逻辑里接上，状态色沿用现有 CSS 变量。」
- 加接口：「在 `app/api/tasks/[id]/` 下新增 route，事件先 `appendEvent` 落库再 `publish`，遵循现有 SSE 去重协议。」

---

## 三、演示脚本建议（录制演示视频时）

1. 打开首页 → 输入一个真实科研任务 → 展示流式正文与步骤实时出现。
2. 切到「任务画布」→ 展示 DAG 节点随执行变色（等待→执行中→成功）。
3. 展示右栏产物文件（`data.csv` / `report.md`）与轨迹详情。
4. 运行中点「取消」→ 展示真 `interrupt`（status→cancelled）。
5. 刷新页面 → 展示事件溯源刷新恢复（画面与刷新前一致）。
6. 点「重试」→ 展示同任务追加历史重跑。
7. 切「编排计划」→ 拖拽/连线构造计划 → 「按此计划执行」→ 展示计划注入真实 Agent。
