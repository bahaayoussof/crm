# Auth / RBAC Implementation Plan

## Strategy

Close SG-1 at the existing coarse authorization seam. Keep JWT verification synchronous and stateless in `requireAuth`; make `requireRole` resolve the current user record before checking its allowlist, then replace `request.auth.role` with the current role. This avoids duplicating domain visibility rules and avoids touching schemas or route contracts.

## Changes

1. Extend middleware regression tests first for unauthenticated, invalid/expired, deactivated/deleted, stale-role demotion, current-role promotion, and refreshed-role propagation.
2. Add one shared current-authority resolver used by `requireRole` and preserve existing `401 ACCOUNT_DEACTIVATED` / `403 FORBIDDEN` meanings.
3. Reconcile `requireActiveUser`/`requireFreshToken` only enough to avoid contradictory role semantics; preserve password-change behavior.
4. Run focused auth/middleware tests, then the requested RBAC/domain groups.
5. Because the shared role primitive affects every protected router, run the full server suite plus server typecheck/lint/build if focused checks pass.
6. Run client auth/guard tests and client typecheck/lint only if client files change; otherwise record the audited no-change result.
7. Update Auth/RBAC SDD status, `docs/19-progress-tracking.md`, `.wolf/STATUS.md`, and OpenWolf learning/bug records with exact evidence.

## Safety

- No Prisma schema or migration.
- No dependency changes.
- No refresh/session redesign.
- Existing service-level 404 hiding, team predicates, customer ownership, and workflow errors remain authoritative.
- Tests use the existing Prisma mock style; production DB state is never mutated.

