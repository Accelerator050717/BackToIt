import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { registerBackground, saveFromBrowser, trustedSender } from '../src/browser/background';
import { repo } from '../src/storage/repository';
import { clearBrowserFeedback, clearPendingCapture } from '../src/browser/adapter';
import { DATA_CLEAR_GENERATION, withDataClearLock } from '../src/browser/dataClear';
import { stubDataClearLock } from './browser-lock';

vi.mock('../src/storage/repository', () => ({ repo: { getState: vi.fn(), addResourceToCurrent: vi.fn() } }));
const tab = {
  id: 7,
  windowId: 2,
  active: true,
  incognito: false,
  url: 'https://example.org/lesson',
} as chrome.tabs.Tab;
let values: Record<string, unknown>;
let menuListener: (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void;
let actionListener: (tab: chrome.tabs.Tab) => void;
const getTab = vi.fn<() => Promise<chrome.tabs.Tab>>();
const executeScript = vi.fn<() => Promise<unknown>>();
beforeEach(() => {
  stubDataClearLock();
  values = {};
  getTab.mockResolvedValue(tab);
  executeScript.mockResolvedValue([{ result: { title: 'Lesson', url: tab.url, source: 'page' } }]);
  const listen = { addListener: vi.fn() };
  vi.stubGlobal('chrome', {
    runtime: { id: 'extension-id', onInstalled: listen, onStartup: listen, onMessage: listen },
    storage: {
      local: { get: vi.fn().mockResolvedValue({}) },
      session: {
        get: vi.fn(async () => values),
        set: vi.fn(async (patch: object) => {
          Object.assign(values, patch);
        }),
        remove: vi.fn(async (key: string) => {
          delete values[key];
        }),
      },
      onChanged: listen,
    },
    tabs: { get: getTab },
    scripting: { executeScript },
    sidePanel: {
      open: vi.fn().mockResolvedValue(undefined),
      setPanelBehavior: vi.fn().mockResolvedValue(undefined),
    },
    contextMenus: {
      onClicked: {
        addListener: vi.fn((handler: typeof menuListener) => {
          menuListener = handler;
        }),
      },
    },
    commands: { onCommand: listen },
    windows: { WINDOW_ID_CURRENT: -2 },
    action: {
      onClicked: {
        addListener: vi.fn((handler: typeof actionListener) => {
          actionListener = handler;
        }),
      },
    },
  });
  vi.mocked(repo.getState).mockResolvedValue({
    currentTaskId: 'task-1',
    tasks: [],
    resources: [],
    checkpoints: [],
    parking: [],
  });
  vi.mocked(repo.addResourceToCurrent).mockResolvedValue({
    resource: {} as never,
    undoId: 'undo-1',
    taskTitle: 'Current',
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('only accepts messages from packaged UI extension pages', () => {
  expect(
    trustedSender({ id: 'extension-id', url: 'chrome-extension://extension-id/app.html#settings' }),
  ).toBe(true);
  for (const sender of [
    { id: 'extension-id', url: 'https://example.org' },
    { id: 'other', url: 'chrome-extension://extension-id/app.html' },
    { id: 'extension-id', url: 'chrome-extension://extension-id/arbitrary.html' },
  ])
    expect(trustedSender(sender)).toBe(false);
});
it('opens the panel through a normal toolbar action without capturing or saving', () => {
  registerBackground();
  actionListener(tab);
  expect(chrome.sidePanel.open).toHaveBeenCalledExactlyOnceWith({ windowId: 2 });
  expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  expect(repo.addResourceToCurrent).not.toHaveBeenCalled();
});
it('shows saved feedback only after the repository commit, with undo', async () => {
  let resolve: (value: Awaited<ReturnType<typeof repo.addResourceToCurrent>>) => void = () => undefined;
  vi.mocked(repo.addResourceToCurrent).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const save = saveFromBrowser(tab, false);
  await vi.waitFor(() => expect(repo.addResourceToCurrent).toHaveBeenCalledOnce());
  expect(values.browserFeedback).toBeUndefined();
  expect(values.pendingCapture).toBeUndefined();
  resolve({ resource: {} as never, undoId: 'undo-1', taskTitle: 'Current' });
  await save;
  expect(repo.addResourceToCurrent).toHaveBeenCalledWith(expect.objectContaining({ url: tab.url }), 'task-1');
  expect(values.browserFeedback).toMatchObject({ kind: 'saved', taskTitle: 'Current', undoId: 'undo-1' });
  expect(values.pendingCapture).toBeUndefined();
});
it('preserves the draft when no task exists or persistent storage fails', async () => {
  vi.mocked(repo.getState).mockResolvedValue({
    currentTaskId: null,
    tasks: [],
    resources: [],
    checkpoints: [],
    parking: [],
  });
  vi.mocked(repo.addResourceToCurrent).mockRejectedValue({ code: 'NO_CURRENT_TASK' });
  await saveFromBrowser(tab, false);
  expect(values.pendingCapture).toBeDefined();
  expect(values.browserFeedback).toMatchObject({ kind: 'pending', code: 'NO_CURRENT_TASK' });
  vi.mocked(repo.addResourceToCurrent).mockRejectedValue(new Error('Quota'));
  await saveFromBrowser(tab, false);
  expect(values.pendingCapture).toBeDefined();
  expect(values.browserFeedback).toMatchObject({ kind: 'error', code: 'SAVE_FAILED' });
});
it('does not persist suspected credentials until an explicit safe-form choice', async () => {
  const sensitiveTab = { ...tab, url: 'https://example.org/?token=synthetic-token' };
  getTab.mockResolvedValue(sensitiveTab);
  executeScript.mockResolvedValue([
    { frameId: 0, result: { title: 'Sensitive', url: sensitiveTab.url, source: 'page' } },
  ]);
  await saveFromBrowser(sensitiveTab, false);
  expect(repo.addResourceToCurrent).not.toHaveBeenCalled();
  expect(values.pendingCapture).toBeDefined();
  expect(values.browserFeedback).toMatchObject({ kind: 'pending' });
});
it('opens the real side panel API synchronously before asynchronous capture, ignoring info.selectionText', async () => {
  registerBackground();
  menuListener({ menuItemId: 'save-page', editable: false, selectionText: 'do not trust' }, tab);
  expect(chrome.sidePanel.open).toHaveBeenCalledExactlyOnceWith({ windowId: 2 });
  expect(vi.mocked(chrome.sidePanel.open).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(chrome.storage.session.get).mock.invocationCallOrder[0]!,
  );
  await vi.waitFor(() => expect(repo.addResourceToCurrent).toHaveBeenCalledOnce());
  expect(vi.mocked(chrome.sidePanel.open).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(chrome.scripting.executeScript).mock.invocationCallOrder[0]!,
  );
  expect(vi.mocked(repo.addResourceToCurrent).mock.calls[0]![0].excerpt).toBeUndefined();
});
it('rejects embedded-frame capture instead of accidentally saving the parent selection', async () => {
  await saveFromBrowser(tab, true, 5);
  expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  expect(values.browserFeedback).toMatchObject({ kind: 'error', code: 'FRAME_SELECTION' });
});
it('keeps a capture pending when the current task changes during page injection', async () => {
  let currentTaskId = 'task-1';
  let finishCapture: (value: unknown) => void = () => undefined;
  executeScript.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishCapture = resolve;
      }),
  );
  vi.mocked(repo.addResourceToCurrent).mockImplementation(async (_input, expectedCurrentTaskId) => {
    if (expectedCurrentTaskId !== currentTaskId) throw { code: 'CONFLICT' };
    return { resource: {} as never, undoId: 'wrong-save', taskTitle: 'New task' };
  });
  const saving = saveFromBrowser(tab, false);
  await vi.waitFor(() => expect(executeScript).toHaveBeenCalledOnce());
  currentTaskId = 'task-2';
  finishCapture([{ result: { title: 'Lesson', url: tab.url, source: 'page' } }]);
  await saving;
  expect(repo.addResourceToCurrent).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Lesson' }),
    'task-1',
  );
  expect(values.pendingCapture).toMatchObject({ title: 'Lesson', url: tab.url });
  expect(values.browserFeedback).toMatchObject({ kind: 'error', code: 'CONFLICT' });
  expect(values.browserFeedback).not.toHaveProperty('undoId');
});

it.each(['page', 'selection', 'sensitive'])(
  'drops an unfinished %s browser capture after another window clears data',
  async (mode) => {
    const captureTab = mode === 'sensitive' ? { ...tab, url: 'https://example.org/?token=synthetic' } : tab;
    getTab.mockResolvedValue(captureTab);
    let finishCapture: (value: unknown) => void = () => undefined;
    executeScript.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishCapture = resolve;
        }),
    );
    const saving = saveFromBrowser(captureTab, mode === 'selection');
    await vi.waitFor(() => expect(executeScript).toHaveBeenCalledOnce());
    await withDataClearLock(async () => {
      await clearPendingCapture();
      await clearBrowserFeedback();
      await chrome.storage.session.set({ [DATA_CLEAR_GENERATION]: 'after-clear' });
    });
    finishCapture([
      {
        result: {
          title: 'Old capture',
          url: captureTab.url,
          source: mode === 'selection' ? 'selection' : 'page',
        },
      },
    ]);
    await saving;
    expect(repo.addResourceToCurrent).not.toHaveBeenCalled();
    expect(values.pendingCapture).toBeUndefined();
    expect(values.browserFeedback).toBeUndefined();
  },
);

