import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(path.join(here, 'mockups/month-more.html')).href;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const width of [1280, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 800 }, deviceScaleFactor: 2 });
  await page.goto(url);
  await page.waitForSelector('.fc-daygrid-more-link');
  await page.screenshot({ path: path.join(here, 'screenshots', `month-more-link-${width}.png`) });
  await page.locator('.fc-daygrid-more-link').first().focus();
  await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  await page.screenshot({ path: path.join(here, 'screenshots', `month-more-focus-${width}.png`) });
  await page.locator('.fc-daygrid-more-link').first().click();
  await page.waitForSelector('.fc-more-popover');
  await page.screenshot({ path: path.join(here, 'screenshots', `month-more-popover-${width}.png`) });
  const box = await page.locator('.fc-daygrid-more-link').first().boundingBox();
  console.log(width, 'more-link box', box);
  await page.close();
}
await browser.close();
