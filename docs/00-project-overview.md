# Customer Support CRM

## Purpose

Build a responsive Customer Support CRM assessment using React and Node.js.

The goal is to demonstrate a coherent end-to-end support workflow rather than production-grade integrations for every external channel.

## Selected Stack

### Frontend
- React 19
- TypeScript
- Vite
- React Router
- TanStack Query
- React Hook Form
- Zod
- Tailwind CSS
- shadcn/ui
- Axios
- Recharts
- i18next

### Backend
- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL
- JWT
- bcrypt
- Zod
- Multer where attachments are implemented

### Testing
- Vitest
- React Testing Library
- Supertest when practical

### Deployment
- Frontend: Vercel
- Backend: Vercel-compatible Node API or another explicitly approved deployment target
- Database: managed PostgreSQL, preferably Neon for the assessment

## Product Areas

The supplied task includes:
- Customer management
- Ticket management
- Communication channels
- Agent dashboard
- SLA and automation
- Knowledge base
- AI features
- Customer portal
- Reports and management
- Security and administration
- Integrations
- Arabic and English
- Responsive web support
- Multi-department
- Multi-branch
- Custom branding

Because the project is time-boxed to approximately three days and implemented by one developer, priorities are defined in `01-scope-and-priorities.md`.

## Primary Demo Journey

1. Admin or agent signs in.
2. A customer exists or is created.
3. Customer creates a support ticket.
4. Ticket is assigned to an agent.
5. Agent reviews customer and ticket context.
6. Agent adds an internal note.
7. Agent replies to the customer.
8. SLA state is visible.
9. Customer replies from the portal.
10. Agent resolves the ticket.
11. Customer submits feedback.
12. Manager sees updated dashboard/report data.
