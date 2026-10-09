import test from 'node:test';
import assert from 'node:assert/strict';
import { beginRun, launch, navigateTo, openPage, register, uniqueName } from './harness.mjs';

// The holiday overlays: a decorated backdrop, props on every plate and a scene at the end of the page while a holiday is on, two switches for
// it in Settings, an admin's own choice of holiday, and a rule that none of it gets in the way of the quiz. Which holiday is on is the
// server's call from the date, so every test here says what the server answers rather than depending on today's date.
const HOLIDAY_URL = '**/api/holiday';
const HOLIDAYS = ['halloween', 'thanksgiving', 'yule', 'newyear', 'easter', 'midsummer'];
const DESKTOP = { width: 1400, height: 900 };

// DATABASE_URL is only needed to promote an admin, which has no route by design (see schema.sql), so only that test is skipped without one.
const NO_DATABASE = !process.env.DATABASE_URL && 'DATABASE_URL not set';

async function dressed(page, overlay = 'halloween') {
  await page.unroute(HOLIDAY_URL).catch(() => {});
  await page.route(HOLIDAY_URL, (route) => route.fulfill({ json: { overlay } }));
  await page.reload({ waitUntil: 'networkidle' });
}

const computed = (page, selector, property) => page.locator(selector).first().evaluate((el, p) => getComputedStyle(el)[p], property);
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('a holiday dresses the page, and the two switches in Settings take it off', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page, problems } = await openPage(browser, DESKTOP);
  await register(page);
  await dressed(page);

  await t.test('the backdrop is there, on by default, and out of everyone\'s way', async () => {
    await page.locator('.holiday').waitFor({ state: 'attached' });
    assert.equal(await page.locator('.app-shell').getAttribute('data-holiday'), 'halloween');
    assert.equal(await page.locator('.app-shell').getAttribute('data-holiday-motion'), 'full');
    assert.equal(await page.locator('.holiday').getAttribute('aria-hidden'), 'true');
    assert.equal(await computed(page, '.holiday', 'position'), 'fixed');
    assert.equal(await computed(page, '.holiday', 'pointerEvents'), 'none');
  });

  await t.test('nothing of it is drawn over the content: the page is what answers at its middle', async () => {
    const overlay = await page.evaluate(() => Boolean(document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)?.closest('.holiday')));
    assert.equal(overlay, false);
  });

  await t.test('Settings says what is on, and both switches start on', async () => {
    await navigateTo(page, 'Settings');
    await page.locator('#holiday-overlay').waitFor({ state: 'attached' });
    assert.match(await page.locator('#holiday-status').textContent(), /Halloween is on/);
    assert.equal(await page.locator('#holiday-overlay').isChecked(), true);
    assert.equal(await page.locator('#holiday-motion').isChecked(), true);
  });

  await t.test('an ordinary player is not offered the admin\'s list of holidays', async () => {
    assert.equal(await page.locator('#holiday-override').count(), 0);
  });

  await t.test('the Animated background switch stills the scene and keeps it, and the choice survives a reload', async () => {
    await page.locator('#holiday-motion').uncheck();
    await page.locator('.app-shell[data-holiday-motion="still"]').waitFor({ state: 'attached' });
    assert.equal(await computed(page, '.hw-mist', 'animationName'), 'none');
    assert.ok((await page.locator('.hw-cl').count()) > 0, 'the scene is still there (the oak and the gate)');

    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.app-shell[data-holiday-motion="still"]').waitFor({ state: 'attached' });
  });

  await t.test('the Holiday overlay switch takes the whole thing away, and the motion switch has nothing to do', async () => {
    await navigateTo(page, 'Settings');
    await page.locator('#holiday-overlay').uncheck();
    await page.waitForFunction(() => document.querySelectorAll('.holiday, .hol-pd, .hol-foot').length === 0);
    assert.equal(await page.locator('.app-shell').getAttribute('data-holiday'), null);
    assert.equal(await page.locator('#holiday-motion').isDisabled(), true);

    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('.holiday').count(), 0, 'the choice is on the account, so a reload keeps it');
  });

  await t.test('and turning it back on brings it back, animated as it was before', async () => {
    await navigateTo(page, 'Settings');
    await page.locator('#holiday-overlay').check();
    await page.locator('.holiday').waitFor({ state: 'attached' });
    await page.locator('#holiday-motion').check();
    await page.locator('.app-shell[data-holiday-motion="full"]').waitFor({ state: 'attached' });
  });

  assert.deepEqual(problems, [], 'the browser complained');
});

