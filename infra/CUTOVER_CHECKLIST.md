# Production cutover checklist

Do not set `NODE_ENV=production` or point this stack at a wallet that holds real funds until **every** box below is checked and this document is signed off.

## Environment variables (testnet → mainnet)

- [ ] `NODE_ENV` is `production` only in the production secret store, never in `.env.sandbox`
- [ ] `DATABASE_URL` points at the production Postgres instance (not `localhost:5433` / `cryptochain_sandbox`)
- [ ] `SEPOLIA_RPC_URL` is removed; `MAINNET_RPC_URL` is set to a dedicated Ethereum mainnet endpoint
- [ ] Sandbox / Sepolia throwaway `SEPOLIA_PRIVATE_KEY` is **not** reused; a new dedicated mainnet signer is provisioned in a secrets manager
- [ ] `STRIPE_TEST_SECRET_KEY` and `STRIPE_TEST_WEBHOOK_SECRET` are removed from the production environment
- [ ] `STRIPE_LIVE_SECRET_KEY` (and the live webhook secret) are loaded from the production secret store
- [ ] `PORT` and any public base URLs match the production deployment
- [ ] No leftover `sk_test_`, `whsec_` test values, Sepolia RPC hosts, or Hardhat/Anvil keys remain in production config

## Smart contracts (redeploy + verify on mainnet)

- [ ] Contracts are compiled from the signed-off release tag (not a sandbox branch)
- [ ] Contracts are redeployed to Ethereum mainnet (not Sepolia)
- [ ] Constructor args, proxy admin, and initializer state match the production design
- [ ] Each contract is verified on Etherscan (mainnet) with matching source and compiler settings
- [ ] Frontend / backend config is updated to the mainnet addresses and chain ID `1`
- [ ] Sepolia addresses are removed from production config and docs

## Stripe (test → live)

- [ ] Stripe account is activated for live payments
- [ ] Application uses `STRIPE_LIVE_SECRET_KEY` (`sk_live_…`), not `sk_test_…`
- [ ] Products, prices, tax, and webhook event types are recreated or cloned into **live** mode (test-mode objects do not carry over)
- [ ] Customer-facing checkout / billing portal URLs point at live mode
- [ ] Test cards (`4242…`) are confirmed rejected; a small live-mode payment is verified then refunded

## Webhooks (re-register against production URLs)

- [ ] Production HTTPS endpoints are live and authenticated
- [ ] Stripe live webhooks are registered against production URLs (not sandbox / localhost / Stripe CLI)
- [ ] Chain / payment status webhooks are re-registered with production callback URLs
- [ ] Signing secrets in production match the **live** webhook endpoints
- [ ] A test event is delivered end-to-end on production URLs and shows up in logs
- [ ] Sandbox webhook endpoints are disabled so they cannot receive live events

## Monitoring and alerting

- [ ] Application logs, metrics, and error tracking are shipping from the production environment
- [ ] Alerts exist for API errors, process crashes, and elevated latency
- [ ] Alerts exist for failed Stripe webhooks and payment state-machine stalls
- [ ] Alerts exist for RPC failures, unexpected chain ID, and signer / gas-balance issues
- [ ] Database disk, connections, and failover are monitored
- [ ] On-call routing is confirmed (page reaches a human)

## Rollback plan (documented)

- [ ] Rollback owner and comms channel are named
- [ ] Previous production artifact / image digest is recorded and can be redeployed
- [ ] Database backup is taken immediately before cutover; restore steps are written and tested
- [ ] Feature flag or traffic switch exists to halt live payments without a full deploy
- [ ] Stripe live webhooks can be disabled quickly; test-mode is **not** the rollback path for real funds
- [ ] Mainnet contract pause / emergency-stop procedure is written (who signs, which tool, expected time)
- [ ] Customer-support script exists for payments in-flight at rollback

## Sign-off

- [ ] Engineering
- [ ] Security / wallet custody
- [ ] Payments (Stripe)
- [ ] On-call / SRE

**Date signed off:** ______________________
