# Implementation Plan

The three-day plan below is the **historical** plan for the original time-boxed assessment. It is retained as written. Its Day 1–3 items describe the P0 support loop, which is implemented and integrated into `master`. It does not claim that Knowledge Base, Reports, AI, or other non-P0 areas were completed during those three days — several Day 2/Day 3 items ("Knowledge Base", "Reports", "AI", "seed data") were not reached and are carried into the post-P0 roadmap below.

The current dependency-aware roadmap from the integrated state through final demo and deployment is in section "Post-P0 Completion Roadmap" at the end of this document and is mirrored in `docs/19-progress-tracking.md`.

---

# Three-Day Implementation Plan (historical)

## Day 1: Foundation and Core CRM

### Foundation
- repository setup
- frontend setup
- backend setup
- PostgreSQL + Prisma
- linting and environment setup

### Core Models
- User
- Customer
- Ticket
- TicketMessage
- TicketNote
- Category

### Authentication
- register/login
- JWT
- protected routes
- role middleware

### Frontend Shell
- login
- application layout
- sidebar/header
- protected routing

### Customers
- list
- create
- edit
- details

### Tickets
- list
- create
- details
- update
- assign agent
- priority/category/status

### Day 1 Exit Condition
A logged-in internal user can create/find a customer, create a ticket, assign it, and update it.

---

## Day 2: Support Experience

### Ticket Detail
- conversation
- public replies
- internal notes
- history
- attachments if feasible

### Agent Dashboard
- assigned tickets
- status/priority summaries
- recent tickets

### Customer Portal
- login/session
- my tickets
- create ticket
- ticket details
- reply

### SLA
- deadlines
- SLA state
- breach indicator

### Knowledge Base
- article CRUD
- list/search
- customer read view

### Notifications
- basic in-app notifications if time allows

### Day 2 Exit Condition
The customer-agent support loop works end to end.

---

## Day 3: Reporting, AI, Polish, Delivery

### Dashboard and Reports
- KPI cards
- tickets by status
- tickets by priority
- SLA summary
- agent performance basics

### AI
In order:
1. ticket summary
2. suggested reply
3. automatic categorization
4. suggested knowledge article

### Internationalization
- English/Arabic structure
- language switcher
- RTL support

### Responsive Polish
- dashboard
- tickets
- ticket detail
- portal

### Testing
- critical unit tests
- critical backend authorization tests where practical

### Delivery
- seed data
- demo accounts
- README
- API docs if feasible
- final production build check
- deployment

## Rule

When time is short:
P0 completion wins over starting another P2/P3 feature.

---

# Post-P0 Completion Roadmap

Starting state: `master` at `e387667` — P0 support loop integrated (customers, tickets, conversation, history, dashboard, portal, basic SLA presentation). One isolated branch per feature (ADR-019). Order changes only on demonstrated repository dependency.

| Order | Branch | Feature | Key dependency |
| ----: | ------ | ------- | -------------- |
| 1 | `feature/knowledge-base` | Internal KB CRUD/search + published customer read + Portal FAQs | none (unblocks AI KB-solution and Reports content) |
| 2 | `feature/attachments` | Secure upload/download with per-context ownership | storage-provider decisions (see roadmap scope in `docs/19-progress-tracking.md`) |
| 3 | `feature/quick-replies` | Quick Reply management + composer insertion (never auto-send) | none |
| 4 | `feature/customer-feedback` | Portal feedback workflow, eligibility, one record per ticket | resolved/closed ticket states (present) |
| 5 | `feature/reports` | Ticket, SLA, agent, satisfaction reports from real data | feedback (#4) for satisfaction; KB optional |
| 6 | `feature/user-management` | ADMIN-managed internal users and roles | none |
| 7 | `feature/settings` | Real config pages for categories, SLA rules, quick replies, bounded branding | quick replies (#3); branding (#13) optional |
| 8 | `feature/notifications` | In-app notifications, read/unread workflow | ticket/assignment events (present) |
| 9 | `feature/sla-automation` | Bounded monitoring, assignment/escalation rules, alerts | notifications (#8) for alerts; serverless scheduling decision |
| 10 | `feature/tasks-reminders` | Agent Tasks and Reminders | product decisions (data model, ownership, linkage) |
| 11 | `feature/team-collaboration` | Explicit collaboration beyond notes/history | product decision (mentions / watchers / handoff / shared comments / tasks) |
| 12 | `feature/ai-assistant` | Summary → suggested reply → categorization suggestion → suggested KB solution | KB (#1) for suggested solution; no AI output mutates a ticket or sends a message without human approval |
| 13 | `feature/custom-branding` | Persisted bounded CRM/Portal branding | settings (#7) persistence surface; product decisions |
| 14 | `feature/demo-seed-data` | Final realistic dataset covering implemented features | every feature whose schema/data the demo shows |
| 15 | `test/core-flows` | Final integrated QA, accessibility, responsive, English/Arabic, RTL | all features |
| 16 | deployment branch (project convention) | Deployment preparation and verification | final QA |

Chatbot (full AI conversational agent) and provider-backed external integrations (inbound email, WhatsApp, SMS, production live chat, ERP) remain architecture/demo-only and are not in this sequence unless explicitly promoted.

`feature/demo-seed-data` is sequenced at #14, not first. A minimal temporary developer fixture may be added by an earlier feature when needed for its own testing; that is not the final comprehensive demo dataset.
