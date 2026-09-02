'use strict';

const express = require('express');
const cors = require('cors');
const { createPaymentRouter, SEPOLIA_FAUCETS } = require('./routes/payment');
const { deliverOrderStatus, buildOrderStatusPayload } = require('./webhooks/order-status');

function isLocalhostOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function createApp({ db, chain, config }) {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (isLocalhostOrigin(origin) || config.allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
    })
  );
  app.use(express.json({ limit: '256kb' }));

  app.use((req, res, next) => {
    res.setHeader('X-CryptoChain-Network', 'sepolia');
    res.setHeader('X-CryptoChain-Chain-Id', '11155111');
    next();
  });

  app.get('/', (_req, res) => {
    res.json({
      service: 'cryptochain-backend-sandbox',
      warning: 'TESTNET ONLY. This backend never connects to Ethereum mainnet or production databases.',
      network: 'sepolia',
      chainId: 11155111,
      docs: 'See README.md for faucet links and API usage.',
      faucets: SEPOLIA_FAUCETS,
    });
  });

  app.get('/health', async (_req, res, next) => {
    try {
      const network = await chain.assertConnectedToSepolia();
      const blockNumber = await chain.getBlockNumber();
      res.json({
        success: true,
        data: {
          status: 'ok',
          service: 'cryptochain-backend-sandbox',
          sandboxMode: true,
          database: 'sqlite-sandbox',
          network: network.name,
          chainId: network.chainId,
          blockNumber,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/network', async (_req, res, next) => {
    try {
      const network = await chain.assertConnectedToSepolia();
      res.json({
        success: true,
        data: {
          network: network.name,
          chainId: network.chainId,
          rpcUrlHint: 'sepolia (exact URL omitted from this response)',
          receiveAddress: config.receiveAddress,
          requiredConfirmations: config.requiredConfirmations,
          faucets: SEPOLIA_FAUCETS,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.use('/payments', createPaymentRouter({ db, chain, config }));

  app.post('/webhooks/order-status/simulate', async (req, res, next) => {
    try {
      const { orderId, callbackUrl } = req.body || {};
      if (!orderId) {
        return res.status(400).json({ success: false, error: 'orderId is required' });
      }

      const order = db.getOrder(orderId) || db.getOrderByMerchantOrderId(orderId);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      const target = callbackUrl || order.callbackUrl;
      if (!target) {
        return res.status(400).json({
          success: false,
          error: 'callbackUrl is required when the order has none stored',
          preview: buildOrderStatusPayload(order),
        });
      }

      const result = await deliverOrderStatus({
        order,
        callbackUrl: target,
        webhookSecret: config.webhookSecret,
      });

      db.recordWebhookDelivery({
        orderId: order.id,
        event: 'order.status_update',
        status: result.delivered ? 'delivered' : 'failed',
        payload: result.payload,
        responseCode: result.statusCode,
        deliveredAt: result.deliveredAt,
        error: result.error || null,
      });

      return res.status(result.delivered ? 200 : 502).json({
        success: result.delivered,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: `No route for ${req.method} ${req.path}`,
    });
  });

  app.use((err, _req, res, _next) => {
    const isCors = /not allowed by CORS/i.test(err.message || '');
    res.status(isCors ? 403 : 500).json({
      success: false,
      error: isCors ? 'CORS blocked' : err.message || 'Internal server error',
    });
  });

  return app;
}

module.exports = { createApp };