test('on a phone every plate is dressed and the page ends in a scene, all of it on screen', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page } = await openPage(browser);
  await register(page);
  await dressed(page, 'yule');
  await page.locator('.hol-pd').first().waitFor({ state: 'attached' });

  await t.test('the plates carry props and the gutters carry drifters, at a width with no margins', async () => {
    assert.ok((await page.locator('.plate .hol-pd, .book-spread .hol-pd').count()) > 0, 'no plate is dressed');
    assert.ok((await page.locator('.hol-gut').count()) >= 2, 'the gutters are empty');
    for (const selector of ['.hol-pd.hol-prop', '.holiday .hol-gut']) {
      assert.notEqual(await computed(page, selector, 'display'), 'none', `${selector} is not drawn on a phone`);
    }
  });

  await t.test('the margin scene is not drawn where there are no margins', async () => {
    for (const selector of ['.hol-margin']) {
      assert.equal(await computed(page, selector, 'display'), 'none', `${selector} is drawn at 390px`);
    }
  });

  await t.test('scrolled to the end, the whole foot is on screen, above the footer, not cut off', async () => {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(400);
    const box = await page.locator('.hol-foot').boundingBox();
    const footer = await page.locator('.colophon').boundingBox();
    const height = await page.evaluate(() => window.innerHeight);
    assert.ok(box, 'there is no foot');
    assert.ok(box.y >= 0 && box.y + box.height <= height, `the foot spans ${box.y} to ${box.y + box.height} in a ${height}px screen`);
    assert.ok(box.y + box.height <= footer.y + 1, 'the foot runs into the footer');
  });

  await t.test('and the page does not grow sideways', async () => {
    assert.ok((await overflow(page)) <= 0, 'the page is wider than the screen');
  });
});

test('every holiday draws on a phone and on a wide screen without a complaint or an overflow', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page, problems } = await openPage(browser);
  await register(page);
  for (const holiday of HOLIDAYS) {
    await t.test(holiday, async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await dressed(page, holiday);
      await page.locator('.holiday').waitFor({ state: 'attached' });
      assert.equal(await page.locator('.app-shell').getAttribute('data-holiday'), holiday);
      assert.ok((await page.locator('.hol-pd').count()) > 0, `${holiday} has no plate dressing`);
      assert.ok((await page.locator('.hol-foot').count()) === 1, `${holiday} has no foot`);
      assert.notEqual(await computed(page, '.hol-foot', 'display'), 'none', `${holiday}'s foot is hidden on a phone`);
      assert.ok((await overflow(page)) <= 0, `${holiday} makes a phone page wider than the screen`);
      // Nothing the overlay draws may take a tap: a glow wider than its prop once sat over a dialog's button.
      const catching = await page.evaluate(() =>
        [...document.querySelectorAll('.holiday *, .hol-wrap *, .hol-foot, .hol-foot *, .hol-gut, .hol-gut *')]
          .filter((el) => getComputedStyle(el).pointerEvents !== 'none')
          .map((el) => el.tagName.toLowerCase() + '.' + el.className)
          .slice(0, 5),
      );
      assert.deepEqual(catching, [], `${holiday} draws something that takes taps`);
      await page.setViewportSize(DESKTOP);
      await page.waitForTimeout(300);
      assert.ok((await overflow(page)) <= 0, `${holiday} makes a wide page wider than the screen`);
      assert.equal(await computed(page, '.hol-foot', 'display'), 'none', `${holiday}'s foot is drawn beside the margin scene`);
    });
  }
  assert.deepEqual(problems, [], 'the browser complained');
});

// A holiday must add nothing to the layout. Its dressing once sat inside the home screen's two-column spread as a block child and became its
// first column, so the form dropped below the Ex Libris card on a PC. That never showed on a phone, where the page is one column, so this
// compares the boxes of the page's own pieces with the holiday on and off, on a phone, a laptop and a wide screen.
const WIDTHS = [[390, 844], [1100, 800], [1440, 900]];
const boxes = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.book-spread-leaf, .plate, .screen-head, .colophon')]
      .filter((el) => !el.closest('.holiday'))
      .map((el) => {
        const b = el.getBoundingClientRect();
        return `${el.className.toString().split(' ')[0]} x${Math.round(b.left)} y${Math.round(b.top + window.scrollY)} w${Math.round(b.width)}`;
      }),
  );

