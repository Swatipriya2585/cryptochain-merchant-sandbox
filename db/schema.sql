-- cryptochain-backend-sandbox
-- Local SQLite schema for sandbox data only. Never pointed at production.

CREATE TABLE IF NOT EXISTS sandbox_orders (
  id TEXT PRIMARY KEY,
  merchant_order_id TEXT NOT NULL,
  amount_wei TEXT NOT NULL,
  amount_eth TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ETH',
  status TEXT NOT NULL DEFAULT 'awaiting_payment',
  receive_address TEXT NOT NULL,
  payer_address TEXT,
  tx_hash TEXT,
  confirmations INTEGER NOT NULL DEFAULT 0,
  required_confirmations INTEGER NOT NULL DEFAULT 2,
  callback_url TEXT,
  network TEXT NOT NULL DEFAULT 'sepolia',
  chain_id INTEGER NOT NULL DEFAULT 11155111 CHECK (chain_id = 11155111),
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sandbox_orders_merchant_order
  ON sandbox_orders (merchant_order_id);

CREATE INDEX IF NOT EXISTS idx_sandbox_orders_tx_hash
  ON sandbox_orders (tx_hash);

CREATE TABLE IF NOT EXISTS sandbox_webhook_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  event TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  response_code INTEGER,
  delivered_at TEXT,
  error TEXT,
  FOREIGN KEY (order_id) REFERENCES sandbox_orders(id)
);
