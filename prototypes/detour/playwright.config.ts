import { chromium, defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
const output = fileURLToPath(new URL('../../artifacts/product-discovery/prototype', import.meta.url));
const bundled = chromium.executablePath();
const local = join(
  fileURLToPath(new URL('../../.playwright-browsers', import.meta.url)),
  ...bundled.split(/[\\/]/).slice(-3),
);
export default defineConfig({
  testDir: './browser',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: `${output}/browser-results.json` }],
    ['html', { outputFolder: `${output}/browser-report`, open: 'never' }],
  ],
  outputDir: `${output}/browser-test-results`,
  use: {
    baseURL: 'http://127.0.0.1:4174',
    channel: 'chromium',
    headless: true,
    launchOptions: { executablePath: existsSync(local) ? local : bundled },
    viewport: { width: 420, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node prototypes/detour/scripts/tool.mjs preview',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: true,
    timeout: 20_000,
  },
});
