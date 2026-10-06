import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_URL, answerOne, launch, openPage, register } from './harness.mjs';

// A seasonal bundle: a card on the Start screen while a season is on, the same screen as the weekly challenge, and a
// run whose every question belongs to the occasion. No real season is running when this was written, so the test asks
// the API for one with ?force= (ignored in production) and has the browser see that answer where it would ask for
// today's season. The run itself uses the real challenge routes.
const SEASON_URL = '**/api/challenges/season';

async function forcedSeason(page) {
  const res = await page.request.get(`${BASE_URL}/api/challenges/season?force=halloween`);
  assert.equal(res.status(), 200);
  const body = await res.json();
  assert.ok(body.season, 'the bank has no halloween questions: seed it with SEED_FILE=question-bank-full-draft.json');
  return body;
}

test('a season shows on the Start screen and can be played', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page, problems } = await openPage(browser);
  const season = await forcedSeason(page);
  await page.route(SEASON_URL, (route) => route.fulfill({ json: season }));
  await register(page);

  await t.test('the card names the occasion and offers it', async () => {
    const card = page.locator('.season-card');
    await card.waitFor();
    assert.match(await card.textContent(), /In season/);
    assert.match(await card.textContent(), /The Halloween Feast/);
  });

  await t.test('it opens the challenge screen, titled for the season and year', async () => {
    await page.locator('.season-card').getByRole('button', { name: 'Play it' }).click();
    await page.getByRole('button', { name: 'Play this Challenge' }).waitFor();
    assert.equal(await page.locator('.screen-eyebrow').first().textContent(), 'In season');
    assert.match(await page.locator('.screen-title').first().textContent(), /^The Halloween Feast \d{4}$/);
  });

  await t.test('a run starts and a question can be answered', async () => {
    await page.getByRole('button', { name: 'Play this Challenge' }).click();
    await page.waitForSelector('.choice-button', { timeout: 20000 });
    assert.ok(['continued', 'finished'].includes(await answerOne(page)));
  });

  assert.deepEqual(problems, [], 'the browser complained');
});

test('between seasons the Start screen has no season card', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page } = await openPage(browser);
  const today = await (await page.request.get(`${BASE_URL}/api/challenges/season`)).json();
  if (today.season) return t.skip('a real season is running today');
  await register(page);
  await page.waitForSelector('.mode-spine-title');
  assert.equal(await page.locator('.season-card').count(), 0);
});
