# Design

## Context

See `proposal.md` for the motivation and user-facing scope. The current app is a Next.js App Router application with a real QoderCN Agent backend, SQLite persistence, and a client-side `InputBar` that keeps a small hardcoded skill list. `IconRail` currently renders the “中心” item without a click handler, and there is no `/skills` route.

The repository already contains `.agents/skills/`, but those files describe OpenSpec workflow skills for the development environment. They are not the product's business skills and must remain outside the user-facing registry.

## Goals / Non-Goals

**Goals:**

- Define a version-controlled `skills/` directory contract with one `skill.md` per business skill.
- Provide a server-side registry service and API for listing, validating, reading, and toggling local skills.
- Add a real `/skills` page and wire the icon rail to it.
- Make task creation load a bounded snapshot of enabled, valid skill instructions and record applied skill ids.
- Keep the implementation offline-first and compatible with the existing SQLite/SSE/task architecture.

**Non-Goals:**

- Do not expose `.agents/skills/` in the product UI.
- Do not implement a remote Biomni marketplace, team sharing, authentication, or skill publishing workflow.
- Do not replace the QoderCN Agent or turn skills into independent agents.
- Do not allow arbitrary skill files to execute code merely by being enabled; this change only supplies instructions and metadata to the existing Agent runtime.

## Decisions

### 1. Filesystem registry is the source of truth for definitions

Use `skills/<skill-id>/skill.md` for definitions because the project needs offline operation, code review, and easy versioning. A database-only registry would make skill content harder to review and would duplicate the existing repository workflow. The database or a small local state file stores only user-managed enablement overrides.

### 2. Parse a constrained front matter contract

Each `skill.md` contains stable id/name/description/category/source metadata and a markdown instruction body. The registry parser validates required fields, normalizes ids, limits content size, and returns per-skill errors. One malformed skill must not hide valid skills.

### 3. Add a server API boundary

Expose read and mutation operations through `/api/skills` (list, detail, and enablement update). The browser never reads the filesystem directly. The API owns validation, path traversal protection, stale-state cleanup, and consistent error responses.

### 4. Store enablement separately from skill content

Persist overrides keyed by skill id in the existing local SQLite database, with a small table or equivalent migration. A newly discovered skill uses its declared default only when no override exists. Removing a directory makes the skill unavailable even if an old override remains.

### 5. Snapshot skills at task start

When a task is created or a follow-up message is sent, resolve enabled valid skills once, include their instruction bodies in the provider system prompt, and persist the applied ids in task metadata/options. A later file edit does not mutate an already-running task, which keeps execution reproducible.

### 6. Keep the composer compatible during migration

The existing `@` skill picker should consume the same registry API/data shape as Skill Hub, or be adapted to use the server-provided list. It must not maintain a second authoritative hardcoded catalog.

## Risks / Trade-offs

- [Risk] Markdown front matter parsing may accept ambiguous values. → Use a small explicit parser/validator and return field-level errors.
- [Risk] A very large skill body can inflate Agent prompts. → Enforce a maximum body size and report oversized definitions as invalid.
- [Risk] Enablement state can outlive a deleted skill. → Filter stale overrides during registry reads and never load missing ids.
- [Risk] Skill instructions are trusted repository content but can still steer Agent behavior. → Limit loading to the project `skills/` root, show source/validation state, and record applied ids for auditability.
- [Risk] Existing tasks may pass old hardcoded skill ids. → Preserve backward-compatible ids while migrating the composer and provider to registry resolution; unresolved legacy ids become explicit warnings.

## Migration Plan

1. Add the registry parser, initial `skills/` examples, and persistence migration without changing existing task execution.
2. Add API routes and the `/skills` page; wire the icon rail and replace the composer catalog with API data.
3. Update task/provider integration to load enabled skill snapshots and record applied ids.
4. Update `analysis.md` and add tests for discovery, validation, toggling, route behavior, and Agent context loading.

Rollback is file-based: disable the new route/consumer and retain the existing task APIs; registry definitions can be removed without affecting task records. The enablement table can remain unused because it is additive.

## Open Questions

None that change the agreed scope or requirements. Exact front matter parser implementation and UI component decomposition can be chosen during implementation.
