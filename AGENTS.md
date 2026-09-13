# AI Engineering Rules

This repository is a Customer Support CRM. It began as a time-boxed
three-day assessment; the current target is full original-assignment
coverage (see `specs/constitution.md` "Project Scope & Priorities").

## Spec-Driven Development (SDD) — `specs/` is the canonical spec system

**`specs/` is the single source of truth for current architecture, domain
rules, and feature behavior.** `docs/` is historical/supporting material
only (see `docs/README.md`) and must never override `specs/` or the actual
implementation — if the two disagree, `specs/` + code win and the
disagreement should be reported, not silently resolved in `docs/`'s favor.

Workflow:

1. Read this file (`AGENTS.md`).
2. Read `specs/constitution.md` (stable engineering rules: stack, scope,
   architecture principles, API conventions, validation, localization,
   accessibility/design conventions, testing strategy, definition of done,
   Git/branch rules).
3. Read `specs/architecture.md` (system structure, module/folder
   boundaries, runtime flows, deployment) and `specs/domain-model.md`
   (actors, entities, ticket lifecycle, SLA, ownership rules) for global
   rules.
4. **Feature work starts from the owning spec.** If a
   `specs/features/<name>/spec.md` exists for the capability you're
   touching, read it — it is the authoritative statement of current
   behavior, permissions, edge cases, and known limitations for that
   feature. `specs/features/README.md` has the full feature list and
   explains when a task needs a full spec/plan/tasks package versus when
   it doesn't (most small fixes don't).
5. **Implementation follows `plan.md`** when one exists for the feature —
   it owns architecture/approach, seams to reuse, and testing strategy.
   **Execution and verification are tracked in `tasks.md`** — task IDs,
   status, and concise verification evidence. Do not treat `tasks.md` as a
   session diary.
6. Inspect the current implementation before modifying any code — do not
   implement from memory of a spec alone; specs describe intent and
   audited-as-of-a-date behavior, code is truth for what's actually there
   right now.
7. Implement only the requested scope.
8. Verify changes (typecheck/lint/tests/build as applicable) before
   declaring the task complete — see `specs/constitution.md` "Testing /
   Verification" for the verification-tier vocabulary and the rule against
   claiming unrun verification.
9. **No feature is complete until SDD ownership/status is updated** — when
   behavior intentionally changes, update the owning `spec.md`'s
   Acceptance Criteria (or add a short "Implemented as" note), update
   `tasks.md`'s status, and, if the change is architecturally significant,
   add an entry to `specs/decisions.md`.

Product behavior must not be inferred from historical QA/progress logs
under `docs/` (`19-progress-tracking.md`, `24-final-qa-production-readiness.md`,
`25-fresh-db-browser-qa.md`) — those are point-in-time evidence, not a
live status page; current status lives in `specs/features/README.md`'s
feature coverage matrix and each feature's own `tasks.md`.

The Git Safety Rules below apply identically to SDD work: no commit, push,
merge, rebase, or history rewrite by the AI under any circumstance.

## Mandatory Documentation Preflight

`specs/` is the repository's source of truth for behavior; this preflight
tells you which parts of it to read for a given task.

**Before writing, editing, generating, or deleting any application code, the AI MUST complete the documentation preflight below.**

### Always Read First

For every implementation task, read:

1. `specs/constitution.md`
2. `specs/architecture.md`
3. The owning `specs/features/<name>/spec.md`, if one exists for the task
   (check `specs/features/README.md`'s coverage matrix).

### Progress Tracking Preflight

For every task that may affect implementation or project status, also
check the relevant feature's `specs/features/<name>/tasks.md` (or, for
work with no dedicated feature package, `specs/features/README.md`'s
"Remaining CRM capability areas" section). This includes features, fixes,
refactors, UI/UX, authorization, infrastructure, deployment, and tests that
change project status.

Before implementation, reconcile the spec/tasks status with the actual
repository, current branch, working tree, Git history, implemented code,
automated tests, database checks, and browser or visual evidence.
Repository evidence is authoritative when it conflicts with a spec's
stated status. Report material inconsistencies during the preflight
instead of copying stale status forward.

