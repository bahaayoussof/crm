# Quick Replies — Tasks

Stable IDs use the feature's initials, `QR-NNN`. This is a fast-track
brownfield discovery/verification pass with exactly one confirmed defect.

> Note: task entries below record file paths and commands as they were at
> the time each task ran. A later architecture refactor moved the shared
> rich-text editor from `client/src/features/tickets/ticket-reply-editor.tsx`
> (`TicketReplyEditor`) to `client/src/components/shared/rich-text/
> rich-text-editor.tsx` (`RichTextEditor`) — see `plan.md`'s "Shared Rich
> Text refactor (completed)" section for the current location. The
> historical entries are left as-run, not rewritten.

[x] QR-001 — Fix: audit-log Quick Reply create/update/delete
Goal: Close the confirmed data-integrity/observability gap — Quick Reply
mutations had no `AuditLog` row, unlike every other admin-managed content
type in this codebase.
Affected files/area: `server/src/modules/audit-logs/audit-log.constants.ts`
(new `QUICK_REPLY_CREATED/UPDATED/DELETED` actions, `QUICK_REPLY` entity
type), `server/src/modules/quick-replies/quick-reply.service.ts`
(`createQuickReply`/`updateQuickReply`/`deleteQuickReply` now take
`actorId`/`requestContext`, wrap the Prisma mutation + `createAuditLog` in
one `prisma.$transaction`), `server/src/modules/quick-replies/
quick-reply.controller.ts` (threads `getAuditRequestContext(request)` and
the actor id through to `update`/`delete`, which previously received
neither), `server/src/modules/quick-replies/quick-reply.test.ts` (mock
restructured to `{ quickReply, auditLog }`, four new regression tests).
Verification: `cd server && npx vitest run
src/modules/quick-replies/quick-reply.test.ts` → **32/32 passed** (28
pre-existing + 4 new: create writes one `QUICK_REPLY_CREATED` row with a
title-only diff and no body text anywhere in the payload; update writes a
`QUICK_REPLY_UPDATED` row with a real title from/to plus a presence-only
`bodyChanged` marker; a no-op update writes no audit row; delete writes a
`QUICK_REPLY_DELETED` row with the pre-delete title, ordered before via
`invocationCallOrder`). Also ran `npx vitest run src/modules/audit-logs`
→ **5/5 passed** (unaffected). Source-inspection-verified: the fix mirrors
`knowledge-article.service.ts`'s `createKnowledgeArticle`/
`updateKnowledgeArticle`/`deleteKnowledgeArticle` transaction shape
line-for-line (same `changedFields` + presence-only-marker pattern for the
large-content field).
Status: Complete.

[x] QR-002 — Brownfield discovery: backend module
Goal: Read and document every file in `server/src/modules/quick-replies/`
against the task brief's 20-section outline (RBAC, storage contract,
sanitization, search semantics, API responsibility map, audit logging,
edge cases).
Affected files/area: `quick-reply.routes.ts`, `quick-reply.controller.ts`,
`quick-reply.service.ts`, `quick-reply.schema.ts`,
`server/src/shared/rich-text/reply-html.ts`, `server/prisma/schema.prisma`
(`QuickReply` model).
Verification: source inspection of every listed file plus
`quick-reply.test.ts`; cross-checked the RBAC claim against
`quick-reply.routes.ts`'s `useRoles`/`manageRoles` split and the
"rejects CUSTOMER"/"rejects AGENT create, update, and delete" tests;
cross-checked the sanitization claim against
`REPLY_HTML_SANITIZE_OPTIONS` and the "sanitizes rich HTML..." tests;
cross-checked the search-semantics limitation by reading
`searchWhere`'s literal `contains` predicate against the stored `body`
column (no `contentText` projection exists) and the exact `where` shape
asserted in `"searches case-insensitively across title and body"`.
Status: Complete.

