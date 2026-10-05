import test from 'node:test';
import assert from 'node:assert/strict';
import { launch, openPage, passAgeGate } from './harness.mjs';

test('registration asks for age first, and turns under-13s away without keeping anything', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page } = await openPage(browser);
  const thisYear = new Date().getFullYear();

  await page.getByRole('button', { name: /Need an account\? Register/ }).click();

  await t.test('the age question comes before any other field, and starts empty', async () => {
    await page.getByLabel('Month').waitFor();
    assert.equal(await page.locator('input[type=email]').count(), 0, 'no email field yet');
    assert.equal(await page.getByLabel('Month').inputValue(), '');
    assert.equal(await page.getByRole('button', { name: 'Continue' }).isDisabled(), true);
  });

  await t.test('someone under 13 sees why, and no form', async () => {
    await passAgeGate(page, { month: '1', year: String(thisYear - 10) });
    await page.getByText(/for players aged 13 and over/).waitFor();
    assert.equal(await page.locator('input[type=email]').count(), 0);
    assert.equal(await page.locator('input[type=password]').count(), 0);
  });

  await t.test('going back and trying again does not get further', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Need an account\? Register/ }).click();
    await page.getByText(/for players aged 13 and over/).waitFor();
    assert.equal(await page.getByLabel('Month').count(), 0, 'not even asked again');
  });

  await t.test('only a timestamp is kept in the browser, with no date of birth', async () => {
    const stored = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    assert.deepEqual(Object.keys(stored), ['trivia_age_gate']);
    assert.match(stored.trivia_age_gate, /^\d+$/);
  });

  await t.test('after the flag lapses an adult can register as usual', async () => {
    await page.evaluate(() => localStorage.removeItem('trivia_age_gate'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Need an account\? Register/ }).click();
    await passAgeGate(page);
    await page.locator('input[type=email]').waitFor();
  });
});
