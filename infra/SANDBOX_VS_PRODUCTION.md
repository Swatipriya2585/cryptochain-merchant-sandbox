# Sandbox vs production config

Use this table to sanity-check that nothing testnet-specific leaked into the production path. Values in the **Production** column are what `loadConfig()` requires or defaults to when `NODE_ENV=production`.

Fill secrets only in a secret store. The production template is [`.env.production.example`](../.env.production.example) — blanks, no keys.

| Setting | Sandbox (`NODE_ENV=sandbox`) | Production (`NODE_ENV=production`) |
| --- | --- | --- |
| Chain | Sepolia (`network=sepolia`, `chainId=11155111`) | Ethereum mainnet (`network=mainnet`, `chainId=1`) |
| RPC env var | `SEPOLIA_RPC_URL` (must **not** look like mainnet) | `MAINNET_RPC_URL` (must **not** look like Sepolia/testnet) |
| Signer env var | `SEPOLIA_PRIVATE_KEY` (published throwaway OK) | `MAINNET_PRIVATE_KEY` (throwaway **refused**; do not paste into chat) |
| Stripe secret | `STRIPE_TEST_SECRET_KEY` (`sk_test_…`; `sk_live_` refused) | `STRIPE_LIVE_SECRET_KEY` (`sk_live_…` required) |
| Stripe webhook secret | `STRIPE_TEST_WEBHOOK_SECRET` | `STRIPE_LIVE_WEBHOOK_SECRET` (test name **refused**) |
| Database | `cryptochain_sandbox` on `localhost:5433` | Dedicated production Postgres (not the sandbox DSN) |
| `REQUIRED_CONFIRMATIONS` | default **3** | default **12** |
| `PAYMENT_TOLERANCE_PERCENT` | default `1` | default `1` |
| `WATCHER_POLL_INTERVAL_MS` | default `15000` | default `15000` (uses env; not a hardcoded fork) |
| `MAX_TRANSACTION_AMOUNT` | default `1` ETH (still enforced server-side) | **required**, example `0.05` ETH |
| `PAYMENTS_ENABLED` | default `true` | default **`false`** (kill switch) |
| `ALERT_WEBHOOK_URL` | optional | optional; set before go-live |
| Payment URI chain id | `@11155111` | `@1` |
| API JSON `network` | `"sepolia"` | `"mainnet"` |
| Merchant API key prefix | `sandbox_` | `live_` |
| Outbound merchant webhook `livemode` | `false` | `true` |
| Stripe client | test-mode only | live-mode only |
| `MOCK_CHAIN_PROVIDER` | allowed (CI) | **refused** |
| Flutter config | `frontend/assets/config/sandbox.env` (`CHAIN_NAME=Sepolia`) | `frontend/assets/config/live.env` (`CHAIN_NAME=Mainnet`, URLs blank until cutover) |
| Logs | Pino pretty, debug | JSON, info |

## What is still sandbox-shaped even in production

These are **not** fully cut over. Treat them as remaining risk, not as “ready for uncapped live traffic”:

1. **Shared receive address** — intents still share one EOA; colliding amounts can be mis-attributed. Prefer unique addresses / HD derivation before raising `MAX_TRANSACTION_AMOUNT`.
2. **Fiat payouts** — Stripe Connect is not implemented. Payout rows stay `simulated: true` until Connect + live payouts exist.
3. **No on-chain pause** — an EOA cannot be paused; the software kill switch is `PAYMENTS_ENABLED=false`.
4. **No contracts in this repo** — the smart-contract section of the checklist is N/A until you add them.

## Boot-time leak checks (production)

`loadConfig()` throws if production env still contains:

- `SEPOLIA_RPC_URL`
- `SEPOLIA_PRIVATE_KEY`
- `STRIPE_TEST_SECRET_KEY`
- `STRIPE_TEST_WEBHOOK_SECRET`
- `MAINNET_RPC_URL` that includes `sepolia` / `testnet` / `11155111`
- `MAINNET_PRIVATE_KEY` equal to the published sandbox throwaway
- `STRIPE_LIVE_SECRET_KEY` that does not start with `sk_live_`
- missing `MAX_TRANSACTION_AMOUNT`
