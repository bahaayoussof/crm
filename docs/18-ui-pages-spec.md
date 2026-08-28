# UI Pages Specification

## 1. Purpose

This document is the implementation blueprint for the application's main screens.

It complements:

- `09-frontend-guidelines.md`
- `06-auth-rbac.md`
- `07-ticket-workflow.md`
- `08-sla-automation.md`
- `05-api-contract.md`

The AI must not invent a materially different screen structure when a page is defined here.

If implementation constraints require a meaningful deviation:
1. preserve the page goal,
2. preserve the information hierarchy,
3. record the decision in `17-decisions-log.md`.

---

# 2. Global Product Shell

## Internal CRM Shell

Used by:

- ADMIN
- MANAGER
- AGENT

Desktop structure:

```text
┌──────────────┬───────────────────────────────────────────────┐
│ Sidebar      │ Top Header                                    │
│              ├───────────────────────────────────────────────┤
│              │                                               │
│              │ Main Page Content                             │
│              │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

### Sidebar Navigation

Recommended items:

```text
Dashboard
Tickets
Customers
Knowledge Base
Reports
Users
Settings
```

Visibility depends on role.

### Header

May contain:

- breadcrumb or page title context
- global ticket/customer search if implemented
- notifications
- language switcher
- user menu

Do not add decorative content to the header.

---

## Customer Portal Shell

Used by CUSTOMER.

Structure:

```text
┌───────────────────────────────────────────────┐
│ Portal Header                                 │
├───────────────────────────────────────────────┤
│                                               │
│ Main Content                                  │
│                                               │
└───────────────────────────────────────────────┘
```

Navigation:

```text
Home
My Requests
Knowledge Base
```

The customer portal must be visually simpler and less dense than the internal CRM.

---

# 3. Login

## Route

```text
/login
```

## Goal

Allow users to authenticate using email and password.

## Layout

Desktop:

```text
┌──────────────────────────────────────────────────────┐
│                                                      │
│                 Customer Support CRM                 │
│                                                      │
│             ┌──────────────────────────┐             │
│             │ Sign in                  │             │
│             │                          │             │
│             │ Email                    │             │
│             │ [                    ]   │             │
│             │                          │             │
│             │ Password                 │             │
│             │ [                    ]   │             │
│             │                          │             │
│             │ [ Sign in ]              │             │
│             └──────────────────────────┘             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## Components

- Logo/product name
- Email field
- Password field
- Password visibility toggle
- Submit button
- Authentication error alert

## Data

```text
email
password
```

## States

### Default
Form ready.

### Loading
Disable submission and show progress.

### Validation Error
Display field-level errors.

### Authentication Error
Display human-readable form-level error.

### Success
Redirect according to role.

Preferred:
- internal roles -> `/dashboard`
- CUSTOMER -> `/portal`

## Responsive

- single centered form
- full-width card within mobile-safe padding
- no two-column marketing section required

---

# 4. Dashboard

## Route

```text
/dashboard
```

## Roles

- ADMIN
- MANAGER
- AGENT

Content may vary by role.

## Goal

Answer:

1. What needs attention now?
2. How much support work is active?
3. Are SLA targets at risk?
4. What has recently changed?

## Layout

```text
Dashboard Header
────────────────────────────────────────────────────

KPI Cards
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│ Open       │ │ Assigned   │ │ SLA Risk   │ │ Resolved   │
│ 42         │ │ 18         │ │ 4          │ │ 27 Today   │
└────────────┘ └────────────┘ └────────────┘ └────────────┘

Operational Charts
┌───────────────────────────────┐ ┌──────────────────────┐
│ Ticket Volume                 │ │ Priority / Status    │
│                               │ │ Distribution         │
└───────────────────────────────┘ └──────────────────────┘

Needs Attention
────────────────────────────────────────────────────
Ticket rows

Recent Activity / Recent Tickets
────────────────────────────────────────────────────
Rows or compact list
```

## KPI Cards

Preferred metrics:

- Open Tickets
- Assigned to Me
- SLA At Risk or Breached
- Resolved Today

Optional if API supports it:
- Average Response Time
- Customer Satisfaction

Do not add KPI cards only for visual symmetry.

## Needs Attention

Prioritize:

1. SLA breached
2. urgent tickets
3. high priority tickets
4. long-waiting tickets
5. unassigned tickets where relevant

Suggested row data:

```text
Ticket ID
Subject
Customer
Priority
Status
SLA state
Assignee
Updated time
```

For `ADMIN` and `MANAGER`, this section remains **Needs Attention** across their system-wide visibility. For `AGENT`, it becomes **My Assigned Tickets** and contains only active tickets assigned to the authenticated agent. Unassigned tickets remain visible in the Unassigned KPI and may appear in Recent Tickets, but do not appear in the agent's primary queue.

Recent Tickets contains the newest role-visible tickets after excluding every identifier already shown in the primary queue. It may therefore include eligible unassigned or terminal tickets for an agent, but never a ticket assigned exclusively to another agent.

Both Dashboard desktop tables use an explicit minimum table width, horizontally scrollable bounded container, fixed column sizing, non-touching headers, and contained long Subject, Customer, assignee, date, and technical values. Mobile continues to use compact cards with overflow-safe content. Ticket identifiers remain locally LTR in English and Arabic.

## Charts

Preferred:

### Ticket Trend
Created vs resolved over time.

### Distribution
One of:
- tickets by status
- tickets by priority

Do not overload the dashboard with charts.

## Actions

- click KPI -> filtered tickets view where practical
- click ticket -> ticket details
- optional "View all tickets"

## Agent Variation

AGENT dashboard should emphasize:

- Assigned to Me
- Due Soon
- Waiting Customer
- Recent assigned tickets

## Manager/Admin Variation

May emphasize:

- All open tickets
- SLA breaches
- unassigned tickets
- agent performance summary

## Responsive

Desktop:
- 4 KPI columns when width allows
- chart + summary split

Tablet:
- 2 KPI columns

Mobile:
- single or 2-column compact cards
- charts stack vertically
- ticket rows become compact cards/list

---

# 5. Tickets List

## Route

```text
/tickets
```

## Roles

- ADMIN
- MANAGER
- AGENT

## Goal

Efficiently scan, search, filter, and open support tickets.

## Page Header

```text
Tickets                                    [Create Ticket]
Manage and track customer support requests
```

`Create Ticket` visibility depends on permissions.

## Toolbar

```text
[ Search tickets... ]

Status ▼
Priority ▼
Assignee ▼
Category ▼
Channel ▼

[Clear filters]
```

Filters should use URL search params when practical.

## Desktop Table

```text
┌───────┬────────────────────┬────────────┬──────────┬──────────────┬────────────┬──────────┐
│ ID    │ Subject            │ Customer   │ Priority │ Status       │ Assignee   │ SLA      │
├───────┼────────────────────┼────────────┼──────────┼──────────────┼────────────┼──────────┤
│ #1042 │ Cannot login       │ Ahmed      │ High     │ Open         │ Bahaa      │ 42m      │
│ #1041 │ Payment failed     │ Sara       │ Urgent   │ In Progress  │ Omar       │ Breach   │
└───────┴────────────────────┴────────────┴──────────┴──────────────┴────────────┴──────────┘
```

Optional columns:

- channel
- category
- updated time

Do not make the table so wide that all columns become unreadable.

The desktop table uses an explicit column-width contract inside a horizontally scrollable wrapper. Subject owns the largest width and uses contained two-line wrapping for long or unbroken text. Customer reserves a separate readable width; names and LTR-isolated emails truncate inside their own cell. Tablet keeps the intentionally reduced column set, while mobile retains compact cards with overflow-safe subject, customer, identifier, priority, and date content. English and Arabic preserve the same cell ownership.

## Row Behavior

Clicking a row opens:

```text
/tickets/:id
```

## Status Display

Use consistent `TicketStatusBadge`.

## Priority Display

Use consistent `TicketPriorityBadge`.

## SLA Display

Examples:

```text
Met
42m left
At risk
Breached
```

## Pagination

Use server-side pagination when implemented.

Suggested controls:

```text
Previous
Page X of Y
Next
```

## Empty States

### No tickets

```text
No tickets yet
Create the first support request.
[Create Ticket]
```

