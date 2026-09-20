# Tasks

## 1. Local registry and persistence

- [x] 1.1 Define the `skills/<skill-id>/skill.md` metadata and instruction contract, add 2–3 representative biomedical skill definitions, and verify valid files are discoverable while `.agents/skills/` remains excluded.
- [x] 1.2 Implement a server-side skill registry parser with front matter validation, bounded content loading, path traversal protection, per-skill errors, and safe handling for malformed, oversized, and missing definitions.
- [x] 1.3 Add local SQLite persistence for skill enablement overrides and verify toggles survive reload/server restart while removed skills are never loaded.

## 2. Skill API and Skill Hub

- [x] 2.1 Add `/api/skills` read/detail endpoints that return registry data, validation state, enabled state, and safe error responses.
- [x] 2.2 Add the enable/disable mutation endpoint with id validation and verify invalid skills cannot be enabled and valid changes persist.
- [x] 2.3 Create the `/skills` page and Skill Hub UI with search, source/category filters, detail view, validation errors, empty/loading states, and real enable switches.
- [x] 2.4 Wire the icon rail “中心” control to `/skills`, active-state styling, and back navigation; verify clicking it navigates successfully.

## 3. Agent integration

- [x] 3.1 Replace the hardcoded composer skill catalog with registry-backed data and verify `@` selection uses the same API data as Skill Hub.
- [x] 3.2 Resolve enabled valid skills into a bounded task-start snapshot, inject their instructions into the Qoder provider context, and exclude disabled/invalid/unreadable skills with warnings.
- [x] 3.3 Persist and expose applied skill ids in task plan metadata or execution traces, and verify a task records the skills loaded at its start.

## 4. Documentation and integration verification

- [x] 4.1 Update `analysis.md` to describe the real local `skills/` registry, Skill Hub behavior, Skill-versus-Agent boundary, and runtime loading flow; verify the old static-stub wording is removed.
- [x] 4.2 Verify the integrated build path from filesystem skill discovery through Skill Hub and Agent context loading, then run `npm test`, `npm run typecheck`, and `npm run build` successfully.
