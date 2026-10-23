import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const output = fileURLToPath(
  new URL('../../../artifacts/product-discovery/prototype/screenshots', import.meta.url),
);
const key = 'backtoit:detour-research:v1';
const original = '打开例题 2，分别写出 dx/dt 和 dy/dt。';
async function screenshot(page: Page, name: string) {
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
}
async function open(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}
async function choose(
  page: Page,
  mode: 'quiet' | 'lines' | 'direct' = 'quiet',
  duration: 45 | 90 | 180 = 90,
) {
  await page.getByRole('button', { name: '歇一下', exact: true }).click();
  if (mode === 'quiet') await page.getByRole('button', { name: /留一点空白/ }).click();
  if (mode === 'lines') await page.getByRole('button', { name: /把三段线接起来/ }).click();
  if (mode === 'direct') await page.getByRole('button', { name: /只留一句，直接回来/ }).click();
  if (mode !== 'direct') await page.getByRole('radio', { name: `${duration} 秒` }).check();
  await page
    .getByRole('button', { name: mode === 'direct' ? '只留一句，看看下一步' : '开始这一段', exact: true })
    .click();
}

test('Resume remains primary; a voluntary quiet break returns to the exact original next step', async ({
  page,
}) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:4174'))
      external.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  await expect(page.getByRole('button', { name: '接着做', exact: true })).toBeVisible();
  await expect(page.getByText('无声音', { exact: true })).toBeVisible();
  await screenshot(page, '01-resume-420');
  await page.getByRole('button', { name: '歇一下', exact: true }).click();
  await screenshot(page, '02-compare-420');
  await page.getByRole('button', { name: '开始这一段', exact: true }).click();
  await expect(page.getByRole('heading', { name: '这里，什么都不用接。' })).toBeVisible();
  await screenshot(page, '03-quiet-rest-420');
  await page.getByRole('button', { name: '现在结束，看看下一步' }).click();
  await expect(page.getByText(original, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '理解参数方程的切线' })).toBeVisible();
  await screenshot(page, '04-return-420');
  await page.getByRole('button', { name: '接着做', exact: true }).click();
  await expect(page.getByText('已回到示例恢复卡。这不代表已经真正开始现实任务。')).toBeVisible();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  const storage = await page.evaluate(async () => ({
    keys: Object.keys(localStorage),
    databases: await indexedDB.databases(),
  }));
  expect(storage.keys).toEqual([key]);
  expect(storage.databases).toEqual([]);
});

test('the finite interaction ends at three actions; extension is explicit, bounded, and never loops', async ({
  page,
}) => {
  await open(page);
  await choose(page, 'lines');
  await screenshot(page, '05-finite-interaction-420');
  for (let piece = 1; piece <= 3; piece++) {
    await expect(page.getByText(`下一段：${piece} / 3`)).toBeVisible();
    await page.getByRole('button', { name: '接上这一段' }).click();
  }
  await expect(page.getByRole('heading', { name: '三段线，接到终点了。' })).toBeVisible();
  await expect(page.getByRole('button', { name: '接上这一段' })).toHaveCount(0);
  await page.getByRole('button', { name: '再休息一会儿' }).click();
  await page.getByRole('radio', { name: '45 秒' }).check();
  await page.getByRole('button', { name: '明确再歇 45 秒' }).click();
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).session.duration, key)).toBe(45);
  await page.getByRole('button', { name: '现在结束，看看下一步' }).click();
  await expect(page.getByRole('button', { name: '再休息一会儿' })).toHaveCount(0);
  await page.getByRole('button', { name: '今天先到这里', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今天先到这里。' })).toBeVisible();
  await screenshot(page, '06-leave-for-today-420');
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).session, key)).toBeNull();
});

test('timestamp expiry survives reload and a closed page without a running interval', async ({
  page,
  context,
}) => {
  const start = Date.now();
  await page.clock.install({ time: start });
  await open(page);
  await choose(page, 'quiet', 45);
  await page.clock.fastForward(46_000);
  await expect(page.getByRole('heading', { name: '这一段，到这里了。' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '这一段，到这里了。' })).toBeVisible();
  await page.getByRole('button', { name: '接着做', exact: true }).click();
  await choose(page, 'quiet', 90);
  const deadline = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!).session.deadline as number,
    key,
  );
  await page.close();
  const reopened = await context.newPage();
  await reopened.clock.install({ time: deadline + 1000 });
  await open(reopened);
  await expect(reopened.getByRole('heading', { name: '这一段，到这里了。' })).toBeVisible();
  await expect(reopened.getByText(original, { exact: true })).toBeVisible();
  await screenshot(reopened, '07-reopened-expired-420');
});

