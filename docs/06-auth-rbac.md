# Authentication and RBAC

## Authentication

Email/password authentication using:
- bcrypt password hashing
- JWT authentication

Public self-registration is available only to customers. `POST /api/auth/register` uses a strict request schema that does not accept a role and always creates `User.role = CUSTOMER`. `ADMIN`, `MANAGER`, and `AGENT` accounts cannot self-register; later administrator-managed user creation is outside the authentication feature.

Customer registration normalizes the email by trimming and lowercasing it, hashes the password, and creates the `User` and linked `Customer` profile in one Prisma transaction. A failure to create either record rolls back both. Login applies the same email normalization and supports all four roles.

The API issues an eight-hour bearer access token containing only the user identifier and role. It does not issue refresh tokens. The client persists this token locally for the assessment, attaches it centrally through Axios, loads the current identity from `/auth/me`, and removes the token on logout or an authenticated `401` response.

## Permission implementation status

The role descriptions below include capabilities that are not yet built. As of `master` `e387667`:

### Enforced server-side today

- Authentication: customer-only registration, all-role login, eight-hour JWT, `/auth/me`, role middleware.
- Customer Management: `ADMIN`/`MANAGER` full; `AGENT` read-only (list/search/detail/notes-read); `CUSTOMER` rejected.
- Ticket Management: `ADMIN`/`MANAGER` all tickets and transitions; `AGENT` assigned-or-unassigned visibility with assignment-gated `status`/`priority` mutation and conversation; `CUSTOMER` rejected. Assignment and escalation are `ADMIN`/`MANAGER` only.
- Ticket conversation and history: same visibility/mutation boundary as Ticket Management.
- Dashboard: `ADMIN`/`MANAGER`/`AGENT` only, role-scoped queues; `CUSTOMER` rejected.
- Customer Portal: `CUSTOMER` only, ownership derived from `User -> Customer.userId`; internal roles receive `403` from `/api/portal/*`.
- `GET /users/agents` and `GET /categories`: `ADMIN`/`MANAGER`/`AGENT` lookup only.
- Knowledge Base (`feature/knowledge-base`): `ADMIN`/`MANAGER`/`AGENT` may list/search and read internal articles (`DRAFT` and `PUBLISHED`); `ADMIN`/`MANAGER` may create, update, publish/unpublish, and delete; `AGENT` is read-only (`403` on create/update/delete); `CUSTOMER` and unauthenticated callers are rejected from `/api/knowledge-articles/*`. `createdById` is server-derived from the authenticated `ADMIN`/`MANAGER`. `CUSTOMER` may read `PUBLISHED` articles only through `/api/portal/knowledge-articles`; internal roles receive `403` there. A `DRAFT` id returns the same `404` as a missing id in the Portal path.

### Implemented — `feature/attachments`, integrated into `master` at `8e24d22`

- Attachment listing/download and upload per context. Internal routes require `ADMIN`/`MANAGER`/`AGENT`; `CUSTOMER`/anonymous rejected. Ticket and message listing/download follow the existing ticket visibility predicate; ticket/message upload also requires an `AGENT` to be the assigned agent, and message upload requires `message.authorUserId ===` the authenticated user for every role. Customer-profile listing/download is available to every internal read role; customer-profile upload is `ADMIN`/`MANAGER` only. Portal attachment routes are `CUSTOMER` only, ownership-scoped through `User -> Customer.userId`, upload blocked on `CLOSED` tickets, and never expose customer-profile attachments or another customer's data. See `docs/05-api-contract.md` "Attachments — LIVE" and the matrix below.

### Implemented — `feature/quick-replies`, integrated into `master` at `79c7067`

