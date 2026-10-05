import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

// The bug class: Express 4 does not catch a rejected promise from an async handler, so a database error in any
// route without its own try/catch became an unhandled rejection — which ends the Node process on current Node.
// The app now makes every handler's failure reach the error handler instead. This builds a small app with the
// same two pieces (src/lib/asyncErrors.js, src/lib/errors.js) and a handler that fails, rather than breaking a
// real route on purpose.
import '../src/lib/asyncErrors.js';
import { errorHandler, notFound } from '../src/lib/errors.js';

async function withApp(setup, run) {
  const app = express();
  app.use(express.json({ limit: '1kb' }));
  setup(app);
  app.use('/api', notFound);
  app.use(errorHandler);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const noisy = async (fn) => {
  // The handler logs the real error for the operator; keep the test output quiet and check that it was logged.
  const original = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    await fn();
  } finally {
    console.error = original;
  }
  return logged;
};

test('a rejected async handler answers with a JSON 500 and the process lives on', async () => {
  await withApp(
    (app) => {
      app.get('/api/boom', async () => {
        throw new Error('database is down');
      });
      app.get('/api/fine', (req, res) => res.json({ ok: true }));
    },
    async (base) => {
      const logged = await noisy(async () => {
        const res = await fetch(`${base}/api/boom`);
        assert.equal(res.status, 500);
        assert.deepEqual(await res.json(), { error: 'internal_error' }, 'no stack trace or message leaks to the client');
      });
      assert.match(String(logged[0]?.[1]?.message ?? logged[0]?.[0]), /database is down/, 'the operator still gets the real error');
      assert.equal((await fetch(`${base}/api/fine`)).status, 200, 'and the next request is served');
    },
  );
});

test('a handler that throws before awaiting anything is handled the same way', async () => {
  await withApp(
    (app) =>
      app.get('/api/sync-boom', () => {
        throw new Error('bad');
      }),
    async (base) => {
      await noisy(async () => assert.equal((await fetch(`${base}/api/sync-boom`)).status, 500));
    },
  );
});

test('a body that is not JSON, or too large, is the caller\'s mistake and says so in JSON', async () => {
  await withApp(
    (app) => app.post('/api/echo', (req, res) => res.json(req.body)),
    async (base) => {
      const post = (body) => fetch(`${base}/api/echo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      const broken = await post('{"a":');
      assert.equal(broken.status, 400);
      assert.deepEqual(await broken.json(), { error: 'invalid_json' });
      const huge = await post(JSON.stringify({ a: 'x'.repeat(5000) }));
      assert.equal(huge.status, 413);
      assert.deepEqual(await huge.json(), { error: 'payload_too_large' });
    },
  );
});

test('an unknown API path is a JSON 404, not an HTML page', async () => {
  await withApp(
    () => {},
    async (base) => {
      const res = await fetch(`${base}/api/nothing-here`);
      assert.equal(res.status, 404);
      assert.deepEqual(await res.json(), { error: 'not_found' });
    },
  );
});

test('a flood of writes from one player is stopped, and does not touch another player or any read', async () => {
  // A fresh copy of the limiter module so this test's counts are its own.
  const { writeLimit } = await import(`../src/lib/writeLimit.js?fresh=${Date.now()}`);
  const { signAuthToken } = await import('../src/lib/authTokens.js');
  await withApp(
    (app) => {
      app.use(writeLimit);
      app.post('/api/ping', (req, res) => res.json({ ok: true }));
      app.get('/api/ping', (req, res) => res.json({ ok: true }));
    },
    async (base) => {
      const as = (id) => ({ Authorization: `Bearer ${signAuthToken(id)}` });
      const post = (id) => fetch(`${base}/api/ping`, { method: 'POST', headers: id ? as(id) : {} });
      let refusedAt = null;
      for (let i = 1; i <= 650 && refusedAt === null; i += 1) if ((await post(7)).status === 429) refusedAt = i;
      assert.equal(refusedAt, 601, 'the 601st write inside a minute is refused');
      assert.deepEqual(await (await post(7)).json(), { error: 'too_many_attempts' });
      assert.equal((await post(8)).status, 200, 'another player is unaffected');
      assert.equal((await fetch(`${base}/api/ping`, { headers: as(7) })).status, 200, 'reading is never limited');
    },
  );
});
