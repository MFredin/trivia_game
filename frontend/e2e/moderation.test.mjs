import test from 'node:test';
import assert from 'node:assert/strict';
import { launch, navigateTo, openPage, register, BASE_URL } from './harness.mjs';

// Promoting an admin has no route by design (see schema.sql), so this test does it the way an
// operator would: in the database. Skipped where there is no DATABASE_URL to do it with.
const SKIP = !process.env.DATABASE_URL && 'DATABASE_URL not set';

const NOTE = 'Your username broke the house rules, so it was changed. Please choose another.';

test('a report ends in an action the player is told about', { skip: SKIP }, async (t) => {
  const { default: pg } = await import('../../backend/node_modules/pg/lib/index.js');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  t.after(() => pool.end());

  const browser = await launch();
  t.after(() => browser.close());
  const targetPage = (await openPage(browser)).page;
  const reporterPage = (await openPage(browser)).page;
  const adminPage = (await openPage(browser)).page;

  const targetName = await register(targetPage);
  await register(reporterPage);
  const adminName = await register(adminPage);
  await pool.query('UPDATE users SET is_admin = true WHERE username = $1', [adminName]);
  await adminPage.reload({ waitUntil: 'networkidle' });

  const apiOrigin = new URL(BASE_URL).origin;
  const report = (reason) =>
    reporterPage.evaluate(
      async ({ origin, name, why }) => {
        const token = localStorage.getItem('trivia_auth_token');
        const res = await fetch(`${origin}/api/reports`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ username: name, reason: why }),
        });
        return res.status;
      },
      { origin: apiOrigin, name: targetName, why: reason },
    );

  async function openAction() {
    await adminPage.getByRole('button', { name: 'Account menu' }).click();
    await adminPage.getByRole('menuitem', { name: 'Review reports' }).click();
    const row = adminPage.locator('.report-row', { hasText: targetName });
    await row.waitFor();
    await row.getByRole('button', { name: 'Take action…' }).click();
    return adminPage.getByRole('dialog');
  }

  await t.test('the reports screen says what each action does, and suggests one', async () => {
    assert.equal(await report('offensive_name'), 201);
    const dialog = await openAction();
    assert.match(await dialog.textContent(), /Sends them a notice they have to acknowledge/);
    assert.match(await dialog.textContent(), /Locks them out until a moderator lifts it/);
    assert.equal(await dialog.getByLabel(/^Warn/).isChecked(), true, 'the first step on the ladder is ticked');
    assert.match(await adminPage.locator('.modal-plate').textContent(), /Suggested/);
  });

  await t.test('warning and renaming tells the player, and they have to act on it', async () => {
    const dialog = adminPage.getByRole('dialog');
    await dialog.getByLabel(/^Force rename/).check();
    await dialog.getByLabel('What the player will be told').fill(NOTE);
    await dialog.getByRole('button', { name: /^Apply: Warn \+ Force rename/ }).click();
    await adminPage.waitForSelector('[role=dialog]', { state: 'detached' });

    await targetPage.reload({ waitUntil: 'networkidle' });
    const notice = targetPage.getByRole('dialog');
    await notice.getByText(NOTE).waitFor();
    await targetPage.keyboard.press('Escape');
    assert.equal(await targetPage.getByRole('dialog').count(), 1, 'a notice cannot be dismissed without acknowledging it');
    await notice.getByRole('button', { name: 'I understand' }).click();

    const rename = targetPage.getByRole('dialog');
    await rename.getByText('Your name was changed').waitFor();
    await rename.getByLabel('New name').fill(`fresh${Math.random().toString(36).slice(2, 8)}`);
    await rename.getByRole('button', { name: 'Use this name' }).click();
    await targetPage.waitForSelector('[role=dialog]', { state: 'detached' });
  });

  await t.test('a suspension turns the player away with the reason, and lifting it lets them back in', async () => {
    // The player has a new name now; look the report up by what the reporter still sees.
    const newName = await targetPage.evaluate(() =>
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${localStorage.getItem('trivia_auth_token')}` } })
        .then((r) => r.json())
        .then((d) => d.user.username),
    );
    await reporterPage.evaluate(
      async ({ origin, name }) => {
        const token = localStorage.getItem('trivia_auth_token');
        await fetch(`${origin}/api/reports`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ username: name, reason: 'harassment' }),
        });
      },
      { origin: apiOrigin, name: newName },
    );

    // The screen is still open from the first report; new ones arrive on Refresh.
    await adminPage.getByRole('button', { name: 'Refresh' }).click();
    const row = adminPage.locator('.report-row', { hasText: newName });
    await row.waitFor();
    assert.match(await row.textContent(), /1 earlier action/, 'the earlier action is on the record');
    await row.getByRole('button', { name: 'Take action…' }).click();

    const dialog = adminPage.getByRole('dialog');
    // Harassment's step after a warning is a mute: the player keeps playing but cannot write to anyone.
    assert.equal(await dialog.getByRole('checkbox', { name: /^Mute/ }).isChecked(), true, 'a repeat is suggested a mute');
    // This moderator wants more than that.
    await dialog.getByRole('checkbox', { name: /^Mute/ }).uncheck();
    await dialog.getByRole('checkbox', { name: /^Suspend/ }).check();
    await dialog.locator('#suspend-days').selectOption('1');
    await dialog.getByLabel('What the player will be told').fill('Suspended for a day for harassing another player.');
    await dialog.getByRole('button', { name: /^Apply: Suspend 1 day/ }).click();
    await adminPage.waitForSelector('[role=dialog]', { state: 'detached' });

    await targetPage.reload({ waitUntil: 'networkidle' });
    await targetPage.getByText(/Your account is suspended until/).waitFor();
    assert.match(await targetPage.textContent('.duel-notice-banner'), /harassing another player/);
    assert.equal(await targetPage.locator('input[type=email]').count(), 1, 'at the login screen, not in the app');

    // Signing in says the same thing, and only to someone who knows the password.
    const signIn = async (password) => {
      await targetPage.locator('input[type=email]').fill(`${targetName}@test.invalid`);
      await targetPage.locator('input[type=password]').fill(password);
      await targetPage.getByRole('button', { name: 'Log in', exact: true }).click();
    };
    await signIn('password123');
    await targetPage.waitForSelector('.error-banner');
    assert.match(await targetPage.textContent('.error-banner'), /suspended until.*harassing another player/);

    await adminPage.getByRole('button', { name: 'Action log' }).click();
    const logRow = adminPage.locator('.report-row', { hasText: newName }).filter({ hasText: 'Suspend' });
    await logRow.waitFor();
    assert.match(await logRow.textContent(), /In force/);
    await logRow.getByRole('button', { name: 'Lift' }).click();
    await adminPage.getByText('Lifted').first().waitFor();

    await signIn('password123');
    await targetPage.waitForSelector('.mode-spine-title', { timeout: 15000 });
  });
});