- Quick Replies (`/api/quick-replies`): `ADMIN`/`MANAGER`/`AGENT` may list and read quick replies; `ADMIN`/`MANAGER` may create, update, and delete; `AGENT` is read/use-only (`403` on `POST`/`PATCH`/`DELETE`); `CUSTOMER` and unauthenticated callers are rejected from every route. `createdById` is server-derived from the authenticated `ADMIN`/`MANAGER`. There is no Portal route. The client shows the `/quick-replies` management workspace and nav item to `ADMIN`/`MANAGER` only and guards `/quick-replies*` with replace navigation to `/dashboard` for `AGENT`; `AGENT` reaches quick replies only through the `QuickReplyPicker` in the internal Ticket public-reply composer, which inserts editable text and never sends. See the matrix below.

### Implemented — `feature/customer-feedback`, on branch, not yet integrated

- Feedback (`POST`/`GET /api/portal/tickets/:id/feedback`): a `CUSTOMER` may submit and read exactly one rating (`1`–`5`, integer) plus an optional comment for their own ticket whose stored status is `RESOLVED` or `CLOSED`. Non-owned/missing ticket → `404 TICKET_NOT_FOUND`; other status → `409 TICKET_NOT_ELIGIBLE_FOR_FEEDBACK`; repeat submission → `409 FEEDBACK_ALREADY_SUBMITTED`. `customerId` is server-derived from `User -> Customer.userId`. Internal roles and unauthenticated callers are rejected (these are `portalRouter` sub-routes, `requireRole(CUSTOMER)`); there is no internal feedback route. See the matrix below.
- Reports (`GET /api/reports/{overview,tickets,agents,sla}`, `feature/reports`, on branch): `ADMIN` and `MANAGER` only (`requireAuth` + `requireRole(ADMIN, MANAGER)`). `AGENT`, `CUSTOMER`, and unauthenticated callers receive `403 FORBIDDEN` / `401`. Read-only aggregates over existing rows; the satisfaction metric is derived from `Feedback.rating`. No `AGENT` reports access is granted.
- Users administration (`GET /api/users`, `GET /api/users/:id`, `POST /api/users`, `PATCH /api/users/:id`, `feature/user-management`): **`ADMIN` only** (`requireAuth` → `requireActiveUser` → `requireRole(ADMIN)` per route; `/users/agents` keeps its `ADMIN`/`MANAGER`/`AGENT` lookup group). `MANAGER`, `AGENT`, `CUSTOMER`, and unauthenticated callers receive `403 FORBIDDEN` / `401` — the `docs/18` §15 "MANAGER only if explicitly granted" default resolves to **not granted**. Acts on internal identities only; a `CUSTOMER` id is `404`. `role` is constrained to `{ADMIN,MANAGER,AGENT}` on create and update.
  - **No inline role mutation.** Role changes only through `PATCH /api/users/:id` (the Edit User form); there is no `PATCH /users/:id/role` route and the Users table renders role/status as read-only badges.
  - **Self-management safety (server-enforced):** an `ADMIN` cannot change their own role (`409 SELF_ROLE_CHANGE_FORBIDDEN`; submitting the unchanged current role is fine) or deactivate their own account (`409 SELF_DEACTIVATION_FORBIDDEN`).
  - **Last-active-`ADMIN` protection (server-enforced, transaction-safe):** demoting or deactivating the last active `ADMIN` when no other active `ADMIN` remains → `409 LAST_ACTIVE_ADMIN_REQUIRED`. Another `ADMIN` may demote/deactivate an `ADMIN` while a different active `ADMIN` remains. There is no hard deletion.
  - **Active-session enforcement:** `requireActiveUser` reads the caller's current `role`/`isActive` from the database before `requireRole`, so a demotion or deactivation takes effect on the next `/api/users` request rather than after the 8-hour JWT expiry. A deactivated caller gets `401 ACCOUNT_DEACTIVATED`. `/auth/me` already re-reads the database. Other routers still authorize from the JWT role until expiry — this is a deliberate, bounded scope (no per-request user lookup on every endpoint; no refresh-token infrastructure).
  - New `User.isActive` (default `true`): a deactivated user cannot log in (`403 ACCOUNT_DEACTIVATED`), fails `GET /auth/me` mid-session (`401 ACCOUNT_DEACTIVATED`), fails `/api/users` admin requests (`401`), and is excluded from `/users/agents` results.

