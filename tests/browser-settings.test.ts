import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  defaultSettings,
  disableOllama,
  enableOllama,
  getSettings,
  updateSettings,
} from '../src/browser/settings';

let values: Record<string, unknown>;
const request = vi.fn();
const remove = vi.fn();
beforeEach(() => {
  values = {};
  request.mockResolvedValue(true);
  remove.mockResolvedValue(true);
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async () => values),
        set: vi.fn(async (patch: object) => {
          Object.assign(values, patch);
        }),
      },
    },
    permissions: { request, remove },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it('defaults disabled with no probe or permission request', async () => {
  const network = vi.fn();
  vi.stubGlobal('fetch', network);
  expect(await getSettings()).toEqual(defaultSettings);
  expect(request).not.toHaveBeenCalled();
  expect(network).not.toHaveBeenCalled();
});
it('requests permission synchronously in the original gesture call and respects refusal', async () => {
  request.mockResolvedValue(false);
  const promise = enableOllama('http://localhost:11434');
  expect(request).toHaveBeenCalledExactlyOnceWith({ origins: ['http://localhost/*'] });
  expect(await promise).toBe(false);
  expect((await getSettings()).ollama.enabled).toBe(false);
});
it('persists enable and revokes both grants on disable', async () => {
  expect(await enableOllama('http://127.0.0.1:11434')).toBe(true);
  expect((await getSettings()).ollama.enabled).toBe(true);
  await disableOllama();
  expect((await getSettings()).ollama.enabled).toBe(false);
  expect(remove).toHaveBeenLastCalledWith({ origins: ['http://localhost/*', 'http://127.0.0.1/*'] });
});
it('independent setting patches preserve other values and reject remote endpoints', async () => {
  await updateSettings({ language: 'en' });
  await updateSettings({ appearance: 'system' });
  expect(await getSettings()).toMatchObject({ language: 'en', appearance: 'system' });
  await expect(enableOllama('https://remote.example' as 'http://localhost:11434')).rejects.toThrow(
    'AI_ENDPOINT',
  );
  expect(request).not.toHaveBeenCalled();
});
