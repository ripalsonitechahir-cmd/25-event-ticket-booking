require('dotenv').config();
const app = require('./app');
const prisma = require('./db');
const { logger } = require('./logger');

const port = Number(process.env.PORT) || 4000;
const server = app.listen(port, () => logger.info('server started', { port }));

function shutdown(signal) {
  logger.info('shutting down', { signal });
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
