import { app } from './app';
import { env } from './config/env';
import { validateRuntimeConfig } from './config/runtime';
import { pool } from './db/pool';
import { attachBattleSocket } from './modules/battle/battle.socket';
import { closeIdleSpeechClients } from './modules/speech/speech.tts';
import { logger } from './utils/logger';

const configIssues = validateRuntimeConfig();
if (configIssues.length > 0) {
  for (const issue of configIssues) {
    logger.error('invalid_configuration', { field: issue.field, message: issue.message });
  }
  if (process.env.NODE_ENV === 'production') process.exit(1);
}

const server = app.listen(env.port, () => {
  logger.info('backend_listening', { port: env.port, env: process.env.NODE_ENV ?? 'development' });
});
const io = attachBattleSocket(server);

server.once('error', (error: NodeJS.ErrnoException) => {
  logger.error('backend_start_failed', { code: error.code ?? error.message });
  process.exit(1);
});

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info('shutdown_started', { signal });

  try {
    await new Promise<void>((resolve, reject) => {
      io.close((error) => error ? reject(error) : resolve());
    });
  } catch (socketError) {
    logger.error('socket_shutdown_failed', { message: socketError instanceof Error ? socketError.message : 'Unknown error' });
    process.exitCode = 1;
    if (server.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  closeIdleSpeechClients();

  try {
    await pool.end();
  } catch (poolError) {
    logger.error('database_shutdown_failed', { message: poolError instanceof Error ? poolError.message : 'Unknown error' });
    process.exitCode = 1;
  }
  logger.info('shutdown_complete');
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
