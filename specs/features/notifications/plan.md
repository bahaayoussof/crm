# Notifications — Plan

Status: **Implemented** — see `tasks.md` for execution/verification status.

No schema change, no migration, no new dependency, no route/RBAC/response-shape change. Backend recipient/persistence/realtime/authorization behaviour is already correct per `spec.md`'s discovery — this plan covers only the three client-side gaps (NOTIF-GAP-1/2/3) plus the focused regression tests that prove the acceptance criteria.

## Smallest brownfield-safe shape

All three gaps live in the same three files, touched together:

1. **`client/src/features/notifications/notification.types.ts`** — add `taskId: string | null` to `Notification`, mirroring the server's `notificationSelect` (which already returns it — no API contract change).
2. **`client/src/features/notifications/notification-bell.tsx`** — `NotificationRow` / `handleNotificationClick`:
   - Resolve a target: `ticketId` → `/tickets/:id`, else `taskId` → `/tasks/:id`, else `null`.
   - When target is `null`: render the row as a non-interactive `<div>` (no `<button>`, no `onClick`), so it cannot appear clickable and cannot dead-click.
   - When target is non-null: keep the click-to-mark-read-then-navigate behavior, unchanged.
   - Add a second, sibling icon-button (not nested inside the row button — nesting buttons is invalid HTML and was avoided everywhere else in this codebase) that fires `markOne.mutate(n.id)` only, with `stopPropagation` not needed since it's a sibling, not a descendant, of the navigate button. Shown only when the row is unread.
3. **`client/src/locales/{en,ar}/translation.json`** — add `notifications.markRead` (singular, per-row aria-label) next to the existing `markAllRead`.

No change to:
- `notification-hooks.ts`, `notification-api.ts` — already fetch/mutate everything needed.
- `notification.service.ts`, `notification.controller.ts`, `notification.routes.ts`, `notification.schema.ts` — server already selects/returns `taskId`.
- `realtime-event-handler.ts`, `realtime.types.ts` — invalidation wiring is already correct.
- Prisma schema / migrations.

## Sequencing

1. Type + i18n additions first (no behavior change yet, keeps each commit-sized step compiling).
2. `NotificationRow` restructure (target resolution, non-interactive fallback, per-row mark-as-read button).
3. Tests: extend `notification-bell.test.tsx` with the task-notification and per-row-mark-as-read cases; add a non-actionable-row case.
4. Full targeted verification (see `tasks.md` final gate).

## Risks / mitigations

- **Nested interactive elements**: mitigated by making the row's main clickable surface and the mark-read control siblings, not parent/child (a `<button>` cannot legally contain a `<button>`).
- **Existing test coupling**: `notification-bell.test.tsx` currently does `fireEvent.click(screen.getByRole("option").querySelector("button")!)` to simulate a row click — this selector grabs the *first* button in the `<li>`. After the restructure, order matters: the primary (navigate) control must remain the first `<button>` in DOM order so this existing test still expresses "click the row", and the new mark-as-read control is added after it. Existing tests are updated only if the structural change requires it (see `tasks.md`), not rewritten wholesale.
- **i18n key drift**: EN/AR files are edited together in the same task to avoid a missing-key state in either locale.

## Verification strategy

Per the fast-track brief: focused tests only, no full-suite reruns unless a shared primitive is touched (it isn't — only the notifications feature directory and two locale files change). Final gate: client `tsc -b` + `eslint` on changed files + `vitest run src/features/notifications` + `git diff --check`. Server is untouched by this feature, so no server test run is required, but the existing server `notification.test.ts` is read once to confirm the `taskId` field really is returned today (already confirmed in discovery).
