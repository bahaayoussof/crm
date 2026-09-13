# docs/ — historical & supporting material (non-authoritative)

**`specs/` is the canonical single source of truth** for this project's
current architecture, domain rules, and feature behavior — start at
`specs/README.md`, `specs/constitution.md`, `specs/architecture.md`,
`specs/domain-model.md`, and `specs/features/`.

This `docs/` directory is **not** authoritative. The numbered planning docs
that used to live here (`00`–`17`, `20`–`23`) were consolidated into `specs/`
on 2026-09-13 and removed — their content now lives in the files above (see
`specs/README.md` "Docs consolidation — executed" for exactly where each
one went). Git history still has the original files if you need the exact
old wording.

**If anything below conflicts with `specs/` or the actual implementation,
`specs/` + the code win.**

## What's still here, and why

| File | Role |
| --- | --- |
| `18-ui-pages-spec.md` | Historical page-by-page UI/UX blueprint (routes, layout ASCII diagrams, component inventories). Superseded as an authority by each feature's `specs/features/<name>/spec.md` and by `specs/architecture.md`; kept because it's still a useful detailed reference for exact historical UI/UX decisions not worth re-deriving. Treat any behavioral claim in it as unverified against current code. |
| `19-progress-tracking.md` | Append-only historical session log of implementation/verification status over time. Real evidence of what was checked and when — including explicit "NOT VERIFIED" / "NOT PERFORMED" markers that must not be reinterpreted as passing. Current status lives in `specs/features/README.md`'s feature coverage matrix and each feature's `tasks.md`, not here. |
| `24-final-qa-production-readiness.md` | One-time QA audit report (2026-09-02). Real findings, real fixes, and an honest list of what was **not** verified (live providers, fresh-DB migration at the time, browser matrix). Historical evidence, not a live status page. |
| `25-fresh-db-browser-qa.md` | One-time QA session report: fresh disposable Postgres, repeated seed runs, multi-role browser matrix. Same rule — real evidence for the date it was run, not a claim about the current working tree. |
| `dev-test-data.md` | Reference for the `npm run seed:test` fixture set — seeded record counts, test account credentials, and pagination/RBAC scenarios the seed is designed to exercise. Still operationally useful for local QA; describes fixture data, not product behavior. |

## Rules for anyone (human or agent) reading this directory

1. Do not treat any file here as defining current requirements, API
   contracts, RBAC rules, ticket workflow, or architecture — read the
   owning `specs/` file instead.
2. Do not infer that a migration, provider integration, or QA pass was
   verified in *this* session just because an older report here says it
   was verified once, on some other date, in some other environment.
3. If you update product behavior, update the owning `specs/features/*`
   package (or `specs/constitution.md` / `specs/architecture.md` /
   `specs/domain-model.md`) — not a file in this directory.
4. New session logs, QA passes, or progress notes belong in the owning
   feature's `tasks.md` (verification evidence) or `specs/decisions.md`
   (architecturally significant decisions), not as a new numbered `docs/`
   file.