test('a holiday adds nothing to the layout: every box sits where it does without it', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  for (const [width, height] of WIDTHS) {
    const { page } = await openPage(browser, { width, height });
    await register(page);
    // The page's own height can settle a few pixels after load on a slow machine, so each holiday is compared with a plain page measured just
    // before it, not with one measured at the start.
    const plainBoxes = async () => {
      await dressed(page, null);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      return boxes(page);
    };
    assert.ok((await plainBoxes()).length > 2, 'the home screen has plates to compare');
    for (const holiday of HOLIDAYS) {
      await t.test(`${holiday} at ${width}px`, async () => {
        const plain = await plainBoxes();
        await dressed(page, holiday);
        await page.locator('.holiday').waitFor({ state: 'attached' });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(300);
        const dressedBoxes = await boxes(page);
        // The colophon moves down by the height of the foot scene, which is the one thing a holiday may add, so only its x and width are compared.
        const trim = (list) => list.map((b) => (b.startsWith('colophon') ? b.replace(/ y\d+/, '') : b));
        assert.deepEqual(trim(dressedBoxes), trim(plain), `${holiday} moved something at ${width}px`);
      });
    }
    await page.close();
  }
});

test('while a question is on screen everything stops and the props go', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page } = await openPage(browser, DESKTOP);
  await register(page);
  await dressed(page);
  await page.locator('.app-shell[data-holiday-calm="off"]').waitFor({ state: 'attached' });
  assert.notEqual(await computed(page, '.hw-mist', 'animationName'), 'none', 'it moves when nothing is being asked');

  await beginRun(page);
  await page.locator('.app-shell[data-holiday-calm="on"]').waitFor({ state: 'attached' });
  assert.equal(await computed(page, '.hw-mist', 'animationName'), 'none');
  assert.equal(await computed(page, '.hw-bat', 'display'), 'none', 'the travellers are not drawn');
  assert.equal(await computed(page, '.hol-pd.hol-prop', 'display'), 'none', 'the props on the plate are gone');
  assert.ok((await page.locator('.hol-pd.hol-line').count()) > 0, 'the thin line art stays, still');
});

test('a device set to reduce motion gets the still scene whatever the switch says', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page } = await openPage(browser, DESKTOP);
  await register(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await dressed(page);
  await page.locator('.holiday').waitFor({ state: 'attached' });
  assert.equal(await page.locator('.app-shell').getAttribute('data-holiday-motion'), 'full', 'the switch is on');
  assert.equal(await computed(page, '.hw-mist', 'animationName'), 'none');
  assert.equal(await computed(page, '.hw-bat', 'display'), 'none');
});

// The bats: on Halloween one crosses the page now and then, and catching it unlocks an achievement. The server decides whether it is Halloween
// from the date, so these ask it to treat Halloween as on, the way GET /holiday does for a developer.
async function inSeason(page) {
  await page.route('**/api/holiday/bat', (route) => route.continue({ url: `${route.request().url()}?force=halloween` }));
}
const BELFRY = '.achievement-toast-name';

test('a bat crosses the page, and catching it unlocks Something in the Belfry', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page } = await openPage(browser, DESKTOP);
  await register(page);
  await inSeason(page);
  await dressed(page);

  const bat = page.locator('.hol-flybat');
  await bat.waitFor({ state: 'attached', timeout: 20000 });
  assert.ok((await bat.boundingBox()).height >= 40, 'a fair target for a thumb');
  assert.equal(await computed(page, '.hol-batlayer', 'pointerEvents'), 'none', 'the layer lets taps through; only the bat answers');
  // It is moving, so a click that waits for it to hold still would wait for ever: send the click itself.
  await bat.dispatchEvent('click');
  await page.locator(BELFRY).waitFor({ timeout: 8000 });
  assert.equal(await page.locator(BELFRY).textContent(), 'Something in the Belfry');
  await page.locator('.hol-flybat').waitFor({ state: 'detached', timeout: 3000 });
});

test('with the animation off a bat hangs from the oak instead, and a keyboard can reach it', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page } = await openPage(browser);
  await register(page);
  await inSeason(page);
  await dressed(page);
  await navigateTo(page, 'Settings');
  await page.locator('#holiday-motion').uncheck();
  await navigateTo(page, 'Home');
  await page.locator('.app-shell[data-holiday-motion="still"]').waitFor({ state: 'attached' });

  const perch = page.locator('.hol-perch-foot');
  await perch.waitFor({ state: 'visible' });
  assert.equal(await page.locator('.hol-flybat').count(), 0);
  // The first bat of an animated page comes within ten seconds, so this is long enough to be sure none flies.
  await page.waitForTimeout(10500);
  assert.equal(await page.locator('.hol-flybat').count(), 0, 'nothing flies while the scene is still');
  await perch.focus();
  await page.keyboard.press('Enter');
  await page.locator(BELFRY).waitFor({ timeout: 8000 });
  assert.equal(await page.locator('.hol-perch').count(), 0, 'the bat is caught and gone');
});

