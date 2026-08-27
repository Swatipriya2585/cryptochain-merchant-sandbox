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

function getAdminKey(req) {
  return String(req.query.key || req.headers['x-sandbox-admin-key'] || '').trim();
}

function isValidAdminKey(req) {
  const expected = process.env.SANDBOX_ADMIN_KEY || '';
  const provided = getAdminKey(req);
  return Boolean(expected) && provided === expected;
}

function requireAdminKey(req, res, next) {
  if (!isValidAdminKey(req)) {
    const wantsHtml = req.method === 'GET' && (req.path === '/dashboard' || req.originalUrl.startsWith('/sandbox/dashboard'));
    if (wantsHtml) {
      return res.status(401).type('html').send(
        '<!doctype html><title>Unauthorized</title><body style="font-family:sans-serif;background:#0b0b12;color:#fff;padding:48px"><h1>Unauthorized</h1><p>Provide ?key=&lt;SANDBOX_ADMIN_KEY&gt;</p></body>'
      );
    }
    return unauthorized(res);
  }
  return next();
}

function requireAuthOrAdmin(req, res, next) {
  if (isValidAdminKey(req)) return next();
  return requireAuth(req, res, next);
}

module.exports = {
  requireAuth,
  requireApiKey,
  requireAdminKey,
  requireAuthOrAdmin,
  extractApiKey,
  extractBearerToken,
};
