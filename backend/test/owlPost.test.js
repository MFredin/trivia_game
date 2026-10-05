import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, shutdown, call, json, newPlayer, befriend, connectSocket, settle, skip } from './helpers/app.js';

test('owl post', { skip: skip && 'DATABASE_URL not set' }, async (t) => {
  const { pool } = await boot();
  t.after(shutdown);

  const send = (as, to, body, subject) =>
    call(`/owlpost/with/${to.username}`, { method: 'POST', token: as.token, body: json(subject === undefined ? { body } : { body, subject }) });
  const thread = (as, other, query = '') => call(`/owlpost/with/${other.username}${query}`, { token: as.token });
  const inbox = async (as) => (await call('/owlpost/inbox', { token: as.token })).body.conversations;
  const unread = async (as) => (await call('/owlpost/unread', { token: as.token })).body.count;
  const friends = async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    await befriend(a, b);
    return [a, b];
  };

  await t.test('friends can write to each other; the reader sees it unread, then read', async () => {
    const [a, b] = await friends();
    assert.equal((await call('/owlpost/inbox')).status, 401);
    assert.equal((await send(a, b, 'Good luck in the duel!')).status, 201);

    assert.equal(await unread(b), 1);
    assert.equal(await unread(a), 0, 'your own message is not unread to you');
    const box = await inbox(b);
    assert.equal(box.length, 1);
    assert.equal(box[0].username, a.username);
    assert.equal(box[0].last.body, 'Good luck in the duel!');
    assert.equal(box[0].last.from_me, false);
    assert.equal(box[0].unread, 1);
    assert.equal((await inbox(a))[0].last.from_me, true);

    const seen = await thread(b, a);
    assert.equal(seen.body.messages.length, 1);
    assert.equal(seen.body.messages[0].from_me, false);
    assert.equal(seen.body.with.username, a.username);
    assert.equal(seen.body.with.accepts_owls, true);
    assert.equal(await unread(b), 1, 'opening the thread is not reading it');

    assert.equal((await call(`/owlpost/with/${a.username}/read`, { method: 'POST', token: b.token })).status, 204);
    assert.equal(await unread(b), 0);
    assert.equal((await inbox(b))[0].unread, 0);
  });

  await t.test('blocked players, unknown names and strangers with no history are the same 404 to read', async () => {
    const a = await newPlayer();
    const stranger = await newPlayer();
    for (const res of [
      await thread(a, stranger),
      await send(a, { username: 'nobody-by-this-name' }, 'hello'),
      await send(a, a, 'to myself'),
      await call(`/owlpost/with/${stranger.username}/read`, { method: 'POST', token: a.token }),
    ]) {
      assert.equal(res.status, 404);
      assert.equal(res.body.error, 'user_not_found');
    }

    const [x, y] = await friends();
    await send(x, y, 'before the block');
    await call('/blocks', { method: 'POST', token: y.token, body: json({ username: x.username }) });
    for (const [from, to] of [[x, y], [y, x]]) {
      assert.equal((await send(from, to, 'after')).status, 404);
      assert.equal((await thread(from, to)).status, 404);
    }
    assert.deepEqual(await inbox(x), []);
    assert.deepEqual(await inbox(y), [], 'a blocked conversation is gone from both inboxes');
  });

  await t.test('a third party cannot read someone else’s conversation, even a mutual friend', async () => {
    const [a, b] = await friends();
    const c = await newPlayer();
    await befriend(a, c);
    await send(a, b, 'private');
    assert.equal((await thread(c, b)).status, 404, 'c is not b’s friend');
    assert.equal((await thread(c, a)).body.messages.length, 0, 'and sees only their own conversation with a');
  });

  await t.test('the same rules as a bio keep out links, language and nonsense — and nothing is stored', async () => {
    const [a, b] = await friends();
    for (const [body, error] of [
      ['x'.repeat(501), 'message_too_long'],
      ['visit www.example.com', 'message_has_link'],
      ['write to me@example.com', 'message_has_link'],
      ['   ', 'message_empty'],
      [42, 'invalid_message'],
    ]) {
      const res = await send(a, b, body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.error, error);
    }
    const { rows } = await pool.query('SELECT count(*) FROM messages WHERE sender_id = $1', [a.id]);
    assert.equal(Number(rows[0].count), 0);
  });

  await t.test('the same message twice in a row is refused, a different one is not', async () => {
    const [a, b] = await friends();
    assert.equal((await send(a, b, 'Rematch?')).status, 201);
    assert.equal((await send(a, b, 'Rematch?')).status, 409);
    assert.equal((await send(a, b, 'Rematch? Please.')).status, 201);
  });

  await t.test('sending is limited per player', async () => {
    const [a, b] = await friends();
    for (let i = 0; i < 20; i++) assert.equal((await send(a, b, `message number ${i}`)).status, 201);
    const res = await send(a, b, 'one too many');
    assert.equal(res.status, 429);
  });

  await t.test('switching Owl Post off closes it both ways, without saying so to the other side', async () => {
    const [a, b] = await friends();
    await send(a, b, 'hello there');
    const off = await call('/owlpost/settings', { method: 'PATCH', token: b.token, body: json({ mode: 'off' }) });
    assert.equal(off.body.user.owl_post, 'off');

    const refused = await send(a, b, 'are you there?');
    assert.equal(refused.status, 403);
    assert.equal(refused.body.error, 'not_accepting_owls', 'their setting is public, so it is said plainly');
    const own = await send(b, a, 'hi');
    assert.equal(own.status, 403);
    assert.equal(own.body.error, 'owl_post_off', 'your own switch is yours to be told about');
    assert.equal((await thread(b, a)).status, 200, 'and your history stays readable');
    assert.equal((await thread(a, b)).body.with.accepts_owls, false, 'the other screen can say a reply cannot be sent');

    assert.equal((await call('/owlpost/settings', { method: 'PATCH', token: b.token, body: json({ mode: 'friends' }) })).status, 200);
    assert.equal((await send(a, b, 'welcome back')).status, 201);
    for (const mode of ['open', 'friends', 'off']) {
      assert.equal((await call('/owlpost/settings', { method: 'PATCH', token: b.token, body: json({ mode }) })).body.user.owl_post, mode);
    }
    assert.equal((await call('/owlpost/settings', { method: 'PATCH', token: b.token, body: json({ mode: 'everyone' }) })).status, 400);
  });

  await t.test('a muted player can read but not write, until the mute ends', async () => {
    const [a, b] = await friends();
    await send(b, a, 'hello');
    await pool.query(`UPDATE users SET muted_until = now() + interval '1 day' WHERE id = $1`, [a.id]);
    const res = await send(a, b, 'reply');
    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'owl_post_muted');
    assert.ok(Date.parse(res.body.until));
    assert.equal((await thread(a, b)).body.messages.length, 1, 'still reads');
    assert.ok((await call('/auth/me', { token: a.token })).body.user.muted_until, 'and is told');

    await pool.query(`UPDATE users SET muted_until = now() - interval '1 minute' WHERE id = $1`, [a.id]);
    assert.equal((await send(a, b, 'reply')).status, 201);
    assert.equal((await call('/auth/me', { token: a.token })).body.user.muted_until, null);
  });

  await t.test('deleting a message hides it from the one who deleted it, and only them', async () => {
    const [a, b] = await friends();
    const sent = (await send(a, b, 'delete me')).body.message;
    const stranger = await newPlayer();
    const del = (as, id) => call(`/owlpost/messages/${id}`, { method: 'DELETE', token: as.token });

    assert.equal((await del(stranger, sent.id)).status, 404);
    assert.equal((await del(a, 'abc')).status, 404);
    assert.equal((await del(a, 999999999)).status, 404);

    assert.equal((await del(a, sent.id)).status, 204);
    assert.equal((await thread(a, b)).body.messages.length, 0);
    assert.equal((await thread(b, a)).body.messages.length, 1, 'the other side still has their copy');
    assert.equal((await del(b, sent.id)).status, 204);
    assert.equal((await thread(b, a)).body.messages.length, 0);
    assert.deepEqual(await inbox(b), []);
  });

  await t.test('a long conversation is read a page at a time, oldest first', async () => {
    const [a, b] = await friends();
    for (let i = 1; i <= 45; i++) {
      await pool.query('INSERT INTO messages (sender_id, recipient_id, body) VALUES ($1, $2, $3)', [a.id, b.id, `m${i}`]);
    }
    const first = (await thread(b, a)).body;
    assert.equal(first.messages.length, 40);
    assert.equal(first.has_more, true);
    assert.equal(first.messages[0].body, 'm6');
    assert.equal(first.messages.at(-1).body, 'm45', 'oldest first, ending at the newest');
    const rest = (await thread(b, a, `?before=${first.messages[0].id}`)).body;
    assert.deepEqual(rest.messages.map((m) => m.body), ['m1', 'm2', 'm3', 'm4', 'm5']);
    assert.equal(rest.has_more, false);
  });

  await t.test('a subject is optional, shown with the message, and filtered like the message', async (t) => {
    const [a, b] = await friends();
    const sb = await connectSocket(b);
    t.after(() => sb.close());

    const plain = await send(a, b, 'no subject here');
    assert.equal(plain.body.message.subject, null);

    const made = await send(a, b, 'Are you free on Friday?', '  Duel   night ');
    assert.equal(made.status, 201);
    assert.equal(made.body.message.subject, 'Duel night');

    await settle();
    const live = sb.frames.filter((f) => f.type === 'owlpost:message').at(-1);
    assert.equal(live.message.subject, 'Duel night');

    const seen = (await thread(b, a)).body.messages;
    assert.deepEqual(seen.map((m) => m.subject), [null, 'Duel night']);
    assert.equal((await inbox(b))[0].last.subject, 'Duel night');

    const refusedWith = async (subject) => (await send(a, b, 'hello there', subject)).body.error;
    assert.equal(await refusedWith('x'.repeat(61)), 'subject_too_long');
    assert.equal(await refusedWith('write to me@example.com'), 'subject_has_link');
    assert.equal(await refusedWith(5), 'invalid_subject');
    assert.equal((await thread(b, a)).body.messages.length, 2, 'a refused subject sends nothing');
  });

  await t.test('open by default: someone who is not a friend can send an owl, and is held to one until they answer', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    assert.equal((await call('/auth/me', { token: b.token })).body.user.owl_post, 'open', 'new accounts are open');

    assert.equal((await send(a, b, 'Fancy a duel?')).status, 201);
    const second = await send(a, b, 'Hello? Anyone?');
    assert.equal(second.status, 403);
    assert.equal(second.body.error, 'awaiting_reply');
    assert.equal((await thread(a, b)).body.with.awaiting_reply, true, 'and the screen can say so');

    const box = await inbox(b);
    assert.equal(box[0].username, a.username);
    assert.equal(box[0].is_friend, false, 'the recipient is told it is not a friend');
    assert.equal(await unread(b), 1);

    await call(`/owlpost/messages/${(await thread(a, b)).body.messages[0].id}`, { method: 'DELETE', token: a.token });
    assert.equal((await send(a, b, 'Trying again')).body.error, 'awaiting_reply', 'tidying up does not reset the allowance');

    assert.equal((await send(b, a, 'Sure, when?')).status, 201, 'the recipient may always answer');
    assert.equal((await send(a, b, 'Friday')).status, 201, 'and then the conversation is open');
  });

  await t.test('friends only turns strangers away, plainly, and still allows friends and old conversations', async () => {
    const [a, b] = await friends();
    const stranger = await newPlayer();
    await call('/owlpost/settings', { method: 'PATCH', token: b.token, body: json({ mode: 'friends' }) });

    const turned = await send(stranger, b, 'hello');
    assert.equal(turned.status, 403);
    assert.equal(turned.body.error, 'not_accepting_owls');
    assert.equal((await send(a, b, 'hello friend')).status, 201);

    // A conversation that already exists stays readable, even once the setting has moved on.
    const c = await newPlayer();
    assert.equal((await send(c, a, 'before the setting changed')).status, 201);
    await call('/owlpost/settings', { method: 'PATCH', token: a.token, body: json({ mode: 'friends' }) });
    assert.equal((await thread(a, c)).status, 200);
    assert.equal((await send(c, a, 'and again')).body.error, 'not_accepting_owls', 'but they cannot add to it');
  });

  await t.test('a player cannot start new owls to many strangers in a day', async () => {
    const a = await newPlayer();
    let last;
    for (let i = 0; i < 11; i += 1) last = await send(a, await newPlayer(), 'hello');
    assert.equal(last.status, 429);
    assert.equal(last.body.error, 'too_many_new_contacts');
  });

  await t.test('blocking still ends it, the same 404 whoever blocked whom', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    await send(a, b, 'first');
    await call('/blocks', { method: 'POST', token: b.token, body: json({ username: a.username }) });
    assert.equal((await send(a, b, 'again')).status, 404);
    assert.equal((await thread(b, a)).status, 404);
    assert.equal(await unread(b), 0, 'and a blocked player\u2019s owls are not counted');
  });

  await t.test('a new owl reaches the recipient live, and only the recipient', async (t) => {
    const [a, b] = await friends();
    const sa = await connectSocket(a);
    const sb = await connectSocket(b);
    t.after(() => {
      sa.close();
      sb.close();
    });
    await send(a, b, 'live delivery');
    await settle();
    const got = sb.frames.find((f) => f.type === 'owlpost:message');
    assert.equal(got.message.body, 'live delivery');
    assert.equal(got.message.from_username, a.username);
    assert.equal(sa.frames.filter((f) => f.type === 'owlpost:message').length, 0);
  });

  await t.test('ordering and unread counts follow the newest conversation', async () => {
    const me = await newPlayer();
    const first = await newPlayer();
    const second = await newPlayer();
    await befriend(me, first);
    await befriend(me, second);
    await send(first, me, 'one');
    await send(first, me, 'two');
    await send(second, me, 'three');
    const box = await inbox(me);
    assert.deepEqual(box.map((c) => c.username), [second.username, first.username]);
    assert.deepEqual(box.map((c) => c.unread), [1, 2]);
    assert.equal(await unread(me), 3);
  });

  await t.test('messages are removed after the retention period, and not before', async () => {
    const [a, b] = await friends();
    const old = await pool.query(
      `INSERT INTO messages (sender_id, recipient_id, body, created_at) VALUES ($1, $2, 'old', now() - interval '100 days') RETURNING id`,
      [a.id, b.id],
    );
    const recent = await pool.query(
      `INSERT INTO messages (sender_id, recipient_id, body, created_at) VALUES ($1, $2, 'recent', now() - interval '80 days') RETURNING id`,
      [a.id, b.id],
    );
    const { sweepOldMessages } = await import('../src/services/owlPost.js');
    await sweepOldMessages();
    const left = (await pool.query('SELECT id FROM messages WHERE id = ANY($1)', [[old.rows[0].id, recent.rows[0].id]])).rows;
    assert.deepEqual(left.map((r) => r.id), [recent.rows[0].id]);
  });

  await t.test('deleting an account takes its messages with it, both ways', async () => {
    const [a, b] = await friends();
    await send(a, b, 'from the leaver');
    await send(b, a, 'to the leaver');
    await call('/account', { method: 'DELETE', token: a.token, body: json({ password: 'password123' }) });
    const { rows } = await pool.query('SELECT count(*) FROM messages WHERE sender_id = $1 OR recipient_id = $1', [a.id]);
    assert.equal(Number(rows[0].count), 0);
    assert.deepEqual(await inbox(b), []);
  });

  await t.test('a report made from a conversation carries its recent messages, and only if asked', async () => {
    const admin = await newPlayer();
    await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [admin.id]);
    const [reporter, abuser] = await friends();
    for (let i = 1; i <= 25; i++) {
      await pool.query('INSERT INTO messages (sender_id, recipient_id, body) VALUES ($1, $2, $3)', [i % 2 ? abuser.id : reporter.id, i % 2 ? reporter.id : abuser.id, `line ${i}`]);
    }
    await pool.query(`UPDATE messages SET deleted_by_recipient = true WHERE body = 'line 25'`);

    const report = (as, who, body) => call('/reports', { method: 'POST', token: as.token, body: json({ username: who.username, reason: 'harassment', ...body }) });
    const queued = async (who) => (await call('/reports', { token: admin.token })).body.reports.find((r) => r.reported_username === who.username);

    assert.equal((await report(reporter, abuser, {})).status, 201);
    assert.equal((await queued(abuser)).evidence, null, 'nothing is attached unless the reporter asks');
    await call(`/reports/${(await queued(abuser)).id}/resolve`, { method: 'POST', token: admin.token, body: json({ outcome: 'dismissed' }) });

    assert.equal((await report(reporter, abuser, { include_messages: true })).status, 201);
    const evidence = (await queued(abuser)).evidence;
    assert.equal(evidence.length, 20, 'the last twenty');
    assert.equal(evidence[0].body, 'line 6');
    assert.equal(evidence.at(-1).body, 'line 25', 'including what the reporter had deleted for themselves');
    assert.equal(evidence.at(-1).sender_username, abuser.username);

    const stranger = await newPlayer();
    const lonely = await newPlayer();
    await report(stranger, lonely, { include_messages: true });
    assert.equal((await queued(lonely)).evidence, null, 'no conversation, nothing to attach');
  });

  await t.test('a moderator can mute a player, and lifting it lets them write again', async () => {
    const admin = await newPlayer();
    await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [admin.id]);
    const [reporter, abuser] = await friends();
    await call('/reports', { method: 'POST', token: reporter.token, body: json({ username: abuser.username, reason: 'harassment' }) });
    const entry = (await call('/reports', { token: admin.token })).body.reports.find((r) => r.reported_username === abuser.username);

    const bad = await call(`/reports/${entry.id}/action`, { method: 'POST', token: admin.token, body: json({ actions: ['mute'], note: 'You may not write for a while.' }) });
    assert.equal(bad.body.error, 'invalid_days', 'a mute has a length');

    const res = await call(`/reports/${entry.id}/action`, {
      method: 'POST',
      token: admin.token,
      body: json({ actions: ['mute', 'warn'], days: 7, note: 'You may not write to other players for a week.' }),
    });
    assert.equal(res.body.resolution, 'Muted 7 days; warned');
    assert.equal((await send(abuser, reporter, 'one more')).body.error, 'owl_post_muted');
    assert.equal((await call('/auth/me', { token: abuser.token })).status, 200, 'but not locked out of anything else');

    const log = (await call('/moderation/actions', { token: admin.token })).body.actions.find((a) => a.action === 'mute' && a.username === abuser.username);
    assert.equal(log.active, true);
    assert.equal(log.days, 7);
    assert.equal((await call(`/moderation/actions/${log.id}/lift`, { method: 'POST', token: admin.token })).status, 204);
    assert.equal((await send(abuser, reporter, 'sorry')).status, 201);
  });
});