### No filter results

```text
No tickets match these filters
Try changing or clearing your filters.
[Clear filters]
```

## Loading

Table skeleton preserving header/row structure.

## Mobile

Do not squeeze the full table.

Use compact ticket cards:

```text
#1042                           High
Cannot login

Ahmed Mohamed
Open • 42m SLA
Assigned to Bahaa
```

---

# 6. Create Ticket

## Route

```text
/tickets/new
```

## Roles

Internal roles with create permission.

Customer creation uses portal route and customer-specific rules.

## Goal

Create a support ticket with enough metadata to route and manage it.

## Form Fields

Required:

```text
Customer
Subject
Description
Priority
Category
```

Optional:

```text
Assigned Agent
Channel
Attachments
```

Default channel for internal-created tickets:

```text
WEB
```

unless another supported channel is explicitly selected.

## Layout

Prefer one main form with grouped sections.

```text
Create Ticket

Ticket Details
──────────────────────────
Customer
Subject
Description

Classification
──────────────────────────
Priority
Category
Channel

Assignment
──────────────────────────
Agent

Attachments
──────────────────────────
Files

[Cancel] [Create Ticket]
```

## Behavior

- customer selector should support search
- validation errors shown inline
- successful creation redirects to ticket details
- preserve form after recoverable API failure
- `AGENT` sees no assignee selector and the request omits `assignedAgentId`; the server returns the ticket already assigned to that agent
- `ADMIN` and `MANAGER` may select a valid agent or create an unassigned ticket

## Mobile

Single-column full-width form.

---

# 7. Ticket Details / Ticket Workspace

## Route

```text
/tickets/:id
```

## Roles

- ADMIN
- MANAGER
- AGENT

Authorization remains server-side.

The definition-edit route `/tickets/:id/edit` is restricted to `ADMIN` and `MANAGER`; direct agent navigation redirects to Ticket Details with replacement navigation. Agent creation at `/tickets/new` remains available.

## Goal

Provide the complete operational workspace for resolving one support request.

This is the most important internal product screen.

## Desktop Layout

Preferred:

```text
┌────────────────────┬─────────────────────────────────┬────────────────────────┐
│ Queue / Context    │ Conversation                    │ Customer / Ticket Info │
│                    │                                 │                        │
│ Search             │ #CS-1042 Cannot login          │ Ahmed Mohamed          │
│ Filters            │ High • In Progress             │ ahmed@example.com      │
│                    │                                 │ +20...                 │
│ Ticket list        │ Conversation timeline           │                        │
│                    │                                 │ Recent Tickets         │
│                    │                                 │                        │
│                    │                                 │ SLA                    │
│                    │                                 │ Response ✓             │
│                    │                                 │ Resolve 01:32          │
│                    │                                 │                        │
│                    │ [Reply] [Internal Note]         │ Assignee               │
│                    │ Composer                        │ Category               │
└────────────────────┴─────────────────────────────────┴────────────────────────┘
```

The queue panel may be omitted when necessary.

The conversation remains the primary center panel.

---

## Ticket Header

Must show:

- ticket ID
- subject
- status
- priority

Useful secondary metadata:

- created time
- channel
- category
- assignee

Quick controls may allow:

- status change
- priority change
- assignment

Avoid putting every possible action in the header.

`ADMIN` and `MANAGER` retain definition editing plus Status, Priority, Category, and Assignment controls. An assigned `AGENT` receives only Status, Priority, Reply, Internal Note, and an eligible Close action; Category remains read-only metadata. An unassigned agent view keeps detail, conversation, history, and customer context readable, hides save/edit/close actions, disables conversation submission, and explains that assignment is required before mutation.

For a `RESOLVED` ticket, eligible users receive a dedicated localized `Close ticket` action. Closing requires an accessible inline confirmation with Confirm and Cancel controls, prevents duplicate pending requests, uses the existing `{ status: "CLOSED" }` mutation, and reports localized failure without replacing rich detail data. `CLOSED` is absent from the generic status selector.

---

## Conversation Timeline

Each entry shows:

- author name (`min-w-0 break-words`)
- author role
- localized timestamp (`<time dir="ltr">`, `whitespace-nowrap shrink-0` — never wraps character-by-character and is never overlapped by the body)
- message body
- whether the entry is a public reply (`"Visible to customer"`) or an Internal Note (`"Internal note"` label) — an explicit localized label, never conveyed by side or colour alone
- message attachments (public messages only)

### Implemented presentation

Entries are compact bordered cards, not edge-to-edge rows. Each card is `min-w-0`, full width on mobile and `max-w-[min(85%,46rem)]` on `sm+` so it never spans the whole content column on wide screens. Logical side alignment via flexbox `justify-*` (flips naturally under RTL): customer messages and Internal Notes at the logical start, staff public replies at the logical end. Internal Notes keep the tinted amber surface **and** the explicit `"Internal note"` label. Restrained borders/spacing — not casual social-media bubbles.

### Long messages — progressive disclosure

Short messages render in full. A genuinely long message (deterministic threshold: body longer than 800 characters **or** more than 10 newlines — documented here, chosen over fragile runtime overflow detection) is line-clamped to ~10 lines with a localized **Show more** / **Show less** toggle carrying `aria-expanded`. The complete, unchanged message text is always in the DOM (clamped, never truncated); `white-space: pre-wrap` preserves newlines, `overflow-wrap: anywhere` keeps long URLs and unbroken strings inside the card and copyable when expanded. Body is plain text — raw HTML is never rendered.

### Long-content containment (Ticket Details generally)

The two Ticket Details grid columns are `min-w-0` so intrinsic content cannot widen the `minmax(0,1fr)` track and produce a page-level horizontal scrollbar; the fix is `min-w-0` on the shrinkable grid/flex children, not application-level `overflow-x-hidden`. Message bodies, the ticket subject (`h1`), the description, History action/description rows, and the customer email/phone all use `break-words [overflow-wrap:anywhere]`; `whitespace-pre-wrap` is kept only where newlines matter (message body, description). Attachment filenames stay `truncate` with the full value exposed through `title`. The app sidebar keeps its fixed width; the main column stays inside the viewport.

---

## Composer

Tabs/modes:

```text
Reply
Internal Note
```

### Reply

Customer-visible.

Controls:

- editor/textarea
- attachment button when implemented
- quick reply selector if implemented
- AI suggest reply when available
- send button

### Internal Note

Internal only.

Controls:

- textarea
- add note

Must clearly communicate:

```text
Only your team can see this note
```

---

## AI Actions

When enabled:

```text
Summarize
Suggest Reply
Suggest Category
Suggest Article
```

Recommended placement:

- summary near ticket context
- suggest reply inside composer
- category suggestion near classification
- article suggestion near response/customer help context

AI output must require human review.

---

## Customer Context Panel

Sections:

### Customer
- name
- email
- phone
- customer since / created date when useful

### Ticket
- status
- priority
- category
- channel
- created
- updated

### Assignment
- assigned agent
- department later if implemented
- branch later if implemented

### SLA
- localized request-time SLA state with text, never color alone
- currently effective first-response or resolution target
- effective deadline when one applies
- raw first-response deadline and completion timestamp
- raw resolution deadline
- explicit met or not-configured explanation when no effective deadline applies

Keep this as a compact bordered subsection inside the existing metadata surface, not a nested card. Dates use the existing locale formatter with LTR isolation. The browser does not recalculate state, run a countdown, poll, or create timers solely for SLA.

### Recent Tickets
Small list of recent customer tickets.

Click opens another ticket.

---

## Ticket History

May be:

- collapsible panel
- side section
- dedicated tab/section

Show important events:

```text
Created
Assigned
Status changed
Priority changed
Resolved
Closed
Reopened
```

---

## Ticket States

### Loading
Workspace skeleton.

### Not Found
Clear 404 state.

### Unauthorized
Permission message without leaking ticket details.

### Error
Retry action when useful.

---

## Mobile

Ticket workspace becomes one primary column.

Order:

```text
Ticket Header
Conversation
Composer
Customer / Ticket Details
SLA
History
```

Secondary context may use accordion or sheet.

Do not keep a three-column layout on mobile.

The SLA subsection follows the same single-column metadata flow on mobile, allows dates to wrap, mirrors through document direction in Arabic, and keeps ticket controls and conversation more prominent than SLA decoration.

