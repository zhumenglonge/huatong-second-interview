# UI 对齐 Biomni 改造方案（Review 稿）

> 目标：让本地原型的**视觉与布局**贴近 Biomni 真身（基于 2026-09-19 对 `sess_af4b00031712` 的 DOM 实测）。
> 约束：**任务画布（CanvasView / StepNode / .canvas-* / .rf-*）完全不动**——这是本项目的差异化创新。
> 原则：数据层（lib/*、app/api/*）零改动，只动表现层。

---

## 1. 现状 vs Biomni 差距总表

| # | 维度 | 本地现状 | Biomni 真身（实测） | 差距 |
|---|---|---|---|---|
| 1 | CSS 方案 | 手写 `globals.css` 409 行 + 自定义 CSS 变量（`--bg/--panel/--line/--ink/--accent`） | Tailwind utility-first + shadcn 设计令牌（`bg-background/text-muted-foreground/bg-sidebar/border-border`） | ★★★ |
| 2 | 图标 | emoji（📄） | **lucide-react**（页面 63 处：`folder-open/blocks/circle-help/chevron-down/panel-left`…） | ★★★ |
| 3 | 布局列数 | 3 列 grid `240px 1fr 300px` | **4 区**：60px 图标栏 + 320px 侧栏 + 714px 聊天 + **8px 拖拽条** + 368px 右栏 | ★★★ |
| 4 | 顶栏 | 无统一顶栏（每列各自 `.col-head`） | **56px 统一顶栏**：面包屑 `Quick Tasks / 任务名` + 分享 + Transfer + 布局(dropdown) + 运行计时 | ★★★ |
| 5 | 右侧面板 | 2 个固定 section（待办/步骤、结果文件） | **4 个可折叠卡**（待办/结果/计算/笔记），每卡独立 `关闭` 按钮 | ★★ |
| 6 | 拖拽调宽 | 无 | chat ↔ 右栏之间 `w-2 cursor-col-resize hover:bg-primary/50` | ★★ |
| 7 | 侧栏结构 | 平铺任务列表 + `+ 新建` | 项目切换器（PROJECT 选择项目）+ 任务区（带 `等待输入` badge 计数）+ 云盘区（No files yet） | ★★ |
| 8 | 输入区 | `<textarea>` + 状态徽章 + 重试/取消/发送 | `contenteditable` 富文本 + `composer-stack-region` + `unified-add-trigger`（文件/文件夹）+ `自动` Switch + `model-profile-selector`（Standard）+ Send + `rotating-tip` | ★★★ |
| 9 | 消息块 | `BlockView` switch 6 种（user/agent_text/step/trace/artifact/error） | `user-message` 右对齐 bubble + `streaming-text-root` 打字机 + `prompt-actions`（重试/Copy）+ `Show traces` 折叠 | ★★ |
| 10 | 计划卡片 | `Block.kind='plan'` 类型已定义但 **BlockView 未渲染** | 计划文档卡（prose 渲染）+ `Approved` 状态标 | ★★ |
| 11 | 澄清卡片 | 无 | 结构化多问表单（4 问 × 选项组 × Other × 单个 Submit） | ★★ |
| 12 | 状态徽章 | `.badge.xxx` 自定义圆角框 | shadcn pill（`rounded-full border-2`） | ★ |
| 13 | 过渡动画 | 无 | `transition-all duration-300 ease-in-out`（侧栏折叠）、`transition-[padding]`（主区让位） | ★ |
| 14 | 主题色 | 米色底 `#f6f5f0` + 橄榄绿 accent `#d8ec4f` | 暖灰 neutral（`--muted: #77746a`）+ `theme-classic light` | ★★ |
| 15 | 字体 | 系统栈（已对齐） | 系统栈（一致） | ✓ |
| 16 | 空态文案 | "暂无任务/暂无步骤/暂无产物" | "暂无待办列表 / 多步骤任务会显示待办项"、"暂无结果 / 文件将显示在此处" | ★ |
| 17 | 画布 | React Flow（自有创新） | **无** | 保留不动 |

---

## 2. 技术方案选型

| 方案 | 内容 | 优点 | 缺点 | 推荐度 |
|---|---|---|---|---|
| A. 纯 CSS 模拟 | 不加依赖，重写 `globals.css` 模仿 Biomni 视觉 | 零依赖、改动集中 | 难匹配 utility-first 风格；hover/focus/响应式全手写；后续维护成本高 | ⭐⭐ |
| **B. Tailwind + lucide-react + 手写 shadcn 风格组件** | 加 `tailwindcss/postcss/autoprefixer/lucide-react/clsx`，组件用手写 useState 实现 dropdown/collapsible/switch | 视觉最贴近；依赖可控（5 个）；代码可读；与 Biomni 同栈 | 需要配置 Tailwind；现有 CSS 需逐步迁移 | ⭐⭐⭐⭐⭐ |
| C. 全量 shadcn/ui | `npx shadcn@latest init` + `add button card switch dropdown-menu collapsible…` | 100% 一致 | CLI 生成大量文件；引入 Radix 全家桶（10+ 包）；作业项目偏重 | ⭐⭐⭐ |

**推荐方案 B**。新增依赖清单：

```jsonc
// dependencies
"lucide-react": "^0.4xx",
"clsx": "^2.1",
// devDependencies
"tailwindcss": "^3.4",
"postcss": "^8.4",
"autoprefixer": "^10.4"
```

> 不引入 Radix UI：dropdown/collapsible/switch 用手写 `useState` + Tailwind 实现，减少依赖体积，作业演示足够。

---

## 3. 分阶段改造计划

### Phase 1 — 基础设施（不影响现有功能，可独立验证）

| 任务 | 文件 | 说明 |
|---|---|---|
| 安装依赖 | `package.json` | tailwindcss/postcss/autoprefixer/lucide-react/clsx |
| Tailwind 配置 | `tailwind.config.ts`（新建） | content 指向 `app/**` `components/**`；theme.extend 注入 shadcn 风格 CSS 变量（`background/foreground/muted/border/primary/sidebar/accent/ring/radius`） |
| PostCSS 配置 | `postcss.config.mjs`（新建） | tailwindcss + autoprefixer |
| 重写 globals.css | `app/globals.css` | 顶部加 `@tailwind base/components/utilities`；CSS 变量改为 shadcn 命名；**保留 `.canvas-*` 和 `.rf-*` 段原样不动** |
| 工具函数 | `lib/cn.ts`（新建） | `export const cn = (...args) => twMerge(clsx(args))`（或简化版不引 tailwind-merge） |

**验收**：`npm run dev` 正常，现有页面视觉不变（Tailwind 与旧 CSS 共存）。

### Phase 2 — 布局骨架重构（核心）

| 任务 | 文件 | 说明 |
|---|---|---|
| 图标栏 | `components/IconRail.tsx`（新建） | 60px 宽，`bg-sidebar border-r`，垂直排列：项目(FolderOpen)/中心(Blocks)/帮助(CircleHelp)/账号头像；底部账号 |
| 侧栏重构 | `components/TaskList.tsx` → 重写 | 320px：顶部项目切换器（大按钮）+ 任务区（header 带 `等待输入` badge + Collapse/搜索/查看全部）+ 云盘区（空态 No files yet）；任务项显示 time-ago |
| 顶栏 | `components/TopHeader.tsx`（新建） | 56px：面包屑 `Quick Tasks / {task.title}` + 分享按钮 + 布局 dropdown（手写 popover：折叠侧栏/折叠右栏/紧凑模式）+ 运行计时 `task-runtime-readout` |
| 右栏重构 | `components/RightPanel.tsx` → 重写 | 4 个 CollapsibleCard（待办/结果/计算/笔记）；每卡 header 带图标 + 标题 + 关闭按钮；计算/笔记为空态 stub |
| 拖拽条 | `components/ResizableSplitter.tsx`（新建） | 8px `cursor-col-resize hover:bg-primary/50`；拖拽改右栏宽度，存 localStorage |
| 页面 shell | `app/page.tsx` → 重写 | 新结构：`<IconRail/> <Sidebar/> <main> <TopHeader/> {conv|canvas} <InputBar/> </main> <ResizableSplitter/> <RightPanel/>`；**画布分支 `<CanvasView/>` 原样保留** |

**验收**：四区布局成型，画布 tab 切换正常，现有任务流不回归。

### Phase 3 — 组件精细化

| 任务 | 文件 | 说明 |
|---|---|---|
| UI 原语 | `components/ui/Button.tsx` `Card.tsx` `Switch.tsx` `Dropdown.tsx` `Collapsible.tsx`（新建） | 手写 shadcn 风格（Tailwind class 对齐 Biomni：`rounded-md ring-offset-background focus-visible:ring-2`…） |
| 输入区重构 | `components/InputBar.tsx` → 重写 | `composer-stack-region`（附件预览条）+ textarea（保留，不强制 contenteditable）+ `unified-add-trigger`（Paperclip 图标，触发 file input）+ `自动` Switch + `model-profile-selector`（Standard/Max 档位，UI-only）+ Send 图标按钮 + `rotating-tip`（底部轮换提示） |
| 消息块重构 | `components/BlockView.tsx` → 重写 | user：右对齐 `bg-muted` bubble + `data-testid="user-message"`；agent_text：`prose` 渲染 + `streaming-text-root`；trace：`Show traces` 折叠（ChevronDown 图标）；step：dot + 名称；artifact：FileText 图标 + 名称 + 大小；error：红色框 |
| 消息操作条 | `components/PromptActions.tsx`（新建） | agent 消息底部：重试(RotateCw) + Copy(Copy) 图标按钮，`data-testid="prompt-actions"` |
| 计划卡片 | `components/PlanCard.tsx`（新建） | 渲染 `Block.kind='plan'`：prose 文档 + `Approved` 徽章（UI-only，后端已有 plan 类型） |
| 状态徽章 | `components/StatusBadge.tsx` → 重写 | shadcn pill：`rounded-full border px-2 py-0.5 text-xs`；颜色走 CSS 变量 |
| 澄清卡片 | `components/ClarificationCard.tsx`（新建，**可选**） | 结构化多问表单；**依赖后端是否产出 clarification block**——若后端无此类型则仅做 UI 占位，标 P2 |

**验收**：会话流视觉贴近 Biomni 截图；composer 结构完整。

### Phase 4 — 细节打磨

| 任务 | 说明 |
|---|---|
| 过渡动画 | 侧栏折叠 `transition-all duration-300`；主区 `transition-[padding]`；右栏卡片展开 `grid-rows-[0fr]→[1fr]` 技巧 |
| hover/focus | 所有可交互元素加 `hover:bg-accent` `focus-visible:ring-2 ring-ring` |
| 空态文案 | 对齐 Biomni："暂无待办列表 / 多步骤任务会显示待办项"、"暂无结果 / 文件将显示在此处" |
| 计时器 | `task-runtime-readout`：任务 createdAt → now 的 `mm:ss` 实时刷新（setInterval 1s） |
| rotating-tip | 3~5 条提示轮换（"使用顶部分享按钮…"、"Biomni 在云端运行…"），10s 间隔淡入淡出 |
| 主题色微调 | 把本地橄榄绿 accent 换成 Biomni 暖灰 neutral（`--accent` 改为低饱和），保留状态色（ok/run/fail/wait/cancel） |

---

## 4. 文件改动清单汇总

### 新建（11 个）
```
tailwind.config.ts
postcss.config.mjs
lib/cn.ts
components/IconRail.tsx
components/TopHeader.tsx
components/ResizableSplitter.tsx
components/PromptActions.tsx
components/PlanCard.tsx
components/ClarificationCard.tsx        (可选 P2)
components/ui/Button.tsx
components/ui/Card.tsx
components/ui/Switch.tsx
components/ui/Dropdown.tsx
components/ui/Collapsible.tsx
```

### 重写（6 个）
```
app/globals.css          (保留 .canvas-* / .rf-* 段)
app/page.tsx             (新 shell，画布分支不动)
components/TaskList.tsx  (→ 320px 侧栏，含项目切换器+云盘)
components/RightPanel.tsx(→ 4 折叠卡)
components/InputBar.tsx  (→ composer 完整结构)
components/BlockView.tsx (→ prose + bubble + 折叠 trace)
components/StatusBadge.tsx(→ shadcn pill)
```

### 不动（明确保护）
```
components/CanvasView.tsx      ← 画布
components/StepNode.tsx        ← 画布节点
globals.css 中 .canvas-* .rf-* ← 画布样式
lib/*                          ← 数据层
app/api/*                      ← 后端
```

---

## 5. 新 shell 结构（目标 DOM）

```
<div class="flex h-screen bg-background">           ← 外层 flex（替代 grid）
  <IconRail/>                                        ← w-[60px] bg-sidebar border-r
  <Sidebar/>                                         ← w-[320px] 可折叠 transition-all
  <main class="flex-1 flex flex-col min-h-0">        ← 主区
    <TopHeader/>                                     ← h-14 (56px)
    <div class="flex-1 flex min-h-0">                ← 内容行
      <div class="flex-1 flex flex-col min-w-0">     ← 聊天列
        {view==='conv' ? <Conversation/> : <CanvasView/>}   ← 画布原样
        <InputBar/>
      </div>
      <ResizableSplitter/>                           ← w-2 cursor-col-resize
      <RightPanel/>                                  ← w-[368px] 可调
    </div>
  </main>
</div>
```

> 注意：画布 `<CanvasView/>` 仍在聊天列位置渲染，父级 `flex-col min-h-0` 保证其高度撑满——与现有行为一致，无需改画布代码。

---

## 6. 设计令牌映射（globals.css `:root`）

```css
:root {
  /* 对齐 Biomni shadcn 命名 */
  --background: #f6f5f0;      /* 保留本地暖底 */
  --foreground: #1c1b18;
  --sidebar: #efece1;         /* 侧栏略深 */
  --muted: #77746a;           /* 与 Biomni 实测值一致 */
  --muted-foreground: #77746a;
  --border: #e3e0d5;
  --primary: #d8ec4f;         /* 保留本地橄榄绿作 primary（差异化） */
  --primary-foreground: #2c2f05;
  --accent: #f1efe6;
  --ring: #b9b49c;
  --radius: 0.5rem;
  /* 状态色保留 */
  --ok: #2f9e44; --run: #1971c2; --fail: #e03131; --wait: #f08c00; --cancel: #868e96;
}
```

> Tailwind config 里把这些映射成 `bg-background` `text-muted-foreground` 等 utility，与 Biomni class 命名一致。

---

## 7. 风险与回滚

| 风险 | 影响 | 缓解 |
|---|---|---|
| Tailwind preflight 重置样式与旧 CSS 冲突 | Phase 1 后现有页面错位 | Phase 1 先 `corePlugins.preflight: false` 共存，Phase 2 完成后再开 |
| 画布容器高度依赖父级 flex | CanvasView 高度塌陷 | shell 重构时保证 `min-h-0` 链完整；改完立即切画布 tab 验证 |
| 右栏拖拽调宽与画布 minimap 重叠 | 画布 tab 下拖拽条无意义 | 画布 tab 时隐藏 ResizableSplitter，右栏固定宽 |
| lucide-react 体积 | 打包变大 | 用 `import { X } from 'lucide-react'` 按需引入，tree-shaking 生效 |
| 澄清卡片后端无数据 | ClarificationCard 空转 | 标 P2 可选，后端不支持则不渲染 |

**回滚**：每 Phase 一个 git commit；任何 Phase 出问题 `git revert` 即可，数据层零改动保证功能不丢。

---

## 8. 验收标准

- [ ] 四区布局（图标栏 60 / 侧栏 320 / 聊天 flex / 右栏 368 可拖拽）与 Biomni 截图一致
- [ ] 顶栏含面包屑 + 分享 + 布局 dropdown + 运行计时
- [ ] 右栏 4 个可折叠卡（待办/结果/计算/笔记），每卡可独立关闭
- [ ] Composer 含 unified-add + 自动 Switch + model-profile + Send + rotating-tip
- [ ] 消息块：user bubble 右对齐、agent prose、Show traces 折叠、prompt-actions（重试/Copy）
- [ ] lucide-react 图标替换所有 emoji
- [ ] 侧栏折叠 / 右栏卡片展开有 300ms 过渡
- [ ] **画布 tab 功能与视觉完全不变**（重点回归项）
- [ ] 现有任务流（新建/发送/SSE 流式/重试/取消/刷新恢复）无回归
- [ ] `npm run build` + `npm run lint` + `npm run typecheck` 全过

---

## 9. 工作量预估

| Phase | 预估 | 累计 |
|---|---|---|
| Phase 1 基础设施 | 0.5h | 0.5h |
| Phase 2 布局骨架 | 2h | 2.5h |
| Phase 3 组件精细化 | 2.5h | 5h |
| Phase 4 细节打磨 | 1h | 6h |

> 不含 ClarificationCard（P2 可选，+1h）。

---

## 10. 待你确认的决策点

1. **方案选型**：确认走 B（Tailwind + lucide-react，手写 shadcn 风格）？还是想要 A（纯 CSS）/ C（全量 shadcn）？
2. **澄清卡片**：后端 `Block.kind` 目前没有 `clarification` 类型——是 (a) 仅做 UI 占位不接后端，(b) 顺带扩 types + reducer 支持，还是 (c) 本期不做？
3. **主题色**：primary 是 (a) 保留本地橄榄绿 `#d8ec4f` 作差异化，还是 (b) 换成 Biomni 暖灰 neutral 完全对齐？
4. **Transfer / 分享**：这两个是协作功能，本地单用户——是 (a) 做 UI-only 按钮（点击 toast "演示环境不可用"），还是 (b) 直接不渲染？
5. **云盘区**：侧栏云盘是 (a) 空态 stub（No files yet），还是 (b) 接本地文件系统做真实上传？
6. **执行顺序**：按 Phase 1→4 顺序做，每 Phase 完成后停下来给你看？还是一口气做完再 review？

---

*本文档基于 2026-09-19 对 Biomni `sess_af4b00031712` 的 AppleScript DOM 实测数据编写；Biomni 侧证据见对话记录。*
