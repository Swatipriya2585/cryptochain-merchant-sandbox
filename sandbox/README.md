# CryptoChain Merchant Sandbox

Standalone Node.js/Express backend that simulates the CryptoChain merchant payment API. Responses use the same envelope and payment object shape as the live CryptoChain API (`success`, `data`, `error`, `message`, `timestamp`).

## Run

```bash
npm install
cp sandbox/.env.example sandbox/.env
npm start
```

The server listens on `http://localhost:4000` by default.

```bash
npm run dev    # restart on file changes
npm test       # API tests
```

## Sandbox auth

Log in (no API key required), then send the returned `apiKey` as a Bearer token:

```
Authorization: Bearer <apiKey>
```

The static key is also pre-seeded on the demo merchant so payment routes still accept:

```
x-api-key: sk_test_sandbox_cryptochain_2026
```

## Demo merchant

| Field | Value |
| --- | --- |
| merchantId | `mch_sandbox_001` |
| email | `merchant@sandbox.test` |
| password | `sandbox123` |
| name | `Sandbox Merchant` |
| businessName | `Sandbox Test Store` |

## Environment

Copy `sandbox/.env.example`. Variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `SANDBOX_API_KEY` | `sk_test_sandbox_cryptochain_2026` | Static sandbox API key |
| `SANDBOX_ADMIN_KEY` | `sandbox_admin_dev_key` | Query-param key for the internal dashboard and reset route |
| `PORT` | `4000` | HTTP port |
| `ALLOWED_ORIGINS` | localhost + cryptochain.in / .io | CORS allowlist (comma-separated). Any `localhost` / `127.0.0.1` origin is also allowed. Defaults are always included. |
| `CONFIRM_DELAY_MS` | `8000` | Delay between `pending → confirming` and `confirming → confirmed` |
| `FAIL_RATE` | `0.1` | Probability a transaction ends as `failed` instead of `confirmed` |

## Endpoints

### `GET /health` and `GET /sandbox/health`

Liveness check. No API key required.

### `POST /sandbox/pay`

Create a payment. Body:

```json
{
  "amount": 25.5,
  "currency": "USDC",
  "merchantId": "mch_sandbox_001",
  "orderId": "ord_1001",
  "callbackUrl": "https://merchant.example/webhooks/cryptochain"
}
```

`callbackUrl` / `webhookUrl` is optional. When set, the sandbox POSTs status updates as the transaction confirms.

Returns `201` with a fake `txHash` and `status: "pending"`. Repeating the same `merchantId` + `orderId` returns the existing payment.

### `GET /sandbox/status/:txId`

Poll payment status. `:txId` may be the `txId` or the `txHash`. Status progresses:

`pending` → `confirming` → `confirmed`

Progress is driven by the in-memory state machine in `data/mockDb.js`. A background `setInterval` (every 2 seconds) moves due transactions:

`pending` → `confirming` → `confirmed`

About `FAIL_RATE` (default 10%) of payments go `confirming` → `failed` instead of `confirmed`. `GET /sandbox/status/:txId` also applies due transitions immediately so polling does not wait for the next 2s tick.

### `GET /sandbox`

Public merchant testing page (no API key). Served with `res.sendFile`. Product nav includes **Sandbox**, and the embedded console logs in as `merchant@sandbox.test` then calls:

- `POST /sandbox/merchant/login`
- `POST /sandbox/pay`
- `GET /sandbox/status/:txId`
- `POST /sandbox/webhook/simulate`
- `GET /sandbox/health` (green Connected / red Sandbox Offline)

`GET /sandbox/console` redirects to `/sandbox#console`.

### `GET /sandbox/dashboard?key=<SANDBOX_ADMIN_KEY>`

Internal HTML dashboard (no framework). Served with `res.sendFile`. Guarded by `?key=` matching `SANDBOX_ADMIN_KEY`. Without the key the page returns HTML `401`.

The page lists every transaction (`txId`, `orderId`, `amount`, `currency`, `status`, age), shows pending/confirming/confirmed/failed counts, auto-refreshes every 5 seconds via `GET /sandbox/transactions`, and has a **Reset All** button that calls `DELETE /sandbox/reset`.

```
http://localhost:4000/sandbox/dashboard?key=sandbox_admin_dev_key
```

