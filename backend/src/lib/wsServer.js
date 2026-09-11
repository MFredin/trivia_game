import { WebSocketServer } from 'ws';
import { verifyAuthToken } from './authTokens.js';
import { markOnline, markOffline, getSockets } from './presenceRegistry.js';

// Browsers can't set custom headers on a WebSocket handshake, so the auth token travels as a
// query param instead — same trust level as the header-based Bearer token used everywhere else.
export function attachWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }
    const userId = verifyAuthToken(url.searchParams.get('token'));
    if (!userId) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.userId = userId;
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws) => {
    markOnline(ws.userId, ws);
    ws.on('close', () => markOffline(ws.userId, ws));
    ws.on('error', () => markOffline(ws.userId, ws));
  });

  return wss;
}

export function sendToUser(userId, event) {
  const payload = JSON.stringify(event);
  for (const ws of getSockets(userId)) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}
