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
| `PORT` | `4000` | HTTP port |
| `ALLOWED_ORIGINS` | localhost + `https://cryptochain.io` | CORS allowlist (comma-separated). Any `localhost` / `127.0.0.1` origin is also allowed. |
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

### `GET /sandbox/transactions`

Dashboard listing of every sandbox transaction (newest first). Optional `?merchantId=` filter.

### `POST /sandbox/webhook/simulate`

POST the current (or overridden) transaction status to a merchant callback URL.

```json
{
  "txId": "tx_...",
  "callbackUrl": "https://merchant.example/webhooks/cryptochain",
  "status": "confirmed"
}
```

The outbound webhook is HMAC-SHA256 signed with `SANDBOX_API_KEY`:

- `X-CryptoChain-Signature`
- `X-CryptoChain-Signature-256: sha256=<hex>`
- `X-CryptoChain-Event`

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
