# Proposal

## Why

当前暗色主题使用橄榄绿色调贯穿所有层级，导致：(1) 层次区分依赖色相明暗而非明度阶梯，对色弱用户几乎不可辨；(2) 状态色（绿/红/橙）在暗底上饱和度不足且色相集中，色弱下呈现相同土黄色；(3) Skill Hub 等页面存在约 11 处硬编码亮色值，暗色模式下完全不响应主题切换，造成"白一块黑一块"。用户已明确：品牌一致性不是约束，目标是"看着通透舒服"。

## What Changes

- 将 `:root[data-theme='dark']` 整块 CSS 变量替换为 GitHub Dark Dimmed 体系：中性冷灰明度阶梯 + 蓝色 accent + 色相/明度双重区分的状态色
- 为暗色模式补充 `--ok`、`--run`、`--fail`、`--wait`、`--cancel` 的覆盖值（当前从亮色继承）
- 新增 `--card-bg`、`--card-border` 等辅助变量供 Skill Hub 等组件使用
- 将 `app/globals.css` 中 Skill Hub / user-attachments / artifact-action 区域的硬编码色值全部替换为 CSS 变量引用
- 亮色主题不受影响

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `ui-localization-and-theme`: 在"用户可以切换浅色和深色主题"需求下新增暗色主题的配色体系约束——明度阶梯 ≥4%、中性灰无色调基底、状态色须色相+明度双重区分以保障色弱可辨性、所有页面区域（含 Skill Hub）的暗色模式必须通过 CSS 变量响应主题切换

## Impact

- `app/globals.css`: 暗色变量块整体替换 + ~11 处硬编码 → var() 引用
- 无 API / 数据模型 / 组件逻辑变更
- 纯 CSS 改动，零运行时开销
- 视觉回归：所有页面组件在暗色模式下外观变化，但不影响功能行为
