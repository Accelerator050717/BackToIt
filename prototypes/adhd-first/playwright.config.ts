import { chromium, defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = join(root, 'artifacts/adhd-first/browser');
const bundled = chromium.executablePath();
const local = join(root, '.playwright-browsers', ...bundled.split(/[\\/]/).slice(-3));
export default defineConfig({
  testDir: './browser',
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: `${output}/results.json` }],
    ['html', { outputFolder: `${output}/report`, open: 'never' }],
  ],
  outputDir: `${output}/results`,
  use: {
    baseURL: 'http://127.0.0.1:4178',
    headless: true,
    viewport: { width: 420, height: 900 },
    launchOptions: { executablePath: existsSync(local) ? local : bundled },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node prototypes/adhd-first/scripts/serve-built.mjs',
    cwd: root,
    url: 'http://127.0.0.1:4178',
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
