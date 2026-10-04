import test from 'node:test';
import assert from 'node:assert/strict';
import { launch, navigateTo, openPage, register, BASE_URL } from './harness.mjs';

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
    await navigateTo(a, 'Friends');
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
    await b.locator('#owl-post-off').check();
    await a.getByLabel(/Your owl to/).fill('Are you there?');
    await a.getByRole('button', { name: 'Send', exact: true }).click();
    await a.getByText(/could not be delivered/i).waitFor();
  });
});
