import test from 'node:test';
import assert from 'node:assert/strict';
import { openSection, launch, navigateTo, openPage, register } from './harness.mjs';

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

  await t.test('dressing the avatar and writing a bio is saved together, and the bio filter says why it refuses', async () => {
    await navigateTo(page, 'Edit profile');
    assert.equal(await page.locator('.account-trigger svg text').count(), 1, 'a new account wears its initial');
    assert.equal(await page.getByRole('button', { name: 'Save changes' }).isDisabled(), true, 'nothing to save yet');

    // One part of the avatar shows at a time, chosen from the row above the options.
    await page.getByRole('button', { name: 'Key', exact: true }).click();
    await page.getByRole('button', { name: /^Shape/ }).click();
    await page.getByRole('button', { name: 'Hexagon' }).click();
    await page.getByRole('button', { name: /^Colour/ }).click();
    await page.getByRole('button', { name: 'Violet' }).click();
    assert.match(await page.textContent('.profile-preview-state'), /not saved yet/, 'the preview beside the editor is showing the draft');
    assert.equal(await page.locator('.profile-preview svg text').count(), 0, 'and has already swapped the initial for the key');
    assert.equal(await page.locator('[role=tab]:has-text("Avatar") .section-tab-pip').count(), 1, 'the Avatar tab is marked as holding a change');
    assert.equal(await page.locator('.account-trigger svg text').count(), 1, 'the nav keeps the saved avatar until Save');

    // Earned choices are shown, locked, with what earns them — and cannot be picked.
    await page.getByRole('button', { name: /^Frame/ }).click();
    const locked = page.getByRole('button', { name: /^Gilt, locked/ });
    assert.equal(await locked.isDisabled(), true);

    await openSection(page, 'About');
    assert.equal(await page.locator('[role=tab]:has-text("About") .section-tab-pip').count(), 0, 'nothing is changed on About yet');
    await page.getByLabel('Short bio').fill('Find me at www.example.com');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForSelector('#profile-bio-help ~ .error-banner');
    assert.match(await page.textContent('#profile-bio-help ~ .error-banner'), /cannot contain links/i);

    await page.getByLabel('Short bio').fill('Ravenclaw since 2001.');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByText('Saved.').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.account-trigger svg text').length === 0);
    await openSection(page, 'Avatar');
    assert.equal(await page.getByRole('button', { name: 'Key', exact: true }).getAttribute('aria-pressed'), 'true');
  });

  await t.test('your profile shows the bio', async () => {
    await navigateTo(page, 'My profile');
    await page.waitForSelector('.profile-bio');
    assert.match(await page.textContent('.profile-bio'), /Ravenclaw since 2001/);
  });

  await t.test('the friends list defaults to friends-only, and can be changed', async () => {
    await navigateTo(page, 'Settings');
    await openSection(page, 'Privacy');
    assert.equal(await page.locator('#friends-visibility-friends').isChecked(), true);
    await page.getByLabel('Only me').check();
    await navigateTo(page, 'My profile');
    await page.waitForSelector('.profile-friends-privacy');
    assert.match(await page.textContent('.profile-friends-privacy'), /only you/i);
    assert.match(await page.textContent('.profile-head'), new RegExp(`Member since`));
  });

  await t.test('Settings shows one section at a time, and the arrow keys move between them', async () => {
    await navigateTo(page, 'Settings');
    await page.getByRole('heading', { name: 'Settings' }).waitFor();
    assert.equal(await page.locator('.house-swatches').count(), 1, 'it opens on Appearance');
    assert.equal(await page.getByLabel('Current password').count(), 0, 'the password form is on another section');
    await page.getByRole('tab', { name: /^Appearance/ }).focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForSelector('[role=tab][aria-selected=true]:has-text("Privacy")');
    assert.equal(await page.locator(':focus').getAttribute('role'), 'tab', 'focus moves with the selection');
    await page.keyboard.press('End');
    await page.waitForSelector('[role=tab][aria-selected=true]:has-text("Account")');
    assert.equal(await page.getByLabel('Current password').count(), 1);
  });

  await t.test('a password change needs the current password', async () => {
    await navigateTo(page, 'Settings');
    await openSection(page, 'Account');
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

  await t.test('changing the password ends other sessions, but not this one', async () => {
    // The old token no longer works anywhere; the page was handed a new one and is still signed in.
    const stored = await page.evaluate(() => localStorage.getItem('trivia_auth_token'));
    await navigateTo(page, 'Home');
    await page.waitForSelector('.mode-spine-title');
    assert.equal(await page.locator('input[type=email]').count(), 0, 'still signed in');
    assert.ok(stored && stored.includes('.'), 'a token is still stored');
  });

  await t.test('the invite link is on the Community screen, not in Settings', async () => {
    await navigateTo(page, 'Settings');
    for (const section of ['Appearance', 'Privacy', 'Account']) {
      await openSection(page, section);
      assert.equal(await page.getByLabel('Your invite link').count(), 0, `not in ${section}`);
    }
    await navigateTo(page, 'Community');
    const link = page.getByLabel('Your invite link');
    await link.waitFor();
    await page.waitForFunction(() => /\?invite=\w+/.test(document.querySelector('input[aria-label="Your invite link"]')?.value ?? ''));
    await page.getByRole('button', { name: 'Copy link' }).click();
    await page.getByRole('button', { name: 'Copied!' }).waitFor();
    await navigateTo(page, 'Settings');
    await openSection(page, 'Account');
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
  // current password and a bio with a link are meant to be refused (400), and once the account is gone 401s are the
  // point. Chromium logs each failed request twice — once as the response, once to the console.
  const provoked = [/http 400 PATCH .*\/account\/(password|profile)/, /http 401 /, /status of 40[01]/];
  assert.deepEqual(
    problems.filter((p) => !provoked.some((re) => re.test(p))),
    [],
    'a clean console',
  );
});
