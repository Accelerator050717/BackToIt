import { chromium } from '@playwright/test';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:http';

// Uses the real production build, a fresh profile, real native commands, and a loopback fixture.
// It never mutates permissions, invokes extension event listeners, or changes browser security.
const directory = resolve('artifacts/entrypoint-diagnostic');
await mkdir(directory, { recursive: true });
const profile = await mkdtemp(resolve(directory, 'profile-'));
const server = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end('<!doctype html><title>Entry point fixture</title><p>Only synthetic saved content.</p>');
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const address = server.address();
const base = `http://127.0.0.1:${address.port}`;
const build = resolve('.output/chrome-mv3');
const report = { browser: null, source: 'real production build', observations: [] };
let context;
try {
  const bundled = chromium.executablePath();
  const projectBrowser = resolve('.playwright-browsers', bundled.split(/[\\/]/).slice(-3).join('/'));
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    executablePath: existsSync(projectBrowser) ? projectBrowser : bundled,
    headless: true,
    args: [
      `--disable-extensions-except=${build}`,
      `--load-extension=${build}`,
      '--enable-unsafe-extension-debugging',
    ],
  });
  report.browser = context.browser().version();
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const id = new URL(worker.url()).hostname;
  const ui = await context.newPage();
  await ui.goto(`chrome-extension://${id}/app.html`);
  const tab = await context.newPage();
  await tab.goto(base);
  const observe = async (label) => {
    const result = await worker.evaluate(async () => ({
      tabs: (await chrome.tabs.query({ active: true, currentWindow: true })).map((item) => ({
        id: item.id,
        hasUrl: Boolean(item.url),
        url: item.url,
      })),
      session: await chrome.storage.session.get(null),
      behavior: await chrome.sidePanel.getPanelBehavior(),
      commands: await chrome.commands.getAll(),
    }));
    const capture = await ui.evaluate(() => chrome.runtime.sendMessage({ type: 'CAPTURE_CURRENT' }));
    report.observations.push({ label, ...result, capture });
  };
  await observe('before any entrypoint');
  await tab.keyboard.press('Control+Shift+Y');
  await tab.waitForTimeout(400);
  await observe('after Playwright keyboard Ctrl+Shift+Y');
  await tab.keyboard.press('Alt+Shift+S');
  await tab.waitForTimeout(500);
  await observe('after Playwright keyboard Alt+Shift+S');
  const cdp = await context.browser().newBrowserCDPSession();
  await tab.bringToFront();
  const { targetInfos } = await cdp.send('Target.getTargets', {
    filter: [{ type: 'tab' }, { exclude: true }],
  });
  const target = targetInfos.find((item) => item.type === 'tab' && item.url === tab.url());
  if (!target) throw new Error('Diagnostic tab target not found');
  await cdp.send('Extensions.triggerAction', { id, targetId: target.targetId });
  await tab.waitForTimeout(400);
  await observe('after native Extensions.triggerAction');
  report.nativePanelTargets = (await cdp.send('Target.getTargets')).targetInfos
    .filter((item) => item.url.includes(`chrome-extension://${id}/sidepanel.html`))
    .map((item) => ({ type: item.type, url: item.url }));
  await cdp.detach();
} catch (error) {
  report.error = error.message;
  process.exitCode = 1;
} finally {
  await context?.close();
  await new Promise((done) => server.close(done));
  await writeFile(resolve(directory, 'results.json'), JSON.stringify(report, null, 2));
  // This exact directory was created by mkdtemp above and holds only this synthetic profile.
  if (profile.startsWith(directory + '\\') || profile.startsWith(directory + '/'))
    await rm(profile, { recursive: true, force: true });
  console.log(JSON.stringify(report, null, 2));
}
