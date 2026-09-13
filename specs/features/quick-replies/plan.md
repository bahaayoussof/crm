# Quick Replies — Plan

This is a brownfield pass with exactly one confirmed, narrowly-scoped
defect (missing audit logging, QR-001). This file records what was reused/
verified as-is, and the implementation approach for the one fix. See
`specs/features/README.md` for the spec/plan/tasks ownership contract.

## Existing implementation to reuse (already in place, not re-derived)

- **Sanitization primitive:** `server/src/shared/rich-text/reply-html.ts`
  (`sanitizeReplyHtml`, `replyHtmlToPlainText`, `REPLY_HTML_SANITIZE_OPTIONS`)
  — the exact allowlist the ticket reply/note composer already trusts.
  Quick Replies reuses it verbatim (`quick-reply.service.ts#
  prepareQuickReplyBody`); it does not define a second sanitizer.
- **Rich-text editor:** `client/src/components/shared/rich-text/rich-text-editor.tsx`
  (`RichTextEditor`, `insertText`/`insertHtml`/`setHtml`) — Quick Replies'
  Create/Edit body field (`quick-reply-body-field.tsx`) and the ticket
  composer's insertion path both drive this one component/imperative
  handle. Not re-implemented.
- **Client sniff/hydrate helpers:** `client/src/lib/rich-text/reply-html.ts`
  (`LOOKS_LIKE_REPLY_HTML`, `hydrateReplyHtml`, `stripReplyHtmlToPlainText`,
  `replyHtmlHasVisibleText`) — shared by the ticket composer and the Quick
  Reply editor/picker/form-validation schema.
- **Validation pattern:** the `RICH_BODY_MAX`/`BODY_TEXT_MAX` two-ceiling
  approach (transport bound vs. readable-text bound) mirrors the Knowledge
  Base article body pattern exactly (`knowledge-article.schema.ts` /
  `knowledge-article.service.ts`) — reused, not reinvented.
- **List/pagination primitives:** `paginationFields`, `databaseIdSchema`,
  `hasAtLeastOneField` (`shared/validation/*.schema.ts`) — same primitives
  every other admin-CRUD module (Departments, Branches, Categories) uses.
- **Audit logging primitive (added this pass to a new consumer, not
  reinvented):** `createAuditLog`/`changedFields`
  (`server/src/modules/audit-logs/audit-log.service.ts`) and the
  `AUDIT_ACTIONS`/`AUDIT_ENTITY_TYPES` constants — Quick Replies now
  consumes these exactly as Knowledge Base articles, Departments, Branches,
  Teams, Users, and Settings already do.

## Backend architecture (as-built, plus the QR-001 fix)

```text
POST/PATCH/DELETE /api/quick-replies[/:id]
  → requireAuth → manageRoles (ADMIN, MANAGER) → validateParams/validateBody
  → quick-reply.controller.{create,update,remove}
      actor(request) / getAuditRequestContext(request)
  → quick-reply.service.{createQuickReply,updateQuickReply,deleteQuickReply}
      prepareQuickReplyBody(raw) = sanitizeReplyHtml → replyHtmlToPlainText
                                    ceiling checks (non-empty, <=5,000 chars)
      prisma.$transaction(tx => {
        tx.quickReply.{create,update,delete}(...)
        [update/delete: read-before pre-check happens outside the tx]
        createAuditLog({ action: QUICK_REPLY_{CREATED,UPDATED,DELETED}, ... }, tx)
      })

GET /api/quick-replies[/:id]
  → requireAuth → useRoles (ADMIN, MANAGER, AGENT) → validateQuery/validateParams
  → quick-reply.controller.{list,detail} → quick-reply.service.{listQuickReplies,getQuickReply}
      (no audit — reads are never audited anywhere in this codebase)
```

Each layer's actual responsibility (file:function):

| Layer | File / function |
|---|---|
| Route + RBAC | `quick-reply.routes.ts` (`useRoles`, `manageRoles`) |
| Validation | `quick-reply.schema.ts` (Zod, strict schemas) |
| Controller (thin) | `quick-reply.controller.ts` — derives `actor`/`requestContext`, calls the service, shapes the HTTP response |
| Service (business rules + persistence) | `quick-reply.service.ts` — `prepareQuickReplyBody`, CRUD, now the transactional audit write |
| Sanitization | `shared/rich-text/reply-html.ts#sanitizeReplyHtml` / `replyHtmlToPlainText` |
| Audit | `audit-logs/audit-log.service.ts#createAuditLog` / `changedFields`, `audit-logs/audit-log.constants.ts` |
| Persistence | Prisma `QuickReply` + `AuditLog` models, one transaction per mutation |

## Frontend architecture (as-built, unchanged this pass)

