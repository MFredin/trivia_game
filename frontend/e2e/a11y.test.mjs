import test from 'node:test';
import assert from 'node:assert/strict';
import { beginRun, launch, navigateTo, openPage, register } from './harness.mjs';

// WCAG 2.5.8 sets the floor at 24x24 CSS pixels. This game is played on a phone with a clock
// running, so the bar here is the 44px comfortable size instead.
const MIN_TARGET_PX = 44;

// Measured as the element's own box, which is wrong for exactly one control: a range input's
// target is its thumb, and the thumb is styled separately (see parts/a11y.css).
const MEASURED_SEPARATELY = ['input.rs-range'];

const INTERACTIVE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

async function auditScreen(page) {
  return page.evaluate(
    ({ selector, min, skip }) => {
      const small = [];
      const unnamed = [];
      for (const el of document.querySelectorAll(selector)) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const cls = String(el.className?.baseVal ?? el.className ?? '').split(' ')[0];
        const id = `${el.tagName.toLowerCase()}.${cls || '-'}`;
        if (skip.includes(id)) continue;
        if (r.width < min || r.height < min) small.push(`${id} ${Math.round(r.width)}x${Math.round(r.height)}`);
        const name = (el.getAttribute('aria-label') || el.textContent || el.value || '').trim();
        if (!name) unnamed.push(id);
      }
      return { small: [...new Set(small)], unnamed: [...new Set(unnamed)] };
    },
    { selector: INTERACTIVE, min: MIN_TARGET_PX, skip: MEASURED_SEPARATELY },
  );
}

test('accessibility, at phone width', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page } = await openPage(browser);
  await register(page);

  await t.test('keyboard focus is visible', async () => {
    // A real Tab, not element.focus(): :focus-visible only matches the former, so focusing
    // from script would report a ring that a keyboard user never sees.
    await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => {
      const cs = getComputedStyle(document.activeElement);
      return { style: cs.outlineStyle, width: cs.outlineWidth, shadow: cs.boxShadow };
    });
    assert.notEqual(ring.style, 'none', 'the focused control has an outline');
    assert.notEqual(ring.width, '0px', 'the outline has width');
  });

  for (const screen of ['Home', 'Leaderboard', 'Friends', 'Achievements', 'Settings']) {
    await t.test(`${screen}: every control is named and large enough`, async () => {
      await navigateTo(page, screen);
      const { small, unnamed } = await auditScreen(page);
      assert.deepEqual(unnamed, [], `controls with no accessible name on ${screen}`);
      assert.deepEqual(small, [], `controls under ${MIN_TARGET_PX}px on ${screen}`);
    });
  }

  await t.test('the question screen too', async () => {
    await navigateTo(page, 'Home');
    await beginRun(page, 'Classic');
    const { small, unnamed } = await auditScreen(page);
    assert.deepEqual(unnamed, []);
    assert.deepEqual(small, []);
  });
});
