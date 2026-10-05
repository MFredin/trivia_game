import test from 'node:test';
import assert from 'node:assert/strict';
import { launch, navigateTo, openPage, register } from './harness.mjs';

// What the header says is current, by what it announces to assistive tech and so to the eye too:
// the link, the envelope or the avatar carries aria-current, and exactly one of them does.
const current = (page) =>
  page.evaluate(() => {
    const links = [...document.querySelectorAll('.running-nav button[aria-current]')].map((b) => b.textContent.trim());
    const owl = document.querySelector('.owl-link[aria-current]') ? ['Owl Post'] : [];
    const avatar = document.querySelector('.account-trigger[aria-current]') ? ['Account'] : [];
    return [...links, ...owl, ...avatar];
  });

test('the header marks where you are, including on your own profile', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page } = await openPage(browser);
  await register(page);
  const other = (await openPage(browser)).page;
  const otherName = await register(other);

  await t.test('a page link is current on its own screen', async () => {
    assert.deepEqual(await current(page), ['Home']);
    await navigateTo(page, 'Leaderboard');
    assert.deepEqual(await current(page), ['Leaderboard']);
  });

  await t.test('the avatar is current on Edit profile and on My profile, and nothing else is', async () => {
    await navigateTo(page, 'Edit profile');
    assert.deepEqual(await current(page), ['Account']);
    await navigateTo(page, 'My profile');
    assert.deepEqual(await current(page), ['Account'], 'not the screen you were on before');
  });

  await t.test('My profile from a page link does not leave that link lit', async () => {
    await navigateTo(page, 'Community');
    assert.deepEqual(await current(page), ['Community']);
    await navigateTo(page, 'My profile');
    assert.deepEqual(await current(page), ['Account']);
  });

  await t.test('leaving the avatar’s screens clears it', async () => {
    await navigateTo(page, 'Home');
    assert.deepEqual(await current(page), ['Home']);
  });

  await t.test('someone else’s profile keeps lit the tab you came from', async () => {
    await navigateTo(page, 'Community');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByLabel('Search members by username').fill(otherName);
    await page.locator('.member-id', { hasText: otherName }).first().click();
    await page.waitForTimeout(500);
    assert.deepEqual(await current(page), ['Community']);
  });

  await t.test('the envelope is current on Owl Post', async () => {
    await navigateTo(page, 'Owl Post');
    assert.deepEqual(await current(page), ['Owl Post']);
  });
});
