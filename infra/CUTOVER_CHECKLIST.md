# Production cutover checklist

Do not set `NODE_ENV=production` or point this stack at a wallet that holds real funds until **every OPS box** below is checked and this document is signed off.

How to read each item:

- **CODE done** — the repository now implements this (config schema, guards, or docs).
- **CODE pending** — still missing in software; do not go live until it is built or explicitly waived.
- **OPS pending** — a human must do this in Stripe / cloud / custody. The repo cannot tick it.
- **N/A (current architecture)** — this stack watches ETH transfers to an EOA; there are no Solidity contracts in the repo.

Side-by-side env comparison: [`SANDBOX_VS_PRODUCTION.md`](./SANDBOX_VS_PRODUCTION.md).  
Template to copy into a secrets manager: [`.env.production.example`](../.env.production.example) (blanks only — never paste a private key into chat).

---

## Environment variables (testnet → mainnet)

- [x] **CODE done** `NODE_ENV` is `production` only in the production secret store, never in `.env.sandbox`. Boot refuses sandbox RPC/Stripe names in production.
- [ ] **OPS pending** `DATABASE_URL` points at the production Postgres instance (not `localhost:5433` / `cryptochain_sandbox`).
- [x] **CODE done** `SEPOLIA_RPC_URL` is rejected in production; `MAINNET_RPC_URL` is required and must not look like Sepolia/testnet.
- [x] **CODE done** Sandbox throwaway `SEPOLIA_PRIVATE_KEY` is **not** accepted; production requires `MAINNET_PRIVATE_KEY` and refuses the published Sepolia test wallet.
- [ ] **OPS pending** Provision a new dedicated mainnet signer in a secrets manager (do not paste it into chat or git).
- [x] **CODE done** `STRIPE_TEST_SECRET_KEY` and `STRIPE_TEST_WEBHOOK_SECRET` are rejected in production.
- [x] **CODE done** `STRIPE_LIVE_SECRET_KEY` (`sk_live_…`) and `STRIPE_LIVE_WEBHOOK_SECRET` are required in production.
- [ ] **OPS pending** Fill live Stripe keys in the secret store from the Stripe dashboard (live mode).
- [ ] **OPS pending** `PORT` and public base URLs match the production deployment; `CORS_ORIGIN` is the live merchant origin.
- [x] **CODE done** Leftover `sk_test_`, Sepolia RPC hosts, and the sandbox throwaway key fail boot if present in production.
- [x] **CODE done** `MAX_TRANSACTION_AMOUNT` is required in production and enforced server-side on create-intent (frontend cannot override it).
- [x] **CODE done** `PAYMENTS_ENABLED` defaults to `false` in production (kill switch for new intents).
- [x] **CODE done** `REQUIRED_CONFIRMATIONS` defaults to **12** in production (sandbox default remains **3**).

## Smart contracts (redeploy + verify on mainnet)

- [ ] **N/A (current architecture) / OPS pending** This backend confirms native ETH transfers to a shared receive address. There is no contract artifact in this repo to compile or verify. Before raising limits, decide whether to keep the EOA watcher or deploy a dedicated receiver/escrow and update addresses + chain ID `1`.
- [ ] **OPS pending** If contracts are introduced later: compile from a signed-off release tag, deploy to mainnet, verify on Etherscan, remove Sepolia addresses from production config.

## Stripe (test → live)

- [x] **CODE done** Sandbox Stripe client refuses `sk_live_`; production client refuses non-`sk_live_` secrets.
- [ ] **OPS pending** Stripe account is activated for live payments.
- [ ] **OPS pending** Application production env uses `STRIPE_LIVE_SECRET_KEY` (`sk_live_…`), not `sk_test_…`.
- [ ] **CODE pending / OPS pending** Products, prices, tax, Connect accounts, and live webhook event types. Fiat payouts are still a **simulated** sandbox placeholder (`simulated: true`, no Stripe Connect transfer). Do not treat INR payouts as live money movement until Connect is implemented.
- [ ] **OPS pending** Customer-facing checkout URLs point at live mode.
- [ ] **OPS pending** Test cards (`4242…`) are confirmed rejected; a small live-mode payment is verified then refunded.

## Webhooks (re-register against production URLs)

- [x] **CODE done** Merchant webhook payloads set `livemode: true` when `NODE_ENV=production`.
- [ ] **OPS pending** Production HTTPS endpoints are live and authenticated (`live_` API keys).
- [ ] **OPS pending** Stripe live webhooks are registered against production URLs (not sandbox / localhost / Stripe CLI).
- [ ] **OPS pending** Merchant payment-status webhooks are re-registered with production callback URLs.
- [ ] **OPS pending** Signing secrets in production match the **live** webhook endpoints (`STRIPE_LIVE_WEBHOOK_SECRET`).
- [ ] **OPS pending** A test event is delivered end-to-end on production URLs and shows up in logs.
- [ ] **OPS pending** Sandbox webhook endpoints are disabled so they cannot receive live events.

## Monitoring and alerting

- [x] **CODE done** Structured JSON logs in production (Pino, `info` default). Sandbox still pretty-prints.
- [x] **CODE done** `ALERT_WEBHOOK_URL` (Slack incoming webhook or Discord webhook) fires on:
  - merchant webhook delivery **exhausted retries** / fatal (no URL)
  - payout status **FAILED**
  - payment watcher tick errors (deduped)
- [ ] **OPS pending** Set `ALERT_WEBHOOK_URL` to a real Slack/Discord webhook before go-live and post a test message.
- [ ] **OPS pending** Application metrics, error tracking (e.g. Sentry), and host/process crash alerts.
- [ ] **OPS pending** Alerts for RPC failures, unexpected chain ID (boot/watcher already throw; still need on-call routing), and signer / gas-balance issues.
- [ ] **OPS pending** Database disk, connections, and failover are monitored.
- [ ] **OPS pending** On-call routing is confirmed (page reaches a human).

## Rollback plan (documented)

- [x] **CODE done** `PAYMENTS_ENABLED=false` halts **new** payment intents without a deploy. In-flight intents can still confirm via the watcher.
- [ ] **OPS pending** Rollback owner and comms channel are named.
- [ ] **OPS pending** Previous production artifact / image digest is recorded and can be redeployed.
- [ ] **OPS pending** Database backup is taken immediately before cutover; restore steps are written and tested.
- [ ] **OPS pending** Stripe live webhooks can be disabled quickly; test-mode is **not** the rollback path for real funds.
- [ ] **OPS pending** Mainnet signer / wallet freeze procedure is written (who signs, which tool, expected time). There is no on-chain pause switch for a plain EOA.
- [ ] **OPS pending** Customer-support script exists for payments in-flight at rollback.

## Cautious first-live defaults (recommended)

Fill these in the secret store, not in git:

| Knob | First-live suggestion | Enforced in code? |
| --- | --- | --- |
| `PAYMENTS_ENABLED` | `false` until sign-off, then `true` | Yes (default false in production) |
| `MAX_TRANSACTION_AMOUNT` | `0.05` ETH (raise later) | Yes (required in production) |
| `REQUIRED_CONFIRMATIONS` | `12` | Yes (production default 12) |
| `ALERT_WEBHOOK_URL` | Slack or Discord HTTPS webhook | Yes (optional URL; alerts no-op if unset) |
| Signer | New key in a secrets manager | Yes (throwaway Sepolia key refused) |

## Sign-off

- [ ] Engineering
- [ ] Security / wallet custody
- [ ] Payments (Stripe)
- [ ] On-call / SRE

**Date signed off:** ______________________
