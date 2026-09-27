import { app } from './app';
import { env } from './config/env';
import { pool } from './db/pool';

const server = app.listen(env.port, () => {
  console.log(`Backend listening on port ${env.port}`);
});

server.once('error', (error: NodeJS.ErrnoException) => {
  console.error('Backend failed to start:', error.code ?? error.message);
  process.exit(1);
});

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`Received ${signal}; shutting down`);

  server.close(async (error) => {
    if (error) {
      console.error('HTTP server shutdown error:', error.message);
      process.exitCode = 1;
    }

    try {
      await pool.end();
    } catch (poolError) {
      console.error('MySQL pool shutdown error:', poolError instanceof Error ? poolError.message : 'Unknown error');
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));