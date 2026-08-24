# Three-Day Implementation Plan

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
