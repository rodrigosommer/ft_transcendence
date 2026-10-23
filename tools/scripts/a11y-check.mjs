/**
 * The measurements the README claims, run rather than asserted.
 *
 * Four things, over every route, both themes:
 *   - WCAG AA contrast for every visible text node, against the colour
 *     actually painted behind it rather than the one its parent declares
 *   - WCAG 2.2 SC 2.5.8: every interactive target at least 24x24
 *   - no horizontal overflow, from a 320px phone to a 1440px desktop
 *   - the browser's Back and Forward buttons, which the subject requires
 *
 * Separate from `make test` on purpose: it loads a couple of hundred pages and
 * takes a few minutes, where the console check has to stay quick enough to run
 * after every change. Run it with `make a11y`.
 */
import puppeteer from 'puppeteer';

const BASE = process.env.CHECK_BASE ?? 'https://nginx';
const ROUTES = ['/', '/login', '/signup', '/setup', '/play', '/room/new', '/tournaments',
                '/leaderboard', '/stats', '/friends', '/profile', '/privacy', '/terms',
                // The 404 is a screen like any other and owes the same contrast.
                '/this-route-does-not-exist'];
const WIDTHS = [320, 360, 414, 640, 768, 1024, 1280, 1440];

const problems = [];
const report = (name, found) => {
  if (found.length === 0) {
    console.log(`  ok   ${name}`);
    return;
  }
  problems.push(...found);
  console.log(` FAIL  ${name} — ${found.length} problem(s)`);
  for (const line of found.slice(0, 8)) console.log(`         ${line}`);
  if (found.length > 8) console.log(`         …and ${found.length - 8} more`);
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1360, height: 950 });

// Signed in, because most of the routes are behind the session.
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await wait(900);
await page.type('#field-email', 'ada@wkb.local');
await page.type('#field-password', 'Password1!');
await page.click('button[type="submit"]');
await page.waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 20000 });
await wait(1200);

// --- Back and Forward -------------------------------------------------------
const path = () => new URL(page.url()).pathname;
const history = [];
for (const route of ['/leaderboard', '/stats', '/friends']) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
  await wait(700);
}
await page.goBack({ waitUntil: 'domcontentloaded' });
await wait(700);
if (path() !== '/stats') history.push(`Back landed on ${path()}, expected /stats`);
await page.goForward({ waitUntil: 'domcontentloaded' });
await wait(700);
if (path() !== '/friends') history.push(`Forward landed on ${path()}, expected /friends`);
report('the browser Back and Forward buttons work', history);

// --- Contrast ---------------------------------------------------------------
const CONTRAST = `(() => {
  const parse = (value) => {
    const n = value.match(/[\\d.]+/g);
    return n ? { r: +n[0], g: +n[1], b: +n[2], a: n.length > 3 ? +n[3] : 1 } : null;
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const luminance = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  // What is really behind the node: walk up compositing every background until
  // one is opaque. A declared colour on the node's own parent is not enough.
  const painted = (el) => {
    let acc = null;
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (!c || c.a === 0) continue;
      acc = acc ? over(acc, c) : c;
      if (acc.a === 1) return acc;
    }
    return acc || { r: 255, g: 255, b: 255, a: 1 };
  };

  const bad = [];
  for (const el of document.querySelectorAll('body *')) {
    // Only nodes that own text, so a wrapper is not measured for its children.
    if (el.children.length && ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const text = el.textContent.trim();
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    const fg = parse(cs.color);
    if (!fg || fg.a === 0) continue;
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && (+cs.fontWeight || 400) >= 700);
    const need = large ? 3 : 4.5;
    const bg = painted(el);
    const measured = ratio(over(fg, bg), bg);
    if (measured < need) bad.push(\`"\${text.slice(0, 30)}" \${measured.toFixed(2)}:1 needs \${need}\`);
  }
  return bad;
})()`;

for (const theme of ['light', 'dark']) {
  const bad = [];
  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => { localStorage.setItem('wkb.theme', t); }, theme);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await wait(1100);
    for (const line of await page.evaluate(CONTRAST)) bad.push(`${theme} ${route}: ${line}`);
  }
  report(`every text node meets WCAG AA in the ${theme} theme`, bad);
}
await page.evaluate(() => { localStorage.removeItem('wkb.theme'); });

// --- Target size ------------------------------------------------------------
const TARGETS = `(() => {
  const small = [];
  const selector = 'a[href], button, input:not([type=hidden]), select, textarea, [role=radio], [role=button]';
  for (const el of document.querySelectorAll(selector)) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    let box = el.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    // A control wrapped in a padded label is hit by pressing the label.
    const label = el.closest('label');
    if (label) box = label.getBoundingClientRect();
    // SC 2.5.8 exempts a link whose target is inline in a sentence.
    if (el.tagName === 'A' && cs.display.includes('inline')) {
      const parent = el.parentElement;
      if (parent && parent.textContent.trim().length > el.textContent.trim().length + 4) continue;
    }
    if (box.width < 24 || box.height < 24) {
      const name = (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24);
      small.push(\`\${el.tagName.toLowerCase()} "\${name}" \${Math.round(box.width)}x\${Math.round(box.height)}\`);
    }
  }
  return small;
})()`;

await page.setViewport({ width: 1360, height: 950 });
const tiny = [];
for (const route of ROUTES) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
  await wait(800);
  for (const line of await page.evaluate(TARGETS)) tiny.push(`${route}: ${line}`);
}
report('every interactive target clears 24x24 (WCAG 2.2 SC 2.5.8)', tiny);

// --- Horizontal overflow ----------------------------------------------------
const wide = [];
for (const width of WIDTHS) {
  await page.setViewport({ width, height: 900 });
  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await wait(650);
    const extra = await page.evaluate(() =>
      Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
    if (extra > 0) wide.push(`${route} @${width}px overflows by ${extra}px`);
  }
}
report(`no horizontal overflow, ${ROUTES.length} routes x ${WIDTHS.length} widths`, wide);

await browser.close();
console.log(`\nChecked ${ROUTES.length} routes in both themes at ${WIDTHS.length} widths.`);
if (problems.length === 0) {
  console.log('Accessibility measurements pass.');
  process.exit(0);
}
console.log(`${problems.length} problem(s).`);
process.exit(1);
