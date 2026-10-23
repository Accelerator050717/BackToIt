import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertCapturableTab, captureTab, readPageCapture } from '../src/browser/capture';
import { captureCurrentPage, clearPendingCapture, openResources } from '../src/browser/adapter';
import type { Resource } from '../src/domain/types';
import { DATA_CLEAR_GENERATION, withDataClearLock } from '../src/browser/dataClear';
import { stubDataClearLock } from './browser-lock';

const tab = {
  id: 4,
  windowId: 1,
  active: true,
  incognito: false,
  url: 'https://example.org/lesson',
} as chrome.tabs.Tab;
function select(selector: string): void {
  const range = document.createRange();
  range.selectNodeContents(document.querySelector(selector)!);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

beforeEach(() => {
  stubDataClearLock();
  document.body.innerHTML = '';
  document.designMode = 'off';
  window.getSelection()?.removeAllRanges();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('one-shot capture privacy', () => {
  it('collects only title/url for a page, never whole body', () => {
    document.title = 'Lesson';
    document.body.innerHTML = '<p>Private body not selected</p>';
    expect(readPageCapture(false)).not.toHaveProperty('excerpt');
  });
  it('captures explicitly selected normal text and limits its length', () => {
    document.body.innerHTML = `<p>${'a'.repeat(13000)}</p>`;
    select('p');
    const result = readPageCapture(true);
    expect(result.excerpt).toHaveLength(12000);
    expect(result.truncated).toBe(true);
  });
  it('rejects whole-document editing before reading its selected text', () => {
    document.body.innerHTML = '<p>synthetic private editor text</p>';
    document.designMode = 'on';
    select('p');
    const readSelection = vi.spyOn(window.getSelection()!, 'toString');
    const result = readPageCapture(true);
    expect(result.error).toBe('EDITABLE_SELECTION');
    expect(result).not.toHaveProperty('excerpt');
    expect(readSelection).not.toHaveBeenCalled();
    expect(readPageCapture(false)).not.toHaveProperty('excerpt');
  });
  it.each(['form', 'textarea', 'div contenteditable="true"', 'div role="textbox"'])(
    'rejects %s text',
    (markup) => {
      const tag = markup.split(' ')[0]!;
      document.body.innerHTML = `<${markup}>private</${tag}>`;
      select(tag);
      expect(readPageCapture(true).error).toBe('EDITABLE_SELECTION');
    },
  );
  it('rejects selection spanning an editor even with safe endpoints', () => {
    document.body.innerHTML =
      '<main><p id="start">safe</p><div contenteditable="true">private</div><p id="end">safe</p></main>';
    const range = document.createRange();
    range.setStart(document.querySelector('#start')!.firstChild!, 0);
    range.setEnd(document.querySelector('#end')!.firstChild!, 4);
    window.getSelection()!.addRange(range);
    expect(readPageCapture(true).error).toBe('EDITABLE_SELECTION');
  });
  it('does not retain a body selection when a password input is active', () => {
    document.body.innerHTML = '<p>old selection</p><input type="password" value="secret">';
    select('p');
    document.querySelector('input')!.focus();
    expect(readPageCapture(true)).not.toHaveProperty('excerpt');
    expect(readPageCapture(true).error).toBe('EDITABLE_SELECTION');
  });
  it('does not retain body selection when shadow DOM input is focused', () => {
    document.body.innerHTML = '<p>old selection</p><div id="host"></div>';
    select('p');
    const root = document.querySelector('#host')!.attachShadow({ mode: 'open' });
    root.innerHTML = '<input type="password">';
    root.querySelector('input')!.focus();
    expect(readPageCapture(true).error).toBe('EDITABLE_SELECTION');
  });
  it('rejects incognito and restricted protocol before injection', () => {
    expect(() => assertCapturableTab({ ...tab, incognito: true })).toThrow('INCOGNITO');
    for (const url of [
      'chrome://settings',
      'file:///private',
      'https://chromewebstore.google.com/detail/test',
    ])
      expect(() => assertCapturableTab({ ...tab, url })).toThrow('RESTRICTED_PAGE');
    expect(() => assertCapturableTab({ ...tab, url: undefined })).toThrow('NO_PERMISSION');
  });
  it('never saves cached page data after a navigation or tab switch', async () => {
    const executeScript = vi
      .fn()
      .mockResolvedValue([{ result: { title: 'Lesson', url: tab.url, source: 'page' } }]);
    vi.stubGlobal('chrome', {
      scripting: { executeScript },
      tabs: { get: vi.fn().mockResolvedValue({ ...tab, url: 'https://another.example/' }) },
    });
    await expect(captureTab(tab)).rejects.toThrow('PAGE_CHANGED');
    expect(executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 4, frameIds: [0] } }),
    );
  });
  it('reports lost activeTab permission without trying a fallback read', async () => {
    const executeScript = vi.fn().mockRejectedValue(new Error('No permission'));
    vi.stubGlobal('chrome', { scripting: { executeScript } });
    await expect(captureTab(tab)).rejects.toThrow('NO_PERMISSION');
    expect(executeScript).toHaveBeenCalledTimes(1);
  });
});