---

# 8. Customers List

## Route

```text
/customers
```

## Roles

- ADMIN
- MANAGER
- AGENT subject to permission

## Goal

Find customers and understand their support activity quickly.

## Page Header

```text
Customers                                  [Add Customer]
Manage customer profiles and support history
```

## Toolbar

```text
[Search customers...]
```

Additional filters only if needed.

## Desktop Table

Recommended:

```text
Name
Email
Phone
Open Tickets
Total Tickets
Last Interaction
```

Example:

```text
Ahmed Mohamed
ahmed@example.com
+20...
2 open
12 total
10 min ago
```

## Actions

- open customer
- edit
- delete only with appropriate permission

## Empty States

Standard:
- no customers
- no search results

## Mobile

Compact cards with:

- name
- email/phone
- open ticket count
- last activity

---

# 9. Create / Edit Customer

## Routes

Implementation may use:

```text
/customers/new
/customers/:id/edit
```

or dialogs if the final design remains accessible and consistent.

## Fields

Core:

```text
Name
Email
Phone
```

Do not introduce unnecessary CRM sales fields.

## Validation

- name required
- valid email where required
- phone validation should not be unnecessarily strict for international formats

## Behavior

After create:
- redirect to customer details or return to list according to implementation

---

# 10. Customer Details

## Route

```text
/customers/:id
```

## Roles

Internal roles with customer access.

## Goal

Provide one customer record with support context.

## Header

```text
Ahmed Mohamed                                  [Edit]

ahmed@example.com
+20...
```

Optional summary badges:

```text
2 Open Tickets
12 Total Tickets
```

Avoid turning header into a large hero section.

## Tabs

```text
Overview
Tickets
Activity
Notes
Attachments
```

P1 tabs may be hidden until implemented.

---

## Overview

Recommended cards/sections:

### Contact Information
- email
- phone
- created date

### Support Summary
- open tickets
- resolved tickets
- total tickets
- last interaction

### Recent Tickets
Small ticket list.

### Recent Activity
Small activity timeline.

---

## Tickets Tab

Ticket table scoped to this customer.

Columns:

```text
ID
Subject
Priority
Status
Assignee
Updated
```

---

## Activity Tab

Timeline examples:

```text
Ticket created
Customer replied
Agent replied
Status changed
Feedback submitted
```

---

## Notes Tab

Customer-level notes only.

Do not mix ticket internal notes into customer notes unless explicitly intended.

---

## Attachments Tab

Customer-related attachments if implemented.

---

## Mobile

Tabs may:
- horizontally scroll
- become segmented controls
- collapse secondary information

Keep customer identity and current ticket summary easy to find.

---

# 11. Knowledge Base List

## Route

```text
/knowledge-base
```

## Internal Roles

- ADMIN
- MANAGER
- AGENT read access

Write permissions based on RBAC.

## Goal

Help agents find reusable solutions and allow authorized users to manage support content.

## Header

```text
Knowledge Base                              [New Article]
Create and manage support documentation
```

## Search

Prominent search field:

```text
[Search articles...]
```

## Filter

Optional:

```text
Category
Status
```

## Article List

Recommended columns:

```text
Title
Category
Status
Updated
Author
```

Alternative compact list acceptable.

## Status

Suggested:

```text
DRAFT
PUBLISHED
```

Do not invent editorial workflows unless needed.

---

# 12. Knowledge Base Article View

## Suggested Route

```text
/knowledge-base/:id
```

## Layout

```text
Breadcrumb

Article Title
Category • Updated date

Article Content

Related / Suggested articles
```

Internal authorized users may see edit action.

## Content

Prioritize readability:
- sensible line length
- headings
- lists
- code blocks where content needs them

---

# 13. Knowledge Base Editor

## Suggested Routes

```text
/knowledge-base/new
/knowledge-base/:id/edit
```

## Fields

```text
Title
Category
Content
Status
```

## Behavior

- validation
- save state
- cancel/navigation protection if unsaved handling is implemented

Do not spend excessive project time building a complex rich-text editor.

A textarea or simple supported editor is acceptable for the assessment.

---

# 14. Reports

## Route

```text
/reports
```

## Roles

- ADMIN
- MANAGER

AGENT access only if explicitly allowed.

## Goal

Provide a management summary of operational support performance.

## Header

```text
Reports
Track ticket volume, SLA performance, and team activity
```

## Filters

Optional first version:

```text
Date Range
```

Additional filters:
- agent
- category
- priority

Only if supported by APIs.

## Recommended Sections

### Overview KPIs

```text
Created Tickets
Resolved Tickets
SLA Compliance
Average Response Time
Customer Satisfaction
```

Show only metrics supported by actual data.

### Ticket Volume

Created vs resolved chart.

### Ticket Status Distribution

Bar or donut chart.

### SLA Performance

- met
- breached
- compliance percentage

### Agent Performance

Table:

```text
Agent
Assigned
Resolved
Open
SLA Met %
```

Do not claim sophisticated productivity metrics not supported by implementation.

## Responsive

Charts stack vertically.

Tables use responsive strategy.

## Implemented behavior (`feature/reports`, on branch — ADR-024)

`client/src/features/reports/reports-page.tsx` at `/reports`, guarded by `client/src/app/router/reports-route.tsx` (`canViewReports` = `ADMIN` || `MANAGER`; `AGENT`/`CUSTOMER` → `/dashboard` replace). Nav item shown only to `ADMIN`/`MANAGER`.

- **Filters:** quick-range presets (7 / 30 / 90 days) plus custom `From` / `To` date inputs, all synced to URL `from`/`to` (ISO). No params → server default (trailing 30 days). A `Reset` clears them. The resolved range and "Times shown in UTC" are printed under the filter bar.
- **Overview KPIs:** Created tickets, Resolved tickets, SLA compliance %, Avg. first response (`Nh Nm`), Customer satisfaction (`N / 5` + response count). `—` when a metric has no data.
- **Ticket volume:** created-vs-resolved grouped bar chart, one bucket per UTC day, with an `sr-only` list mirror.
- **Status distribution:** horizontal bar chart of the created cohort.
- **SLA performance:** stacked met/breached/pending bars for first response and resolution with compliance %, average first-response and resolution durations, and a per-priority met/breached/compliance table.
- **Customer satisfaction:** average summary line + 1–5 rating distribution bars from `Feedback.rating`.
- **Agent performance:** table (`Agent`, `Assigned`, `Resolved`, `Open`, `SLA met %`, `Avg. response`) on desktop, stacked cards on mobile — one row per agent active in range.
- **Ticket breakdown:** by-priority (created/resolved) and by-category (created; null → "Uncategorized") tables.
- **States:** structured skeleton while the overview query loads; page-level error + retry if it fails; each secondary section (SLA, agents, breakdown) shows its own inline "could not be loaded" + retry; localized empty states per section. Full English/Arabic + RTL; dates LTR-isolated.

Every figure is computed from stored columns (no fabricated analytics). Not verified against PostgreSQL or a browser this cycle.

---

# 15. Users Management

## Route

```text
/users
```

## Roles

ADMIN. **Implemented (`feature/user-management`, ADR-025): ADMIN only — MANAGER access was not granted.** `MANAGER`/`AGENT`/`CUSTOMER` receive `403` on every `/api/users` administration route and see no `/users` nav item; `UserManageRoute` redirects non-`ADMIN` to `/dashboard`.

## Goal

Manage internal CRM users and roles. Acts on internal identities only — portal customers are never listed or created here.

## Table

Recommended:

```text
Name
Email
Role
Status
Created
```

Table columns (desktop): **Name · Email · Role · Status · Created · Actions**. Explicit `table-fixed` widths (Name ~22%, Email flexible, Role/Status/Created/Actions fixed px). Email stays on one line (`truncate` + `dir="ltr"` + full value in `title`), never wraps character-by-character. Role and Status are **read-only localized badges** — no dropdowns in table cells. Below `md`, a card list with the same fields, actions, and a read-only role. The current signed-in admin's row carries a small `You` badge.

