# ContextForge AI — Architecture Documentation

## System Overview

ContextForge AI is an AI coworker platform designed around organizational context, strict entity boundaries, and deterministic human-in-the-loop governance.

---

## Layered Architecture

The application enforces a clear four-tier separation of concerns:

```
┌──────────────────────────────────────────────┐
│                  API Layer                   │
│  Fastify HTTP routes, validation, serialization  │
│               (apps/api)                     │
└──────────────────────┬───────────────────────┘
                       │
┌──────────────────────▼───────────────────────┐
│          Application / Service Layer         │
│  Use-case orchestration, cross-cutting rules, │
│        transaction boundary management       │
│               (apps/api/src/services)        │
└──────────────────────┬───────────────────────┘
                       │
┌──────────────────────▼───────────────────────┐
│                 Domain / Core                │
│  Pure business entities, orchestrator engine, │
│      contracts, permission & approval gates  │
│            (@contextforge/core)              │
└──────────────────────┬───────────────────────┘
                       │
┌──────────────────────▼───────────────────────┐
│               Persistence Layer              │
│  PostgreSQL, Drizzle ORM, schema, migrations,│
│  tenant isolation, concurrency-safe updates  │
│             (@contextforge/db)               │
└──────────────────────────────────────────────┘
```

### Architectural Principles

1. **Independent Core (`@contextforge/core`)**:
   - Contains pure domain types, schemas, pipeline orchestrator logic, and contracts (`ContextEngine`, `Reasoner`, `Tool`, `AuditSink`).
   - Does not import or depend on Drizzle ORM or PostgreSQL drivers.

2. **Dedicated Persistence Package (`@contextforge/db`)**:
   - Encapsulates database tables, relational schemas, migrations, and PostgreSQL connection pooling.
   - Implements repositories with explicit organization/tenant boundaries.
   - Provides concurrency-safe state transitions using SQL transactions and conditional atomic updates.

3. **Entity Separation**:
   - `HumanEmployee` and `AICoworker` are distinct domain and database entities.
   - An AI coworker has explicit ownership (`created_by_employee_id`) and cannot approve its own actions.
   - Every entity is scoped to an `organization_id`.

4. **Tenant Isolation**:
   - Tenant boundaries (`organization_id`) are validated at every layer: API schema, Service/Repository queries, and Core Orchestrator.
   - Cross-organization actions are rejected at the database query level with tenant-scoped predicates (`WHERE id = $1 AND organization_id = $2`).

5. **Approval Concurrency & Atomicity**:
   - Write actions can execute **only once** upon human approval.
   - Transitions from `pending` to `approved` (or `rejected`) utilize atomic conditional updates:
     `UPDATE approvals SET status = 'approved', ... WHERE id = $1 AND status = 'pending' RETURNING *`
   - Concurrent approval attempts return a concurrency conflict error, guaranteeing that write tools execute exactly once.