it('does not restore failure feedback when a slow injection fails after data was cleared', async () => {
  let failCapture: (reason: Error) => void = () => undefined;
  executeScript.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        failCapture = reject;
      }),
  );
  const saving = saveFromBrowser(tab, false);
  await vi.waitFor(() => expect(executeScript).toHaveBeenCalledOnce());
  await withDataClearLock(async () => {
    await chrome.storage.session.set({ [DATA_CLEAR_GENERATION]: 'after-clear' });
  });
  failCapture(new Error('lost permission'));
  await saving;
  expect(values.pendingCapture).toBeUndefined();
  expect(values.browserFeedback).toBeUndefined();
});

it('waits for an in-progress repository commit before clearing its pending draft and feedback', async () => {
  let failSave: (reason: Error) => void = () => undefined;
  vi.mocked(repo.addResourceToCurrent).mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        failSave = reject;
      }),
  );
  const saving = saveFromBrowser(tab, false);
  await vi.waitFor(() => expect(repo.addResourceToCurrent).toHaveBeenCalledOnce());
  let clearing = false;
  const cleared = withDataClearLock(async () => {
    clearing = true;
    await clearPendingCapture();
    await clearBrowserFeedback();
    await chrome.storage.session.set({ [DATA_CLEAR_GENERATION]: 'after-clear' });
  });
  await Promise.resolve();
  expect(clearing).toBe(false);
  failSave(new Error('storage failed'));
  await saving;
  await cleared;
  expect(clearing).toBe(true);
  expect(values.pendingCapture).toBeUndefined();
  expect(values.browserFeedback).toBeUndefined();
});

it('preserves an empty starting generation when a command waits for its active tab', async () => {
  values[DATA_CLEAR_GENERATION] = 'after-clear';
  await saveFromBrowser(tab, false, 0, null);
  expect(repo.getState).not.toHaveBeenCalled();
  expect(executeScript).not.toHaveBeenCalled();
  expect(values.pendingCapture).toBeUndefined();
  expect(values.browserFeedback).toBeUndefined();
});
