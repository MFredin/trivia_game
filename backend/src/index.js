import http from 'node:http';
import { createApp } from './app.js';
import { attachWebSocketServer } from './lib/wsServer.js';

const PORT = process.env.PORT || 4000;
const app = createApp();
const server = http.createServer(app);
attachWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Trivia backend listening on port ${PORT}`);
});
