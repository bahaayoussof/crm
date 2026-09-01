# AI Engineering Rules

This repository is a time-boxed Customer Support CRM assessment.

## Mandatory Documentation Preflight

Documentation is the repository's source of truth.

**Before writing, editing, generating, or deleting any application code, the AI MUST complete the documentation preflight below.**

### Always Read First

For every implementation task, read:

1. `docs/00-project-overview.md`
2. `docs/01-scope-and-priorities.md`
3. `docs/02-architecture.md`
4. `docs/15-feature-branch-workflow.md`
5. `docs/16-definition-of-done.md`
6. `docs/17-decisions-log.md`

### Progress Tracking Preflight

For every task that may affect implementation or project status, also read `docs/19-progress-tracking.md`. This includes features, fixes, refactors, UI/UX, authorization, infrastructure, deployment, tests that change project status, and documentation that materially changes the roadmap or completion state.

Before implementation, reconcile the tracker with the actual repository, current branch, working tree, Git history, implemented code, automated tests, database checks, and browser or visual evidence. Repository evidence is authoritative when it conflicts with the tracker. Report material inconsistencies during the preflight instead of copying stale status forward.

### Then Read the Relevant Domain Documents

The AI MUST determine the task type and read all applicable documents before touching code.

#### Frontend / UI / UX work

Read:

- `docs/03-folder-structure.md`
- `docs/09-frontend-guidelines.md`
- `docs/18-ui-pages-spec.md`
- the domain document for the feature being implemented

Examples:
- Ticket UI -> also read `docs/07-ticket-workflow.md` and `docs/08-sla-automation.md` when SLA is shown.
- Authentication UI -> also read `docs/06-auth-rbac.md`.
- Customer Portal -> also read `docs/06-auth-rbac.md` and the relevant ticket/customer documents.

#### Backend / API work

Read:

- `docs/03-folder-structure.md`
- `docs/04-database-design.md`
- `docs/05-api-contract.md`
- `docs/10-backend-guidelines.md`
- the relevant domain document

#### Authentication / Authorization work

Read:

- `docs/04-database-design.md`
- `docs/05-api-contract.md`
- `docs/06-auth-rbac.md`

#### Ticket work

Read:

- `docs/04-database-design.md`
- `docs/05-api-contract.md`
- `docs/07-ticket-workflow.md`
- `docs/08-sla-automation.md`
- `docs/09-frontend-guidelines.md` and `docs/18-ui-pages-spec.md` when UI is affected

#### SLA / Automation work

Read:

- `docs/04-database-design.md`
- `docs/05-api-contract.md`
- `docs/07-ticket-workflow.md`
- `docs/08-sla-automation.md`

#### AI feature work

Read:

- `docs/11-ai-features.md`
- the ticket/customer documents whose data the AI feature consumes
- frontend guidelines/page specs when UI is affected

#### Testing work

Read:

- `docs/12-testing-strategy.md`
- `docs/16-definition-of-done.md`
- the documentation for the feature under test

#### Deployment work

Read:

- `docs/13-deployment.md`
- relevant architecture/configuration documentation

### Preflight Output

Before implementation, the AI should briefly state:

