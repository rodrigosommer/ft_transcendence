/**
 * Loads every screen in headless Chrome and fails if the browser console
 * produces a single error or warning. The subject rejects a project whose
 * console is not clean, so this is checked rather than eyeballed.
 */
import puppeteer from 'puppeteer';

const BASE = process.env.CHECK_BASE ?? 'https://nginx';
const problems = [];
let visited = 0;

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

let current = '(startup)';

page.on('console', (message) => {
  const type = message.type();
  if (type === 'error' || type === 'warning' || type === 'warn') {
    problems.push(`[console.${type}] ${current}: ${message.text()}`);
  }
});
page.on('pageerror', (error) => {
  problems.push(`[pageerror] ${current}: ${error.message}`);
});
page.on('requestfailed', (request) => {
  const failure = request.failure()?.errorText ?? 'failed';
  // Aborted navigations during teardown are not defects.
  if (failure.includes('ERR_ABORTED')) return;
  problems.push(`[requestfailed] ${current}: ${request.url()} (${failure})`);
});
page.on('response', (response) => {
  if (response.status() >= 400 && !response.url().includes('/api/')) {
    problems.push(`[http ${response.status()}] ${current}: ${response.url()}`);
  }
});

/**
 * `domcontentloaded` plus a fixed settle window, deliberately not
 * `networkidle2`. Several screens hold a WebSocket open for the life of the
 * page, and an idle-based wait on those is a coin flip. What this check needs
 * is "the app rendered and ran for a moment", which this gives deterministically.
 */
async function visit(path, label, settleMs = 1200) {
  current = label;
  visited += 1;
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((resolve) => setTimeout(resolve, settleMs));
}

// --- Public screens ---------------------------------------------------------
await visit('/', 'welcome');
await visit('/login', 'login');
await visit('/signup', 'signup');
await visit('/privacy', 'privacy policy');
await visit('/terms', 'terms of service');
await visit('/this-route-does-not-exist', '404');

// --- Sign in, then the authenticated screens --------------------------------
await visit('/login', 'login (for sign-in)');
current = 'sign-in';
await page.type('#field-email', 'ada@wkb.local');
await page.type('#field-password', 'Password1!');
await page.click('button[type="submit"]');
// Signing in is a client-side transition, not a navigation: wait for the app
// to have replaced the form rather than for a page load that never happens.
await page
  .waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 20000 })
  .catch(() => undefined);
await new Promise((resolve) => setTimeout(resolve, 1500));

await visit('/play', 'lobby');
await visit('/room/new', 'create room');
await visit('/tournaments', 'tournaments');
await visit('/leaderboard', 'leaderboard');
await visit('/stats', 'statistics');
await visit('/friends', 'friends');
await visit('/profile', 'profile');
// Reachable directly even for an account that has already been through it,
// which is the only way to load it here: the demo accounts are seeded as
// onboarded, so no redirect sends anyone to it.
await visit('/setup', 'first-run setup');

// --- Language switching is a whole-app re-render -----------------------------
current = 'language switch';
for (const label of ['PT', 'FR', 'EN']) {
  const buttons = await page.$$('button');
  for (const button of buttons) {
    const text = await page.evaluate((el) => el.textContent?.trim(), button);
    if (text === label) {
      await button.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
      break;
    }
  }
}

// --- A real room, which opens both WebSocket channels -----------------------
await visit('/room/new', 'room (websocket)');
await page.type('#field-room-name', 'Console check room');
const submits = await page.$$('button[type="submit"]');
if (submits[0]) {
  await submits[0].click();
  await new Promise((resolve) => setTimeout(resolve, 2500));
  visited += 1;
}

await browser.close();

console.log(`Checked ${visited} screens in headless Chrome.`);
if (problems.length === 0) {
  console.log('Console is clean: no errors, no warnings, no failed requests.');
  process.exit(0);
}
console.log(`\n${problems.length} console problem(s):`);
for (const problem of problems) console.log(`  ${problem}`);
process.exit(1);
