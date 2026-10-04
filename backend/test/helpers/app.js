import http from 'node:http';
import { WebSocket } from 'ws';

// What the route-level tests share: a real app on a real port against the real database, and
// players created straight in the database so the register rate limiter stays out of the way
// of tests that are not about it. Each test file boots its own copy (node --test runs files in
// separate processes), and closes it in `shutdown`.
let server;
let base;
let pool;

export const skip = !process.env.DATABASE_URL;

export async function boot() {
  const { createApp } = await import('../../src/app.js');
  ({ pool } = await import('../../src/db/pool.js'));
  const { attachWebSocketServer } = await import('../../src/lib/wsServer.js');
  server = http.createServer(createApp());
  attachWebSocketServer(server);
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  return { pool };
}

export async function shutdown() {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
}

export async function call(path, { token, ...options } = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

export const json = (body) => JSON.stringify(body);

export async function newPlayer({ username } = {}) {
  const { hashPassword } = await import('../../src/lib/passwords.js');
  const { signAuthToken } = await import('../../src/lib/authTokens.js');
  const name = username ?? `t${Math.random().toString(36).slice(2, 10)}`;
  const { rows } = await pool.query(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    [name, `${name}@test.invalid`, hashPassword('password123')],
  );
  return { id: rows[0].id, username: name, email: `${name}@test.invalid`, token: signAuthToken(rows[0].id) };
}

// Two players who are already friends — the setup half of most social tests.
export async function befriend(a, b) {
  await pool.query(
    `INSERT INTO friendships (user_id, friend_user_id, status, requested_by)
     VALUES ($1, $2, 'accepted', $1), ($2, $1, 'accepted', $1)`,
    [a.id, b.id],
  );
}

// A connected, authenticated socket that collects every frame it is sent.
export async function connectSocket(player) {
  const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws?token=${player.token}`);
  const frames = [];
  ws.on('message', (raw) => frames.push(JSON.parse(raw.toString())));
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  return { ws, frames, close: () => ws.close() };
}

export const settle = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
