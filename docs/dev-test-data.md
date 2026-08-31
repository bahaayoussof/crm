# Comprehensive Test Dataset & Pagination QA Guide

## 1. Overview & Purpose

This document details the development and test dataset designed to thoroughly verify table behavior, pagination, search, multi-attribute filtering, sorting, empty states, and RBAC scoping across both the **Frontend UI** and the **Backend REST API**.

The dataset replaces previous small fixture sets with realistic, deterministic volume across all supported CRM entities so that edge cases (such as last-page remainder, non-divisible counts, out-of-bounds page navigation, and role-based count filtering) can be reliably reproduced and tested.

---

## 2. Quick Start & Execution

### Convenience Commands

From the root directory:
```bash
# Run the test seed via npm
npm run seed:test

# Or using the database alias
npm run db:seed:test
```

Or from the `server/` directory:
```bash
npm run seed:test
```

### Safety & Environment Guards

- **Strict Production Blocker**: The seed script asserts `process.env.NODE_ENV !== "production"`. If invoked in production, it immediately throws an error and exits without performing any operations.
- **Idempotent Reset**: Prior seed records are identified via deterministic user emails (`*@crm.local`, `portal.customer*@crm.local`) and customer emails (`*@testcrm.io`). Rerunning the command cleanly purges previous test records in child-first foreign-key order (`AuditLog`, `Notification`, `TicketMention`, `TicketWatcher`, `Feedback`, `Attachment`, `TicketMessage`, `TicketNote`, `TicketHistory`, `CustomerNote`, `Task`, `KnowledgeArticle`, `QuickReply`, `Ticket`, `Customer`, `User`) and rebuilds the dataset.
- **Preservation of Pre-Existing Accounts**: Pre-existing production/demo accounts (such as `bahaa@crm.com`, `ticket.agent@crm.local`, `db.agent@crm.local`, and `whatsapp-inbound@system.invalid`) and existing live tickets/customers are preserved intact.
- **Seeded Determinism**: A custom Mulberry32 pseudo-random number generator (seed `20260830`) ensures that running the seed produces identical, predictable IDs, names, timestamps, and ticket distributions on every run.

---

## 3. Test Credentials

All seeded test accounts share the predictable development password:

```text
password123
```

### Key Seed Identities

| Role | Email | Name / Profile | Purpose / Key Characteristics |
|---|---|---|---|
| **ADMIN** | `admin1@crm.local` | Sarah Connor | Global administration, unscoped ticket/user/audit table QA |
| **ADMIN** | `admin2@crm.local` | Omar Farooq | Operations Admin, secondary admin verification |
| **ADMIN** | `admin3@crm.local` | Elena Rostova | System Admin, settings & RBAC verification |
| **MANAGER** | `manager1@crm.local` | Marcus Vance | Support Manager, global ticket queues, team task assignment |
| **MANAGER** | `manager2@crm.local` | Maya Lin | Regional Support Lead, KB & Quick Reply authoring |
| **AGENT** | `agent1@crm.local` | Alex Rivera (Senior Agent) | **Primary RBAC Test Agent**: 45 assigned tickets + 40 unassigned tickets visible (= 85 tickets, 5 pages at 20/page) |
| **AGENT** | `agent2@crm.local` | Fatima Zahra | Technical Support Specialist, active agent |
| **AGENT** | `agent3@crm.local` | Liam Chen | Billing Operations Agent, active agent |
| **AGENT** | `agent4@crm.local` ... `agent33@crm.local` | Various | 30 additional active support agents across queues |
| **AGENT** | `agent34@crm.local` | Zack Taylor | **Inactive Agent (`isActive: false`)**: tests status filter `status=inactive` |
| **AGENT** | `agent35@crm.local` | Nadia Vance | **Inactive Agent (`isActive: false`)**: tests status filter `status=inactive` |
| **CUSTOMER** | `portal.customer@crm.local` | Layla Hassan (VIP Customer) | **Primary Portal Test User**: **27 tickets** (tests customer portal pagination, 2 pages at limit 20) |
| **CUSTOMER** | `portal.customer2@crm.local` | Jonathan Miller (Enterprise) | **Secondary Portal Test User**: **23 tickets** (2 pages at limit 20) |
| **CUSTOMER** | `portal.customer3@crm.local` | Amina Idris | Portal Customer with 14 tickets |
| **CUSTOMER** | `portal.customer4@crm.local` | Robert Novak | Portal Customer with 5 tickets |
| **CUSTOMER** | `portal.customer5@crm.local` | Sofia Rossi | Portal Customer with 2 tickets |

---

## 4. Seeded Dataset Counts & Table Structure

Record counts are intentionally configured as **non-round numbers** so tables do not terminate on neat multiples of 10 or 20, exercising last-page remainder calculations and out-of-bounds page handling.