test('another window can change, archive, or remove the linked task without silent reassignment', async ({
  page,
  context,
}) => {
  await open(page);
  await choose(page, 'quiet');
  const other = await context.newPage();
  await open(other);
  await other.getByRole('button', { name: '研究设置', exact: true }).click();
  await other.getByText('编辑原始示例文字', { exact: true }).click();
  await other.getByLabel('示例原始下一步', { exact: true }).fill('用户新留下的下一步，保持原文。');
  await other.getByRole('button', { name: '保存示例文字' }).click();
  await page.getByRole('button', { name: '现在结束，看看下一步' }).click();
  await expect(page.getByText(original, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '接着做', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '查看同一任务的最新记录' }).click();
  await expect(page.getByText('用户新留下的下一步，保持原文。', { exact: true })).toBeVisible();
  await other.getByLabel('切换示例状态').selectOption('archived');
  await expect(page.getByRole('button', { name: '重新打开此示例任务' })).toBeVisible();
  await expect(page.getByRole('button', { name: '接着做', exact: true })).toHaveCount(0);
  await other.getByLabel('切换示例状态').selectOption('none');
  await expect(page.getByRole('heading', { name: '没有可返回的原任务。' })).toBeVisible();
  await expect(page.getByText(original, { exact: true })).toHaveCount(0);
  await screenshot(page, '08-unavailable-task-420');
});

test('the direct-return control handles missing steps and no task without fabricating progress', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: '研究设置', exact: true }).click();
  await page.getByLabel('切换示例状态').selectOption('empty-next');
  await page.getByRole('button', { name: '研究设置', exact: true }).click();
  await choose(page, 'direct');
  await page.getByLabel('刚才想去做什么？（可选样例）').fill('稍后再看那个视频');
  await page.getByRole('button', { name: '先暂存，看看下一步' }).click();
  await expect(page.getByText('还没有记录下一步。', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '再休息一会儿' })).toHaveCount(0);
  await screenshot(page, '09-direct-control-420');
  await page.getByRole('button', { name: '接着做', exact: true }).click();
  await page.getByRole('button', { name: '研究设置', exact: true }).click();
  await page.getByLabel('切换示例状态').selectOption('none');
  await page.getByRole('button', { name: '研究设置', exact: true }).click();
  await choose(page, 'quiet');
  await page.getByRole('button', { name: '现在结束，看看下一步' }).click();
  await expect(page.getByRole('heading', { name: '没有可返回的原任务。' })).toBeVisible();
});

test('narrow/wide layouts, English, reduced motion and keyboard dialog preserve access', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  for (const width of [320, 360, 420, 480, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await screenshot(page, `10-resume-${width}`);
  }
  await page.setViewportSize({ width: 420, height: 900 });
  await page.getByRole('button', { name: '研究设置', exact: true }).click();
  await page.getByLabel('减少动画（也遵循系统设置）').click();
  await expect(page.getByLabel('减少动画（也遵循系统设置）')).toBeChecked();
  const reset = page.getByRole('button', { name: '重置原型样例', exact: true });
  await reset.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: '重置原型样例？' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(reset).toBeFocused();
  await page.getByLabel('界面语言').selectOption('en');
  await page.getByRole('button', { name: 'Research settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
  await expect(page.getByText(original, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Take a detour', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'A small detour. Your choice after.' })).toBeFocused();
  await screenshot(page, '11-english-compare-420');
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await screenshot(page, '12-english-200-percent');
});

test('corrupt prototype storage is preserved until an explicit reset and foreign keys are untouched', async ({
  page,
}) => {
  await open(page);
  await page.evaluate((k) => {
    localStorage.setItem(k, '{damaged');
    localStorage.setItem('unrelated-data', 'keep');
  }, key);
  await page.reload();
  await expect(page.getByText('无法读取原型样例。现有内容没有被自动清空。')).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe('{damaged');
  await page.getByRole('button', { name: '重置原型样例', exact: true }).click();
  await page.getByRole('button', { name: '确认重置样例' }).click();
  await expect(page.getByRole('heading', { name: '理解参数方程的切线' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('unrelated-data'))).toBe('keep');
});

test('a stale editor keeps its draft and cannot overwrite another window’s saved next step', async ({
  page,
  context,
}) => {
  await open(page);
  const other = await context.newPage();
  await open(other);
  for (const target of [page, other]) {
    await target.getByRole('button', { name: '研究设置', exact: true }).click();
    await target.getByText('编辑原始示例文字', { exact: true }).click();
  }
  await page.getByLabel('示例原始下一步', { exact: true }).fill('此窗口尚未保存的草稿');
  await other.getByLabel('示例原始下一步', { exact: true }).fill('另一窗口已经保存的新步骤');
  await other.getByRole('button', { name: '保存示例文字' }).click();
  await expect(
    page.getByText('另一窗口已经更新了任务。你的草稿留在这里，保存会被阻止，避免覆盖新记录。'),
  ).toBeVisible();
  await page.getByRole('button', { name: '保存示例文字' }).click();
  await expect(page.getByRole('alert')).toContainText('这次保存被阻止');
  await expect(page.getByLabel('示例原始下一步', { exact: true })).toHaveValue('此窗口尚未保存的草稿');
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).task.nextStep, key)).toBe(
    '另一窗口已经保存的新步骤',
  );
  await screenshot(page, '13-conflict-draft-preserved-420');
  await page.getByRole('button', { name: '放弃本地草稿，载入最新记录' }).click();
  await expect(page.getByLabel('示例原始下一步', { exact: true })).toHaveValue('另一窗口已经保存的新步骤');
});
