import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  addResource,
  createTask,
  database,
  fixtureServer,
  launch,
  screenshot,
  triggerAction,
  attachNativePanel,
} from './helpers';
import { readPageCapture } from '../src/browser/capture';

test('installed extension: capture, checkpoint, restart, resume, parking, backup and offline', async () => {
  const fixture = await fixtureServer();
  let app = await launch();
  const outgoing: string[] = [];
  const errors: string[] = [];
  app.context.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith(fixture.base))
      outgoing.push(new URL(request.url()).origin);
  });
  app.page.on('pageerror', (error) => errors.push(error.message));
  try {
    await screenshot(app.page, '01-first-use-420');
    const manifest = JSON.parse(await readFile(resolve('.output/chrome-mv3/manifest.json'), 'utf8'));
    expect(manifest.permissions.sort()).toEqual(
      ['activeTab', 'contextMenus', 'scripting', 'sidePanel', 'storage'].sort(),
    );
    expect(manifest.host_permissions ?? []).toEqual([]);
    expect(manifest.content_scripts ?? []).toEqual([]);
    expect(manifest.incognito).toBe('not_allowed');
    await createTask(app.page, '理解参数方程');
    const initial = await database(app.page);
    expect(initial.tasks).toHaveLength(1);
    expect(initial.meta[0]?.taskId).toBe(initial.tasks[0]?.id);

    // No activeTab grant: a real extension message cannot capture the local fixture.
    const source = await app.context.newPage();
    await source.goto(`${fixture.base}/one`);
    await source.bringToFront();
    const denied = await app.page.evaluate(() => chrome.runtime.sendMessage({ type: 'CAPTURE_CURRENT' }));
    expect(denied).toMatchObject({ ok: false, error: 'NO_PERMISSION' });

    await triggerAction(app.context, app.id, source);
    const captured = await app.page.evaluate(() => chrome.runtime.sendMessage({ type: 'CAPTURE_CURRENT' }));
    expect(captured).toMatchObject({
      ok: true,
      result: { title: '参数方程笔记', url: `${fixture.base}/one` },
    });
    expect((await database(app.page)).resources).toHaveLength(0);
    // Hand a genuine one-shot capture result to the installed capture-review UI.
    await app.page.evaluate(async (draft) => {
      await chrome.storage.session.set({ pendingCapture: draft });
    }, captured.result);
    await app.page.bringToFront();
    await app.page.getByRole('dialog').getByRole('button', { name: '保存资料', exact: true }).click();
    await expect(app.page.getByRole('dialog')).not.toBeVisible();
    // Also exercise the permission-independent manual entry path.
    await addResource(app.page, '例题 2', `${fixture.base}/two`, '回来看这道例题');

    // Real activeTab + production selection script. Native context-menu dispatch remains manual.
    await source.bringToFront();
    await source.locator('#excerpt').evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
    const selection = await app.worker.evaluate(`(async () => {
      const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
      return (await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},func:${readPageCapture.toString()},args:[true]}))[0].result;
    })()`);
    expect(selection).toMatchObject({
      source: 'selection',
      excerpt: '分别计算 dx/dt 和 dy/dt，再讨论 dx/dt 为零的情况。',
    });
    await app.page.evaluate(async (draft) => {
      await chrome.storage.session.set({ pendingCapture: draft });
    }, selection);
    await app.page.bringToFront();
    await app.page.getByRole('dialog').getByRole('button', { name: '保存资料', exact: true }).click();
    await expect(app.page.getByRole('dialog')).not.toBeVisible();
    expect((await database(app.page)).resources).toHaveLength(2);
    expect((await database(app.page)).resources.find((r) => r.title === '参数方程笔记')?.excerpts).toEqual([
      '分别计算 dx/dt 和 dy/dt，再讨论 dx/dt 为零的情况。',
    ]);
    // Stop the real MV3 worker, then wake its production message listener again.
    const workerCdp = await app.context.newCDPSession(app.page);
    const workerTargets = await workerCdp.send('Target.getTargets');
    const workerTarget = workerTargets.targetInfos.find(
      (target) => target.type === 'service_worker' && target.url.startsWith(`chrome-extension://${app.id}/`),
    );
    expect(workerTarget).toBeDefined();
    const stopped = await workerCdp.send('Target.closeTarget', { targetId: workerTarget!.targetId });
    expect(stopped.success).toBe(true);
    const awakened = await app.page.evaluate(() => chrome.runtime.sendMessage({ type: 'GET_PENDING' }));
    expect(awakened).toMatchObject({ ok: true });
    await workerCdp.detach();
    expect((await database(app.page)).resources).toHaveLength(2);
    await screenshot(app.page, '02-current-task-420');

    await app.page.locator('summary').filter({ hasText: '保存现场' }).click();
    await app.page.getByRole('textbox', { name: '做到哪了？', exact: true }).fill('看完了 dy/dx 的推导。');
    await app.page
      .getByRole('textbox', { name: '卡在哪里？', exact: true })
      .fill('不明白 dx/dt 等于 0 时为什么要单独讨论。');
    await app.page
      .getByRole('textbox', { name: '回来后先做什么？', exact: true })
      .fill('重新看例题 2，分别算 dx/dt 和 dy/dt。');
    await screenshot(app.page, '03-checkpoint-editor-420');
    await app.page.getByRole('button', { name: '保存并暂停', exact: true }).click();
    await expect.poll(async () => (await database(app.page)).checkpoints.length).toBe(1);
    const paused = await database(app.page);
    expect(paused.tasks[0]).toMatchObject({
      status: 'paused',
      progress: '看完了 dy/dx 的推导。',
      nextStep: '重新看例题 2，分别算 dx/dt 和 dy/dt。',
    });
    expect(paused.checkpoints[0]?.resourceIds).toHaveLength(2);
    await app.page.close();
    app.page = await app.context.newPage();
    await app.page.goto(`chrome-extension://${app.id}/sidepanel.html`);
    await expect(
      app.page
        .getByRole('region', { name: '恢复卡' })
        .getByText('重新看例题 2，分别算 dx/dt 和 dy/dt。', { exact: true }),
    ).toBeVisible();
    await screenshot(app.page, '04-recovery-card-420');

    const profile = app.profile;
    await app.context.close();
    app = await launch(profile);
    app.context.on('request', (request) => {
      if (/^https?:/.test(request.url()) && !request.url().startsWith(fixture.base))
        outgoing.push(new URL(request.url()).origin);
    });
    app.page.on('pageerror', (error) => errors.push(error.message));
    expect(await database(app.page)).toEqual(paused);
    await expect(app.page.getByRole('heading', { name: '理解参数方程', exact: true })).toBeVisible();
    const unrelated = await app.context.newPage();
    await unrelated.goto(`${fixture.base}/unrelated`);
    await app.page.bringToFront();
    const pageCount = app.context.pages().length;
    await app.page
      .getByRole('button', { name: '接着做', exact: true })
      .last()
      .evaluate((button) => {
        (button as HTMLButtonElement).click();
        (button as HTMLButtonElement).click();
        (button as HTMLButtonElement).click();
      });
    await expect.poll(async () => (await database(app.page)).tasks[0]?.status).toBe('active');
    await expect.poll(() => app.context.pages().length).toBe(pageCount + 1);
    expect(unrelated.url()).toBe(`${fixture.base}/unrelated`);
    expect(app.context.pages().at(-1)?.url()).toBe(`${fixture.base}/one`);

    await app.page.bringToFront();
    await app.page.getByRole('button', { name: /先放这里/ }).click();
    await app.page.getByRole('textbox', { name: '暂存想法', exact: true }).fill('之后查相机价格');
    await app.page.getByRole('button', { name: '放下', exact: true }).click();
    expect((await database(app.page)).meta[0]?.taskId).toBe(paused.tasks[0]?.id);
    await createTask(app.page, '完成课程报告');
    const second = await database(app.page);
    expect(second.tasks.find((t) => t.title === '理解参数方程')?.status).toBe('paused');
    expect(second.tasks.filter((t) => t.status === 'active')).toHaveLength(1);

    // UI list and full extension page; these are not a localhost React mock.
    const full = await app.context.newPage();
    await full.setViewportSize({ width: 1440, height: 1000 });
    await full.goto(`chrome-extension://${app.id}/app.html?section=tasks`);
    await expect(full.getByRole('heading', { name: '留在这里的事', exact: true })).toBeVisible();
    await screenshot(full, '05-task-list-1440');
    await full.getByRole('textbox', { name: '搜索任务和资料', exact: true }).fill('例题');
    await expect(full.getByRole('heading', { name: '理解参数方程', exact: true })).toBeVisible();
    await expect(full.getByRole('heading', { name: '完成课程报告', exact: true })).not.toBeVisible();
    await full.getByRole('button', { name: '设置', exact: true }).click();
    await screenshot(full, '06-settings-1440');
    const downloadPromise = full.waitForEvent('download');
    await full.getByRole('button', { name: '导出 JSON 备份', exact: true }).click();
    const download = await downloadPromise;
    const backupPath = resolve('artifacts/synthetic-backup.json');
    await download.saveAs(backupPath);
    const backup = JSON.parse(await readFile(backupPath, 'utf8'));
    expect(backup.schemaVersion).toBe(1);
    expect(backup.tasks).toHaveLength(2);
    expect(backup.resources).toHaveLength(2);
    expect(backup).not.toHaveProperty('settings');

    const clean = await launch();
    try {
      await clean.page.getByRole('button', { name: '设置', exact: true }).click();
      await clean.page.getByLabel('选择备份文件').setInputFiles(backupPath);
      await clean.page.getByRole('button', { name: '确认导入', exact: true }).click();
      await expect(clean.page.getByRole('dialog')).not.toBeVisible();
      const restored = await database(clean.page);
      expect(restored.tasks.map((task) => task.title).sort()).toEqual(
        ['完成课程报告', '理解参数方程'].sort(),
      );
      expect(restored.tasks.every((task) => task.status === 'paused')).toBe(true);
      const originalTask = restored.tasks.find((task) => task.title === '理解参数方程');
      expect(originalTask).toMatchObject({
        progress: '看完了 dy/dx 的推导。',
        blocker: '不明白 dx/dt 等于 0 时为什么要单独讨论。',
        nextStep: '重新看例题 2，分别算 dx/dt 和 dy/dt。',
      });
      expect(restored.resources.filter((resource) => resource.taskId === originalTask?.id)).toHaveLength(2);
      expect(restored.checkpoints[0]?.taskId).toBe(originalTask?.id);
      expect(restored.tasks.some((task) => second.tasks.some((original) => original.id === task.id))).toBe(
        false,
      );
    } finally {
      await clean.context.close();
    }

    await full.getByLabel('选择备份文件').setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"schemaVersion":99}'),
    });
    await expect(full.getByRole('alert').filter({ hasText: '无法读取这个备份' })).toBeVisible();
    expect((await database(full)).tasks).toHaveLength(2);
    await full.getByLabel('选择备份文件').setInputFiles(backupPath);
    await expect(full.getByRole('dialog', { name: '导入预览' })).toBeVisible();
    await full.getByRole('button', { name: '确认导入', exact: true }).click();
    await expect(full.getByRole('dialog')).not.toBeVisible();
    const imported = await database(full);
    expect(imported.tasks).toHaveLength(4);
    expect(imported.resources).toHaveLength(4);
    expect(imported.checkpoints).toHaveLength(2);
    expect(imported.tasks.filter((t) => t.status === 'active')).toHaveLength(1);
    expect(new Set(imported.tasks.map((t) => t.id)).size).toBe(4);
    for (const point of imported.checkpoints)
      for (const id of point.resourceIds)
        expect(imported.resources.find((r) => r.id === id)?.taskId).toBe(point.taskId);

    await full.getByRole('combobox', { name: '语言', exact: true }).selectOption('en');
    await expect(full.getByRole('heading', { name: 'Make it yours', exact: true })).toBeVisible();
    expect((await database(full)).tasks.map((t) => t.title)).toEqual(imported.tasks.map((t) => t.title));
    await full.getByRole('combobox', { name: 'Language', exact: true }).selectOption('zh-CN');
    await app.context.setOffline(true);
    await full.getByRole('button', { name: '接着做', exact: true }).first().click();
    await createTask(full, '离线也能留下下一步');
    await full.locator('summary').filter({ hasText: '保存现场' }).click();
    await full.getByRole('textbox', { name: '回来后先做什么？', exact: true }).fill('读下一段');
    await full.getByRole('button', { name: '保存并暂停', exact: true }).click();
    await expect
      .poll(async () => (await database(full)).tasks.find((t) => t.title === '离线也能留下下一步')?.nextStep)
      .toBe('读下一段');
    await full.reload();
    await expect(
      full.getByRole('region', { name: '恢复卡' }).getByText('读下一段', { exact: true }),
    ).toBeVisible();
    expect(outgoing).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await app.context.close();
    await new Promise<void>((resolve) => fixture.server.close(() => resolve()));
  }
});

