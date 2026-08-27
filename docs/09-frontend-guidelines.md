# Frontend Guidelines

## 1. Purpose

These guidelines define both the frontend engineering rules and the visual/UX direction for the Customer Support CRM.

The goal is to prevent inconsistent UI decisions during implementation and to ensure that every feature feels like part of the same product.

The interface should feel like a modern support workspace built for people who may use it for many hours per day.

Primary design references:

- Intercom: ticket workspace, conversations, customer context
- Zendesk: ticket queues, operational workflows, SLA visibility
- Freshdesk: dashboard and reporting information architecture
- HubSpot Service Hub: customer profile and CRM record organization

These products are references for interaction patterns and information hierarchy only. Do not copy branding, proprietary assets, or layouts pixel-for-pixel.

---

## 2. Core Frontend Principles

- Feature-oriented structure
- TanStack Query for server state
- React Hook Form + Zod for forms
- Reusable UI primitives from shadcn/ui
- Accessible interactions
- Responsive from the start
- Explicit loading, empty, success, and error states
- Prefer clarity over visual decoration
- Prefer information density where agents need it
- Keep customer-facing screens simpler than internal agent screens
- Avoid speculative abstractions and unnecessary component systems
- Preserve consistent patterns across features

---

## 3. Product Design Direction

The product should look like a serious support application, not a marketing landing page or portfolio dashboard.

### Desired qualities

- clean
- neutral
- compact but readable
- professional
- calm
- information-rich
- fast to scan
- consistent
- accessible

### Avoid

Do not introduce these styles unless explicitly approved:

- heavy gradients
- glassmorphism
- oversized shadows
- decorative 3D graphics
- neon colors
- excessive animation
- overly rounded cards everywhere
- large empty hero sections inside the application
- dashboard cards with unrelated colors
- excessive use of badges
- UI patterns that sacrifice information density for decoration

Use motion only when it improves orientation or feedback.

---

## 4. Visual System

### Base Theme

The default application theme is light.

Dark mode may be added later but must not delay core functionality.

Suggested neutral palette:

```text
Background       #FAFAFA
Surface          #FFFFFF
Surface Muted    #F8F9FA
Border           #E5E7EB
Border Strong    #D1D5DB

Text Primary     #111827
Text Secondary   #4B5563
Text Muted       #6B7280
```

Use one primary brand color for:

- primary actions
- selected navigation
- links
- focus accents
- active controls

Blue or indigo is preferred unless project branding defines another color.

### Semantic Colors

Status and feedback colors should have consistent meaning.

Suggested mapping:

```text
NEW                 neutral / gray
OPEN                blue
IN_PROGRESS         violet
WAITING_CUSTOMER    amber
RESOLVED            green
CLOSED              neutral dark
ESCALATED           red

LOW                 neutral
MEDIUM              blue
HIGH                amber
URGENT              red
```

Do not rely on color alone. Always pair color with text, icon, or another semantic indicator.

---

## 5. Typography

Use a clean sans-serif UI font supported by the project environment.

Typography hierarchy should remain restrained.

Suggested scale:

```text
Page title          24-28px / semibold
Section title       18-20px / semibold
Card title          14-16px / medium-semibold
Body                14px
Secondary text      12-13px
Table text          13-14px
```

Avoid very large typography inside authenticated application screens.

Text should remain readable at default browser zoom and on mobile.

---

## 6. Spacing and Shape

Use a consistent spacing scale.

Preferred spacing increments:

```text
4
8
12
16
20
24
32
```

Recommended defaults:

```text
Page horizontal padding     24px desktop
Card padding                16-20px
Section gap                 24px
Form field gap              16px
Compact list row            8-12px vertical
```

### Radius

Prefer moderate rounding:

```text
Inputs / buttons     6-8px
Cards / panels       8-10px
Dialogs              10-12px
```

Avoid turning every container into a highly rounded floating card.

### Shadows

Use borders first.

Shadows should be subtle and reserved for:

- dialogs
- popovers
- dropdowns
- elevated overlays

Regular content panels should generally use borders instead of prominent shadows.

---

## 7. Application Shell

The internal CRM application uses a consistent shell.

Desktop:

```text
┌──────────────┬──────────────────────────────────────┐
│ Sidebar      │ Header / Breadcrumb / Actions       │
│              ├──────────────────────────────────────┤
│ Navigation   │                                      │
│              │ Page Content                         │
│              │                                      │
└──────────────┴──────────────────────────────────────┘
```

### Sidebar

Recommended navigation:

```text
Dashboard
Tickets
Customers
Knowledge Base
Reports
Users
Settings
```