### Then Read the Relevant Domain Documents

The AI MUST determine the task type and read all applicable documents before touching code.

#### Frontend / UI / UX work

Read:

- `specs/architecture.md` (Frontend Architecture, Module/Folder Boundary
  Conventions)
- `specs/constitution.md` (Accessibility / UI Consistency)
- the owning `specs/features/<name>/spec.md`

Examples:
- Ticket UI -> also read `specs/features/tickets/spec.md` and, when SLA is
  shown, `specs/features/sla-automation/spec.md`.
- Authentication UI -> also read `specs/features/auth-rbac/spec.md`.
- Customer Portal -> also read `specs/features/auth-rbac/spec.md` "Portal
  privacy boundary" and the relevant ticket/customer feature spec.

#### Backend / API work

Read:

- `specs/architecture.md` (Module/Folder Boundary Conventions, Backend
  Architecture)
- `specs/domain-model.md`
- `specs/constitution.md` (API Conventions)
- the owning `specs/features/<name>/spec.md`

#### Authentication / Authorization work

Read:

- `specs/domain-model.md`
- `specs/features/auth-rbac/spec.md`

#### Ticket work

Read:

- `specs/domain-model.md` (Ticket Lifecycle, Ownership/Assignment Rules)
- `specs/features/tickets/spec.md`
- `specs/features/sla-automation/spec.md` when SLA is involved
- `specs/constitution.md` (Accessibility / UI Consistency) when UI is
  affected

#### SLA / Automation work

Read:

- `specs/domain-model.md` (SLA)
- `specs/features/sla-automation/spec.md`
- `specs/features/sla-settings-categories/spec.md` (rule administration)

#### AI feature work

Read:

- `specs/features/ai-assistance/spec.md`
- the ticket/customer feature specs whose data the AI feature consumes

#### Testing work

Read:

- `specs/constitution.md` (Testing / Verification, Definition of Done)
- the spec for the feature under test

#### Deployment work

Read:

- `specs/architecture.md` (Deployment, External Provider Architecture)

### Preflight Output

Before implementation, the AI should briefly state:

```text
Specs reviewed:
- <file>
- <file>
- ...

Feature scope:
- <short summary>

Current branch:
- <branch>

Planned files/areas to change:
- <short list>
```

This is not optional for implementation tasks.

If required specs are missing, inconsistent, or do not define a material behavior:
- DO NOT silently invent a new architecture, dependency, workflow, database model, API contract, role, permission, or visual pattern.
- Prefer the simplest implementation compatible with existing specs only when the decision is minor and reversible.
- Record any meaningful assumption or architectural decision in `specs/decisions.md`.
- If the missing decision would materially change product behavior or architecture, stop implementation and report the conflict instead of guessing.

### Documentation Precedence

If documents conflict, use this order:

1. Explicit current developer/user instruction
2. `AGENTS.md`
3. The owning `specs/features/<name>/spec.md`
4. `specs/domain-model.md` for data/business rules
5. `specs/architecture.md` for system structure and runtime flows
6. `specs/constitution.md` for engineering rules/conventions
7. `docs/` (historical/supporting only — never treat as authoritative over
   the above; see `docs/README.md`)

Do not resolve a meaningful contradiction silently. Report it and update the owning spec when appropriate.

## No-Code-Before-Docs Rule

The AI MUST NOT begin implementation merely from the user prompt when repository documentation exists.

A request such as:

```text
Implement ticket details
```

means:

```text
Read required docs
→ inspect current code and Git state
→ verify branch/scope
→ implement according to docs
→ run checks
→ report changes
→ stop before commit/push
```

It does **not** mean:

```text
Implement from memory or personal preference
→ retrofit documentation later
```

Existing code does not override documented product rules automatically. If existing code and documentation disagree, report the mismatch before expanding the inconsistent pattern.

## Project Progress Reviews

For tasks involving project planning, progress review, roadmap status, feature completion, or deciding what to work on next, read `specs/features/README.md`'s feature coverage matrix and the relevant feature's `tasks.md`. `docs/19-progress-tracking.md` is a historical, non-authoritative session log (see `docs/README.md`) — useful for context on past sessions, never for current status.

