import { expect, test as base, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// All content below is synthetic. Clock acceleration tests state recovery;
// it does not represent a participant waiting or starting a real task.
const key = 'backtoit:adhd-first-research:v1';
const oldKey = 'backtoit:detour-research:v1';
const sentinelKey = 'unrelated:synthetic-research-sentinel';
const original = '打开例题 2，分别写出 dx/dt 和 dy/dt。';
const writing = '打开报告草稿，写下这一节最想解释的问题。';
const output = fileURLToPath(new URL('../../../artifacts/adhd-first/screenshots/', import.meta.url));

interface SavedState {
  phase: string;
  revision: number;
  language: string;
  reducedMotion: boolean;
  sparkEnabled: boolean;
  task: { id: string; title: string; nextStep: string; revision: number; status: string } | null;
  session: {
    id: string;
    taskId: string | null;
    snapshot: { id: string; nextStep: string; revision: number } | null;
    path: string;
    duration: number;
    deadline: number | null;
    step: number;
    extensions: number;
    tinyAction: string;
    endedBy: string;
  } | null;
  parking: string[];
}
interface Audit {
  external: string[];
  errors: string[];
}
const test = base.extend<{ audit: Audit }>({
  audit: [
    async ({ context }, use, testInfo) => {
      const audit: Audit = { external: [], errors: [] };
      context.on('request', (request) => {
        if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== 'http://127.0.0.1:4178')
          audit.external.push(request.url());
      });
      context.on('page', (page) => page.on('pageerror', (error) => audit.errors.push(error.message)));
      await use(audit);
      await testInfo.attach('network-and-page-errors', {
        body: JSON.stringify(audit, null, 2),
        contentType: 'application/json',
      });
      expect(audit.external, 'No external HTTP requests in any tested path').toEqual([]);
      expect(audit.errors, 'No uncaught page errors').toEqual([]);
    },
    { auto: true },
  ],
});

