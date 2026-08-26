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

Each public message should show:

- author name
- author role when needed
- timestamp
- message body
- attachments

Internal notes should be visually different.

Recommended distinction:

```text
Customer / public replies:
neutral conversation surface

Internal note:
subtle tinted internal-only surface
clear "Internal note" label
```

Do not use casual social-media chat bubble styling excessively.

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

---

# 15. Users Management

## Route

```text
/users
```

## Roles

ADMIN.

MANAGER access only if explicitly granted.

## Goal

Manage internal CRM users and roles.

## Table

Recommended:

```text
Name
Email
Role
Status
Created
```

Actions:

```text
Create User
Edit User
Change Role
```

Avoid implementing unnecessary enterprise identity features.

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

---

# 23. Quick Replies

## Placement

Ticket reply composer.

## UX

Control:

```text
Quick Reply ▼
```

Selecting a quick reply inserts editable content into the composer.

It must not automatically send.

Management may live in:

```text
/settings
```

or another documented admin section.

---

# 23b. Underdefined Original Requirements — Planning Only

The following original-assignment areas have no implementation and no complete specification. They are recorded here so they are not forgotten. Do not invent final schemas, endpoints, permissions, or screen layouts for them during unrelated work. Existing frontend design rules, English/Arabic behavior, RTL, responsive behavior, and role navigation rules still apply once each is specified.

## Tasks (Agent Dashboard)

Status: product decision required before implementation. Branch: `feature/tasks-reminders`.

Required decision points:
- data model and storage
- ownership (creator vs assignee) and whether a task can be assigned to another user
- optional linkage to a ticket and/or a customer
- due date and completion model
- role visibility (own only, team, manager oversight)
- relationship to Notifications
- placement: Dashboard section, ticket workspace panel, or dedicated route

## Reminders (Agent Dashboard)

Status: product decision required before implementation. Branch: `feature/tasks-reminders`.

Required decision points:
- whether a reminder is a lightweight variant of a Task or a separate model
- time trigger and how it surfaces without background workers on serverless
- snooze / dismiss behavior
- ticket/customer linkage
- relationship to Notifications and to SLA alerts

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

Include enough data for reports when feedback is implemented.

The UI should not look empty during assessment/demo.

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

Routes are `/portal`, `/portal/tickets`, `/portal/tickets/new`, and `/portal/tickets/:id`. The responsive shell contains Home, My Requests, New Request, language switching, customer identity, and logout only. Home shows owned counts/recent requests; the list uses URL-backed server search/status/page state; creation exposes subject, optional active category, and description; details show safe metadata and public conversation. Resolved requests explain reopening and closed requests hide the composer. English, Arabic, RTL, locale dates, and LTR-isolated references are required.

Attachments, feedback, notifications, profile editing, and realtime updates remain deferred. The Portal Knowledge Base (Help Center) is implemented — see "Knowledge Base implemented behavior" below.

### Knowledge Base implemented behavior

Implemented on `feature/knowledge-base` against the existing `KnowledgeArticle` model (no schema change).

Internal routes: `/knowledge-base` (list), `/knowledge-base/new`, `/knowledge-base/:id` (detail), `/knowledge-base/:id/edit`. The internal shell nav gains a "Knowledge Base" item for `ADMIN`/`MANAGER`/`AGENT` only. A route guard redirects `AGENT` from `/knowledge-base/new` and `/knowledge-base/:id/edit` to `/knowledge-base` with replace navigation; `AGENT` keeps list and detail access.

List page: page header with description; URL-backed search, status filter, and free-text category filter (search and category debounced); a `Create article` action for `ADMIN`/`MANAGER` only; a desktop/tablet TanStack Table with `Title` (largest share, two-line clamp, `title` attribute for the full value), `Category`, `Status`, `Updated`, `Author` columns inside a horizontally scrollable bordered wrapper; existing-style mobile cards from the same query; server-side pagination; and distinct loading, API-failure-with-retry, empty-Knowledge-Base, and no-results states. Status is shown as a text badge, never colour alone.

Detail page: back link, title, status badge, category, localized updated date (LTR-isolated), safe `{ id, name, role }` author summary, and the full article content rendered as plain text with preserved paragraphs (`whitespace-pre-wrap`, `break-words`) — no `dangerouslySetInnerHTML`, no Markdown/rich-text dependency, no page-level horizontal overflow. `ADMIN`/`MANAGER` see `Edit` and `Delete`; `AGENT` sees neither and no mutation control. Delete uses an inline accessible confirmation region (`role="alertdialog"`) with explicit Confirm/Cancel, keyboard operable, duplicate-request-safe, with localized pending and failure states; success invalidates internal list/detail and Portal article queries and navigates to `/knowledge-base`; failure preserves the article and shows a localized error.

Editor (`/knowledge-base/new`, `/knowledge-base/:id/edit`, `ADMIN`/`MANAGER` only): React Hook Form + Zod, localized labels and validation, visible required indicators on Title and Content, a plain accessible `textarea` for content, a Draft/Published `select`, initial loading state for edit, a disabled pending Save that blocks duplicate submits, API validation and failure display, cancel/back navigation. A successful create navigates to the new article; a successful update returns to article detail (which refetches). No rich-text editor.

Customer Portal: `/portal/knowledge-base` (Help Center) and `/portal/knowledge-base/:id`, with a "Help Center" nav item in the Portal shell. The list shows published article cards (title, optional category chip, server-derived excerpt, updated date) under a neutral "Help articles" heading — no "Popular" label, because the schema has no popularity/view data (documented limitation). It has search, an optional category filter, server-side pagination when the result set exceeds one page, and loading/error-retry/empty/no-results states. The detail view shows title, category, updated date, and plain-text content. The Portal never renders Draft/Published status, author identity, or Create/Edit/Delete controls; a `DRAFT` or missing article id yields the same localized not-found state.

Localization/responsive: full English and Arabic strings under `knowledgeBase.*` and `portal.knowledgeBase.*`; RTL mirrors through document direction; dates are locale-aware and LTR-isolated; long titles, categories, authors, and unbroken content are contained without page overflow; desktop/tablet use the internal table, mobile uses readable cards. Known limitations: no popularity/view tracking, no article versioning, no rich-text editing, no related-article recommendations.

The customer audience route guard provides authorization and redirect behavior only; `PortalShell` is the single owner of Portal identity, navigation, language, account, and logout chrome. Portal navigation uses explicit route matching so request details activate My Requests while creation activates New Request exclusively. Portal forms and filters use the approved visible shared control treatment, bounded content regions, intrinsic desktop actions, and full-width mobile actions.
