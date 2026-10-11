import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const c of ['coral', 'red', 'amber']) {
  for (const theme of ['dark', 'light']) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 520 } });
    await page.goto(pathToFileURL(path.join(here, 'mockups/conflict-colors.html')).href + `?c=${c}&theme=${theme}`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(here, 'screenshots', `conflict-${c}-${theme}.png`), fullPage: true });
    await page.close();
  }
}
await browser.close();
console.log('wrote conflict screenshots');
