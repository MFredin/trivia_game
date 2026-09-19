import test from 'node:test';
import assert from 'node:assert/strict';
import { launch, openPage, register, navigateTo, answerOne } from './harness.mjs';

/**
 * A duel needs two browsers, which is why it had no coverage until the App.jsx split made it
 * the riskiest thing in the repo to change: the socket handler that starts a duel used to set
 * fifteen pieces of run state by hand, and nothing but playing a duel would have caught it
 * going wrong.
 */
test('a duel between two players', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());

  const challenger = await openPage(browser);
  const opponent = await openPage(browser);
  const challengerName = await register(challenger.page);
  const opponentName = await register(opponent.page);

  await t.test('an invitation reaches the opponent over the socket', async () => {
    await navigateTo(challenger.page, 'Friends');
    await challenger.page.getByRole('button', { name: 'Search', exact: true }).click();
    await challenger.page.getByLabel('Search members by username').fill(opponentName);
    await challenger.page.waitForSelector('.friend-list .primary-button', { timeout: 15000 });
    await challenger.page.getByRole('button', { name: 'Challenge' }).first().click();

    // The lobby: pick nothing, just send.
    await challenger.page.waitForSelector('button:has-text("Send")', { timeout: 10000 });
    await challenger.page.getByRole('button', { name: /Send/ }).first().click();

    // The opponent is on their start screen and gets a banner pushed to them.
    await opponent.page.waitForSelector('.duel-invite-banner', { timeout: 20000 });
    assert.match(await opponent.page.textContent('.duel-invite-banner'), new RegExp(challengerName));
  });

  await t.test('accepting starts a run in both browsers', async () => {
    await opponent.page.getByRole('button', { name: 'Accept' }).click();
    // The acceptor is answering the request, so they get their run in the response.
    await opponent.page.waitForSelector('.choice-button', { timeout: 20000 });
    // The challenger is not making a request at all — their run arrives over the socket, via
    // the same run.begin() the acceptor used.
    await challenger.page.waitForSelector('.choice-button', { timeout: 20000 });

    for (const p of [challenger.page, opponent.page]) {
      assert.equal(await p.locator('.duel-strip').count(), 1, 'the opponent strip is showing');
    }
  });

  await t.test('a reaction travels from one player to the other', async () => {
    await challenger.page.locator('.duel-reaction-btn', { hasText: 'Good luck' }).first().click();
    await opponent.page.waitForSelector('.duel-reaction-incoming', { timeout: 15000 });
    const shown = await opponent.page.textContent('.duel-reaction-incoming');
    assert.match(shown, /Good luck/);
    assert.match(shown, new RegExp(challengerName), 'the reaction says who sent it');
  });

  await t.test('both players finish and see a duel result', async () => {
    for (const page of [challenger.page, opponent.page]) {
      let outcome = 'continued';
      let answered = 0;
      while (outcome === 'continued' && answered < 15) {
        outcome = await answerOne(page);
        answered += 1;
      }
      assert.equal(outcome, 'finished', 'the duel run reported itself complete');
    }

    for (const page of [challenger.page, opponent.page]) {
      // The duel summary, not the solo one: a duel ends somewhere different, which is the
      // decision App makes and the run hook deliberately does not.
      await page.waitForFunction(() => /You|Opponent|won|lost|draw/i.test(document.body.textContent), null, {
        timeout: 20000,
      });
      assert.equal(await page.locator('.choice-button').count(), 0);
    }
  });

  await t.test('neither browser had anything to complain about', () => {
    assert.deepEqual(challenger.problems, [], 'challenger console');
    assert.deepEqual(opponent.problems, [], 'opponent console');
  });
});
