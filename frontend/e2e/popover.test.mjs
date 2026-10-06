import test from 'node:test';
import assert from 'node:assert/strict';
import { devices } from 'playwright';
import { BASE_URL, launch, openPage, register } from './harness.mjs';

// A bug that reached a player: on an Android phone with larger text the header wraps, the avatar ends up at the left
// of its row, and the account menu — anchored to the avatar's right edge — opened leftwards off the screen, with its
// labels cut off. The sweep in overflow-matrix.test.mjs never opened a menu. This opens every menu the app has at the
// narrow widths and larger text sizes where the header wraps, and asks that it be entirely on screen.
//
// Larger text is `html { font-size }`, which is what Android's "font size" setting does to everything sized in rem.
const WIDTHS = [320, 360, 390, 412];
const TEXT_SCALES = [100, 115, 130, 150];

test('the account menu is entirely on screen wherever the header wraps', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());

  const setup = (await openPage(browser)).page;
  await register(setup);
  const token = await setup.evaluate(() => localStorage.getItem('trivia_auth_token'));
  await setup.close();

  const { viewport, defaultBrowserType, ...phone } = devices['Pixel 7'];

  for (const width of WIDTHS) {
    for (const scale of TEXT_SCALES) {
      await t.test(`${width}px wide, text at ${scale}%`, async () => {
        const context = await browser.newContext({ ...phone, viewport: { width, height: 760 } });
        await context.addInitScript((tkn) => localStorage.setItem('trivia_auth_token', tkn), token);
        const page = await context.newPage();
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        await page.waitForSelector('.mode-spine-title');
        await page.addStyleTag({ content: `html { font-size: ${scale}% !important; }` });

        await page.getByRole('button', { name: 'Account menu' }).click();
        const menu = page.getByRole('menu', { name: 'Account menu' });
        await menu.waitFor();
        const box = await menu.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, vw: document.documentElement.clientWidth };
        });
        assert.ok(box.left >= 0, `the menu starts ${Math.round(-box.left)}px off the left edge (${Math.round(box.left)}→${Math.round(box.right)} of ${box.vw}px)`);
        assert.ok(box.right <= box.vw + 1, `the menu ends ${Math.round(box.right - box.vw)}px past the right edge`);

        // Every label can be read in full: nothing in the menu is wider than the menu.
        const clipped = await menu.evaluate((el) => [...el.querySelectorAll('[role=menuitem]')].filter((i) => i.scrollWidth > i.clientWidth + 1).map((i) => i.textContent));
        assert.deepEqual(clipped, [], 'no label is cut off');
        await context.close();
      });
    }
  }
});
