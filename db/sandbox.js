'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { assertSandboxSqlitePath } = require('../src/config/guards');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

function resolveSqlitePath(sqlitePath) {
  if (sqlitePath === ':memory:') return ':memory:';
  return path.isAbsolute(sqlitePath) ? sqlitePath : path.resolve(process.cwd(), sqlitePath);
}

function openSandboxDb(sqlitePath) {
  assertSandboxSqlitePath(sqlitePath);
  const resolved = resolveSqlitePath(sqlitePath);

  if (resolved !== ':memory:') {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
  }

  const db = new Database(resolved);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);

  return wrapSandboxDb(db);
}

function wrapSandboxDb(db) {
  const insertOrder = db.prepare(`
    INSERT INTO sandbox_orders (
      id, merchant_order_id, amount_wei, amount_eth, currency, status,
      receive_address, payer_address, tx_hash, confirmations, required_confirmations,
      callback_url, network, chain_id, metadata_json, created_at, updated_at, confirmed_at
    ) VALUES (
      @id, @merchant_order_id, @amount_wei, @amount_eth, @currency, @status,
      @receive_address, @payer_address, @tx_hash, @confirmations, @required_confirmations,
      @callback_url, @network, @chain_id, @metadata_json, @created_at, @updated_at, @confirmed_at
    )
  `);

  const selectById = db.prepare('SELECT * FROM sandbox_orders WHERE id = ?');
  const selectByMerchantOrder = db.prepare('SELECT * FROM sandbox_orders WHERE merchant_order_id = ?');
  const selectAll = db.prepare('SELECT * FROM sandbox_orders ORDER BY created_at DESC');
  const insertWebhook = db.prepare(`
    INSERT INTO sandbox_webhook_deliveries (
      order_id, event, status, payload_json, response_code, delivered_at, error
    ) VALUES (
      @order_id, @event, @status, @payload_json, @response_code, @delivered_at, @error
    )
  `);

  function rowToOrder(row) {
    if (!row) return null;
    return {
      id: row.id,
      merchantOrderId: row.merchant_order_id,
      amountWei: row.amount_wei,
      amountEth: row.amount_eth,
      currency: row.currency,
      status: row.status,
      receiveAddress: row.receive_address,
      payerAddress: row.payer_address,
      txHash: row.tx_hash,
      confirmations: row.confirmations,
      requiredConfirmations: row.required_confirmations,
      callbackUrl: row.callback_url,
      network: row.network,
      chainId: row.chain_id,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      confirmedAt: row.confirmed_at,
    };
  }

  return {
    driver: 'sqlite-sandbox',
    createOrder(order) {
      insertOrder.run({
        id: order.id,
        merchant_order_id: order.merchantOrderId,
        amount_wei: String(order.amountWei),
        amount_eth: String(order.amountEth),
        currency: order.currency || 'ETH',
        status: order.status,
        receive_address: order.receiveAddress,
        payer_address: order.payerAddress || null,
        tx_hash: order.txHash || null,
        confirmations: order.confirmations || 0,
        required_confirmations: order.requiredConfirmations,
        callback_url: order.callbackUrl || null,
        network: 'sepolia',
        chain_id: 11155111,
        metadata_json: order.metadata ? JSON.stringify(order.metadata) : null,
        created_at: order.createdAt,
        updated_at: order.updatedAt,
        confirmed_at: order.confirmedAt || null,
      });
      return rowToOrder(selectById.get(order.id));
    },
    getOrder(id) {
      return rowToOrder(selectById.get(id));
    },
    getOrderByMerchantOrderId(merchantOrderId) {
      return rowToOrder(selectByMerchantOrder.get(merchantOrderId));
    },
    listOrders() {
      return selectAll.all().map(rowToOrder);
    },
    updateOrder(id, patch) {
      const current = selectById.get(id);
      if (!current) return null;

      const next = {
        ...current,
        status: patch.status ?? current.status,
        payer_address: patch.payerAddress ?? current.payer_address,
        tx_hash: patch.txHash ?? current.tx_hash,
        confirmations: patch.confirmations ?? current.confirmations,
        updated_at: patch.updatedAt || new Date().toISOString(),
        confirmed_at: patch.confirmedAt === undefined ? current.confirmed_at : patch.confirmedAt,
      };

      db.prepare(`
        UPDATE sandbox_orders
        SET status = @status,
            payer_address = @payer_address,
            tx_hash = @tx_hash,
            confirmations = @confirmations,
            updated_at = @updated_at,
            confirmed_at = @confirmed_at
        WHERE id = @id
      `).run({ ...next, id });

      return rowToOrder(selectById.get(id));
    },
    recordWebhookDelivery(entry) {
      insertWebhook.run({
        order_id: entry.orderId,
        event: entry.event,
        status: entry.status,
        payload_json: JSON.stringify(entry.payload),
        response_code: entry.responseCode ?? null,
        delivered_at: entry.deliveredAt || new Date().toISOString(),
        error: entry.error || null,
      });
    },
    close() {
      db.close();
    },
  };
}

module.exports = {
  openSandboxDb,
};
