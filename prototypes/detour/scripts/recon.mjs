import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../../../', import.meta.url));
process.env.PLAYWRIGHT_BROWSERS_PATH = `${root}/.playwright-browsers`;
const output = `${root}/artifacts/product-discovery/prototype`;
await mkdir(`${output}/screenshots`, { recursive: true });
const bundled = chromium.executablePath();
const local = join(root, '.playwright-browsers', ...bundled.split(/[\\/]/).slice(-3));
const browser = await chromium.launch({
  channel: 'chromium',
  headless: true,
  executablePath: existsSync(local) ? local : bundled,
});
try {
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  await page.goto('http://127.0.0.1:4174');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${output}/screenshots/00-recon-resume-420.png`, fullPage: true });
  await writeFile(
    `${output}/recon.json`,
    JSON.stringify(
      {
        url: page.url(),
        heading: await page.getByRole('heading', { level: 1 }).allTextContents(),
        buttons: await page.getByRole('button').allTextContents(),
      },
      null,
      2,
    ),
  );
  process.stdout.write(
    JSON.stringify({
      heading: await page.getByRole('heading', { level: 1 }).allTextContents(),
      buttons: await page.getByRole('button').allTextContents(),
    }),
  );
} finally {
  await browser.close();
}