Requirements:

- active route is visually obvious
- icons use Lucide
- labels remain visible on normal desktop widths
- navigation should not use excessive visual decoration
- mobile converts sidebar to a drawer

### Header

May contain:

- breadcrumb or page context
- search where relevant
- notifications
- language switcher
- user menu

Do not fill the header with unrelated controls.

---

## 8. Dashboard Design

The dashboard is operational, not decorative.

Its purpose is to answer:

1. What needs attention now?
2. What is the current ticket load?
3. Are SLA targets at risk?
4. How is the support team performing?

### Recommended layout

```text
Page Header
"Support Dashboard"

KPI Row
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│ Open      │ │ Assigned  │ │ SLA Risk  │ │ Resolved  │
└───────────┘ └───────────┘ └───────────┘ └───────────┘

Charts / Operational Summary

Needs Attention
Recent Tickets
```

### KPI rules

Use a small number of meaningful KPIs.

Preferred:

- Open Tickets
- Assigned to Me
- SLA At Risk / Breached
- Resolved Today
- Average Response Time when available

Avoid creating many cards simply to fill space.

### Charts

Charts should answer a clear question.

Preferred:

- tickets by status
- tickets by priority
- created vs resolved
- SLA compliance
- agent performance

Use Recharts.

Avoid 3D charts, decorative charts, or charts without actionable meaning.

---

## 9. Ticket List Design

Desktop ticket browsing should primarily use a table or dense list, not a grid of large cards.

Example:

```text
Tickets

[Search tickets...]   Status ▼   Priority ▼   Assignee ▼

ID      Subject               Customer        Priority     Status
#1042   Cannot login          Ahmed           High         Open
#1041   Payment failed        Sara            Urgent       In Progress
#1040   Reset password        Ali             Low          Waiting
```

Recommended columns:

- ticket ID
- subject
- customer
- channel
- priority
- status
- assignee
- SLA indicator
- updated time

### List behavior

- rows should be easy to scan
- filters remain visible
- selected filters are obvious
- loading uses table/list skeletons
- empty results explain what happened
- mobile may convert rows into compact stacked cards

Do not use large card grids for normal ticket queues.

---

## 10. Ticket Workspace

This is the most important internal screen.

Design inspiration: Intercom-style support workspace.

Desktop should favor a multi-panel layout:

```text
┌───────────────────┬─────────────────────────┬──────────────────────┐
│ Ticket Queue      │ Conversation            │ Customer Context     │
│ / Navigation      │                         │                      │
│                   │ Ticket header           │ Customer info        │
│ Search            │ Status / Priority       │ Contact details      │
│ Filters           │                         │ Recent tickets       │
│                   │ Messages                │ SLA                  │
│ Ticket list       │                         │ Assignee             │
│                   │                         │ Category             │
│                   │ Reply composer          │ Metadata             │
└───────────────────┴─────────────────────────┴──────────────────────┘
```

Depending on route and available width, the first queue panel may be omitted if the user navigated from the standalone tickets page.

### Conversation

Customer and agent messages should be visually distinguishable without resembling a casual social messaging app.

The message stream should clearly show:

- author
- role when useful
- timestamp
- attachments
- public vs internal content

### Composer

The composer must support two clearly distinct modes:

```text
Reply
Internal Note
```

Internal notes must never look identical to customer-visible replies.

### Right Context Panel

Recommended sections:

- customer profile
- email
- phone
- recent tickets
- current assignee
- category
- priority
- SLA
- ticket metadata

Keep the most operationally useful information visible without opening additional dialogs.

---

## 11. Customer Management Design

Customer pages should follow CRM record patterns rather than ticket workspace patterns.

### Customer List

Use a table or dense list with:

- name
- email
- phone
- open tickets
- total tickets
- last interaction

### Customer Details

Recommended structure:

```text
Customer Header
Name
Contact details
Primary actions

Tabs:
Overview
Tickets
Activity
Notes
Attachments
```

The overview should summarize the customer without duplicating every detail from the tabs.

---

## 12. Customer Portal Design

The customer portal has a different UX goal from the internal CRM.

Agents need dense information.

Customers need clarity and simplicity.

Recommended portal navigation:

```text
Home
My Requests
Knowledge Base
```

Portal home may include:

- support search
- new request action
- open request count
- requests waiting for customer
- recent requests
- popular help articles

Avoid exposing internal CRM concepts such as:

- agent performance
- internal notes
- internal SLA implementation
- staff-only metadata
- admin navigation

Ticket status may be shown using customer-friendly language when needed.

---

## 13. Forms