describe('capture clear-all boundary', () => {
  let values: Record<string, unknown>;
  const draft = { title: 'Lesson', url: tab.url, source: 'page' };
  const executeScript = vi.fn<() => Promise<unknown>>();
  beforeEach(() => {
    values = {};
    executeScript.mockResolvedValue([{ result: draft }]);
    vi.stubGlobal('chrome', {
      tabs: { query: vi.fn().mockResolvedValue([tab]), get: vi.fn().mockResolvedValue(tab) },
      scripting: { executeScript },
      storage: {
        session: {
          get: vi.fn(async () => ({ ...values })),
          set: vi.fn(async (patch: object) => {
            Object.assign(values, patch);
          }),
          remove: vi.fn(async (key: string) => {
            delete values[key];
          }),
        },
      },
    });
  });
  it('discards a capture that finishes after data is cleared in another window', async () => {
    let finishCapture: (value: unknown) => void = () => undefined;
    executeScript.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishCapture = resolve;
        }),
    );
    const capturing = captureCurrentPage();
    const rejected = expect(capturing).rejects.toThrow('DATA_CLEARED');
    await vi.waitFor(() => expect(executeScript).toHaveBeenCalledOnce());
    await withDataClearLock(async () => {
      await clearPendingCapture();
      await chrome.storage.session.set({ [DATA_CLEAR_GENERATION]: 'after-clear' });
    });
    finishCapture([{ result: draft }]);
    await rejected;
    expect(values.pendingCapture).toBeUndefined();
    expect(chrome.storage.session.set).toHaveBeenCalledExactlyOnceWith({
      [DATA_CLEAR_GENERATION]: 'after-clear',
    });
  });
  it('serializes a pending write with deletion so it cannot land after the clear', async () => {
    let finishWrite: () => void = () => undefined;
    let writing = false;
    vi.mocked(chrome.storage.session.set).mockImplementationOnce(async (patch) => {
      writing = true;
      await new Promise<void>((resolve) => {
        finishWrite = resolve;
      });
      Object.assign(values, patch);
    });
    const capturing = captureCurrentPage();
    await vi.waitFor(() => expect(writing).toBe(true));
    let clearing = false;
    const cleared = withDataClearLock(async () => {
      clearing = true;
      await clearPendingCapture();
      await chrome.storage.session.set({ [DATA_CLEAR_GENERATION]: 'after-clear' });
    });
    await Promise.resolve();
    expect(clearing).toBe(false);
    finishWrite();
    await capturing;
    await cleared;
    expect(clearing).toBe(true);
    expect(values.pendingCapture).toBeUndefined();
    expect(values[DATA_CLEAR_GENERATION]).toBe('after-clear');
  });
  it('allows a new explicit capture after a completed clear', async () => {
    values[DATA_CLEAR_GENERATION] = 'after-clear';
    await expect(captureCurrentPage()).resolves.toMatchObject(draft);
    expect(values.pendingCapture).toMatchObject(draft);
  });
});

describe('safe resource opening', () => {
  it('reuses only an exactly verified URL, creates others, and coalesces concurrent clicks', async () => {
    const query = vi.fn().mockResolvedValue([
      { id: 1, url: 'https://example.org/a', incognito: false },
      { id: 2, title: 'Same title' },
    ]);
    const update = vi.fn().mockResolvedValue(undefined);
    const create = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', { tabs: { query, update, create } });
    const resources = [
      { url: 'https://example.org/a' },
      { url: 'https://example.org/b' },
      { url: 'https://example.org/b' },
    ] as Resource[];
    await Promise.all([openResources(resources), openResources(resources)]);
    expect(update).toHaveBeenCalledExactlyOnceWith(1, { active: true });
    expect(create).toHaveBeenCalledExactlyOnceWith({ url: 'https://example.org/b', active: false });
  });
  it('rejects dangerous saved URLs without opening tabs', async () => {
    const create = vi.fn();
    vi.stubGlobal('chrome', { tabs: { create } });
    await expect(openResources([{ url: 'javascript:alert(1)' }] as Resource[])).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
  it('opens different resources concurrently while coalescing a repeated request for the first', async () => {
    let releaseQuery: (tabs: chrome.tabs.Tab[]) => void = () => undefined;
    const tabsReady = new Promise<chrome.tabs.Tab[]>((resolve) => {
      releaseQuery = resolve;
    });
    const query = vi.fn(() => tabsReady);
    const create = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', { tabs: { query, create } });
    const firstResources = [{ url: 'https://example.org/a' }] as Resource[];
    const first = openResources(firstResources);
    const second = openResources([{ url: 'https://example.org/b' }] as Resource[]);
    const repeated = openResources(firstResources);
    releaseQuery([]);
    await Promise.all([first, second, repeated]);
    expect(query).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledWith({ url: 'https://example.org/a', active: true });
    expect(create).toHaveBeenCalledWith({ url: 'https://example.org/b', active: true });
  });
  it('allows the same resource to be retried after a browser open fails', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error('Browser open failed'))
      .mockResolvedValue(undefined);
    vi.stubGlobal('chrome', { tabs: { query: vi.fn().mockResolvedValue([]), create } });
    const resources = [{ url: 'https://example.org/retry' }] as Resource[];
    await expect(openResources(resources)).rejects.toThrow('Browser open failed');
    await expect(openResources(resources)).resolves.toBeUndefined();
    expect(create).toHaveBeenCalledTimes(2);
  });
});
