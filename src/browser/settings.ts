import { z } from 'zod';
import type { OllamaConfig, Settings } from '../domain/types';
import { AppError } from './errors';

export const ollamaConfigSchema = z
  .object({
    enabled: z.boolean(),
    endpoint: z.enum(['http://localhost:11434', 'http://127.0.0.1:11434']),
    model: z.string().max(200),
  })
  .strict();
const settingsSchema = z
  .object({
    language: z.enum(['zh-CN', 'en']),
    appearance: z.enum(['light', 'system']),
    ollama: ollamaConfigSchema,
  })
  .strict();
export const defaultSettings: Settings = {
  language: 'zh-CN',
  appearance: 'light',
  ollama: { enabled: false, endpoint: 'http://127.0.0.1:11434', model: '' },
};
export const DEFAULT_SETTINGS = defaultSettings;

// Independent keys avoid overwriting an unrelated setting changed in another extension page.
export async function getSettings(): Promise<Settings> {
  const saved = await chrome.storage.local.get(['language', 'appearance', 'ollama']);
  return {
    language: settingsSchema.shape.language.catch('zh-CN').parse(saved.language),
    appearance: settingsSchema.shape.appearance.catch('light').parse(saved.appearance),
    ollama: ollamaConfigSchema.catch(defaultSettings.ollama).parse(saved.ollama),
  };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const valid = settingsSchema.partial().parse(patch);
  await chrome.storage.local.set(valid);
  return getSettings();
}

export function ollamaOrigin(endpoint: OllamaConfig['endpoint']): string {
  if (endpoint === 'http://localhost:11434') return 'http://localhost/*';
  if (endpoint === 'http://127.0.0.1:11434') return 'http://127.0.0.1/*';
  throw new AppError('AI_ENDPOINT');
}

// Call directly in a click handler: request() is invoked before the first await.
export async function enableOllama(endpoint: OllamaConfig['endpoint']): Promise<boolean> {
  const permission = chrome.permissions.request({ origins: [ollamaOrigin(endpoint)] });
  if (!(await permission)) return false;
  const current = await getSettings();
  await updateSettings({
    ollama: {
      enabled: true,
      endpoint,
      model: current.ollama.endpoint === endpoint ? current.ollama.model : '',
    },
  });
  const unusedOrigin = endpoint === 'http://localhost:11434' ? 'http://127.0.0.1/*' : 'http://localhost/*';
  await chrome.permissions.remove({ origins: [unusedOrigin] });
  return true;
}

export async function disableOllama(): Promise<void> {
  const current = await getSettings();
  await updateSettings({ ollama: { ...current.ollama, enabled: false } });
  await chrome.permissions.remove({ origins: ['http://localhost/*', 'http://127.0.0.1/*'] });
}
