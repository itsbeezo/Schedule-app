import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
// Coral default (dark clock and dark "!"), plus the red/amber options.
const jobs = [];
for (const c of ['coral', 'red', 'amber']) for (const theme of ['dark', 'light']) jobs.push([c, theme, 'plain', `conflict-${c}-${theme}.png`]);
for (const [c, theme, bang, file] of jobs) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(path.join(here, 'mockups/conflict-colors.html')).href + `?c=${c}&theme=${theme}&bang=${bang}`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(here, 'screenshots', file), fullPage: true });
  await page.close();
}
await browser.close();
console.log('wrote conflict screenshots');
