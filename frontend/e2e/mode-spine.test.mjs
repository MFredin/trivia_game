import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_URL, PHONE, launch, register } from './harness.mjs';

/**
 * A pilot user on a phone tapped "Daily Challenge" while browsing the shelf, then settled on
 * a different volume — and the one they'd tapped stayed lifted and washed out next to its
 * neighbours. `.mode-spine:hover` lifts the spine and brightens it 12%; a touchscreen has no
 * pointer to move away, so a tap promotes to `:hover` and nothing ever un-hovers it, exactly
 * the way a mouse leaving the element normally would on a desktop. `(hover: none)` is how a
 * touch-primary device (this context, via `hasTouch`) tells CSS it has no such pointer, so the
 * fix — and the thing this test guards — is that the lift only fires inside
 * `@media (hover: hover)`. Using a real hover here (rather than reproducing the exact tap
 * sequence, which depends on touch-promotion timing this sandbox's Chromium won't reliably
 * replicate) isolates that one guard directly: it proves the rule is unreachable on a device
 * that reports no hover capability, which is what actually stops the stuck state.
 */
test('the mode-spine hover lift never applies on a touch-primary device', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: PHONE, hasTouch: true, isMobile: true });
  t.after(() => page.close());
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await register(page);

  const daily = page.locator('.mode-spine', { hasText: 'Daily Challenge' });
  await daily.hover();
  await page.waitForTimeout(200);

  const style = await daily.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { filter: cs.filter, transform: cs.transform };
  });
  assert.equal(style.filter, 'none', `hover lift reached a touch-primary device: filter=${style.filter}`);
  assert.equal(style.transform, 'none', `hover lift reached a touch-primary device: transform=${style.transform}`);
});

/**
 * "Classic Quiz" and "Daily Challenge" have longer titles than the other three volumes. On a phone the spine is 126px tall and the
 * bands and their margins took 72 of it, so the long titles pushed past the bands and the five books no longer looked like a set.
 * Every title must sit between its own two bands, and every resting spine must lay out its bands at the same offsets, at the phone
 * widths people really have and on a desktop.
 */
for (const [width, height] of [[320, 640], [360, 740], [390, 844], [430, 932], [1280, 800]]) {
  test(`the volumes read as one set at ${width}px: every title fits between its bands`, async (t) => {
    const browser = await launch();
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 600, isMobile: width < 600 });
    t.after(() => page.close());
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await register(page);
    await page.locator('.mode-spine').first().waitFor();
    await page.evaluate(() => document.fonts.ready);

    const spines = await page.evaluate(() =>
      [...document.querySelectorAll('.mode-spine')].map((el) => {
        const box = (n) => n.getBoundingClientRect();
        const s = box(el);
        const [top, bottom] = [...el.querySelectorAll('.mode-spine-band')].map(box);
        const title = box(el.querySelector('.mode-spine-title'));
        return {
          name: el.textContent.trim(),
          active: el.classList.contains('is-active'),
          height: Math.round(s.height),
          topBand: Math.round(top.top - s.top),
          bottomBand: Math.round(s.bottom - bottom.bottom),
          clearAbove: Math.round(title.top - top.bottom),
          clearBelow: Math.round(bottom.top - title.bottom),
        };
      }),
    );
    for (const s of spines) {
      assert.ok(s.clearAbove >= 0 && s.clearBelow >= 0, `${s.name} runs into its bands at ${width}px: ${JSON.stringify(s)}`);
    }
    const resting = spines.filter((s) => !s.active);
    for (const key of ['height', 'topBand', 'bottomBand']) {
      assert.equal(new Set(resting.map((s) => s[key])).size, 1, `the resting volumes differ in ${key} at ${width}px: ${JSON.stringify(resting)}`);
    }
  });
}
