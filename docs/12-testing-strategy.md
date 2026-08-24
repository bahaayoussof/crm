# Testing Strategy

Testing is targeted because the project is heavily time-boxed.

## Highest Value Unit Tests

- authentication validation
- permission checks
- ticket status transition logic
- SLA calculations
- customer ticket ownership rules

## Frontend Tests

Prioritize:
- critical form validation
- important feature hooks or components
- permission-sensitive rendering where useful

## Backend Tests

Use Vitest/Supertest when available for:
- login
- protected route rejection
- customer ownership
- ticket creation
- role-protected actions

## Manual Happy Path

Before submission verify:

1. login
2. customer creation
3. ticket creation
4. ticket assignment
5. agent reply
6. customer reply
7. internal note
8. status update
9. SLA state
10. resolve
11. report/dashboard reflects data
12. mobile layout remains usable
