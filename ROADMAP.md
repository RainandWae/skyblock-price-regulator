# Production Roadmap

What stands between this repo and something deployable with real users.

Measurements were taken against the live Hypixel API on 2026-09-19. Re-measure
before acting on the numbers, since the market size moves.

## Suggested order

Payload trimming and compression, then the cache clamp and rate limiting, then
tests and CI, then accounts and Postgres, then the auction scanner, then legal,
then launch. The first three are days of work. Accounts is the real project.

---

## 1. Bandwidth

The server sends the full Hypixel bazaar payload to every client every 60
seconds, uncompressed.

| | per response | per user/day | 500 users/day |
|---|---|---|---|
| today | 3.64 MB | 5.25 GB | 2.6 TB |
| gzip only | 0.50 MB | 0.72 GB | 360 GB |
| trimmed + gzip | 0.05 MB | 0.07 GB | 35 GB |

`fe/src/lib/market.ts` reads six numbers per product. The payload carries the full
30-deep order book for all 2,197 products. Trimming server-side to the fields the
client uses is a 75x reduction.

- [ ] Trim the `/api/bazaar` response to the fields `toMarketItems` reads
- [ ] Add gzip/brotli compression to API and static responses
- [ ] Move `history.recordSnapshot()` off the request path onto a timer. It
      writes ~2,200 SQLite rows synchronously while a request waits
      (`be/src/index.mjs`)
- [ ] Re-measure egress after the change and model cost at target user count

## 2. There is no concept of a user

Tracked buys and settings live in `localStorage` (`fe/src/App.tsx`). Every visitor
gets an isolated silo that dies when they clear their browser, switch devices, or
open a private window. You cannot support, debug, bill, or email someone who does
not exist server-side.

This is the architecture change, not a feature. Everything in this section is one
project.

- [ ] Accounts: email+password or OAuth
- [ ] Postgres for user data. SQLite can keep market history, but user rows need
      to survive instance moves
- [ ] Server-side tracked buys and settings
- [ ] One-time import of existing `localStorage` data on first login, so current
      users do not lose work
- [ ] Sessions, password reset, email verification
- [ ] Transactional email provider (Resend, Postmark)
- [ ] Account deletion and data export. Build these before you have users, not
      after

## 3. Correctness

### The auction scanner is wrong

It reads page 0 only, filters to BIN, slices to 500 (`fe/src/api/market.ts`). As of
2026-09-19 the auction house is 42 pages and 41,240 auctions, so the scanner sees
about 1.2% of the market. The "% below median" it displays is not computed
against the median.

- [ ] Either page all 42 server-side (~100 MB per refresh upstream), compute the
      aggregate once, cache it, and never ship raw auctions to clients
- [ ] Or remove the feature until it can be done properly

### The chart invents data

`fe/src/components/MarketChart.tsx` fabricates a prior point at
`buyOrderPrice * 0.998` when history is empty, so a new user sees price movement
that never happened.

- [ ] Replace the synthetic fallback with an empty state

## 4. Security and abuse

- [ ] Clamp `auctions:${page}` to the real page count and add cache eviction.
      It currently caches on unvalidated user input, ~2.4 MB per entry, held
      forever. `?page=99999` in a loop is trivial memory exhaustion
      (`be/src/index.mjs`)
- [ ] Per-IP rate limiting
- [ ] Fix the static fallback returning `index.html` with HTTP 200 for any
      missing path. Broken asset URLs currently return HTML under a JS content
      type, and real 404s are invisible
- [ ] Fix the catch-all error handler. It calls `sendJson` unconditionally, so if
      `serveStatic` already wrote headers it throws inside the handler and kills
      the response
- [ ] Security headers: CSP, HSTS, `X-Content-Type-Options`, frame options
- [ ] Secrets in the host env store, never in the image
- [ ] Argon2id or bcrypt for passwords once auth exists
- [ ] `npm audit` in CI, plus Dependabot or Renovate

## 5. Data durability

- [ ] **Assert the disk mount at startup.** If Render's mount path does not
      exactly match where the process writes, SQLite silently creates a fresh
      database on ephemeral disk and everything is lost on every deploy with no
      error. Fail loudly instead
- [ ] Nightly backup to object storage (R2, B2, S3), and test a restore
- [ ] `SIGTERM` handler that checkpoints WAL and closes the database. Render
      sends SIGTERM on deploy and the WAL tail can currently be lost
- [ ] Versioned schema migrations. `user_version` is available and unused
- [ ] Accept that SQLite pins you to one instance: no horizontal scaling, and
      downtime on every deploy. Fine for now, worth choosing deliberately

## 6. Ops

- [ ] Make `/api/health` check the database and upstream. It returns `{ok:true}`
      unconditionally, so it passes while the database is corrupt and Hypixel is
      down
- [ ] Structured request logging (pino)
- [ ] Error tracking (Sentry)
- [ ] Metrics and uptime monitoring
- [ ] Alerting, so you hear about outages before users tell you
- [ ] Staging environment that mirrors production, including the disk
- [ ] Documented rollback procedure, written before you need it at 2am
- [ ] Backoff on Hypixel rate limits, and serve stale cache instead of erroring
      when upstream fails

## 7. Engineering hygiene

- [ ] Tests. Start with the money paths: `toMarketItems`, `applyFlipFilters`,
      `formatCoins`, `parseQuantityInput`, and the SQLite retention prune. That
      prune shipped with two silent bugs already
- [ ] CI running typecheck, lint, tests, and build on every PR
- [ ] ESLint and Prettier, enforced in CI
- [x] Move `typescript`, `vite`, `@vitejs/plugin-react` and `@types/*` from
      `dependencies` to `devDependencies`, and adjust the build command
      (done by the be/fe workspace split)
- [x] Pin Node with `engines` and `.nvmrc`. `node:sqlite` needs 22+
- [ ] Add a LICENSE. A public repo without one is all rights reserved, so nobody
      can legally use or contribute
- [x] Commit or revert the modified `package-lock.json` sitting in the working
      tree. Lockfile drift causes builds that pass locally and fail on the host

## 8. The product itself

- [ ] React error boundary. One bad render currently shows a blank page
- [ ] First-run experience. Today it is a wall of numbers with no explanation of
      what a buy order spread is or what to do with it
- [ ] Real loading, empty, and error states. Right now there is a `status` string
- [ ] Mobile layout
- [ ] Accessibility: keyboard navigation, focus states, contrast, screen reader
      labels on the chart
- [ ] Docs, changelog, and a support channel people can reach

## 9. Legal

- [ ] Read the Hypixel API terms before running a public service on their data,
      especially if you monetize. Confirm what is permitted commercially and
      whether you need a key at your request volume
- [ ] Check Mojang/Microsoft brand rules for Minecraft and SkyBlock naming. The
      "not affiliated with Hypixel" line in the README is a start, not the whole
      answer
- [ ] Privacy policy and terms of service. Mandatory once you collect emails
- [ ] GDPR/CCPA handling if you have EU or California users: data export,
      deletion, lawful basis, cookie banner if you add analytics
- [ ] Disclaimer that this is not financial or trading advice. SkyBlock coins
      have grey-market value and people will lose coins acting on these numbers

## 10. Money

- [ ] Model hosting cost at target user count. After the payload fix, bandwidth
      stops being the driver and the instance plus disk dominate
- [ ] If charging: payment provider, tier definitions, and a free tier that does
      not cost much per user. `DEPLOYMENT.md` mentions Polar, which handles
      merchant-of-record and VAT