| Entity Table | Seeded Count | Default Page Size | Page Count (Limit 20) | Remainder on Last Page | Key Test Scenarios Covered |
|---|---|---|---|---|---|
| **Users** (`/users`) | **48** (+ 5 pre-existing) | 20 | **3 pages** | 3 on page 3 | Filtering by role (`ADMIN`, `MANAGER`, `AGENT`), filtering by status (`active` vs `inactive`), name/email search |
| **Customers** (`/customers`) | **185** (+ 4 pre-existing) | 20 | **10 pages** | 5 on page 10 | Search by first name, last name, email, phone; open ticket count aggregation; last interaction sort |
| **Customer Tickets** (`/customers/:id`) | **27** (Customer 1) | 20 | **2 pages** | 7 on page 2 | In-tab customer ticket history pagination, status & priority chips |
| **Tickets** (`/tickets`) | **387** (+ 12 pre-existing) | 20 | **20 pages** | 7 on page 20 | Status filters (7 statuses), priority filters (4 priorities), category filters, assigned agent filters, search, SLA countdowns |
| **Tasks** (`/tasks`) | **107** (+ 2 pre-existing) | 20 | **6 pages** | 7 on page 6 | Status filter (`OPEN` vs `DONE`), overdue tasks (past due date), upcoming tasks, assignee filter, RBAC visibility |
| **Knowledge Base** (`/knowledge-base`) | **63** (+ 1 pre-existing) | 20 | **4 pages** | 3 on page 4 | Status filter (`DRAFT` vs `PUBLISHED`), category filter, title & content full text search |
| **Quick Replies** (`/quick-replies`) | **47** (+ 3 pre-existing) | 20 | **3 pages** | 7 on page 3 | Category title search, body keyword search, modal picker search pagination |
| **Departments** (`/settings` → Departments) | **8** | 15 | **1 page** | — | Name search, active/inactive filter, branch column, user count, create/edit modal, activate/deactivate, safe-delete 409 (`DEPARTMENT_IN_USE`). 6 of 8 are branch-scoped; "Escalations" is branchless. |
| **Branches** (`/settings` → Branches) | **4** | 15 | **1 page** | — | Name/code search, active/inactive filter, address column, create/edit modal, activate/deactivate, safe-delete 409 (`BRANCH_IN_USE`). "Remote / Distributed" has no address. |
| **Audit Logs** (`/audit-logs`) | **412** (+ 4 pre-existing) | 20 | **21 pages** | 12 on page 21 | Filter by Action, Entity Type, Actor ID, Date range picker, free-text search, details Sheet diffs |
| **Portal Tickets** (`/portal/tickets`) | **27** (Layla Hassan) | 20 | **2 pages** | 7 on page 2 | Customer-safe portal pagination, status mapping (`OPEN`, `IN_PROGRESS`, `WAITING_FOR_YOU`, `RESOLVED`, `CLOSED`) |
| **Notifications** | **85** (+ 2 pre-existing) | N/A | Popover | N/A | Read vs unread state, bell badge count, ticket mention & assignment activity |

---

## 5. Critical Pagination Scenarios & Verification Rules

### 1. 1-Based Page & Limit Calculation
- Backend calculation strictly follows: `skip = (page - 1) * limit`, `take = limit`.
- Response envelope contains:
  ```json
  {
    "data": [ ... ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 387,
      "totalPages": 20
    }
  }
  ```

### 2. Remainder on Final Page
- When `total % limit !== 0`, `totalPages = Math.ceil(total / limit)`.
- The final page contains exactly `total % limit` items.
- In `DataTablePagination`, the previous button remains enabled, the next button is disabled, and range text displays e.g. `Showing 381–387 of 387`.

### 3. Search & Filter Pagination Reset
- Changing search input or selecting a filter MUST reset `page=1`.
- Both the records query (`findMany`) and the total count query (`count`) receive the identical `where` predicate, ensuring `meta.total` and `meta.totalPages` accurately reflect the filtered dataset.

### 4. RBAC Scoped Pagination
- **ADMIN / MANAGER**: Queries execute without assignment scoping; `meta.total` represents the global database count.
- **AGENT**: `ticketVisibilityWhere` scopes queries to `{ OR: [{ assignedAgentId: actor.userId }, { assignedAgentId: null }] }`.
- Crucially, this scoping applies to both `findMany` AND `count`. When `agent1@crm.local` visits `/tickets`:
  - `meta.total = 85` (45 assigned + 40 unassigned).
  - `meta.totalPages = 5` (at limit 20).
  - The agent never sees total counts or page numbers derived from tickets they are not permitted to access.
- **CUSTOMER (Portal)**: Strict `where.customerId` scoping applies to both `findMany` and `count`.

### 5. Empty States
- When a search or filter yields 0 matches, `data: []`, `meta.total: 0`, and `meta.totalPages: 0`.
- The UI renders `EmptyState` or `DataTableEmptyRow` with clear messaging and a "Clear filters" or "Reset" action.
