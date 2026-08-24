# Authentication and RBAC

## Authentication

Email/password authentication using:
- bcrypt password hashing
- JWT authentication

## Roles

### ADMIN
- full operational access
- user management
- settings access
- reports
- all tickets and customers

### MANAGER
- view all relevant tickets
- assign agents
- escalate tickets
- access reports
- manage knowledge base
- monitor SLA

### AGENT
- view assigned or permitted tickets
- reply to tickets
- update permitted statuses
- add internal notes
- view customer context
- use quick replies

### CUSTOMER
- view own profile
- create own tickets
- view own tickets
- reply to own tickets
- upload attachments to own tickets
- view knowledge base
- submit feedback for own eligible tickets

## Security Rules

- Never enforce permissions only in the UI.
- CUSTOMER must never read another customer's ticket.
- AGENT access rules must be explicit.
- Password hashes never leave the server.
- JWT secrets live in environment variables.
- Sensitive server errors are not returned to clients.
