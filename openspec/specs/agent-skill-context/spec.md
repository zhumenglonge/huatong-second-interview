# Agent Skill Context

## Purpose

建立 Skill 与 Agent 的运行时边界：Skill 提供可复用的领域指令和约束，Agent 继续负责规划、工具调用和文件产出，且任务只加载当时已启用的有效技能。

## Requirements

### Requirement: Tasks load enabled local skills

The system MUST load the current project's enabled and valid local skill definitions when constructing an Agent task context.

#### Scenario: Enabled skill affects a new task

- **WHEN** a user creates a task while a valid skill is enabled
- **THEN** the Agent context contains that skill's instructions and stable id

#### Scenario: Disabled skill is excluded

- **WHEN** a skill is disabled before task creation
- **THEN** its instructions are not included in the task context

### Requirement: Skill loading is bounded and observable

The system MUST handle unreadable or oversized skill content safely and MUST expose which skills were loaded for a task without exposing unrelated registry files.

#### Scenario: Skill cannot be read at task start

- **WHEN** an enabled skill becomes unreadable before the task starts
- **THEN** the task starts without that skill and records a clear loading warning rather than failing the entire task

#### Scenario: Task records applied skills

- **WHEN** a task is created with enabled skills
- **THEN** its task metadata or execution trace identifies the applied skill ids
