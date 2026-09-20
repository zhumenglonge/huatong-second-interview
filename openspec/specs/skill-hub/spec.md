# Skill Hub

## Purpose

为图标栏“中心”提供真实可访问的 Skill Hub 页面，让用户能够发现、筛选、查看并管理项目本地技能，而不是点击后无响应或看到不可操作的静态列表。

## Requirements

### Requirement: Center opens the Skill Hub

The system MUST make the icon rail's “中心” control navigate to `/skills` and MUST visibly identify the Skill Hub as the active destination.

#### Scenario: Open Skill Hub

- **WHEN** the user clicks “中心”
- **THEN** the application navigates to `/skills` and renders the local skill list

### Requirement: Skill Hub displays real registry data

The Skill Hub MUST render skills returned by the local registry, including name, description, category, source, validation state, and enabled state.

#### Scenario: Registry changes are reflected

- **WHEN** a valid skill is added or its metadata changes on disk and the list is refreshed
- **THEN** the Skill Hub displays the updated registry data without requiring hardcoded UI changes

### Requirement: Users can search and filter skills

The Skill Hub MUST support searching by skill id, name, and description and filtering by available source or category values.

#### Scenario: Search narrows results

- **WHEN** the user enters a search term
- **THEN** only matching skills remain visible and a no-results state is shown when none match

### Requirement: Users can inspect and toggle a skill

The Skill Hub MUST provide a skill detail view and a real enable/disable control backed by the local registry.

#### Scenario: Enable a valid skill

- **WHEN** the user enables a valid skill
- **THEN** its persisted state becomes enabled and the UI confirms the change

#### Scenario: Invalid skill cannot be enabled

- **WHEN** the user views an invalid skill
- **THEN** the UI shows its validation error and prevents enabling it