Feature/task status is a status summary only and does not override feature or domain specs. Implementation tasks follow the mandatory preflight and synchronization rules in this file.

---

## Git Safety Rules

The AI MUST NOT:
- run `git commit`
- run `git push`
- force push
- merge branches
- rebase shared branches
- delete branches
- create or modify remote tags
- modify Git history

The AI MAY:
- inspect Git state
- show diffs
-  create a local feature/fix/refactor branch when required by the Branch Rule
- stage nothing unless explicitly requested

All commits and pushes are performed manually by the developer.

The AI MUST NOT run destructive working-tree commands without explicit developer approval, including:
- `git reset --hard`
- `git clean`
- `git checkout -- <file>`
- `git restore` when it would discard changes
- `git stash`
- any command that deletes or overwrites uncommitted work

## Branch Rule

Every feature or isolated fix must be implemented on its own branch.

If the current branch is `master` and the task is a feature, isolated fix, refactor, test task, or documentation task that changes repository state, the AI MUST create and switch to the appropriate local branch before modifying any files.

This does not require a separate explicit user instruction.

The AI MUST NOT implement repository changes directly on `master`.

Do not reuse an existing feature branch for an unrelated task.

If already on a branch whose scope does not match the requested task, create a new appropriate branch before implementation.

Do not silently branch from another unfinished feature branch.

Feature branches should normally start from `master` unless the developer explicitly requests a different base branch.

Before creating a new task branch from `master`, verify that the local `master` represents the intended base.

Do not pull, fetch, merge, rebase, or otherwise update `master` automatically unless explicitly requested.

If local `master` appears behind or diverged from its remote-tracking branch, report it before creating the task branch.

Naming convention:

- `feature/<short-feature-name>`
- `fix/<short-fix-name>`
- `refactor/<short-scope-name>`
- `docs/<short-doc-name>`
- `test/<short-test-name>`

Examples:

- `feature/authentication`
- `feature/customer-management`
- `feature/ticket-management`
- `feature/customer-portal`
- `feature/sla`
- `feature/knowledge-base`
- `feature/reports`
- `feature/ai-assistant`

Do not combine unrelated features in one branch.

## Change Control

Do not:
- change the selected stack without approval
- replace libraries because another library is preferred
- rename public API fields without updating the owning spec first
- change database relations without updating `specs/domain-model.md`
- add new ticket statuses without updating `specs/features/tickets/spec.md` and `specs/domain-model.md`
- add new roles or permissions without updating `specs/features/auth-rbac/spec.md`
- introduce production integrations for WhatsApp, SMS, email ingestion, ERP, or external systems unless explicitly requested
- perform large unrelated refactors during feature implementation

### Working Tree Safety

Before creating or switching branches, the AI MUST inspect:
- current branch
- `git status`
- staged changes
- unstaged changes
- untracked files

The AI MUST NOT discard, overwrite, move, stash, reset, or otherwise alter pre-existing developer changes without explicit approval.

If existing changes are unrelated to the requested task and make branch creation or implementation unsafe, STOP and report the conflict.

If existing uncommitted changes clearly belong to the requested task and are currently on `master`, create the required feature branch while preserving those changes, then continue there.

### Dependency Control

Do not add, remove, replace, or upgrade runtime or development dependencies unless:
- the task explicitly requires it, or
- the existing stack cannot reasonably implement the requirement.

If a new dependency is materially required, explain why before adding it.

Do not modify lockfiles unless a dependency change is intentional.

### Database Safety

The AI MUST NOT:
- reset a database
- drop schemas/tables
- delete production or developer data
- run destructive migrations
- run destructive seed scripts
- use `prisma migrate reset`
- use force-reset or data-loss commands

unless explicitly approved by the developer.

Schema changes must use the project's documented migration workflow.

Never assume a configured database is disposable.

### Secrets and Environment Files

Never expose, print, commit, copy into documentation, or hard-code secrets, tokens, passwords, API keys, private URLs, or credentials.

Do not overwrite existing `.env` files.

Use `.env.example` for documenting required environment variables and placeholder values only.

## Implementation Style

