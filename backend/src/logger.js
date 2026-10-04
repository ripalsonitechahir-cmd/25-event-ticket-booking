// Structured (JSON) logs written to stdout.
function log(level, msg, extra = {}) {
  process.stdout.write(
    JSON.stringify({ time: new Date().toISOString(), level, msg, ...extra }) + '\n'
  );
}

const logger = {
  info: (msg, extra) => log('info', msg, extra),
  warn: (msg, extra) => log('warn', msg, extra),
  error: (msg, extra) => log('error', msg, extra),
};

function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info('request', {
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      duration_ms: Math.round(ms * 10) / 10,
    });
  });
  next();
}

module.exports = { logger, requestLogger };
