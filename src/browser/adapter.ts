import { z } from 'zod';
import type { CaptureDraft, Resource } from '../domain/types';
import { inspectUrl } from '../domain/url';
import { captureSchema, captureTab } from './capture';
import { AppError } from './errors';
import { assertDataClearGeneration, readDataClearGeneration, withDataClearLock } from './dataClear';

const feedbackSchema = z
  .object({
    kind: z.enum(['saved', 'error', 'pending']),
    taskTitle: z.string().max(240).optional(),
    undoId: z.string().max(200).optional(),
    code: z.string().max(100).optional(),
    truncated: z.boolean().optional(),
    at: z.number(),
  })
  .strict();
export type BrowserFeedback = z.infer<typeof feedbackSchema>;

export async function captureCurrentPage(): Promise<CaptureDraft> {
  const generation = await readDataClearGeneration();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new AppError('NO_PAGE');
  const draft = await captureTab(tab);
  await withDataClearLock(async () => {
    await assertDataClearGeneration(generation);
    await setPendingCapture(draft);
  });
  return draft;
}

export async function getPendingCapture(): Promise<CaptureDraft | null> {
  const { pendingCapture } = await chrome.storage.session.get('pendingCapture');
  const result = captureSchema.safeParse(pendingCapture);
  return result.success ? result.data : null;
}
export async function setPendingCapture(draft: CaptureDraft): Promise<void> {
  await chrome.storage.session.set({ pendingCapture: captureSchema.parse(draft) });
}
export async function clearPendingCapture(): Promise<void> {
  await chrome.storage.session.remove('pendingCapture');
}
export async function getBrowserFeedback(): Promise<BrowserFeedback | null> {
  const { browserFeedback } = await chrome.storage.session.get('browserFeedback');
  const result = feedbackSchema.safeParse(browserFeedback);
  return result.success ? result.data : null;
}
export async function setBrowserFeedback(feedback: BrowserFeedback): Promise<void> {
  await chrome.storage.session.set({ browserFeedback: feedbackSchema.parse(feedback) });
}
export async function clearBrowserFeedback(): Promise<void> {
  await chrome.storage.session.remove('browserFeedback');
}

const openings = new Map<string, Promise<void>>();
export function openResources(resources: Resource[]): Promise<void> {
  let urls: string[];
  try {
    urls = [
      ...new Set(resources.flatMap((resource) => (resource.url ? [inspectUrl(resource.url).url] : []))),
    ];
    if (urls.length > 30) throw new AppError('INVALID_MESSAGE');
  } catch (error) {
    return Promise.reject(error);
  }
  // Coalesce only the same requested resources. A separate click must still open its own URL.
  const key = JSON.stringify(urls);
  const inFlight = openings.get(key);
  if (inFlight) return inFlight;
  const opening = (async () => {
    // Without tabs permission, only authorized URLs are visible. Never infer identity from tabId/title.
    const tabs = await chrome.tabs.query({ currentWindow: true });
    for (const [index, url] of urls.entries()) {
      const existing = tabs.find((tab) => !tab.incognito && tab.url === url && tab.id !== undefined);
      if (existing?.id !== undefined) {
        if (index === 0) await chrome.tabs.update(existing.id, { active: true });
      } else {
        await chrome.tabs.create({ url, active: index === 0 });
      }
    }
  })().finally(() => {
    openings.delete(key);
  });
  openings.set(key, opening);
  return opening;
}

export async function openApp(section?: string): Promise<void> {
  const query =
    section && ['tasks', 'settings', 'home', 'history'].includes(section) ? `?section=${section}` : '';
  await chrome.tabs.create({ url: chrome.runtime.getURL(`app.html${query}`) });
}
