# Architecture Decisions Log

Use this file for decisions not already fixed by the project documentation.

Do not record trivial implementation details.

## Template

### ADR-XXX: Decision Title

**Date:** YYYY-MM-DD

**Context**

What required a decision?

**Decision**

What was chosen?

**Reason**

Why was it chosen for this assessment?

**Alternatives Considered**

What reasonable options were not chosen?

**Consequences**

What trade-offs or follow-up work result from the decision?

---

## ADR-001: Use Express Instead of NestJS

**Context**

The project is implemented by one developer in approximately three days.

**Decision**

Use Express + TypeScript for the backend.

**Reason**

It minimizes framework overhead while preserving a clean route/controller/service architecture.

**Alternatives Considered**

NestJS.

**Consequences**

Some conventions normally enforced by NestJS must be maintained through repository rules and documentation.

---

## ADR-002: External Channels Are Architecture-Ready

**Context**

The requirements mention email, WhatsApp, live chat, SMS, and web forms.

**Decision**

WEB is the primary fully functional support channel for the assessment. Other channel types may exist in the data model and interface without claiming production provider integration.

**Reason**

Production integrations require external providers, credentials, webhooks, operational infrastructure, and more time than the assessment window allows.

**Consequences**

Future provider adapters can be added without changing the ticket domain model.

---

## ADR-003: Customer Identity, Conversation, and Notes

**Date:** 2026-08-24

**Context**

The CRM needs both customer profiles and customer portal authentication. Ticket messages may be written by internal users or customers, while nullable user/customer author columns would permit ambiguous or authorless messages.

**Decision**

`User` is the single authenticated identity for every role. `Customer` remains the CRM profile and has an optional unique link to `User`. Every ticket message has one required `authorUserId`; a customer message is authored by a `User` with the `CUSTOMER` role whose linked customer owns the ticket. `TicketMessage` stores only public conversation, while `TicketNote` and `CustomerNote` separately store internal notes for a ticket and customer profile.

**Reason**

This makes portal ownership and message authorship straightforward without polymorphic author fields. Customer records can still exist before portal access is provisioned.

**Alternatives Considered**

Separate customer credentials; two nullable author foreign keys; a polymorphic author identifier.

**Consequences**

Later authentication/customer services must enforce that portal users have a linked customer profile and that customer message authors own the ticket. Contact email remains on `Customer`, while login email remains on `User`. Customer-facing queries must never include either internal note model.

---

## ADR-004: Escalation and SLA Persistence

**Date:** 2026-08-24

**Context**

The workflow permits either an escalation status or a separate escalation flag, and SLA targets need configuration without implementing an SLA engine in the schema feature.

**Decision**

Use the documented `ESCALATED` ticket status. Store one configurable `SlaRule` per priority, while each ticket stores nullable `firstResponseDueAt` and `resolutionDueAt` deadline snapshots. `firstRespondedAt` stores the actual first public agent-response timestamp.

**Reason**

This follows the existing workflow enum and keeps later SLA calculations simple and auditable without adding duplicate state.

**Alternatives Considered**

A separate escalation flag; one SLA row per ticket; versioned SLA policy tables.

**Consequences**

Later workflow logic must define allowed transitions into and out of `ESCALATED`. Later SLA services calculate and populate ticket deadlines from the active priority rule, set `firstRespondedAt` only once, and compare the actual response timestamp with its deadline.

---

## ADR-005: Attachment Context Validation

**Date:** 2026-08-24

**Context**

Attachment metadata may belong to a ticket, a public ticket message, or a customer profile. Prisma can represent these optional relations but cannot enforce cross-record ownership rules or require at least one of several optional foreign keys.

**Decision**

Keep `ticketId`, `messageId`, and `customerId` optional in the schema and enforce supported attachment context in the later attachment service.

**Reason**

This supports ticket-level, message-level, and customer-level attachments without binary database storage or polymorphic identifiers that discard foreign-key integrity.

**Alternatives Considered**

Separate attachment tables per context; a polymorphic context type/id pair; PostgreSQL-specific check constraints in a manual migration.

**Consequences**

The attachment service must require at least one context, verify that a message belongs to any supplied ticket, and verify customer ownership. The schema alone permits invalid context combinations until that validation is implemented.
