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

### Planned — permission model known, not implemented

- `ADMIN`/`MANAGER` Knowledge Base management and `AGENT`/published-customer read (`feature/knowledge-base`).
- `CUSTOMER` attachment upload and staff attachment access per context (`feature/attachments`).
- `AGENT` quick-reply use and `ADMIN` quick-reply management (`feature/quick-replies`).
- `CUSTOMER` feedback submission for own eligible tickets (`feature/customer-feedback`).
- `ADMIN`/`MANAGER` Reports access (`feature/reports`).
- `ADMIN`-managed internal user creation and role changes (`feature/user-management`).
- Per-user Notifications read/unread (`feature/notifications`).

### Unresolved — require a product decision before a permission can be written

- Tasks and Reminders: ownership, assignment, and role visibility are undefined (`feature/tasks-reminders`).
- Team Collaboration: scope (mentions, watchers, handoff, shared comments, or tasks) is undefined (`feature/team-collaboration`).
- Settings: which configurable resources `ADMIN` (and possibly `MANAGER`) may edit (`feature/settings`).
- Custom Branding: who may change application/Portal branding and within what bounds (`feature/custom-branding`).
- General Audit Logs: whether a dedicated `AuditLog` beyond `TicketHistory` is introduced, and who reads it.

Do not describe Users Management, Knowledge Base management, Feedback, Notifications, Tasks, Settings, or Reports permissions as implemented. The role lists below are the target model.

## Roles

### ADMIN
- full operational access
- user management
- settings access
- reports
- all tickets and customers

### MANAGER
- view all relevant tickets
- create tickets
- assign agents
- escalate tickets
- access reports
- manage knowledge base
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

- Never enforce permissions only in the UI.
- CUSTOMER must never read another customer's ticket.
- AGENT access rules must be explicit.
- Password hashes never leave the server.
- JWT secrets live in environment variables.
- Sensitive server errors are not returned to clients.
- Public registration cannot select an authorization role.
- Invalid login attempts return the same generic error whether or not the email exists.
- Backend middleware verifies authentication and role requirements; frontend route guards provide navigation behavior only.

## Customer Portal boundary

The Portal namespace and `/portal` browser routes accept `CUSTOMER` only. Internal roles continue using CRM routes and receive `403` from Portal APIs. Every Portal operation resolves `User -> Customer.userId`; no client customer ID or email participates in authorization. Ticket access queries combine ticket ID with the authenticated Customer ID.
