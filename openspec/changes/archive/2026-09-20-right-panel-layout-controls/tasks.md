# Tasks

## 1. Layout state and component contracts

- [x] 1.1 Add page-level right-panel visibility state with all four modules disabled by default, derive whether the panel occupies layout space, and verify the initial render has no right panel and an expanded main area.
- [x] 1.2 Define the layout configuration data and callbacks shared by the page, center header, and `RightPanel`, keeping module visibility separate from module content open/collapsed state; verify TypeScript typechecking passes.

## 2. Layout configuration UI

- [x] 2.1 Add the center-header “布局” button with accessible expanded/collapsed semantics and a popover matching the reference layout configuration; verify keyboard focus and accessible names in component tests.
- [x] 2.2 Add immediate switches for 待办、结果、计算、笔记 that update shared visibility state without an apply step; verify each switch changes the corresponding module immediately.
- [x] 2.3 Remove the bottom restore bar as the primary control and ensure closing the popover does not reset selected module switches; verify no duplicate restore controls remain.

## 3. Right-panel rendering and responsive layout

- [x] 3.1 Update `RightPanel` to render only selected modules and to collapse to zero layout width when none are selected, while retaining the saved resizable width when reopened; verify the main area expands when the final module is disabled.
- [x] 3.2 Preserve module content open/collapsed state and existing task/artifact/compute/note rendering while visibility changes; verify reopening a module restores its prior content state.
- [x] 3.3 Add CSS transitions, focus styles, responsive constraints, and switch visuals consistent with the existing design tokens; verify desktop and narrow viewport layouts do not overflow.

## 4. Verification

- [x] 4.1 Add/extend tests for default-hidden state, opening the first module, closing the last module, independent module switches, accessibility labels, and panel-width persistence; verify `npm test` passes.
- [x] 4.2 Run `npm run typecheck` and manually verify the reference flow: open 布局, toggle a module and see the right panel appear immediately, then toggle all modules off and see the center area reclaim the width.