Use:

- React Hook Form
- Zod
- shadcn/ui form controls

### Rules

- labels should remain visible
- placeholders do not replace labels
- validation messages appear near the relevant field
- required fields are clear
- submit state shows progress
- prevent duplicate submissions
- API validation errors must be surfaced clearly
- preserve user input after recoverable errors when possible

For long forms, group related fields into logical sections rather than one large undifferentiated form.

---

## 14. Tables and Data Density

Internal CRM screens should favor efficient scanning.

Tables should:

- have readable headers
- have stable row heights
- use compact spacing
- support loading skeletons
- support empty states
- show actions consistently
- avoid horizontal overflow where possible

TanStack Table is the standard table-model library for implemented data tables. TanStack Query remains responsible for server data, while URL parameters remain the source of shareable search and pagination state. Server-backed tables use TanStack Table's manual modes and the API response metadata rather than fetching all records for client-side pagination or sorting. Keep typed column definitions feature-local unless multiple implemented tables demonstrate a genuinely shared pattern. A responsive mobile card view may render the same query data without creating a second fetching path.

Do not hide essential information behind hover-only interactions.

Actions such as Edit/Delete may use an overflow menu when appropriate.

Destructive actions require confirmation.

---

## 15. Search and Filtering

Search and filters should be treated as first-class product features.

Ticket filters may include:

- status
- priority
- assignee
- category
- channel

Customer filters should remain minimal unless required.

Guidelines:

- debounce text search where appropriate
- filters should map to URL search params when practical
- refresh should preserve important filters
- provide clear/reset filters action
- empty filtered states must distinguish "no data" from "no matching results"

---

## 16. Feedback States

Every data-driven screen needs explicit states.

### Loading

Prefer:

- skeletons for structured content
- spinner only for small localized actions

Avoid blocking the entire application for a single request.

### Empty

Explain:

- what is empty
- why it may be empty
- the primary next action

Example:

```text
No tickets yet
Create the first support request to get started.
[Create ticket]
```

### Error

Provide:

- understandable message
- retry when useful
- enough context to recover

Do not expose raw API errors or stack traces.

### Success

Use:

- toast for lightweight confirmation
- visible state update for important operations

Do not show a toast for every minor interaction.

---

## 17. Buttons and Actions

Use a clear hierarchy.

### Primary

One dominant action per local context where practical.

Examples:

- Create Ticket
- Send Reply
- Save Changes

### Secondary

For supporting actions.

### Destructive

Use destructive styling only for actions such as:

- delete
- irreversible close where applicable
- destructive administrative actions

Avoid multiple equally prominent primary buttons in one section.

---

## 18. Icons

Use Lucide Icons consistently.

Rules:

- do not mix multiple icon libraries without approval
- icons supplement labels, not replace critical labels
- use familiar metaphors
- keep icon size consistent within the same context

---

## 19. Accessibility

Minimum requirements:

- semantic HTML
- keyboard-accessible interactive elements
- visible focus indicators
- proper labels
- sufficient color contrast
- accessible dialogs
- accessible dropdowns
- accessible form errors
- ARIA only where native semantics are insufficient

Ticket status and priority must not depend on color alone.

---

## 19A. Form Controls and Shared Dropdowns (AppSelect)

The CRM uses a shared, branded dropdown system built on `@radix-ui/react-select`:

- `AppSelect`: strongly typed standalone single-choice select primitive for filters and controlled standalone selects.
- `AppSelectField`: composite field pairing `AppSelect` with standard form labels, required asterisks, helper text, and validation error messages linked via `aria-describedby` and `aria-invalid`.

### Design & Behavior Standards
- **Single Branded Shell**: Closed trigger and opened options menu match CRM design tokens (neutral borders, surface styling, focus rings, and subtle elevation).
- **Single Rotating Chevron**: The trigger displays exactly one chevron icon that smoothly rotates 180° when open.
- **RTL & Alignment**: Chevron is placed at the logical end (`justify-between`), preserving orientation in English and Arabic.
- **Check Indicator**: Active/selected options display a checkmark indicator.
- **Portalled Floating Menu**: Dropdown menus render in a portal with Popper positioning so container overflow/clipping is never an issue.
- **Empty Sentinel**: Empty string `""` values (e.g. "All statuses", "Unassigned") map cleanly to safe internal sentinels and back.
- **Keyboard & Accessibility**: Full ARIA `combobox` / `listbox` compliance, arrow navigation, Enter/Space selection, and Escape key return of focus.
- **React Hook Form Support**: Seamless integration with `Controller` or custom form state.

