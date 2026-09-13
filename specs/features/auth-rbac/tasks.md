# Auth / RBAC Tasks

**Status: IMPLEMENTED + VERIFIED ON SDD BRANCH**

- [x] `AUTH-001` Add failing middleware coverage for missing, invalid, and expired tokens and confirm `401` codes.
- [x] `AUTH-002` Add failing current-account coverage for deleted/deactivated identities and stale JWT roles.
- [x] `AUTH-003` Implement current-account role resolution in the shared role guard and refresh `request.auth.role` before downstream authorization.
- [x] `AUTH-004` Verify `/auth/me`, login/register, bcrypt/token lifecycle, password-change/reset freshness, and 401/403 semantics.
- [x] `AUTH-005` Verify ADMIN org-wide and admin-only boundaries across tickets/customers/settings/audit/users.
- [x] `AUTH-006` Verify MANAGER own-team access and cross-team denial across lists/details/nested resources/reports/realtime.
- [x] `AUTH-007` Verify AGENT mutation allowlist, same-team/self-assigned access, self-claim, and manager/admin denial.
- [x] `AUTH-008` Verify CUSTOMER linkage, own-ticket/public-message/attachment access, cross-customer denial, internal-note exclusion, and staff-API denial.
- [x] `AUTH-009` Verify notification user scope, realtime audience scope, and nested/subresource authorization.
- [x] `AUTH-010` Run server typecheck/lint/build, full server suite (shared primitive changed), applicable client auth/guard verification, and `git diff --check`.
- [x] `AUTH-011` Reconcile documentation/status trackers and mark complete only from fresh evidence.

## Verification evidence (2026-09-13)

- Auth/middleware focused: 54/54 passed.
- Full server: 1096/1096 tests across 58 files passed.
- Server typecheck and lint: clean.
- Server build: Prisma generate blocked by the known Windows `query_engine-windows.dll.node` rename lock (`EPERM`); independent TypeScript compilation is clean and no schema changed.
- Client auth/router/navigation focused: 73/73 across 19 files passed; no client source changed.
- `git diff --check`: clean.