```text
Docs reviewed:
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

If required documentation is missing, inconsistent, or does not define a material behavior:
- DO NOT silently invent a new architecture, dependency, workflow, database model, API contract, role, permission, or visual pattern.
- Prefer the simplest implementation compatible with existing documentation only when the decision is minor and reversible.
- Record any meaningful assumption or architectural decision in `docs/17-decisions-log.md`.
- If the missing decision would materially change product behavior or architecture, stop implementation and report the conflict instead of guessing.

### Documentation Precedence

If documents conflict, use this order:

1. Explicit current developer/user instruction
2. `AGENTS.md`
3. Feature/domain-specific docs
4. `docs/18-ui-pages-spec.md` for page structure and UX
5. `docs/09-frontend-guidelines.md` for frontend/design rules
6. `docs/05-api-contract.md` for API behavior
7. `docs/04-database-design.md` for data model
8. `docs/02-architecture.md`
9. `docs/01-scope-and-priorities.md`
10. `docs/00-project-overview.md`

Do not resolve a meaningful contradiction silently. Report it and update documentation when appropriate.

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

For tasks involving project planning, progress review, roadmap status, feature completion, or deciding what to work on next, read `docs/19-progress-tracking.md`.

The progress tracker is a status summary only and does not override feature or domain documentation. Implementation tasks follow the mandatory preflight and synchronization rules in this file.

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
- rename public API fields without updating documentation first
- change database relations without updating `docs/04-database-design.md`
- add new ticket statuses without updating `docs/07-ticket-workflow.md`
- add new roles or permissions without updating `docs/06-auth-rbac.md`
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

After implementation and verification, but before the final report, update `docs/19-progress-tracking.md` when the task materially changes project status. Update only affected sections, such as the current branch; completed, integrated, uncommitted, or in-progress work; next work; deferred scope; known limitations; authorization or workflow decisions; exact test counts; lint, typecheck, and build results; PostgreSQL, browser, visual, or deployment verification; and existing build warnings.

Before editing the tracker, inspect its current diff and preserve unrelated developer edits, history, and completed milestones. Make the smallest accurate change, avoid whole-file rewrites and formatting-only churn, and resolve apparent contradictions from repository evidence. Stop and report if overlapping edits cannot be reconciled safely.

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

Do not infer these states from prompts, folders, documentation, or previous reports. When applicable, say: `Implemented and verified on feature/customer-portal; changes remain unstaged and uncommitted.`

If work stops early, do not mark it complete. Record it as blocked or in progress only when project status materially changed, state the exact blocker, preserve the last confirmed verification results, and never replace them with unrun checks or claim database or visual verification.

The tracker is a project status summary only. It must not override authoritative domain documentation, redefine requirements, replace API/RBAC/workflow/SLA/frontend/UI/decision contracts, contain large implementation specifications, treat planned work as complete, invent verification, remove limitations without evidence, or erase unrelated developer updates. Detailed rules remain in `docs/05-api-contract.md`, `docs/06-auth-rbac.md`, `docs/07-ticket-workflow.md`, `docs/08-sla-automation.md`, `docs/09-frontend-guidelines.md`, `docs/18-ui-pages-spec.md`, and `docs/17-decisions-log.md`.

A tracker update is normally unnecessary for read-only questions, explanations, prompt writing, planning without implementation, review without changes, diagnosis-only work, repository inspection with no status change, or minor wording/formatting changes that do not affect project status. State that no progress update was required when relevant.

For every implementation-task final report, state whether the tracker was updated and which sections changed; the exact Git state and whether work is unstaged, staged, committed, integrated, or pushed; completed and incomplete verification; and newly documented limitations.

Updating the tracker never authorizes staging, committing, pushing, merging, rebasing, amending, tagging, or otherwise altering Git history.


## Frontend Design Skill

For any task involving frontend UI, UX, layout, styling, responsive behavior, RTL presentation, or visual refinement, the AI MUST read:

`.agents/skills/design-taste-frontend/SKILL.md`

before making frontend visual implementation decisions.

The skill is advisory only and does not override:

1. Current developer instructions
2. `AGENTS.md`
3. Feature/domain documentation
4. `docs/18-ui-pages-spec.md`
5. `docs/09-frontend-guidelines.md`
6. Existing approved product behavior

If the skill conflicts with higher-priority project documentation, follow the higher-priority source and report the conflict.


<!-- openwolf:begin -->
# OpenWolf

@.wolf/OPENWOLF.md

This project uses OpenWolf for context management. Read and follow .wolf/OPENWOLF.md every session. Check .wolf/cerebrum.md before generating code. Check .wolf/anatomy.md before reading files.
<!-- openwolf:end -->
