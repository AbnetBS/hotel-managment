/**
 * Live updates over WebSocket.
 *
 * Every write publishes a small event; screens then re-fetch just that topic.
 * That keeps the cashier, the stations and the waiter boards in sync without
 * a page refresh, on the same Wi-Fi, on any device.
 */
import { WebSocketServer } from 'ws';
import { userForToken } from './auth.js';

let wss = null;
const clients = new Set();

export function attachRealtime(server) {
  wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const user = userForToken(url.searchParams.get('token'));
    const client = { ws, user };
    clients.add(client);
    ws.on('close', () => clients.delete(client));
    ws.on('error', () => clients.delete(client));
    ws.send(JSON.stringify({ type: 'hello', user: user ? { id: user.id, role: user.role } : null, at: Date.now() }));
  });
  return wss;
}

/** Tell every connected screen that these topics changed. */
export function publish(topics, payload = {}) {
  const message = JSON.stringify({ type: 'invalidate', topics: Array.isArray(topics) ? topics : [topics], payload, at: Date.now() });
  for (const client of clients) {
    if (client.ws.readyState !== 1) continue;
    try {
      client.ws.send(message);
    } catch {
      clients.delete(client);
    }
  }
}

/** Alert specific roles (e.g. ring the cashier desk when a QR order arrives). */
export function publishToRoles(roles, message) {
  const data = JSON.stringify(message);
  const wanted = Array.isArray(roles) ? roles : [roles];
  for (const client of clients) {
    if (client.ws.readyState !== 1) continue;
    if (!client.user || !wanted.includes(client.user.role)) continue;
    try {
      client.ws.send(data);
    } catch {
      clients.delete(client);
    }
  }
}

export function onlineCount() {
  return clients.size;
}
