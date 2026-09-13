# cryptochain-sandbox

Monorepo for CryptoChain sandbox development: a TypeScript Express backend, a Flutter frontend (copied in separately), and local infrastructure for Postgres + pgAdmin.

```
cryptochain-sandbox/
  backend/           Node.js + TypeScript + Express
  frontend/          Placeholder — existing Flutter app lands here later
  infra/             docker-compose (Postgres 16 + pgAdmin)
  .env.sandbox
  .env.production.example
```

## What sandbox mode is

**Sandbox mode** is the only supported way to run this project today. It is a closed test environment that talks to:

- **Ethereum Sepolia** (testnet), never mainnet
- **Stripe test keys** (`sk_test_…`), never live keys
- A **local Postgres 16** database published on host port **5433** so it cannot collide with a Postgres already bound to `5432`

`NODE_ENV=sandbox` in `.env.sandbox` is the default. Use it for API work, webhook experiments, and UI integration against throwaway wallets and test cards. Nothing in sandbox is meant to move real money.

Production configuration lives only as a blank template in `.env.production.example`. It is not wired up.

> **Never point `NODE_ENV=production` at a wallet holding real funds without going through the cutover checklist in `/infra/CUTOVER_CHECKLIST.md`.**

## How to run `docker-compose up`

From the repo root:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Or from `infra/`:

```bash
cd infra
docker compose up -d
```

This starts:

| Service | Container name | Host port | Purpose |
| --- | --- | --- | --- |
| PostgreSQL 16 | `cryptochain_sandbox_db` | `5433` | Sandbox database (`cryptochain_sandbox`) |
| pgAdmin | `cryptochain_sandbox_pgadmin` | `5050` | Visual DB browser |

Postgres credentials match `.env.sandbox`:

- User / password / database: `cryptochain` / `cryptochain` / `cryptochain_sandbox`
- Host connection string: `postgresql://cryptochain:cryptochain@localhost:5433/cryptochain_sandbox`

pgAdmin (http://localhost:5050):

- Login: `admin@example.com` / `sandbox`
- Register a server: host `cryptochain_sandbox_db` (from inside Compose) or `host.docker.internal` / `localhost` is **not** the container hostname — from pgAdmin’s container use host `cryptochain_sandbox_db`, port `5432`, user `cryptochain`

Stop and remove containers (volume is kept):

```bash
docker compose -f infra/docker-compose.yml down
```

## How to run the backend

Requires Node.js 20+.

```bash
cd backend
npm install
npm run dev
```

The API listens on `PORT` from `.env.sandbox` (default `http://localhost:4000`).

| Script | What it does |
| --- | --- |
| `npm run dev` | TypeScript watch server (`tsx`) |
| `npm run build` | Compile to `backend/dist` |
| `npm start` | Run the compiled `dist` build |
| `npm test` | Unit tests |
| `npm run lint` | ESLint + Prettier check |
| `npm run sandbox:seed` | Seed demo merchant + intents for `/api/v1` |
| `npm run sepolia:smoke` | Real Sepolia JSON-RPC smoke (nightly CI) |

Smoke check:

```bash
curl http://localhost:4000/health
# {"status":"ok","mode":"sandbox","dbConnected":true}
```

The backend loads environment variables from the repo-root `.env.sandbox` file.


## CI

Every push and pull request runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml):

1. **backend** — Postgres 16 service container (same user/password/database as `infra/docker-compose.yml`, on port 5432 inside the job). `npm ci`, `prisma migrate deploy`, `prisma db seed`, lint, then Vitest unit + integration tests. Sepolia is **mocked** (`MOCK_CHAIN_PROVIDER=true`) so public RPCs cannot flake the build.
2. **frontend** — `flutter pub get`, `flutter analyze`, `flutter test`.
3. **CI** — fails the workflow if either job failed, and writes the failing job name to the GitHub Actions summary. Open that job; the first red step has the logs.

A separate [`.github/workflows/sepolia-smoke.yml`](.github/workflows/sepolia-smoke.yml) job hits a real Sepolia RPC nightly (and on `workflow_dispatch`). Do not add that call to the per-commit workflow.

## Stripe test-mode payouts (INR / merchant fiat leg)

Crypto confirmations and fiat payouts are independent. After a PaymentIntent is `CONFIRMED` on Sepolia, create a sandbox Payout (INR) and drive it with Stripe **test-mode** webhooks. This does **not** call Stripe Connect; `POST /api/payouts/:id/simulate-stripe-event` is the placeholder until Connect is set up.

