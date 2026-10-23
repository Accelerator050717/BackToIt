import { vi } from 'vitest';

export function stubDataClearLock(): void {
  let tail: Promise<unknown> = Promise.resolve();
  const request = <T>(_name: string, operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  vi.stubGlobal('navigator', { locks: { request } });
}
