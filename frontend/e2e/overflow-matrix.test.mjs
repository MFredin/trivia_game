import test from 'node:test';
import assert from 'node:assert/strict';
import { devices } from 'playwright';
import { BASE_URL, beginRun, launch, navigateTo, openPage, openSection, register } from './harness.mjs';

/**
 * The whole app, at the widths people actually have, with the content that breaks layouts.
 *
 * layout.test.mjs holds the Gauntlet regression; this is the sweep behind it. It needs a database (it makes a
 * moderator and seeds worst-case content), so it is skipped without one.
 *
 * What it asserts, per width and screen:
 *   - the page never scrolls sideways (documentElement.scrollWidth == clientWidth);
 *   - on a phone, no text field is under 16px (iOS Safari zooms the page in on focus below that, which looks
 *     exactly like an overflow and is not undone when the field loses focus);
 *   - a dialog fits the screen, or scrolls inside itself.
 * And at 200% text size (the WCAG reflow case) nothing scrolls sideways either.
 *
 * What it cannot show: this is Chromium emulating phones (viewport, touch, pixel ratio, user agent), not the
 * WebKit engine iOS uses, nor a real keyboard or address bar. See docs/compatibility.md for what that leaves.
 */
const SKIP = !process.env.DATABASE_URL && 'DATABASE_URL not set';

// 320 is the smallest phone still in use (and WCAG's reflow width); 1920 and above is a desktop monitor.
const WIDTHS = (process.env.WIDTHS ?? '320,360,375,390,412,430,600,768,1024,1280,1920').split(',').map(Number);
const PHONE_MAX = 500;
const HEIGHT_FOR = (w) => (w <= PHONE_MAX ? 740 : w <= 1024 ? 900 : 1000);