### Implemented on feature branch

- Email channel (`feature/email-channel`, ADR-044): the Resend webhook is an external machine endpoint authenticated only by verified `svix-*` signatures over the exact raw body. Product JWTs do not authorize it. Outbound EMAIL continues through `POST /api/tickets/:id/messages`, so existing ADMIN/MANAGER visibility and assigned-AGENT conversation rules run before Resend. CUSTOMER remains rejected from internal APIs, and internal notes never send email. Inbound side effects use the existing system-actor history and internal notification boundaries.
- Per-user Notifications read/unread: `ADMIN`, `MANAGER`, and `AGENT` can list and mutate only their own records; `CUSTOMER` is rejected.
- SLA monitoring is not role-authenticated. `GET /api/internal/sla-monitor` accepts only the deployment scheduler's independent `CRON_SECRET`; product JWTs grant no access. Automated history has no actor, assignment stays within active `AGENT` department/branch eligibility, and alert records are delivered through the existing per-user Notifications boundary.
- WhatsApp integration (`feature/whatsapp-integration`, ADR-030): `GET`/`POST /api/integrations/whatsapp/webhook` are external machine endpoints and are **not** role-authenticated. `GET` verification checks `hub.verify_token` against `WHATSAPP_VERIFY_TOKEN` (constant-time); `POST` verifies Meta's `X-Hub-Signature-256` HMAC keyed by `WHATSAPP_APP_SECRET`. Product JWTs grant no access; unset secrets return `503 WHATSAPP_NOT_CONFIGURED`; a bad signature returns `401`. Inbound-message side effects (customer/ticket/message creation, notifications) run with `actorUserId = null` history and reuse the existing notification boundary. **Outbound** WhatsApp replies go through the unchanged `POST /api/tickets/:id/messages` — the existing ticket-conversation RBAC (assigned-agent rule for `AGENT`, full access for `ADMIN`/`MANAGER`, `CUSTOMER` rejected) runs *before* any WhatsApp send, so an agent can only trigger a send on a ticket they may already reply to. No WhatsApp-specific role or permission is introduced.
- Tasks and Reminders (`feature/tasks-reminders`, ADR-029): `/api/tasks` is `ADMIN`/`MANAGER`/`AGENT` only (`CUSTOMER` → `403`, no Portal route). `ADMIN`/`MANAGER` see and manage every task; an `AGENT` sees only tasks they created or are assigned, may only self-assign, and — when assigned but not the creator — may change only the task status. Task deletion is limited to `ADMIN`/`MANAGER` or the creator. Optional ticket linkage is checked against the ticket-visibility policy for both the actor and the assignee. The due-date reminder sweep `GET /api/internal/task-reminders` is cron-only and reuses the same `CRON_SECRET` bearer check as SLA monitoring; it delivers `TASK_REMINDER` records through the per-user Notifications boundary.
- Team Collaboration (`feature/team-collaboration`, ADR-032): internal-only `@mentions` in ticket notes plus per-ticket watchers. `GET /api/users/mentionable` uses the same `ADMIN`/`MANAGER`/`AGENT` lookup group as `/users/agents` and returns active internal users only — never `CUSTOMER`. The watcher routes (`GET`/`POST /api/tickets/:id/watchers`, `DELETE /api/tickets/:id/watchers/me`) are `ticketRouter` sub-routes: `requireAuth` + `requireRole(ADMIN, MANAGER, AGENT)`, and each re-checks the existing ticket-visibility predicate so a hidden ticket returns `404 TICKET_NOT_FOUND`. `POST`/`DELETE` act on the authenticated caller only (self-watch / self-unwatch). Mention resolution keeps only active `ADMIN`/`MANAGER`/`AGENT` users and drops the note author; `CUSTOMER` is never mentionable and never a watcher. `TICKET_MENTION` and `TICKET_WATCH_ACTIVITY` notifications go through the existing per-user Notifications boundary. No Portal route and no customer-visible collaboration data.

### Unresolved — require a product decision before a permission can be written