All simple single-choice dropdowns across User Management, Tickets, Portal, and Knowledge Base use `AppSelect`. Searchable comboboxes (such as `CustomerCombobox`) remain specialized combobox components.

---

## 20. Responsive Rules

Responsive web is required.

No separate mobile application is planned.

### Desktop

Primary internal workflows may use:

- sidebar
- tables
- multi-panel ticket workspace
- side context panels

### Tablet

- reduce nonessential columns
- collapsible side panels
- preserve primary actions
- avoid tiny touch targets

### Mobile

- desktop sidebar becomes a drawer
- wide tables become compact card/list representations or controlled horizontal views
- ticket workspace becomes single-column
- customer context becomes a drawer, sheet, accordion, or separate section
- conversation remains the dominant ticket content
- forms use full available width
- dialogs must fit viewport
- dashboard cards stack responsively

Minimum touch target should generally be around 40-44px for primary interactive controls.

Do not simply shrink desktop UI until it fits.

---

## 21. Internationalization and RTL

Prepare:

```text
locales/en
locales/ar
```

Use i18next.

Arabic mode must support RTL.

English is the default and fallback language. The shared language switcher persists
the selected `en` or `ar` value under `crm-language` in local storage. Application
startup and every language change synchronize the root HTML `lang` and `dir`
attributes; Arabic uses `rtl`, while English uses `ltr`.

Requirements:

- logical CSS properties where possible
- icons that imply direction may need mirroring
- layout should not depend on hard-coded left/right assumptions
- tables and numbers must remain readable
- ticket IDs, emails, URLs, and code-like values should preserve sensible direction

Do not postpone architecture-level RTL support until the end.

---

## 22. Main Routes

```text
/login
/dashboard
/customers
/customers/:id
/tickets
/tickets/new
/tickets/:id
/knowledge-base
/reports
/users
/settings

/portal
/portal/tickets
/portal/tickets/new
/portal/tickets/:id
/portal/knowledge-base
```

Routes may be extended only when required by documented features.

---

## 23. State Management

TanStack Query owns API/server state.

Do not duplicate API/server state in Redux, Zustand, Context, or other stores.

Global client state may be used only for genuine cross-feature UI/session concerns such as:

- authenticated session metadata when appropriate
- language
- theme
- persistent UI preferences

Prefer local component state for local interactions.

---

## 24. Component Rules

Before creating a new reusable component, check:

1. Does shadcn/ui already provide the primitive?
2. Does the project already have a suitable component?
3. Is the pattern used in more than one place?
4. Would abstraction make the calling code clearer?

Avoid premature components such as:

```text
UniversalCard
GenericContainer
SuperTable
BaseEverything
```

Prefer domain-oriented components such as:

```text
TicketStatusBadge
TicketPriorityBadge
TicketList
TicketConversation
CustomerSummary
SlaIndicator
```

---

## 25. Animation

Animation is optional.

Use only for:

- drawer/dialog transitions
- feedback
- small state transitions
- preserving spatial understanding

Avoid:

- animated dashboard entrances for every card
- excessive Framer Motion usage
- bouncing controls
- decorative looping animation

Functionality and responsiveness have higher priority.

---

## 26. AI Feature UX

AI is an assistant, not an autonomous actor.

Recommended ticket workspace actions:

```text
Summarize
Suggest Reply
Suggest Category
Suggest Article
```

Rules:

- suggested reply must be editable before sending
- AI must not automatically send customer messages
- AI category suggestions should require confirmation
- show loading and failure states
- CRM remains fully usable if AI is unavailable

AI features should appear inside the relevant workflow rather than in a disconnected "AI dashboard."

---

## 27. Design Consistency Checklist

Before considering a frontend feature complete, verify:

- follows this design direction
- uses existing layout patterns
- uses the approved spacing scale
- uses semantic status colors consistently
- does not introduce an unnecessary new visual style
- handles desktop and mobile
- handles loading
- handles empty state
- handles errors
- includes accessible labels and focus behavior
- preserves RTL compatibility
- avoids unrelated UI refactors

---

## 28. AI Implementation Rule

The AI must not redesign screens independently from these guidelines.

When a design decision is not specified:

1. reuse an existing project pattern
2. prefer the simplest conventional CRM pattern
3. follow the referenced design direction
4. avoid introducing a new component library or visual language
5. document any meaningful new UX decision before applying it broadly

The AI must not replace shadcn/ui, Tailwind CSS, TanStack Query, React Hook Form, Zod, or the established application architecture without explicit developer approval.

If a generated screen conflicts with these guidelines, these guidelines take precedence.
