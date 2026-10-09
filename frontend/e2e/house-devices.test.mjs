import test from 'node:test';
import assert from 'node:assert/strict';
import { launch, navigateTo, openPage, register } from './harness.mjs';

// The house devices switch to a simplified "small cut" at 30px and below (HouseDevice.jsx), so
// the marks still read in the Settings chips and the House Cup. This checks the cut that each
// real placement gets, and that the five devices are five different drawings.
test('house devices use the small cut at chip size, the full cut on the Ex Libris card, and are all distinct', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  // The Ex Libris card says "Dressed for Halloween" while a holiday has its own colours, so this is about the house with none on.
  const { page } = await openPage(browser, undefined, { noHoliday: true });
  await register(page);

  // Home: the Ex Libris card draws its device at 40px, which is the full cut.
  await page.waitForSelector('.exlibris-house-device');
  assert.equal(await page.locator('.exlibris-house-device').first().getAttribute('data-cut'), 'full');

  // Settings: the five binding chips draw theirs at 20px, which is the small cut.
  await navigateTo(page, 'Settings');
  const chips = page.locator('.house-swatch-device');
  assert.equal(await chips.count(), 5, 'one device per binding');
  const cuts = await chips.evaluateAll((els) => els.map((el) => el.getAttribute('data-cut')));
  assert.deepEqual(cuts, Array(5).fill('small'));

  // Each device draws something beyond the shared roundel, and no two drawings are the same.
  const marks = await chips.evaluateAll((els) => els.map((el) => [...el.children].slice(1).map((c) => c.outerHTML).join('')));
  for (const mark of marks) assert.ok(mark.length > 0, 'a device is just a bare ring');
  assert.equal(new Set(marks).size, 5, 'two houses share a drawing');
});
