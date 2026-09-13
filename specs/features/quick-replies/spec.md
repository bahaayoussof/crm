# Quick Replies — Spec

## Status

**Implemented + verified on SDD branch** (`chore/sdd-foundation`, 2026-09-13,
uncommitted). Brownfield discovery of an already-shipped module
(`server/src/modules/quick-replies`, `client/src/features/quick-replies`)
that had no dedicated SDD package (previously listed in
`specs/features/README.md` under "Implemented in code, no dedicated SDD
package", referenced only as a Conversations/Channels dependency). This pass
documents the feature's **final** intended shape: Rich Input (rich HTML)
body content with legacy plain-text backward compatibility, server-side
sanitization, and one shared Create/Edit page (the old Create modal has been
removed). **One confirmed data-integrity/observability gap was found and
fixed**: Quick Reply create/update/delete were not audit-logged, unlike
every comparable admin-managed content type in this codebase (Knowledge Base
articles, Users, Teams, Departments, Branches, Settings/Categories/SLA
rules) — closed with `QUICK_REPLY_{CREATED,UPDATED,DELETED}` audit rows
(QR-001). No RBAC, sanitization, rendering, or backward-compatibility defect
was found. Server 1111/1111, client suite green (see `tasks.md` for exact
counts); `tsc`/`eslint` clean both sides.

## Purpose

A Quick Reply is a reusable canned-response template (title + rich-text
body) that ADMIN/MANAGER authors manage and that ADMIN/MANAGER/AGENT can
search and insert into the ticket reply composer, so agents do not retype
common answers. Quick Replies are a **content template store** only — they
never send a message themselves; inserting one only populates the
already-open ticket reply composer, which the agent must still submit
through the normal, independently-authorized send action.

## Scope

- CRUD for a `QuickReply` record: `title` (2-120 chars) and `body` (Rich
  Input HTML or legacy plain text, ≤5,000 readable characters after
  sanitization).
- Server-side sanitization of the body to the same HTML allowlist the
  ticket reply/note composer uses (`REPLY_HTML_SANITIZE_OPTIONS`).
- Backward compatibility for rows created before Rich Input existed
  (plain-text `body`, unedited since).
- Lazy upgrade: a legacy plain-text row is converted to sanitized HTML only
  when it is next saved through Edit; reading/listing/inserting a
  never-edited legacy row is unaffected.
- One shared Create/Edit route-based page/form (`quick-reply-form-page.tsx`)
  — no modal.
- List page with search (title/body substring, case-insensitive), pagination
  (default 15/page), delete-with-confirmation.
- A composer-embedded picker (`QuickReplyPicker`) that searches quick
  replies server-side and inserts the selected body into the open ticket
  reply draft (`TicketReplyEditor`), preserving rich formatting for a
  Rich-Input-authored body and plain text for a not-yet-re-edited legacy
  body.
- Server-authoritative RBAC: ADMIN/MANAGER manage (create/update/delete),
  ADMIN/MANAGER/AGENT use (list/detail/insert), CUSTOMER has no access.
- Audit logging of create/update/delete (title-only diff; body is never
  written to the audit record, only a presence-only "changed" marker).

## Out of Scope

Not implemented anywhere in this codebase, and not added by this pass:

- Folders/categories/tags for quick replies, sharing scopes (team-only,
  personal), favorites/pinning, usage analytics, content versioning/
  history, bulk import/export/management, full-text search or a
  `bodyText`/`contentText` search projection (see Search Semantics below),
  approval workflow, scheduling, or multi-language variants per reply.
- A dedicated `contentFormat` enum column — format detection is
  sniff-based (see Rich-Content Storage Contract) and this pass does not
  introduce a migration to add one.
- Moving/renaming the shared rich-text editor out of the Tickets feature
  directory — tracked as deferred architecture debt (see Cross-Feature
  Ownership Boundaries and `plan.md`).

## Actors

| Actor | Description |
|---|---|
| ADMIN | Full access: list, create, edit, delete, insert into replies. |
| MANAGER | Same as ADMIN for Quick Replies specifically (create/edit/delete/list/insert) — note this differs from MANAGER's otherwise "focused, operations-first" nav (see Frontend Behavior). |
| AGENT | List/detail/insert only — cannot create, edit, or delete. |
| CUSTOMER | No access at all, at any layer (403 at the router). |

## Role / Permission Matrix

Server-authoritative (`server/src/modules/quick-replies/quick-reply.routes.ts`);
the frontend route guard and nav are defense-in-depth / presentation only.

| Action | Route | ADMIN | MANAGER | AGENT | CUSTOMER |
|---|---|---|---|---|---|
| List | `GET /api/quick-replies` | ✅ | ✅ | ✅ | `403 FORBIDDEN` |
| Read one | `GET /api/quick-replies/:id` | ✅ | ✅ | ✅ | `403 FORBIDDEN` |
| Create | `POST /api/quick-replies` | ✅ | ✅ | `403 FORBIDDEN` | `403 FORBIDDEN` |
| Update | `PATCH /api/quick-replies/:id` | ✅ | ✅ | `403 FORBIDDEN` | `403 FORBIDDEN` |
| Delete | `DELETE /api/quick-replies/:id` | ✅ | ✅ | `403 FORBIDDEN` | `403 FORBIDDEN` |
| Unauthenticated | any route | `401 AUTHENTICATION_REQUIRED` | | | |

Verified in `server/src/modules/quick-replies/quick-reply.test.ts`
("rejects unauthenticated requests on every route", "rejects CUSTOMER from
every quick reply route", "rejects AGENT create, update, and delete") and by
inspection of `quick-reply.routes.ts`'s `useRoles`
(`ADMIN, MANAGER, AGENT`) vs. `manageRoles` (`ADMIN, MANAGER`) split — there
is no per-row/ownership scoping beyond role (unlike Tickets' team-visibility
model); every quick reply is visible/usable to every AGENT+ role once it
exists.

**Frontend vs. API classification:** the frontend `/quick-replies` list/
create/edit routes are gated by `QuickReplyManageRoute` +
`canManageQuickReplies` (ADMIN/MANAGER only) — an AGENT who calls
`GET /api/quick-replies` directly is authorized by the server but has no
dedicated frontend page for it. This is not a mismatch/defect: AGENT's only
intended consumption surface is the ticket composer's `QuickReplyPicker`,
which calls the same list endpoint directly (not through the management
page) and is mounted unconditionally for any agent who can mutate the
ticket. MANAGER additionally has no `/quick-replies` **nav link** (by
explicit design — see `nav-config.ts`'s comment on the focused MANAGER nav)
despite passing the route guard; a MANAGER must navigate to `/quick-replies`
directly by URL. Documented as intentional, not a gap.

## Create/Edit Behavior

One shared route-based form, no modal (the previous Create modal has been
removed):

- **Create:** `GET /quick-replies/new` → `QuickReplyFormPage` with
  `isEditing = false`, empty initial values (`{ title: "", body: "" }`).
  Submit calls `useCreateQuickReply().mutateAsync`, then navigates to
  `/quick-replies` (`replace: true`).
- **Edit:** `GET /quick-replies/:id/edit` → the same `QuickReplyFormPage`
  with `isEditing = true`. `react-hook-form`'s `values` option hydrates
  `title`/`body` from `useQuickReply(id)` once loaded; a `useEffect` calls
  the editor's imperative `setHtml(quickReply.data.body)` exactly once per
  loaded id (guarded by `hydratedRef`) so the Lexical editor (which is
  otherwise uncontrolled) shows the loaded content without re-hydrating
  over live user edits on every render. Submit calls
  `useUpdateQuickReply(id).mutateAsync`, then navigates to `/quick-replies`.
- Create and Edit share: the same Zod resolver
  (`quickReplyFormSchema`), the same `QuickReplyBodyField` (a
  `Controller`-wrapped `TicketReplyEditor`), the same submit handler shape,
  the same API-error mapping (`getLocalizedQuickReplyError`), and the same
  footer (`Cancel` → `/quick-replies`, `Save`/`Saving…` disabled while
  `isSubmitting || create.isPending || update.isPending`) — this
  `pending` flag also prevents a duplicate submit from a fast double-click.
- Edit-only states: a loading skeleton while `quickReply.isLoading`, and a
  distinct "not found" message vs. a generic load-error message
  (`quickReply.error.status === 404`).

## Rich-Content Storage Contract

- `QuickReply.body` is a single `String` Prisma column (`server/prisma/
  schema.prisma`) — no separate plain-text projection column and **no
  `contentFormat` enum/flag column**. This is intentional current
  architecture, not an oversight: format is determined by **sniffing** the
  stored string against `LOOKS_LIKE_REPLY_HTML` (`/<(?:\/?)(?:p|br|b|
  strong|i|em|u|ul|ol|li|a)\b[^>]*>/i`, `client/src/lib/rich-text/
  reply-html.ts`), the same pattern the Knowledge Base article body uses
  (`LOOKS_LIKE_ARTICLE_HTML`). This is reliable because the server
  normalizes every saved body through one trusted transform
  (`prepareQuickReplyBody` → `sanitizeReplyHtml`), so every row is either
  well-formed sanitized HTML or untouched legacy plain text — there is no
  third shape. A false-positive sniff still renders safely (the sanitizer/
  Lexical HTML parser handles plain text that happens to contain a `<li>`-
  shaped substring); a false negative renders as preformatted text, not
  unsafely.
- **Server is the sole trust boundary** (`quick-reply.service.ts#
  prepareQuickReplyBody`): every create/update body is passed through
  `sanitizeReplyHtml` (allowlist: `p, br, b, strong, i, em, u, ul, ol, li,
  a`; `a` gets `rel="noopener noreferrer nofollow" target="_blank"`
  forced), then flattened via `replyHtmlToPlainText` to check it is
  non-empty and ≤5,000 readable characters. The **stored** value is the
  sanitized HTML (or the untouched plain string if the input carried no
  recognized tags), never the flattened text.
- Two length ceilings, mirroring the Knowledge Base article body pattern:
  a transport-level Zod bound (`RICH_BODY_MAX = 20,000` chars, headroom for
  markup) and a readable-text ceiling (`BODY_TEXT_MAX = 5,000` chars)
  enforced server-side against the sanitized-then-flattened text, not the
  raw input.
- **Lazy upgrade:** a legacy plain-text row stays plain text forever unless
  it is edited and saved again — at that point `prepareQuickReplyBody` runs
  on whatever the editor now serializes (which will be HTML, since the
  Rich Input editor always emits HTML), so the row is silently upgraded to
  sanitized HTML "on next save," not via a migration or background job.
- No migration is planned to add a `contentFormat`/`bodyText` column
  purely to normalize this metadata — the task brief explicitly rules that
  out absent a confirmed defect, and none was found; the sniff-based model
  is functionally sufficient for hydration, insertion, and preview.

## Backward Compatibility

Verified (automated-test-verified, `quick-reply.test.ts` +
`quick-replies.test.tsx`):

- A legacy plain-text `body` sanitizes to itself unchanged on
  read/passthrough (`"keeps a legacy plain-text body sanitizing to itself
  unchanged"`).
- Editing a legacy row and saving triggers the same sanitize path, which
  for a Rich-Input-authored replacement value naturally converts it to
  HTML (`"sanitizes rich HTML on update, lazily converting a legacy
  plain-text row on first edit"`).
- `hydrateReplyHtml` (`client/src/lib/rich-text/reply-html.ts`) loads a
  legacy plain-text body into the Edit Lexical editor by splitting on blank
  lines into paragraphs and single newlines into `<br>`s — never by
  guessing HTML from the text (`"loads a legacy plain-text Quick Reply
  body into the editor for Edit"`).
- Insertion into the ticket composer routes a legacy row through
  `insertText` (verbatim, byte-compatible) and a rich row through
  `insertHtml` (formatting-preserving), selected by the same
  `LOOKS_LIKE_REPLY_HTML` sniff (`ticket-workspace-tabs.tsx#
  insertQuickReply`) — no raw HTML is ever shown to the user for either
  case.

## Sanitization / XSS

Full trace, Rich Input → API → server sanitization → persistence →
retrieval → editor hydration / composer insertion:

1. **Client editor (`TicketReplyEditor`, reused as `QuickReplyBodyField`)**
   emits only the tag set it can produce (`p, br, b, strong, i, em, u, ul,
   ol, li, a`) via Lexical's `$generateHtmlFromNodes` — a convenience, not
   the trust boundary.
2. **API transport:** the client Zod schema (`quick-reply.schemas.ts`)
   only checks length/non-emptiness (via `replyHtmlHasVisibleText`) before
   sending — it performs no sanitization of its own; it exists to give
   fast UI feedback, not security.
3. **Server sanitization (`quick-reply.service.ts#prepareQuickReplyBody` →
   `sanitizeReplyHtml`, `server/src/shared/rich-text/reply-html.ts`):**
   `sanitize-html` with a strict allowlist (tags above; only `a[href, rel,
   target]` attributes; `allowedSchemes: http, https, mailto`;
   `allowProtocolRelative: false`; `disallowedTagsMode: "discard"`).
   Verified by test to strip `<script>`, inline event handlers
   (`onclick`, `onerror`), inline `style`, and disallowed tags (`<img>`)
   while preserving allowed formatting (`"sanitizes rich HTML to the
   reply-composer allowlist, stripping scripts/styles/attributes"`).
   Every outbound link is force-rewritten to
   `rel="noopener noreferrer nofollow" target="_blank"`.
   An input that sanitizes to no visible text (e.g. `<p></p><p><br></p>`,
   or a body that becomes empty once every disallowed tag is stripped) is
   rejected with `400 VALIDATION_ERROR`, never silently stored as an empty
   row (`"rejects a body that is empty once markup is stripped"`).
4. **Persistence:** the sanitized HTML (or untouched legacy plain text) is
   the only thing ever written to `QuickReply.body` — there is no
   secondary "raw" column.
5. **Retrieval:** the API returns the already-sanitized stored value
   as-is; there is no re-sanitization on read (none is needed, since
   nothing but the one write path can populate the column).
6. **Editor hydration (Edit page, `hydrateReplyHtml`)** and **composer
   insertion (`insertHtml`, `ticket-reply-editor.tsx`)** both parse the
   HTML with `DOMParser` and convert it to Lexical nodes via
   `$generateNodesFromDOM` — **never** `dangerouslySetInnerHTML`. Verified
   by source inspection: zero `dangerouslySetInnerHTML` occurrences in
   `client/src/features/quick-replies/` or the reply-editor/rich-text
   files. `$generateNodesFromDOM` only creates nodes for tags/attributes
   Lexical's own HTML-import config recognizes, which is a subset of the
   already-sanitized allowlist — so even a hypothetical bypass of step 3
   could not reach the DOM as raw markup through this path (defense in
   depth, not the primary boundary).
7. **Picker preview text** (`stripReplyHtmlToPlainText`, used for the
   picker's result-list secondary line) is explicitly documented in its
   own doc comment as "never used for anything security-sensitive" and
   renders through a plain React text node (not HTML), so it carries no
   XSS risk regardless.

No unsafe rendering path was found. No fix was required in this area.

## Composer Insertion Behavior

`QuickReplyPicker` (`client/src/features/quick-replies/quick-reply-
picker.tsx`) is a collapsed trigger + searchable popover mounted inside the
ticket reply composer (`ticket-workspace-tabs.tsx`), Reply tab only, hidden
in Internal Note mode and disabled when the agent cannot mutate the ticket.

1. Picker searches `useQuickReplies({ search, page: 1, limit: 10 },
   { enabled: open })` — same list endpoint as the management page, scoped
   to whatever the current AGENT/MANAGER/ADMIN caller is authorized to see
   (i.e., everyone with route access sees every quick reply; there is no
   per-agent ownership filter).
2. Selecting a result calls `onSelect(item.body)` →
   `ticket-workspace-tabs.tsx#insertQuickReply(snippet)`, which sniffs
   `LOOKS_LIKE_REPLY_HTML` and dispatches to either
   `editorRef.current.insertHtml(snippet)` (rich) or
   `editorRef.current.insertText(snippet)` (legacy plain), both against
   the same `TicketReplyEditor` imperative handle the Reply tab already
   uses for direct typing and AI "Insert into Reply".
3. Both insertion paths append at the end of the current draft (not at a
   live caret — the trigger lives outside the editor) and enforce the
   same `MAX_PUBLIC_REPLY_LENGTH` (20,000 plain-text characters) the
   editor enforces for any other insertion; exceeding it returns
   `"too-long"`, which the composer surfaces as a non-blocking, localized
   inline error (`quickReplies.picker.lengthExceeded`) and leaves the
   existing draft untouched.
4. **Insertion never sends.** `onSelect` only mutates the open draft;
   sending remains the composer's own `Send`/note-submit action, which
   goes through the existing ticket-message mutation and its own
   authorization (`useCreateTicketMessage`/`useCreateTicketNote`) —
   Quick Replies has no code path that can create a `Message`/`Note` row
   or bypass that authorization.
5. Picker UI states: loading (`"searching…"`), non-blocking error (search
   fails but the composer/editor stay usable), empty (`no quick replies
   exist` vs. `no results for this search`, distinguished by whether a
   query is present), keyboard navigation (Arrow keys, `Enter` to select,
   `Escape` to close and return focus to the trigger), outside-pointer
   dismiss, and RTL-aware positioning (panel anchors from the trigger's
   right edge in `dir="rtl"`).

**Ownership boundary:** Quick Replies owns the reusable content template
and its insertion into the draft; Tickets/Conversations-Channels owns the
composer, the draft state, and the actual send action. This matches the
boundary already documented in `specs/features/conversations-channels/
spec.md` ("Quick Reply is internal-public-reply-only... and never sends").

## Search Semantics

`listQuickReplies` (`quick-reply.service.ts#searchWhere`) matches
`{ title: { contains, mode: insensitive } } OR { body: { contains, mode:
insensitive } }` directly against the **stored raw value** — sanitized HTML
for a Rich-Input-authored row, plain text for a legacy row. **Confirmed
limitation, verified in code and by the exact search-semantics test**
(`"searches case-insensitively across title and body"` asserts the literal
Prisma `where` shape): a search term that is split across formatting tags
in the stored HTML (e.g. body `<p>refund <strong>policy</strong></p>`,
search `"refund policy"`) will not match, because the literal substring
`"refund policy"` does not appear contiguously in the stored markup. A term
entirely inside one formatting run (e.g. `"policy"` alone, or `"refund"`
alone) still matches normally, and title search is entirely unaffected
(titles are never rich text). Classified as **accepted architecture debt**,
not a fast-tracked defect — no `contentText`/full-text-search projection or
schema migration is added by this pass (explicitly ruled out by the task
brief absent a confirmed correctness defect, and this is a known, narrow,
non-security limitation rather than incorrect behavior).

## API Behavior

| Endpoint | Auth | Validates | Returns |
|---|---|---|---|
| `GET /api/quick-replies?search=&page=&limit=` | ADMIN/MANAGER/AGENT | query (`quickReplyListQuerySchema`, strict, limit bounded, default 15) | `{ data: QuickReply[], meta: { page, limit, total, totalPages } }`, ordered `title asc, id asc` |
| `GET /api/quick-replies/:id` | ADMIN/MANAGER/AGENT | id param | `{ data: QuickReply }` or `404 QUICK_REPLY_NOT_FOUND` |
| `POST /api/quick-replies` | ADMIN/MANAGER | `title` (2-120), `body` (1-20,000 transport, ≤5,000 readable after sanitize), strict (rejects e.g. a client-supplied `createdById`) | `201 { data: QuickReply }` |
| `PATCH /api/quick-replies/:id` | ADMIN/MANAGER | same bounds, both fields optional, `hasAtLeastOneField` refine, strict | `200 { data: QuickReply }` or `404` |
| `DELETE /api/quick-replies/:id` | ADMIN/MANAGER | id param | `204` or `404` |

Every returned `QuickReply` projects `{ id, title, body, createdAt,
updatedAt, createdBy: { id, name, role } }` — the author's email is never
selected (verified: `"projects a safe author shape"` /
`not.toHaveProperty("email")`).

## Frontend Behavior

- **List page** (`quick-reply-list-page.tsx`): search box (URL-param
  driven, debounced), pagination, loading skeleton, error state with
  Retry, distinct empty states ("no quick replies yet" with a Create
  action vs. "no matches" with a Clear-filters action), a `QuickReplyTable`
  with Title/Reply-text/Updated/Actions columns, actions grouped behind an
  accessible ellipsis menu (Edit/Delete), delete requires explicit
  confirmation and restores focus on cancel, a pending delete disables
  re-submission, a failed delete stays visible/retryable. RTL-verified
  (`"keeps the same column ownership in Arabic RTL"`).
- **Create/Edit pages:** see Create/Edit Behavior above.
- **Nav visibility:** the `/quick-replies` link appears under
  "Management" only for ADMIN (per `nav-config.ts`); MANAGER passes the
  route guard but has no nav link (see Role/Permission Matrix note); AGENT
  and CUSTOMER see no link and are redirected to `/dashboard` if they
  navigate to `/quick-replies` directly (`QuickReplyManageRoute`).
- **Composer picker:** see Composer Insertion Behavior above.
- No RTL-specific defect found in either surface.

## Security / Edge Cases

Verified by the existing test suite (automated-test-verified unless noted):

| Case | Behavior |
|---|---|
| Duplicate title | Allowed — no uniqueness constraint on `title` in the Prisma model or service. Not classified as a defect: nothing in the domain model, `docs/`, or any sibling feature implies titles must be unique, and the task brief does not ask this pass to invent one. |
| Empty title | `400` (Zod `min(2)`) |
| Empty rich content (e.g. `<p></p>`) | `400 VALIDATION_ERROR` ("Quick reply body is required") — never stored |
| Content that becomes empty after sanitization (e.g. only a disallowed tag) | Same as above — `sanitizeReplyHtml` returns `""` when the sanitized-then-flattened text carries no visible content, which `prepareQuickReplyBody` rejects |
| Very long content | `400` if raw payload exceeds the 20,000-char transport bound (Zod) or if readable text exceeds 5,000 chars after sanitize (service-level check) |
| Malformed HTML | `sanitize-html`/Lexical's DOM parser handle malformed markup by normalizing/discarding, not by throwing — no crash path found |
| Legacy plain content | See Backward Compatibility |
| Deleted/missing Quick Reply (detail/update/delete) | `404 QUICK_REPLY_NOT_FOUND` |
| Insertion of a stale/deleted item in the picker | The picker only offers items from its own live search result; a race (deleted between search and click) cannot corrupt the composer — the picker never re-fetches the item by id before inserting, it inserts the body text it already has in memory from the list response |
| Unauthorized mutation | `403` (AGENT/CUSTOMER on manage routes), `401` (unauthenticated) — see Role/Permission Matrix |
| Concurrent edit | No optimistic-concurrency check (no version/`updatedAt` precondition) — last write wins, same as every other simple-CRUD admin content type in this codebase (Departments, Branches, Categories); not classified as a defect specific to Quick Replies |

## Discovered Gaps

Classified per the task brief's taxonomy (§15):

- **Data-integrity/observability defect (fixed, QR-001):** Quick Reply
  create/update/delete were not audit-logged, while every other
  admin-managed content type in this codebase is (Knowledge Base articles,
  Users, Teams, Departments, Branches, Settings/Categories/SLA rules —
  verified by grepping every module for `createAuditLog`). Closed by
  adding `QUICK_REPLY_CREATED/UPDATED/DELETED` audit rows, mirroring the
  Knowledge Base article pattern exactly (transactional write, title-only
  diff via `changedFields`, body never entering the audit record beyond a
  presence-only `bodyChanged` boolean). See `plan.md` and `tasks.md` for
  the exact change and its regression tests.
- **Architecture debt (deferred, not fixed):** "body contains" search
  operates on stored raw HTML (see Search Semantics) — a real, narrow,
  non-security limitation, not fast-tracked per the task brief.
- **Architecture debt (deferred, not fixed):** the shared rich-text editor
  Quick Replies depends on (`TicketReplyEditor`) physically lives under
  `client/src/features/tickets/`, even though it is now reused by a
  feature that is not Tickets. Scheduled for a future move/rename into
  shared Rich Text infrastructure, after every feature SDD package is
  complete and before final docs consolidation — not performed in this
  pass (see Cross-Feature Ownership Boundaries and `plan.md`).
- **No missing-test gaps found** beyond the audit-logging regression
  coverage added alongside QR-001 — the existing 28 server + 66 client
  targeted tests already cover create/edit with rich content, legacy
  plain-text edit, empty-editor validation, sanitization/XSS, rich and
  plain composer insertion, role boundaries, shared create/edit form
  behavior, route-based create navigation (no modal), duplicate-submit
  prevention, and not-found/error states.

## Deferred Scope

Everything listed under Out of Scope above, plus: the search-semantics
architecture debt and the shared-rich-text-editor relocation, both
described in Discovered Gaps. None of these are product gaps in the sense
of missing user-requested capability — they are explicitly out of this
fast-track pass's mandate per the task brief (§15/§17).

## Acceptance Criteria

- [x] ADMIN and MANAGER can create, edit, and delete a Quick Reply; AGENT
  and CUSTOMER cannot (server-enforced, `403`).
- [x] ADMIN, MANAGER, and AGENT can list/read Quick Replies and insert one
  into the ticket reply composer; CUSTOMER cannot (`403`).
- [x] Create and Edit share one route-based page/form; there is no Create
  modal.
- [x] A Rich-Input-authored body round-trips through create → list →
  edit → composer insertion with its formatting intact, and is safe against
  script/style/event-handler/attribute injection at every hop.
- [x] A legacy plain-text body (pre-dating Rich Input) renders correctly
  everywhere, loads into Edit correctly, and inserts into the composer as
  plain text without exposing raw markup.
- [x] Inserting a Quick Reply into the composer never sends a message and
  never bypasses the composer's own send authorization.
- [x] Quick Reply create/update/delete are audit-logged (QR-001).
- [x] `specs/features/README.md`'s Feature Coverage Matrix lists Quick
  Replies as an owned SDD package, no longer in the "no dedicated SDD
  package" list.

## Cross-Feature Ownership Boundaries

- **Quick Replies owns:** the `QuickReply` CRUD lifecycle, its RBAC, its
  body sanitization/storage contract, and the picker UI that searches and
  offers a template for insertion.
- **Tickets/Conversations-Channels owns:** the reply/note composer itself
  (`TicketReplyEditor`), the draft state, the send action and its
  authorization, and the 20,000-character public-reply length ceiling that
  both direct typing and Quick Reply insertion share. Quick Replies
  consumes this editor's imperative handle (`insertText`/`insertHtml`) but
  does not define or duplicate it — see `specs/features/
  conversations-channels/spec.md` for the composer's own spec, which
  already documents Quick Reply as a draft-insertion-only dependency.
- **Shared rich-text sanitization (`server/src/shared/rich-text/
  reply-html.ts`) owns:** the HTML allowlist and plain-text flattening
  used identically by Quick Replies, ticket replies/notes, and (via a
  near-identical sibling allowlist) Knowledge Base articles. Quick Replies
  does not define its own sanitization rules.
- **Audit Logs (`server/src/modules/audit-logs`) owns:** the
  `AuditLog` model, `createAuditLog`, and the `AUDIT_ACTIONS`/
  `AUDIT_ENTITY_TYPES` constants; Quick Replies is one more consumer
  (`QUICK_REPLY_*`), not a new implementation of audit logging.
- **Not owned by Quick Replies:** the `TicketReplyEditor` component's
  location/implementation (currently under Tickets — see Discovered Gaps'
  architecture-debt note), the ticket message/note domain model, or any
  KB-adjacent capability.
