import test from 'node:test';
import assert from 'node:assert/strict';
import { launch, navigateTo, openPage, register } from './harness.mjs';

// One registration for the whole file: sign-ups are limited to ten per IP per quarter hour and
// the rest of the suite already uses most of them. Everything that needs a second player
// (blocking, reporting, friends lists) is covered against the real API in backend/test/.
test('your own corner: avatar, privacy, password, deleting the account', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page, problems } = await openPage(browser);
  const username = await register(page);

  await t.test('Settings, your profile and Log out are behind the avatar menu', async () => {
    await page.getByRole('button', { name: 'Account menu' }).click();
    for (const name of ['My profile', 'Settings', 'Log out']) {
      assert.equal(await page.getByRole('menuitem', { name }).count(), 1, name);
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('menuitem').count(), 0, 'Escape closes it');
    assert.equal(await page.locator('.running-nav button', { hasText: /^Settings$/ }).count(), 0, 'and no longer a link');
  });

  await t.test('picking a sigil changes the avatar everywhere', async () => {
    await navigateTo(page, 'Settings');
    const initialBefore = await page.locator('.account-trigger .avatar-initial').count();
    assert.equal(initialBefore, 1, 'a new account wears its initial');

    await page.getByRole('button', { name: 'Key', exact: true }).click();
    await page.waitForSelector('.account-trigger svg');
    assert.equal(await page.locator('.account-trigger .avatar-initial').count(), 0, 'the nav now shows the sigil');
    assert.equal(await page.getByRole('button', { name: 'Key', exact: true }).getAttribute('aria-pressed'), 'true');
  });

  await t.test('the friends list defaults to friends-only, and can be changed', async () => {
    assert.equal(await page.getByLabel('Friends only').isChecked(), true);
    await page.getByLabel('Only me').check();
    await navigateTo(page, 'My profile');
    await page.waitForSelector('.profile-friends-privacy');
    assert.match(await page.textContent('.profile-friends-privacy'), /only you/i);
    assert.match(await page.textContent('.profile-head'), new RegExp(`Member since`));
  });

  await t.test('a password change needs the current password', async () => {
    await navigateTo(page, 'Settings');
    await page.getByLabel('Current password').fill('not-the-password');
    await page.getByLabel('New password', { exact: true }).fill('a-better-password');
    await page.getByLabel('New password again').fill('a-better-password');
    await page.getByRole('button', { name: 'Change password' }).click();
    await page.waitForSelector('.error-banner');
    assert.match(await page.textContent('.error-banner'), /not your current password/i);

    await page.getByLabel('Current password').fill('password123');
    await page.getByRole('button', { name: 'Change password' }).click();
    await page.getByText('Password changed.').waitFor();
  });

  await t.test('deleting the account asks for the name and the password, then signs out', async () => {
    await page.getByRole('button', { name: 'Delete my account' }).first().click();
    const confirm = page.getByRole('dialog').getByRole('button', { name: 'Delete my account' });
    assert.equal(await confirm.isDisabled(), true, 'nothing happens until the name and password are given');

    await page.getByRole('dialog').getByLabel(/^Type/).fill(username);
    await page.getByRole('dialog').getByLabel('Your password').fill('a-better-password');
    assert.equal(await confirm.isDisabled(), false);
    await confirm.click();

    await page.waitForSelector('text=Your account has been deleted.');
    assert.equal(await page.evaluate(() => localStorage.getItem('trivia_auth_token')), null, 'the token is gone');
    assert.equal(await page.locator('input[type=email]').count(), 1, 'back at the login screen');
  });

  // Anything the browser complained about that this test did not provoke on purpose: a wrong
  // current password is meant to be refused (400), and once the account is gone 401s are the
  // point. Chromium logs each failed request twice — once as the response, once to the console.
  const provoked = [/http 400 PATCH .*\/account\/password/, /http 401 /, /status of 40[01]/];
  assert.deepEqual(
    problems.filter((p) => !provoked.some((re) => re.test(p))),
    [],
    'a clean console',
  );
});
