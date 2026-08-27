const mockDb = require('../data/mockDb');

function extractBearerToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return '';
}

function extractApiKey(req) {
  const bearer = extractBearerToken(req);
  if (bearer) return bearer;

  const headerKey =
    req.headers['x-api-key'] ||
    req.headers['x-sandbox-api-key'] ||
    req.headers['x-cryptochain-key'];

  if (headerKey) return String(headerKey).trim();

  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('apikey ')) {
    return auth.slice(7).trim();
  }
  return '';
}

function unauthorized(res) {
  return res.status(401).json({
    success: false,
    error: 'Unauthorized',
    message: 'Invalid or missing merchant API key. Pass Authorization: Bearer <apiKey>.',
    timestamp: new Date().toISOString(),
  });
}

function requireAuth(req, res, next) {
  const token = extractBearerToken(req) || extractApiKey(req);
  if (!token) {
    return unauthorized(res);
  }

  const session = mockDb.getMerchantSession(token);
  if (!session) {
    return unauthorized(res);
  }

  const merchant = mockDb.getMerchant(session.merchantId);
  if (!merchant) {
    return unauthorized(res);
  }

  req.merchant = mockDb.toAuthMerchant(merchant);
  req.merchantSession = session;
  req.sandboxApiKey = session.apiKey;
  return next();
}

const requireApiKey = requireAuth;

module.exports = {
  requireAuth,
  requireApiKey,
  extractApiKey,
  extractBearerToken,
};
