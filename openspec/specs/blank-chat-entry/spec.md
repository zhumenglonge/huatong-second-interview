# blank-chat-entry Specification

## Purpose

提供一个稳定、明确的项目级入口，让用户无需先选择或删除已有任务，就能开始新的问题。

## Requirements

### Requirement: Rail-logo 开始空白问答会话

系统 SHALL 将 rail-logo 暴露为可访问控件；用户激活该控件后，系统必须开始一个空白问答会话。

#### Scenario: 从已有任务开始空白会话

- **WHEN** 用户在已有任务被选中时激活 rail-logo
- **THEN** 系统取消选中该任务，清空会话块和任务相关结果状态，并使输入框准备好接收新问题

#### Scenario: 从任务画布开始空白会话

- **WHEN** 用户在任务画布可见时激活 rail-logo
- **THEN** 应用切换到会话流视图，并展示空白会话输入框

#### Scenario: 保留已有任务历史

- **WHEN** 用户激活 rail-logo
- **THEN** 之前创建的任务仍保留在任务列表中并可重新打开，且不会因此删除或取消任何任务

#### Scenario: 支持键盘激活

- **WHEN** 键盘用户聚焦 rail-logo 并按下控件的激活键
- **THEN** 系统执行与鼠标激活相同的空白会话切换
