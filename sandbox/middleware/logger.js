function requestLogger(req, res, next) {
  const started = Date.now();
  const timestamp = new Date().toISOString();
  const body = req.body && Object.keys(req.body).length ? req.body : undefined;

  console.log(
    JSON.stringify({
      level: 'info',
      event: 'request',
      timestamp,
      method: req.method,
      path: req.originalUrl || req.path,
      body: sanitize(body),
    })
  );

  res.on('finish', () => {
    console.log(
      JSON.stringify({
        level: 'info',
        event: 'response',
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl || req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - started,
      })
    );
  });

  next();
}

function sanitize(body) {
  if (!body || typeof body !== 'object') return body;
  const clone = { ...body };
  for (const key of Object.keys(clone)) {
    if (/password|secret|pin|token/i.test(key)) {
      clone[key] = '[redacted]';
    }
  }
  return clone;
}

module.exports = {
  requestLogger,
};
