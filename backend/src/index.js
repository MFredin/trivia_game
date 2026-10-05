import http from 'node:http';
import { createApp } from './app.js';
import { attachWebSocketServer } from './lib/wsServer.js';
import { pool } from './db/pool.js';

const PORT = process.env.PORT || 4000;
// How long a deploy's SIGTERM may spend letting requests finish before the process leaves anyway.
const SHUTDOWN_GRACE_MS = 10_000;

const app = createApp();
const server = http.createServer(app);
const wss = attachWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Trivia backend listening on port ${PORT}`);
});

/**
 * Leave cleanly when Railway replaces this container (SIGTERM) or someone presses Ctrl-C: stop taking new
 * connections, let requests in flight finish, close the sockets (a player's client reconnects to the new
 * container), then release the database connections. Without it a deploy cuts requests off mid-answer.
 */
function shutDown(signal) {
  console.log(`${signal} received: shutting down.`);
  const force = setTimeout(() => process.exit(1), SHUTDOWN_GRACE_MS);
  force.unref();
  for (const client of wss.clients) client.close(1001, 'server restarting');
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutDown('SIGTERM'));
process.on('SIGINT', () => shutDown('SIGINT'));

// A promise nobody handled: with every route now covered (lib/asyncErrors.js) this is a bug in fire-and-forget
// code. Log it with its stack and keep serving, rather than end a service that is answering other people.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