### `GET /sandbox/transactions`

JSON array of every sandbox transaction (newest first). Optional `?merchantId=` filter. Requires a merchant API key **or** `?key=<SANDBOX_ADMIN_KEY>`.

```json
[
  { "txId": "tx_...", "orderId": "ord_1001", "amount": 25.5, "currency": "USDC", "status": "pending", "createdAt": "2026-08-27T13:00:00.000Z" }
]
```

### `DELETE /sandbox/reset?key=<SANDBOX_ADMIN_KEY>`

Clears all transactions and sessions (then re-seeds the demo merchant). Returns `{ "cleared": true }`.

### `POST /sandbox/webhook/simulate`

Look up a transaction and POST its current status to a merchant callback URL.

```json
{
  "txId": "tx_...",
  "callbackUrl": "https://merchant.example/webhooks/cryptochain"
}
```

Outbound body:

```json
{
  "event": "payment.status_update",
  "txId": "tx_...",
  "txHash": "0x...",
  "status": "pending",
  "amount": 25.5,
  "currency": "USDC",
  "timestamp": "2026-08-27T13:00:00.000Z"
}
```

Responses:

```json
{ "success": true, "deliveredAt": "2026-08-27T13:00:00.000Z" }
```

```json
{ "success": false, "error": "fetch failed" }
```

The same payload is auto-delivered whenever the state machine moves a transaction that was created with `callbackUrl`.

### `POST /sandbox/merchant/login`

No auth header required. Any non-empty `{ email, password }` succeeds in sandbox. The pre-seeded tester account is `merchant@sandbox.test` / `sandbox123`.

```json
{
  "email": "merchant@sandbox.test",
  "password": "sandbox123"
}
```

```json
{
  "success": true,
  "data": {
    "merchantId": "mch_sandbox_001",
    "apiKey": "sk_sandbox_...",
    "name": "Sandbox Merchant",
    "businessName": "Sandbox Test Store",
    "sandboxMode": true
  },
  "message": "Login successful",
  "timestamp": "2026-08-27T13:00:00.000Z"
}
```

The session is stored in `mockDb.merchantSessions`.

### `GET /sandbox/merchant/profile`

Header: `Authorization: Bearer <apiKey>`

```json
{
  "success": true,
  "data": {
    "merchantId": "mch_sandbox_001",
    "name": "Sandbox Merchant",
    "businessName": "Sandbox Test Store",
    "balance": 12500.75,
    "txCount": 0,
    "sandboxMode": true
  },
  "message": "Merchant profile retrieved",
  "timestamp": "2026-08-27T13:00:00.000Z"
}
```

## Response shape

Success:

```json
{
  "success": true,
  "data": {
    "id": "tx_ab12...",
    "txId": "tx_ab12...",
    "txHash": "0x...",
    "signature": "0x...",
    "status": "pending",
    "amount": 25.5,
    "currency": "USDC",
    "cryptocurrency": "USDC",
    "merchantId": "mch_sandbox_001",
    "orderId": "ord_1001",
    "from": "sandbox:payer",
    "to": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "fee": 0,
    "confirmations": 0,
    "requiredConfirmations": 1,
    "blockNumber": null,
    "network": "solana",
    "metadata": {
      "merchantId": "mch_sandbox_001",
      "orderId": "ord_1001",
      "description": "sandbox payment",
      "category": "merchant_payment"
    },
    "createdAt": "2026-08-27T13:00:00.000Z",
    "updatedAt": "2026-08-27T13:00:00.000Z",
    "confirmedAt": null,
    "timestamp": "2026-08-27T13:00:00.000Z"
  },
  "message": "Payment created",
  "timestamp": "2026-08-27T13:00:00.000Z"
}
```

Error:

```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or missing merchant API key. Pass Authorization: Bearer <apiKey>.",
  "timestamp": "2026-08-27T13:00:00.000Z"
}
```

## Example

```bash
curl -s -X POST http://localhost:4000/sandbox/pay \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: sk_test_sandbox_cryptochain_2026' \
  -d '{"amount":25.5,"currency":"USDC","merchantId":"mch_sandbox_001","orderId":"ord_1001"}'

curl -s http://localhost:4000/sandbox/status/TX_ID \
  -H 'x-api-key: sk_test_sandbox_cryptochain_2026'
```
