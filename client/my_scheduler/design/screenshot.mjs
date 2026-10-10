import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] ?? 'mockups/cp1-calendar.html';
const name = path.basename(target, path.extname(target));
const widths = [1280, 768, 390];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(pathToFileURL(path.join(here, target)).href);
  await page.waitForLoadState('networkidle');
  const out = path.join(here, 'screenshots', `${name}-${width}.png`);
  await page.screenshot({ path: out, fullPage: true });
  console.log(`wrote ${out}`);
  await page.close();
}
await browser.close();
