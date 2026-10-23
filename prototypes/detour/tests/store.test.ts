import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initialState, STORAGE_KEY, LOCK_KEY } from '../src/model';
import { transact } from '../src/store';

beforeEach(() => {
  localStorage.clear();
  let tail = Promise.resolve();
  vi.stubGlobal('navigator', {
    locks: {
      request: vi.fn((_name: string, operation: () => Promise<unknown>) => {
        const result = tail.then(operation);
        tail = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      }),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());
it('serializes two window commands against the latest saved version', async () => {
  await Promise.all([
    transact({ type: 'language', language: 'en' }, 10),
    transact({ type: 'motion', reduced: true }, 11),
  ]);
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
  expect(stored.language).toBe('en');
  expect(stored.reducedMotion).toBe(true);
  expect(stored.revision).toBe(2);
  expect(navigator.locks.request).toHaveBeenCalledWith(LOCK_KEY, expect.any(Function));
  expect(localStorage.length).toBe(1);
});
it('keeps corrupted content intact until an explicit reset is chosen', async () => {
  localStorage.setItem(STORAGE_KEY, '{ damaged');
  await expect(transact({ type: 'language', language: 'en' })).rejects.toThrow();
  expect(localStorage.getItem(STORAGE_KEY)).toBe('{ damaged');
});
it('rejects a stale form revision and retains the other window’s saved text', async () => {
  await transact(
    { type: 'edit-task', title: 'First window', nextStep: 'Newly saved step', expectedRevision: 1 },
    10,
  );
  const committed = localStorage.getItem(STORAGE_KEY);
  await expect(
    transact(
      { type: 'edit-task', title: 'Old form title', nextStep: 'Unsaved local draft', expectedRevision: 1 },
      11,
    ),
  ).rejects.toThrow('TASK_CHANGED');
  expect(localStorage.getItem(STORAGE_KEY)).toBe(committed);
});
it('does not report persistence success or mutate the prior state on quota failure', async () => {
  const original = JSON.stringify(initialState());
  localStorage.setItem(STORAGE_KEY, original);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('quota', 'QuotaExceededError');
  });
  await expect(transact({ type: 'language', language: 'en' })).rejects.toThrow();
  expect(localStorage.getItem(STORAGE_KEY)).toBe(original);
});
