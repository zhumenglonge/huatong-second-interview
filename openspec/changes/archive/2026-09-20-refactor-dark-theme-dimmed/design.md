# Design

## Context

See proposal.md for motivation. 当前暗色主题定义在 `app/globals.css` 的 `:root[data-theme='dark']` 块中（30 个变量）。亮色主题在同一文件 `:root` 块定义。Skill Hub 页面（`/skills`）的 CSS 从第 1786 行开始，使用了大量独立于变量体系的硬编码色值。

## Goals / Non-Goals

**Goals:**
- 暗色主题整体切换为 GitHub Dark Dimmed 配色体系
- 确保色弱用户可辨：层次靠明度、状态靠色相+明度双重区分
- 消除所有硬编码色值，统一到 CSS 变量体系
- 改动透明：亮色主题零影响

**Non-Goals:**
- 不改变组件结构或 CSS 类名
- 不引入 CSS-in-JS 或 Tailwind
- 不调整亮色主题配色
- 不新增主题切换机制（已有 data-theme 属性方案）

## Decisions

### 1. 调色板选取：GitHub Dark Dimmed 直接映射

**选择**：采用 GitHub Dark Dimmed 的色值体系，而非自建或混用多主题。

**理由**：经过 GitHub 全站验证、文档公开、明度阶梯设计成熟（canvas/inset/overlay/subtle/emphasis 五级）。自研调色板需要反复对比度测试，直接复用降低风险。

**替代方案**：Catppuccin Mocha（紫底，长时间阅读舒适但工具感弱）；One Dark（明度阶梯仅 3%，色弱分辨仍偏紧）。

### 2. Accent 从黄绿改为蓝

**选择**：`--accent` 在暗色模式下使用 `#539bf5`（蓝色），覆盖亮色模式的 `#d8ec4f`（黄绿）。

**理由**：蓝色在几乎所有色盲类型下可辨。当前黄绿 accent 对 deuteranopia 呈现为亮黄色，与 amber/warning 色冲突。两主题可使用不同 accent 色。

### 3. 新增辅助变量覆盖 Skill Hub

**选择**：在 `:root` 和 `:root[data-theme='dark']` 中新增 `--card-bg`、`--card-border`、`--card-border-hover`、`--chip-bg`、`--chip-border` 五个变量，Skill Hub 和附件标签的硬编码值替换为这些变量。

**理由**：Skill Hub 卡片有独立于 panel 的背景需求（略浅于 panel 的"卡片感"），不能直接复用 `--surface`。抽象为语义变量后，两套主题各自定义，未来加新页面不再重复硬编码。

### 4. 状态色新增暗色覆盖

**选择**：在 `:root[data-theme='dark']` 中覆盖 `--ok`、`--run`、`--fail`、`--wait`、`--cancel`。

**理由**：这些变量此前仅在 `:root` 定义一次，暗色模式下直接从亮色继承。亮色饱和度在暗底上对比不足；GitHub Dark Dimmed 对这四个状态有专门调校的色值。

## Risks / Trade-offs

- **视觉冲击**：用户习惯现有暗色调，切换后感受明显 → 一次性变更，不提供过渡选项；亮色保持不动作为对照
- **新增变量命名冲突**：`--card-bg` 等通用名可能与未来组件冲突 → 使用前缀 `--surface-card` 更明确（最终在实现时确认命名）
- **Skill Hub 页面独立 CSS 块较散**：硬编码分布在 5-6 个选择器中 → 通过 grep 十六进制值模式确保不遗漏
