# Database Design

This is the planned logical model. Exact Prisma syntax may be implemented during the database feature.

## Core Models

### User
- id
- name
- email
- passwordHash
- role
- isActive (default true)
- phone optional - editable self-profile phone for internal roles; synchronized with `Customer.phone` for linked customer identities
- passwordChangedAt optional — set on every password reset / change; `require-fresh-token` rejects tokens issued before it (`feature/account-management`)
- departmentId optional
- branchId optional
- createdAt
- updatedAt

### Customer
- id
- name
- email
- phone optional
- userId optional and unique; links a CRM profile to its portal `User` identity
- createdAt
- updatedAt

### Ticket
- id
- subject
- description
- status
- priority
- channel
- customerId
- assignedAgentId optional
- categoryId optional
- departmentId optional
- branchId optional
- firstResponseDueAt optional
- firstRespondedAt optional
- resolutionDueAt optional
- resolvedAt optional
- closedAt optional
- createdAt
- updatedAt

### TicketMessage
- id
- ticketId
- authorUserId required; customer authors use their linked `User` identity
- body
- externalId optional, unique; external provider message id (e.g. WhatsApp Cloud API `wamid`). Inbound: the idempotency anchor for webhook de-duplication. Outbound: stored for traceability. `NULL` for WEB/Portal messages (`feature/whatsapp-integration`, ADR-030).
- createdAt

`TicketMessage` contains public, customer-visible conversation only.

Inbound WhatsApp messages are authored by a single login-less system `User` (`whatsapp-inbound@system.invalid`, role `CUSTOMER`, `isActive = false`) because WhatsApp senders usually have no account and `authorUserId` is required.

### TicketNote
- id
- ticketId
- authorUserId
- body
- createdAt

`TicketNote` is an internal staff note attached to one ticket and is never customer-visible.

### CustomerNote
- id
- customerId
- authorUserId
- body
- createdAt

`CustomerNote` is an internal staff note attached to a customer profile rather than to one ticket.

### Attachment
- id
- ticketId optional
- messageId optional
- customerId optional
- fileName
- mimeType
- storageKey
- createdAt

### Category
- id
- name
- description optional
- isActive

### TicketHistory
- id
- ticketId
- actorUserId optional
- action
- oldValue optional
- newValue optional
- createdAt

### SLA
Represented as one configurable `SlaRule` per priority rather than one row per ticket.

Suggested fields:
- id
- priority
- firstResponseMinutes
- resolutionMinutes
- isActive

### KnowledgeArticle
- id
- title
- content
- category optional
- status
- createdById
- createdAt
- updatedAt

### Notification
- id
- userId
- type
- title
- message
- ticketId optional (link target; `SetNull` if the ticket is removed)
- readAt optional
- createdAt

### Feedback
- id
- ticketId
- customerId
- rating
- comment optional
- createdAt

### QuickReply
- id
- title
- body
- createdById
- createdAt
- updatedAt

### Department
- id
- name
- description optional (`feature/departments-branches`, migration `20260830220000_departments_branches_fields`)
- isActive default true (same migration)
- branchId optional
- createdAt
- updatedAt
- indexes: `isActive`, `branchId`

Department names are unique within a branch through the compound `(branchId, name)` constraint. The same name may be used by different branches. `Branch.name` remains globally unique. Branchless department-name uniqueness and case-insensitive matching are enforced by `department.service.ts` (409 `DEPARTMENT_NAME_ALREADY_EXISTS`). Departments are retired via `isActive = false`; hard delete is refused with 409 `DEPARTMENT_IN_USE` while any user or ticket references the row.

### Branch
- id
- name (globally unique)
- code optional, globally unique (`feature/departments-branches`, same migration)
- address optional (same migration)
- isActive default true (same migration)
- createdAt
- updatedAt
- index: `isActive`