const asPlayer = (page, path, method = 'GET', body) =>
  page.evaluate(
    async ({ origin, path, method, body }) => {
      const token = localStorage.getItem('trivia_auth_token');
      const res = await fetch(`${origin}/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      return res.status;
    },
    { origin: new URL(BASE_URL).origin, path, method, body },
  );

// 40 characters is the longest username there can be; W is the widest letter and has no break point.
const longName = (tag) => `${'W'.repeat(40 - tag.length)}${tag}`;
const UNBROKEN = 'Supercalifragilisticexpialidocious'.repeat(14); // 476 characters, no space to wrap at

// `width` is the screen's width, passed in rather than read back: on a phone the browser widens the layout
// viewport to fit whatever overflows (shrink-to-fit), so documentElement.clientWidth would agree with the problem.
async function report(page, width) {
  return page.evaluate((vw) => {
    const doc = { scrollWidth: document.documentElement.scrollWidth, clientWidth: vw };
    const offenders = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right > doc.clientWidth + 1 || r.left < -1) {
        // Inside something that scrolls on purpose (a tab row, the message area) is not the page overflowing.
        let scrolls = false;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') {
            scrolls = true;
            break;
          }
        }
        if (!scrolls) {
          const cls = String(el.className?.baseVal ?? el.className ?? '').trim().split(/\s+/)[0];
          offenders.push(`${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}(${Math.round(r.left)}→${Math.round(r.right)})`);
        }
      }
    }
    // The elements that stick out although their parent does not: the cause, not everything inside it.
    const culprits = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= doc.clientWidth + 1 || !el.parentElement) continue;
      if (el.parentElement.getBoundingClientRect().right > doc.clientWidth + 1) continue;
      const cls = String(el.className?.baseVal ?? el.className ?? '').trim().split(/\s+/).join('.');
      culprits.push(`${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}(w${Math.round(r.width)})`);
    }
    // Text spilling out of a box that itself fits (an unbroken string) is not an element wider than the screen,
    // so the loop above cannot see it: measure the text itself.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      if ([...range.getClientRects()].some((r) => r.right > doc.clientWidth + 1)) {
        const el = node.parentElement;
        const cls = String(el.className?.baseVal ?? el.className ?? '').trim().split(/\s+/).join('.');
        culprits.push(`text in ${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`);
      }
    }
    const small = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea')]
      .filter((el) => el.getBoundingClientRect().width > 0 && parseFloat(getComputedStyle(el).fontSize) < 16)
      .map((el) => `${el.tagName.toLowerCase()}#${el.id || el.name || el.type}=${getComputedStyle(el).fontSize}`);
    return {
      overflowed: doc.scrollWidth > doc.clientWidth,
      by: doc.scrollWidth - doc.clientWidth,
      offenders: [...new Set(offenders)].slice(0, 8),
      culprits: [...new Set(culprits)].slice(0, 6),
      widest: [...document.querySelectorAll('body *')]
        .map((el) => [el, el.getBoundingClientRect()])
        .filter(([, r]) => r.width > vw + 1)
        .sort((a, b) => b[1].width - a[1].width)
        .slice(0, 3)
        .map(([el, r]) => `${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className ?? '').split(' ')[0]}(w${Math.round(r.width)})`),
      small,
    };
  }, width);
}

test('every screen fits every width, with the worst content in it', { skip: SKIP }, async (t) => {
  const { default: pg } = await import('../../backend/node_modules/pg/lib/index.js');
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const browser = await launch();
  t.after(async () => {
    await browser.close();
    await db.end();
  });

  // --- the cast: a moderator and a friend, both with the longest possible names -----------------------------
  const tagA = Math.random().toString(36).slice(2, 8);
  const tagB = Math.random().toString(36).slice(2, 8);
  const nameA = longName(tagA);
  const nameB = longName(tagB);
  const setup = (await openPage(browser)).page;
  const other = (await openPage(browser)).page;
  await register(setup, nameA);
  await register(other, nameB);
  const token = await setup.evaluate(() => localStorage.getItem('trivia_auth_token'));
  assert.equal(await asPlayer(setup, '/friends', 'POST', { username: nameB }), 201);
  assert.equal(await asPlayer(other, `/friends/requests/${nameA}/accept`, 'POST'), 200);
  await db.query('UPDATE users SET is_admin = true, bio = $2 WHERE username = $1', [nameA, 'M'.repeat(140)]);
  await db.query('UPDATE users SET bio = $2 WHERE username = $1', [nameB, 'W'.repeat(140)]);
  const { rows } = await db.query('SELECT id, username FROM users WHERE username = ANY($1)', [[nameA, nameB]]);
  const id = Object.fromEntries(rows.map((r) => [r.username, r.id]));
  await db.query(
    `INSERT INTO messages (sender_id, recipient_id, body, subject, created_at)
     SELECT CASE WHEN n % 2 = 0 THEN $1::int ELSE $2::int END, CASE WHEN n % 2 = 0 THEN $2::int ELSE $1::int END,
            CASE WHEN n % 3 = 0 THEN $3 ELSE 'Owl number ' || n END, CASE WHEN n % 5 = 0 THEN $4 ELSE NULL END,
            now() - make_interval(mins => 60 - n)
     FROM generate_series(1, 30) AS n`,
    [id[nameA], id[nameB], UNBROKEN, 'S'.repeat(80)],
  );
  assert.equal(await asPlayer(other, '/reports', 'POST', { username: nameA, reason: 'other', details: UNBROKEN.slice(0, 480) }), 201);
  assert.equal(
    await asPlayer(other, '/suggestions', 'POST', {
      category: 'Spells & Magic',
      question_text: UNBROKEN.slice(0, 480),
      correct_answer: 'A'.repeat(190),
      distractors: ['B'.repeat(190), 'C'.repeat(190), 'D'.repeat(190)],
      canon_tags: ['book'],
    }),
    201,
  );
  // A report the moderator can act on (an admin cannot act on themselves, so it is about the friend).
  const third = (await openPage(browser)).page;
  await register(third);
  assert.equal(await asPlayer(third, '/reports', 'POST', { username: nameB, reason: 'harassment', details: UNBROKEN.slice(0, 480) }), 201);
  await third.close();
  await setup.close();
  await other.close();

  // --- one browser context per width, signed in as the moderator -----------------------------------------
  const phoneProfile = (({ viewport, defaultBrowserType, ...rest }) => rest)(devices['iPhone 13']);
  const newPage = async (width, height = HEIGHT_FOR(width)) => {
    const phone = width <= PHONE_MAX || height <= 420;
    const context = await browser.newContext({
      viewport: { width, height },
      ...(phone ? phoneProfile : {}),
    });
    await context.addInitScript((tkn) => localStorage.setItem('trivia_auth_token', tkn), token);
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('.mode-spine-title', { timeout: 20000 });
    return { page, phone, context };
  };

  const failures = [];
  const check = async (page, phone, where, width = Number(where.match(/^(\d+)px/)[1])) => {
    await page.waitForTimeout(150);
    const r = await report(page, width);
    if (r.overflowed) failures.push(`${where}: scrolls sideways by ${r.by}px — ${r.offenders.join(' | ') || 'inside a clipping box'} [cause: ${r.culprits.join(' | ') || '?'}; widest: ${r.widest.join(' | ')}]`);
    if (phone && r.small.length) failures.push(`${where}: text fields under 16px (iOS zooms in): ${r.small.join(', ')}`);
  };
  const dialogFits = async (page, where) => {
    // Dialogs load on demand, so wait for it rather than look once.
    await page.locator('[role=dialog]').first().waitFor({ timeout: 10000 }).catch(() => {});
    const fits = await page.evaluate(() => {
      const d = document.querySelector('[role=dialog]');
      if (!d) return { none: true };
      const r = d.getBoundingClientRect();
      // Something the dialog sits in (or the dialog itself) scrolls vertically: what is below the fold can be reached.
      let scrollable = false;
      for (let el = d; el && el !== document.body; el = el.parentElement) {
        if (['auto', 'scroll'].includes(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1) scrollable = true;
      }
      return { top: r.top, bottom: r.bottom, vh: window.innerHeight, left: r.left, right: r.right, vw: document.documentElement.clientWidth, scrollable };
    });
    if (fits.none) return failures.push(`${where}: expected a dialog`);
    const sideways = fits.left < -1 || fits.right > fits.vw + 1;
    // Its top must be on screen (a dialog centred taller than the screen loses its top, and nothing can scroll to it);
    // its bottom may be below the fold only if something scrolls.
    const topReachable = fits.top >= -1;
    const bottomReachable = fits.bottom <= fits.vh + 1 || fits.scrollable;
    if (sideways || !topReachable || !bottomReachable) {
      failures.push(`${where}: dialog is not fully reachable (${Math.round(fits.top)}→${Math.round(fits.bottom)} of ${fits.vh}px high; x ${Math.round(fits.left)}→${Math.round(fits.right)} of ${fits.vw}; scrolls: ${fits.scrollable})`);
    }
  };

  // Escape must close a dialog (the keyboard's way out), and must leave nothing over the page.
  const closeDialog = async (page, where) => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    if ((await page.locator('[role=dialog]').count()) > 0) {
      failures.push(`${where}: Escape did not close the dialog`);
      await page.locator('[role=dialog]').getByRole('button', { name: /cancel|close|done|keep/i }).first().click().catch(() => {});
    }
  };

  for (const width of WIDTHS) {
    await t.test(`${width}px`, async () => {
      const { page, phone, context } = await newPage(width);
      page.setDefaultTimeout(10000);
      let lastStep = 'start';
      const at = (screen) => (lastStep = `${width}px ${screen}`);
      try {

      await check(page, phone, at('Home'));
      for (const screen of ['Leaderboard', 'Achievements']) {
        await navigateTo(page, screen);
        await check(page, phone, at(screen));
      }

      await navigateTo(page, 'Community');
      for (const tab of ['Online now', 'All members', 'Activity']) {
        const button = page.getByRole('button', { name: new RegExp(tab, 'i') }).first();
        if (await button.count()) await button.click();
        await check(page, phone, at(`Community › ${tab}`));
      }

      await navigateTo(page, 'Settings');
      for (const section of ['Appearance', 'Privacy', 'Account']) {
        await openSection(page, section);
        await check(page, phone, at(`Settings › ${section}`));
      }

      await navigateTo(page, 'Edit profile');
      for (const section of ['Avatar', 'Title', 'About']) {
        await openSection(page, section);
        await check(page, phone, at(`Edit profile › ${section}`));
      }
      await openSection(page, 'Avatar');
      for (const part of ['Shape', 'Colour', 'Pattern', 'Frame', 'Corner mark']) {
        await page.getByRole('button', { name: new RegExp(`^${part}`) }).click();
        await check(page, phone, at(`Edit profile › avatar › ${part}`));
      }

      await navigateTo(page, 'My profile');
      await check(page, phone, at('My profile'));

      await navigateTo(page, 'Owl Post');
      await check(page, phone, at('Owl Post inbox'));
      await page.getByRole('button', { name: /Write|Compose|New owl/i }).first().click().catch(() => {});
      await check(page, phone, at('Owl Post compose'));
      await navigateTo(page, 'Owl Post');
      await page.getByRole('button', { name: new RegExp(nameB.slice(-8)) }).first().click();
      await page.locator('.owl-bubble').first().waitFor();
      await check(page, phone, at('Owl Post thread'));
      await page.getByRole('button', { name: 'More actions' }).click();
      await page.getByRole('menuitem', { name: 'Report' }).click();
      await dialogFits(page, at('report dialog'));
      await check(page, phone, at('report dialog'));
      await closeDialog(page, `${width}px dialog`);

      for (const screen of ['Review reports', 'Review questions', 'Manage titles', 'Manage team']) {
        await navigateTo(page, screen);
        await check(page, phone, at(screen));
      }
      await navigateTo(page, 'Review reports');
      const act = page.getByRole('button', { name: /^Take action/i }).first();
      if (await act.count()) {
        await act.click();
        await dialogFits(page, at('moderation dialog'));
        await check(page, phone, at('moderation dialog'));
        await closeDialog(page, `${width}px dialog`);
      }

      await navigateTo(page, 'Settings');
      await openSection(page, 'Account');
      await page.getByRole('button', { name: 'Delete my account' }).first().click();
      await dialogFits(page, at('delete dialog'));
      await check(page, phone, at('delete dialog'));
      await closeDialog(page, `${width}px dialog`);

      await page.getByRole('button', { name: 'Submit Feedback' }).first().click();
      await dialogFits(page, at('feedback dialog'));
      await check(page, phone, at('feedback dialog'));
      await closeDialog(page, `${width}px dialog`);

      // A run: the question, then its reveal.
      await navigateTo(page, 'Home');
      await beginRun(page, 'Classic');
      await check(page, phone, at('question'));
      await page.locator('.choice-button:not([disabled])').first().click();
      await check(page, phone, at('answer revealed'));

      } catch (err) {
        err.message = `stopped after "${lastStep}": ${err.message.split('\n')[0]}\n  found so far: ${failures.filter((f) => f.startsWith(`${width}px`)).join('\n    ')}`;
        throw err;
      } finally {
        await context.close();
      }
      assert.deepEqual(failures.filter((f) => f.startsWith(`${width}px`)), []);
    });
  }

  await t.test('at 200% text size nothing scrolls sideways (WCAG reflow)', async () => {
    for (const width of [390, 1280]) {
      const { page, phone, context } = await newPage(width);
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      for (const screen of ['Home', 'Leaderboard', 'Community', 'Settings', 'Edit profile', 'Owl Post']) {
        await navigateTo(page, screen);
        await check(page, phone, `${width}px at 200% ${screen}`);
      }
      await context.close();
    }
    assert.deepEqual(failures.filter((f) => f.includes('at 200%')), []);
  });

  await t.test('a phone on its side (667×375): every dialog fits or scrolls inside itself', async () => {
    const { page, phone, context } = await newPage(667, 375);
    await navigateTo(page, 'Settings');
    await openSection(page, 'Account');
    await page.getByRole('button', { name: 'Delete my account' }).first().click();
    await dialogFits(page, 'landscape delete dialog');
    await check(page, phone, '667px landscape delete dialog', 667);
    await closeDialog(page, 'landscape');
    await page.getByRole('button', { name: 'Submit Feedback' }).first().click();
    await dialogFits(page, 'landscape feedback dialog');
    await closeDialog(page, 'landscape');
    await navigateTo(page, 'Review reports');
    await page.getByRole('button', { name: /^Take action/i }).first().click();
    await dialogFits(page, 'landscape moderation dialog');
    await check(page, phone, '667px landscape moderation dialog', 667);
    await closeDialog(page, 'landscape');
    await navigateTo(page, 'Owl Post');
    await page.getByRole('button', { name: new RegExp(nameB.slice(-8)) }).first().click();
    await page.locator('.owl-bubble').first().waitFor();
    await check(page, phone, '667px landscape thread', 667);
    // Only 375px high: the header and title take most of it, so the page scrolls, but the messages keep a usable
    // height and the composer can be scrolled to and used in full.
    const area = await page.evaluate(() => document.querySelector('.owl-scroll').clientHeight);
    assert.ok(area >= 150, `the messages keep a readable height (${area}px)`);
    await page.locator('.owl-composer').scrollIntoViewIfNeeded();
    const composer = await page.evaluate(() => {
      const r = document.querySelector('.owl-composer').getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    });
    assert.ok(composer.top >= 0 && composer.bottom <= 376, `the composer can be scrolled fully into view (${Math.round(composer.top)}→${Math.round(composer.bottom)})`);
    await context.close();
    assert.deepEqual(failures.filter((f) => f.includes('landscape')), []);
  });

  await t.test('logged out: the front door, registration and the recovery pages', async () => {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: HEIGHT_FOR(width) }, ...(width <= PHONE_MAX ? phoneProfile : {}) });
      const page = await context.newPage();
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      const phone = width <= PHONE_MAX;
      await check(page, phone, `${width}px login`);
      await page.getByRole('button', { name: /Need an account\? Register/ }).click();
      await check(page, phone, `${width}px age question`);
      await page.getByLabel('Month').selectOption('1');
      await page.getByLabel('Year').selectOption(String(new Date().getFullYear() - 10));
      await page.getByRole('button', { name: 'Continue' }).click();
      await check(page, phone, `${width}px under-13 screen`);
      await page.evaluate(() => localStorage.clear());
      await page.goto(`${BASE_URL}/?delete-account`, { waitUntil: 'networkidle' });
      await check(page, phone, `${width}px deletion page`);
      await page.goto(`${BASE_URL}/?reset=not-a-real-token`, { waitUntil: 'networkidle' });
      await check(page, phone, `${width}px reset page`);
      await context.close();
    }
    assert.deepEqual(failures.filter((f) => /login|age question|under-13|deletion page|reset page/.test(f)), []);
  });
});
