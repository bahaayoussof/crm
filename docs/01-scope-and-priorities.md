# Scope and Priorities

## Constraint

One developer, approximately three implementation days.

The system should look and behave like a coherent CRM, but external integrations that normally require provider accounts, webhooks, infrastructure, security review, or production configuration must not consume the core delivery window.

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