Branches are retired via `isActive = false`; hard delete is refused with 409 `BRANCH_IN_USE` while any department, user or ticket references the row. `code` is matched case-insensitively at the service (409 `BRANCH_CODE_ALREADY_EXISTS`).

### AuditLog
P2 unless time allows.

### PasswordResetToken (`feature/account-management`, migration `20260830190000_add_password_reset`)
- id
- userId — FK to `User`, `onDelete: Cascade`
- tokenHash — `@unique`; SHA-256 of the raw token. The raw token is NEVER stored; it exists only in the emailed reset URL
- expiresAt — 30 minutes after creation
- usedAt optional — set the moment the token is consumed (single-use)
- createdAt
- Indexes: `tokenHash` (unique), `userId`, `expiresAt`
- Invariant: at most one live (`usedAt: null`) row per user — a new forgot-password request deletes prior unused rows, and a successful reset marks its row used and deletes the user's remaining unused rows.

## Enums

### Role
- ADMIN
- MANAGER
- AGENT
- CUSTOMER

### TicketStatus
- NEW
- OPEN
- IN_PROGRESS
- WAITING_CUSTOMER
- RESOLVED
- CLOSED
- ESCALATED

### TicketPriority
- LOW
- MEDIUM
- HIGH
- URGENT

### Channel
- WEB
- EMAIL
- WHATSAPP
- SMS
- LIVE_CHAT

## Rules

- `User` is the authenticated identity for internal staff and portal customers. A `Customer` is the CRM profile and may link to one `User`; unlinked customer records can exist before portal access is provisioned.
- `TicketMessage` is public conversation, `TicketNote` is an internal ticket note, and `CustomerNote` is an internal customer-profile note.
- Every ticket message has exactly one required `User` author. For customer messages, later service logic verifies that the author's linked customer owns the ticket. Internal notes are stored only in the dedicated note models.
- `ESCALATED` is stored directly as a ticket status.
- Tickets store SLA deadline snapshots in `firstResponseDueAt` and `resolutionDueAt`; `firstRespondedAt` records the actual first public agent response. `SlaRule` stores configurable targets by priority.
- Support-history relations use `Restrict` or `SetNull` delete behavior rather than cascading historical records.
- Attachment context is validated in the service layer: at least one supported context (`ticketId`, `messageId`, or `customerId`) is required; a supplied message must belong to the supplied ticket; and customer-level attachments must belong to the intended customer. Prisma relations alone cannot enforce these cross-record invariants. `feature/attachments` (integrated into `master` at `8e24d22`; ADR-021) enforces exactly three shapes — ticket-only (`ticketId` set, `messageId`/`customerId` null), message-level (`ticketId` + `messageId` set, `customerId` null), and customer-only (`customerId` set, others null); any other combination, an empty context, and a client-supplied `storageKey`/context are rejected. Bytes are stored in a private object store keyed by a server-generated `storageKey`; PostgreSQL holds metadata only. The model has no uploader, size, checksum, `updatedAt`, or soft-delete column, so the API cannot report who uploaded a file or its size from the database, and there is no attachment deletion.
- The `(branchId, name)` database constraint prevents duplicate department names within a non-null branch. Because PostgreSQL treats `NULL` values as distinct in unique constraints, branchless department-name uniqueness—if required—must be enforced by later service validation. `feature/departments-branches` (ADR-043, migration `20260830220000_departments_branches_fields`) adds this service validation (case-insensitive, branch-scoped) plus `Department.description/isActive`, `Branch.code(@unique)/address/isActive`, and safe-delete conflict guards; `User.departmentId/branchId` and `Ticket.departmentId/branchId` remain nullable with `SetNull` on delete so retiring an org unit never invalidates existing users or tickets. A user's department must belong to its branch when both are set (`DEPARTMENT_BRANCH_MISMATCH`), matching the SLA auto-assignment eligibility rule.

Any schema change that alters these concepts must update this document before or with implementation.