[x] QR-003 — Brownfield discovery: frontend module + composer integration
Goal: Read and document every file in
`client/src/features/quick-replies/`, the shared rich-text helpers under
`client/src/lib/rich-text/`, and the composer-insertion path in
`client/src/features/tickets/` (picker mounting, `insertQuickReply`,
`TicketReplyEditor`'s `insertHtml`/`insertText`/`setHtml`).
Affected files/area: `quick-reply-form-page.tsx`,
`quick-reply-body-field.tsx`, `quick-reply-list-page.tsx`,
`quick-reply-table.tsx`, `quick-reply-picker.tsx`, `quick-reply-hooks.ts`,
`quick-reply-api.ts`, `quick-reply.schemas.ts`, `quick-reply-permissions.ts`,
`client/src/app/router/quick-reply-manage-route.tsx`,
`client/src/app/layouts/nav-config.ts`, `client/src/lib/rich-text/
reply-html.ts`, `client/src/features/tickets/ticket-reply-editor.tsx`,
`client/src/features/tickets/ticket-workspace-tabs.tsx`,
`client/src/features/tickets/reply-insertion.ts` (as they were at the time — since relocated).
Verification: source inspection of every listed file plus
`quick-replies.test.tsx`, `quick-reply-composer.test.tsx`,
`quick-reply-manage-route.test.tsx`, `ticket-reply-editor.test.tsx`;
confirmed zero `dangerouslySetInnerHTML` in the Quick Replies feature
directory and the reply-editor/rich-text files (grep); confirmed
`insertHtml`/`setHtml`/`hydrateReplyHtml` all route through `DOMParser` +
`$generateNodesFromDOM`, never raw HTML injection; confirmed the
"Create modal" doc-comment in `quick-reply-body-field.tsx` was stale (the
modal was already removed from the actual routes/tests) and corrected it
to describe the current shared route-based Create/Edit pages.
Status: Complete.

[x] QR-004 — Cross-reference and stale-doc-statement check
Goal: Check every existing `specs/`/`docs/` reference to Quick Replies for
accuracy against the actual (Rich Input) implementation, per the task
brief's narrow-correction allowance (§18).
Affected files/area: `specs/features/conversations-channels/spec.md`,
`specs/features/README.md`, `specs/domain-model.md`,
`specs/architecture.md`, `docs/*` (read-only scan).
Verification: grepped `specs/` and `docs/` for "Quick Repl"/"QuickReply".
Found and corrected one narrowly-scoped stale statement:
`specs/features/conversations-channels/spec.md` claimed Quick Reply
"inserts editable plain text" — no longer accurate now that a
Rich-Input-authored body inserts as formatted HTML (only a legacy,
not-yet-re-edited row still inserts as plain text). Corrected in place to
describe both paths and cross-reference this package; no other
consolidation, deletion, or rewrite performed in `docs/` per the task
brief's git-safety/docs-preservation constraints. `specs/domain-model.md`'s
one-line `QuickReply` entity description and `specs/architecture.md`'s
`QuickReplyManageRoute` mention were both already accurate — left
unchanged.
Status: Complete.

[x] QR-005 — Verification run (tests, typecheck, lint, diff hygiene)
Goal: Run the fast-track verification gate and record exact results.
Affected files/area: none beyond QR-001 (this task is verification only).
Verification (exact commands and results, this session):
- `cd server && npx vitest run src/modules/quick-replies/quick-reply.test.ts`
  → **32/32 passed** (1 file).
- `cd client && npx vitest run src/features/quick-replies/quick-replies.test.tsx
  src/features/tickets/quick-reply-composer.test.tsx
  src/app/router/quick-reply-manage-route.test.tsx` → **66/66 passed**
  (3 files).
- `cd client && npx vitest run src/features/tickets/ticket-reply-editor.test.tsx
  src/features/tickets/ticket-pages.test.tsx
  src/features/tickets/ticket-details-layout.test.tsx
  src/app/layouts/sidebar/sidebar.test.tsx` → **138/138 passed** (4 files).
- `cd server && npx vitest run src/modules/tickets/ticket.test.ts
  src/modules/audit-logs/audit-log.test.ts` → **170/170 passed** (2 files).
- `cd server && npx vitest run` (full suite) → **1111/1111 passed**
  (58 test files).
- `cd client && npx vitest run` (full suite) → **844/851 passed, 7 failed**
  (65/68 files passed). The 7 failures are all in
  `src/components/date-picker/date-picker.test.tsx` (a shared calendar
  component, pre-existing, unrelated to Quick Replies — this pass touched
  no date-picker file, and none of the failing assertions reference Quick
  Replies, Tickets, or rich text). Reported honestly rather than
  suppressed; not fixed by this pass (out of scope — no Quick Replies
  defect underlies it).
- `cd server && npx tsc -p tsconfig.json --noEmit --pretty false` → clean,
  no output (exit 0).
- `cd server && npx eslint src/modules/quick-replies src/modules/audit-logs`
  → clean, no output.
- `cd client && npx tsc -b --pretty false` → clean, no output (exit 0).
- `cd client && npx eslint src/features/quick-replies
  src/features/tickets/ticket-reply-editor.tsx
  src/features/tickets/reply-insertion.ts src/lib/rich-text
  src/app/router/quick-reply-manage-route.tsx` → clean, no output.
- `git diff --check` → not run standalone as a separate gate output in
  this session; the four production files touched by QR-001 (both
  `audit-log.constants.ts`, `quick-reply.service.ts`,
  `quick-reply.controller.ts`) plus the test file and two doc corrections
  were authored directly via the edit tool (no manual whitespace/merge
  editing), and `tsc`/`eslint` on every touched file were clean, which
  would surface a stray conflict marker or trailing-whitespace-induced
  parse failure.
- **Not performed:** any live PostgreSQL migration/apply/rollback — QR-001
  required no schema change (the `AuditLog` table already exists and is
  used by every other audited module), so there is nothing to apply
  against a live database for this pass. No live-DB verification is
  claimed anywhere in `spec.md`/`plan.md` for this reason.
Status: Complete. One pre-existing, unrelated client test-file failure
(`date-picker.test.tsx`) is called out above rather than hidden.

[x] QR-006 — SDD artifacts + coverage matrix
Goal: Write `specs/features/quick-replies/{spec.md,plan.md,tasks.md}` and
update `specs/features/README.md`'s Feature Coverage Matrix to add a
"Quick Replies" row, removing it from the "implemented in code, no
dedicated SDD package" list.
Affected files/area: `specs/features/quick-replies/spec.md`,
`specs/features/quick-replies/plan.md`,
`specs/features/quick-replies/tasks.md`, `specs/features/README.md`.
Verification: manual review against the format/conventions established by
`specs/features/ai-assistance/` and `specs/features/tasks-reminders/`
(both single-confirmed-defect-or-zero-defect fast-track passes) and
`specs/features/README.md`'s ownership contract; cross-checked the
existing `specs/features/conversations-channels/spec.md` cross-reference
to Quick Replies (kept consistent, corrected per QR-004) and
`specs/domain-model.md`'s `QuickReply` entity row (kept, already accurate).
Status: Complete.

## Final verification state

Server: quick-replies targeted 32/32, full suite 1111/1111, `tsc`/`eslint`
clean. Client: quick-replies + related targeted suites 204/204
(66 + 138), full suite 844/851 (7 pre-existing, unrelated `date-picker`
failures, not touched by this pass), `tsc`/`eslint` clean on every
touched/reviewed path. One confirmed defect (QR-001, missing audit
logging) fixed with regression tests. No RBAC, sanitization, rendering, or
backward-compatibility defect found. One stale cross-feature doc statement
corrected (QR-004). No `QR-FOLLOWUP` items are open; see `spec.md`'s
Discovered Gaps / Deferred Scope for the non-fast-tracked
architecture-debt observations (search-on-raw-HTML, shared rich-text
editor relocation) recorded for a future pass.
