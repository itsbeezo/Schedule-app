import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.APP_URL ?? 'http://localhost:3000';
// A fixed clock keeps the seeded week (Mon conflict, Wed allowed overlap, Fri zone) in view with a now-line.
const now = new Date(process.env.SHOT_TIME ?? '2026-10-07T09:50:00Z');
const widths = [1280, 768, 390];
const shot = (page, name) => page.screenshot({ path: path.join(here, 'screenshots', name) });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const width of widths) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'UTC' });
  const page = await context.newPage();
  await page.clock.setFixedTime(now);
  await page.goto(base);
  await page.waitForSelector('.fc-timegrid');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(here, 'screenshots', `app-${width}.png`), fullPage: true });

  await page.getByRole('button', { name: 'Add event' }).first().click();
  await page.waitForSelector('.dialog');
  await shot(page, `app-dialog-${width}.png`);
  await page.keyboard.press('Escape');

  const badge = page.locator('.conflict-badge').first();
  if (await badge.count()) {
    await badge.scrollIntoViewIfNeeded();
    await badge.click();
    await page.waitForSelector('.popover');
    await shot(page, `app-popover-${width}.png`);
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForSelector('.settings');
  await page.waitForTimeout(400);
  await shot(page, `app-settings-${width}.png`);
  await page.evaluate(() => { const s = document.querySelector('.settings'); s.scrollTop = s.scrollHeight; });
  await page.waitForTimeout(200);
  await shot(page, `app-settings-scrolled-${width}.png`);
  await context.close();
}
await browser.close();
console.log('wrote app screenshots');
