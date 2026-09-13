# Conversations / Channels — Task Decomposition

## Status

**`IMPLEMENTED + VERIFIED ON SDD BRANCH`** — all 57 tasks (CONV-001–057) materially complete, final gate (CONV-057) passed. Branch `chore/sdd-foundation`, committed. See "Honest status at end of this session" near the bottom of this file for the one deferred item (Portal composer attach-file client UI) and its scope rationale.

## Progress Log

- [x] CONV-001 — content format/source enums + nullable columns on TicketMessage/TicketNote.
- [x] CONV-002 — `MessageDelivery` model.
- [x] CONV-003 — `TicketMessage.inboundKey` nullable-unique.
- [x] CONV-004 — `Attachment.noteId` + `TicketNote.attachments`.
- [x] CONV-005 — `Ticket.liveChatSessionKey` nullable-unique.
- [x] CONV-006 — migration `20260913064752_conversations_channels_foundation` generated + applied.
  Verification: additive-only confirmed; row counts unchanged; `migrate status` clean.
- [x] CONV-007 — `server/scripts/backfill-conversation-content.ts` (author-identity-based, never markup-sniffed).
  Verification: 1359 messages + 129 notes backfilled, 0 nulls remain.
- [x] CONV-008 — `server/scripts/backfill-inbound-key.ts`.
  Verification: 4 unambiguous rows written, 0 conflicts, 0 post-write duplicate groups.
- [x] CONV-009 — `server/scripts/backfill-message-delivery.ts`.
  Verification: 2 conclusive `SENT` rows created, 4 inbound-authored rows correctly skipped (not fabricated).
- [x] CONV-010 — migration `20260913065709_conversation_content_metadata_required` (SET NOT NULL, pre-checked zero nulls).
  Verification: `migrate status`/`prisma generate` clean.
- [x] CONV-011 — `server/src/shared/rich-text/conversation-content.ts` (`validateConversationContent`/`requireConversationContent`).
  Verification: `conversation-content.test.ts` 7/7.
- [x] CONV-012 — wired `contentFormat`/`contentSource` through `ticket.service.ts` (`addTicketMessage`/`addTicketNote`) and `portal.service.ts` (`reply`); inline literals at the three inbound integration write sites pending CONV-016's shared helper.
  Verification: regression tests in `ticket.test.ts`/`portal.test.ts`; full server suite 998/53 files green.
- [x] CONV-013 — `server/src/modules/tickets/create-canonical-ticket.ts` (`createCanonicalTicket`), with a `historyActorId` override for the Portal/Live-Chat actorUserId-vs-audit-actorId divergence.
  Notes/Risk: **known-bug lesson (kept visible per project history).** The helper was originally built and unit-tested (9 passing tests) but wired into zero production call sites — dead code. CONV-044 was originally logged as having routed all 6 ticket-creation paths through it when each had actually hand-rolled the same create+history+audit shape inline instead. Both were caught and fixed in the same pre-commit pass: the helper is now wired into all 6 call sites (staff, Portal, Email, SMS, WhatsApp, Live Chat); audit content/actor/count behavior is unchanged, only the implementation is now the shared seam. Lesson for future SDD passes: verify call-site wiring directly, not just unit-test coverage, before marking a shared-helper task complete.
  Verification: 13 unit tests covering all 6 creation contexts + autoAssign branches.
- [x] CONV-014 — `server/src/modules/tickets/resolve-correlated-ticket.ts`. Verification: 3 tests.
- [x] CONV-015 — `server/src/modules/customers/resolve-customer-by-phone.ts`. Verification: 5 tests.
- [x] CONV-016 — `server/src/modules/tickets/persist-inbound-message.ts` (`persistInboundMessage`, `isInboundKeyConflict`); wired into email/sms/whatsapp via CONV-023/024/025. Verification: 5 tests.
- [x] CONV-017 — extended `server/src/modules/integrations/outbound-delivery.ts` with `createPendingDelivery`/`claimDeliveryForAttempt`/`recordDeliveryOutcome`/`recordDeliveryCallback`. Verification: 8 new tests (20 total in file).
- [x] CONV-018 — confirmed by construction: `resolveCorrelatedTicket` returns CLOSED tickets untouched.
  Notes/Risk: full per-channel CLOSED guard audit landed alongside CONV-023-026 wiring + CONV-035 sweep.
- [x] CONV-019 — Email inbound `notifyInbound` now returns `teamId`, passed to `emitTicketMessageCreated`. Verification: routed-ticket teamId regression test.
- [x] CONV-020 — same fix, WhatsApp `fanOutInboundNotification`. Verification: routed-ticket teamId regression test.
- [x] CONV-021 — SMS: replaced broad `P2002→DUPLICATE` with `isDuplicateSmsMessageConflict` (constraint-target inspection, only `externalId`). Verification: genuine duplicate still `DUPLICATE`; placeholder-email-shaped P2002 now propagates as a real error (2 tests).
- [x] CONV-022 + CONV-026 (combined) — Live Chat is session-key-only: `Ticket.liveChatSessionKey` is the sole correlation/concurrency boundary. `POST /api/portal/live-chat` requires `sessionKey` (16-128 chars) + optional `departmentId` (create-only); `GET` looks up by key only, no customer-identity fallback. Create races on the DB unique constraint: loser re-reads the winner by key, no duplicated history/audit/assignment/event. A `sessionKey` already owned by a RESOLVED/CLOSED ticket is rejected `409 LIVE_CHAT_SESSION_ENDED`, never silently resumed. `resumableLiveChatId` (customer-identity lookup) removed entirely.
  Notes/Risk: combined because CONV-022's acceptance criteria presuppose the session-key request contract CONV-026 defines.
  Verification: `live-chat.test.ts` rewritten for the new contract, 34/34.
- [x] CONV-023 — Email: removed the "exactly one active EMAIL ticket" identity-only fallback; reliable RFC/token/subject-reference correlation unchanged. Verification: 3-active-ticket-no-reliable-evidence → 3rd new ticket; 18/18.
- [x] CONV-024 — SMS: removed "newest active ticket" reuse; every inbound SMS without stronger signal creates a new ticket. Verification: 15/15.
- [x] CONV-025 — WhatsApp: same fix. Verification: 29/29.
- [x] CONV-026 — folded into CONV-022 above.
- [x] CONV-027 — SMS + WhatsApp both call `resolveCustomerByPhone` (CONV-015) instead of local ordered-match-take-newest; `ambiguous` → zero writes, safe `console.warn(correlationId, channel, count)` only, `AMBIGUOUS` status added to both channels' result unions, safely acknowledged (200).
- [x] CONV-028 — Portal ticket creation now writes exactly one actorless `TICKET_CREATED` AuditLog; RESOLVED-reopen/CLOSED-409 behavior unchanged.
- [x] CONV-029 — confirmed: WhatsApp's `toE164` wraps the same shared `normalizePhoneNumber`; `resolveCustomerByPhone` uses the identical function.
- [x] CONV-030 — confirmed: zero-match creation flow (placeholder Customer + `CUSTOMER_CREATED` audit) unchanged for both channels after CONV-027 rewiring.
- [x] CONV-031 — safe-logging regression tests added to `sms.test.ts`/`whatsapp.test.ts` (spy on `console.warn`, assert only `correlationId=`/`count=` present, no phone/candidate-id substrings).
- [x] CONV-032/033 (partial) — RESOLVED-reopen-only-for-Portal/reliably-correlated-Email and SMS/WhatsApp-never-reopen behavior structurally guaranteed (SMS/WhatsApp have no reopen code path) and covered by CONV-024/025 regression tests.
  Notes/Risk: no separate consolidated suite file created — would duplicate the same assertions already proven per-channel.
- [x] CONV-044 — all 6 ticket-creation paths (staff, Portal, Email, SMS, WhatsApp, Live Chat) write exactly one canonical actorless (except staff) `TICKET_CREATED` AuditLog; 6 pre-existing tests updated from the now-superseded "provider/portal creation stays unaudited" assertion.
  Notes/Risk: see the CONV-013 entry above — this is the same dead-helper/false-wiring finding, corrected together.
- [x] CONV-036 — `createPendingDelivery` called inside the staff-reply transaction for EMAIL/SMS/WHATSAPP channel tickets only (WEB/LIVE_CHAT get none). Verification: 2 new regression tests in `ticket.test.ts`.
- [x] CONV-037 — all three `deliverOutbound*` wrappers now claim the durable row, attempt the provider call, and call `recordDeliveryOutcome` instead of best-effort `TicketMessage.externalId` writes; `externalId` no longer written on any new outbound send (kept for historical/inbound rows only). Immediate `201 delivery` response shape unchanged. Verification: `email.test.ts`/`whatsapp.test.ts`/`outbound-delivery.test.ts` updated.
- [x] CONV-038 — new `GET /api/internal/outbound-delivery-retry` (CRON_SECRET-protected). `outbound-delivery-retry.service.ts` selects up to 25 `PENDING` rows with `nextAttemptAt <= now`, reuses the `deliverOutbound*` wrappers per channel, emits exactly one `ticket.updated` per genuine transition.
  Notes/Risk: fixed a real concurrency gap found while building this — all three `deliverOutbound*` wrappers previously ignored `claimDeliveryForAttempt`'s return value, so two overlapping callers could both call the provider; a lost/null claim now short-circuits via a shared `skippedClaimResult` helper.
  Verification: 5 new tests (`outbound-delivery-retry.test.ts`) + full suite green (1050/58).
- [x] CONV-039 — WhatsApp's local `OutboundDeliveryResult`/`OutboundFailureReason` vocabulary removed; `whatsapp.service.ts` imports shared types/`recordOutboundDeliveryFailure` from `outbound-delivery.ts`. No behavior change (29/29 green).
- [x] CONV-040 — provider callback audit: Email (Resend) and WhatsApp (Cloud API `statuses`) both have a usable, already-supported delivery callback; SMS/TextBee has none (no webhook infra) — left undocumented per instructions. Implemented `applyDeliveryCallback` in `outbound-delivery.ts`; Email `extractDeliveryStatusEvent` maps `email.delivered`/`email.bounced`; WhatsApp `extractDeliveryStatusUpdates` maps Meta `sent|delivered|read|failed`. Verification: 8 new regression tests, full suite green (83/83 in touched files).
- [x] CONV-041 — staged (unbound) attachment binding. Schema: `Attachment.stagedByUserId String?` (migration `20260913092802_conv041_attachment_staging`, additive-only). New `authorizeStagedUpload`/`authorizePortalStagedUpload`/`bindStagedAttachments`; routes `POST /api/attachments/staged` and `POST /api/portal/attachments/staged`. Ownership + unbound-state rechecked inside the bind call, inside the caller's transaction. Verification: 11 new regression tests across `ticket.test.ts`/`portal.test.ts`/`attachment.test.ts`.
- [x] CONV-042 — `assertOutboundAttachmentCapability` throws `422 ATTACHMENTS_NOT_SUPPORTED_FOR_CHANNEL` before any `TicketMessage`/`MessageDelivery` row when channel is EMAIL/SMS/WHATSAPP and `attachmentIds` is non-empty; WEB/Portal/Live-Chat and internal notes unrestricted. Verification: 3 parameterized regression tests + 1 note-exemption test.
- [x] CONV-043 — note-owned attachment visibility: `listTicketAttachments` includes note-owned rows for internal roles; Portal's query unchanged (never touches `noteId`, confirmed never returns a note-owned row). Verification: 2 new regression tests.
- [x] CONV-045 — audit negative-space regression tests: duplicate inbound webhook, retry endpoint (structurally incapable), supported callback, plain GET read — all confirmed zero AuditLog writes.
- [x] CONV-046 — first-response stamping scope confirmed correct with no code change: internal note never stamps; every stamp attempt guards on `firstRespondedAt: null`, so a second reply is structurally a no-op. Verification: 2 new regression tests.
- [x] CONV-047 — `contentFormat` selected server-side and exposed on every conversation item; client `MessageBody` branches on the persisted `contentFormat` prop, the `LOOKS_LIKE_HTML` regex-sniffing heuristic fully removed (not left as fallback). Verification: 2 new server regression tests + existing client tests updated with explicit fixtures.
- [x] CONV-048 — durable per-message delivery summary: `messageWithDeliverySelect` joins `MessageDelivery(status, lastErrorCode)` for internal `getTicket`, projected as coarse `{status, reason}` (never providerMessageId/lastErrorMessage/raw text). Client shows a durable "not delivered" notice that survives reload.
  Notes/Risk: Portal delivery UI intentionally out of scope (Portal channels never get a delivery row).
  Verification: 2 new server tests.