- Settings is ADMIN-only: Category and SLA Rule management plus a link to the existing Quick Replies workspace. MANAGER, AGENT, and CUSTOMER receive `403` from `/api/settings/*` and cannot access `/settings`. Existing Quick Replies authorization remains unchanged.
- Custom Branding: who may change application/Portal branding and within what bounds (`feature/custom-branding`).
- General Audit Logs: whether a dedicated `AuditLog` beyond `TicketHistory` is introduced, and who reads it.

Do not describe Settings permissions as implemented in `master`. Knowledge Base management (`feature/knowledge-base`), Quick Replies management (`feature/quick-replies`), `CUSTOMER` feedback submission (`feature/customer-feedback`, integrated at `12a0c12`), `ADMIN`/`MANAGER` Reports read access (`feature/reports`, on branch), `ADMIN`-only Users administration (`feature/user-management`, on branch), and Tasks & Reminders (`feature/tasks-reminders`, on branch) are implemented; the other role-list items below remain the target model.

## Roles

### ADMIN
- full operational access
- user management
- settings access
- reports
- all tickets and customers
- manage quick replies

### MANAGER
- view all relevant tickets
- create tickets
- assign agents
- escalate tickets
- access reports
- manage knowledge base
- manage quick replies
- monitor SLA

### AGENT
- view tickets assigned to them and unassigned tickets
- create internal tickets
- change priority and normal workflow status only on tickets assigned to them
- cannot view tickets assigned to another agent
- cannot assign, reassign, claim, manually escalate, or remove escalation
- reply to tickets
- update permitted statuses
- add internal notes
- list and search customers, view customer details/support context, and read existing customer notes
- cannot create, update, or delete customers and cannot add customer-profile notes
- use quick replies

### CUSTOMER
- view own profile
- create own tickets
- view own tickets
- reply to own tickets
- upload attachments to own tickets
- view knowledge base
- submit feedback for own eligible tickets

Customer identities cannot access internal ticket-management APIs or pages. Customer ticket creation and ownership-scoped access use later Customer Portal workflows.

## Internal Ticket Permissions

- `ADMIN` and `MANAGER` may view every ticket, create tickets, assign or reassign tickets to `AGENT` users, change priority, and perform any valid documented status transition.
- `AGENT` may view assigned and unassigned tickets and create tickets. An agent may change priority or use normal non-escalation status transitions only on a ticket assigned to that agent.
- An agent-created internal ticket is assigned server-side to its authenticated creator. Agents cannot supply `assignedAgentId`, including their own ID or `null`.
- After creation, an agent may update only `status` and `priority`, and only while assigned. Subject, description, category, department, branch, and assignment remain `ADMIN`/`MANAGER` capabilities.
- Customer-context ticket lists apply the same rule: `customerId` filtering never grants broader access, so an agent sees only that customer's tickets assigned to them or currently unassigned.
- The separate Customer Management history endpoint may expose safe summaries for every ticket belonging to the opened customer. Other-agent summaries are `SUMMARY_ONLY`; this never authorizes Ticket detail, conversation, history, notes, or mutation APIs.
- Assignment targets must have the `AGENT` role. Assigning `ADMIN`, `MANAGER`, or `CUSTOMER` users is invalid.
- Unassigned tickets remain read-only for agent workflow mutations. Claiming an unassigned ticket is outside the Ticket Management feature.
- Ticket conversation follows the same mutation boundary: an `AGENT` may add a public reply or internal ticket note only when the ticket is assigned to that agent. `ADMIN` and `MANAGER` may add replies and notes to any visible ticket. Unassigned tickets remain read-only for agent conversation mutations.
- Ticket history is visible wherever the caller is authorized to view the ticket.
- Dashboard visibility continues to include assigned and unassigned tickets for AGENT metrics, distribution, and Recent Tickets. The Dashboard primary work queue is a presentation-specific subset containing only that agent's active assigned tickets; it does not change Ticket Management access or add claiming.
- `ADMIN` and `MANAGER` may close any `RESOLVED` ticket. An `AGENT` may close only a `RESOLVED` ticket assigned to that agent. Closing continues through `PATCH /tickets/:id` with `{ "status": "CLOSED" }`.

