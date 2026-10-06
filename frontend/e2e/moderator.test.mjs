import test from 'node:test';
import assert from 'node:assert/strict';
import { launch, navigateTo, openPage, register, BASE_URL } from './harness.mjs';

// Promoting an admin has no route by design, so this does it in the database. Skipped without one.
const SKIP = !process.env.DATABASE_URL && 'DATABASE_URL not set';

test('a moderator works the reports within limits, and sends the rest to an admin', { skip: SKIP }, async (t) => {
  const { default: pg } = await import('../../backend/node_modules/pg/lib/index.js');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  t.after(() => pool.end());
  const browser = await launch();
  t.after(() => browser.close());

  const adminPage = (await openPage(browser)).page;
  const modPage = (await openPage(browser)).page;
  const reporterPage = (await openPage(browser)).page;
  const targetPage = (await openPage(browser)).page;
  const adminName = await register(adminPage);
  const modName = await register(modPage);
  await register(reporterPage);
  const targetName = await register(targetPage);
  await pool.query('UPDATE users SET is_admin = true WHERE username = $1', [adminName]);
  await adminPage.reload({ waitUntil: 'networkidle' });

  await t.test('an admin makes a moderator from the Team screen', async () => {
    await navigateTo(adminPage, 'Manage team');
    await adminPage.getByLabel('Player name').fill(modName);
    await adminPage.getByRole('button', { name: 'Make a moderator' }).click();
    await adminPage.getByText(`${modName} is a moderator.`).waitFor();
    await adminPage.locator('.friend-name', { hasText: modName }).getByText('Moderator').waitFor();
  });

  await t.test('their menu has the reports and none of the admin screens', async () => {
    await modPage.reload({ waitUntil: 'networkidle' });
    await modPage.getByRole('button', { name: 'Account menu' }).click();
    await modPage.getByRole('menuitem', { name: 'Review reports' }).waitFor();
    for (const name of ['Review questions', 'Manage titles', 'Manage team']) {
      assert.equal(await modPage.getByRole('menuitem', { name }).count(), 0, name);
    }
    await modPage.keyboard.press('Escape');
  });

  // Three earlier actioned reports make a ban the ladder's next step.
  const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [targetName]);
  for (let i = 0; i < 3; i += 1) {
    await pool.query(
      `INSERT INTO reports (reporter_id, reported_id, reason, status, reviewed_at, resolution)
       SELECT id, $1, 'harassment', 'actioned', now(), 'Warned' FROM users WHERE username = $2`,
      [rows[0].id, adminName],
    );
  }
  const origin = new URL(BASE_URL).origin;
  await reporterPage.evaluate(
    async ({ origin, name }) => {
      const token = localStorage.getItem('trivia_auth_token');
      await fetch(`${origin}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: name, reason: 'harassment' }),
      });
    },
    { origin, name: targetName },
  );

  const openReports = async (page) => {
    await navigateTo(page, 'Review reports');
    const row = page.locator('.report-row', { hasText: targetName });
    await row.waitFor();
    return row;
  };

  await t.test('a moderator is not offered a ban, and is told what the usual step would be', async () => {
    const row = await openReports(modPage);
    await row.getByText(/more than a moderator can apply/).waitFor();
    await row.getByRole('button', { name: 'Take action…' }).click();
    const dialog = modPage.getByRole('dialog');
    await dialog.getByRole('checkbox', { name: /^Suspend/ }).check();
    assert.equal(await dialog.getByRole('checkbox', { name: /^Ban/ }).count(), 0, 'no ban to tick');
    assert.deepEqual(await dialog.locator('#suspend-days option').allTextContents(), ['1 day', '7 days']);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });

  await t.test('they send it to an admin, with a note', async () => {
    const row = modPage.locator('.report-row', { hasText: targetName });
    await row.getByRole('button', { name: 'Send to an admin…' }).click();
    await modPage.getByLabel(/Why/).fill('Fourth report in six months; I think this needs a ban.');
    await modPage.getByRole('button', { name: 'Send to an admin', exact: true }).click();
    await row.getByText(/Sent to an admin/).waitFor();
    assert.equal(await row.getByRole('button', { name: 'Send to an admin…' }).count(), 0, 'not twice');
  });

  await t.test('the admin sees it, with who sent it and why, and can ban', async () => {
    const row = await openReports(adminPage);
    await row.getByText(/Sent to an admin/).waitFor();
    assert.match(await row.textContent(), /needs a ban/);
    await row.getByRole('button', { name: 'Take action…' }).click();
    const dialog = adminPage.getByRole('dialog');
    await dialog.getByRole('checkbox', { name: /^Ban/ }).waitFor();
    assert.equal(await dialog.getByRole('checkbox', { name: /^Ban/ }).isChecked(), true, 'the suggestion is the ban');
  });
});
