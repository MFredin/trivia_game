import test from 'node:test';
import assert from 'node:assert/strict';
import { answerOne, launch, navigateTo, openPage, register } from './harness.mjs';

// A tournament, played by three real browsers: one makes it, two join by its code, the creator starts it, the two players who
// are drawn against each other play their match through the real screens, and the bracket moves on to a final. With three
// players the top seed has a bye, so there is one match to play.
const openTournaments = async (page) => {
  await navigateTo(page, 'Community');
  await page.getByRole('button', { name: 'Tournaments' }).click();
};

const openByName = async (page, name) => {
  await openTournaments(page);
  await page.locator('.tournament-row', { hasText: name }).getByRole('button', { name: 'Open' }).click();
  await page.locator('.tournament-status').waitFor();
};

test('a tournament is made, joined, started and played through the real screens', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const name = `Cup ${Math.random().toString(36).slice(2, 7)}`;

  const [a, b, c] = await Promise.all([openPage(browser), openPage(browser), openPage(browser)]);
  const pages = [a.page, b.page, c.page];
  for (const page of pages) await register(page);

  let code;
  await t.test('the creator makes one and is shown its code', async () => {
    await openTournaments(a.page);
    await a.page.getByRole('button', { name: 'Make a tournament' }).click();
    await a.page.locator('.tournament-form input[type=text]').fill(name);
    await a.page.getByRole('button', { name: 'Make the tournament' }).click();
    await a.page.locator('.tournament-code').waitFor();
    code = (await a.page.locator('.tournament-code').textContent()).trim();
    assert.match(code, /^[0-9a-f]{8}$/);
    assert.match(await a.page.locator('.tournament-status').textContent(), /Gathering players/);
  });

  await t.test('two others join with the code', async () => {
    for (const page of [b.page, c.page]) {
      await openTournaments(page);
      await page.getByLabel('Tournament code').fill(code);
      await page.getByRole('button', { name: 'Join', exact: true }).click();
      await page.locator('.tournament-status').waitFor();
      assert.match(await page.locator('.tournament-status').textContent(), /Gathering players/);
    }
  });

  await t.test('a wrong code is refused with a message, not a crash', async () => {
    await openTournaments(b.page);
    await b.page.getByLabel('Tournament code').fill('00000000');
    await b.page.getByRole('button', { name: 'Join', exact: true }).click();
    await b.page.locator('.error-banner').waitFor();
    assert.match(await b.page.locator('.error-banner').textContent(), /No tournament with that code/);
  });

  await t.test('the creator starts it, and the bracket is drawn with a bye', async () => {
    await openByName(a.page, name);
    await a.page.getByRole('button', { name: 'Start the tournament' }).click();
    await a.page.locator('.bracket').waitFor();
    assert.match(await a.page.locator('.tournament-status').textContent(), /Round 1 of 2/);
    assert.deepEqual(await a.page.locator('.bracket-round-title').allTextContents(), ['Semi-finals', 'Final']);
    assert.equal(await a.page.locator('.bracket-note', { hasText: /^Bye/ }).count(), 1, 'with three players, one has a bye');
    assert.equal(await a.page.locator('.bracket-match.is-open').count(), 1, 'one real match to play');
  });

  await t.test('the bracket never widens the page, at any width or with text at 200%', async () => {
    for (const width of [320, 360, 390, 768, 1024, 1280, 1920]) {
      for (const scale of [100, 200]) {
        await a.page.setViewportSize({ width, height: 900 });
        await a.page.addStyleTag({ content: `html { font-size: ${scale}% !important; }` });
        await a.page.waitForTimeout(100);
        const overflow = await a.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 1, `the bracket makes the page ${overflow}px too wide at ${width}px with text at ${scale}%`);
      }
    }
    await a.page.setViewportSize({ width: 390, height: 844 });
    await a.page.addStyleTag({ content: 'html { font-size: 100% !important; }' });
  });

  await t.test('the two players in the match each play it; the bye holder has nothing to play', async () => {
    const playing = [];
    for (const page of pages) {
      await openByName(page, name);
      const button = page.getByRole('button', { name: 'Play your match' });
      if (await button.count()) playing.push([page, button]);
    }
    assert.equal(playing.length, 2, 'exactly the two drawn against each other can play');

    for (const [index, [page, button]] of playing.entries()) {
      await button.click();
      await page.waitForSelector('.choice-button', { timeout: 20000 });
      for (let i = 0; i < 12; i++) if ((await answerOne(page)) === 'finished') break;
      // A finished run goes back to the tournament, not to a summary or a leaderboard.
      await page.locator('.tournament-status').waitFor({ timeout: 15000 });
      if (index === 0) {
        // The first to finish waits for the other. The second to finish decides the match, so their screen has moved on.
        await page.waitForFunction(() => /You have played your match/.test(document.body.textContent), null, { timeout: 15000 });
      }
    }
  });

  await t.test('once both have played the match is decided and the final is made', async () => {
    await openByName(a.page, name);
    await a.page.waitForFunction(() => document.querySelectorAll('.bracket-side.is-winner').length >= 2, null, { timeout: 15000 });
    assert.match(await a.page.locator('.tournament-status').textContent(), /Round 2 of 2/);
    const final = a.page.locator('.bracket-round', { hasText: 'Final' }).locator('.bracket-match');
    assert.equal(await final.locator('.bracket-side.is-empty').count(), 0, 'both finalists are placed');
    assert.equal(await final.locator('.bracket-note', { hasText: /Play by/ }).count(), 1);
    // A tournament match is on no leaderboard: there is nothing named "This Week" on this screen.
    assert.equal(await a.page.getByText('This Week').count(), 0);
  });
});