## Security Rules

## Internal Customer Management Permissions

| Capability | ADMIN | MANAGER | AGENT | CUSTOMER |
| --- | --- | --- | --- | --- |
| List/search customers | Yes | Yes | Yes | No |
| View customer details and notes | Yes | Yes | Yes | No |
| Create/update/delete eligible customers | Yes | Yes | No | No |
| Add customer-profile notes | Yes | Yes | No | No |

Customer-route middleware is authoritative. The client keeps Customers navigation and read pages available to `AGENT`, hides mutation actions, and redirects direct visits to customer create/edit forms back to `/customers` with replace navigation.

## Internal Knowledge Base Permissions

| Capability | ADMIN | MANAGER | AGENT | CUSTOMER |
| --- | --- | --- | --- | --- |
| List/search internal articles, filter by status/category | Yes | Yes | Yes | No |
| Read `DRAFT` and `PUBLISHED` article detail | Yes | Yes | Yes | No |
| Create articles | Yes | Yes | No | No |
| Edit articles | Yes | Yes | No | No |
| Publish / unpublish (`DRAFT` ↔ `PUBLISHED`) | Yes | Yes | No | No |
| Delete articles | Yes | Yes | No | No |
| Read `PUBLISHED` articles via Customer Portal Help Center | No | No | No | Yes |

`/api/knowledge-articles/*` middleware is authoritative: `requireAuth` then a read role group (`ADMIN`/`MANAGER`/`AGENT`) on `GET` and a manage role group (`ADMIN`/`MANAGER`) on `POST`/`PATCH`/`DELETE`. `AGENT` and `CUSTOMER` receive the standard `403 FORBIDDEN` on mutations. `createdById` is assigned from the authenticated user and never accepted from the client; unknown request fields are rejected. `/api/portal/knowledge-articles/*` is `CUSTOMER`-only, always filters `status = PUBLISHED`, and returns an identical `404` for a `DRAFT` id and a missing id so draft existence cannot be probed.

The client shows the internal Knowledge Base navigation item to `ADMIN`/`MANAGER`/`AGENT` (never `CUSTOMER`), shows the Create/Edit/Delete controls only to `ADMIN`/`MANAGER`, and guards `/knowledge-base/new` and `/knowledge-base/:id/edit` with replace navigation to `/knowledge-base` for `AGENT`. `/knowledge-base` and `/knowledge-base/:id` remain available to `AGENT`. These guards are UX only; backend middleware is authoritative.

## Customer Feedback Permissions (`feature/customer-feedback`, on branch)

| Capability | ADMIN | MANAGER | AGENT | CUSTOMER |
| --- | --- | --- | --- | --- |
| Submit feedback (`POST /api/portal/tickets/:id/feedback`) | No | No | No | Own `RESOLVED`/`CLOSED` ticket, once |
| Read own submitted feedback (`GET /api/portal/tickets/:id/feedback`) | No | No | No | Own ticket only |

`portalRouter` middleware is authoritative: `requireAuth` then `requireRole(CUSTOMER)`. Internal roles and unauthenticated callers are rejected. Ticket ownership derives from `User -> Customer.userId`; `customerId` is never accepted from the client. A non-owned or missing ticket returns `404 TICKET_NOT_FOUND` (IDOR-safe); an owned ticket in any status other than `RESOLVED`/`CLOSED` returns `409 TICKET_NOT_ELIGIBLE_FOR_FEEDBACK`; a second submission returns `409 FEEDBACK_ALREADY_SUBMITTED`. There is no internal `/api/feedback` route; internal staff will read satisfaction data through `feature/reports`.

## Internal Quick Replies Permissions (`feature/quick-replies`, integrated at `79c7067`)

| Capability | ADMIN | MANAGER | AGENT | CUSTOMER |
| --- | --- | --- | --- | --- |
| List/search quick replies, read one | Yes | Yes | Yes | No |
| Create / edit / delete quick replies | Yes | Yes | No | No |
| Insert a quick reply into the internal public-reply composer | Yes | Yes | Yes | No |