Row actions (one Actions cell): **Edit** (pencil → `/users/:id/edit`) and **Deactivate** / **Reactivate** (`UserRoundX` / `UserRoundCheck` icons — not a shield). The status action opens an accessible `role="dialog"` (`aria-modal`) confirmation showing the user's name, the action, and — for deactivation — the consequence ("cannot sign in; authenticated access rejected; historical tickets / messages / notes / history preserved"). The confirmation is rendered through a **React portal on `document.body`** (never inside the table or its `overflow-x-auto` wrapper) and pinned to the trigger's logical-end edge with `position: fixed` against `getBoundingClientRect()` — so it floats above the table, flips above the trigger when space below is short, clamps to the viewport (incl. 320 px), and never adds a scrollbar to the table or shifts its content. It shares the `useAnchoredPopover` floating-layer primitive (`components/shared/`) and the project `z-50`. Only one confirmation is open at a time (keyed by stable user id); clicking another row's trigger moves it; a filter/pagination change closes stale confirmation state. Focus moves to Cancel on open and returns to the trigger on Cancel/Escape/outside-pointer; Tab is trapped between Cancel and Confirm; pending state blocks a duplicate request and disables both buttons; failure stays visible with a `role="alert"` message and Confirm relabelled **Retry**. Confirm always acts on the user captured when the popover opened.

Actions:

```text
Create User   — name / email / temporary password / role (ADMIN | MANAGER | AGENT)
Edit User     — name / email / role / active flag
```

**Implemented:**
- `Status` is `User.isActive` (boolean, default active). Deactivated accounts cannot sign in (`403 ACCOUNT_DEACTIVATED`), fail `GET /auth/me` and `/api/users` admin requests mid-session (`401 ACCOUNT_DEACTIVATED`), and are hidden from ticket assignment.
- **Role changes only through Edit User** — there is no separate "Change Role" list action and no `PATCH /users/:id/role` route; the Role `<select>` in the Edit form submits inside the one safe update payload.
- **Self-management:** on your own Edit page the Role select and Active checkbox are disabled/read-only with a localized explanation; the table hides/disables self-deactivation. The server also rejects a self role change (`409 SELF_ROLE_CHANGE_FORBIDDEN`) and self-deactivation (`409 SELF_DEACTIVATION_FORBIDDEN`).
- **Last active admin is protected** (server, transaction-safe): demoting or deactivating the last active `ADMIN` → `409 LAST_ACTIVE_ADMIN_REQUIRED`. The UI also disables the action when the loaded page proves a single active admin, and still handles the server conflict with a localized accessible message, keeping form values.
- Selects use one treatment: native control, platform arrow suppressed, a single custom chevron pinned to the logical end (correct in LTR and RTL, never rotated).
- No user-deletion action — retire an account by clearing its active flag.

Avoid implementing unnecessary enterprise identity features (no password-reset email flow, bulk actions, CSV import/export, admin-action audit log, or department/branch assignment in this feature).

---

# 16. Settings

## Route

```text
/settings
```

## Roles

ADMIN.

## Goal

Central location for configuration that actually exists.

Possible sections:

```text
General
SLA Rules
Categories
Quick Replies
```

Department/branch configuration may be added later.

Implemented on `feature/settings`: ADMIN-only Categories and SLA Rules management plus a descriptive link to the existing `/quick-replies` workspace. Categories support search, create, edit, activate/deactivate, desktop table and mobile cards. SLA Rules support one LOW/MEDIUM/HIGH/URGENT row each, safe create/update, activate/deactivate, and prospective-only behavior. General, Branding, provider controls, integrations, and dead toggles are absent. Branding remains `feature/custom-branding`; Quick Replies is linked, not duplicated.

Do not create dead settings screens full of nonfunctional toggles.

---

# 17. Customer Portal Home

## Route

```text
/portal
```

## Role

CUSTOMER.

## Goal

Give customers a simple support entry point.

## Layout

```text
Welcome Header

How can we help?
[ Search help articles... ]

Primary Action
[ Create New Request ]

Request Summary
┌──────────────┐ ┌──────────────────┐ ┌──────────────┐
│ Open         │ │ Waiting for You  │ │ Resolved     │
└──────────────┘ └──────────────────┘ └──────────────┘

Recent Requests

Popular Help Articles
```

## Important

Do not expose:

- internal notes
- agent performance
- internal audit logs
- internal SLA configuration
- admin metadata

---

# 18. Customer Portal: My Requests

## Route

```text
/portal/tickets
```

## Role

CUSTOMER.

## Goal

Allow a customer to see only their own support tickets.

## List

Recommended:

```text
Ticket ID
Subject
Customer-friendly Status
Created
Updated
```

Optional:
- priority if product wants customers to see it

Do not expose internal assignee or internal escalation details by default.

## Search / Filters

Simple:

```text
Search
Status
```

Keep customer UI lightweight.

## Security

Backend must scope tickets to authenticated customer.

Never rely on frontend filtering for ownership.

---

# 19. Customer Portal: Create Request

## Route

```text
/portal/tickets/new
```

## Role

CUSTOMER.

## Goal

Make requesting help fast and understandable.

## Fields

```text
Subject
Category
Description
Attachments optional
```

Do not require customer to understand internal fields such as:

- assignee
- SLA
- department unless product requirements later demand it
- internal priority unless explicitly allowed

Default channel:

```text
WEB
```

## UX

Show useful knowledge-base suggestions later if implemented.

---

# 20. Customer Portal: Ticket Details

## Route

```text
/portal/tickets/:id
```

## Role

CUSTOMER, own tickets only.

## Layout

```text
Ticket Header
#1042 Cannot login
Status

Conversation

Reply Composer

Ticket Summary / Metadata
```

## Show

- public conversation
- attachments
- customer-friendly status
- created/updated dates
- ticket reference number

## Never Show

- internal notes
- internal-only history entries
- private staff metadata
- other customers' information
- internal AI prompts/output unless deliberately exposed
- staff-only SLA details

## Composer

Customer can:

- reply
- attach files when enabled

If RESOLVED can be reopened through reply, make behavior clear in UX.

---

# 21. Customer Portal: Knowledge Base

## Route

```text
/portal/knowledge-base
```

## Goal

Let customers find answers without creating tickets.

## Layout

```text
Help Center

[ Search for help... ]

Categories

Popular Articles

Article Results
```

Only published articles appear.

---

# 22. Notifications

## Placement

Header notification control for internal app.

Optional portal notifications only if time allows.

## Useful Notification Types

```text
Ticket assigned
Customer replied
Ticket status changed
SLA warning
SLA breached
```

## Notification Item

Display:

- concise message
- time
- read/unread state
- link to relevant ticket

Do not create noisy notifications for every database update.

### Implemented behavior (feature branch)

The internal desktop and mobile headers show one compact bell with a capped unread badge. It polls the unread count every 30 seconds and opens a portalled, viewport-clamped dialog containing the latest 20 notifications with loading, empty, error/retry, read/unread, relative-time, mark-one-read, mark-all-read, and ticket-navigation behavior. The control uses localized English/Arabic chrome and logical alignment under RTL. Notification payload text is persisted event text. Portal notifications, a dedicated full-list page, realtime delivery, browser/email/push delivery, and scheduled SLA alerts are not included.

---

# 23. Quick Replies

Implemented on `feature/quick-replies` (roadmap order 3), not yet integrated.

## Composer control (Ticket Details Reply tab)

Placement: a composer footer beneath the reply textarea, inside the internal Ticket public-reply composer only — the "Reply" tab of the ticket conversation composer. Not the Internal Note tab, not read-only / unassigned agent states, and not the Customer Portal. Mounted only when `mode === "reply" && canMutate`.

Footer layout: one row under the textarea holding the Quick Reply control at the logical start and **Send reply** at the logical end (`flex flex-col gap-2 sm:flex-row sm:items-center`, Send pushed out with `sm:ms-auto`). On mobile both controls are full-width and stack (trigger row, then Send row); on `sm+` they sit on one line. Send keeps its existing pending / disabled behaviour. The Quick Reply control is styled `button-secondary` — secondary to the primary Send button.

