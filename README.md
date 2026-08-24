# Customer Support CRM

A time-boxed assessment project for a responsive customer-support workspace. This repository currently contains the project foundation only.

## Implemented

- React 19, TypeScript, Vite, React Router, TanStack Query, Axios, Tailwind CSS, shadcn/ui configuration, and i18next foundations
- English/Arabic locale structure with document direction support
- Express, TypeScript, Zod environment validation, CORS, centralized errors, Prisma/PostgreSQL infrastructure, and `GET /api/health`
- Root development, lint, typecheck, test, and build commands

## Planned

Authentication, customers, tickets, SLA automation, knowledge base, reports, AI features, and the customer portal are planned for separate feature branches.

## Repository structure

```text
client/   React frontend
server/   Express API and Prisma
docs/     Product and engineering documentation
```

## Prerequisites

- Node.js 20 or newer
- npm
- PostgreSQL (needed when database-backed features are added)

## Installation

```bash
npm install
npm --prefix client install
npm --prefix server install
```

Copy `client/.env.example` to `client/.env` and `server/.env.example` to `server/.env`, then provide local values. Real environment files are ignored by Git.

## Commands

```bash
npm run dev          # client and server
npm run dev:client
npm run dev:server
npm run lint
npm run typecheck
npm run test
npm run build
```

The frontend defaults to `http://localhost:5173`. The API defaults to `http://localhost:3000`; its health check is `GET /api/health`.
