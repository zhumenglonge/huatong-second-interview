# Tasks

## 1. 变量体系扩展

- [x] 1.1 在 `:root`（亮色）块中新增 `--card-bg: #fffefa`、`--card-border: #dfddd4`、`--card-border-hover: #aabc91`、`--chip-bg: #f8f6ef`、`--chip-border: #d6d2c6` 五个语义变量，供 Skill Hub 和附件标签使用；亮色模式下视觉无变化

- [x] 1.2 在 `:root[data-theme='dark']` 块中为上述五个变量赋予暗色值（`--card-bg: #2d333b`、`--card-border: #444c56`、`--card-border-hover: #539bf5`、`--chip-bg: #373e47`、`--chip-border: #444c56`）

## 2. 暗色主题变量块替换

- [x] 2.1 将 `:root[data-theme='dark']` 中的层级变量替换为 GitHub Dark Dimmed 值：`--bg:#22272e`、`--panel:#2d333b`、`--surface:#2d333b`、`--surface-subtle:#373e47`、`--surface-muted:#444c56`、`--input-bg:#22272e`、`--popover-bg:#2d333b`、`--canvas-bg:#1c2128`、`--line:#444c56`

- [x] 2.2 替换文本变量为中性灰：`--ink:#adbac7`、`--muted:#768390`、`--text-secondary:#8b949e`、`--text-placeholder:#636e7b`；确认饱和度 ≤15%、无明显色偏

- [x] 2.3 替换 accent/link/selection 变量：`--accent:#539bf5`、`--accent-ink:#0c2d6b`、`--link:#539bf5`、`--selection-bg:#334252`、`--code-bg:#1c2128`、`--tint-accent:#121d2b`、`--on-ink:#22272e`、`--task-hover-bg:#373e47`

- [x] 2.4 替换遮罩和状态背景变量：`--overlay:rgb(1 4 9 / 70%)`、`--shadow-color:0 0 0`、`--status-pending:#636e7b`、`--status-success-bg:#12261e`、`--status-fail-bg:#2d1b1e`、`--status-wait-bg:#2a2011`、`--status-info-bg:#121d2b`

- [x] 2.5 在暗色块中新增状态色覆盖：`--ok:#56d364`、`--run:#539bf5`、`--fail:#e5534b`、`--wait:#d29922`、`--cancel:#768390`

## 3. Skill Hub 硬编码消除

- [x] 3.1 将 `.skill-shell` 的 `background: #f7f6f1` 替换为 `background: var(--bg)`；`.skill-kicker` 的 `color: #6d8052` 替换为 `color: var(--accent)`

- [x] 3.2 将 `.skill-search` 的 `border: 1px solid #d8d5ca; background: #fff` 替换为 `border: 1px solid var(--line); background: var(--input-bg)`

- [x] 3.3 将 `.skill-filters button` 的 `border: 1px solid #d8d5ca` 替换为 `border: 1px solid var(--line)`；`.active/.hover` 的 `border-color: #839968; background: #e8eedf; color: #4e633a` 替换为 `border-color: var(--accent); background: var(--tint-accent); color: var(--accent)`

- [x] 3.4 将 `.skill-card` 的 `border: 1px solid #dfddd4; background: #fffefa` 替换为 `border: 1px solid var(--card-border); background: var(--card-bg)`；hover 的 `border-color: #aabc91; box-shadow` 替换为 `border-color: var(--card-border-hover)` 配合 `color-mix` 阴影

- [x] 3.5 将 `.skill-card-icon` 的 `background: #e7eedb; color: #607846` 替换为 `background: var(--tint-accent); color: var(--accent)`；`.skill-card-meta .valid` 的 `color: #5e7c43` 替换为 `color: var(--ok)`；`.invalid-label` 的 `color: #ad6049` 替换为 `color: var(--fail)`

- [x] 3.6 将 `.skill-toggle` 的 `background: #d4d2ca` 替换为 `background: var(--surface-muted)`；`.on` 的 `background: #7d9a5b` 替换为 `background: var(--accent)`；`.skill-toggle span` 的 `background: white` 替换为 `background: var(--input-bg)`

- [x] 3.7 将 `.skill-detail` 的 `background: #fffefa` 替换为 `background: var(--card-bg)`；`.skill-detail pre` 的 `background: #f5f4ee; color: #56554e` 替换为 `background: var(--code-bg); color: var(--text-secondary)`；`.skill-detail-category` 和 `.skill-detail-state` 的硬编码绿色替换为 `var(--accent)`

- [x] 3.8 将 `.skill-error` 的 `border: #e4c8bd; background: #fff5f0; color: #9b513d` 替换为 `border: color-mix(in srgb, var(--fail) 35%, transparent); background: var(--status-fail-bg); color: var(--fail)`

## 4. 附件与零散硬编码消除

- [x] 4.1 将 `.user-attachments span` 的 `border: 1px solid #d6d2c6; background: #f8f6ef` 替换为 `border: 1px solid var(--chip-border); background: var(--chip-bg)`

- [x] 4.2 将 `.artifact-action:hover` 的 `background: #eceae2` 替换为 `background: var(--surface-muted)`

- [x] 4.3 将 `.skill-card.invalid` 的 `background: #fcf8f5; border-color: #e6cfc5` 替换为 `background: var(--status-fail-bg); border-color: color-mix(in srgb, var(--fail) 30%, var(--line))`

## 5. 验证

- [ ] 5.1 切换 `data-theme="dark"` 后，在浏览器中逐页检查：工作台主界面、Skill Hub (`/skills`)、任务总览、对话区。确认无残留亮白区域，层次分明可辨

- [x] 5.2 运行现有测试套件 `npx vitest run` 确认无 CSS 相关回归

- [ ] 5.3 使用 macOS 辅助功能 > 显示过滤 > 颜色滤镜（红绿色弱模拟）验证暗色模式下四种状态圆点和文本可区分
