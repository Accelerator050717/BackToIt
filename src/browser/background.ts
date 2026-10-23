import { z } from 'zod';
import { repo } from '../storage/repository';
import { inspectUrl } from '../domain/url';
import { captureTab } from './capture';
import { clearPendingCapture, getPendingCapture, setBrowserFeedback, setPendingCapture } from './adapter';
import { AppError, errorCode } from './errors';
import { getSettings } from './settings';
import { assertDataClearGeneration, readDataClearGeneration, withDataClearLock } from './dataClear';

const messageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CAPTURE_CURRENT') }).strict(),
  z.object({ type: z.literal('GET_PENDING') }).strict(),
  z.object({ type: z.literal('CLEAR_PENDING') }).strict(),
]);

export function trustedSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id || !sender.url) return false;
  try {
    const url = new URL(sender.url);
    return (
      url.protocol === 'chrome-extension:' &&
      url.hostname === chrome.runtime.id &&
      ['/app.html', '/sidepanel.html'].includes(url.pathname)
    );
  } catch {
    return false;
  }
}

const activeCaptures = new Set<number>();
export async function saveFromBrowser(
  tab: chrome.tabs.Tab | undefined,
  selection: boolean,
  frameId = 0,
  startedGeneration?: string | null,
): Promise<void> {
  if (!tab || tab.id === undefined) throw new AppError('NO_PAGE');
  if (activeCaptures.has(tab.id)) return;
  activeCaptures.add(tab.id);
  let generation: string | null | undefined = startedGeneration;
  try {
    if (generation === undefined) generation = await readDataClearGeneration();
    await assertDataClearGeneration(generation);
    const captureGeneration = generation;
    if (frameId !== 0) throw new AppError('FRAME_SELECTION');
    const expectedCurrentTaskId = (await repo.getState()).currentTaskId;
    const draft = await captureTab(tab, selection);
    await withDataClearLock(async () => {
      await assertDataClearGeneration(captureGeneration);
      if (inspectUrl(draft.url).sensitive) {
        await setPendingCapture(draft);
        await setBrowserFeedback({ kind: 'pending', at: Date.now() });
        return;
      }
      let saved: Awaited<ReturnType<typeof repo.addResourceToCurrent>>;
      try {
        saved = await repo.addResourceToCurrent(
          { title: draft.title, url: draft.url, source: draft.source, excerpt: draft.excerpt },
          expectedCurrentTaskId,
        );
      } catch (error) {
        await setPendingCapture(draft);
        await setBrowserFeedback({
          kind: errorCode(error) === 'NO_CURRENT_TASK' ? 'pending' : 'error',
          code: errorCode(error, 'SAVE_FAILED'),
          at: Date.now(),
        });
        return;
      }
      await setBrowserFeedback({
        kind: 'saved',
        taskTitle: saved.taskTitle,
        undoId: saved.undoId,
        truncated: draft.truncated,
        at: Date.now(),
      });
    });
  } catch (error) {
    if (errorCode(error) === 'DATA_CLEARED' || generation === undefined) return;
    await withDataClearLock(async () => {
      // A failed injection must not restore stale feedback after another window clears data.
      if ((await readDataClearGeneration()) !== generation) return;
      await setBrowserFeedback({ kind: 'error', code: errorCode(error), at: Date.now() });
    });
  } finally {
    activeCaptures.delete(tab.id);
  }
}

function openPanelFromGesture(windowId: number): void {
  // The call itself must happen synchronously in the original Chrome gesture callback.
  const opening = chrome.sidePanel.open({ windowId });
  const generation = readDataClearGeneration().catch(() => undefined);
  void opening.catch(async () => {
    const expected = await generation;
    if (expected === undefined) return;
    await withDataClearLock(async () => {
      if ((await readDataClearGeneration()) !== expected) return;
      const { browserFeedback } = await chrome.storage.session.get('browserFeedback');
      if (!browserFeedback) await setBrowserFeedback({ kind: 'error', code: 'PANEL_FAILED', at: Date.now() });
    });
  });
}

async function installMenus(): Promise<void> {
  const settings = await getSettings();
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: 'save-page',
    title: settings.language === 'en' ? 'Save this page to BackToIt' : '保存此页到接着来',
    contexts: ['page'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  });
  chrome.contextMenus.create({
    id: 'save-selection',
    title: settings.language === 'en' ? 'Save selected text to BackToIt' : '保存选中内容到接着来',
    contexts: ['selection'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  });
}

export function registerBackground(): void {
  // Chromium intentionally skips activeTab grants for its built-in side-panel toggle.
  // Keep a normal action click, which grants activeTab, and open the panel from its gesture.
  chrome.runtime.onInstalled.addListener(() => {
    void installMenus();
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  });
  chrome.runtime.onStartup.addListener(() => {
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  });
  chrome.action.onClicked.addListener((tab) => {
    if (!tab.incognito) openPanelFromGesture(tab.windowId);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.language) void installMenus();
  });
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== 'save-page' && info.menuItemId !== 'save-selection') return;
    if (!tab || tab.incognito) return;
    openPanelFromGesture(tab.windowId);
    // info.selectionText is deliberately ignored: it may contain form/editor content.
    void saveFromBrowser(tab, info.menuItemId === 'save-selection', info.frameId ?? 0);
  });
  chrome.commands.onCommand.addListener((command, tab) => {
    if (command !== 'open-panel' && command !== 'save-page') return;
    if (tab?.incognito) return;
    // Commands supply the tab on supported Chrome; WINDOW_ID_CURRENT is synchronous fallback.
    openPanelFromGesture(tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT);
    if (command === 'save-page') {
      if (tab) void saveFromBrowser(tab, false);
      else
        void (async () => {
          const generation = await readDataClearGeneration();
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          await saveFromBrowser(activeTab, false, 0, generation);
        })();
    }
  });
  chrome.runtime.onMessage.addListener((message: unknown, sender, respond) => {
    if (!trustedSender(sender)) {
      respond({ ok: false, error: 'INVALID_MESSAGE' });
      return false;
    }
    const parsed = messageSchema.safeParse(message);
    if (!parsed.success) {
      respond({ ok: false, error: 'INVALID_MESSAGE' });
      return false;
    }
    void (async () => {
      if (parsed.data.type === 'GET_PENDING') return getPendingCapture();
      if (parsed.data.type === 'CLEAR_PENDING') {
        await clearPendingCapture();
        return null;
      }
      const generation = await readDataClearGeneration();
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new AppError('NO_PAGE');
      const draft = await captureTab(tab);
      return withDataClearLock(async () => {
        await assertDataClearGeneration(generation);
        return draft;
      });
    })()
      .then((result) => respond({ ok: true, result }))
      .catch((error) => respond({ ok: false, error: errorCode(error) }));
    return true;
  });
}