```text
Management:
  quick-reply-list-page.tsx → useQuickReplies (list/search/paginate)
                             → quick-reply-table.tsx (row actions, delete confirm)
  quick-reply-form-page.tsx (Create at /quick-replies/new, Edit at /quick-replies/:id/edit)
    → react-hook-form + quickReplyFormSchema (Zod)
    → quick-reply-body-field.tsx (Controller → RichTextEditor)
    → useCreateQuickReply / useUpdateQuickReply (quick-reply-hooks.ts)
    → quick-reply-api.ts (axios wrappers) → GET/POST/PATCH /quick-replies

Composer insertion:
  ticket-workspace-tabs.tsx → QuickReplyPicker (search popover)
    → useQuickReplies (same list endpoint, limit 10)
    → onSelect(body) → insertQuickReply(snippet)
        LOOKS_LIKE_REPLY_HTML sniff → editorRef.insertHtml | insertText
    → RichTextEditor (shared UI; composer/send behavior owned by Tickets/Conversations-Channels)
```

No frontend code changed this pass — the fix (QR-001) is server-only
(audit logging has no client-visible surface; the Audit Logs list page,
owned elsewhere, will simply start showing `QUICK_REPLY_*` rows).

## Sanitization strategy (verified, unchanged)

Server-only trust boundary, one allowlist, reused verbatim from the shared
ticket-reply sanitizer — see `spec.md`'s Sanitization/XSS section for the
full trace. No new sanitization code was written or needed.

## Storage / backward-compatibility strategy (verified, unchanged)

Sniff-based format detection over a single `body: String` column, no
`contentFormat` column, lazy upgrade on next edit — see `spec.md`'s
Rich-Content Storage Contract. Explicitly not changed: no migration was
written to add format metadata, per the task brief's constraint that this
requires a confirmed defect, and none was found in this area.

## Composer integration strategy (verified, unchanged)

