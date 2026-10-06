import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { BASE_URL, launch, navigateTo, openPage, register } from './harness.mjs';

// The dev mailer appends every message to this file when the API is started with MAIL_OUTBOX_FILE
// (CI does; locally, start the API with it set). Nothing is sent anywhere.
const OUTBOX = process.env.MAIL_OUTBOX_FILE;

function linkSentTo(email, query) {
  assert.ok(OUTBOX && existsSync(OUTBOX), 'MAIL_OUTBOX_FILE must be set, for the API and for this test');
  const messages = readFileSync(OUTBOX, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  const mine = messages.filter((m) => m.to === email);
  const link = mine.at(-1)?.text.match(/https?:\/\/\S+/)?.[0];
  assert.ok(link, `no message was sent to ${email}`);
  assert.ok(link.includes(`?${query}=`), `the link should carry ?${query}=, got ${link}`);
  // The app is served from BASE_URL here, whatever address the API puts in its mail.
  return `${BASE_URL}/${link.slice(link.indexOf('?'))}`;
}

async function logOut(page) {
  await navigateTo(page, 'Log out');
  await page.locator('input[type=email]').waitFor();
}

test('a forgotten password can be reset from the emailed link, once', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page, problems } = await openPage(browser);
  const name = await register(page);
  const email = `${name}@test.invalid`;
  await logOut(page);

  await t.test('the login screen offers a way back in, and the answer does not depend on the address', async () => {
    await page.getByRole('button', { name: 'Forgot your password?' }).click();
    await page.getByRole('heading', { name: 'Forgot your password?' }).waitFor();
    await page.locator('input[type=email]').fill(email);
    await page.getByRole('button', { name: 'Send the link' }).click();
    await page.getByText(/If that address has an account/).waitFor();
  });

  let link;
  await t.test('the link opens a page to choose a new password, and leaves no token in the address bar', async () => {
    link = linkSentTo(email, 'reset');
    await page.goto(link, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Choose a new password' }).waitFor();
    assert.equal(new URL(page.url()).search, '', 'the token is removed from the address');
  });

  await t.test('two different passwords are refused, matching ones are saved', async () => {
    const [first, second] = await page.locator('input[type=password]').all();
    await first.fill('a brand new password');
    await second.fill('something else entirely');
    await page.getByRole('button', { name: 'Change password' }).click();
    await page.getByText('Those two passwords are not the same.').waitFor();
    await second.fill('a brand new password');
    await page.getByRole('button', { name: 'Change password' }).click();
    await page.getByText(/Your password has been changed/).waitFor();
  });

  await t.test('the new password logs in and the old one does not', async () => {
    await page.getByRole('button', { name: 'Log in' }).click();
    const signIn = async (password) => {
      await page.locator('input[type=email]').fill(email);
      await page.locator('input[type=password]').fill(password);
      await page.getByRole('button', { name: 'Log in', exact: true }).click();
    };
    await signIn('password123');
    await page.getByText('Wrong email or password.').waitFor();
    await signIn('a brand new password');
    await page.waitForSelector('.mode-spine-title', { timeout: 20000 });
  });

  await t.test('the same link will not work a second time', async () => {
    await page.goto(link, { waitUntil: 'networkidle' });
    await page.locator('input[type=password]').first().waitFor();
    const [first, second] = await page.locator('input[type=password]').all();
    await first.fill('yet another password');
    await second.fill('yet another password');
    await page.getByRole('button', { name: 'Change password' }).click();
    await page.getByText(/expired or has already been used/).waitFor();
  });

  // Expected 4xx from the deliberately wrong attempts above are not failures of the page.
  const unexpected = problems.filter((p) => !/http (400|401|403|404) /.test(p) && !/Failed to load resource: .*\b(400|401|403|404)\b/.test(p));
  assert.deepEqual(unexpected, []);
});

test('an account can be deleted from the footer page and an emailed link', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const { page } = await openPage(browser);
  const name = await register(page);
  const email = `${name}@test.invalid`;
  await logOut(page);

  await t.test('the page is reachable from the foot of the login screen and explains what is removed', async () => {
    await page.getByRole('button', { name: 'Delete your account' }).click();
    await page.getByRole('heading', { name: 'Delete your account' }).waitFor();
    assert.match(await page.textContent('body'), /Deleted player/);
    assert.match(await page.textContent('body'), /Delete my account/);
  });

  await t.test('asking for the link says the same thing whether or not the address has an account', async () => {
    await page.locator('input[type=email]').fill(email);
    await page.getByRole('button', { name: 'Send me the link' }).click();
    await page.getByText(/If that address has an account/).waitFor();
  });

  await t.test('the link names the account and nothing is deleted until the button is pressed', async () => {
    await page.goto(linkSentTo(email, 'delete'), { waitUntil: 'networkidle' });
    await page.getByText(name).waitFor();
    await page.getByRole('button', { name: 'No, keep it' }).click();
    await page.locator('input[type=email]').waitFor();
  });

  await t.test('confirming deletes it, and logging in no longer works', async () => {
    await page.goto(linkSentTo(email, 'delete'), { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Yes, delete my account' }).click();
    await page.getByText('Your account has been deleted.').waitFor();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill('password123');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await page.getByText('Wrong email or password.').waitFor();
  });
});
