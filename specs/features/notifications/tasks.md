# Notifications — Tasks

Status: **Complete (6/6 tasks)** — see "Honest status at end of implementation" below.

Scope: 3 client-only defects (NOTIF-GAP-1/2/3 in `spec.md`). No server change. No schema/migration/dependency change.

- [x] **NOTIF-001** — `client/src/features/notifications/notification.types.ts`: add `taskId: string | null` to the `Notification` interface (mirrors the server's existing `notificationSelect`).
- [x] **NOTIF-002** — `client/src/features/notifications/notification-bell.tsx`: resolve a navigation target (`ticketId` → `/tickets/:id`, else `taskId` → `/tasks/:id`, else `null`); when `null`, render the row as non-interactive (no button/link semantics, no click handler); when non-null, keep mark-read-then-navigate on click.
- [x] **NOTIF-003** — same file: add a sibling per-row "mark as read" icon button (shown only while unread) that calls `markOne.mutate(n.id)` without navigating or closing the dropdown. Must not nest inside the row's navigate button (invalid HTML) — implemented as a sibling control.
- [x] **NOTIF-004** — `client/src/locales/en/translation.json` + `client/src/locales/ar/translation.json`: add `notifications.markRead` key (EN + AR) for the new per-row control's `aria-label`.
- [x] **NOTIF-005** — `client/src/features/notifications/notification-bell.test.tsx`: add/extend cases —
  - a `TASK_ASSIGNED`/`TASK_REMINDER` fixture (`taskId` set, `ticketId: null`) navigates to `/tasks/:id` on click and marks read;
  - a fixture with neither `ticketId` nor `taskId` renders with no button/navigate semantics and is not clickable to navigate;
  - the new per-row "mark as read" button marks the item read without triggering navigation (assert `navigate`/route unaffected, `markOne` called).
- [x] **NOTIF-006** — Final gate: client `tsc -b`, `eslint` (changed files), `vitest run src/features/notifications`, `git diff --check`. Update `spec.md`'s status table if anything deviates from the plan.

## Honest status at end of implementation

**IMPLEMENTED + VERIFIED ON SDD BRANCH (2026-09-13, branch `chore/sdd-foundation`, committed).**

All 6 tasks done. Discovery found the backend (recipient targeting, persistence, SSE invalidation, dedup, self-notification suppression, authorization-safe navigation targets, CLOSED-ticket viewability) already correct — no server code, schema, migration, or route changed. Only the three client-side gaps in `spec.md` were fixed:

- `notification.types.ts`: `taskId` added.
- `notification-bell.tsx`: `resolveNotificationTarget` (ticketId -> taskId -> null), non-interactive rendering when no target, sibling per-row "mark as read" button.
- `translation.json` (en/ar): `notifications.markRead` key added.
- `notification-bell.test.tsx`: rewritten with 8 cases covering the dead-click regression, non-actionable rendering, explicit per-row mark-as-read, re-click-when-already-read, and dropdown-open-does-not-mark-read.

**Verification:** client `tsc -b` clean; `eslint` on the 3 changed source files clean; `vitest run src/features/notifications` **8/8**; `git diff --check` clean (pre-existing LF/CRLF advisories only, no real conflicts). Server untouched — no server test run required per the fast-track rule (no shared primitive touched). buglog bug-192.

**Deferred (documented in spec.md, not implemented this pass):** notification message content is a point-in-time snapshot, not re-checked against the recipient's live access at read time (NOTIF-GAP-4); type/icon differentiation per row (NOTIF-GAP-5); a dedicated "all notifications" page (NOTIF-GAP-6). None of these are correctness/security defects — see spec.md for the reasoning.

**Not committed** — per instruction, `chore/sdd-foundation` working tree only.