Prefer:
- small focused modules
- typed APIs
- server-side authorization
- Zod validation at boundaries
- TanStack Query for server state
- React Hook Form + Zod for forms
- explicit loading, empty, success, and error states
- reusable UI only when reuse is demonstrated

Avoid speculative abstractions.

## Completion

Before declaring a task complete:

1. Verify the documented acceptance criteria.
2. Run relevant lint, typecheck, tests, and build commands when available.
3. Report files changed.
4. Report known limitations.
5. Show suggested commit message, but DO NOT commit.

### Progress Tracking Synchronization

After implementation and verification, but before the final report, update
the owning `specs/features/<name>/tasks.md` (task status + concise
verification evidence) when the task materially changes project status.
For a change with no dedicated feature package, note the status change in
the final report instead. Optionally append a dated entry to
`docs/19-progress-tracking.md` for continuity of that historical log — but
`tasks.md` (or the report itself) is the authoritative record, not
`docs/19`.

Before editing a `tasks.md`, inspect its current diff and preserve
unrelated developer edits, history, and completed milestones. Make the
smallest accurate change, avoid whole-file rewrites and formatting-only
churn, and resolve apparent contradictions from repository evidence. Stop
and report if overlapping edits cannot be reconciled safely.

Use status terms precisely; they are not interchangeable:

- `Implemented on branch`: code exists in the current working tree or branch.
- `Verified`: the reported checks were actually run and passed.
- `Unstaged`: working-tree changes are not in the Git index.
- `Staged`: changes are in the Git index but not necessarily committed.
- `Committed`: the change exists in Git history.
- `Integrated into master`: Git ancestry confirms the commit is contained in `master`.
- `Pushed`: the relevant remote branch contains the commit.
- `Database verified`: the configured real database was safely checked.
- `Visually verified`: required browser routes and viewports were manually inspected.

Do not infer these states from prompts, folders, specs, or previous reports. When applicable, say: `Implemented and verified on feature/customer-portal; changes remain unstaged and uncommitted.`

If work stops early, do not mark it complete. Record it as blocked or in progress only when project status materially changed, state the exact blocker, preserve the last confirmed verification results, and never replace them with unrun checks or claim database or visual verification.

`tasks.md` (and any progress note) is a project status summary only. It
must not override the owning `spec.md`, redefine requirements, replace
API/RBAC/workflow/SLA/frontend/UI/decision contracts, contain large
implementation specifications, treat planned work as complete, invent
verification, remove limitations without evidence, or erase unrelated
developer updates. Detailed behavioral rules remain in the owning
`specs/features/<name>/spec.md`, `specs/domain-model.md`,
`specs/architecture.md`, and `specs/decisions.md`.

A status update is normally unnecessary for read-only questions, explanations, prompt writing, planning without implementation, review without changes, diagnosis-only work, repository inspection with no status change, or minor wording/formatting changes that do not affect project status. State that no progress update was required when relevant.

For every implementation-task final report, state whether `tasks.md` (or equivalent status record) was updated and which sections changed; the exact Git state and whether work is unstaged, staged, committed, integrated, or pushed; completed and incomplete verification; and newly documented limitations.

Updating a status record never authorizes staging, committing, pushing, merging, rebasing, amending, tagging, or otherwise altering Git history.


## Frontend Design Skill

For any task involving frontend UI, UX, layout, styling, responsive behavior, RTL presentation, or visual refinement, the AI MUST read:

`.agents/skills/design-taste-frontend/SKILL.md`

before making frontend visual implementation decisions.

The skill is advisory only and does not override:

1. Current developer instructions
2. `AGENTS.md`
3. The owning `specs/features/<name>/spec.md`
4. `specs/constitution.md` (Accessibility / UI Consistency)
5. Existing approved product behavior

If the skill conflicts with higher-priority project specs, follow the higher-priority source and report the conflict.


<!-- openwolf:begin -->
# OpenWolf

@.wolf/OPENWOLF.md

This project uses OpenWolf for context management. Read and follow .wolf/OPENWOLF.md every session. Check .wolf/cerebrum.md before generating code. Check .wolf/anatomy.md before reading files.
<!-- openwolf:end -->

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
