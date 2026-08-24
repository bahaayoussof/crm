# Database Design

This is the planned logical model. Exact Prisma syntax may be implemented during the database feature.

## Core Models

### User
- id
- name
- email
- passwordHash
- role
- departmentId optional
- branchId optional
- createdAt
- updatedAt

### Customer
- id
- name
- email
- phone optional
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
- resolutionDueAt optional
- resolvedAt optional
- closedAt optional
- createdAt
- updatedAt

### TicketMessage
- id
- ticketId
- authorUserId optional
- authorCustomerId optional
- body
- isInternal
- createdAt

### TicketNote
- id
- ticketId
- authorUserId
- body
- createdAt

### Attachment
- id
- ticketId optional
- messageId optional
- customerId optional
- fileName
- mimeType
- url or storageKey
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
May be represented as rules/configuration rather than one row per ticket.

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
- branchId optional

### Branch
- id
- name

### AuditLog
P2 unless time allows.

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

Any schema change that alters these concepts must update this document before or with implementation.
