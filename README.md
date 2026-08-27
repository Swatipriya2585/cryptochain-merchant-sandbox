# CryptoChain Merchant Sandbox

Standalone Node.js/Express backend that simulates the CryptoChain merchant payment API.

Create a payment, receive a fake `txHash` with `pending` status, poll until it confirms (`pending` → `confirming` → `confirmed`), and optionally fire a webhook at a merchant callback URL. All JSON responses match the live CryptoChain API envelope.

## Quick start

```bash
npm install
cp sandbox/.env.example sandbox/.env
npm start
```

Server: `http://localhost:4000`

Full endpoint docs, the sandbox API key, and demo merchant credentials are in [`sandbox/README.md`](sandbox/README.md).

```
SANDBOX_API_KEY=sk_test_sandbox_cryptochain_2026
```

```bash
curl -s -X POST http://localhost:4000/sandbox/pay \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: sk_test_sandbox_cryptochain_2026' \
  -d '{"amount":25.5,"currency":"USDC","merchantId":"mch_sandbox_001","orderId":"ord_1001"}'
```

## Layout

```
sandbox/
  index.js              Express entry point (CORS for localhost + website domain)
  .env.example          SANDBOX_API_KEY, SANDBOX_ADMIN_KEY, PORT, ALLOWED_ORIGINS, CONFIRM_DELAY_MS, FAIL_RATE
  README.md             How to run, endpoints, sandbox API key
  public/
    sandbox.html        GET /sandbox  (public merchant testing page + console)
    dashboard.html      GET /sandbox/dashboard?key=<SANDBOX_ADMIN_KEY>
  routes/
    payments.js         POST /sandbox/pay, GET /sandbox/status/:txId, GET /sandbox/transactions
    webhook.js          POST /sandbox/webhook/simulate
    merchant.js         GET /sandbox/merchant/profile, POST /sandbox/merchant/login
  middleware/
    auth.js             Validate sandbox API key
    logger.js           Log timestamp, method, path, body
  data/
    mockDb.js           In-memory store + pending->confirming->confirmed|failed state machine
  utils/
    crypto.js           Fake txHash / confirmation helpers
    response.js         CryptoChain API response envelope
```
