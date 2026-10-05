import test from 'node:test';
import assert from 'node:assert/strict';
import { launch, navigateTo, openPage, register } from './harness.mjs';

test('owl post and challenges can each be open, friends only or off', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const me = (await openPage(browser)).page;
  const visitor = (await openPage(browser)).page;
  const myName = await register(me);
  await register(visitor);

  const openProfileOf = async (page, name) => {
    await navigateTo(page, 'Community');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByLabel('Search members by username').fill(name);
    await page.locator('.member-id', { hasText: name }).first().click();
    await page.waitForTimeout(600);
  };
  const setting = async (name, value) => {
    await navigateTo(me, 'Settings');
    await me.locator(`#${name}-${value}`).check();
    await me.waitForTimeout(500);
  };

  await t.test('new accounts are open to both', async () => {
    await navigateTo(me, 'Settings');
    assert.equal(await me.locator('#owl-post-open').isChecked(), true);
    assert.equal(await me.locator('#challenges-open').isChecked(), true);
    await openProfileOf(visitor, myName);
    await visitor.getByRole('button', { name: 'Challenge' }).waitFor();
    await visitor.getByRole('button', { name: 'Send an owl' }).waitFor();
  });

  await t.test('friends only hides both from a stranger', async () => {
    await setting('owl-post', 'friends');
    await setting('challenges', 'friends');
    await openProfileOf(visitor, myName);
    assert.equal(await visitor.getByRole('button', { name: 'Challenge' }).count(), 0);
    assert.equal(await visitor.getByRole('button', { name: 'Send an owl' }).count(), 0);
  });

  await t.test('off removes the Challenge a friend block from your own start screen, and its buttons from lists', async () => {
    await navigateTo(me, 'Home');
    await me.locator('#challenge-length-label').waitFor();
    await setting('challenges', 'off');
    await navigateTo(me, 'Home');
    await me.waitForTimeout(400);
    assert.equal(await me.locator('#challenge-length-label').count(), 0, 'a player who is off cannot make challenge links either');
    await navigateTo(me, 'Community');
    await me.getByRole('button', { name: 'Online Now' }).click();
    assert.equal(await me.getByRole('button', { name: 'Challenge', exact: true }).count(), 0);
  });

  await t.test('and turning it back on brings it back', async () => {
    await setting('challenges', 'open');
    await navigateTo(me, 'Home');
    await me.locator('#challenge-length-label').waitFor();
  });
});
