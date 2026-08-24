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
- create a local feature branch when explicitly requested
- stage nothing unless explicitly requested

All commits and pushes are performed manually by the developer.

## Branch Rule

Every feature or isolated fix must be implemented on its own branch.

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
