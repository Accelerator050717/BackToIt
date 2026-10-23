import { chromium, expect, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Task, Resource, Checkpoint, ParkingItem } from '../src/domain/types';

export const buildPath = resolve('.output/chrome-mv3');
export const screenshotPath = resolve('artifacts/screenshots');
export interface StoredState {
  tasks: Task[];
  resources: Resource[];
  checkpoints: Checkpoint[];
  parking: ParkingItem[];
  meta: { id: string; taskId: string | null }[];
}
export async function launch(profile?: string, headless = true) {
  await mkdir(resolve('artifacts/profiles'), { recursive: true });
  await mkdir(screenshotPath, { recursive: true });
  const userDataDir = profile ?? (await mkdtemp(resolve('artifacts/profiles/run-')));
  const bundled = chromium.executablePath();
  const relativeBrowserPath = bundled.split(/[\\/]/).slice(-3).join('/');
  const projectBrowser = resolve('.playwright-browsers', relativeBrowserPath);
  const executablePath = existsSync(projectBrowser) ? projectBrowser : bundled;
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    executablePath,
    headless,
    args: [
      `--disable-extensions-except=${buildPath}`,
      `--load-extension=${buildPath}`,
      '--enable-unsafe-extension-debugging',
    ],
    viewport: { width: 420, height: 900 },
    locale: 'zh-CN',
    acceptDownloads: true,
  });
  let worker = context.serviceWorkers()[0];
  worker ??= await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).hostname;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/sidepanel.html`);
  await expect(page.locator('main')).toBeVisible();
  return { context, worker, id, page, profile: userDataDir };
}

export async function database(page: Page): Promise<StoredState> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('backtoit-v1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('TEST_DATABASE_OPEN'));
    });
    try {
      const names = ['tasks', 'resources', 'checkpoints', 'parking', 'meta'];
      const transaction = db.transaction(names, 'readonly');
      const records = await Promise.all(
        names.map(
          (name) =>
            new Promise<unknown[]>((resolve, reject) => {
              const request = transaction.objectStore(name).getAll();
              request.onsuccess = () => resolve(request.result as unknown[]);
              request.onerror = () => reject(new Error('TEST_DATABASE_READ'));
            }),
        ),
      );
      return {
        tasks: records[0] as Task[],
        resources: records[1] as Resource[],
        checkpoints: records[2] as Checkpoint[],
        parking: records[3] as ParkingItem[],
        meta: records[4] as { id: string; taskId: string | null }[],
      };
    } finally {
      db.close();
    }
  });
}

export async function createTask(page: Page, title: string) {
  await page.getByRole('button', { name: '开始一件事', exact: true }).last().click();
  await page.getByRole('textbox', { name: '这次想做什么？', exact: true }).fill(title);
  await page.getByRole('button', { name: '开始这件事', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

export async function addResource(page: Page, title: string, url: string, note = '') {
  await page.getByRole('button', { name: '链接或笔记', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: '资料标题', exact: true }).fill(title);
  await dialog.getByRole('textbox', { name: '链接（可选）', exact: true }).fill(url);
  if (note) await dialog.getByRole('textbox', { name: '笔记 / 用途', exact: true }).fill(note);
  await dialog.getByRole('button', { name: '保存资料', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();
}

export async function triggerAction(context: BrowserContext, id: string, tab: Page) {
  await tab.bringToFront();
  const cdp = await context.newCDPSession(tab);
  // Chromium's real extension action grants activeTab; no permissions are fabricated.
  const browser = context.browser();
  if (!browser) throw new Error('TEST_BROWSER_SESSION_REQUIRED');
  const browserCdp = await browser.newBrowserCDPSession();
  const targets = await browserCdp.send('Target.getTargets', {
    filter: [{ type: 'tab' }, { exclude: true }],
  });
  const tabTarget = targets.targetInfos.find((target) => target.type === 'tab' && target.url === tab.url());
  if (!tabTarget) throw new Error('TEST_TAB_TARGET_NOT_FOUND');
  await browserCdp.send('Extensions.triggerAction', { id, targetId: tabTarget.targetId });
  await browserCdp.detach();
  await cdp.detach();
}

export async function workerCapture(worker: Worker) {
  // CAPTURE_CURRENT is a validated production message. Send from the extension UI, not here.
  return worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs.map((tab) => ({ id: tab.id, url: tab.url }));
  });
}

export async function fixtureServer(): Promise<{ server: Server; base: string }> {
  const server = createServer((request, response) => {
    const two = request.url?.startsWith('/two');
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(
      `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${two ? '例题 2' : '参数方程笔记'}</title></head><body><h1>${two ? '例题 2' : '参数方程笔记'}</h1><p id="excerpt">分别计算 dx/dt 和 dy/dt，再讨论 dx/dt 为零的情况。</p><p>这是独立测试资料，不含用户信息。</p><form><label>输入区域<input id="private" value="synthetic-private-form"/></label><textarea id="textarea">synthetic-private-editor</textarea></form><div contenteditable="true" id="editable">synthetic-editable-selection</div><p id="after">正文结束。</p></body></html>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

export async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: join(screenshotPath, `${name}.png`), fullPage: true });
}

// Chrome exposes its native side-panel WebContents to CDP, but not as a Playwright Page.
export async function attachNativePanel(context: BrowserContext, original: Page, extensionId: string) {
  const pageCdp = await context.newCDPSession(original);
  const originalTarget = (await pageCdp.send('Target.getTargetInfo')).targetInfo.targetId;
  await pageCdp.detach();
  const browser = context.browser();
  if (!browser) throw new Error('TEST_BROWSER_SESSION_REQUIRED');
  const cdp = await browser.newBrowserCDPSession();
  let targetId: string | undefined;
  await expect
    .poll(async () => {
      const targets = await cdp.send('Target.getTargets');
      targetId = targets.targetInfos.find(
        (target) =>
          target.targetId !== originalTarget &&
          target.url === `chrome-extension://${extensionId}/sidepanel.html`,
      )?.targetId;
      return Boolean(targetId);
    })
    .toBe(true);
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: targetId!, flatten: false });
  let sequence = 0;
  function send<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = ++sequence;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        cdp.off('Target.receivedMessageFromTarget', listener);
        reject(new Error('TEST_PANEL_COMMAND_TIMEOUT'));
      }, 10000);
      const listener = (event: { sessionId: string; message: string }) => {
        if (event.sessionId !== sessionId) return;
        const message = JSON.parse(event.message) as { id?: number; result: T; error?: { message: string } };
        if (message.id !== id) return;
        clearTimeout(timer);
        cdp.off('Target.receivedMessageFromTarget', listener);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      };
      cdp.on('Target.receivedMessageFromTarget', listener);
      void cdp
        .send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) })
        .catch((error) => {
          clearTimeout(timer);
          cdp.off('Target.receivedMessageFromTarget', listener);
          reject(error);
        });
    });
  }
  return { send, close: () => cdp.detach() };
}
