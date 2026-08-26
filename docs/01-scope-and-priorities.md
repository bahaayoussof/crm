# Scope and Priorities

## Historical constraint (three-day assessment)

One developer, approximately three implementation days.

The system should look and behave like a coherent CRM, but external integrations that normally require provider accounts, webhooks, infrastructure, security review, or production configuration must not consume the core delivery window.

This three-day assessment window is a historical constraint. The P0/P1/P2/P3 lists below were written against it and are retained unchanged as the original priority assessment. Priority and implementation state are separate facts; see `docs/19-progress-tracking.md` for the current coverage matrix.

## Current target (post-P0)

The P0 support loop is implemented and integrated into `master`. The delivery target is now **broader original-assignment coverage before the final demo** (ADR-019). Work continues one isolated feature branch at a time in the order recorded in `docs/19-progress-tracking.md`, starting with `feature/knowledge-base`.

Scope is now grouped as:

### A. Original time-boxed P0 (implemented)

Authentication, RBAC, customer CRUD/search, ticket CRUD/assignment/priority/category/workflow, ticket conversation and internal notes, ticket history, agent dashboard, customer portal core journey, basic SLA presentation, responsive UI, English/Arabic and RTL. These are `COMPLETE` in the coverage matrix (verification gaps recorded separately).

### B. Broader task coverage now required for the final demo

Mandatory before the final demo seed and QA:

- Knowledge Base (internal CRUD/search, published customer read, Portal FAQs)
- Attachments (secure upload/download with ownership)
- Quick Replies (composer insertion)
- Customer Feedback (Portal workflow, one record per eligible ticket)
- Reports (ticket, SLA, agent, satisfaction — real persisted data only)
- Users Management (ADMIN-managed internal users and roles)
- Settings (configuration backed by real persistence only)
- Notifications (in-app read/unread)
- Agreed SLA automation scope (bounded monitoring, assignment/escalation rules, alerts)

Feedback and Reports are **not optional**: the documented primary demo journey (`docs/00-project-overview.md`, step 11–12) depends on customer feedback and on management dashboard/report data reflecting it.

### C. Stretch work

- Tasks and Reminders (after product decisions)
- Team Collaboration beyond existing notes/history (after product decisions)
- AI assistant: ticket summary, suggested reply, categorization suggestion, suggested KB solution
- Custom Branding (bounded, persisted)

### D. Architecture / demo-only

Represented in the model or UI but not production-connected, unless explicitly promoted:

- inbound email ingestion, WhatsApp provider, SMS provider, production live chat transport
- ERP integration, arbitrary external systems
- full AI chatbot
- multi-department and multi-branch behavior
- general audit logs

Do not claim any item in D works because its enum, model, or nav label exists.

## P0: Must Have

- Authentication
- Role-based access control
- Customer CRUD
- Ticket CRUD
- Ticket assignment
- Ticket priority
- Ticket categories
- Ticket status workflow
- Ticket conversation
- Internal notes
- Agent dashboard
- Customer portal
- Basic SLA tracking
- Responsive UI
- Search and basic filtering where essential

## P1: Should Have

- Attachments
- Ticket history
- Knowledge base
- In-app notifications
- Reports
- Quick replies
- Arabic and English infrastructure
- RTL support
- Customer feedback

## P2: Nice to Have

- AI ticket summary
- AI suggested reply
- AI automatic categorization
- AI suggested knowledge article
- Automatic assignment
- Audit logs
- Multi-department behavior
- Multi-branch behavior

## P3: Architecture or Demo Only

Unless explicitly promoted in priority:

- WhatsApp provider integration
- SMS provider integration
- inbound email ingestion
- production live chat transport
- ERP integration
- arbitrary external systems
- full AI chatbot

## Important Rule

A P2 or P3 feature must never block completion of a P0 feature.

## Communication Channel Strategy

The data model may support:

- WEB
- EMAIL
- WHATSAPP
- SMS
- LIVE_CHAT

For the assessment, WEB is the primary fully functional channel.

Other channels may be represented in the model and UI without claiming production integration.
