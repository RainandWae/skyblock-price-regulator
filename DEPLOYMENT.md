    # Public Deployment Plan

This app is currently a Vite frontend served by a small Node backend. The backend also proxies Hypixel SkyBlock market data and stores Bazaar history in a SQLite database at `data/history.db`.

## 1. Hosting Target

Use Render for the first public deployment.

Recommended Render service type:

```text
Web Service
```

Recommended settings:

```text
Runtime: Node
Build command: npm install && npm run build
Start command: npm start
Health check path: /api/health
```

### Persistent disk is required

Render web services have an ephemeral filesystem by default, so `data/history.db`
is wiped on every deploy and restart. Free web services cannot attach a disk at
all, so history will never accumulate on the free tier.

To keep history, use a paid instance with a disk attached:

```text
Mount path: /opt/render/project/src/data
Size: 1 GB
```

Disks are billed per GB per month. Steady-state usage for this app is a few
hundred MB at most, because retention is tiered (see below).

Production environment variables:

```env
HOST=0.0.0.0
PORT=<provided by Render>
```

Render usually provides `PORT` automatically. Do not hard-code it in production unless the platform asks you to.

## 2. Environment Variables

Required now:

```env
HOST=0.0.0.0
PORT=8787
```

Local development can keep:

```env
HOST=127.0.0.1
PORT=8787
```

Not currently needed in this repo:

```env
DATABASE_URL=
BETTER_AUTH_SECRET=
POLAR_ACCESS_TOKEN=
CLOUDINARY_API_KEY=
AI_API_KEY=
REDIS_URL=
```

Those belong to the larger NestJS stack you described, but this Price Regulator app does not currently use auth, payments, uploads, AI, Redis, Prisma, or PostgreSQL.

## 3. Neon Database Decision

Neon is optional for this app right now.

Current behavior:

```text
Market data comes from Hypixel
Bazaar history is saved to data/history.db (SQLite)
Tracked buys are saved in the user's browser
```

History is bounded by tiered retention: full resolution for 48 hours, one sample
per 15 minutes for 30 days, then dropped. Unchanged products are not re-recorded.
A Render persistent disk is enough for this; Neon is not needed for size reasons.

Use Neon only if you want production data to be *shared between users*, such as:

```text
Shared Bazaar history for all users
User accounts
Cloud-synced tracked buys
Saved alerts
Premium features
```

If Neon is added later, the likely next stack pieces are:

```text
PostgreSQL on Neon
Prisma
DATABASE_URL
Migration scripts
Tables for history, users, alerts, and tracked buys
```

For the first public version, deploy without Neon. After the app is live, add Neon if shared saved data becomes necessary.

