import test from 'node:test';
import assert from 'node:assert/strict';
import { beginRun, launch, navigateTo, openPage, register } from './harness.mjs';

// The holiday overlay: a decorated backdrop while a holiday is on, two switches for it in Settings, and a rule that it never
// gets in the way of the quiz. Which holiday is on is the server's call from the date, so every test here says what the server
// answers rather than depending on today's date.
const HOLIDAY_URL = '**/api/holiday';
const answer = (overlay) => (route) => route.fulfill({ json: { overlay } });

async function dressed(page, overlay = 'halloween') {
  await page.route(HOLIDAY_URL, answer(overlay));
  await page.reload({ waitUntil: 'networkidle' });
}

const computed = (page, selector, property) =>
  page.locator(selector).first().evaluate((el, p) => getComputedStyle(el)[p], property);

test('a holiday dresses the page, and the two switches in Settings take it off', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page, problems } = await openPage(browser, { width: 1400, height: 900 });
  await register(page);
  await dressed(page);

  await t.test('the backdrop is there, on by default, and out of everyone\'s way', async () => {
    await page.locator('.holiday').waitFor({ state: 'attached' });
    assert.equal(await page.locator('.holiday').getAttribute('data-scene'), 'halloween');
    assert.equal(await page.locator('.holiday').getAttribute('data-motion'), 'full');
    assert.equal(await page.locator('.holiday').getAttribute('aria-hidden'), 'true');
    assert.equal(await computed(page, '.holiday', 'position'), 'fixed');
    assert.equal(await computed(page, '.holiday', 'pointerEvents'), 'none');
  });

  await t.test('nothing of it is drawn over the content: the page is what answers at its middle', async () => {
    const overlay = await page.evaluate(() => {
      const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      return Boolean(el?.closest('.holiday'));
    });
    assert.equal(overlay, false);
  });

  await t.test('Settings says what is on, and both switches start on', async () => {
    await navigateTo(page, 'Settings');
    await page.locator('#holiday-overlay').waitFor({ state: 'attached' });
    assert.match(await page.locator('#holiday-status').textContent(), /Halloween is on/);
    assert.equal(await page.locator('#holiday-overlay').isChecked(), true);
    assert.equal(await page.locator('#holiday-motion').isChecked(), true);
  });

  await t.test('the Animated background switch stills the scene and keeps it, and the choice survives a reload', async () => {
    await page.locator('#holiday-motion').uncheck();
    await page.locator('.holiday[data-motion="still"]').waitFor({ state: 'attached' });
    assert.equal(await computed(page, '.holiday-fog', 'animationName'), 'none');
    assert.ok((await page.locator('.holiday-pumpkin').count()) > 0, 'the scene is still there');

    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.holiday[data-motion="still"]').waitFor({ state: 'attached' });
  });

  await t.test('the Holiday overlay switch takes the whole thing away, and the motion switch has nothing to do', async () => {
    await navigateTo(page, 'Settings');
    await page.locator('#holiday-overlay').uncheck();
    await page.waitForFunction(() => document.querySelectorAll('.holiday').length === 0);
    assert.equal(await page.locator('#holiday-motion').isDisabled(), true);

    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('.holiday').count(), 0, 'the choice is on the account, so a reload keeps it');
  });

  await t.test('and turning it back on brings it back, animated as it was before', async () => {
    await navigateTo(page, 'Settings');
    await page.locator('#holiday-overlay').check();
    await page.locator('.holiday').waitFor({ state: 'attached' });
    await page.locator('#holiday-motion').check();
    await page.locator('.holiday[data-motion="full"]').waitFor({ state: 'attached' });
  });

  assert.deepEqual(problems, [], 'the browser complained');
});

test('while a question is on screen everything stops and the extras go', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page } = await openPage(browser, { width: 1400, height: 900 });
  await register(page);
  await dressed(page);
  await page.locator('.holiday[data-calm="off"]').waitFor({ state: 'attached' });
  assert.notEqual(await computed(page, '.holiday-fog', 'animationName'), 'none', 'it moves when nothing is being asked');

  await beginRun(page);
  await page.locator('.holiday[data-calm="on"]').waitFor({ state: 'attached' });
  assert.equal(await computed(page, '.holiday-fog', 'animationName'), 'none');
  assert.equal(await computed(page, '.holiday-witch', 'display'), 'none', 'the travellers are not drawn');
  assert.equal(await computed(page, '.holiday-pumpkin', 'display'), 'none');
});

test('a device set to reduce motion gets the still scene whatever the switch says', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page } = await openPage(browser, { width: 1400, height: 900 });
  await register(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await dressed(page);
  await page.locator('.holiday').waitFor({ state: 'attached' });
  assert.equal(await page.locator('.holiday').getAttribute('data-motion'), 'full', 'the switch is on');
  assert.equal(await computed(page, '.holiday-fog', 'animationName'), 'none');
  assert.equal(await computed(page, '.holiday-witch', 'display'), 'none');
});

test('between holidays there is no overlay, and Settings says so', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page } = await openPage(browser);
  await register(page);
  await dressed(page, null);
  await page.waitForSelector('.mode-spine-title');
  assert.equal(await page.locator('.holiday').count(), 0);

  await navigateTo(page, 'Settings');
  await page.locator('#holiday-overlay').waitFor({ state: 'attached' });
  assert.match(await page.locator('#holiday-status').textContent(), /Nothing is on right now/);
});

test('on a phone the page does not grow sideways, and the moon is clear of the heading', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page } = await openPage(browser);
  await register(page);
  await dressed(page);
  await page.locator('.holiday').waitFor({ state: 'attached' });
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  assert.ok(scroll <= client, `scrollWidth ${scroll} is wider than the screen ${client}`);

  // Pale shapes are drawn only where the page has empty margins (1280px and up); below that they would sit behind text.
  for (const selector of ['.holiday-pumpkin', '.holiday-witch', '.holiday-eyes', '.holiday-wisp']) {
    assert.equal(await computed(page, selector, 'display'), 'none', `${selector} is drawn on a phone`);
  }
  await page.setViewportSize({ width: 1100, height: 800 });
  assert.equal(await computed(page, '.holiday-pumpkin', 'display'), 'none', 'a pumpkin would sit behind the footer at 1100px');
  assert.equal(await computed(page, '.holiday-witch', 'display'), 'none');
  await page.setViewportSize({ width: 1400, height: 800 });
  assert.notEqual(await computed(page, '.holiday-pumpkin', 'display'), 'none', 'the margins at 1400px have room for them');
  await page.setViewportSize({ width: 390, height: 844 });

  // The moon may only show above the first line of content: the nav starts well below this line.
  const moonBottom = await page.locator('.holiday-moonbox').evaluate((el) => el.getBoundingClientRect().bottom);
  const navTop = await page.locator('.running-nav').first().evaluate((el) => el.getBoundingClientRect().top);
  assert.ok(moonBottom <= navTop + 4, `the moon reaches ${moonBottom}px, into the nav at ${navTop}px`);
});
