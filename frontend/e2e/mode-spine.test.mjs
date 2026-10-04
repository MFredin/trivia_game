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
