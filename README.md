# Inventory Management System

Production-grade IT inventory management — Next.js 15, Prisma, PostgreSQL 16, TailwindCSS.

## Quick start

```bash
cp .env.example .env
docker compose up -d postgres mailhog
pnpm install
pnpm prisma migrate dev
pnpm db:seed
pnpm dev
```

App → http://localhost:7000  
Mailhog → http://localhost:8025

**Seed credentials**

| Email | Password | Role |
|---|---|---|
| admin@inventory.local  | Admin1234!  | ADMIN  |
| editor@inventory.local | Editor1234! | EDITOR |
| viewer@inventory.local | Viewer1234! | VIEWER |

## Full stack via Docker

```bash
docker compose up -d --build
```

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Next.js dev server on :7000 |
| `pnpm build` | Production build |
| `pnpm test:unit` | Unit tests (vitest) |
| `pnpm test:integration` | Integration tests (needs Postgres) |
| `pnpm test:e2e` | Playwright end-to-end |
| `pnpm db:migrate` | Run pending migrations |
| `pnpm db:seed` | Seed the database (idempotent) |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm typecheck` | TypeScript check |
| `pnpm lint` | ESLint |

## Project structure

```
src/
├── app/              Next.js App Router (pages + API routes)
├── components/       React UI components
├── server/
│   ├── auth/         NextAuth options, session helpers, RBAC
│   ├── db/           Prisma client singleton
│   ├── events/       Event bus + outbox dispatcher
│   ├── lib/          logger, errors, rate-limit, mail, audit, route helper
│   └── modules/      Domain modules (categories, items, stock, requests, audit, notifications)
├── lib/              Client-safe helpers (utils, auth export)
└── env.ts            Zod-validated environment
prisma/
├── schema.prisma     Database schema
└── seed.ts           Seed script
docs/                 13 design documents
tests/
├── unit/             Pure logic tests
├── component/        React component tests
├── integration/      API + DB tests (Testcontainers)
└── e2e/              Playwright flows
```

## Documentation

All design docs are in [`/docs`](./docs):

1. [Product Requirements](docs/01-product-requirements.md)
2. [System Architecture](docs/02-system-architecture.md)
3. [Database Design](docs/03-database-design.md)
4. [API Specifications](docs/04-api-specifications.md)
5. [Frontend Architecture](docs/05-frontend-architecture.md)
6. [RBAC Matrix](docs/06-rbac-matrix.md)
7. [Workflows](docs/07-workflows.md)
8. [Notification Design](docs/08-notification-design.md)
9. [Audit Design](docs/09-audit-design.md)
10. [Testing Strategy](docs/10-testing-strategy.md)
11. [DevOps & Deployment](docs/11-devops-deployment.md)
12. [Roadmap](docs/12-roadmap.md)
13. [AI Agent Tasks](docs/13-agent-tasks.md)

## Contributing / AI agents

See [`docs/13-agent-tasks.md`](docs/13-agent-tasks.md) for the full task backlog with agent-executable prompts.
