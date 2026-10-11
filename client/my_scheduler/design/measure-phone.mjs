// Prints vertical offsets of the phone layout pieces. Usage: node design/measure-phone.mjs (build served at APP_URL, default :3301)
import { chromium } from 'playwright';
const base = process.env.APP_URL ?? 'http://localhost:3301';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const width of [390, 360]) {
  const page = await (await browser.newContext({ viewport: { width, height: 800 }, timezoneId: 'UTC' })).newPage();
  await page.route('**/api/**', (r) => r.fulfill({ json: new URL(r.request().url()).pathname.startsWith('/api/conflicts') ? { active: [], ignored: [] } : [] }));
  await page.goto(base);
  await page.waitForSelector('.date-strip');
  await page.waitForSelector('.fc-timegrid-slot');
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    const top = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; };
    return { header: top('.app-header'), strip: top('.date-strip'), title: top('.date-strip__title'), today: top('.date-strip__today'), week: top('.date-strip__week'), grid: top('.calendar-grid'), scrollgrid: top('.fc-scrollgrid'), body: top('.fc-timegrid-body'), slot: top('.fc-timegrid-slot'), scroller: (() => { const r = document.querySelector('.fc-timegrid-body').closest('.fc-scroller').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; })(), allday: top('.fc-timegrid-allday'), thead: top('.fc-scrollgrid thead'), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  console.log(width, JSON.stringify(m));
}
await browser.close();
