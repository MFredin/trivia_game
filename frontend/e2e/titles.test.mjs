import test from 'node:test';
import assert from 'node:assert/strict';
import { openSection, launch, navigateTo, openPage, register } from './harness.mjs';

// Promoting an admin and unlocking an achievement have no route by design, so this does them the way an
// operator would: in the database. Skipped where there is no DATABASE_URL to do it with.
const SKIP = !process.env.DATABASE_URL && 'DATABASE_URL not set';

test('titles: earned ones are worn from Edit Profile, system ones are given by an admin', { skip: SKIP }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const player = (await openPage(browser)).page;
  const playerName = await register(player);
  const admin = (await openPage(browser)).page;
  const adminName = await register(admin);

  const { default: pg } = await import('../../backend/node_modules/pg/lib/index.js');
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  t.after(() => db.end());
  await db.query('UPDATE users SET is_admin = true WHERE username = $1', [adminName]);
  await db.query(
    `INSERT INTO user_achievements (user_id, achievement_id) SELECT id, 'milestone_1' FROM users WHERE username = $1 ON CONFLICT DO NOTHING`,
    [playerName],
  );
  await player.reload({ waitUntil: 'networkidle' });
  await admin.reload({ waitUntil: 'networkidle' });

  await t.test('a title you have earned can be picked, saved and shows on your profile; the rest say what they take', async () => {
    await navigateTo(player, 'Edit profile');
    await openSection(player, 'Title');
    await player.getByText('Your Title').waitFor();
    await player.getByLabel(/^Newcomer/).check();
    await player.getByRole('button', { name: 'Save changes' }).click();
    await player.getByText('Saved.').waitFor();
    await player.getByText(/Titles still to earn/).click();
    await player.getByText(/Complete 10 runs/).first().waitFor();

    await navigateTo(player, 'My profile');
    await player.locator('.player-title--profile', { hasText: 'Newcomer' }).waitFor();
  });

  await t.test('a system title is not on offer until an admin gives it', async () => {
    await navigateTo(player, 'Edit profile');
    await openSection(player, 'Title');
    assert.equal(await player.getByLabel(/^Prefect/).count(), 0);
  });

  await t.test('an admin gives a Prefect title, and the player can then wear it', async () => {
    await navigateTo(admin, 'Manage titles');
    await admin.getByLabel('Player name').fill(playerName);
    await admin.getByLabel('Title', { exact: true }).selectOption('prefect');
    await admin.getByRole('button', { name: 'Grant' }).click();
    await admin.getByText('Granted.').waitFor();
    await admin.locator('.friend-name', { hasText: playerName }).waitFor();

    await player.reload({ waitUntil: 'networkidle' });
    await navigateTo(player, 'Edit profile');
    await openSection(player, 'Title');
    await player.getByLabel(/^Prefect/).check();
    await player.getByRole('button', { name: 'Save changes' }).click();
    await player.getByText('Saved.').waitFor();
    await navigateTo(player, 'My profile');
    await player.locator('.player-title--system', { hasText: 'Prefect' }).waitFor();
  });

  await t.test('another player sees it beside the name in a list', async () => {
    await navigateTo(admin, 'Community');
    await admin.getByRole('button', { name: 'Search', exact: true }).click();
    await admin.getByLabel('Search members by username').fill(playerName);
    await admin.locator('.member-meta .player-title', { hasText: 'Prefect' }).waitFor();
  });

  await t.test('taking it back takes it off them', async () => {
    await navigateTo(admin, 'Manage titles');
    await admin.getByRole('button', { name: 'Take back' }).first().click();
    await admin.getByText('Taken back.').waitFor();
    await player.reload({ waitUntil: 'networkidle' });
    await navigateTo(player, 'My profile');
    await player.waitForTimeout(600);
    assert.equal(await player.locator('.player-title--system').count(), 0);
  });
});