Quick Replies inserts through the same imperative `RichTextEditor`
handle every other insertion source uses (direct typing, AI "Insert into
Reply"), gated by the same length ceiling and never bypassing the
composer's own send action — see `spec.md`'s Composer Insertion Behavior
and Cross-Feature Ownership Boundaries.

## Testing strategy

Existing coverage (audited, not rewritten): 28 server tests
(`quick-reply.test.ts`) plus 66+ client tests across
`quick-replies.test.tsx`, `quick-reply-composer.test.tsx`, and
`quick-reply-manage-route.test.tsx` already covered RBAC, sanitization,
backward compatibility, composer insertion (rich + plain), shared create/
edit form behavior, route-based create (no modal), duplicate-submit
prevention, and error/not-found states (see `tasks.md` for the exact list
audited against the task brief's §14 priorities).

**New this pass (QR-001 regression coverage):** four server tests added to
`quick-reply.test.ts`:

1. Create writes exactly one transactional `QUICK_REPLY_CREATED` row with
   a title-only diff, and the body never appears anywhere in the audit
   payload (asserted via `JSON.stringify(auditData)` not containing the
   body text).
2. Update writes a `QUICK_REPLY_UPDATED` row with a real title from/to
   plus a presence-only `bodyChanged: true` marker when the body changed
   — body text itself never appears in the payload.
3. A no-op update (same title, no body field) writes **no** audit row —
   mirrors `updateKnowledgeArticle`'s "meaningful change only" rule.
4. Delete writes a `QUICK_REPLY_DELETED` row with the pre-delete title,
   and the mutation happens (verified via `invocationCallOrder`) before
   the audit write within the same transaction.

The test file's Prisma mock was restructured from a flat `mocks` object
passed as `tx` to a `{ quickReply, auditLog }` shape passed as `tx` —
required because the service now genuinely calls `tx.quickReply.*` and
`tx.auditLog.create` inside `prisma.$transaction`. This mirrors
`knowledge-article.test.ts`'s mock shape exactly. All 18 pre-existing
tests were re-verified to still pass unmodified against the new mock shape
(their assertions target `mocks.create`/`mocks.update`/`mocks.remove`
directly, which are the same function references regardless of how they
are nested in the mocked `prisma` object).

No test gaps beyond QR-001's own regression coverage were found — the
task brief's §14 priority list (rich create/edit, legacy plain-text edit,
empty-editor validation, sanitization/XSS, rich/plain composer insertion,
role boundaries, shared form behavior, create-route navigation,
duplicate-submit prevention, not-found/error states) was already fully
covered before this pass.

## Verification strategy

Automated-test-verified: targeted Quick Replies suite (both sides), full
server suite, full client suite, both `tsc --noEmit`, both `eslint`,
`git diff --check`. Source-inspection-verified: the "zero
`dangerouslySetInnerHTML` in the Quick Replies/rich-text surface" claim
(grep), the "every other admin-content module already audits" claim (grep
for `createAuditLog` across `server/src/modules`), the composer
never-sends ownership-boundary claim (traced `insertQuickReply` →
`insertHtml`/`insertText` → no call into `useCreateTicketMessage`/
`useCreateTicketNote` from within the picker or insertion path). **Not**
live-DB/runtime-verified — no migration was needed (no schema change: the
`AuditLog` table and its Prisma model already exist and are exercised by
every other audited module in this codebase), so no live-Postgres apply/
rollback step applies to this pass; this is stated explicitly rather than
implied. See `tasks.md` for exact commands and counts.

## Confirmed-gap implementation plan (QR-001 — the only fix made)

**Problem:** `createQuickReply`/`updateQuickReply`/`deleteQuickReply` wrote
directly to `prisma.quickReply` with no `AuditLog` row, unlike every other
admin-managed content type in this codebase (Knowledge Base articles,
Users, Teams, Departments, Branches, Settings/Categories/SLA rules — all
confirmed via `createAuditLog` grep). This is a genuine accountability/
data-integrity gap: an ADMIN/MANAGER could create, silently rewrite, or
delete a canned response with zero trace in the one place
(`/audit-logs`) this application already centralizes that trace for every
comparable action.

**Fix (minimal footprint, mirrors `knowledge-article.service.ts` and
`department.service.ts` exactly — no new pattern invented):**

1. `server/src/modules/audit-logs/audit-log.constants.ts` — add
   `QUICK_REPLY_CREATED`/`QUICK_REPLY_UPDATED`/`QUICK_REPLY_DELETED` to
   `AUDIT_ACTIONS` and `QUICK_REPLY` to `AUDIT_ENTITY_TYPES`.
2. `server/src/modules/quick-replies/quick-reply.service.ts` —
   `createQuickReply`/`updateQuickReply`/`deleteQuickReply` now take an
   `actorId`/`requestContext` and wrap their Prisma call plus a
   `createAuditLog` call in one `prisma.$transaction`, so a failed audit
   write rolls the mutation back (same guarantee KB articles give).
   `updateQuickReply` uses `changedFields` for `title` (real from/to) and
   a presence-only `bodyChanged` boolean for the body (never the body text
   itself, matching KB's `contentChanged` marker for article `content`).
3. `server/src/modules/quick-replies/quick-reply.controller.ts` — threads
   `getAuditRequestContext(request)` and the authenticated actor id into
   the three mutating service calls (previously only `create` received an
   `actor` object; `update`/`delete` received neither).
4. `server/src/modules/quick-replies/quick-reply.test.ts` — mock
   restructured to a `{ quickReply, auditLog }` transaction shape (see
   Testing strategy) plus four new regression tests.

**Why not broader:** no other confirmed defect exists in this module. The
existing 18 tests needed no behavioral changes — only the mock plumbing
required updating, because the underlying Prisma call shape now runs
inside a transaction. No route, schema, RBAC, or client-facing behavior
changed.

## Risks / trade-offs (accepted, not changed)

- **No per-row ownership/uniqueness model** — every ADMIN/MANAGER can
  edit/delete every quick reply (no "created by me only" restriction, no
  unique-title constraint). Consistent with this being a small shared
  team resource, not a personal one; not treated as a defect.
- **No optimistic-concurrency check on update** — last write wins, same as
  every other simple-CRUD admin module in this codebase (Departments,
  Branches, Categories); accepted as a repo-wide characteristic, not a
  Quick-Replies-specific risk.
- **Search-on-raw-HTML limitation** (see `spec.md` Search Semantics) —
  accepted architecture debt, not fixed this pass.
- **Sniff-based format detection, no `contentFormat` column** — accepted
  current architecture; a false-positive/negative sniff degrades to a safe
  rendering fallback (never unsafe), not a correctness risk worth a
  migration in this pass.
- **In-memory audit write is not itself audited for failure visibility
  beyond the transaction rollback** — same characteristic as every other
  `createAuditLog` consumer in this codebase; not a new risk introduced by
  QR-001.

## Shared Rich Text refactor (completed)

The generic Lexical editor previously lived at `client/src/features/tickets/
ticket-reply-editor.tsx` (`TicketReplyEditor`) even though it was already
depended on by a feature that is not Tickets (Quick Replies) and by the
Customer Portal. It has been moved/renamed to `client/src/components/
shared/rich-text/rich-text-editor.tsx` (`RichTextEditor`,
`RichTextEditorHandle`), together with its toolbar
(`rich-text-toolbar.tsx`) and link popover (`rich-text-link-popover.tsx`,
`rich-text-link.utils.ts`); the length-ceiling constant moved to
`client/src/lib/rich-text/reply-insertion.ts` alongside the existing
`client/src/lib/rich-text/reply-html.ts` sniff/hydrate helpers. Knowledge
Base's own editor toolbar (`knowledge-article-editor-toolbar.tsx`) now also
imports the shared link popover from this location instead of reaching
into `features/tickets`. Ticket-specific composition (mode switching
between Reply/Note, the `@mention` typeahead, the AI "Insert into Reply"
bridge, send/authorization) remains in `ticket-workspace-tabs.tsx`, which
now imports the shared component directly — no Tickets-owned wrapper was
kept, since the moved component had no Ticket-specific behavior left in
it. This was done after every feature's SDD package was complete and
before the final `docs/` → `specs/` consolidation, once across every
consumer rather than piecemeal inside one feature's brownfield pass. No
product behavior, storage format, or API contract changed.