`/api/quick-replies/*` middleware is authoritative: `requireAuth` then a use-role group (`ADMIN`/`MANAGER`/`AGENT`) on `GET` and a manage-role group (`ADMIN`/`MANAGER`) on `POST`/`PATCH`/`DELETE`. `AGENT` and `CUSTOMER` receive the standard `403 FORBIDDEN` on mutations; `CUSTOMER` and unauthenticated callers are rejected from every route. `createdById` is assigned from the authenticated user and never accepted from the client; unknown request fields are rejected. There is no Portal route — the Customer Portal never exposes quick replies, and the picker never appears in the Internal Note tab.

The client shows the `/quick-replies` navigation item and management workspace to `ADMIN`/`MANAGER` only and guards `/quick-replies`, `/quick-replies/new`, and `/quick-replies/:id/edit` with replace navigation to `/dashboard` for `AGENT` and `CUSTOMER`. These guards are UX only; backend middleware is authoritative. Selecting a quick reply in the composer inserts editable plain text and never sends.

- Never enforce permissions only in the UI.
- CUSTOMER must never read another customer's ticket.
- AGENT access rules must be explicit.
- Password hashes never leave the server.
- JWT secrets live in environment variables.
- Sensitive server errors are not returned to clients.
- Public registration cannot select an authorization role.
- Invalid login attempts return the same generic error whether or not the email exists.
- Backend middleware verifies authentication and role requirements; frontend route guards provide navigation behavior only.

## Internal Attachment Permissions (`feature/attachments`, integrated at `8e24d22`)

| Capability | ADMIN | MANAGER | AGENT | CUSTOMER |
| --- | --- | --- | --- | --- |
| List/download ticket & message attachments | Yes (tickets they may view) | Yes | Through existing ticket visibility only | No (`403`) |
| Upload a ticket attachment | Yes | Yes | Only on a ticket assigned to that agent | No |
| Upload a message attachment | Only on own message | Only on own message | Only on own message on an assigned ticket | No |
| List/download customer-profile attachments | Yes | Yes | Yes (read-only Customer Management access) | No |
| Upload a customer-profile attachment | Yes | Yes | No (`403`) | No |
| Download via `GET /api/attachments/:id/download` | Yes | Yes | Through the same context checks | No |

Unauthenticated internal requests receive `401`. Route middleware is authoritative: `requireAuth` then `requireRole(ADMIN, MANAGER, AGENT)` on `/api/attachments` and the ticket sub-routes; the customer sub-routes reuse the customer read group for `GET` and the customer write group (`ADMIN`/`MANAGER`) for `POST`. Context ids and `storageKey` are never accepted from the request body. Missing/hidden tickets return `404 TICKET_NOT_FOUND`; missing/unauthorized attachments return `404 ATTACHMENT_NOT_FOUND`; missing stored objects also return `404 ATTACHMENT_NOT_FOUND` with no provider detail.

## Customer Portal Attachment Permissions (`feature/attachments`, integrated at `8e24d22`)

`CUSTOMER` only; internal roles receive `403` from `/api/portal/attachments/*` and the portal ticket attachment routes. Ownership derives from `User -> Customer.userId`; no client `customerId` participates. A customer may list/download attachments only when their context belongs to an owned ticket/message, and may upload one file at a time to an owned ticket that is not `CLOSED` (`409 TICKET_CLOSED` otherwise). A Portal upload alone never creates a message or reopens the ticket. Customer-profile attachments and other customers' attachments return `404 ATTACHMENT_NOT_FOUND`.

## Customer Portal boundary

The Portal namespace and `/portal` browser routes accept `CUSTOMER` only. Internal roles continue using CRM routes and receive `403` from Portal APIs. Every Portal operation resolves `User -> Customer.userId`; no client customer ID or email participates in authorization. Ticket access queries combine ticket ID with the authenticated Customer ID.