### Local Stripe CLI

1. Install the [Stripe CLI](https://docs.stripe.com/stripe-cli) and log in to the **test** mode account that matches `STRIPE_TEST_SECRET_KEY`.
2. Start the backend (`npm run dev` in `backend/`). It listens on `PORT` from `.env.sandbox` (default **4000**).
3. Forward Stripe test events to this process:

```bash
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```

If your `PORT` is not 4000, substitute it:

```bash
stripe listen --forward-to localhost:$PORT/api/webhooks/stripe
```

4. The CLI prints a signing secret (`whsec_…`). Put it in repo-root `.env.sandbox` as `STRIPE_TEST_WEBHOOK_SECRET` and restart the backend so `stripe.webhooks.constructEvent` can verify signatures.
5. In another terminal, fire Stripe's fixture events:

```bash
stripe trigger payout.paid
stripe trigger payment_intent.succeeded
```

`stripe trigger` proves the receiver, signature check, and 2xx path. Those fixtures use Stripe sample object ids, so they usually **will not** attach to a CryptoChain `Payout` row.

To update a real sandbox payout:

```bash
# PaymentIntent must already be CONFIRMED
curl -X POST http://localhost:4000/api/payouts \
  -H 'content-type: application/json' \
  -d '{"paymentIntentId":"<id>","amountFiat":"1500.00","currencyFiat":"INR"}'

curl -X POST http://localhost:4000/api/payouts/<payoutId>/simulate-stripe-event \
  -H 'content-type: application/json' \
  -d '{"type":"payout.paid"}'
```

`payment_intent.succeeded` records the Stripe PaymentIntent id on the row; `payout.paid` marks the payout `PAID`.

## Flutter REST API (`/api/v1`)

The Flutter app should call **`/api/v1`** only. Every response is `{ "data": ..., "error": null }` on success or `{ "data": null, "error": { "message", "fields?" } }` on failure. Unversioned `/api/...` routes are sandbox internals (webhooks, Stripe simulate) and do not use this envelope.

Browse the live contract at **http://localhost:4000/api/docs** (Swagger UI) or **http://localhost:4000/api/openapi.json**.

### Auth

Send `X-API-Key`. Sandbox keys are prefixed `sandbox_`. The hashed key is stored on `Merchant.apiKeyHash` (never the plaintext). Production would issue `live_` keys after cutover.

Seeded demo merchant (after `npm run sandbox:seed` in `backend/`):

- Merchant id: `merchant_sandbox_seed`
- `X-API-Key: sandbox_seed_frontend_key_aaaaaaaaaaaaaaaaaaaaaaaa`

Rate limit: **100 requests per minute per API key**.

### Routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/merchants/:id` | Merchant profile |
| `GET` | `/api/v1/merchants/:id/payment-intents?status=&page=&limit=` | Paginated intents |
| `GET` | `/api/v1/payment-intents/:id` | Single intent (live watcher status) |
| `POST` | `/api/v1/payment-intents` | Create intent (Sepolia sandbox) |
| `GET` | `/api/v1/merchants/:id/payouts` | Paginated INR payouts |
| `GET` | `/api/v1/merchants/:id/summary` | Dashboard: confirmed volume, pending count, success rate, avg confirmation time |

Example:

```bash
curl http://localhost:4000/api/v1/merchants/merchant_sandbox_seed/summary \
  -H 'X-API-Key: sandbox_seed_frontend_key_aaaaaaaaaaaaaaaaaaaaaaaa'
```

Validation failures return **400** with `error.fields`: `[{ "field": "status", "message": "..." }]`.

## Frontend

The merchant Flutter app lives in `frontend/`. It talks to `/api/v1`, shows a persistent **SANDBOX MODE** banner, and keeps LIVE/mainnet locked in release builds unless you pass `--dart-define=ENABLE_LIVE_MODE=true`.

```bash
cd frontend
flutter run -d chrome --web-port 8080
```

See `frontend/README.md` for dart-define overrides, the Settings toggle, and the payment screens.

## Warning

**Never point `NODE_ENV=production` at a wallet holding real funds without going through the cutover checklist in `/infra/CUTOVER_CHECKLIST.md`.**

That checklist covers swapping every env var from testnet to mainnet, redeploying and verifying contracts on mainnet, switching Stripe from test to live keys, re-registering webhooks on production URLs, turning on monitoring, and documenting rollback. Until it is signed off, stay on `NODE_ENV=sandbox`, Sepolia, and Stripe test mode.