const main = (page: Page) => page.getByRole('main');
async function open(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(main(page).getByRole('heading', { level: 1 })).toBeVisible();
}
async function saved(page: Page): Promise<SavedState> {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
}
async function settings(page: Page) {
  const details = page.locator('details.af-settings');
  if ((await details.getAttribute('open')) === null) await details.locator('summary').click();
  return details;
}
async function shot(page: Page, name: string) {
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: `${output}${name}.png`, fullPage: true });
}
async function needs(page: Page, seconds: 45 | 90 | 180 = 90) {
  await main(page).getByRole('button', { name: '我卡住了', exact: true }).click();
  await expect(main(page).getByRole('heading', { name: '现在需要哪一种帮助？' })).toBeVisible();
  const radio = main(page).getByRole('radio', { name: `${seconds}秒`, exact: true });
  // Controlled inputs await the serialized storage write before React commits.
  // Wait for the resulting state rather than check()'s immediate native toggle.
  if (!(await radio.isChecked())) await radio.click();
  await expect(radio).toBeChecked();
}
async function begin(page: Page, path: 'start' | 'spark' | 'quiet', seconds: 45 | 90 | 180 = 90) {
  await needs(page, seconds);
  const label = { start: /^开始不了/, spark: /^想刷点别的/, quiet: /^我真的累了/ }[path];
  await main(page).getByRole('button', { name: label }).click();
  const heading = {
    start: '先让第一步变小',
    spark: '给这座小岛拼上最后三片',
    quiet: '可以暂时什么都不做',
  }[path];
  await expect(main(page).getByRole('heading', { name: heading })).toBeVisible();
}
async function homeFromReturn(page: Page) {
  await main(page).getByRole('button', { name: '接着做', exact: true }).click();
  await expect(main(page).getByRole('heading', { name: '接回这个任务' })).toBeVisible();
  await main(page).getByRole('button', { name: '回到任务卡', exact: true }).click();
  await expect(main(page).getByRole('heading', { name: '从这一小步接回来' })).toBeVisible();
}
async function editSample(page: Page, nextStep: string) {
  await settings(page);
  await page.getByRole('button', { name: '编辑当前样例', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: '保存的下一步', exact: true }).fill(nextStep);
  await dialog.getByRole('button', { name: '保存样例', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
async function reset(page: Page) {
  await settings(page);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '重置本原型样例', exact: true }).click();
  await expect(main(page).getByRole('heading', { name: '从这一小步接回来' })).toBeVisible();
}

test('direct Resume preserves the saved task and isolates browser data and network', async ({ page }) => {
  await page.addInitScript(
    ({ prior, unrelated }) => {
      localStorage.setItem(prior, 'synthetic-old-prototype-sentinel');
      localStorage.setItem(unrelated, 'synthetic-unrelated-value');
    },
    { prior: oldKey, unrelated: sentinelKey },
  );
  await open(page);
  await expect(main(page).getByText(original, { exact: true })).toBeVisible();
  await expect(main(page).locator('button.af-primary')).toHaveCount(1);
  await main(page).getByRole('button', { name: '接着做', exact: true }).click();
  await expect(main(page).getByRole('heading', { name: '接回这个任务' })).toBeVisible();
  await expect(main(page).getByText(/这里不知道你是否已真正开始/)).toBeVisible();
  const state = await saved(page);
  expect(state.task?.nextStep).toBe(original);
  expect(state.session?.taskId).toBe('demo-parametric');
  expect(state.session?.snapshot?.revision).toBe(state.task?.revision);
  expect(state.session?.deadline).toBeNull();
  const data = await page.evaluate(async () => ({
    keys: Object.keys(localStorage).sort(),
    old: localStorage.getItem('backtoit:detour-research:v1'),
    unrelated: localStorage.getItem('unrelated:synthetic-research-sentinel'),
    databases: await indexedDB.databases(),
  }));
  expect(data.keys).toEqual([key, oldKey, sentinelKey].sort());
  expect(data.old).toBe('synthetic-old-prototype-sentinel');
  expect(data.unrelated).toBe('synthetic-unrelated-value');
  expect(data.databases).toEqual([]);
  await shot(page, '01-direct-resume-420');
});

test('Tiny Start edits one local suggestion without changing the saved step or forcing a timer', async ({
  page,
}) => {
  await open(page);
  await begin(page, 'start');
  const input = main(page).getByRole('textbox', { name: '一个最小行动（可以修改）', exact: true });
  await expect(input).toHaveValue('打开例题 2');
  await expect(main(page).getByText(original, { exact: true })).toBeVisible();
  await input.fill('只把笔放到例题 2 旁边。');
  await shot(page, '02-tiny-start-editable-420');
  await main(page).getByRole('button', { name: '先做这一小步', exact: true }).click();
  await expect(main(page).getByRole('heading', { name: '可以把手放回任务上了' })).toBeVisible();
  await expect(main(page).getByText('这里没有倒计时。按自己的节奏试试。')).toBeVisible();
  expect((await saved(page)).session?.tinyAction).toBe('只把笔放到例题 2 旁边。');
  expect((await saved(page)).session?.deadline).toBeNull();
  expect((await saved(page)).task?.nextStep).toBe(original);
  await main(page).getByRole('button', { name: '回到返回卡', exact: true }).click();
  await expect(main(page).getByText(original, { exact: true })).toBeVisible();
  await homeFromReturn(page);
});

test('the optional 30-second attempt expires by timestamp, not by an achievement claim (accelerated clock)', async ({
  page,
}) => {
  await page.clock.install({ time: Date.now() });
  await open(page);
  await begin(page, 'start');
  await main(page).getByRole('button', { name: '自愿试 30 秒', exact: true }).click();
  await expect(main(page).getByText(/点击和计时都不代表你已经动手/)).toBeVisible();
  expect((await saved(page)).session?.duration).toBe(30);
  await page.clock.fastForward(31_000);
  await expect(main(page).getByRole('heading', { name: '这一段结束了' })).toBeVisible();
  expect((await saved(page)).session?.endedBy).toBe('elapsed');
  expect((await saved(page)).task?.nextStep).toBe(original);
  await expect(main(page).getByText(/完成学习|专注成功|提高多巴胺/)).toHaveCount(0);
  await shot(page, '03-optional-attempt-ended-420');
});

test('the tactile puzzle takes three predictable keyboard actions and rejects duplicate stale clicks', async ({
  page,
}) => {
  await open(page);
  await begin(page, 'spark', 180);
  const first = main(page).getByRole('button', { name: '放入第 1 片', exact: true });
  await first.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(main(page).getByRole('button', { name: '放入第 2 片', exact: true })).toBeVisible();
  expect((await saved(page)).session?.step).toBe(1);
  await shot(page, '04-spark-piece-one-420');
  const second = main(page).getByRole('button', { name: '放入第 2 片', exact: true });
  await second.focus();
  await page.keyboard.press('Enter');
  await expect(main(page).getByRole('button', { name: '放入第 3 片', exact: true })).toBeFocused();
  await shot(page, '05-spark-piece-two-420');
  await page.keyboard.press('Space');
  await expect(main(page).getByRole('heading', { name: '三片齐了，留在这里就好' })).toBeVisible();
  expect((await saved(page)).session?.step).toBe(3);
  expect((await saved(page)).session?.endedBy).toBe('assembled');
  await expect(main(page).getByRole('button', { name: /放入第|再玩|下一局/ })).toHaveCount(0);
  await expect(main(page).getByText(original, { exact: true })).toBeVisible();
  await shot(page, '06-spark-finished-return-420');
});

test('puzzle early exit and one explicit quiet extension retain the task and permit stopping', async ({
  page,
}) => {
  await open(page);
  await begin(page, 'spark');
  await main(page).getByRole('button', { name: '提前结束拼接', exact: true }).click();
  await expect(main(page).getByRole('heading', { name: '下一步还在这里' })).toBeVisible();
  expect((await saved(page)).session?.step).toBe(0);
  await main(page).getByRole('button', { name: '再安静休息 45 秒（仅一次）', exact: true }).click();
  await expect(main(page).getByRole('heading', { name: '可以暂时什么都不做' })).toBeVisible();
  expect((await saved(page)).session?.path).toBe('quiet');
  expect((await saved(page)).session?.duration).toBe(45);
  expect((await saved(page)).session?.extensions).toBe(1);
  await main(page).getByRole('button', { name: '提前结束休息', exact: true }).click();
  await expect(main(page).getByRole('button', { name: /再安静休息/ })).toHaveCount(0);
  await main(page).getByRole('button', { name: '今天先到这里', exact: true }).click();
  await expect(main(page).getByRole('heading', { name: '今天先到这里，也可以' })).toBeVisible();
  expect((await saved(page)).session).toBeNull();
  expect((await saved(page)).task?.nextStep).toBe(original);
  await shot(page, '07-stop-without-failure-420');
});

test('quiet expiry survives reload and a closed page with no running interval (accelerated clock)', async ({
  page,
  context,
}) => {
  await page.clock.install({ time: Date.now() });
  await open(page);
  await begin(page, 'quiet', 45);
  await shot(page, '08-quiet-pause-420');
  await page.clock.fastForward(46_000);
  await expect(main(page).getByRole('heading', { name: '这一段结束了' })).toBeVisible();
  await page.reload();
  await expect(main(page).getByRole('heading', { name: '这一段结束了' })).toBeVisible();
  await homeFromReturn(page);
  await begin(page, 'quiet', 90);
  const deadline = (await saved(page)).session!.deadline!;
  await page.close();
  const reopened = await context.newPage();
  await reopened.clock.install({ time: deadline + 1000 });
  await open(reopened);
  await expect(main(reopened).getByRole('heading', { name: '这一段结束了' })).toBeVisible();
  await expect(main(reopened).getByText(original, { exact: true })).toBeVisible();
  await expect(main(reopened).getByRole('heading', { name: '接回这个任务' })).toHaveCount(0);
  await shot(reopened, '09-closed-reopened-expired-420');
});

test('Parking can be empty, caps synthetic thoughts at twelve, and allows explicit deletion', async ({
  page,
}) => {
  await open(page);
  await main(page).getByRole('button', { name: '先放这里', exact: true }).click();
  await main(page).getByRole('button', { name: '不填写，直接返回', exact: true }).click();
  await expect(main(page).getByRole('heading', { name: '下一步还在这里' })).toBeVisible();
  expect((await saved(page)).parking).toEqual([]);
  expect((await saved(page)).session?.deadline).toBeNull();
  await homeFromReturn(page);
  // Seed only this prototype's own synthetic list to exercise the UI boundary.
  await page.evaluate((k) => {
    const state = JSON.parse(localStorage.getItem(k)!);
    state.parking = Array.from({ length: 12 }, (_, index) => `合成旧念头 ${index + 1}`);
    localStorage.setItem(k, JSON.stringify(state));
  }, key);
  await page.reload();
  await expect(main(page).getByRole('heading', { name: '从这一小步接回来' })).toBeVisible();
  await main(page).getByRole('button', { name: '先放这里', exact: true }).click();
  await main(page).getByRole('textbox', { name: '想先放下的念头（仅演示）', exact: true }).fill('合成新念头：稍后换一支笔');
  await main(page).getByRole('button', { name: '暂存并返回', exact: true }).click();
  await expect(main(page).getByRole('heading', { name: '下一步还在这里' })).toBeVisible();
  const list = (await saved(page)).parking;
  expect(list).toHaveLength(12);
  expect(list[0]).toBe('合成新念头：稍后换一支笔');
  expect(list).not.toContain('合成旧念头 12');
  expect((await saved(page)).task?.nextStep).toBe(original);
  await settings(page);
  await expect(page.locator('.af-thoughts > li')).toHaveCount(12);
  await page.getByRole('button', { name: '删除暂存第 1 条', exact: true }).click();
  await expect(page.locator('.af-thoughts > li')).toHaveCount(11);
  expect((await saved(page)).parking).not.toContain('合成新念头：稍后换一支笔');
  await shot(page, '10-parking-list-420');
});

test('a second window changes the bound task: direct return refuses stale text until explicit review', async ({
  page,
  context,
}) => {
  await open(page);
  await begin(page, 'quiet');
  const boundId = (await saved(page)).session?.taskId;
  const other = await context.newPage();
  await open(other);
  const next = '合成新记录：只写下第一个已知条件。';
  await editSample(other, next);
  // Invalidating the original binding ends the old help path immediately.
  await expect(main(page).getByText(/另一窗口修改了这个任务/)).toBeVisible();
  await expect(main(page).getByRole('button', { name: '接着做', exact: true })).toHaveCount(0);
  await main(page).getByRole('button', { name: '直接接着做', exact: true }).click();
  await expect(main(page).getByText(/另一窗口修改了这个任务/)).toBeVisible();
  expect((await saved(page)).session?.snapshot?.nextStep).toBe(original);
  await main(page).getByRole('button', { name: '采用最新现场，重新确认', exact: true }).click();
  await expect(main(page).getByText(next, { exact: true })).toBeVisible();
  await main(page).getByRole('button', { name: '接着做', exact: true }).click();
  await expect(main(page).getByRole('heading', { name: '接回这个任务' })).toBeVisible();
  expect((await saved(page)).session?.taskId).toBe(boundId);
  expect((await saved(page)).task?.nextStep).toBe(next);
  await shot(page, '11-reviewed-task-change-420');
});

test('archive, deletion and replacing the selected task in another window cannot restore a wrong target', async ({
  page,
  context,
}) => {
  await open(page);
  const other = await context.newPage();
  await open(other);
  for (const scenario of [
    { button: '归档当前样例', message: /原任务已归档/ },
    { button: '删除当前样例', message: /原任务已删除或不再是选中的任务/ },
    { button: '选中写作样例', message: /原任务已删除或不再是选中的任务/ },
  ]) {
    await reset(page);
    await begin(page, 'quiet');
    const priorSession = (await saved(page)).session?.id;
    await settings(other);
    await other.getByRole('button', { name: scenario.button, exact: true }).click();
    await expect(main(page).getByText(scenario.message)).toBeVisible();
    expect((await saved(page)).session?.id).toBe(priorSession);
    await expect(main(page).getByRole('button', { name: '接着做', exact: true })).toHaveCount(0);
    await main(page).getByRole('button', { name: '直接接着做', exact: true }).click();
    await expect(main(page).getByText(scenario.message)).toBeVisible();
    await expect(main(page).getByRole('heading', { name: '接回这个任务' })).toHaveCount(0);
    if (scenario.button === '归档当前样例') {
      await main(page).getByRole('button', { name: '重新打开这个样例，查看返回卡', exact: true }).click();
      await expect(main(page).getByRole('button', { name: '接着做', exact: true })).toBeVisible();
      expect((await saved(page)).task?.status).toBe('paused');
      expect((await saved(page)).phase).toBe('return');
    }
  }
  await shot(page, '12-replaced-task-refused-420');
});

test('a stale editor keeps its dirty draft and never overwrites a second window’s saved content', async ({
  page,
  context,
}) => {
  await open(page);
  await settings(page);
  const trigger = page.getByRole('button', { name: '编辑当前样例', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: '保存的下一步', exact: true }).fill('尚未提交的合成旧草稿。');
  const other = await context.newPage();
  await open(other);
  await editSample(other, '另一窗口确实保存的新合成内容。');
  await expect(dialog.getByRole('textbox', { name: '保存的下一步', exact: true })).toHaveValue('尚未提交的合成旧草稿。');
  await dialog.getByRole('button', { name: '保存样例', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('旧草稿未保存');
  await expect(dialog.getByRole('textbox', { name: '保存的下一步', exact: true })).toHaveValue('尚未提交的合成旧草稿。');
  expect((await saved(page)).task?.nextStep).toBe('另一窗口确实保存的新合成内容。');
  await shot(page, '13-stale-editor-draft-retained-420');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('corrupted storage is retained until a confirmed reset that changes only this prototype key', async ({
  page,
}) => {
  await page.addInitScript(
    ({ current, prior, unrelated }) => {
      localStorage.setItem(current, '{synthetic-corruption');
      localStorage.setItem(prior, 'synthetic-old-prototype-sentinel');
      localStorage.setItem(unrelated, 'synthetic-unrelated-value');
    },
    { current: key, prior: oldKey, unrelated: sentinelKey },
  );
  await open(page);
  await expect(main(page).getByRole('heading', { name: '样例暂时读不出来' })).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe('{synthetic-corruption');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(main(page).getByRole('heading', { name: 'Sample data cannot be read' })).toBeVisible();
  await expect(main(page).getByRole('alert')).toContainText('original value is retained');
  page.once('dialog', (dialog) => dialog.accept());
  await main(page).getByRole('button', { name: 'Reset this prototype', exact: true }).click();
  await expect(main(page).getByRole('heading', { name: '从这一小步接回来' })).toBeVisible();
  const values = await page.evaluate(
    ({ prior, unrelated }) => ({
      prior: localStorage.getItem(prior),
      unrelated: localStorage.getItem(unrelated),
    }),
    { prior: oldKey, unrelated: sentinelKey },
  );
  expect(values).toEqual({
    prior: 'synthetic-old-prototype-sentinel',
    unrelated: 'synthetic-unrelated-value',
  });
  expect((await saved(page)).phase).toBe('home');
});

test('quota failure does not claim success, change persisted state or lose a typed tiny action', async ({
  page,
}) => {
  await open(page);
  await begin(page, 'start');
  const input = main(page).getByRole('textbox', { name: '一个最小行动（可以修改）', exact: true });
  await input.fill('保留这句合成动作，不能假保存。');
  const before = await page.evaluate((k) => localStorage.getItem(k), key);
  await page.evaluate((k) => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === k) throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
      return originalSetItem.call(this, name, value);
    };
  }, key);
  await main(page).getByRole('button', { name: '先做这一小步', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('存储失败；这次操作没有保存');
  await expect(input).toHaveValue('保留这句合成动作，不能假保存。');
  await expect(main(page).getByRole('heading', { name: '先让第一步变小' })).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(before);
  await shot(page, '14-storage-failure-keeps-draft-420');
});

test('missing next step, English, reduced motion, disabled puzzle and dialog keyboard access remain honest', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await settings(page);
  await page.getByRole('button', { name: '清空样例下一步', exact: true }).click();
  await begin(page, 'start');
  await expect(main(page).getByRole('textbox', { name: '一个最小行动（可以修改）', exact: true })).toBeDisabled();
  await expect(main(page).getByRole('button', { name: '先做这一小步', exact: true })).toBeDisabled();
  await expect(main(page).getByText(/不能替你编一个/)).toBeVisible();
  await main(page).getByRole('button', { name: '直接接着做', exact: true }).click();
  await expect(main(page).getByRole('heading', { name: '接回这个任务' })).toBeVisible();
  await expect(main(page).getByText(/还没有下一步/)).toBeVisible();
  await main(page).getByRole('button', { name: '回到任务卡', exact: true }).click();
  await page.getByRole('button', { name: '选中写作样例', exact: true }).click();
  const reduced = page.getByRole('checkbox', { name: '减少动画（也尊重系统设置）', exact: true });
  await reduced.click();
  await expect(reduced).toBeChecked();
  const puzzle = page.getByRole('checkbox', { name: '显示小拼接入口', exact: true });
  await puzzle.click();
  await expect(puzzle).not.toBeChecked();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(main(page).getByRole('heading', { name: 'Pick up from this small step' })).toBeVisible();
  await expect(main(page).getByText(writing, { exact: true })).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: 'Reduce motion (also respects system settings)', exact: true }),
  ).toBeChecked();
  const trigger = page.getByRole('button', { name: 'Edit current sample', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Edit the demo sample' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Task title', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await main(page).getByRole('button', { name: 'I’m stuck', exact: true }).click();
  await expect(main(page).getByRole('heading', { name: 'What would help right now?' })).toBeFocused();
  await expect(main(page).getByRole('button', { name: /^I want something else/ })).toHaveCount(0);
  await expect(main(page).getByRole('button', { name: /^I can’t get started/ })).toBeVisible();
  const motion = await main(page)
    .getByRole('button', { name: /^I can’t get started/ })
    .evaluate((element) => ({
      transitionDuration: getComputedStyle(element).transitionDuration,
      animation: getComputedStyle(element).animationName,
    }));
  expect(motion).toEqual({ transitionDuration: '0s', animation: 'none' });
  await shot(page, '15-english-minimal-needs-420');
  async function englishHome() {
    await main(page).getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(main(page).getByRole('heading', { name: 'Back to this task' })).toBeVisible();
    await main(page).getByRole('button', { name: 'Back to the task card', exact: true }).click();
  }
  await main(page)
    .getByRole('button', { name: /^I can’t get started/ })
    .click();
  await expect(main(page).getByRole('heading', { name: 'Make the first step smaller' })).toBeVisible();
  await main(page)
    .getByRole('textbox', { name: 'One tiny action (editable)', exact: true })
    .fill('Open the synthetic report draft.');
  await main(page).getByRole('button', { name: 'Try this small step', exact: true }).click();
  await expect(main(page).getByRole('heading', { name: 'You can turn back to your task' })).toBeVisible();
  await main(page).getByRole('button', { name: 'Show the return card', exact: true }).click();
  await englishHome();
  await main(page).getByRole('button', { name: 'Park a thought', exact: true }).click();
  await expect(main(page).getByRole('heading', { name: 'This thought can wait here' })).toBeVisible();
  await main(page)
    .getByRole('textbox', { name: 'A thought to park (demo only)', exact: true })
    .fill('Synthetic thought: try another pen later.');
  await main(page).getByRole('button', { name: 'Park and return', exact: true }).click();
  await expect(main(page).getByRole('heading', { name: 'Your next step is still here' })).toBeVisible();
  await englishHome();
  await main(page).getByRole('button', { name: 'I’m stuck', exact: true }).click();
  await main(page)
    .getByRole('button', { name: /^I’m actually tired/ })
    .click();
  await expect(main(page).getByRole('heading', { name: 'You can do nothing for a moment' })).toBeVisible();
  await main(page).getByRole('button', { name: 'End the pause early', exact: true }).click();
  await englishHome();
  const showPuzzle = page.getByRole('checkbox', { name: 'Show the little puzzle option', exact: true });
  await showPuzzle.click();
  await expect(showPuzzle).toBeChecked();
  await main(page).getByRole('button', { name: 'I’m stuck', exact: true }).click();
  await main(page)
    .getByRole('button', { name: /^I want something else/ })
    .click();
  await expect(
    main(page).getByRole('heading', { name: 'Give this little island three pieces' }),
  ).toBeVisible();
  for (const piece of [1, 2, 3])
    await main(page)
      .getByRole('button', { name: `Place piece ${piece}`, exact: true })
      .click();
  await expect(
    main(page).getByRole('heading', { name: 'Three pieces. A good place to stop.' }),
  ).toBeVisible();
  await expect(main(page).getByText(writing, { exact: true })).toBeVisible();
  await shot(page, '15b-english-spark-return-420');
});

test('six requested viewports and 200 percent CSS layout zoom retain actions without horizontal overflow', async ({
  page,
}) => {
  await open(page);
  for (const width of [320, 360, 420, 480, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(main(page).getByRole('button', { name: '接着做', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await shot(page, `16-home-${width}`);
  }
  await main(page).getByRole('button', { name: '我卡住了', exact: true }).click();
  for (const width of [320, 360, 420, 480, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(main(page).getByRole('button', { name: '直接接着做', exact: true })).toBeVisible();
    await shot(page, `17-needs-${width}`);
  }
  await page.setViewportSize({ width: 420, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(main(page).getByRole('button', { name: '直接接着做', exact: true })).toBeVisible();
  await shot(page, '18-needs-css-200-percent-420');
  await main(page)
    .getByRole('button', { name: /^想刷点别的/ })
    .click();
  await expect(main(page).getByRole('button', { name: '提前结束拼接', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await shot(page, '19-spark-css-200-percent-420');
});
