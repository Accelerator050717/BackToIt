import { AppError } from './errors';

// Shared by extension pages and the worker; this value contains no user content.
export const DATA_CLEAR_GENERATION = 'uiDataClearGeneration';
const DATA_CLEAR_LOCK = 'backtoit-data-clear';

export async function withDataClearLock<T>(operation: () => Promise<T>): Promise<T> {
  return await navigator.locks.request(DATA_CLEAR_LOCK, operation);
}

export async function readDataClearGeneration(): Promise<string | null> {
  const stored = await chrome.storage.session.get(DATA_CLEAR_GENERATION);
  const generation: unknown = stored[DATA_CLEAR_GENERATION];
  return typeof generation === 'string' ? generation : null;
}

export async function assertDataClearGeneration(expected: string | null): Promise<void> {
  if ((await readDataClearGeneration()) !== expected) throw new AppError('DATA_CLEARED');
}
