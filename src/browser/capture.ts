import { z } from 'zod';
import type { CaptureDraft } from '../domain/types';
import { inspectUrl } from '../domain/url';
import { AppError } from './errors';

export const MAX_EXCERPT = 12000;
export const captureSchema = z
  .object({
    title: z.string().max(500),
    url: z.string().max(8192),
    excerpt: z.string().max(MAX_EXCERPT).optional(),
    source: z.enum(['page', 'selection', 'manual']),
    truncated: z.boolean().optional(),
    error: z.string().max(100).optional(),
  })
  .strict();

// Serialized by chrome.scripting: keep this function self-contained. Never read field values.
export function readPageCapture(includeSelection: boolean): CaptureDraft {
  const draft: CaptureDraft = {
    title: document.title.slice(0, 500),
    url: location.href,
    source: includeSelection ? 'selection' : 'page',
  };
  if (!includeSelection) return draft;
  if (document.designMode?.toLowerCase() === 'on') return { ...draft, error: 'EDITABLE_SELECTION' };
  const excluded =
    'input,textarea,select,option,form,[contenteditable]:not([contenteditable="false"]),[role="textbox"]';
  const forbidden = (node: Node | null): boolean => {
    let element = node instanceof Element ? node : node?.parentElement;
    while (element) {
      if (element.closest(excluded)) return true;
      const root = element.getRootNode();
      element = root instanceof ShadowRoot ? root.host : null;
    }
    return false;
  };
  const selection = window.getSelection();
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  if (forbidden(active) || (selection && (forbidden(selection.anchorNode) || forbidden(selection.focusNode))))
    return { ...draft, error: 'EDITABLE_SELECTION' };
  if (!selection || selection.isCollapsed || !selection.rangeCount)
    return { ...draft, error: 'NO_SELECTION' };
  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i);
    if (forbidden(range.startContainer) || forbidden(range.endContainer))
      return { ...draft, error: 'EDITABLE_SELECTION' };
    const ancestor = range.commonAncestorContainer;
    if (ancestor instanceof Element) {
      for (const element of ancestor.querySelectorAll(excluded)) {
        if (range.intersectsNode(element)) return { ...draft, error: 'EDITABLE_SELECTION' };
      }
    }
  }
  const text = selection.toString().trim();
  if (!text) return { ...draft, error: 'NO_SELECTION' };
  return { ...draft, excerpt: text.slice(0, 12000), truncated: text.length > 12000 };
}

export function assertCapturableTab(
  tab: chrome.tabs.Tab | undefined,
): asserts tab is chrome.tabs.Tab & { id: number; url: string } {
  if (!tab || tab.id === undefined) throw new AppError('NO_PAGE');
  if (tab.incognito) throw new AppError('INCOGNITO');
  if (!tab.url) throw new AppError('NO_PERMISSION');
  let url: URL;
  try {
    url = new URL(tab.url);
  } catch {
    throw new AppError('RESTRICTED_PAGE');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.hostname === 'chromewebstore.google.com' ||
    (url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore'))
  )
    throw new AppError('RESTRICTED_PAGE');
}

export async function captureTab(tab: chrome.tabs.Tab, includeSelection = false): Promise<CaptureDraft> {
  assertCapturableTab(tab);
  const initialUrl = tab.url;
  let results: chrome.scripting.InjectionResult<CaptureDraft>[];
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] },
      func: readPageCapture,
      args: [includeSelection],
    });
  } catch {
    throw new AppError('NO_PERMISSION');
  }
  const parsed = captureSchema.safeParse(results[0]?.result);
  if (!parsed.success) throw new AppError('RESTRICTED_PAGE');
  const draft = parsed.data;
  if (draft.error) throw new AppError(draft.error);
  let fresh: chrome.tabs.Tab;
  try {
    fresh = await chrome.tabs.get(tab.id);
  } catch {
    throw new AppError('PAGE_CHANGED');
  }
  if (fresh.incognito) throw new AppError('INCOGNITO');
  if (!fresh.active || !fresh.url || fresh.url !== draft.url || initialUrl !== draft.url)
    throw new AppError('PAGE_CHANGED');
  const inspected = inspectUrl(draft.url);
  return { ...draft, url: inspected.url, title: draft.title.trim() || new URL(inspected.url).hostname };
}