Collapsed trigger: a compact button `[speech-bubble icon] Insert quick reply` (localized `quickReplies.picker.trigger`; icon from the project's inline-SVG set — no icon dependency). No search field is shown until the trigger is activated. The trigger carries `aria-haspopup="listbox"`, `aria-expanded`, and `aria-controls` for the popover, and has a visible focus ring. It is understandable without the icon.

Popover selector: activating the trigger opens a popover whose content is rendered through a **React portal on `document.body`** and positioned with `position: fixed` against the trigger's `getBoundingClientRect()` — so it escapes the Ticket Conversation card's `overflow-hidden` clipping instead of being cut off inside it. It is anchored to the trigger, aligned to the trigger's logical-start edge (flipped for RTL) and clamped into the viewport; it opens below the trigger and **flips above** when there is more room there; width is `max(triggerWidth, 288px)` clamped to the viewport; height is bounded (~320px, reduced to the available space) with the result list scrolling internally; it repositions on scroll/resize while open. `z-50` keeps it above cards, borders, and the sticky page header. It contains a search `input` (`role="combobox"`, auto-focused on open, `aria-controls` the listbox) and a result `listbox`. Each result shows the Quick Reply title (primary line) and a short body preview (secondary line). Typing filters through the existing `GET /api/quick-replies` `search` contract (case-insensitive over `title` and `body`), debounced (~300 ms), fetched only while the popover is open, bounded to a deterministic page (`limit` 10, `title asc, id asc`); quick replies past the first page stay reachable by searching. The popover renders explicit loading, empty (no quick replies), and no-results (search returned nothing) states; a list-request failure shows a non-blocking inline message and leaves the composer usable. Arrow Up/Down move the active option, Enter selects, Escape closes and returns focus to the trigger, and a document-level outside `pointerdown` (outside both the trigger and the portalled panel) closes it. Selection never submits and never changes the composer mode. The card's `overflow-hidden` is left untouched — no unrelated Ticket Details overflow is removed.

Insertion: the selected `body` is inserted into the reply textarea at the current cursor — replacing the selected range if any, otherwise at the caret — preserving the draft text before and after. Blank-line spacing is added only when the adjacent side is non-empty and not already whitespace, so mid-line replacements are not broken up. Focus returns to the textarea and the caret is placed immediately after the inserted quick reply. The insert respects the public-reply maximum length (20,000, matching `ticketConversationBodySchema` / `portalReplySchema`): if the result would exceed it, the draft is left unchanged and a localized accessible error (`role="alert"`) is shown — neither the quick reply nor the existing draft is silently truncated. Unrelated composer state (the Internal Note draft, attachments, success message) is not reset.

## Ticket Details action sizing (desktop vs mobile)

`button-primary` is full width by default (mobile-friendly); on `sm+` the Ticket Details primary actions add `sm:w-auto` so they are content-sized, and align to the logical end:

- **Composer footer:** the reply textarea keeps the full composer width; beneath it a single row holds the **Insert quick reply** trigger at the logical start and **Send reply** at the logical end (`flex flex-col gap-2 sm:flex-row sm:items-center`, Send pushed out with `sm:ms-auto sm:w-auto`). Both controls stack full-width on mobile. Pending/disabled behaviour unchanged; the portalled Quick Reply popover still anchors to the trigger after this layout.
- **Attachments:** the Upload control is not a full-width primary bar on desktop — the Upload/Cancel actions sit in a `sm:justify-end` row with `sm:w-auto` on Upload (full width on mobile). Filenames are `truncate` + `title`; the row's icon actions stay grouped and cannot be pushed out of the card.
- **Manage Ticket:** Status / Priority / Category / Assigned agent use a responsive `grid gap-4 sm:grid-cols-2 xl:grid-cols-1` (single column on mobile and inside the narrow `22rem` xl sidebar, two columns at the wider `sm`–`lg` stacked layout). **Save changes** is content-sized on desktop (`sm:w-auto sm:ms-auto`), full width on mobile; validation, transitions, permissions, and mutation behaviour are unchanged. The Close-ticket confirm action is likewise `sm:w-auto`.

## Management workspace

Route: `/quick-replies` (list) and `/quick-replies/new` + `/quick-replies/:id/edit` (create/edit). Visible only to `ADMIN`/`MANAGER`; the nav item is role-gated and direct navigation by `AGENT`/`CUSTOMER` redirects to `/dashboard`.

### Desktop table

Explicit columns, in order: **Title**, **Reply text**, **Updated**, **Actions** (all four headers visible and localized). `table-fixed` with a `<colgroup>` for column ownership and a readable minimum width; horizontal scroll is contained in the table wrapper. Recommended sizing: Title `24%`, Reply text the flexible remainder, Updated `184px`, Actions `116px`. Rows are top-aligned and compact; padding is consistent. Logical `text-start` alignment for the first three columns and `text-end` for Actions, so ownership is identical in LTR and RTL. The Author value moves to mobile-card metadata only — it is not a desktop column.

- **Title cell:** medium weight, `min-w-0`, `break-words`, two-line clamp, full value in `title` when clamped; links to the edit route.
- **Reply text cell:** a controlled two-line preview — `line-clamp-2` with `whitespace-pre-line` and `[overflow-wrap:anywhere]` so both normal sentences and long unbroken strings stay inside the column; full body in `title`; never rendered as HTML.
- **Updated cell:** existing locale-aware date, `whitespace-nowrap`, direction-safe via `<bdi dir="ltr">`, stable width.
- **Actions cell:** compact icon buttons only — Edit (pencil, links to the edit route) and Delete (trash, destructive `border-red-200 text-red-700` treatment) — grouped horizontally in one cell (`size-9` targets, localized `aria-label` + `title`, visible focus rings, no wrapping into unrelated lines). Icon clicks do not trigger row navigation.

Deletion confirmation: Delete opens a small anchored confirmation popover (`role="dialog"`, `aria-label` naming the reply, `absolute`, does not reflow the table) with a localized prompt and explicit **Confirm delete** / **Cancel** controls. Focus moves to Confirm on open; Cancel or Escape closes it and returns focus to the Delete trigger; an outside interaction closes it. A pending delete disables both buttons and shows a spinner; a failed delete stays visible with a `role="alert"` message and the Confirm control relabelled **Retry**.

### Mobile cards

Below `md`, quick replies render as cards (not the desktop table): the Title as the primary value (full width, two-line clamp, links to edit), a controlled two/three-line Reply text preview, an Updated · Author metadata line, and the same Edit / Delete icon group on its own trailing row aligned to the logical end — so the actions never cover the title. Long content wraps safely with no page-level horizontal overflow; readable at 320 px and 375 px; Arabic ordering and alignment stay natural.

### Form

`Title` (2–120 chars) and `Reply text` (1–5,000 chars, plain text) with a help note that the text is inserted as editable content and never sent automatically. Loading / error / empty / no-results / success states; English/Arabic and RTL.

No placeholders or variables, categories/folders, favorites, usage analytics, or AI generation. `feature/settings` (roadmap order 7) may later surface a link to this workspace rather than a second management surface.

---

# 23b. Underdefined Original Requirements — Planning Only

The following original-assignment areas have no implementation and no complete specification. They are recorded here so they are not forgotten. Do not invent final schemas, endpoints, permissions, or screen layouts for them during unrelated work. Existing frontend design rules, English/Arabic behavior, RTL, responsive behavior, and role navigation rules still apply once each is specified.

# 24. Tasks & Reminders

Status: IMPLEMENTED on `feature/tasks-reminders` (uncommitted, automated-verified only). ADR-029. Resolutions to the former decision points:

- **Data model:** new `Task` model (`title`, `description?`, `status` OPEN/DONE, `dueAt?`, `remindedAt?`, `ticketId?`, `creatorId`, `assigneeId`) + nullable `Notification.taskId`.
- **Ownership / assignment:** creator + assignee are separate. `AGENT` may only self-assign; `ADMIN`/`MANAGER` may assign to any active `AGENT`. Cross-user assignment sends a `TASK_ASSIGNED` in-app notification.
- **Linkage:** optional ticket link only (no direct customer link — reachable through the ticket). Validated against ticket visibility for the actor and the assignee.
- **Completion:** two-state `status` toggle (mark done / reopen); reopening a `DONE` task with a due date re-arms its reminder.
- **Role visibility:** `ADMIN`/`MANAGER` see all tasks; `AGENT` sees only tasks they created or are assigned.
- **Placement:** dedicated `/tasks` route with a **Support**-section nav item for all internal roles — not a Dashboard widget. `/tasks/:id` detail + `/tasks/new` / `/tasks/:id/edit` form.

## List page (`/tasks`)

- Toolbar: debounced search (title/description) + status `AppSelect` (all/Open/Done) always; assignee `AppSelect` for `ADMIN`/`MANAGER` only. All filters sync to URL search params.
- TanStack `table` (desktop) + card list (mobile). Columns: Task (title link → detail, linked-ticket sub-link), Status (badge + client-computed **Overdue** badge when `status = OPEN` and `dueAt` is past), Assignee, Due (datetime, LTR-isolated), Actions.
- Row actions gated by field-level rights: mark-done/reopen (anyone who can edit status), Edit (content editors), Delete (creator or ADMIN/MANAGER). The delete confirmation (`task-delete-confirm.tsx`) is a `role="dialog"` popover **portalled to `document.body`** and anchored to the trigger via the shared `use-anchored-popover.ts` primitive — it floats above the table, flips above when short, clamps to the viewport, and never grows the table's `overflow-x-auto` scroll area. `TaskTable` hoists a single `{ id, variant: "desktop" | "mobile" }` open key so exactly one portalled dialog mounts (the desktop row and mobile card are both in the tree), and clears it on filter/pagination.
- Loading skeleton / error-retry / empty / no-matches states.

## Detail page (`/tasks/:id`)

Read-only: title heading, status + overdue badges, description, assignee, creator, due date, created date, linked ticket. Back / mark-done-reopen / Edit actions per rights; Delete button for creator or ADMIN/MANAGER.

## Form page (`/tasks/new`, `/tasks/:id/edit`)

- Fields: Title, Description, Due date (`datetime-local`), Status (`AppSelect`, edit only), Assignee (`AppSelect` of active agents, only for ADMIN/MANAGER).
- Assignee-only `AGENT` editors see a status-only form (all other fields disabled) with an explanatory note — mirrors the server field-level matrix.
- Create payload sends only the fields provided; empty description/due clear to `null` on edit.

## Reminders

A reminder is **not** a separate model — it is the due-date sweep over `Task`. Cron-only `GET /api/internal/task-reminders` (reuses `CRON_SECRET`, `*/5` Vercel cron) finds `OPEN` past-due tasks with `remindedAt IS NULL`, stamps `remindedAt`, and sends one `TASK_REMINDER` notification to the assignee. No snooze UI (reopen/adjust due date re-arms it); surfaces through the existing Notifications center only; in-app only, no email/push. Serverless-safe: no background worker, the scheduler drives it and the conditional `updateMany` guard makes overlapping runs idempotent.

## Team Collaboration

Status: product decision required before implementation. Branch: `feature/team-collaboration`.

Existing building blocks: internal `TicketNote` and `CustomerNote`, ticket history, assignment.

Required decision points:
- what "collaboration" means here: @mentions, watchers/followers, explicit handoff, shared comments, or task delegation
- notification behavior for each
- role visibility and whether customers ever see any of it (they must not for internal notes)
- whether it introduces new models or extends notes/history

## Custom Branding

Status: product decision required before implementation. Branch: `feature/custom-branding`.

Required decision points:
- configurable fields: application name, logo, primary accent color, Portal-specific branding
- persistence location (Settings-backed) and who may edit
- logo upload/storage (depends on `feature/attachments` storage decisions)
- safe CSS/color boundaries so branding cannot break contrast, layout, or RTL
- fallback behavior when unset or invalid

---

# 24. Common Components

Prefer domain components when repeated.

Recommended:

```text
AppSidebar
AppHeader
PageHeader

TicketStatusBadge
TicketPriorityBadge
SlaIndicator
ChannelIcon

TicketTable
TicketListItem
TicketConversation
TicketMessage
TicketComposer

CustomerSummary
CustomerContactCard

KpiCard
EmptyState
ErrorState
LoadingSkeleton

ConfirmDialog
```

Do not create an abstraction merely because two components share one CSS class.

---

# 25. Page Header Pattern

Internal pages should use a consistent page header.

Example:

```text
Tickets                                  [Primary Action]
Manage and track customer support requests
```

Structure:

- title
- short description
- primary local action

Avoid oversized headers.

---

# 26. Destructive Actions

Examples:

- Delete Customer
- Delete Ticket if supported
- Delete Article
- Disable User

Rules:

1. user explicitly initiates action
2. confirmation dialog explains consequence
3. destructive button has destructive styling
4. API errors are handled
5. success updates UI

No destructive operation occurs from a single ambiguous icon click.

---

# 27. Page State Requirements

Every major page must implement the relevant states.

## Loading
Structured skeleton.

## Empty
Clear explanation and next action.

## Error
Human-readable error and retry when useful.

## Unauthorized
No sensitive information leaked.

## Not Found
Clear resource-not-found state.

## Success
Content visibly reflects changes.

These states are part of feature completion, not polish.

---

# 28. Responsive Breakpoint Behavior

Exact Tailwind breakpoints may follow project defaults.

Conceptually:

## Mobile
- one column
- drawer navigation
- compact cards instead of wide tables
- sheets/accordions for secondary context

## Tablet
- reduced table columns
- optional collapsible side panels
- 2-column dashboard layouts

## Desktop
- dense tables
- persistent sidebar
- multi-panel ticket workspace
- wider operational dashboards

Do not build desktop-only first and postpone all responsive decisions until final polish.

---

# 29. RTL Page Behavior

All screens must remain structurally valid in Arabic.

Requirements:

- sidebar placement follows document direction where appropriate
- spacing uses logical properties where practical
- directional icons handled intentionally
- conversation alignment must not accidentally imply author solely from left/right position
- emails, URLs, ticket IDs, and numbers remain readable
- charts and table labels remain understandable

---

# 30. Role Navigation Matrix

## ADMIN

```text
Dashboard
Tickets
Customers
Knowledge Base
Reports
Users
Settings
```

## MANAGER

```text
Dashboard
Tickets
Customers
Knowledge Base
Reports
```

Settings access only when explicitly granted.

## AGENT

```text
Dashboard
Tickets
Customers
Knowledge Base
```

Reports optional if allowed.

## CUSTOMER

Separate portal:

```text
Home
My Requests
Knowledge Base
```

---

# 31. Required Demo Data

Seed data should make pages look realistic.

Create:

## Users

At minimum:
- 1 ADMIN
- 1 MANAGER
- 2 AGENTS
- 1 CUSTOMER account

## Customers

At least 8-12 realistic customers.

## Tickets

At least 15-25 tickets distributed across:

- statuses
- priorities
- categories
- agents
- SLA states

Include:
- open
- in progress
- waiting customer
- resolved
- urgent
- SLA breached
- unassigned if supported

## Conversations

Important demo tickets should contain multiple messages.

At least one ticket should demonstrate:

```text
customer message
agent reply
customer follow-up
internal note
status changes
```

## Knowledge Base

At least 5 useful demo articles across multiple categories.

## Feedback

Implemented on `feature/customer-feedback` (on branch) — see "Customer Feedback implemented behavior" in §31. `POST`/`GET /api/portal/tickets/:id/feedback`: a `CUSTOMER` submits one immutable rating (`1`–`5`) plus an optional comment for an own `RESOLVED`/`CLOSED` ticket. The rating persists on `Feedback.rating` for `feature/reports` to aggregate.

The demo seed (`feature/demo-seed-data`, roadmap order 14) is responsible for populating enough feedback rows that the reports UI does not look empty during assessment/demo.

---

# 32. Critical Demo Flow

The UI must support this scenario without manual database intervention:

```text
Internal user logs in
        ↓
Views Dashboard
        ↓
Finds or creates Customer
        ↓
Creates Ticket
        ↓
Assigns Agent
        ↓
Agent opens Ticket Workspace
        ↓
Reviews Customer context
        ↓
Adds Internal Note
        ↓
Replies to Customer
        ↓
SLA state is visible
        ↓
Customer opens Portal
        ↓
Customer replies
        ↓
Agent resolves Ticket
        ↓
Customer submits feedback if implemented
        ↓
Reports / Dashboard reflect the updated data
```

This flow has higher priority than isolated decorative pages.

---

# 33. AI Design Guardrail

The AI must not:

- redesign the overall application shell
- replace tables with decorative card grids without reason
- transform the ticket workspace into a generic chat page
- introduce a second visual language for the customer portal
- add unexplained gradients
- add glassmorphism
- add large hero illustrations
- add random metrics or fake analytics
- invent data fields solely because they look good in UI
- expose internal fields to CUSTOMER
- change page routes silently
- add a new UI/component library without approval

When uncertain, follow:

1. `09-frontend-guidelines.md`
2. this page specification
3. existing implemented patterns
4. simplest conventional support-CRM behavior

---

# 34. Frontend Feature Completion Checklist

Before marking a page/feature complete:

```text
[ ] Page matches documented purpose
[ ] Correct role access
[ ] Correct data is displayed
[ ] Primary actions work
[ ] Loading state exists
[ ] Empty state exists
[ ] Error state exists
[ ] Responsive layout checked
[ ] Mobile interaction remains usable
[ ] Accessibility basics checked
[ ] RTL compatibility preserved
[ ] Existing design system reused
[ ] No undocumented product behavior introduced
[ ] Relevant tests added where valuable
```

---

# 35. Implementation Priority

When time is limited, implement screens in this order:

```text
1. Login
2. Application Shell
3. Tickets List
4. Ticket Details / Workspace
5. Customers List
6. Customer Details
7. Create Ticket
8. Dashboard
9. Customer Portal: Requests
10. Customer Portal: Ticket Details
11. Customer Portal: Create Request
12. Knowledge Base
13. Reports
14. Users
15. Settings
16. AI enhancements
```

The ticket workflow is the product core.

Do not delay working ticket interactions to polish lower-priority screens.
### Customer Management role behavior

- `ADMIN` and `MANAGER` see Add Customer on the list and Edit, Delete, and Add Customer Note controls on details.
- `AGENT` keeps Customers navigation, list/search/pagination, detail/support context, activity, attachments, tickets, and existing-note visibility, but sees no customer mutation controls.
- The Customer Details Tickets tab uses the dedicated customer-history endpoint and shows every safe summary. FULL summaries link to Ticket Details; an AGENT's other-assignee SUMMARY_ONLY rows/cards have no link or actions and display a localized read-only explanation.
- Customer ticket history distinguishes loading, request failure, true no-ticket history, and pagination. Desktop uses a dense table; mobile uses the same response in compact cards; ticket identifiers preserve LTR isolation.
- The agent Notes view shows a localized read-only explanation instead of the add-note form.
- `/customers/new` and `/customers/:id/edit` allow `ADMIN` and `MANAGER` only. An `AGENT` direct navigation redirects to `/customers` using history replacement.

### Customer Portal implemented behavior

Routes are `/portal`, `/portal/tickets`, `/portal/tickets/new`, and `/portal/tickets/:id`. The responsive shell contains Home, My Requests, New Request, Help Center, language switching, customer identity, and logout only. Home shows owned counts/recent requests; the list uses URL-backed server search/status/page state; creation exposes subject, optional active category, and description; details show safe metadata and public conversation. Resolved requests explain reopening and closed requests hide the composer. English, Arabic, RTL, locale dates, and LTR-isolated references are required.

**Ticket Details shares the internal Ticket Details visual language** (`feature/customer-feedback` cycle, pre-integration consistency correction). The Customer Portal keeps its own header/navigation shell, its ownership-safe Portal APIs, and its customer-only data, but the ticket-detail body now composes the same role-neutral presentational components as the internal view (`client/src/features/tickets/ticket-conversation-ui.tsx`: `ConversationSection`, `ConversationMessage`, `MessageBody`):

- **Header/metadata:** back link, then Ticket ID (LTR-isolated, copyable), then the subject `h1` with `break-words [overflow-wrap:anywhere]`, then a badges row, then a wrapping definition list of category / created / updated. Customer-visible fields only. No priority, assignee, SLA target/state, escalation, or history.
- **Status badge:** the same bordered, colour-coded pill shape as the internal `TicketStatusBadge`, keyed by the five customer-facing statuses (`OPEN` blue, `IN_PROGRESS` violet, `WAITING_FOR_YOU` amber, `RESOLVED` green, `CLOSED` grey).
- **Description:** its own bordered white card (`rounded-md border bg-white p-5`) below the header, `whitespace-pre-wrap break-words [overflow-wrap:anywhere]`.
- **Conversation:** one bordered `overflow-hidden` card with a `border-b` header (title + one-line description), a `min-h-48` body holding an `<ol>` timeline or a centered empty state, and the reply composer (or the closed notice) as a `border-t bg-muted/20` footer. Each message is a width-bounded card (`min-w-0 max-w-full sm:max-w-[min(85%,46rem)]`) aligned to the logical **start** for the customer ("You") and the logical **end** for support ("Support Team"); Arabic reverses this naturally via flex `justify-*`. No internal role names, agent emails, internal notes, or internal message metadata are shown. Internal notes never enter the Portal message list (the Portal API never returns them).
- **Long-message handling:** message bodies use `whitespace-pre-wrap break-words [overflow-wrap:anywhere]`; a genuinely long body (over ~800 characters or ~10 lines) is clamped to `line-clamp-[10]` with a localized `Show more` / `Show less` toggle (`aria-expanded`), full text always in the DOM. Same deterministic threshold and control as the internal view. No page-level horizontal scrollbar.
- **Attachments:** the shared `AttachmentPanel` inside a matching bordered card. Compact icon Preview/Download actions, long filenames truncated with the full value in `title`, the desktop Upload action content-sized (`sm:w-auto`) with a secondary Cancel, mobile actions stack. Customer attachment actions stay limited to the approved Preview/Download/Upload set; no Delete or management actions. Upload is blocked (with the localized closed-ticket reason) on a `CLOSED` ticket.
- **Reply composer:** the shared footer structure — label, helper text, `input` textarea, inline `role="alert"` error, and a footer row that is `flex-col` on mobile and `sm:flex-row sm:items-center` on desktop with a content-sized `Send Reply` at the logical end (`sm:ms-auto sm:w-auto`). No Quick Reply selector and no Internal Note mode on the Portal. A `RESOLVED` ticket shows the reopen notice above the field; a `CLOSED` ticket replaces the whole composer with a calm bordered `bg-muted` notice.

Notifications, profile editing, and realtime updates remain deferred. Owned-ticket attachments are integrated into `master` at `8e24d22` — see "Attachments implemented behavior" below. The Portal Knowledge Base (Help Center) is implemented — see "Knowledge Base implemented behavior" below. Customer feedback is implemented on `feature/customer-feedback` (on branch) — see "Customer Feedback implemented behavior" below.

### Customer Feedback implemented behavior

Implemented on `feature/customer-feedback` against the existing `Feedback` model (no schema change).

Surface: a feedback section on the Portal ticket-detail page (`/portal/tickets/:id`), below the conversation and attachments and above the reply composer / closed notice. It is driven by two fields the ticket-detail response now returns — `feedbackEligible` (stored status `RESOLVED` or `CLOSED`) and `feedback` (`{ rating, comment, createdAt }` or `null`).

- **Not eligible, no feedback:** the section renders nothing.
- **Eligible, no feedback:** a form with a required star control (`role="radiogroup"` of five `1`–`5` radio inputs, each with an SR-only "N out of 5" label; the selected count is filled), an optional comment `textarea` (`maxLength` 2,000), and a submit button. Submitting with no rating shows a localized `role="alert"` and does not call the API. A failed submission shows a localized inline error and preserves the draft.
- **Feedback present:** a read-only view — the rating as five stars (`role="img"` with a localized "N out of 5" summary), the comment when present, and a localized "Submitted {date}" line (LTR-isolated). No form, no edit or withdraw control.

On success the ticket query is invalidated and refetched; the section switches to the read-only view — that switch is the only confirmation. One submission per ticket is permanent. English, Arabic, and RTL are supported; strings live under `portal.feedback.*`.

### Knowledge Base implemented behavior

Implemented on `feature/knowledge-base` against the existing `KnowledgeArticle` model (no schema change).

Internal routes: `/knowledge-base` (list), `/knowledge-base/new`, `/knowledge-base/:id` (detail), `/knowledge-base/:id/edit`. The internal shell nav gains a "Knowledge Base" item for `ADMIN`/`MANAGER`/`AGENT` only. A route guard redirects `AGENT` from `/knowledge-base/new` and `/knowledge-base/:id/edit` to `/knowledge-base` with replace navigation; `AGENT` keeps list and detail access.

List page: page header with description; URL-backed search, status filter, and free-text category filter (search and category debounced); a `Create article` action for `ADMIN`/`MANAGER` only; a desktop/tablet TanStack Table with `Title` (largest share, two-line clamp, `title` attribute for the full value), `Category`, `Status`, `Updated`, `Author` columns inside a horizontally scrollable bordered wrapper; existing-style mobile cards from the same query; server-side pagination; and distinct loading, API-failure-with-retry, empty-Knowledge-Base, and no-results states. Status is shown as a text badge, never colour alone.

Detail page: back link, title, status badge, category, localized updated date (LTR-isolated), safe `{ id, name, role }` author summary, and the full article content rendered as plain text with preserved paragraphs (`whitespace-pre-wrap`, `break-words`) — no `dangerouslySetInnerHTML`, no Markdown/rich-text dependency, no page-level horizontal overflow. `ADMIN`/`MANAGER` see `Edit` and `Delete`; `AGENT` sees neither and no mutation control. Delete uses an inline accessible confirmation region (`role="alertdialog"`) with explicit Confirm/Cancel, keyboard operable, duplicate-request-safe, with localized pending and failure states; success invalidates internal list/detail and Portal article queries and navigates to `/knowledge-base`; failure preserves the article and shows a localized error.

Editor (`/knowledge-base/new`, `/knowledge-base/:id/edit`, `ADMIN`/`MANAGER` only): React Hook Form + Zod, localized labels and validation, visible required indicators on Title and Content, a plain accessible `textarea` for content, a Draft/Published `select`, initial loading state for edit, a disabled pending Save that blocks duplicate submits, API validation and failure display, cancel/back navigation. A successful create navigates to the new article; a successful update returns to article detail (which refetches). No rich-text editor.

Customer Portal: `/portal/knowledge-base` (Help Center) and `/portal/knowledge-base/:id`, with a "Help Center" nav item in the Portal shell. The list shows published article cards (title, optional category chip, server-derived excerpt, updated date) under a neutral "Help articles" heading — no "Popular" label, because the schema has no popularity/view data (documented limitation). It has search, an optional category filter, server-side pagination when the result set exceeds one page, and loading/error-retry/empty/no-results states. The detail view shows title, category, updated date, and plain-text content. The Portal never renders Draft/Published status, author identity, or Create/Edit/Delete controls; a `DRAFT` or missing article id yields the same localized not-found state.

Localization/responsive: full English and Arabic strings under `knowledgeBase.*` and `portal.knowledgeBase.*`; RTL mirrors through document direction; dates are locale-aware and LTR-isolated; long titles, categories, authors, and unbroken content are contained without page overflow; desktop/tablet use the internal table, mobile uses readable cards. Known limitations: no popularity/view tracking, no article versioning, no rich-text editing, no related-article recommendations.

The customer audience route guard provides authorization and redirect behavior only; `PortalShell` is the single owner of Portal identity, navigation, language, account, and logout chrome. Portal navigation uses explicit route matching so request details activate My Requests while creation activates New Request exclusively. Portal forms and filters use the approved visible shared control treatment, bounded content regions, intrinsic desktop actions, and full-width mobile actions.

### Attachments implemented behavior (`feature/attachments`, integrated into `master` at `8e24d22`)

Implemented on `feature/attachments` (integrated into `master` at `8e24d22`) against the existing `Attachment` model (no schema change). Bytes are stored in a private Vercel Blob store; the UI never sees a storage key or provider URL. Shared components live in `client/src/features/attachments/attachment-ui.tsx` (`AttachmentPanel`, `AttachmentRows`, `AttachmentUploadForm`, `MessageAttachmentList`).

- **Ticket Details** (`/tickets/:id`): an Attachments panel in the left column lists ticket-level attachments (filename with `dir="auto"` isolation and `truncate`, MIME type, locale date, and a per-row Download action). Upload (a keyboard-accessible `<input type="file">`, visible accepted types and `4 MiB` limit, selected filename + size, Upload/Cancel, indeterminate pending state with no fake percentage, duplicate-submit lock, localized validation and API errors, Retry after failure) is shown to `ADMIN`/`MANAGER` and to the assigned `AGENT`. An unassigned `AGENT` sees a localized read-only explanation instead of the control but keeps list/download. Message-level attachments render as downloadable chips immediately beneath their public conversation message (never on internal notes), grouped from the single ticket-wide attachments query — no attachment appears in both the panel and the conversation. The rich Ticket Detail cache is not replaced by an attachment response.
- **Customer Details** (`/customers/:id`, Attachments tab): lists customer-profile attachments from a focused query with list/download for every internal read role; the upload control appears for `ADMIN`/`MANAGER` only and is absent for `AGENT`. Attachment mutations are not exposed through the customer create/edit forms.
- **Customer Portal Ticket Details** (`/portal/tickets/:id`): an Attachments section lists owned-ticket attachments with download, and the same upload control while the request is not `CLOSED`; a `CLOSED` request shows a localized restriction message and no control. Message attachments render as chips under their message. The Portal never renders storage keys, internal ticket/customer ids, staff identity, notes, history, or SLA. Uploading a file does not add a reply or reopen the request.
- **Create forms:** the "Attachments" section shown in the `/tickets/new` and `/portal/tickets/new` layouts (§6, §19) remains a documented-future placeholder — upload requires a persisted ticket and is out of scope for this branch.
- **Action UX:** each attachment row/card (and each message-attachment) shows a compact icon action group — **Preview** (eye) and **Download** (arrow-into-tray) — using small inline decorative SVGs (`aria-hidden`, no icon dependency). Both buttons carry a localized `aria-label` and `title`, a ~40px touch target, hover and keyboard-focus styling, a disabled state with an inline spinner while pending, and duplicate-request prevention; the visible "Download attachment" text is removed from the normal state. **Download** unchanged: the authenticated API client fetches the Blob, a temporary object URL is created, the download is triggered with the server-provided safe filename, and the URL is revoked. **Preview** requests the file through the same authenticated download API (internal or Portal), receives a browser Blob, and opens an accessible modal that renders an image (`object-contain`, bounded, `alt` = safe filename), the browser's built-in PDF viewer inside an `iframe` on the temporary Blob URL with a localized "download to view" fallback note, or plain text decoded and shown escaped inside a scrollable `<pre>` (never HTML, no `dangerouslySetInnerHTML`). Unsupported or failed previews show a localized "Preview unavailable" / "Preview failed" + Retry state without closing the dialog; Download stays available inside it. The dialog has `role="dialog"` + `aria-modal`, an accessible title, focus moves in on open and returns to the Preview button on close, Escape and the localized close button dismiss it, and Tab is trapped. The temporary object URL is revoked when the dialog closes, the previewed file changes, or the component unmounts. No provider URL, storage key, or token is exposed; nothing enters persistent state or the query cache; selecting Preview never downloads the file. Reusable pieces: `AttachmentActions`, `AttachmentPreviewDialog`, `useAttachmentPreview`, and the `PreviewIcon`/`DownloadIcon`/`CloseIcon`/`SpinnerIcon` SVGs, shared across Ticket, message, Customer, and Portal views.
- **Localization / responsive:** full English and Arabic strings under `attachments.*` (key parity enforced; includes `previewAttachment`, `closePreview`, `previewLoading`, `previewUnavailable`, `previewFailed`, `retryPreview`, `pdfPreviewUnavailable`, `downloadAttachment`), RTL through document direction (SVG artwork is direction-neutral and not mirrored), LTR isolation for filenames and MIME types, contained long Arabic/English filenames, and a compact layout (icon actions + preview dialog) that stays within the viewport on mobile with content scrolling inside the dialog. Known limitations: **no thumbnails** and no image transformations; the in-browser Preview uses a temporary authenticated Blob URL and does **not** make the underlying Blob public and is **not** malware scanning; no malware scanning (signature/allowlist validation only); no attachment deletion; no multi-file or resumable upload; the database cannot report an uploader or file size.
