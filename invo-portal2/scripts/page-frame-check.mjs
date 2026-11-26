// Page-frame layout check.
//
// Visits a set of shell routes of different types and verifies the page-frame contract (see the comment on
// `.page-frame` in core/layout/main-layout.component.ts):
//   • the frame gives every `fluid` / `form` page the same gutters, and no page adds a second one ("doubled gutter":
//     the page's real content starts more than the gutter inside the frame);
//   • `form` pages are left-aligned (never auto-centered) and capped at the shared token;
//   • in settings mode there is exactly one rail and the frame starts at the same x on every page;
//   • exactly one <h1> per page (the page header's; the appointments calendar has a visually hidden one).
//
// A dev tool: `playwright` is a devDependency, but this is NOT part of the default build, `npm test` or `npm run verify`.
// Run it by hand against a running dev server:
//   npx playwright install chromium   (once)
//   BASE_URL=http://localhost:4700 npm run check:layout
// The app needs a signed-in session: set STORAGE_STATE to a Playwright storage-state JSON, or run it headed and log in.
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:4700';
const GUTTER = 24;
const ROUTES = [
  // [path, expected mode]
  ['/dashboard', 'fluid'], ['/products/list', 'fluid'], ['/account/invoices', 'fluid'], ['/employees', 'fluid'],
  ['/reports', 'fluid'], ['/analytics', 'fluid'], ['/account/invoices/new', 'fluid'],
  ['/account/customers/new', 'form'], ['/employees/privileges/new', 'form'], ['/blog/settings', 'form'],
  ['/domain-settings', 'form'], ['/account/opening-balances', 'form'], ['/products/product-recipe', 'form'],
  ['/appointments', 'bleed'], ['/reports/view/profit-and-loss', 'bleed'], ['/blog/categories', 'form'], ['/website-settings', 'fluid'], ['/tracking-map', 'bleed'], ['/account/chart-of-accounts/new', 'narrow'],
  ['/settings/business', 'form'], ['/settings/branches', 'fluid'], ['/settings/notifications', 'fluid'],
  ['/settings/pos-options', 'form'], ['/promotions/customer-tiers', 'form'], ['/promotions/coupons', 'fluid'],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1916, height: 1000 }, storageState: process.env.STORAGE_STATE });
const page = await ctx.newPage();
const failures = [];
const rows = [];

for (const [url, expected] of ROUTES) {
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.page-frame', { state: 'attached', timeout: 15000 });
  await page.waitForTimeout(2500);
  const m = await page.evaluate(() => {
    const fr = document.querySelector('.page-frame');
    const cont = fr.querySelector('.page-frame__content');
    const host = [...cont.children].find(c => c.tagName !== 'ROUTER-OUTLET');
    const box = e => e.getBoundingClientRect();
    // where the page's content REALLY starts: the first sized, visible element inside the page host
    let first = null;
    if (host) {
      const w = document.createTreeWalker(host, NodeFilter.SHOW_ELEMENT); let n;
      while ((n = w.nextNode())) { const b = box(n); const c = getComputedStyle(n); if (b.width > 40 && b.height > 8 && c.display !== 'contents') { first = n; break; } }
    }
    const rail = document.querySelectorAll('app-settings-submenu');
    return {
      mode: fr.dataset.width, frameLeft: box(fr).left, frameTop: box(fr).top, contentLeft: box(cont).left, contentTop: box(cont).top,
      contentRight: box(cont).right, frameRight: box(fr).right, firstLeft: first ? box(first).left : null, firstTop: first ? box(first).top : null,
      centered: first ? getComputedStyle(first).marginLeft !== '0px' && getComputedStyle(first).marginLeft === getComputedStyle(first).marginRight : false,
      rails: rail.length, h1: document.querySelectorAll('.page-frame h1').length,
    };
  });
  rows.push({ url, ...m });
  const fail = msg => failures.push(`${url}: ${msg}`);
  if (m.mode !== expected) fail(`mode ${m.mode}, expected ${expected}`);
  if (m.mode !== 'bleed') {
    const gap = Math.round(m.contentLeft - m.frameLeft); if (gap !== GUTTER) fail(`frame gutter ${gap}px, expected ${GUTTER}px`);
    if (m.firstLeft !== null && Math.round(m.firstLeft - m.contentLeft) > 1) fail(`doubled gutter: content starts ${Math.round(m.firstLeft - m.contentLeft)}px inside the frame`);
    if (m.firstTop !== null && Math.round(m.firstTop - m.contentTop) > 1) fail(`doubled top gutter: content starts ${Math.round(m.firstTop - m.contentTop)}px below the frame top`);
    if (m.centered) fail('page is auto-centered');
  }
  if (m.rails > 1) fail(`${m.rails} settings rails`);
  // Every page ends up with exactly one <h1> (the page header's; appointments has a visually hidden one).
  if (m.h1 !== 1) fail(`${m.h1} <h1> elements, expected exactly 1`);
}
await browser.close();

console.table(rows);
if (failures.length) { console.error('\nFAILED:\n' + failures.map(f => ' - ' + f).join('\n')); process.exit(1); }
console.log('\nPage frame OK for', rows.length, 'routes');
