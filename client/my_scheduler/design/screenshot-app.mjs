import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.APP_URL ?? 'http://localhost:3000';
const widths = [1280, 768, 390];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(base);
  await page.waitForSelector('.fc-timegrid');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(here, 'screenshots', `app-${width}.png`), fullPage: true });

  await page.getByRole('button', { name: 'Add event' }).first().click();
  await page.waitForSelector('.dialog');
  await page.screenshot({ path: path.join(here, 'screenshots', `app-dialog-${width}.png`) });
  await page.keyboard.press('Escape');
  await page.close();
}
await browser.close();
console.log('wrote app screenshots');
