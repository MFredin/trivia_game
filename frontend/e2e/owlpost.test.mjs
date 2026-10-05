import test from 'node:test';
import assert from 'node:assert/strict';
import { openSection, launch, navigateTo, openPage, register, BASE_URL } from './harness.mjs';

const origin = new URL(BASE_URL).origin;

// From inside a page, as that player: the browser holds their token.
const asPlayer = (page, path, method = 'GET', body) =>
  page.evaluate(
    async ({ origin, path, method, body }) => {
      const token = localStorage.getItem('trivia_auth_token');
      const res = await fetch(`${origin}/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      return res.status;
    },
    { origin, path, method, body },
  );

test('owl post: two friends write to each other', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const a = (await openPage(browser)).page;
  const b = (await openPage(browser)).page;
  const nameA = await register(a);
  const nameB = await register(b);

  // Friends first: Owl Post is for friends only.
  assert.equal(await asPlayer(a, '/friends', 'POST', { username: nameB }), 201);
  assert.equal(await asPlayer(b, `/friends/requests/${nameA}/accept`, 'POST'), 200);
  await a.reload({ waitUntil: 'networkidle' });
  await b.reload({ waitUntil: 'networkidle' });

  await t.test('a friend row offers to send an owl, and the first one goes through', async () => {
    await navigateTo(a, 'Community');
    await a.getByRole('button', { name: 'Send an owl' }).first().click();
    await a.getByLabel(/Your owl to/).fill('Good luck in the duel!');
    await a.getByRole('button', { name: 'Send', exact: true }).click();
    await a.locator('.owl-bubble', { hasText: 'Good luck in the duel!' }).waitFor();
  });

  await t.test('the same rules as a bio keep links out, and say why', async () => {
    await a.getByLabel(/Your owl to/).fill('find me at www.example.com');
    await a.getByRole('button', { name: 'Send', exact: true }).click();
    await a.getByText(/cannot carry links/i).waitFor();
    assert.equal(await a.locator('.owl-bubble', { hasText: 'www.example.com' }).count(), 0, 'and it was not sent');
  });

  await t.test('it reaches the other player with a badge, and reading it clears the badge', async () => {
    await b.getByRole('button', { name: 'Owl Post, 1 unread' }).waitFor({ timeout: 20000 });
    await navigateTo(b, 'Owl Post');
    await b.getByRole('button', { name: new RegExp(nameA) }).click();
    await b.locator('.owl-bubble', { hasText: 'Good luck in the duel!' }).waitFor();
    await b.getByRole('button', { name: 'Owl Post', exact: true }).waitFor({ timeout: 10000 });
  });

  await t.test('a reply arrives in an open conversation without a reload', async () => {
    await b.getByLabel(/Your owl to/).fill('Thanks, you too!');
    await b.getByRole('button', { name: 'Send', exact: true }).click();
    await a.locator('.owl-bubble', { hasText: 'Thanks, you too!' }).waitFor({ timeout: 15000 });
  });

  await t.test('a conversation can be reported with its recent messages attached', async () => {
    await b.getByRole('button', { name: 'More actions' }).click();
    await b.getByRole('menuitem', { name: 'Report' }).click();
    const dialog = b.getByRole('dialog');
    await dialog.getByLabel('Harassment or abuse').check();
    assert.match(await dialog.textContent(), /last 20 owls/);
    assert.equal(await dialog.getByLabel('Include the recent messages').isChecked(), true, 'on by default');
    await dialog.getByRole('button', { name: 'Send report' }).click();
    await dialog.getByText('Report Sent').waitFor();
    await dialog.getByRole('button', { name: 'Done' }).click();
  });

  await t.test('switching Owl Post off stops it from the other side, and says so', async () => {
    await navigateTo(b, 'Settings');
    await openSection(b, 'Privacy');
    await b.locator('#owl-post-off').check();
    await a.getByLabel(/Your owl to/).fill('Are you there?');
    await a.getByRole('button', { name: 'Send', exact: true }).click();
    await a.getByText(/not accepting owls from you/i).waitFor();
  });
});

test('owl post: a new owl can be composed from an empty inbox, to a friend or a stranger', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const c = (await openPage(browser)).page;
  const d = (await openPage(browser)).page;
  const nameC = await register(c);
  const nameD = await register(d);
  assert.equal(await asPlayer(c, '/friends', 'POST', { username: nameD }), 201);
  assert.equal(await asPlayer(d, `/friends/requests/${nameC}/accept`, 'POST'), 200);
  await c.reload({ waitUntil: 'networkidle' });

  await t.test('an empty inbox says what Owl Post is and offers to send the first owl', async () => {
    await navigateTo(c, 'Owl Post');
    await c.getByText('Nothing in your owlery yet').waitFor();
    await c.getByRole('button', { name: 'Send an owl' }).first().click();
    await c.getByRole('heading', { name: 'Send an owl' }).waitFor();
  });

  await t.test('a name no one has is refused in words', async () => {
    await c.getByLabel('To', { exact: true }).fill('nobodyatall');
    await c.getByLabel('Message').fill('Hello?');
    await c.getByRole('button', { name: 'Send', exact: true }).click();
    await c.getByText('There is no player by that name.').waitFor();
  });

  await t.test('a friend, a subject and a message go through, and the conversation opens', async () => {
    await c.getByLabel('To', { exact: true }).fill(nameD.toUpperCase());
    await c.getByLabel(/Subject/).fill('Duel night');
    await c.getByLabel('Message').fill('Are you free on Friday?');
    await c.getByRole('button', { name: 'Send', exact: true }).click();
    await c.locator('.owl-bubble', { hasText: 'Are you free on Friday?' }).waitFor();
    await c.locator('.owl-bubble-subject', { hasText: 'Duel night' }).waitFor();
  });

  await t.test('the subject is filtered like the message', async () => {
    await navigateTo(c, 'Owl Post');
    await c.getByRole('button', { name: 'Send an owl' }).first().click();
    await c.getByLabel('To', { exact: true }).fill(nameD);
    await c.getByLabel(/Subject/).fill('mail me at a@b.co');
    await c.getByLabel('Message').fill('Hello again');
    await c.getByRole('button', { name: 'Send', exact: true }).click();
    await c.getByText(/subject cannot hold links/i).waitFor();
  });

  await t.test('the friend sees the subject in their inbox', async () => {
    await d.getByRole('button', { name: /Owl Post/ }).waitFor();
    await navigateTo(d, 'Owl Post');
    await d.locator('.owl-row-subject', { hasText: 'Duel night' }).waitFor({ timeout: 15000 });
  });
});

test('owl post: open to anyone by default, with a stranger held to one owl until they answer', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const e = (await openPage(browser)).page;
  const f = (await openPage(browser)).page;
  const nameE = await register(e);
  const nameF = await register(f);

  await t.test('a stranger can be written to, and the conversation says they are not friends', async () => {
    await navigateTo(e, 'Owl Post');
    await e.getByRole('button', { name: 'Send an owl' }).first().click();
    await e.getByLabel('To', { exact: true }).fill(nameF);
    await e.getByLabel('Message').fill('Fancy a duel this evening?');
    await e.getByRole('button', { name: 'Send', exact: true }).click();
    await e.locator('.owl-bubble', { hasText: 'Fancy a duel this evening?' }).waitFor();
    await e.getByText(/are not friends/).waitFor();
  });

  await t.test('and has to wait for an answer before writing again', async () => {
    await e.getByText(/You can write again once they answer/).waitFor();
    assert.equal(await e.getByLabel(/Your owl to/).count(), 0, 'there is no reply box to use');
  });

  await t.test('the other player sees the stranger marked as one, and answering opens it up', async () => {
    await navigateTo(f, 'Owl Post');
    await f.locator('.owl-row-tag', { hasText: 'Not a friend' }).waitFor({ timeout: 15000 });
    await f.getByRole('button', { name: new RegExp(nameE) }).click();
    await f.getByLabel(/Your owl to/).fill('Yes, 8 o\u2019clock');
    await f.getByRole('button', { name: 'Send', exact: true }).click();
    await e.locator('.owl-bubble', { hasText: 'Yes, 8 o\u2019clock' }).waitFor({ timeout: 15000 });
    await e.getByLabel(/Your owl to/).waitFor();
  });
});
