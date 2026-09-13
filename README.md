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

Smoke check:

```bash
curl http://localhost:4000/health
# {"status":"ok","mode":"sandbox","dbConnected":true}
```

The backend loads environment variables from the repo-root `.env.sandbox` file.

## Frontend

`frontend/` is a placeholder. Copy the existing Flutter app into that directory when it is ready.

## Warning

**Never point `NODE_ENV=production` at a wallet holding real funds without going through the cutover checklist in `/infra/CUTOVER_CHECKLIST.md`.**

That checklist covers swapping every env var from testnet to mainnet, redeploying and verifying contracts on mainnet, switching Stripe from test to live keys, re-registering webhooks on production URLs, turning on monitoring, and documenting rollback. Until it is signed off, stay on `NODE_ENV=sandbox`, Sepolia, and Stripe test mode.
