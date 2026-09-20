# Spec Delta

## Purpose

为项目提供一个离线、可版本控制且可被产品界面消费的本地技能注册表，使业务 Skill 以明确的目录和文档契约存在，而不再散落在组件硬编码中。

## ADDED Requirements

### Requirement: Local skills use a discoverable directory contract

The system MUST discover business skills from the project-level `skills/` directory, where each skill is stored in a directory identified by a stable skill id and contains a `skill.md` definition file.

#### Scenario: Discover a valid skill

- **WHEN** the application reads the local skill registry
- **THEN** it returns the skill id, display name, description, category, source metadata, and instruction content from each valid `skills/<skill-id>/skill.md`

#### Scenario: Ignore unrelated workflow skills

- **WHEN** the registry scans project files
- **THEN** skills under `.agents/skills/` are not exposed as user-facing business skills unless explicitly registered under `skills/`

### Requirement: Invalid skill definitions are reported safely

The system MUST validate required skill metadata and MUST report invalid definitions without preventing valid skills from appearing.

#### Scenario: One malformed skill exists

- **WHEN** a skill definition is missing a required identifier or readable instruction body
- **THEN** the registry marks that skill as invalid with a human-readable error and continues returning other valid skills

### Requirement: Skill enablement is persisted locally

The system MUST persist enabled or disabled state by stable skill id and MUST default newly discovered skills to disabled unless their definition explicitly declares an enabled default.

#### Scenario: Toggle a skill

- **WHEN** a user changes a skill's enabled state
- **THEN** the next registry read returns the updated state after a page reload or server restart

#### Scenario: Skill is removed from disk

- **WHEN** a previously enabled skill no longer exists in `skills/`
- **THEN** its stale enablement state does not cause the removed skill to be loaded into a task
