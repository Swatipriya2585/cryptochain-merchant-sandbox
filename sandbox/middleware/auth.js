const mockDb = require('../data/mockDb');

function extractApiKey(req) {
  const headerKey =
    req.headers['x-api-key'] ||
    req.headers['x-sandbox-api-key'] ||
    req.headers['x-cryptochain-key'];

  if (headerKey) return String(headerKey).trim();

  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  if (auth.toLowerCase().startsWith('apikey ')) {
    return auth.slice(7).trim();
  }
  return '';
}

function requireApiKey(req, res, next) {
  const expected = process.env.SANDBOX_API_KEY;
  if (!expected) {
    return res.status(500).json({
      success: false,
      error: 'Server misconfigured: SANDBOX_API_KEY is not set',
      message: 'Sandbox API key is missing',
      timestamp: new Date().toISOString(),
    });
  }

  const provided = extractApiKey(req);
  if (provided && provided === expected) {
    req.sandboxApiKey = provided;
    return next();
  }

  if (provided && provided.startsWith('sbx_')) {
    const session = mockDb.getSession(provided);
    if (session) {
      req.session = session;
      req.merchantId = session.merchantId;
      return next();
    }
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized',
    message: 'Invalid or missing sandbox API key. Pass it as x-api-key.',
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  requireApiKey,
  extractApiKey,
};
