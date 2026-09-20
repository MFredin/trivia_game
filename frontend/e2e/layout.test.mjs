import test from 'node:test';
import assert from 'node:assert/strict';
import { beginRun, launch, navigateTo, openPage, register } from './harness.mjs';

// The two phone widths worth checking: the narrow common case, and the larger iPhone the
// overflow was first reported on.
const PHONE_WIDTHS = [390, 430];

// One real pip, as QuestionCard draws it. Repeated below to build the streak the reported
// screenshot showed without having to answer six questions correctly in a row.
const PIP_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">' +
  '<path d="M8 1c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1 2 2 3 2 5 0-4-1-6 1-9z" fill="var(--rubric)"/></svg>';

/** Anything sticking out past the right edge, or off the left, named so a failure is readable. */
async function overflowReport(page, width) {
  return page.evaluate((vw) => {
    const offenders = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        const cls = String(el.className?.baseVal ?? el.className ?? '').trim().split(/\s+/)[0];
        offenders.push(`${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''} left=${Math.round(r.left)} right=${Math.round(r.right)}`);
      }
    }
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      offenders: [...new Set(offenders)].slice(0, 10),
    };
  }, width);
}

/**
 * Nothing may push the page sideways at phone width.
 *
 * A deep Gauntlet run did exactly that. Its header row — numeral, dial, streak, strikes — was
 * laid out as one non-wrapping flex row inside a `1fr` grid track, and `1fr` is shorthand for
 * `minmax(auto, 1fr)`: an `auto` minimum refuses to shrink below the content's max-content
 * width. Every part of that row grows during a run (Gauntlet's 300 questions reach numerals
 * like CCLXXXVIII, and a streak carries up to six pips), so by question 23 the row was 457px
 * inside a 350px card, dragging the whole spread past a 390px screen and clipping the question
 * text mid-word at the edge.
 */
test('nothing overflows the viewport at phone width', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());

  for (const width of PHONE_WIDTHS) {
    await t.test(`${width}px: every screen fits`, async () => {
      const { page } = await openPage(browser, { width, height: 844 });
      await register(page);

      for (const screen of ['Home', 'Leaderboard', 'Friends', 'Achievements', 'Settings']) {
        await navigateTo(page, screen);
        const r = await overflowReport(page, width);
        assert.equal(r.scrollWidth, r.clientWidth, `${screen} scrolls sideways: ${r.offenders.join(' | ')}`);
      }

      await navigateTo(page, 'Home');
      // Gauntlet, because it is the mode that shows strikes as well as streak.
      await beginRun(page, 'Gauntlet');
      const running = await overflowReport(page, width);
      assert.equal(running.scrollWidth, running.clientWidth, `the question screen scrolls sideways: ${running.offenders.join(' | ')}`);
      await page.close();
    });
  }

  await t.test('a long numeral and a full streak still fit', async () => {
    const width = 390;
    const { page } = await openPage(browser, { width, height: 844 });
    await register(page);
    await beginRun(page, 'Gauntlet');

    // The state a deep run reaches, set directly: six pips beside a two-digit streak, and the
    // longest Roman numeral Gauntlet's 300 questions produce. Reaching it by play would mean
    // answering 288 questions with six right in a row, in a mode that ends after three wrong.
    await page.evaluate((pip) => {
      document.querySelector('.qcard-margin-numeral > span:first-child').textContent = 'CCLXXXVIII';
      const pips = document.querySelector('.streak-pips');
      const number = pips.querySelector('.streak-pips-number');
      number.textContent = '23';
      pips.innerHTML = pip.repeat(6) + number.outerHTML;
    }, PIP_SVG);
    await page.waitForTimeout(200);

    // Guard the guard: if the markup ever changes shape, this test must fail loudly rather
    // than quietly assert nothing.
    assert.equal(await page.locator('.streak-pips svg').count(), 6, 'six pips are on screen');
    assert.match(await page.textContent('.qcard-margin-numeral'), /CCLXXXVIII/);

    const r = await overflowReport(page, width);
    assert.equal(r.scrollWidth, r.clientWidth, `the header row forced the page wider: ${r.offenders.join(' | ')}`);
    await page.close();
  });
});
