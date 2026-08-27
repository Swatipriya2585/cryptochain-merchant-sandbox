function timestamp() {
  return new Date().toISOString();
}

function success(data, message, extra = {}) {
  return {
    success: true,
    data,
    message,
    timestamp: timestamp(),
    ...extra,
  };
}

function failure(error, message, extra = {}) {
  return {
    success: false,
    error,
    message,
    timestamp: timestamp(),
    ...extra,
  };
}

function paymentEnvelope(tx) {
  return {
    id: tx.id,
    txId: tx.txId,
    txHash: tx.txHash,
    signature: tx.signature,
    status: tx.status,
    amount: tx.amount,
    currency: tx.currency,
    cryptocurrency: tx.cryptocurrency,
    merchantId: tx.merchantId,
    orderId: tx.orderId,
    from: tx.from,
    to: tx.to,
    fee: tx.fee,
    confirmations: tx.confirmations,
    requiredConfirmations: tx.requiredConfirmations,
    blockNumber: tx.blockNumber,
    network: tx.network,
    metadata: tx.metadata,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
    confirmedAt: tx.confirmedAt,
    timestamp: tx.timestamp,
  };
}

module.exports = {
  success,
  failure,
  paymentEnvelope,
};