test('there are no bats during a question, and none for someone who is not signed in', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page } = await openPage(browser, DESKTOP);
  await register(page);
  await dressed(page);
  await page.locator('.hol-perch').first().waitFor({ state: 'attached' }).catch(() => {});
  await beginRun(page);
  await page.locator('.app-shell[data-holiday-calm="on"]').waitFor({ state: 'attached' });
  assert.equal(await page.locator('.hol-flybat, .hol-perch').count(), 0, 'nothing to catch while the quiz is on');

  // Signed out there is no account to give the achievement to, so there is no bat: with reduced motion on, where a perch would show at once.
  const guest = await browser.newPage({ viewport: DESKTOP });
  await guest.emulateMedia({ reducedMotion: 'reduce' });
  await guest.route(HOLIDAY_URL, (route) => route.fulfill({ json: { overlay: 'halloween' } }));
  await guest.goto(page.url().split('#')[0], { waitUntil: 'networkidle' });
  await guest.locator('.holiday').waitFor({ state: 'attached' });
  assert.equal(await guest.locator('.hol-flybat, .hol-perch').count(), 0, 'no bat for someone who is not signed in');
});

test('between holidays there is no overlay, and Settings says so', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page } = await openPage(browser);
  await register(page);
  await dressed(page, null);
  await page.waitForSelector('.mode-spine-title');
  assert.equal(await page.locator('.holiday, .hol-pd, .hol-foot').count(), 0);
  assert.equal(await page.locator('.app-shell').getAttribute('data-holiday'), null);

  await navigateTo(page, 'Settings');
  await page.locator('#holiday-overlay').waitFor({ state: 'attached' });
  assert.match(await page.locator('#holiday-status').textContent(), /Nothing is on right now/);
});

test('an admin can choose any holiday, whatever the date', { skip: NO_DATABASE }, async (t) => {
  const { default: pg } = await import('../../backend/node_modules/pg/lib/index.js');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  t.after(() => pool.end());
  const browser = await launch();
  t.after(() => browser.close());
  const { page } = await openPage(browser, DESKTOP);
  const name = await register(page, uniqueName('hadm'));
  await pool.query('UPDATE users SET is_admin = true WHERE username = $1', [name]);
  await dressed(page, 'halloween');

  await t.test('Settings offers the list, set to Automatic, and says what the calendar chose', async () => {
    await navigateTo(page, 'Settings');
    await page.locator('#holiday-override').waitFor();
    assert.equal(await page.locator('#holiday-override').inputValue(), 'auto');
    assert.equal((await page.locator('#holiday-override option').count()), 1 + HOLIDAYS.length);
    assert.match(await page.locator('#holiday-status').textContent(), /Halloween is on/);
  });

  await t.test('picking Easter shows Easter though the calendar says Halloween, and says so', async () => {
    await page.locator('#holiday-override').selectOption('easter');
    await page.locator('.app-shell[data-holiday="easter"]').waitFor({ state: 'attached' });
    assert.match(await page.locator('#holiday-status').textContent(), /previewing Easter.*calendar says Halloween/);
  });

  await t.test('the choice is on the account: it survives a reload', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.app-shell[data-holiday="easter"]').waitFor({ state: 'attached' });
  });

  await t.test('the switches still apply to a chosen holiday', async () => {
    await navigateTo(page, 'Settings');
    await page.locator('#holiday-overlay').uncheck();
    await page.waitForFunction(() => document.querySelectorAll('.holiday').length === 0);
    await page.locator('#holiday-overlay').check();
    await page.locator('.app-shell[data-holiday="easter"]').waitFor({ state: 'attached' });
  });

  await t.test('Automatic goes back to the calendar', async () => {
    await page.locator('#holiday-override').selectOption('auto');
    await page.locator('.app-shell[data-holiday="halloween"]').waitFor({ state: 'attached' });
  });

  await t.test('an admin who is no longer one is back on the calendar, whatever was stored', async () => {
    await page.locator('#holiday-override').selectOption('yule');
    await page.locator('.app-shell[data-holiday="yule"]').waitFor({ state: 'attached' });
    await pool.query('UPDATE users SET is_admin = false WHERE username = $1', [name]);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.app-shell[data-holiday="halloween"]').waitFor({ state: 'attached' });
    await navigateTo(page, 'Settings');
    await page.locator('#holiday-overlay').waitFor({ state: 'attached' });
    assert.equal(await page.locator('#holiday-override').count(), 0);
  });
});