test('real permission revocation, restricted page and safe editable-selection rejection', async () => {
  const fixture = await fixtureServer();
  const app = await launch();
  try {
    await createTask(app.page, '权限测试任务');
    await app.page.getByRole('button', { name: '保存当前网页', exact: true }).click();
    await expect(app.page.getByRole('alert')).toBeVisible();
    await screenshot(app.page, '07-permission-help-420');
    const tab = await app.context.newPage();
    await tab.goto(`${fixture.base}/one`);
    await triggerAction(app.context, app.id, tab);
    await tab.locator('#editable').evaluate((element) => {
      (element as HTMLElement).focus();
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
    const editable = await app.worker.evaluate(
      `(async()=>{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});return (await chrome.scripting.executeScript({target:{tabId:tab.id},func:${readPageCapture.toString()},args:[true]}))[0].result})()`,
    );
    expect(editable).toMatchObject({ error: 'EDITABLE_SELECTION' });
    expect(editable).not.toHaveProperty('excerpt');
    await tab.evaluate(() => {
      document.designMode = 'on';
      const range = document.createRange();
      range.selectNodeContents(document.querySelector('#excerpt')!);
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(range);
    });
    const designMode = await app.worker.evaluate(
      `(async()=>{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});return (await chrome.scripting.executeScript({target:{tabId:tab.id},func:${readPageCapture.toString()},args:[true]}))[0].result})()`,
    );
    expect(designMode).toMatchObject({ error: 'EDITABLE_SELECTION' });
    expect(designMode).not.toHaveProperty('excerpt');
    await tab.goto(`${fixture.base.replace('127.0.0.1', 'localhost')}/two`);
    const changed = await app.page.evaluate(() => chrome.runtime.sendMessage({ type: 'CAPTURE_CURRENT' }));
    expect(changed).toMatchObject({ ok: false, error: 'NO_PERMISSION' });
    const restricted = await app.context.newPage();
    await restricted.goto('chrome://version');
    await restricted.bringToFront();
    const result = await app.page.evaluate(() => chrome.runtime.sendMessage({ type: 'CAPTURE_CURRENT' }));
    expect(result.ok).toBe(false);
    expect(['RESTRICTED_PAGE', 'NO_PERMISSION']).toContain(result.error);
    expect((await database(app.page)).resources).toHaveLength(0);
    const invalid = await app.page.evaluate(() => chrome.runtime.sendMessage({ type: 'EXPORT_DATABASE' }));
    expect(invalid).toMatchObject({ ok: false, error: 'INVALID_MESSAGE' });
  } finally {
    await app.context.close();
    await new Promise<void>((resolve) => fixture.server.close(() => resolve()));
  }
});

test('responsive extension pages, 200 percent zoom and keyboard dialog', async () => {
  const app = await launch();
  try {
    await app.page.getByRole('button', { name: '看看示例', exact: true }).click();
    await expect(app.page.getByText('示例', { exact: true })).toBeVisible();
    for (const width of [320, 360, 420, 480]) {
      await app.page.setViewportSize({ width, height: 900 });
      expect(await app.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await screenshot(app.page, `08-recovery-${width}`);
    }
    await app.page.setViewportSize({ width: 420, height: 900 });
    await app.page.getByRole('button', { name: '开始一件事', exact: true }).click();
    await expect(app.page.getByRole('dialog')).toBeVisible();
    await app.page.keyboard.press('Escape');
    await expect(app.page.getByRole('dialog')).not.toBeVisible();
    await expect(app.page.getByRole('button', { name: '开始一件事', exact: true })).toBeFocused();
    await app.page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    expect(await app.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await screenshot(app.page, '09-sidebar-200-percent');
    const full = await app.context.newPage();
    for (const width of [1024, 1440]) {
      await full.setViewportSize({ width, height: 1000 });
      await full.goto(`chrome-extension://${app.id}/app.html`);
      await expect(full.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await full.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await screenshot(full, `10-full-recovery-${width}`);
    }
    await writeFile(
      join(resolve('artifacts'), 'visual-checks.json'),
      JSON.stringify(
        {
          widths: [320, 360, 420, 480, 1024, 1440],
          zoom: 'CSS 200% (layout equivalent check; Chrome native zoom manual)',
          horizontalOverflow: false,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.context.close();
  }
});

test('real native side panel saves the authorized current page', async () => {
  const fixture = await fixtureServer();
  const app = await launch();
  try {
    await createTask(app.page, '侧边栏实际保存');
    const source = await app.context.newPage();
    await source.goto(`${fixture.base}/one`);
    await triggerAction(app.context, app.id, source);
    const panel = await attachNativePanel(app.context, app.page, app.id);
    const evaluate = async (expression: string) =>
      (
        await panel.send<{ result: { value: unknown } }>('Runtime.evaluate', {
          expression,
          returnByValue: true,
          awaitPromise: true,
        })
      ).result.value;
    await expect.poll(() => evaluate('document.querySelector("h1")?.textContent')).toBe('侧边栏实际保存');
    await evaluate('document.querySelector(".resource-actions .secondary").click()');
    await expect
      .poll(() => evaluate('document.querySelector("dialog form input")?.value'))
      .toBe('参数方程笔记');
    await evaluate('document.querySelector("dialog form .actions .primary").click()');
    await expect.poll(async () => (await database(app.page)).resources.length).toBe(1);
    expect((await database(app.page)).resources[0]?.url).toBe(`${fixture.base}/one`);
    await expect.poll(() => evaluate('Boolean(document.querySelector("dialog[open]"))')).toBe(false);
    const image = await panel.send<{ data: string }>('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
    });
    await writeFile(
      resolve('artifacts/screenshots/11-native-side-panel.png'),
      Buffer.from(image.data, 'base64'),
    );
    await panel.close();
    await writeFile(
      resolve('artifacts/native-sidepanel-evidence.json'),
      JSON.stringify(
        {
          browser: 'Chromium153',
          trigger: 'native Extensions.triggerAction',
          activeTabGranted: true,
          nativePanelInteraction: true,
          savedResourceUrlMatched: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.context.close();
    await new Promise<void>((resolve) => fixture.server.close(() => resolve()));
  }
});

test('installed data controls, sensitive URL review and model permission fallback', async () => {
  const app = await launch();
  const requests: string[] = [];
  app.context.on('request', (request) => {
    if (/^https?:/.test(request.url())) requests.push(new URL(request.url()).origin);
  });
  try {
    await app.page.getByRole('button', { name: '看看示例', exact: true }).click();
    await expect(app.page.getByText('示例', { exact: true })).toBeVisible();
    await createTask(app.page, '保留用户自己的任务');
    await addResource(app.page, '普通资料', 'https://example.test/lesson?utm_source=synthetic');
    expect((await database(app.page)).resources.find((resource) => resource.title === '普通资料')?.url).toBe(
      'https://example.test/lesson',
    );
    await app.page.getByRole('button', { name: '链接或笔记', exact: true }).click();
    const dialog = app.page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: '资料标题', exact: true }).fill('安全链接');
    await dialog
      .getByRole('textbox', { name: '链接（可选）', exact: true })
      .fill('https://example.test/secret?token=synthetic-only');
    await dialog.getByRole('button', { name: '保存资料', exact: true }).click();
    await expect(dialog.getByRole('group', { name: '链接可能含有敏感参数' })).toBeVisible();
    await dialog.getByRole('radio', { name: '移除敏感参数后保存', exact: true }).check();
    await dialog.getByRole('button', { name: '保存资料', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect((await database(app.page)).resources.find((resource) => resource.title === '安全链接')?.url).toBe(
      'https://example.test/secret',
    );
    await app.page.getByRole('button', { name: '撤销', exact: true }).click();
    await expect
      .poll(async () =>
        (await database(app.page)).resources.some((resource) => resource.title === '安全链接'),
      )
      .toBe(false);
    await app.page.getByRole('button', { name: '编辑资料：普通资料', exact: true }).click();
    await app.page.getByRole('textbox', { name: '一句用途备注', exact: true }).fill('只处理第二段');
    await app.page.getByRole('button', { name: '保存修改', exact: true }).click();
    await expect(app.page.getByText('只处理第二段', { exact: true })).toBeVisible();
    await app.page.locator('summary').filter({ hasText: '保存现场' }).click();
    await app.page.getByRole('textbox', { name: '回来后先做什么？', exact: true }).fill('读第二段');
    await app.page.getByRole('button', { name: '保存并暂停', exact: true }).click();
    await expect.poll(async () => (await database(app.page)).checkpoints.length).toBe(1);
    await app.page.getByRole('button', { name: '编辑资料：普通资料', exact: true }).click();
    await app.page.getByRole('button', { name: '移除资料', exact: true }).click();
    await app.page.getByRole('dialog').getByRole('button', { name: '移除资料', exact: true }).click();
    await expect.poll(async () => (await database(app.page)).checkpoints[0]?.resourceIds.length).toBe(0);
    await app.page.getByRole('button', { name: '标记完成', exact: true }).click();
    await expect(app.page.getByRole('button', { name: '重新打开', exact: true })).toBeVisible();
    await app.page.getByRole('button', { name: '重新打开', exact: true }).click();
    await expect(app.page.getByRole('button', { name: '标记完成', exact: true })).toBeVisible();
    const baseline = await database(app.page);
    // Deliberately stale enabled config with no host grant: genuine provider must refuse before network.
    await app.page.evaluate(() =>
      chrome.storage.local.set({
        ollama: { enabled: true, endpoint: 'http://127.0.0.1:11434', model: 'synthetic-unavailable' },
      }),
    );
    await app.page.getByRole('button', { name: '帮我整理一下', exact: true }).click();
    await app.page.getByRole('dialog').getByRole('button', { name: '发送并整理', exact: true }).click();
    await expect(app.page.getByText(/未授予本机模型连接权限/)).toBeVisible();
    expect(await database(app.page)).toEqual(baseline);
    await screenshot(app.page, '12-model-permission-fallback');
    await app.page.getByRole('button', { name: '设置', exact: true }).click();
    await app.page.getByRole('button', { name: '关闭并撤销权限', exact: true }).click();
    await app.page.getByRole('button', { name: '清理示例数据', exact: true }).click();
    await app.page.getByRole('dialog').getByRole('button', { name: '清理示例', exact: true }).click();
    await expect.poll(async () => (await database(app.page)).tasks.length).toBe(1);
    expect((await database(app.page)).tasks[0]?.title).toBe('保留用户自己的任务');
    await app.page.getByRole('button', { name: '任务', exact: true }).click();
    await app.page.getByRole('button', { name: '归档任务：保留用户自己的任务', exact: true }).click();
    await expect.poll(async () => (await database(app.page)).tasks[0]?.status).toBe('archived');
    await app.page.getByRole('button', { name: '永久删除任务：保留用户自己的任务', exact: true }).click();
    await app.page.getByRole('dialog').getByRole('button', { name: '永久删除', exact: true }).click();
    await expect.poll(async () => (await database(app.page)).tasks.length).toBe(0);
    const deleted = await database(app.page);
    expect(deleted.checkpoints).toHaveLength(0);
    expect(deleted.resources).toHaveLength(0);
    expect(requests).toEqual([]);
  } finally {
    await app.context.close();
  }
});

test('cross-window deletion removes resource editors and all temporary capture content', async () => {
  const app = await launch();
  try {
    await createTask(app.page, '跨窗口清理');
    await addResource(app.page, '临时测试资料', 'https://example.test/synthetic', '合成的待删备注');
    const other = await app.context.newPage();
    await other.goto(`chrome-extension://${app.id}/app.html`);
    await other.getByRole('button', { name: '编辑资料：临时测试资料', exact: true }).click();
    await expect(other.getByRole('textbox', { name: '一句用途备注', exact: true })).toHaveValue(
      '合成的待删备注',
    );
    await app.page.getByRole('button', { name: '编辑资料：临时测试资料', exact: true }).click();
    await app.page.getByRole('button', { name: '移除资料', exact: true }).click();
    await app.page.getByRole('dialog').getByRole('button', { name: '移除资料', exact: true }).click();
    await expect(other.getByRole('dialog')).not.toBeVisible();
    await expect.poll(async () => (await database(other)).resources.length).toBe(0);

    // A synthetic pending capture exercises real session events and UI memory in two extension windows.
    await app.page.evaluate(() =>
      chrome.storage.session.set({
        pendingCapture: {
          title: '合成的临时捕获',
          url: 'https://example.test/unsaved',
          excerpt: '此合成文本必须随清空消失',
          source: 'selection',
        },
      }),
    );
    await expect(other.getByRole('textbox', { name: '主动保存的摘录', exact: true })).toHaveValue(
      '此合成文本必须随清空消失',
    );
    await app.page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
    await app.page.getByRole('button', { name: '设置', exact: true }).click();
    await app.page.getByRole('button', { name: '删除全部本地数据', exact: true }).click();
    await app.page.getByRole('dialog').getByRole('button', { name: '删除全部数据', exact: true }).click();
    await expect(other.getByRole('dialog')).not.toBeVisible();
    await expect.poll(async () => (await database(other)).tasks.length).toBe(0);
    await expect
      .poll(() =>
        other.evaluate(
          async () => (await chrome.storage.session.get('pendingCapture')).pendingCapture ?? null,
        ),
      )
      .toBeNull();
    await createTask(other, '清空后的新任务');
    await other.getByRole('button', { name: '链接或笔记', exact: true }).click();
    await expect(other.getByRole('textbox', { name: '资料标题', exact: true })).toHaveValue('');
    await expect(other.getByRole('textbox', { name: '主动保存的摘录', exact: true })).not.toBeVisible();
    expect((await database(other)).resources).toHaveLength(0);
  } finally {
    await app.context.close();
  }
});
