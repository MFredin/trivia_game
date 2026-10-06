import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_URL, launch, navigateTo, openPage, register } from './harness.mjs';

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

// A bug that reached a player: the fix that kept the account menu on screen on a narrow phone gave the account
// controls `margin-left: auto`. On a wide screen that splits the free space with the wordmark's own auto margin, so the
// page links floated to the middle of the header instead of sitting beside the envelope and the avatar.
//
// The header's layout on a wide screen: the wordmark at the left, then the links and the account controls together at
// the right, the links ending one ordinary gap before the envelope.
test('on a wide screen the page links sit beside the account controls, not adrift in the middle', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const setup = (await openPage(browser)).page;
  await register(setup);
  const token = await setup.evaluate(() => localStorage.getItem('trivia_auth_token'));
  await setup.close();

  for (const width of [1024, 1280, 1440, 1920]) {
    await t.test(`${width}px wide`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      await context.addInitScript((tkn) => localStorage.setItem('trivia_auth_token', tkn), token);
      const page = await context.newPage();
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await page.waitForSelector('.running-nav');

      const box = await page.evaluate(() => {
        const rect = (sel) => document.querySelector(sel).getBoundingClientRect();
        const title = rect('.running-title');
        const nav = rect('.running-nav');
        const account = rect('.running-account');
        return { titleRight: title.right, navLeft: nav.left, navRight: nav.right, accountLeft: account.left };
      });
      const gap = box.accountLeft - box.navRight;
      assert.ok(gap >= 0 && gap < 40, `the links end ${Math.round(gap)}px before the account controls; they should sit beside them`);
      assert.ok(box.navLeft - box.titleRight > 40, 'the wordmark is at the left, with the links well clear of it');
      await context.close();
    });
  }
});
