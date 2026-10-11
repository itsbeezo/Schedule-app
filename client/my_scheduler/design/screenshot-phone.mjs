// Phone one-day view shots against the REAL build with mocked /api. Usage: node design/screenshot-phone.mjs (needs a build served at APP_URL, default :3301)
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.APP_URL ?? 'http://localhost:3301';
const ev = (id, title, s, e, kind = 'event', color = null) => ({ id, title, start_at: `2026-10-07T${s}:00Z`, end_at: `2026-10-07T${e}:00Z`, kind, color, notes: null, source: 'manual' });
const events = [
  ev('1', 'Standup', '09:00', '09:30'), ev('2', 'Call with Alex', '09:00', '09:30', 'event', '#9B6BFF'),
  ev('3', 'Planning', '10:00', '11:30'), ev('4', 'Lunch', '12:30', '13:30', 'time_block'), ev('5', 'Design review', '14:00', '15:00'),
];
const conflicts = { active: [{ eventAId: '1', eventBId: '2', overlapStart: '2026-10-07T09:00:00Z', overlapEnd: '2026-10-07T09:30:00Z' }], ignored: [] };
const wh = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start_time: '09:00', end_time: '17:00' }));
const route = (p) => p.startsWith('/api/events') ? events : p.startsWith('/api/conflicts') ? conflicts : p.startsWith('/api/work-hours') ? wh : [];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const width of [390, 360]) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, timezoneId: 'UTC', deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-10-07T09:50:00Z'));
  await page.route('**/api/**', (r) => r.fulfill({ json: route(new URL(r.request().url()).pathname) }));
  await page.goto(base);
  await page.waitForSelector('.date-strip');
  await page.waitForSelector('.fc-timegrid-event');
  await page.waitForTimeout(500);
  // pick the 6th (Tuesday) then back so selected != today in the strip
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(width, 'horizontal overflow px:', scroll);
  await page.screenshot({ path: path.join(here, 'screenshots', `phone-day-collapsed-${width}.png`) });
  await page.locator('.date-strip__title').click();
  await page.waitForSelector('.date-strip__picker');
  await page.waitForTimeout(250);
  console.log(width, 'picker overflow px:', await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
  await page.screenshot({ path: path.join(here, 'screenshots', `phone-day-picker-${width}.png`) });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Thursday, October 8/ }).first().click().catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(here, 'screenshots', `phone-day-selected-other-${width}.png`) });
  await page.getByRole('button', { name: 'Today' }).click();
  await page.waitForTimeout(300);
  await page.locator('.date-strip__day').nth(1).focus();
  await page.keyboard.press('Tab');
  await page.screenshot({ path: path.join(here, 'screenshots', `phone-day-focus-${width}.png`) });
  await page.locator('.fc-timegrid-event').first().scrollIntoViewIfNeeded();
  await page.locator('.fc-timegrid-event', { hasText: 'Standup' }).screenshot({ path: path.join(here, 'screenshots', `phone-day-badge-${width}.png`) });
  await ctx.close();
}
await browser.close();
