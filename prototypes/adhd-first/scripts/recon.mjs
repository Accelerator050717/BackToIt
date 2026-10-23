import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(join(root, 'package.json'));
const { chromium } = require('@playwright/test');
const bundled = chromium.executablePath();
const local = join(root, '.playwright-browsers', ...bundled.split(/[\\/]/).slice(-3));
const directory = join(root, 'artifacts/adhd-first/recon');
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: existsSync(local) ? local : bundled,
});
try {
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const errors = [],
    external = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4178')) external.push(r.url());
  });
  await page.goto('http://127.0.0.1:4178');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: join(directory, '01-home-420.png'), fullPage: true });
  const before = await page.locator('main').innerText();
  await page.getByRole('button', { name: '我卡住了', exact: true }).click();
  await page.getByRole('button', { name: /想刷点别的/ }).click();
  await page.getByRole('button', { name: '放入第 1 片', exact: true }).click();
  await page.waitForTimeout(300); // Inspect settled user-triggered feedback.
  await page.screenshot({ path: join(directory, '02-spark-piece-420.png'), fullPage: true });
  const data = await page.evaluate(async () => ({
    localStorage: Object.keys(localStorage),
    indexedDB: (await indexedDB.databases()).map((x) => x.name),
  }));
  await writeFile(
    join(directory, 'recon.json'),
    JSON.stringify(
      {
        type: 'Actual browser reconnaissance, synthetic data, not human research',
        before,
        errors,
        external,
        data,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ heading: await page.locator('main h1').innerText(), errors, external, data }));
} finally {
  await browser.close();
}
