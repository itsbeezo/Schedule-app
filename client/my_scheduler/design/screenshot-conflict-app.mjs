// Real-app check of the icon-only conflict badge. Serves ./build (npm run build) and mocks /api with page.route.
//   (cd build && python3 -m http.server 3301 &)   APP_URL=http://localhost:3301 node design/screenshot-conflict-app.mjs
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.APP_URL ?? 'http://localhost:3301';
const day = (d, hm, min) => { const s = new Date(`2026-10-${String(d).padStart(2, '0')}T${hm}:00Z`); return [s.toISOString(), new Date(s.getTime() + min * 60000).toISOString()]; };
const mk = (id, title, d, hm, min, color) => { const [start_at, end_at] = day(d, hm, min); return { id, title, start_at, end_at, kind: 'event', color: color ?? null, notes: null, source: 'manual' }; };
const events = [
  mk('a1', 'Planning review', 5, '10:00', 60), mk('a2', 'Lunch with Sam', 5, '10:30', 60),
  mk('b1', 'Stand-up call', 6, '10:00', 30), mk('b2', 'Quick sync', 6, '10:15', 30, '#7B5CD6'),
  mk('c1', 'Ping', 7, '10:00', 15), mk('c2', 'Pong', 7, '10:00', 15, '#2F8FD6'),
  mk('d1', 'Design crit', 8, '10:00', 60), mk('d2', 'Sprint plan', 8, '10:15', 45, '#7B5CD6'), mk('d3', 'Retro with team', 8, '10:30', 30, '#2F8FD6'),
  mk('e1', 'Allowed overlap', 9, '10:00', 60), mk('e2', 'Other thing', 9, '10:30', 30, '#7B5CD6'),
];
const pair = (a, b, o) => ({ eventAId: a, eventBId: b, overlapStart: o[0], overlapEnd: o[1] });
const active = [pair('a1', 'a2', day(5, '10:30', 30)), pair('b1', 'b2', day(6, '10:15', 15)), pair('c1', 'c2', day(7, '10:00', 15)),
  pair('d1', 'd2', day(8, '10:15', 45)), pair('d1', 'd3', day(8, '10:30', 30)), pair('d2', 'd3', day(8, '10:30', 30))];
const ignored = [{ ...pair('e1', 'e2', day(9, '10:30', 30)), mode: 'allow', ignoreId: 'i1' }];

async function run(browser, width, name, days) {
  const ctx = await browser.newContext({ viewport: { width, height: 700 }, timezoneId: 'UTC' });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-10-07T09:50:00Z'));
  await page.route('**/api/**', (r) => {
    const u = new URL(r.request().url()).pathname;
    const body = u.endsWith('/events') ? events : u.endsWith('/conflicts') ? { active, ignored } : u.endsWith('/settings') ? { timezone: 'UTC' }
      : (u.endsWith('/work-hours') || u.endsWith('/conflict-zones') || u.endsWith('/conflict-ignores')) ? [] : {};
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(base);
  await page.waitForSelector('.fc-timegrid-event');
  await page.waitForTimeout(600);
  const badges = await page.$$eval('.fc-timegrid-event', (els) => els.map((e) => {
    const b = e.querySelector('.conflict-badge'); if (!b) return null;
    const er = e.getBoundingClientRect(), br = b.getBoundingClientRect(), t = e.querySelector('.fc-event-time')?.getBoundingClientRect();
    return { title: e.querySelector('.fc-event-title')?.textContent, eh: Math.round(er.height), bh: Math.round(br.height), bw: Math.round(br.width),
      dLeft: Math.round(br.left - er.left), dTop: Math.round(br.top - er.top), overhang: br.bottom > er.bottom + 0.5 || br.top < er.top - 0.5,
      overlapsTime: !!t && t.width > 0 && br.right > t.left + 0.5 && br.left < t.right,
      hit: Math.round(br.width + 12) + 'x' + Math.round(br.height + 12),
      topmost: (() => { const p = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2); return !!p && (p === b || b.contains(p)); })() };
  }));
  console.log(name, JSON.stringify(badges.filter(Boolean)));
  // scroll the grid so 10:00 is in view
  await page.evaluate(() => { const s = document.querySelector('.fc-scroller-liquid-absolute') ?? document.querySelector('.fc-scroller'); const ev = document.querySelector('.fc-timegrid-event'); if (ev) ev.scrollIntoView({ block: 'center', inline: 'center' }); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(here, 'screenshots', `conflict-app-${name}.png`) });
  // phone shows one day at a time: step through the seeded days via the date strip
  for (const d of days ?? []) {
    await page.locator('.date-strip__cell', { hasText: new RegExp(`^\\D*${d}$`) }).first().click();
    await page.waitForTimeout(500);
    await page.evaluate(() => document.querySelector('.fc-timegrid-event')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(200);
    const vis = await page.$$eval('.fc-timegrid-event', (els) => els.map((e) => { const b = e.querySelector('.conflict-badge'); if (!b) return null; const r = b.getBoundingClientRect(); const p = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { t: e.querySelector('.fc-event-title')?.textContent, visibleOnTop: !!p && b.contains(p) }; }));
    console.log(name, 'day', d, JSON.stringify(vis.filter(Boolean)));
    await page.screenshot({ path: path.join(here, 'screenshots', `conflict-app-${name}-day${d}.png`) });
  }
  await ctx.close();
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
await run(browser, 1280, 'desktop-1280');
await run(browser, 390, 'phone-390', [5, 6, 8, 9]);
await browser.close();
