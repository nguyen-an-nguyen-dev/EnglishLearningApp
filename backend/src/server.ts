import { app } from './app';
import { env } from './config/env';
import { pool } from './db/pool';
import { attachBattleSocket } from './modules/battle/battle.socket';

const server = app.listen(env.port, () => {
  console.log(`Backend listening on port ${env.port}`);
});
const io = attachBattleSocket(server);

server.once('error', (error: NodeJS.ErrnoException) => {
  console.error('Backend failed to start:', error.code ?? error.message);
  process.exit(1);
});

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`Received ${signal}; shutting down`);

  try {
    await new Promise<void>((resolve, reject) => {
      io.close((error) => error ? reject(error) : resolve());
    });
  } catch (socketError) {
    console.error('Socket.IO shutdown error:', socketError instanceof Error ? socketError.message : 'Unknown error');
    process.exitCode = 1;
    if (server.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  try {
    await pool.end();
  } catch (poolError) {
    console.error('MariaDB pool shutdown error:', poolError instanceof Error ? poolError.message : 'Unknown error');
    process.exitCode = 1;
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));