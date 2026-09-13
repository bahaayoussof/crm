# Auth / RBAC

## Status

**IMPLEMENTED + VERIFIED ON SDD BRANCH (2026-09-13).** The current system uses stateless bearer JWTs and four roles: `ADMIN`, `MANAGER`, `AGENT`, and `CUSTOMER`. One security-relevant stale-authority gap was confirmed and closed. No unresolved product decision remains.

## Scope

This feature owns authentication, token validation, coarse role authorization, current-account freshness, audience separation, and the documented role/team/customer matrix. Domain services continue to own object-level authorization. It does not introduce refresh tokens, OAuth, MFA, SSO, ABAC, a policy framework, or an authorization UI.

## Current architecture

- `POST /api/auth/register` creates only a `CUSTOMER` user and linked `Customer` atomically. The strict schema rejects client-supplied role/team identifiers.
- `POST /api/auth/login` normalizes email, verifies bcrypt hashes, rejects invalid credentials generically, rejects inactive accounts, and returns a safe user projection plus an 8-hour JWT.
- JWT payload: `sub`, `role`, `iat`, provider-managed `exp`; no password, email, team, customer, or secret data.
- `requireAuth` validates `Authorization: Bearer`, signature, expiry, payload shape, and role. Missing auth is `401 AUTHENTICATION_REQUIRED`; invalid/expired JWT is `401 INVALID_TOKEN`.
- `/api/auth/me` reloads the user, rejects deleted/deactivated accounts, checks `passwordChangedAt`, and returns a safe current projection.
- Passwords use bcrypt cost 12. Password change/reset updates `passwordChangedAt`; Portal/profile paths use freshness checks. There is no refresh-token or server session store.
- Frontend stores the access token in local storage, bootstraps through `/auth/me`, clears state on API `401`, separates internal and customer audiences, and uses role-aware navigation/route wrappers as defense in depth.

## Permission matrix

| Capability | ADMIN | MANAGER | AGENT | CUSTOMER |
| --- | --- | --- | --- | --- |
| Internal APIs | Org-wide where domain allows | Own team / configured manager capabilities | Assigned self or unassigned own-team plus explicit mutation allowlist | Forbidden (`403`) |
| Admin configuration, users, audit | Allowed | Forbidden except documented manager surfaces | Forbidden | Forbidden |
| Reports | Allowed | Own-team report service scope | Forbidden | Forbidden |
| Tickets | All | Own team | Self-assigned or unassigned own-team; self-claim only | Portal own tickets only |
| Customers | Full read/write | Read own operational scope; writes per customer contract | Read/summary per customer contract | Own linked profile only |
| Knowledge base | Read/manage | Read/manage | Read only | Published Portal articles only |
| Tasks | All documented actions | Team/manager actions | Created/assigned and field allowlist | Forbidden |
| Notifications | Own rows | Own rows | Own rows | No staff notification API |
| Realtime | All relevant internal events | Own-team events | assigned/self or unassigned-own-team | own-customer public events only |
| Portal | Forbidden by customer-only guard | Forbidden | Forbidden | Own linked customer/tickets only |

The exact ticket mutation matrix remains authoritative in `specs/features/tickets/spec.md` and is not duplicated in middleware.

## Team and object visibility

- `Ticket.teamId` is the canonical ownership boundary.
- ADMIN has no team predicate where org-wide access is intended.
- MANAGER resolves the team where `Team.managerId = actor`; no team means match nothing; cross-team detail is hidden as `404`.
- AGENT detail visibility is assigned-to-self or unassigned-own-team. Lists expose `mine` and `unassigned` scopes only. Assignment validation and self-claim remain service-owned.
- Nested ticket resources (conversation, watchers, attachments, AI) reuse ticket visibility. Notifications are always queried by authenticated `userId`. Realtime applies the same role/team/customer audience model.
- CUSTOMER ownership is derived server-side from `Customer.userId`; client-supplied customer/user/team/role identifiers never establish authority.

## Portal privacy boundary

- Portal ticket list/detail/reply queries include the linked `customerId`; cross-customer ids return `404`.
- Portal responses select public `TicketMessage` rows only. `TicketNote`, staff history, SLA fields, assignment/team data, internal metadata, and staff notification APIs are absent.
- Portal attachments require an owned ticket/message; note-owned and customer-profile attachments are excluded. Closed tickets reject replies/uploads; resolved replies reopen through the documented ticket workflow.
- Missing/stale customer linkage is rejected; fresh-token checks immediately reject password-changed customer sessions.

## Route protection audit

- Tickets, customers, knowledge management, notifications, reports, tasks, attachments, audit logs, settings, realtime, and user administration all have authentication and explicit role allowlists.
- Provider webhooks use provider signature/token boundaries. Cron endpoints use the shared cron-secret guard and are not JWT staff endpoints.
- Domain-specific 404 hiding and 409/422 workflow errors remain unchanged.

## Gaps classified

### SG-1 — security/privacy concern + implementation bug

Most internal `requireRole` paths authorize the JWT-embedded role without re-reading current account state. A deactivated or demoted staff user may retain the old role on tickets/customers/reports/tasks/realtime/notifications until the 8-hour token expires. This conflicts with the already-established immediate-current-account semantics used by `/auth/me`, `/api/users`, `/api/settings`, and Portal.

**Required:** current account activity and role must be resolved before any role authorization. Deleted/deactivated accounts return `401`; a current role outside the route allowlist returns `403`; the request actor role is replaced with the current DB role before downstream team/object checks.

### TG-1 — test gap

Middleware tests cover accepted/forbidden JWT roles but not missing auth, invalid/expired tokens, current-role demotion, deactivation, or downstream receipt of the refreshed role.

### TG-2 — test gap

Existing domain tests cover the requested ADMIN/MANAGER/AGENT/CUSTOMER, notification, realtime, nested-resource, and 401/403 matrices across their feature suites, but the Auth/RBAC completion gate must run them together and record evidence.

### DD-1 — documentation drift

Historical docs describe stale internal JWT authority as an accepted limitation. After SG-1, those statements must be updated without claiming refresh-token/session infrastructure.

### AD-1 — architecture debt (deferred)

Tokens remain browser-local stateless bearer JWTs with an 8-hour maximum lifetime. No refresh rotation, server-side session inventory/revocation UI, MFA, OAuth, SSO, or policy engine is added.

## Acceptance criteria

1. All protected role routes reject missing/invalid/expired auth with `401`.
2. Current inactive/deleted accounts cannot use a still-valid JWT.
3. Current DB role, not stale JWT role, controls coarse role authorization and downstream visibility.
4. Existing ADMIN global, MANAGER team, AGENT assignment/team, and CUSTOMER ownership rules remain unchanged.
5. Portal never exposes notes, staff metadata, or another customer's data.
6. Focused and full-risk verification passes before status is marked complete.
