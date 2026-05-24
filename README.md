# Allo Health — Inventory Reservation System

**Live:** [allohealth-psi.vercel.app](https://allohealth-psi.vercel.app)  
**Stack:** Next.js 14 · TypeScript · Prisma 5 · Supabase Postgres · Upstash Redis · shadcn/ui · Zod · Tailwind CSS  
**Deployed on:** Vercel

---

## Overview

This is a real-time inventory reservation system that prevents two users from purchasing the last unit of a product simultaneously. The core problem is the race condition between "add to cart" and "payment confirmation" — without a reservation layer, two users can both see "1 unit available," both attempt to buy, and one order silently fails at checkout. This system solves that by acquiring a distributed lock before mutating stock, holding inventory for 10 minutes while the user completes payment, and releasing it automatically if they don't.

---

## Local Setup

```bash
git clone https://github.com/bharath-avl/allo_health.git
cd allo_health
npm install
```

Copy the environment template and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:

| Variable | Source |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → Connection string (Session Pooler) |
| `DATABASE_URL_UNPOOLED` | Supabase → Settings → Database → Connection string (Direct) |
| `UPSTASH_REDIS_REST_URL` | Upstash Console → Redis Database → REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Console → Redis Database → REST Token |
| `CRON_SECRET` | Any secure random string (used to authenticate the cron endpoint) |

> **Note:** Redis is optional for local development. If the Upstash variables are missing, the app runs without distributed locking or idempotency — useful for quick local testing.

Run migrations and seed the database:

```bash
npx prisma migrate dev
npx prisma db seed
npm run dev
```

The app will be available at `http://localhost:3000` with 3 products, 2 warehouses, and 6 inventory rows pre-seeded.

---

## How Concurrency Is Handled

The reservation endpoint (`POST /api/reservations`) uses a Redis-based distributed lock to serialize writes to a given inventory row.

**The mechanism:**

1. Before reading stock, the handler calls `SET lock:inv:{inventoryId} 1 NX EX 5` on Redis
2. `NX` ensures only one caller succeeds — the lock is acquired atomically
3. `EX 5` sets a 5-second TTL so the lock self-releases even if the process crashes
4. The winner reads inventory, verifies `totalUnits - reservedUnits >= quantity`, and runs a Prisma `$transaction` to increment `reservedUnits` and create the `Reservation` row
5. The lock is released in a `finally` block

**What happens with two simultaneous requests for the last unit:**

- Request A acquires the lock, reads `available = 1`, reserves it, returns `200`
- Request B fails `SET NX` immediately, returns `409 { error: "LOCK_FAILED" }` without touching the database

**Why Redis over `SELECT FOR UPDATE`:**

Serverless functions on Vercel run in isolated, short-lived containers. Postgres row-level locks (`SELECT FOR UPDATE`) require holding a connection open for the duration of the transaction — under cold starts and connection pooling (Supavisor), this is unpredictable. Redis `SET NX EX` is a single atomic command that fails fast, doesn't depend on connection lifecycle, and the same Redis instance doubles as the idempotency cache.

---

## How Expiry Works in Production

Reservations expire 10 minutes after creation. The system uses a two-layer approach to ensure expired holds are always released:

### Layer 1: Scheduled Cleanup

A Vercel Cron job runs daily (Hobby tier limitation) hitting `POST /api/cron/release-expired`. It batch-queries all reservations where `status = "pending"` and `expiresAt < now()`, then runs a `$transaction` per reservation to set `status = "released"` and decrement `reservedUnits` on the inventory row. The endpoint is protected by a `CRON_SECRET` bearer token.

### Layer 2: Lazy Cleanup (Self-Healing)

Every read path checks for expired reservations inline:

- `GET /api/products` — releases all expired pending reservations before returning product data
- `GET /api/reservations/[id]` — if the fetched reservation is pending and past `expiresAt`, it releases it and returns `410 Gone`

This makes the system self-healing — even if the cron job misfires or runs late, the next user to load the product page triggers cleanup.

### Layer 3: Client-Side Detection

The checkout page runs a local countdown timer (1-second interval) and polls the server every 30 seconds. If either detects expiry, the UI transitions to an "expired" state immediately without waiting for the next server-side cleanup.

---

## Idempotency

Clients can send an `Idempotency-Key` header with reservation requests to prevent duplicate reservations from network retries or double-clicks.

**How it works:**

1. On first request: the reservation is created normally, and the full response is cached in Redis under `idempotency:{key}` with a 24-hour TTL
2. On retry with the same key: the cached response is returned immediately — no lock acquired, no database write, no stock mutation
3. Different keys always create independent reservations

This is particularly important in mobile and unreliable network environments where POST requests may be retried by the HTTP client without the user's knowledge.

---

## Trade-offs and What I'd Do Differently

| Decision | Reasoning | Production Alternative |
|---|---|---|
| **Daily cron** | Vercel Hobby tier limits cron to once/day | BullMQ or Temporal for precise TTL-based job scheduling with per-reservation delayed tasks |
| **Client-generated `sessionId`** | No auth system in scope | Authenticated user IDs from a proper session/JWT layer |
| **5-second lock TTL** | Sufficient for typical DB write latency | Under extreme load, a slow Prisma write could exceed this; would use the Redlock algorithm across multiple Redis nodes |
| **No pagination** | 3 products in seed data | Cursor-based pagination with `take`/`skip` for production catalog sizes |
| **Full page reload on reserve** | Simple and correct | Optimistic UI updates with `useOptimistic` and proper loading skeletons for warehouse rows |
| **No admin view** | Out of scope | Real-time dashboard showing active reservations, expiry timeline, and stock levels via Server-Sent Events |
