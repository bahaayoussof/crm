# Authentication and RBAC

## Authentication

Email/password authentication using:
- bcrypt password hashing
- JWT authentication

Public self-registration is available only to customers. `POST /api/auth/register` uses a strict request schema that does not accept a role and always creates `User.role = CUSTOMER`. `ADMIN`, `MANAGER`, and `AGENT` accounts cannot self-register; later administrator-managed user creation is outside the authentication feature.

Customer registration normalizes the email by trimming and lowercasing it, hashes the password, and creates the `User` and linked `Customer` profile in one Prisma transaction. A failure to create either record rolls back both. Login applies the same email normalization and supports all four roles.

The API issues an eight-hour bearer access token containing only the user identifier and role. It does not issue refresh tokens. The client persists this token locally for the assessment, attaches it centrally through Axios, loads the current identity from `/auth/me`, and removes the token on logout or an authenticated `401` response.

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
- Public registration cannot select an authorization role.
- Invalid login attempts return the same generic error whether or not the email exists.
- Backend middleware verifies authentication and role requirements; frontend route guards provide navigation behavior only.
