import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 10000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'artifacts/playwright-report', open: 'never' }],
    ['json', { outputFile: 'artifacts/e2e-results.json' }],
  ],
  outputDir: 'artifacts/test-results',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
