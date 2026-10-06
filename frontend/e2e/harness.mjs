import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';

// Where the browser is. CI lets Playwright use the copy it installed itself; this sandbox
// has one preinstalled and no network to fetch another, so it is pointed at that. An empty
// PLAYWRIGHT_CHROMIUM means "whatever Playwright would pick on its own".
const EXECUTABLE_PATH = (() => {
  if (process.env.PLAYWRIGHT_CHROMIUM !== undefined) return process.env.PLAYWRIGHT_CHROMIUM || undefined;
  return existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined;
})();

export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5175';

// A phone, because that is what most of this game is played on and what the layout rules
// were measured against.
export const PHONE = { width: 390, height: 844 };

export async function launch() {
  return chromium.launch({
    ...(EXECUTABLE_PATH ? { executablePath: EXECUTABLE_PATH } : {}),
    args: ['--ignore-certificate-errors'],
  });
}

/**
 * A page that records everything the browser complained about, so a test can assert on a
 * clean console rather than only on what it thought to look for.
 */
export async function openPage(browser, viewport = PHONE) {
  const page = await browser.newPage({ viewport });
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`http ${r.status()} ${r.request().method()} ${r.url()}`);
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  return { page, problems };
}

export function uniqueName(prefix = 'e2e') {
  return `${prefix}${Math.random().toString(36).slice(2, 9)}`;
}

/** Answers the age question that begins registration, as an adult unless told otherwise. */
export async function passAgeGate(page, { month = '6', year = String(new Date().getFullYear() - 30) } = {}) {
  await page.getByLabel('Month').selectOption(month);
  await page.getByLabel('Year').selectOption(year);
  await page.getByRole('button', { name: 'Continue' }).click();
}

/** Registers a new player through the UI and lands on the start screen. */
export async function register(page, username = uniqueName()) {
  await page.getByRole('button', { name: /Need an account\? Register/ }).click();
  await passAgeGate(page);
  await page.locator('input[type=email]').fill(`${username}@test.invalid`);
  await page.locator('input[type=text]').fill(username);
  await page.locator('input[type=password]').fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Registration is rate limited per IP (10 per 15 minutes), which a suite re-run inside that
  // window will hit. Surfacing it beats a bare 20-second timeout on a selector, which says
  // nothing about why the start screen never arrived.
  const arrived = page.waitForSelector('.mode-spine-title', { timeout: 20000 });
  const refused = page
    .waitForSelector('.error-banner', { timeout: 20000 })
    .then(async (el) => {
      throw new Error(`registration refused: ${(await el.textContent())?.trim()}`);
    });
  await Promise.race([arrived, refused.catch((e) => Promise.reject(e))]);
  return username;
}

// Settings, the profile and Log out live behind the avatar menu; everything else is a link in
// the running header.
const ACCOUNT_MENU_ITEMS = ['Settings', 'Edit profile', 'My profile', 'Manage titles', 'Manage team', 'Review reports', 'Review questions', 'Log out'];

export async function navigateTo(page, label) {
  if (label === 'Owl Post') {
    // The envelope in the running header, named with its unread count when there is one.
    await page.getByRole('button', { name: /^Owl Post/ }).click();
  } else if (ACCOUNT_MENU_ITEMS.includes(label)) {
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: label }).click();
  } else {
    await page.locator('.running-nav button', { hasText: new RegExp(`^${label}$`) }).first().click();
  }
  await page.waitForTimeout(600);
}

/** Opens one section of Settings or Edit Profile (they show one at a time) and waits for it to be the current one. */
export async function openSection(page, name) {
  const tab = page.getByRole('tab', { name: new RegExp(`^${name}`) });
  await tab.click();
  await page.waitForSelector(`[role=tab][aria-selected=true]:has-text("${name}")`);
}

/** Picks a mode on the start screen and begins the run. */
export async function beginRun(page, mode = 'Classic') {
  await page.locator('.mode-spine-title', { hasText: new RegExp(mode, 'i') }).first().click();
  await page.waitForTimeout(300);
  await page.locator('button[type=submit].primary-button').first().click();
  await page.waitForSelector('.choice-button', { timeout: 20000 });
}

/**
 * Answers the question on screen and dismisses the reveal.
 * Returns 'continued' or 'finished' — the reveal's own button is what knows which.
 */
export async function answerOne(page) {
  await page.waitForSelector('.choice-button:not([disabled])', { timeout: 15000 });
  await page.locator('.choice-button:not([disabled])').first().click();
  const next = page.getByRole('button', { name: /Next question|See results/ }).first();
  await next.waitFor({ timeout: 15000 });
  const finished = (await next.textContent())?.includes('See results');
  await next.click();
  return finished ? 'finished' : 'continued';
}
