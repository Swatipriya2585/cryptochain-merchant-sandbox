'use strict';

const crypto = require('crypto');
const express = require('express');
const { ethers } = require('ethers');
const { deliverOrderStatus } = require('../webhooks/order-status');

const SEPOLIA_FAUCETS = [
  {
    name: 'Google Cloud Web3 Sepolia Faucet',
    url: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia',
  },
  {
    name: 'Alchemy Sepolia Faucet',
    url: 'https://www.alchemy.com/faucets/ethereum-sepolia',
  },
  {
    name: 'Chainlink Sepolia Faucet',
    url: 'https://faucets.chain.link/sepolia',
  },
  {
    name: 'Sepolia PoW Faucet',
    url: 'https://sepolia-faucet.pk910.de/',
  },
  {
    name: 'QuickNode Sepolia Faucet',
    url: 'https://faucet.quicknode.com/ethereum/sepolia',
  },
];

function nowIso() {
  return new Date().toISOString();
}

function newOrderId() {
  return `ord_sep_${crypto.randomBytes(8).toString('hex')}`;
}

function publicOrder(order) {
  return {
    ...order,
    faucets: SEPOLIA_FAUCETS,
  };
}

function statusFromConfirmations(confirmations, required) {
  if (confirmations <= 0) return 'payment_detected';
  if (confirmations < required) return 'confirming';
  return 'confirmed';
}

function createPaymentRouter({ db, chain, config }) {
  const router = express.Router();

  router.post('/', (req, res) => {
    const { orderId, amountEth, callbackUrl, metadata } = req.body || {};

    if (!orderId || amountEth === undefined || amountEth === null) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: orderId, amountEth',
      });
    }

    let amountWei;
    try {
      amountWei = ethers.parseEther(String(amountEth));
    } catch {
      return res.status(400).json({
        success: false,
        error: 'amountEth must be a valid ETH decimal string',
      });
    }

    if (amountWei <= 0n) {
      return res.status(400).json({
        success: false,
        error: 'amountEth must be greater than 0',
      });
    }

    const existing = db.getOrderByMerchantOrderId(String(orderId));
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Existing sandbox order returned for orderId',
        data: publicOrder(existing),
      });
    }

    const createdAt = nowIso();
    const order = db.createOrder({
      id: newOrderId(),
      merchantOrderId: String(orderId),
      amountWei: amountWei.toString(),
      amountEth: ethers.formatEther(amountWei),
      currency: 'ETH',
      status: 'awaiting_payment',
      receiveAddress: ethers.getAddress(config.receiveAddress),
      requiredConfirmations: config.requiredConfirmations,
      callbackUrl: callbackUrl || null,
      network: 'sepolia',
      chainId: 11155111,
      metadata: metadata || null,
      createdAt,
      updatedAt: createdAt,
    });

    return res.status(201).json({
      success: true,
      message: 'Sandbox Sepolia payment order created. Send testnet ETH only.',
      data: publicOrder(order),
    });
  });

  router.get('/', (_req, res) => {
    return res.json({
      success: true,
      data: db.listOrders().map(publicOrder),
    });
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const order = db.getOrder(req.params.id) || db.getOrderByMerchantOrderId(req.params.id);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      if (order.txHash) {
        const refreshed = await refreshFromChain(order, { db, chain, config });
        return res.json({ success: true, data: publicOrder(refreshed) });
      }

      return res.json({ success: true, data: publicOrder(order) });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/:id/observe', async (req, res, next) => {
    try {
      const order = db.getOrder(req.params.id) || db.getOrderByMerchantOrderId(req.params.id);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      const txHash = req.body?.txHash;
      if (!txHash) {
        return res.status(400).json({ success: false, error: 'txHash is required' });
      }

      let verification;
      try {
        verification = await chain.verifyIncomingPayment({
          txHash,
          to: order.receiveAddress,
          minAmountWei: order.amountWei,
        });
      } catch (error) {
        const status = error.code === 'TX_NOT_FOUND' ? 404 : 400;
        return res.status(status).json({
          success: false,
          error: error.message,
          network: 'sepolia',
        });
      }

      const previousStatus = order.status;
      const nextStatus = verification.status === 0
        ? 'failed'
        : statusFromConfirmations(verification.confirmations, order.requiredConfirmations);

      const updated = db.updateOrder(order.id, {
        status: nextStatus,
        payerAddress: verification.from,
        txHash: verification.txHash,
        confirmations: verification.confirmations,
        confirmedAt: nextStatus === 'confirmed' ? nowIso() : null,
        updatedAt: nowIso(),
      });

      const delivery = await maybeNotify({ db, config, order: updated, previousStatus });

      return res.json({
        success: true,
        message: 'Sepolia transaction observed',
        data: publicOrder(updated),
        chain: verification,
        webhook: delivery,
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

async function refreshFromChain(order, { db, chain, config }) {
  const verification = await chain.verifyIncomingPayment({
    txHash: order.txHash,
    to: order.receiveAddress,
    minAmountWei: order.amountWei,
  });

  const previousStatus = order.status;
  const nextStatus = verification.status === 0
    ? 'failed'
    : statusFromConfirmations(verification.confirmations, order.requiredConfirmations);

  const updated = db.updateOrder(order.id, {
    status: nextStatus,
    payerAddress: verification.from,
    txHash: verification.txHash,
    confirmations: verification.confirmations,
    confirmedAt: nextStatus === 'confirmed' ? (order.confirmedAt || nowIso()) : null,
    updatedAt: nowIso(),
  });

  if (updated.status !== previousStatus) {
    await maybeNotify({ db, config, order: updated, previousStatus });
  }

  return updated;
}

async function maybeNotify({ db, config, order, previousStatus }) {
  if (!order.callbackUrl) {
    return { delivered: false, skipped: true };
  }

  const result = await deliverOrderStatus({
    order,
    previousStatus,
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

  return result;
}

module.exports = {
  createPaymentRouter,
  SEPOLIA_FAUCETS,
};
