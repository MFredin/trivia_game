import test from 'node:test';
import assert from 'node:assert/strict';
import { answerOne, beginRun, launch, navigateTo, openPage, register } from './harness.mjs';

test('a solo run, end to end', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page, problems } = await openPage(browser);
  await register(page);

  await t.test('the deferred screens load on demand', async () => {
    // Each of these is its own bundle chunk. A failure here means a chunk did not arrive or
    // its Suspense boundary swallowed the screen.
    for (const [label, marker] of [
      ['Leaderboard', /leaderboard|standings|rank/i],
      ['Achievements', /achievement|unlocked/i],
      ['Friends', /friend|members|activity/i],
      ['Settings', /binding|house|theme/i],
    ]) {
      await navigateTo(page, label);
      assert.match(await page.textContent('body'), marker, `${label} did not render`);
    }
    await navigateTo(page, 'Home');
  });

  await t.test('the feedback dialog announces itself and closes on Escape', async () => {
    await page.getByRole('button', { name: 'Submit Feedback' }).first().click();
    await page.waitForSelector('[role=dialog]', { timeout: 10000 });
    const dialog = await page.evaluate(() => {
      const d = document.querySelector('[role=dialog]');
      const labelId = d.getAttribute('aria-labelledby');
      return {
        modal: d.getAttribute('aria-modal'),
        focused: document.activeElement === d,
        label: labelId ? document.getElementById(labelId)?.textContent?.trim() : null,
      };
    });
    assert.equal(dialog.modal, 'true');
    assert.equal(dialog.focused, true, 'focus moved into the dialog');
    assert.ok(dialog.label, 'the dialog is named by its heading');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    assert.equal(await page.locator('[role=dialog]').count(), 0, 'Escape closed it');
  });

  await t.test('ten questions, both lifelines, through to the summary', async () => {
    await beginRun(page, 'Classic');

    // 50-50 leaves the right answer and one wrong one standing, and does not answer for you.
    await page.getByRole('button', { name: /Narrow it down/ }).first().click();
    await page.waitForTimeout(700);
    assert.equal(await page.locator('.choice-button:not([disabled])').count(), 2, '50-50 left two choices');

    let answered = 0;
    let outcome = await answerOne(page);
    answered += 1;

    while (outcome === 'continued' && answered < 15) {
      // Pass answers the question outright rather than leaving it open, so it stands in for
      // the answer rather than preceding it.
      const pass = page.getByRole('button', { name: /Pass this one/ }).first();
      if (answered === 2 && (await pass.count()) && (await pass.isEnabled())) {
        await pass.click();
        const next = page.getByRole('button', { name: /Next question|See results/ }).first();
        await next.waitFor({ timeout: 15000 });
        outcome = (await next.textContent())?.includes('See results') ? 'finished' : 'continued';
        await next.click();
      } else {
        outcome = await answerOne(page);
      }
      answered += 1;
    }

    assert.equal(answered, 10, 'every question in the run was answerable');
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('.choice-button').count(), 0, 'the run screen gave way to the summary');
  });

  await t.test('the browser had nothing to complain about', () => {
    assert.deepEqual(problems, []);
  });
});