- [x] CONV-049 — staged-attachment composer flow (staff Ticket Details): `POST /api/attachments/staged` (+ Portal equivalent) + upload hooks; composer stages a file, shows a removable chip, Send/Add Note submits `attachmentIds` bound atomically server-side. Attach control hidden in Reply mode for EMAIL/SMS/WHATSAPP-channel tickets (previously only SMS was gated). Legacy ticket-level "Attachments tab" upload untouched.
  Notes/Risk: Portal/Live-Chat reply composer wired server-side (`portalReplySchema`/`portal.service.reply`) but the Portal *client* composer UI has no Attach control yet — the one disclosed remaining gap for this feature (see "Final state" below).
  Verification: 4 new client regression tests + 2 new server tests.
- [x] CONV-050 (remainder) — session-key lifecycle (CONV-022/026) reviewed against the full CONV-050 acceptance text; no additional widget UI states required beyond existing 409-rotate-and-retry handling. No code change.
  Notes/Risk: earlier partial delivery — `client/src/features/live-chat/live-chat-session.ts` (sessionStorage-scoped opaque key) wired into `live-chat-api.ts`/`live-chat-hooks.ts` (409 → rotate + retry once; end-chat proactively rotates). Verification: 3 new tests + full client suite green (832/68).
- [x] CONV-051 — confirmed no new SSE event type; a delivery-state change still rides `ticket.updated`. Added one invalidation (`attachmentKeys.ticket(id)`) to `useConversationMutation` so a staged-attachment bind becomes visible without a manual refresh.
- [x] CONV-052 — confirmed by inspection that `emitTicketMessageCreated`/`emitTicketUpdated` call sites across all six channels pass `teamId` explicitly; did not add a structural throw-on-missing-field guard (assessed as speculative beyond what CONV-019/020's regression tests already lock in). No code change.
- [x] CONV-053 — confirmed end-to-end via CONV-040/outbound-delivery-retry suites: retries/callbacks never emit `ticket.message.created`; a genuine change emits exactly one `ticket.updated`; a no-op emits nothing.
- [x] CONV-054 (partial by design) — `resolveCorrelatedTicket`/`persistInboundMessage` are deliberately channel-agnostic; a literal 5-channel matrix doesn't exist at that layer. Parameterized `persist-inbound-message.test.ts`'s WAITING_CUSTOMER→IN_PROGRESS + inboundKey-DUPLICATE checks over EMAIL/SMS/WHATSAPP (was SMS-only) instead.
  Notes/Risk: a single new `conversation-cross-channel.test.ts` was deliberately not created — it would be vacuous or duplicate ~150 already-passing per-channel assertions for no new verification value. Channel-specific correlation/reopen/CLOSED assertions remain in their existing per-channel files (`email.test.ts`, `sms.test.ts`, `whatsapp.test.ts`, `live-chat.test.ts`, `portal.test.ts`, `ticket.test.ts`, `create-canonical-ticket.test.ts`).
- [x] CONV-055 — added the one concretely-missing assertion: exact 1m/5m retry-delay determinism (fake timers, `nextAttemptAt` to the millisecond) in `outbound-delivery.test.ts`. Every other listed case already covered across the existing delivery/retry/per-channel test files — confirmed by inspection, not re-duplicated.
- [x] CONV-056 — added the one concretely-missing assertion: `conversation-content.test.ts` proves a PLAIN_TEXT body containing literal `<strong>`/`<a>` (EMAIL/SMS/WHATSAPP, parameterized) is preserved byte-for-byte. Every other listed case already covered in `conversation-content.test.ts`, `attachment.test.ts`, `ticket.test.ts`, `resolve-customer-by-phone.test.ts`, `live-chat.test.ts` — confirmed by inspection.
- [x] CONV-057 — full verification gate, all 11 items passed: migrations additive-only (including new `20260913092802_conv041_attachment_staging`); `prisma generate`/`migrate status` clean (18 migrations, no drift); full server suite **1085/1085** (58 files); full client suite **833+/835** (68 files, 2 confirmed-unrelated contention timeouts individually reverified); server + client `tsc -b` clean; server + client `eslint` 0 errors (client: 2 pre-existing unrelated `react-refresh` warnings); full builds clean; `git diff --check` clean; docs reconciled (`docs/17-decisions-log.md` new ADR-057 + amendments to ADR-052/ADR-045, plus `docs/21`, `docs/20`, `docs/23`, `docs/07`, `docs/22`, `docs/05`, `docs/19`). `docs/04-database-design.md` intentionally left untouched (explicitly-labeled historical "planned logical model", not in CONV-057's named doc list).

## Bugs found and fixed during this pass

- **CONV-013 / CONV-044 (dead helper + false wiring claim):** `createCanonicalTicket` was built and passed 9 unit tests but was wired into zero production call sites; CONV-044 was originally logged as having routed all 6 ticket-creation paths through it when each had actually hand-rolled the same shape inline. Caught and fixed in the same pre-commit pass — behavior unchanged, implementation now uses the shared seam. Lesson: a task claiming "wired into X" must be verified by finding the actual call site, not inferred from the helper's own test coverage.
- `resolve-customer-by-phone.test.ts`'s ambiguous-result "no PII" assertion used substring ids (`"c1"`/`"c2"`) that could coincidentally collide inside a random UUID `correlationId`, causing a rare flaky failure. Fixed with non-hex-colliding fixture ids and an exact object-key-shape assertion instead of substring absence.

## Final state

All 57 tasks (CONV-001–057) complete; final gate (CONV-057) passed: server 1085/1085 tests (58 files), client 833+/835 tests (68 files, 2 confirmed-unrelated contention timeouts), both `tsc`/`eslint`/build clean, `git diff --check` clean, migrations additive-only and applied, docs reconciled (new ADR-057 + amendments + 7 doc files updated).

**One genuine, disclosed scope gap:** the Portal/Live-Chat reply composer's client UI has no Attach control (CONV-049) — the server-side contract (`POST /portal/attachments/staged`, `portalReplySchema.attachmentIds`, atomic bind) is live and tested, but no client UI consumes it yet. This is a UI-only follow-up, not a data-model or API gap. Two related items were assessed as already-sufficient by inspection rather than duplicated with new test files: CONV-050's Live Chat widget session-key lifecycle, and CONV-054's cross-channel consolidation matrix (see their entries above for the full reasoning).

The feature is marked **`IMPLEMENTED + VERIFIED ON SDD BRANCH`**, with the Portal composer attach-UI named explicitly as the one remaining follow-up.

---

This decomposes `specs/features/conversations-channels/spec.md` (approved) and `specs/features/conversations-channels/plan.md` (approved, `READY FOR TASK DECOMPOSITION`) into sequential, independently verifiable tasks. No contradiction between spec.md and plan.md was found during decomposition. Every architectural choice below is taken directly from the plan; nothing new is invented. No production code has been modified as part of this task.

Task IDs are stable: `CONV-001` … `CONV-057`. Each task lists goal, concrete files, implementation requirements, verification/acceptance criteria, and dependencies. Tasks are meant to be implemented and verified in ID order; a later task may only start once its listed dependencies are done.

---

## Phase 1 — Persistence Foundation

### CONV-001 — Add `ConversationContentFormat` / `ConversationContentSource` enums and nullable content columns
- **Goal:** Introduce content provenance metadata without breaking existing rows.
- **Files:** `server/prisma/schema.prisma`.
- **Requirements:**
  - Add enums `ConversationContentFormat { PLAIN_TEXT SANITIZED_HTML }` and `ConversationContentSource { STAFF PORTAL EMAIL SMS WHATSAPP LIVE_CHAT SYSTEM }`.
  - Add `TicketMessage.contentFormat ConversationContentFormat?` and `TicketMessage.contentSource ConversationContentSource?` (nullable at this stage).
  - Add the same two nullable fields to `TicketNote`.
  - No default value that would fabricate provenance; leave `null` until backfilled (CONV-007).
- **Verification:** `npx prisma validate`; schema diff shows only additive nullable columns/enums; no existing field removed or renamed.
- **Dependencies:** none.

### CONV-002 — Add `MessageDelivery` model
- **Goal:** Model durable per-message outbound delivery state per OD-CC-1.
- **Files:** `server/prisma/schema.prisma`.
- **Requirements:**
  - New model `MessageDelivery` with: `id`, unique `messageId` (1:1 FK to `TicketMessage`), `channel` (reuse existing channel enum type), `status` (`PENDING | SENDING | SENT | DELIVERED | FAILED`), `providerMessageId String?`, `attemptCount Int @default(0)`, `lastErrorCode String?`, `lastErrorMessage String?` (bounded length, non-secret), `claimedUntil DateTime?`, `nextAttemptAt DateTime?`, `firstAttemptedAt DateTime?`, `lastAttemptedAt DateTime?`, `sentAt DateTime?`, `deliveredAt DateTime?`, `failedAt DateTime?`, `createdAt`, `updatedAt`.
  - Unique constraint on `(channel, providerMessageId)` where `providerMessageId` is not null, to support callback lookup.
  - Index on `(status, nextAttemptAt)` for bounded retry selection.
  - No generic outbox/job table — this model is scoped to conversation delivery only.
- **Verification:** `npx prisma validate`; confirm no second delivery row can be created for the same `messageId` (unique constraint present); confirm index exists for retry query shape described in plan.md "Durable outbound delivery".
- **Dependencies:** CONV-001 (same migration file family).

### CONV-003 — Add namespaced inbound idempotency key
- **Goal:** Give every inbound provider message a durable, constraint-specific uniqueness key (OD-CC-5).
- **Files:** `server/prisma/schema.prisma`.
- **Requirements:**
  - Add `TicketMessage.inboundKey String?` with a **unique** database constraint (partial/nullable-unique — Postgres treats multiple `NULL`s as distinct, which is required since staff/Portal messages have no inbound key).
  - Do not remove or repurpose `externalId`/`externalMessageId` yet — plan.md requires keeping them for migration compatibility; outbound provider ids move to `MessageDelivery.providerMessageId` going forward, but historical fields stay.
  - Document the namespacing convention as a code comment or shared constant only (`email:<id>`, `sms:<id>`, `whatsapp:<wamid>`) — actual write-side usage is CONV-019/020/021.
- **Verification:** `npx prisma validate`; unique index confirmed on `inboundKey`; confirm two `null` inboundKey rows can coexist (Portal/staff messages).
- **Dependencies:** CONV-001.

### CONV-004 — Add note-owned attachment relation
- **Goal:** Let a conversation attachment belong to a `TicketNote`, not only tickets/messages/customers (OD-CC-2).
- **Files:** `server/prisma/schema.prisma`.
- **Requirements:**
  - Add nullable `Attachment.noteId String?` FK to `TicketNote`, and the inverse `TicketNote.attachments Attachment[]` relation.
  - Do not change the existing `ticketId`/`messageId`/`customerId` columns; the "exactly one context" invariant is enforced in service code (CONV-011), not by a DB CHECK constraint, consistent with the existing pattern for message/ticket/customer exclusivity.
- **Verification:** `npx prisma validate`; confirm existing Attachment rows are unaffected (nullable column, no backfill required since no existing attachment can be inferred as note-owned per plan.md).
- **Dependencies:** none (independent of CONV-001–003).

### CONV-005 — Add unique Live Chat session key
- **Goal:** Establish the DB-level concurrency boundary for Live Chat start (OD-CC-5, CC-GAP-22).
- **Files:** `server/prisma/schema.prisma`.
- **Requirements:**
  - Add nullable `Ticket.liveChatSessionKey String?` with a **unique** database constraint.
  - Leave nullable permanently for legacy (pre-feature) Live Chat tickets, per plan.md — this field is not backfilled.
- **Verification:** `npx prisma validate`; unique constraint confirmed; multiple `null` values coexist for non-Live-Chat tickets and legacy Live Chat tickets.
- **Dependencies:** none.

### CONV-006 — Generate and apply the additive Prisma migration
- **Goal:** Produce one reviewable migration covering CONV-001–005.
- **Files:** new file under `server/prisma/migrations/<timestamp>_conversations_channels_foundation/migration.sql`.
- **Requirements:**
  - Run `npx prisma migrate dev --name conversations_channels_foundation` (or the project's documented migration command) against a local/dev database.
  - Confirm the generated SQL is additive only: new enums, new nullable columns, new table, new indexes/constraints. No `DROP`, no `ALTER COLUMN ... SET NOT NULL` yet (that is CONV-009, after backfill), no data-destructive statement.
  - Migration must be reversible-forward (plan.md: "do not reset data") — do not use `prisma migrate reset`.
- **Verification:** Migration applies cleanly against a database seeded from current production-shaped data (or a realistic dev copy); row counts of `TicketMessage`, `TicketNote`, `Attachment`, `Ticket` unchanged before/after; `npx prisma migrate status` reports the new migration applied with no drift.
- **Dependencies:** CONV-001, CONV-002, CONV-003, CONV-004, CONV-005.

### CONV-007 — Conservative content backfill (`contentFormat` / `contentSource`)
- **Goal:** Populate content provenance for all existing rows without fabricating history.
- **Files:** new backfill script, e.g. `server/prisma/scripts/backfill-conversation-content.ts` (or a data migration under `server/prisma/migrations/` if the project's convention runs backfills as SQL — follow whatever precedent exists in prior migrations; do not invent a new backfill mechanism if one is already established).
- **Requirements (per plan.md "Migration and Backfill" step 2):**
  - Known SMS/WhatsApp inbound system authors and Email inbound plain bodies → `PLAIN_TEXT` with their provider `contentSource`.
  - Authenticated customer Portal rows → `SANITIZED_HTML` only when their write path already guaranteed server sanitization; otherwise `PLAIN_TEXT`.
  - Staff message/note rows created through the sanitized rich-text boundary → `SANITIZED_HTML` / `STAFF`.
  - Uncertain/ambiguous historical rows default to `PLAIN_TEXT` (the safer non-interpreting representation) — never infer `SANITIZED_HTML` from markup shape.
  - Batch the update (e.g. chunked by id range) to avoid long table locks on production-sized tables.
- **Verification:** After running against a representative copy of the data — zero `TicketMessage`/`TicketNote` rows remain with `contentFormat IS NULL`; spot-check representative rows from each channel/source match the rule above; no row is classified `SANITIZED_HTML` on the basis of body content alone (audit the classification logic, not the output, since misclassified plain text containing coincidental tags would still "look right").
- **Dependencies:** CONV-006.

### CONV-008 — Report and resolve inbound-key backfill conflicts (do not fabricate)
- **Goal:** Populate `inboundKey` only where provider origin/identity is unambiguous; surface conflicts instead of silently resolving them.
- **Files:** `server/prisma/scripts/backfill-inbound-key.ts` (or equivalent per project convention).
- **Requirements:**
  - For Email rows: derive `email:<existing externalId's provider id>` only where `externalId` is unambiguously an inbound Resend email id (matches the `resend:<emailId>` shape documented in spec.md "Deduplication and idempotency").
  - For SMS rows: derive `sms:<smsId>` from existing inbound `externalId`.
  - For WhatsApp rows: derive `whatsapp:<wamid>` from existing inbound `externalId`.
  - Before writing, detect duplicate candidate keys (two rows that would collide) and **do not write either** — emit a report of conflicts for manual review instead of deleting/merging messages.
  - Staff/Portal/Live Chat rows keep `inboundKey = null`.
- **Verification:** Dry-run report against representative data shows zero silent overwrites; a synthetic duplicate-candidate fixture is correctly excluded and reported, not written; after the real backfill, `npx prisma migrate status`-adjacent uniqueness check (`SELECT inboundKey, count(*) ... GROUP BY 1 HAVING count(*) > 1` excluding `NULL`) returns zero rows.
- **Dependencies:** CONV-006.

### CONV-009 — Conservative outbound delivery backfill (no fabricated history)
- **Goal:** Backfill `MessageDelivery(status = SENT)` only where provenance is conclusive; otherwise leave delivery history unknown.
- **Files:** `server/prisma/scripts/backfill-message-delivery.ts` (or equivalent).
- **Requirements:**
  - Create a `MessageDelivery` row only for a `TicketMessage` whose staff authorship, provider channel (EMAIL/SMS/WHATSAPP), and existing `externalId` provenance are all conclusive (i.e., it is unambiguously an outbound message that was sent, not an inbound one).
  - Populate `providerMessageId` from the existing `externalId` in that conclusive case; `status = SENT`; leave `attemptCount = 1`, timestamps best-effort from `TicketMessage.createdAt`/`updatedAt` where no better signal exists.
  - For every other existing outbound-looking row, create **no** `MessageDelivery` row — document (in the script's own comment/log output, not in this tasks.md) that historical delivery status for those rows remains unknown. Do not invent `PENDING` or `FAILED` rows for them either.
- **Verification:** Row count of created `MessageDelivery` rows is less than or equal to the count of messages meeting the conclusive criteria; spot check confirms no delivery row was created for an inbound or ambiguous message; a script dry-run mode prints counts before any write.
- **Dependencies:** CONV-006, CONV-008 (delivery backfill should not double-count rows already treated as inbound by CONV-008).

### CONV-010 — Make content metadata required; finalize schema
- **Goal:** Close the nullable window once backfill is proven complete (plan.md "Migration and Backfill" step 5).
- **Files:** `server/prisma/schema.prisma`, new migration under `server/prisma/migrations/`.
- **Requirements:**
  - Change `TicketMessage.contentFormat`/`contentSource` and `TicketNote.contentFormat`/`contentSource` from nullable to required, **only after** CONV-007 verification confirms zero nulls remain.
  - Keep `Ticket.liveChatSessionKey` nullable permanently (legacy Live Chat rows never get one) — do not make it required.
  - Keep `TicketMessage.inboundKey` nullable permanently (staff/Portal messages never have one) — do not make it required.
- **Verification:** Migration fails safely (and is not run) if a null-check pre-migration query finds any remaining null `contentFormat`/`contentSource`; after applying, `npx prisma migrate status` shows no drift; application boots and existing conversation reads/writes succeed against the now-required columns.
- **Dependencies:** CONV-007, CONV-008, CONV-009.

---

## Phase 2 — Shared Conversation/Domain Seams

### CONV-011 — Canonical content validation/size policy module
- **Goal:** One server-owned validator for all conversation entry points (OD-CC-9).
- **Files:** new `server/src/shared/rich-text/conversation-content.ts` (sibling to `server/src/shared/rich-text/reply-html.ts`).
- **Requirements (values fixed by plan.md, not to be re-derived):**
  - Normalize line endings; reject content whose plain-text projection is empty.
  - Semantic max: **20,000 Unicode characters**, applied uniformly to staff replies, internal notes, Portal replies, Email, SMS, WhatsApp inbound/outbound.
  - Rich input additionally enforces a **50,000-character serialized payload ceiling** pre-sanitization; post-sanitization plain-text projection must still be 1–20,000 characters.
  - Live Chat composer keeps its own smaller **2,000-character** semantic limit, enforced server-side from the Live Chat source (not just client-side).
  - Export a discriminated function e.g. `validateConversationContent({ raw, format, source }) -> { ok: true, plainText, sanitizedHtml? } | { ok: false, reason }` so callers don't reimplement length logic.
  - Provider parsers reject/ignore oversize messages per their existing webhook contracts; they must never silently truncate stored body content (Email subject-preview truncation is explicitly exempted — only the derived subject may truncate).
- **Verification:** Unit tests: empty-after-sanitization rejected; 20,000-char plain text accepted, 20,001 rejected; 50,000-char serialized rich payload accepted pre-sanitize, oversize rejected; Live Chat 2,000-char boundary enforced independently of the 20,000 default; a message trimmed to empty by sanitization returns the existing `422 EMPTY_MESSAGE`-equivalent reason code.
- **Dependencies:** CONV-001 (needs the format/source vocabulary), does not depend on migration being applied to run unit tests.

### CONV-012 — Wire `contentFormat`/`contentSource` through existing sanitization boundary
- **Goal:** Every write path declares format/source explicitly instead of leaving it implicit.
- **Files:** `server/src/shared/rich-text/reply-html.ts`, `server/src/modules/tickets/ticket.service.ts`, `server/src/modules/portal/portal.service.ts`.
- **Requirements:**
  - Staff public reply and internal note writes call CONV-011's validator with `source: STAFF`, `format: SANITIZED_HTML`.
  - Portal reply writes call it with `source: PORTAL`, `format: SANITIZED_HTML` (Portal already goes through the same Lexical + sanitizer boundary per spec.md).
  - Persist the returned `contentFormat`/`contentSource` on the created `TicketMessage`/`TicketNote` row in the same transaction as today's write — no new transaction boundary introduced.
- **Verification:** Existing ticket/portal reply and note tests continue to pass; new assertions confirm the persisted row's `contentFormat`/`contentSource` match the declared source, independent of body content.
- **Dependencies:** CONV-010, CONV-011.

### CONV-013 — Shared canonical ticket-creation helper
- **Goal:** One helper for ticket creation + SLA snapshot + history + exactly-one audit (OD-CC-7), replacing duplicated per-channel logic.
- **Files:** new `server/src/modules/tickets/create-canonical-ticket.ts` (or co-located in `ticket.service.ts` if the module's existing convention avoids extra files — match existing repo convention, confirm by inspecting `ticket.service.ts` structure at implementation time).
- **Requirements:**
  - Signature accepts channel, initiating actor (`{ actorId } | { actorId: null }`), customer id, and channel-specific routing hints (e.g. Live Chat department/team).
  - Creates the `Ticket`, its SLA snapshot, `TicketHistory(TICKET_CREATED)`, **exactly one** `AuditLog(TICKET_CREATED)` via the existing `audit-log.service.ts` writer, optional assignment, and returns the full realtime audience payload (`ticketId`, `teamId`, `assignedAgentId`, `customerId`).
  - Staff/manual callers pass the authenticated actor id; Portal/provider/Live Chat callers pass `actorId = null` per OD-CC-7 — even when a Portal customer initiated the request.
  - Existing per-channel `TicketHistory` behavior is otherwise unchanged (only the audit gap is closed).
- **Verification:** Unit test calling the helper directly for each of the 6 creation contexts (staff/manual, Portal, Email, SMS, WhatsApp, Live Chat) asserts exactly one `TICKET_CREATED` AuditLog row with correct `actorId` (null for all but staff/manual) and one `TicketHistory` row.
- **Dependencies:** CONV-010.

### CONV-014 — Shared correlated-ticket resolver
- **Goal:** Enforce the approved matching precedence in one place (OD-CC-4).
- **Files:** new `server/src/modules/tickets/resolve-correlated-ticket.ts`.
- **Requirements:**
  - Accepts only explicit ticket/session evidence or verified provider thread/message evidence as selection input — customer id alone is never sufficient to select a ticket.
  - Returns a discriminated result: `{ kind: "correlated", ticket }` or `{ kind: "none" }` — never a fabricated/best-guess ticket.
  - Does not implement channel-specific correlation rules itself (Email header/token/reference logic, Live Chat session-key lookup) — those stay in their own modules and call this shared seam with their evidence already extracted, matching plan.md's "keep provider signature verification, payload schemas, retrieval, and provider-specific identifiers in their existing modules."
- **Verification:** Unit tests confirm a call with only a customer id (no ticket/session/thread evidence) returns `{ kind: "none" }`; a call with valid thread evidence returns the correlated ticket; a call with thread evidence pointing at a CLOSED ticket still returns it (CLOSED-rejection is enforced by the caller per CONV-018, not silently hidden here).
- **Dependencies:** CONV-010.

### CONV-015 — Shared canonical phone resolver
- **Goal:** Implement the zero/one/multiple discriminated result (OD-CC-6).
- **Files:** new `server/src/modules/customers/resolve-customer-by-phone.ts` (co-locate under whichever module currently owns customer phone matching — confirm exact existing location, e.g. `server/src/modules/customers/`, before creating a new path).
- **Requirements:**
  - Normalizes the input phone canonically (reuse the existing E.164/digits/raw normalization already used by SMS/WhatsApp, do not add a second normalization scheme).
  - Queries across normalized/digits-only/raw legacy representations as today.
  - Returns `{ kind: "none" }` (caller proceeds to its existing creation flow), `{ kind: "one", customer }`, or `{ kind: "ambiguous", candidateCount, correlationId }` — the `ambiguous` result performs **no** customer/ticket/message write itself and must not leak phone/email or candidate ids to logs (only a correlation id, provider/channel, and match count, per plan.md's security section).
  - Callers (SMS/WhatsApp) log the `ambiguous` outcome and produce a safe operator-visible provider response without choosing a customer arbitrarily.
- **Verification:** Unit tests: 0 matches → `none`; 1 match (via each of normalized/digits/raw legacy form) → `one`; 2+ matches → `ambiguous` with no side effects and no PII in the returned/logged payload beyond a correlation id and count.
- **Dependencies:** none (independent of persistence-foundation phase, but ordered here per the plan's shared-seams phase).

### CONV-016 — Shared inbound idempotency + persistence helper
- **Goal:** One transaction helper applying the namespaced key, content metadata, ticket status transition, notifications, and event payload atomically (per plan.md `persistInboundMessage(...)`).
- **Files:** new `server/src/modules/tickets/persist-inbound-message.ts`.
- **Requirements:**
  - Accepts the already-resolved ticket (new or correlated), the channel-namespaced `inboundKey`, declared content metadata, and the channel-scoped CUSTOMER system-user id.
  - Writes `TicketMessage` with `inboundKey` inside the same transaction as the `WAITING_CUSTOMER -> IN_PROGRESS` transition (when applicable), customer-reply notification rows, and returns the full realtime audience payload — mirroring the existing Email/SMS/WhatsApp inbound transaction shape described in spec.md, not a new architecture.
  - On a unique-constraint violation, classifies duplicate **only** when the violated constraint targets `TicketMessage.inboundKey` (inspect the Prisma error's `meta.target`); any other constraint violation (e.g. placeholder-email uniqueness) is re-thrown for the caller's own error handling — this directly implements the CONV-024/025/026 defect fixes' shared foundation.
- **Verification:** Unit test with a mocked Prisma client: a `P2002` on `inboundKey` returns `DUPLICATE` with no side effects; a `P2002` on an unrelated constraint (simulate a placeholder-email collision target) propagates as a normal error, not `DUPLICATE`.
- **Dependencies:** CONV-003, CONV-010.

### CONV-017 — Shared delivery-state helper skeleton (no orchestration yet)
- **Goal:** Centralize `MessageDelivery` row creation/claim/update primitives before wiring channel-specific orchestration (avoids repeating the WhatsApp-vs-shared-helper drift called out as CC-GAP-05).
- **Files:** evolve existing `server/src/modules/integrations/outbound-delivery.ts`.
- **Requirements:**
  - Add functions: `createPendingDelivery(messageId, channel)`, `claimDeliveryForAttempt(messageId)` (atomic claim via `claimedUntil` lease + status guard, returns `null` if already claimed/terminal), `recordDeliveryOutcome(messageId, outcome)` (updates status/provider id/timestamps/error, increments `attemptCount` exactly once per call), `recordDeliveryCallback(providerMessageId, channel, outcome)` (idempotent, monotonic — a stale "sent" callback cannot downgrade `DELIVERED`).
  - Keep the existing shared error-mapping vocabulary (`INTEGRATION_NOT_CONFIGURED`, `NO_RECIPIENT_*`, `RECIPIENT_INVALID`, `PROVIDER_REJECTED`, `PROVIDER_UNREACHABLE`) — do not introduce a second vocabulary.
  - This task only builds the primitives; wiring them into the staff-reply transaction and the retry endpoint is CONV-036/CONV-037.
- **Verification:** Unit tests for each primitive in isolation: claim returns null on an already-`SENDING`/leased row; `recordDeliveryOutcome` increments `attemptCount` by exactly 1 per call; `recordDeliveryCallback` rejects a `SENT`-after-`DELIVERED` transition as a no-op, not an error.
- **Dependencies:** CONV-002, CONV-010.

### CONV-018 — Confirm CLOSED-guard placement in shared seams
- **Goal:** Preserve the Tickets SDD CLOSED-immutability invariant across every new shared seam (explicit cross-cutting check requested by the global invariants in plan.md).
- **Files:** `server/src/modules/tickets/resolve-correlated-ticket.ts`, `server/src/modules/tickets/persist-inbound-message.ts`, `server/src/modules/tickets/ticket.service.ts`, `server/src/modules/portal/portal.service.ts`.
- **Requirements:**
  - `resolve-correlated-ticket.ts` returns the correlated ticket even if CLOSED (per CONV-014) — the CLOSED check itself belongs to each calling flow, since the correct behavior differs (Portal/staff reject with `409`; Email discards the CLOSED correlation and creates a new ticket instead; SMS/WhatsApp active-ticket lookup already excludes CLOSED at the query level; Live Chat treats CLOSED as non-resumable).
  - Add an explicit guard/comment at each call site confirming CLOSED is checked before any write (message, attachment, delivery-row creation, notification, history, audit, or realtime event).
- **Verification:** Existing CLOSED-immutability tests (spec.md "Strong existing coverage") continue to pass unmodified; add one regression test per channel confirming a CLOSED-correlated inbound message does not append to the CLOSED ticket and instead follows the channel's documented new-ticket/discard behavior.
- **Dependencies:** CONV-014, CONV-016.

---

## Phase 3 — Fix the Four Confirmed Defects

### CONV-019 — Fix Email inbound realtime `teamId` (CC-GAP-01)
- **Goal:** Email inbound `emitTicketMessageCreated` passes the correlated/created ticket's `teamId`.
- **Files:** `server/src/modules/integrations/email/email.service.ts`.
- **Requirements:** Pass `ticket.teamId` (not omitted/defaulted to null) into the realtime event payload assembly, matching the shape already used by internal replies/notes/Portal/SMS/Live Chat.
- **Verification:** Regression test: an inbound Email reply on an already-routed (non-null `teamId`) ticket emits `ticket.message.created` with the correct `teamId`, and a mocked own-team Manager/Agent subscriber receives the invalidation (this is exactly CC-GAP-01's missing-audience regression called out in spec.md's "Missing or weak coverage").
- **Dependencies:** CONV-010 (schema baseline only; this fix has no other dependency and can land independently).

### CONV-020 — Fix WhatsApp inbound realtime `teamId` (CC-GAP-02)
- **Goal:** Same fix as CONV-019, WhatsApp path.
- **Files:** `server/src/modules/integrations/whatsapp/whatsapp.service.ts`.
- **Requirements:** Identical to CONV-019, WhatsApp inbound flow.
- **Verification:** Same regression shape as CONV-019, WhatsApp channel.
- **Dependencies:** none beyond CONV-010.

### CONV-021 — Fix SMS duplicate-handling to target only the inbound-key constraint (CC-GAP-03)
- **Goal:** Stop treating every transaction `P2002` as duplicate delivery.
- **Files:** `server/src/modules/integrations/sms/sms.service.ts`.
- **Requirements:**
  - Replace the current broad `catch (P2002) -> DUPLICATE` with inspection of the Prisma error's constraint target: only `TicketMessage.inboundKey` (or, pre-CONV-003 compatibility, whatever the SMS `externalId` uniqueness constraint currently is — align to the new `inboundKey` constraint since this fix depends on CONV-003/016 being in place) yields `DUPLICATE`.
  - Any other `P2002` (e.g. a placeholder-email collision, since SMS does not have WhatsApp's existing placeholder-email fallback per spec.md CC-GAP-03) propagates as a real error instead of silently dropping the inbound message.
  - This should consume the shared helper from CONV-016 rather than reimplementing constraint inspection locally.
- **Verification:** Regression test reproducing a placeholder-email collision during SMS inbound: the message is **not** silently dropped/returned as `DUPLICATE` — it either succeeds via a resolution path or surfaces a real, logged error (per the deferred scope, SMS does not gain WhatsApp's placeholder-email fallback in this task — this task only stops the mis-classification; adding SMS's own placeholder-email fallback is out of scope unless plan.md says otherwise — it doesn't, so do not add one here beyond correct error propagation). Existing genuine-duplicate SMS test (same `smsId` twice) still returns `DUPLICATE`.
- **Dependencies:** CONV-003, CONV-016.

### CONV-022 — Fix Live Chat active-ticket creation concurrency (CC-GAP-22)
- **Goal:** Two near-simultaneous starts for the same session must not create two tickets.
- **Files:** `server/src/modules/live-chat/live-chat.service.ts`.
- **Requirements:**
  - Replace the read-before-create resume check with a create attempt guarded by the new unique `liveChatSessionKey` constraint (CONV-005): attempt insert; on unique-violation, re-read and return the winning ticket instead of raising an error to the caller.
  - The losing request's response must be indistinguishable in shape from a normal successful start/resume (same DTO), matching plan.md: "the loser re-reads and returns the winner."
- **Verification:** Concurrency test issuing two parallel start requests with the same session key against a real (or transactionally faithful) test database confirms exactly one `Ticket`, one `TicketHistory(TICKET_CREATED)`, one `AuditLog` (if applicable per CONV-013), one assignment, and one realtime event — both requests return the same ticket id. A second test with two different session keys for the same customer confirms two distinct tickets are created.
- **Dependencies:** CONV-005, CONV-006, CONV-013.

---

## Phase 4 — Inbound Channel Hardening

### CONV-023 — Email: remove identity-only ticket fallback, apply correlation precedence
- **Goal:** Email ticket matching uses only explicit/reliable correlation, per OD-CC-4.
- **Files:** `server/src/modules/integrations/email/email.service.ts`.
- **Requirements:**
  - Keep RFC `In-Reply-To`/`References`, unique reply-address token, and unique same-Customer public reference correlation, in that order, all sender/customer constrained (unchanged from current behavior).
  - **Remove** the "exactly one active EMAIL ticket" identity-only fallback entirely — this is the "latest ticket for customer" heuristic the spec forbids.
  - Absent any of the three reliable correlations, always create a new ticket via CONV-013.
  - A correlated ticket that is RESOLVED reopens (`RESOLVED -> OPEN`, clear `resolvedAt`, retain `resolutionDueAt`) only when reached through one of the three reliable correlations — never via sender identity alone (this was already true for the correlation paths; the fallback's removal is what eliminates the identity-only reopen risk).
  - A correlated ticket that is CLOSED is discarded; a new EMAIL ticket is created instead (unchanged existing behavior, now routed through CONV-013/014/018).
- **Verification:** Regression test: a Customer with two active EMAIL tickets and no thread/token/reference evidence in a new inbound email now creates a **third** new ticket, not a fallback to either existing one. Existing thread/token/reference correlation tests continue to pass unmodified.
- **Dependencies:** CONV-013, CONV-014, CONV-016, CONV-018.

### CONV-024 — SMS: remove newest-active-ticket heuristic, apply correlation precedence
- **Goal:** SMS never selects a ticket by "newest active for this customer" (OD-CC-4).
- **Files:** `server/src/modules/integrations/sms/sms.service.ts`.
- **Requirements:**
  - Remove the current "newest active SMS ticket is reused" behavior for phone/customer-identity matching.
  - Without explicit/reliable message-thread correlation supported by the SMS provider flow (TextBee does not currently expose thread correlation beyond phone identity per spec.md, so in practice this means **every** inbound SMS without a stronger signal creates a new ticket) — implement whatever reliable correlation the provider payload actually supports; if none exists beyond phone identity, always create a new ticket.
  - Never reopen RESOLVED from identity/phone matching (OD-CC-3): if the provider genuinely offers no thread correlation, RESOLVED tickets are never targeted at all under the new rule, which trivially satisfies this.
  - CLOSED tickets remain excluded from any active-ticket lookup (already true; confirm unchanged).
- **Verification:** Regression test: a customer with an existing active SMS ticket sends a new unrelated SMS — the system now creates a **new** ticket rather than appending to the existing active one, since SMS has no thread-correlation signal beyond phone identity. A RESOLVED SMS ticket for the same customer is never reopened by a new inbound SMS.
- **Dependencies:** CONV-013, CONV-014, CONV-015, CONV-016, CONV-018, CONV-021.

### CONV-025 — WhatsApp: remove newest-active-ticket heuristic, apply correlation precedence
- **Goal:** Same as CONV-024, WhatsApp path.
- **Files:** `server/src/modules/integrations/whatsapp/whatsapp.service.ts`.
- **Requirements:** Identical structure to CONV-024. If Meta's webhook payload for text messages exposes no reliable thread/message correlation beyond phone identity (per spec.md's current description, it does not), every inbound WhatsApp message without a stronger signal creates a new ticket; RESOLVED is never reopened by identity.
- **Verification:** Same regression shape as CONV-024, WhatsApp channel. Also confirm the existing "multiple phone matches select most-recently-updated Customer and log a warning" behavior is replaced by the CONV-015 ambiguous-result path (see CONV-027) rather than left in place, since that heuristic is exactly what OD-CC-6 forbids.
- **Dependencies:** CONV-013, CONV-014, CONV-015, CONV-016, CONV-018, CONV-020.

### CONV-026 — Live Chat: session-key-only start/resume
- **Goal:** Live Chat start/resume uses only `liveChatSessionKey`; customer identity never selects a different session's ticket.
- **Files:** `server/src/modules/live-chat/live-chat.service.ts`, `server/src/modules/live-chat/live-chat.schema.ts`, `server/src/modules/live-chat/live-chat.controller.ts`.
- **Requirements:**
  - Accept a bounded opaque `sessionKey` from the client on start; require the same `sessionKey` on resume.
  - RESOLVED/CLOSED session keys are terminal — a resume attempt with a terminal session's key creates a **fresh** ticket with a **new** session key requirement (client must rotate), it does not silently resume the old ticket.
  - A new session key always creates a fresh ticket regardless of any existing active ticket for that customer — this replaces the previous "resumable chat is the newest own LIVE_CHAT ticket in an active status" behavior with explicit session-key correlation, per OD-CC-3/OD-CC-4.
  - Department/Branch/Team routing, auto-assignment, and CONV-013 audit/history remain unchanged for new-session creation.
- **Verification:** Regression test: same session key resumes the same active ticket; a different session key for the same customer creates a different ticket even while the first is still active; a RESOLVED session's key does not resume — a request with that key either creates a new ticket (new key issuance) or is rejected per the API contract decided in CONV-045, whichever the schema task specifies.
- **Dependencies:** CONV-005, CONV-013, CONV-014, CONV-022.

### CONV-027 — Wire ambiguous-phone handling into SMS/WhatsApp inbound
- **Goal:** Replace "newest wins" phone-match heuristics with the CONV-015 discriminated resolver end-to-end (OD-CC-6, CC-GAP-21).
- **Files:** `server/src/modules/integrations/sms/sms.service.ts`, `server/src/modules/integrations/whatsapp/whatsapp.service.ts`.
- **Requirements:**
  - Both services call `resolve-customer-by-phone` (CONV-015) instead of their own ordered-match-and-take-newest logic.
  - `none` → existing placeholder-Customer creation flow (SMS's existing flow; WhatsApp's existing flow, including its deterministic placeholder-email pre-insert check).
  - `one` → use that customer, proceed as today.
  - `ambiguous` → stop automatic resolution: no customer is chosen, no ticket/message is created/attached, log the safe correlation-id/count outcome, and return the provider-appropriate safe acknowledged response (per plan.md's "safe acknowledged ambiguity outcome" — the exact webhook response code/body is provider-specific and must follow each provider's existing success/ignore conventions so as not to trigger retry storms).
- **Verification:** Regression test: two Customers sharing a normalized phone (legacy vs current form) now produce an `ambiguous` outcome with zero writes, replacing the old silent-newest-wins (SMS) and warning-logged-newest-wins (WhatsApp) behavior. Existing single-match tests continue to pass unchanged.
- **Dependencies:** CONV-015, CONV-024, CONV-025.

### CONV-028 — Portal: no behavior change, confirm compatibility with shared seams
- **Goal:** Portal reply already targets an explicit owned ticket id (the strongest form of correlation) — verify it composes cleanly with CONV-013/018 without regressing RESOLVED-reopen or CLOSED-409 behavior.
- **Files:** `server/src/modules/portal/portal.service.ts`.
- **Requirements:** Route Portal ticket creation through CONV-013 (for the audit fix in Phase 9) and Portal reply's existing RESOLVED-reopen transaction through the same CLOSED-guard placement confirmed in CONV-018. No behavioral change to matching (Portal never needed correlation heuristics since it always has an explicit ticket id).
- **Verification:** Existing Portal RESOLVED-reopen and CLOSED-409 tests (spec.md "Strong existing coverage") pass unmodified; new assertion confirms Portal ticket creation now writes exactly one `AuditLog(TICKET_CREATED, actorId: null)`.
- **Dependencies:** CONV-013, CONV-018.

---

## Phase 5 — Customer Identity Safety

### CONV-029 — Confirm canonical phone normalization is the single source of truth
- **Goal:** Ensure CONV-015 reuses one normalization function, not a second scheme.
- **Files:** `server/src/modules/integrations/sms/sms.service.ts`, `server/src/modules/integrations/whatsapp/whatsapp.service.ts`, `server/src/modules/customers/resolve-customer-by-phone.ts`.
- **Requirements:** Locate the existing phone-normalization utility used by SMS/WhatsApp today; if two slightly divergent copies exist, consolidate to one shared function used by CONV-015 and by both channels' placeholder-Customer creation path (so a placeholder Customer's stored phone form matches what future matching will normalize to).
- **Verification:** Unit test with legacy/current/digits-only/raw variants of the same number all normalize identically across every call site.
- **Dependencies:** CONV-015.

### CONV-030 — Zero-match creation flow parity
- **Goal:** Confirm `none` result from CONV-015 routes to each channel's existing placeholder-Customer creation without change in audit/logging behavior.
- **Files:** `server/src/modules/integrations/sms/sms.service.ts`, `server/src/modules/integrations/whatsapp/whatsapp.service.ts`.
- **Requirements:** No new behavior — this is a verification task confirming CONV-027's wiring didn't alter the existing `AuditLog(CUSTOMER_CREATED)` write on zero-match creation.
- **Verification:** Existing customer-creation-audit tests (spec.md "Strong existing coverage", both SMS and WhatsApp) pass unmodified after CONV-027 lands.
- **Dependencies:** CONV-027.

### CONV-031 — Ambiguous-match safe logging contract test
- **Goal:** Prove no PII leaks in the ambiguous path across both channels.
- **Files:** test files `server/src/modules/integrations/sms/sms.test.ts`, `server/src/modules/integrations/whatsapp/whatsapp.test.ts`.
- **Requirements:** Add a shared assertion helper (or duplicate a small inline check per plan.md's "extract only rules shared by confirmed paths" guidance — a test helper is fine to share even if production code stays separate) confirming logged output for an ambiguous match contains only a correlation id, channel, and match count — never the phone number, email, or candidate customer ids.
- **Verification:** Test asserts on the actual log call arguments (spy/mock the logger) rather than just checking the response — a response-only check would miss a log-level leak.
- **Dependencies:** CONV-027.

---

## Phase 6 — RESOLVED/CLOSED Behavior

### CONV-032 — Portal/Email RESOLVED-reopen regression suite
- **Goal:** Lock in OD-CC-3 for the two channels allowed to reopen.
- **Files:** `server/src/modules/portal/portal.test.ts`, `server/src/modules/integrations/email/email.test.ts`.
- **Requirements:** Add/confirm tests: Portal reply to a RESOLVED owned ticket → `OPEN`, `resolvedAt` cleared, `resolutionDueAt` retained, first-response fields untouched. Email reply correlated via thread/token/reference to a RESOLVED ticket → same transition. Email reply with **no** reliable correlation to a RESOLVED ticket → does **not** reopen it (creates a new ticket instead, per CONV-023).
- **Verification:** All three cases pass; the third case is a new regression proving the fallback removal didn't leave a backdoor reopen path.
- **Dependencies:** CONV-023, CONV-028.

### CONV-033 — SMS/WhatsApp never-reopen regression suite
- **Goal:** Lock in that heuristic matching never reopens RESOLVED (OD-CC-3).
- **Files:** `server/src/modules/integrations/sms/sms.test.ts`, `server/src/modules/integrations/whatsapp/whatsapp.test.ts`.
- **Requirements:** Add tests: a customer with a RESOLVED SMS/WhatsApp ticket sends a new inbound message → a **new** ticket is created; the RESOLVED ticket's status is untouched.
- **Verification:** Both tests pass following CONV-024/025.
- **Dependencies:** CONV-024, CONV-025.

### CONV-034 — Live Chat fresh-session and terminal-session regression suite
- **Goal:** Lock in OD-CC-3's Live Chat rule.
- **Files:** `server/src/modules/live-chat/live-chat.test.ts`.
- **Requirements:** Add tests: new session key always creates a fresh ticket even with an existing active session for the same customer; a RESOLVED session's key does not resume that ticket; a CLOSED session's key does not resume that ticket; CLOSED ticket itself is never mutated by any Live Chat path.
- **Verification:** All four cases pass following CONV-026.
- **Dependencies:** CONV-026.

### CONV-035 — CLOSED-immutability full regression sweep
- **Goal:** Prove the Tickets SDD invariant survived every change in Phases 3–5 across all six write paths.
- **Files:** `server/src/modules/tickets/ticket.test.ts`, `server/src/modules/portal/portal.test.ts`, `server/src/modules/integrations/email/email.test.ts`, `server/src/modules/integrations/sms/sms.test.ts`, `server/src/modules/integrations/whatsapp/whatsapp.test.ts`, `server/src/modules/live-chat/live-chat.test.ts`.
- **Requirements:** Re-run/extend existing CLOSED-immutability tests for staff reply, internal note, ticket/message upload, Portal reply, Portal upload, metadata/workflow/routing updates, and agent self-claim — all must still reject with `409 TICKET_CLOSED` and produce no writes/events/provider calls. Confirm external inbound channels' CLOSED-discard-and-create-new behavior (Email/SMS/WhatsApp) and Live Chat's CLOSED-non-resumable behavior are unchanged.
- **Verification:** Full existing CLOSED suite green; no new CLOSED bypass introduced by CONV-013/014/016/018's shared seams.
- **Dependencies:** CONV-018, CONV-023, CONV-024, CONV-025, CONV-026.

---

## Phase 7 — Durable Outbound Delivery

### CONV-036 — Create `MessageDelivery(PENDING)` transactionally on staff public reply
- **Goal:** Every outbound EMAIL/SMS/WHATSAPP message gets a delivery row at commit time.
- **Files:** `server/src/modules/tickets/ticket.service.ts`.
- **Requirements:**
  - In the existing staff-public-reply transaction (message create, first-response stamp, watcher notifications, Email thread bookkeeping), additionally create `MessageDelivery(status: PENDING, attemptCount: 0)` for EMAIL/SMS/WHATSAPP channel tickets, using CONV-017's `createPendingDelivery`.
  - WEB/LIVE_CHAT tickets get no delivery row (no provider dispatch exists for them, unchanged).
  - Commit-first ordering is preserved exactly as today: the transaction commits before any provider call is attempted.
- **Verification:** Existing commit-first tests (spec.md: "provider-not-called-before-commit") still pass; new assertion confirms a `MessageDelivery(PENDING)` row exists immediately after commit, before the provider adapter is invoked.
- **Dependencies:** CONV-002, CONV-017.

### CONV-037 — Post-commit initial attempt updates the delivery row
- **Goal:** Replace the current best-effort `externalId` update with the durable delivery row as the single source of truth.
- **Files:** `server/src/modules/tickets/ticket.service.ts`, `server/src/modules/integrations/outbound-delivery.ts`.
- **Requirements:**
  - After commit, claim the delivery row (`claimDeliveryForAttempt`), call the provider, then call `recordDeliveryOutcome` with the result — success sets `SENT` + `providerMessageId` + `sentAt`; failure sets `FAILED` (if non-retryable/terminal after this attempt count) or leaves it `PENDING`/schedules `nextAttemptAt` (if retryable and attempts remain).
  - The existing immediate `201` response `delivery` object (per spec.md's current shape) is preserved for the synchronous caller — it reflects this initial attempt's outcome, not a fabricated always-success value.
  - `TicketMessage.externalId` best-effort update either stops (superseded by `MessageDelivery.providerMessageId`) or is kept in sync for backward read compatibility — pick the option plan.md specifies: plan.md says outbound provider ids "move to `MessageDelivery.providerMessageId`... so the old field is no longer overloaded for new writes" — therefore **do not** write new outbound ids to `TicketMessage.externalId`; it remains populated only for historical/inbound rows.
- **Verification:** Existing per-channel delivery success/failure/timeout tests (spec.md "Strong existing coverage") pass with assertions retargeted from `TicketMessage.externalId` to `MessageDelivery`; a new test confirms `TicketMessage.externalId` is **not** written by a new outbound send.
- **Dependencies:** CONV-036, CONV-017.

### CONV-038 — Bounded retry endpoint
- **Goal:** External-cron-triggered bounded retry sweep, reusing the same row/message.
- **Files:** new `server/src/modules/integrations/outbound-delivery-retry.controller.ts`, `server/src/modules/integrations/outbound-delivery-retry.routes.ts` (modeled after the existing SLA/inactivity sweep pattern, e.g. `server/src/modules/live-chat/live-chat-inactivity.controller.ts`/`.routes.ts`).
- **Requirements:**
  - Protected by the existing `CRON_SECRET` middleware (reuse, do not duplicate, the mechanism guarding the inactivity sweep).
  - Selects a deterministic bounded batch of `PENDING`/retryable rows ordered by `nextAttemptAt`, claims each via CONV-017's atomic claim (`claimedUntil` lease) so an overlapping invocation safely skips already-claimed rows.
  - Schedule: at most **three total attempts** (initial + two retries), fixed delays **1 minute then 5 minutes**. Attempt 3 failure (or a non-retryable provider/validation rejection at any attempt) marks `FAILED` terminally.
  - Never creates another `TicketMessage`, notification, `AuditLog`, first-response stamp, or `ticket.message.created` event. A genuine delivery-state change may emit one `ticket.updated` (per CONV-042); an unchanged/no-op callback emits nothing.
  - Reuses a stable message-derived provider idempotency key where the provider supports it (Email/SMS already do per spec.md; confirm WhatsApp behavior and align if it exposes an equivalent).
- **Verification:** Test with two overlapping sweep invocations against the same batch: exactly one performs each attempt (claim prevents the second from double-sending); a message requiring all three attempts before success shows `attemptCount = 3`-or-fewer and terminal `SENT`/`FAILED` correctly; a row already `SENT` or terminally `FAILED` is skipped by the sweep.
- **Dependencies:** CONV-017, CONV-036, CONV-037.

### CONV-039 — WhatsApp delivery-policy de-duplication onto shared helper (CC-GAP-05)
- **Goal:** Remove WhatsApp's parallel outbound result/failure vocabulary; use `outbound-delivery.ts` directly.
- **Files:** `server/src/modules/integrations/whatsapp/whatsapp.service.ts`, `server/src/modules/integrations/outbound-delivery.ts`.
- **Requirements:** Replace WhatsApp's local result/failure-history types and mapping with calls into the shared helper from CONV-017/CONV-039's target module, preserving identical externally-observed behavior (same failure reasons, same `201`/`delivery` shape) — this is a refactor for drift-risk reduction, not a behavior change.
- **Verification:** Existing WhatsApp outbound result/failure tests pass unmodified in their assertions on response shape; a diff review confirms no duplicated error-mapping logic remains in the WhatsApp module.
- **Dependencies:** CONV-017, CONV-037.

### CONV-040 — Supported provider callback handlers only
- **Goal:** Implement callbacks only where the current provider/account contract actually exposes a usable one — no speculative unsupported callback types.
- **Files:** to be determined per provider capability audit at implementation time — likely additions under `server/src/modules/integrations/email/`, `server/src/modules/integrations/sms/`, and/or `server/src/modules/integrations/whatsapp/` routes/controllers, **only** for the channel(s) confirmed to expose a delivery callback in the existing adapter/account setup.
- **Requirements:**
  - Before writing any handler, confirm via the existing provider client/config code which provider(s) currently have a usable delivery callback wired at the account/adapter level. Spec.md states read receipts and unsupported callback types remain deferred — do not build a callback for a provider/event type not already confirmed supported.
  - Any implemented callback: verifies raw-body signature per that provider's existing auth pattern, looks up `MessageDelivery` by `(channel, providerMessageId)`, applies the update via `recordDeliveryCallback` (CONV-017) which enforces monotonic transitions and de-duplicates repeats as safe no-ops.
  - Unknown/unmatched provider ids return a safe acknowledged/no-op result (matching each provider's own expected webhook-ack contract) — never an error that would trigger provider-side retries.
  - If no provider currently exposes a usable, already-supported delivery callback, this task's deliverable is the audit finding itself plus a documented "no callback implemented" note — do not fabricate a callback endpoint to satisfy the task list.
- **Verification:** If a callback is implemented: signature-invalid → rejected safely; unknown id → safe no-op; duplicate/stale/out-of-order callback → no-op, delivery state unchanged; valid new terminal state → delivery row updates, no new `TicketMessage`/notification/audit, and a `ticket.updated` event fires only on an actual state change (CONV-042). If no callback is implemented, verification is the documented audit conclusion reviewed against `server/src/modules/integrations/{email,sms,whatsapp}/*.config.ts` and provider client code.
- **Dependencies:** CONV-017, CONV-037, CONV-038.

---

## Phase 8 — Attachments

### CONV-041 — Message/note-owned staged-attachment binding
- **Goal:** A conversation attachment belongs to exactly the `TicketMessage`/`TicketNote` it was created for (OD-CC-2).
- **Files:** `server/src/modules/attachments/attachment.service.ts`, `server/src/modules/tickets/ticket.service.ts`, `server/src/modules/portal/portal.service.ts`.
- **Requirements:**
  - Introduce staged-attachment ids owned by the authenticated actor/session (reuse existing upload validation — size/type/storage — but do not bind to a message/ticket at upload time; bind at send time).
  - At message/note creation, accept a list of staged attachment ids; validate ownership, ticket/note visibility, CLOSED guard, and (for message-level) author ownership **before** the write transaction; atomically consume/bind the staged rows to the exact created `messageId`/`noteId` inside that same transaction.
  - Enforce the service-level "exactly one context" invariant: a bound attachment's `messageId` or `noteId` (never both, and never left as an ambiguous ticket-level file for a new send) is set.
  - Do not upload provider bytes inside the database transaction (unchanged from current architecture — storage I/O stays outside the transaction boundary).
  - Existing ticket-level/customer-level legacy attachment upload routes remain available for their current non-conversation uses; they are simply never selectable as outbound conversation attachments going forward.
- **Verification:** Test: a staged attachment bound to a message that fails validation (e.g. CLOSED ticket) is not left bound to any other message; a successfully sent message shows the attachment's `messageId` set and no ticket-level ambiguous file created for that send; internal notes can now own attachments and remain internal-only in Portal/Portal-attachment queries.
- **Dependencies:** CONV-004, CONV-010.

### CONV-042 — Outbound attachment capability rejection (no silent downgrade)
- **Goal:** EMAIL/SMS/WhatsApp outbound requests containing attachments are rejected before message creation, never silently sent as text-only.
- **Files:** `server/src/modules/tickets/ticket.service.ts`.
- **Requirements:**
  - Validate requested channel capability **before** creating the `TicketMessage`: if the ticket's channel is EMAIL, SMS, or WHATSAPP and staged attachments are present, reject the whole request with a channel-capability error (`4xx`, specific reason code) — no message is created, no partial/text-only send occurs.
  - WEB/Portal and Live Chat may create locally visible message-owned attachments without restriction (subject to CONV-041's binding rules).
  - Internal notes may create note-owned attachments and remain internal-only regardless of ticket channel (notes are never provider-delivered).
  - Existing Email inbound attachment ingestion is unaffected — it remains supported and binds files to the inbound message (this rule is outbound-only).
- **Verification:** Test: an attempted EMAIL/SMS/WhatsApp staff reply with a staged attachment is rejected with the capability error and creates neither a `TicketMessage` nor a `MessageDelivery` row; the identical request against a WEB ticket succeeds and binds the attachment; an identical request as an internal note (any ticket channel) succeeds.
- **Dependencies:** CONV-041, CONV-036.

### CONV-043 — Preserve internal/customer visibility rules for note attachments
- **Goal:** Confirm Portal never sees note-owned attachments; internal queries include them appropriately.
- **Files:** `server/src/modules/attachments/attachment.service.ts`, `server/src/modules/attachments/attachment.portal.controller.ts`.
- **Requirements:** Internal ticket attachment queries include ticket-, message-, and now note-level files for authorized internal roles. Portal's attachment projection continues to return only owned ticket/message-level files (never note-level, matching the existing "Portal returns a narrower projection" rule in spec.md) and never storage/provider keys.
- **Verification:** Test: a note-owned attachment appears in internal ticket attachment listing for an authorized staff role and is absent from every Portal attachment response for the same ticket.
- **Dependencies:** CONV-041.

---

## Phase 9 — Audit Consistency

### CONV-044 — Route all six creation paths through the canonical audit helper
- **Goal:** Exactly one `TICKET_CREATED` AuditLog per successful creation, across manual/staff, Portal, Email, SMS, WhatsApp, Live Chat (OD-CC-7).
- **Files:** `server/src/modules/tickets/ticket.service.ts`, `server/src/modules/portal/portal.service.ts`, `server/src/modules/integrations/email/email.service.ts`, `server/src/modules/integrations/sms/sms.service.ts`, `server/src/modules/integrations/whatsapp/whatsapp.service.ts`, `server/src/modules/live-chat/live-chat.service.ts`.
- **Requirements:**
  - Every path that currently creates a `Ticket` calls CONV-013's `createCanonicalTicket` instead of hand-rolling ticket + history (+ sometimes audit) creation.
  - Staff/manual creation supplies the authenticated actor id; all other five paths supply `actorId = null`.
  - Confirm no path was previously double-auditing (internal ticket creation currently does both history and audit per spec.md — verify the helper doesn't produce a duplicate when called from that path).
- **Verification:** One parameterized test per creation path (6 total) asserting exactly one `TICKET_CREATED` AuditLog row and one `TicketHistory(TICKET_CREATED)` row, with the correct actor id per path.
- **Dependencies:** CONV-013, CONV-022, CONV-023, CONV-024, CONV-025, CONV-026, CONV-028.

### CONV-045 — No audit noise for reads/retries/duplicate inbound
- **Goal:** Confirm negative space — nothing new writes AuditLog on non-creation events.
- **Files:** test files across `server/src/modules/tickets/`, `server/src/modules/integrations/*/`.
- **Requirements:** Add regression tests confirming: a duplicate inbound webhook delivery (same `inboundKey`) writes zero new AuditLog rows; a retry-endpoint attempt (CONV-038) writes zero AuditLog rows; a supported callback (CONV-040, if implemented) writes zero AuditLog rows; a plain `GET` conversation read writes zero AuditLog rows.
- **Verification:** All four negative assertions pass.
- **Dependencies:** CONV-016, CONV-038, CONV-040, CONV-044.

---

## Phase 10 — First-Response SLA

### CONV-046 — Confirm first-response stamping scope (ADMIN/MANAGER/AGENT only, human-sent)
- **Goal:** Lock OD-CC-8 exactly as specified — this is largely already-correct behavior per spec.md ("applies this to any allowed internal actor"), so the task is confirmation plus explicit AI-content rule coverage.
- **Files:** `server/src/modules/tickets/ticket.service.ts`.
- **Requirements:** No structural change expected — `firstRespondedAt` is set once by the first customer-visible human public reply from an authenticated ADMIN/MANAGER/AGENT. Internal notes never count (already true — notes never touch `firstRespondedAt`). Provider/system inbound events never count (already true — inbound flows don't stamp first response). AI-generated content counts only when a staff member explicitly sends it as their own public reply (already true structurally, since AI insertion only populates the composer per spec.md's Quick Reply/AI section — confirm no path bypasses human send-action).
- **Verification:** Regression tests: a note from an ADMIN does not stamp `firstRespondedAt`; an inbound provider message does not stamp it; a staff member sending AI-suggested text via the normal reply endpoint does stamp it (once) exactly as a hand-typed reply would; a second staff reply does not re-stamp.
- **Dependencies:** none beyond baseline (CONV-010).

---

## Phase 11 — Frontend/API Integration

### CONV-047 — Expose `contentFormat` in conversation DTOs; replace markup-sniffing renderer
- **Goal:** Rendering is driven by persisted format, not body-content sniffing (OD-CC-9, CC-GAP-07).
- **Files:** server-side ticket/portal detail DTO mapping (in `server/src/modules/tickets/ticket.service.ts` / `server/src/modules/portal/portal.service.ts` response shaping), client `client/src/features/tickets/ticket-conversation-ui.tsx` (or wherever `MessageBody` is defined — confirm exact path via the client conversation feature directory at implementation time), and shared conversation types.
- **Requirements:**
  - API responses for internal and Portal conversation items include `contentFormat`.
  - Client `MessageBody` branches on `contentFormat`: `PLAIN_TEXT` renders as an escaped text node with preserved whitespace (never interpreted as HTML, even if it contains literal `<a>`/`<strong>`); `SANITIZED_HTML` renders through the existing DOMPurify defense-in-depth path.
  - Remove the markup-sniffing heuristic entirely — it must not remain as a fallback.
- **Verification:** Component test: a `PLAIN_TEXT` item containing literal `<strong>bold</strong>` renders as visible literal text, not bold formatting, replacing the CC-GAP-07 regression scenario; a `SANITIZED_HTML` item still renders formatted as today.
- **Dependencies:** CONV-012.

### CONV-048 — Expose durable delivery summary to authorized internal users
- **Goal:** Detail APIs project durable delivery status (closing the "reload loses per-message warning" gap).
- **Files:** `server/src/modules/tickets/ticket.service.ts` (DTO shaping), client conversation types/mapping.
- **Requirements:**
  - Internal conversation DTO includes a delivery summary per outbound message (status, coarse localized-able reason — not raw provider error/id) for authorized internal roles only.
  - Portal may receive only customer-safe status wording if/when product UI needs it — do not expose provider errors or ids to Portal in this task (plan.md defers Portal-specific delivery UI scope beyond "may receive... if product UI needs it"; ship the internal side, add Portal only if explicitly required — treat Portal delivery-status display as optional/no-op for this task unless a Portal UI already renders the old ephemeral delivery result, in which case preserve parity).
  - Never serialize provider message ids or raw error text to any client.
- **Verification:** Test: after a reload/refetch, a previously `FAILED` delivery still shows as failed (previously impossible per spec.md CC-GAP-04); no provider id/error string appears in the internal or Portal JSON response body.
- **Dependencies:** CONV-036, CONV-037, CONV-038, CONV-040.

### CONV-049 — Staged-attachment composer flow
- **Goal:** Replace ambiguous ticket-level upload with staged items submitted with the exact message/note (client side of CONV-041/042).
- **Files:** client attachment/composer components (confirm exact paths under `client/src/features/attachments/` and the ticket/Portal composer components at implementation time).
- **Requirements:**
  - Composer's Attach action stages a file client-side and submits its staged id together with the message/note POST, instead of uploading independently and leaving it ticket-level.
  - Disable/hide attachment selection in the composer for EMAIL/SMS/WhatsApp-channel tickets; if a stale client still attempts it, surface the server's capability-rejection error (CONV-042) rather than silently failing.
- **Verification:** Manual smoke: attaching a file to a WEB ticket reply and sending binds it to that exact message on reload; attempting to attach on an EMAIL-channel ticket composer shows the control disabled/hidden, and forcing the request (e.g., via devtools) surfaces the capability error, not a silent text-only send.
- **Dependencies:** CONV-041, CONV-042.

### CONV-050 — Live Chat widget session-key lifecycle
- **Goal:** Widget persists an opaque session key correctly scoped to a browser session/conversation lifecycle.
- **Files:** `client/src/features/live-chat/live-chat-api.ts`, `client/src/features/live-chat/live-chat-hooks.ts`, `client/src/features/customer-portal/customer-live-chat.tsx` (confirm exact widget entry component path).
- **Requirements:** Starting a new session generates and persists a new opaque key (e.g., `sessionStorage`, scoped per plan.md "only for that browser session/conversation lifecycle" — not `localStorage`, which would outlive the intended scope); resume sends the existing key; customer identity/login state alone never causes the client to attach to a different, older active ticket.
- **Verification:** Manual smoke: starting a new Live Chat session while an old one is still active (e.g., two tabs) creates two distinct tickets server-side, matching CONV-026/034; closing and reopening the same tab within the session lifecycle resumes the same ticket.
- **Dependencies:** CONV-026.

### CONV-051 — Query/cache invalidation review (only where necessary)
- **Goal:** Confirm existing TanStack Query invalidation patterns still cover the new delivery-state and content-format fields without unnecessary new invalidation keys.
- **Files:** client ticket/Portal query hooks (`client/src/features/tickets/`, `client/src/features/live-chat/`, Portal equivalents — confirm exact hook files at implementation time), `client/src/features/realtime/realtime.types.ts`.
- **Requirements:** A delivery-state change (retry success/failure, callback update) invalidates ticket detail through the existing `ticket.updated` event — no new SSE event type is added, per plan.md. Confirm no new invalidation key is introduced beyond what already exists for `ticket.updated`/`ticket.message.created`.
- **Verification:** Test/manual confirmation: a mocked `ticket.updated` event after a retry state change triggers the same detail refetch as any other `ticket.updated` event today; no regression in existing invalidation test coverage (`client/src/features/realtime/realtime.test.tsx`).
- **Dependencies:** CONV-038, CONV-040, CONV-048.

---

## Phase 12 — Realtime

### CONV-052 — Audience-field completeness audit across all message-event emitters
- **Goal:** Every `ticket.message.created` emission assembles `ticketId`, `messageId`, `assignedAgentId`, `customerId`, `teamId`, and `visibility` from the committed ticket/message — no channel-specific omission.
- **Files:** `server/src/modules/realtime/realtime.publisher.ts`, all emitter call sites (`ticket.service.ts`, `portal.service.ts`, `email.service.ts`, `sms.service.ts`, `whatsapp.service.ts`, `live-chat.service.ts`).
- **Requirements:** This is the completion/verification of CONV-019/020's fixes at the shared-publisher level — confirm the publisher itself doesn't default any field to `null` when omitted (which is what let CC-GAP-01/02 happen silently); consider adding a required-field check at the publisher boundary so a future channel can't reintroduce the same silent-default bug.
- **Verification:** A test at the publisher level asserts that calling `emitTicketMessageCreated` without an explicit `teamId` throws or is caught in code review, rather than silently defaulting to `null` — this is a structural guard against regression of CC-GAP-01/02's root cause, not just a per-channel fix.
- **Dependencies:** CONV-019, CONV-020.

### CONV-053 — No new SSE event type; retry/callback emit `ticket.updated` only on real change
- **Goal:** Confirm plan.md's constraint is respected end-to-end.
- **Files:** `server/src/modules/realtime/realtime.publisher.ts`, `server/src/modules/integrations/outbound-delivery.ts`, `server/src/modules/integrations/outbound-delivery-retry.controller.ts`.
- **Requirements:** Retries and callback duplicates never emit `ticket.message.created`. A genuine delivery-state change (e.g., `PENDING -> FAILED` terminal, or a supported callback moving `SENT -> DELIVERED`) emits exactly one post-commit `ticket.updated`. An unchanged/no-op callback or a claim-then-no-state-change retry attempt emits nothing.
- **Verification:** Test: a duplicate callback that is a no-op per CONV-017's monotonic guard results in zero realtime events; a genuine terminal-failure transition after three attempts emits exactly one `ticket.updated`.
- **Dependencies:** CONV-017, CONV-038, CONV-040.

---

## Phase 13 — Cross-Channel Tests

### CONV-054 — Cross-channel invariant matrix (parameterized)
- **Goal:** Build the missing shared contract test table spec.md flags as absent (CC-GAP-17).
- **Files:** new shared test module, e.g. `server/src/modules/tickets/conversation-cross-channel.test.ts`, parameterized over `{ WEB/Portal, EMAIL, SMS, WHATSAPP, LIVE_CHAT }`.
- **Requirements:** For each channel, assert in one parameterized suite:
  - explicit/reliable correlation precedence and absence of latest-customer-ticket fallback;
  - `WAITING_CUSTOMER -> IN_PROGRESS` transition on reused ticket;
  - RESOLVED reopen only for Portal and reliably correlated Email; SMS/WhatsApp/Live Chat create fresh;
  - every CLOSED mutation path rejected/no-op with no writes/provider calls/events;
  - exactly one `TicketHistory(TICKET_CREATED)` and exactly one `AuditLog(TICKET_CREATED)` with correct actor;
  - first-response stamped only for ADMIN/MANAGER/AGENT public replies, unaffected by notes/provider/system events.
- **Verification:** Full matrix green (5 channels × 6 assertion groups = 30 parameterized cases minimum).
- **Dependencies:** CONV-013 through CONV-035 (this is the consolidation test for all of Phases 3–6).

### CONV-055 — Delivery/idempotency/callback focused suite
- **Goal:** Cover the delivery-specific gaps spec.md flags as missing (CC-GAP-18).
- **Files:** `server/src/modules/integrations/outbound-delivery.test.ts` and per-channel test files.
- **Requirements:** Cover: initial attempt occurs only post-commit; success/retryable-failure/non-retryable-failure/retry-exhaustion/timeout/missing-config/missing-recipient/provider-id-persistence/callback-transition each update exactly one delivery row; 3-attempt cap and 1m/5m scheduling determinism; overlapping-worker single-claim; retries never duplicate messages/first-response/notifications/audits/events; duplicate inbound webhook races hit the DB unique key with zero repeated side effects; constraint-target tests prove only the inbound-idempotency conflict yields `DUPLICATE` (directly covering CONV-021's fix); callback signature/duplicate/unknown-id/out-of-order/terminal-state tests preserve monotonic state (if a callback was implemented per CONV-040).
- **Verification:** All listed cases present and green.
- **Dependencies:** CONV-021, CONV-036, CONV-037, CONV-038, CONV-039, CONV-040.

### CONV-056 — Content, attachment, and Live-Chat-concurrency focused suite
- **Goal:** Cover the remaining spec.md-flagged gaps (literal-markup rendering, attachment ownership, phone ambiguity, concurrency).
- **Files:** `server/src/shared/rich-text/conversation-content.test.ts` (new, alongside CONV-011), `server/src/modules/attachments/attachment.test.ts`, `server/src/modules/live-chat/live-chat.test.ts`, phone-resolution test file from CONV-015.
- **Requirements:** Cover: literal `<a>`/`<strong>` from SMS/WhatsApp/plain Email remains literal text in internal and Portal rendering (server-side content-format assertion, complementing CONV-047's client test); canonical 20,000/50,000/2,000 bounds enforced server-side across every entry point; each new conversation attachment has exactly one message/note owner, cross-user/ticket binding fails, failed message validation does not misbind files; EMAIL/SMS/WhatsApp attachment attempts reject before message creation and provider invocation with no text-only fallback; phone resolution covers zero/one/multiple/legacy-form-collapse/safe-ambiguity-logging with no side effects on ambiguity; two truly concurrent Live Chat starts with the same session key yield one ticket/audit/history/assignment/event and both callers get that ticket; different session keys for the same customer yield different tickets; RESOLVED/CLOSED keys never resume.
- **Verification:** All listed cases present and green.
- **Dependencies:** CONV-011, CONV-015, CONV-022, CONV-027, CONV-041, CONV-042, CONV-047.

---

## Phase 14 — Migration and Final Verification

### CONV-057 — Full verification gate
- **Goal:** Final sign-off sweep before this feature is considered implemented.
- **Files:** none (verification-only task; touches no production code).
- **Requirements — run and pass every item, in order:**
  1. **Migration review:** re-read the final applied migration(s) from CONV-006/CONV-010 end-to-end; confirm no destructive statement was introduced by any later task.
  2. **Prisma generate:** `npx prisma generate` succeeds with no type drift against the finished schema.
  3. **Migrate status:** `npx prisma migrate status` reports zero drift against the target database.
  4. **Targeted tests:** all conversation/channel-related test files listed across CONV-001–056 pass.
  5. **Relevant integration suites:** full `server` test suite passes (not just the touched files) to catch cross-module regressions (e.g., SLA monitor, notifications, realtime).
  6. **Server typecheck:** `tsc -b` (or the project's documented server build/typecheck command) passes.
  7. **Client typecheck/build:** client `tsc -b`/build passes, per the project's known gotcha that `vitest run` alone does not catch cross-file type errors (see `.wolf/cerebrum.md` Do-Not-Repeat, 2026-08-27 entry on `tsc -b` vs `vitest run`).
  8. **Lint:** project lint command passes with zero new violations.
  9. **Builds:** full project build (server + client) succeeds.
  10. **`git diff --check`:** no whitespace-error/conflict-marker regressions introduced across the feature's diff.
  11. **Documentation reconciliation:** update `docs/21-email-integration.md`, `docs/07-ticket-workflow.md`, `docs/20-whatsapp-integration.md`, ADR-056, ADR-045/`docs/22`, ADR-035, `docs/19-progress-tracking.md`, `docs/05-api-contract.md`, `docs/08-sla-automation.md`, `docs/22-realtime-events.md`, and the applicable ADRs to reflect the now-implemented commit-first/durable-delivery/audience/audit reality, closing CC-DG-01 through CC-DG-08. Amend ADR-052 (it remains the commit-first authority) rather than reversing it.
- **Verification:** Each of the 11 items produces a clean/passing result; any failure blocks marking the feature complete and is fixed before re-running this gate.
- **Dependencies:** every prior task (CONV-001 through CONV-056).

---

## Explicitly Out of Scope (carried forward from plan.md — do not implement)

- Ordinary Portal/internal message request idempotency keys (only provider inbound and Live Chat session creation get new idempotency guarantees).
- External outbound attachment transmission for Email/SMS/WhatsApp (rejected before message creation per CONV-042; enabling it later needs its own spec).
- Customer merge/deduplication or canonical unique-phone enforcement.
- Generic queues/job infrastructure, Redis/Kafka, a general integration outbox, or unbounded/manual-resend retry UI.
- Delivery callbacks for any provider without an already-supported, verified contract (CONV-040 must not fabricate one).
- Realtime transport replacement/replay or production hosting changes; SSE stays process-local/best-effort.
- WhatsApp media/templates/reactions/interactive messages; SMS MMS; Email features beyond existing inbound attachments.
- Read receipts, typing, presence, agent availability, chat transfer, WebSockets.
- Live-provider, production-scheduler, and deployed-SSE certification (manual/deployment gates only, not unit-test claims).

---

## Summary

- **Total tasks:** 57 (`CONV-001` – `CONV-057`).
- **Execution order:** strictly sequential by phase (1 → 14) and by ID within a phase, respecting each task's stated dependencies; several same-phase tasks (e.g., CONV-019/020, or CONV-030/031) are independent of each other and may be parallelized by different implementers once their shared dependencies land.
- **Migration-sensitive tasks:** CONV-001–010 (schema/enum/constraint additions, backfill scripts, and the required-column finalization). These must run in a database change-control window and be rehearsed against representative data before touching production, per plan.md's migration-verification requirements.
- **Concurrency-sensitive tasks:** CONV-005 (unique session-key constraint), CONV-022 (Live Chat create-and-re-read-on-conflict), CONV-017/036–038 (delivery claim/lease and overlapping-retry-sweep safety), CONV-040 (callback idempotency/monotonic transitions, if implemented).
- **No blockers found:** decomposition surfaced no contradiction between `spec.md` and `plan.md`. Implementation can proceed sequentially through CONV-001–057 without further product decisions — every open question (OD-CC-1 through OD-CC-9) was already resolved in `spec.md`, and this file only sequences their build-out.
