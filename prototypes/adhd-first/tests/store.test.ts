import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initialState, LOCK_KEY, returnKind, STORAGE_KEY, type Action, type State } from '../src/model';
import { readState, transact } from '../src/store';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function installLocks() {
  const tails = new Map<string, Promise<unknown>>();
  const active = new Map<string, number>();
  let peak = 0;
  const request = vi.fn(<T>(name: string, operation: () => Promise<T> | T): Promise<T> => {
    const predecessor = tails.get(name) ?? Promise.resolve();
    const result = predecessor.then(async () => {
      const count = (active.get(name) ?? 0) + 1;
      active.set(name, count);
      peak = Math.max(peak, count);
      try {
        return await operation();
      } finally {
        active.set(name, count - 1);
      }
    });
    tails.set(
      name,
      result.then(
        () => undefined,
        () => undefined,
      ),
    );
    return result;
  });
  vi.stubGlobal('navigator', { locks: { request } });
  return { request, peak: () => peak };
}

let locks: ReturnType<typeof installLocks>;
beforeEach(() => {
  localStorage.clear();
  locks = installLocks();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const saved = () => localStorage.getItem(STORAGE_KEY);
function binding(state = initialState()) {
  return { taskId: state.task!.id, revision: state.task!.revision };
}
async function begin(path: 'spark' | 'quiet' | 'start' = 'spark', id = 'session-one', now = 1000) {
  return transact({ type: 'begin', path, id, ...binding() }, now);
}

it('queues both windows behind the held lock and preserves each committed preference', async () => {
  const gate = deferred();
  const held = navigator.locks.request(LOCK_KEY, async () => gate.promise);
  const language = transact({ type: 'language', language: 'en' }, 10);
  const motion = transact({ type: 'motion', reduced: true }, 11);
  await Promise.resolve();
  expect(saved()).toBeNull();
  gate.resolve();
  await Promise.all([held, language, motion]);
  expect(readState()).toMatchObject({ language: 'en', reducedMotion: true, revision: 2 });
  expect(locks.peak()).toBe(1);
  expect(locks.request.mock.calls.every(([name]) => name === LOCK_KEY)).toBe(true);
});

it('starts a timed interaction when its queued lock is granted rather than when it was clicked', async () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
  const gate = deferred();
  const held = navigator.locks.request(LOCK_KEY, async () => gate.promise);
  const queued = transact({ type: 'begin', path: 'quiet', id: 'queued-pause', ...binding() });
  await Promise.resolve();
  clock.mockReturnValue(61_000);
  gate.resolve();
  await Promise.all([held, queued]);
  expect(readState().session).toMatchObject({ startedAt: 61_000, deadline: 151_000, duration: 90 });
});

it('accepts one of two concurrently submitted forms and retains its exact saved text', async () => {
  const task = initialState().task!;
  const first: Action = {
    type: 'edit',
    taskId: task.id,
    expectedRevision: task.revision,
    title: 'Synthetic title A',
    nextStep: 'Open the synthetic draft.',
  };
  const stale: Action = { ...first, title: 'Stale title B', nextStep: 'Discarded stale form text.' };
  const outcomes = await Promise.allSettled([transact(first, 10), transact(stale, 11)]);
  expect(outcomes[0]?.status).toBe('fulfilled');
  expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: new Error('TASK_CHANGED') });
  expect(readState().task).toMatchObject({
    title: 'Synthetic title A',
    nextStep: 'Open the synthetic draft.',
    revision: 2,
  });
  const committed = saved();
  await expect(transact(stale, 12)).rejects.toThrow('TASK_CHANGED');
  expect(saved()).toBe(committed);
});

it('grants only one piece to simultaneous clicks carrying the same displayed step', async () => {
  await begin();
  await Promise.all(
    [1011, 1012, 1013].map((now) => transact({ type: 'place', id: 'session-one', expectedStep: 0 }, now)),
  );
  expect(readState()).toMatchObject({ phase: 'spark', revision: 2, session: { step: 1, endedBy: 'none' } });
  expect(locks.peak()).toBe(1);
});

it('keeps the prior serialized value when the storage write runs out of quota', async () => {
  const original = JSON.stringify(initialState());
  localStorage.setItem(STORAGE_KEY, original);
  localStorage.setItem('unrelated:synthetic', 'leave this alone');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
  });
  await expect(transact({ type: 'language', language: 'en' }, 10)).rejects.toThrow();
  expect(saved()).toBe(original);
  expect(localStorage.getItem('unrelated:synthetic')).toBe('leave this alone');
});

it('does not replace data or silently initialize over an unavailable storage read', async () => {
  const write = vi.spyOn(Storage.prototype, 'setItem');
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('Synthetic denied access', 'SecurityError');
  });
  await expect(transact({ type: 'language', language: 'en' }, 10)).rejects.toThrow();
  expect(write).not.toHaveBeenCalled();
});

it.each(['{ damaged JSON', 'x'.repeat(48_001)])(
  'retains unreadable stored content rather than resetting it',
  async (raw) => {
    localStorage.setItem(STORAGE_KEY, raw);
    await expect(transact({ type: 'language', language: 'en' }, 10)).rejects.toThrow();
    expect(saved()).toBe(raw);
  },
);

it('rejects an impossible persisted phase/path pair before attempting a write', async () => {
  const quiet = await begin('quiet');
  const impossible: State = { ...quiet, phase: 'start' };
  const raw = JSON.stringify(impossible);
  localStorage.setItem(STORAGE_KEY, raw);
  await expect(transact({ type: 'language', language: 'en' }, 2000)).rejects.toThrow();
  expect(saved()).toBe(raw);
});

it('requires Web Locks and leaves the saved state intact when locking is unavailable', async () => {
  const original = JSON.stringify(initialState());
  localStorage.setItem(STORAGE_KEY, original);
  vi.stubGlobal('navigator', {});
  await expect(transact({ type: 'language', language: 'en' }, 10)).rejects.toThrow('LOCK_UNAVAILABLE');
  expect(saved()).toBe(original);
});

it('keeps foreign keys and the older Detour prototype through all own-state reset writes', async () => {
  const foreign = {
    'unrelated:synthetic': 'preserved',
    'backtoit:detour-research:v1': '{"syntheticSentinel":true}',
  };
  for (const [key, value] of Object.entries(foreign)) localStorage.setItem(key, value);
  await transact({ type: 'language', language: 'en' }, 10);
  await transact({ type: 'reset' }, 11);
  expect(localStorage.length).toBe(3);
  for (const [key, value] of Object.entries(foreign)) expect(localStorage.getItem(key)).toBe(value);
});

it('uses the saved deadline after a long absence and does not grant an expired extra piece', async () => {
  const state = await begin('spark', 'expired-session');
  const deadline = state.session!.deadline!;
  await transact({ type: 'place', id: 'expired-session', expectedStep: 0 }, deadline + 120_000);
  expect(readState()).toMatchObject({ phase: 'return', session: { step: 0, endedBy: 'elapsed', deadline } });
  const committed = saved();
  await transact({ type: 'tick' }, deadline + 240_000);
  expect(saved()).toBe(committed);
});

it('ignores an earlier session command after a new bounded interaction begins', async () => {
  await begin('spark', 'old-session');
  await transact({ type: 'home' }, 1100);
  const current = await begin('quiet', 'new-session', 1200);
  const committed = saved();
  await transact({ type: 'direct', id: 'unused', sessionId: 'old-session', ...binding(current) }, 1300);
  expect(saved()).toBe(committed);
  expect(readState()).toMatchObject({ phase: 'quiet', session: { id: 'new-session' } });
});

it.each(['archived', 'none', 'writing'] as const)(
  'blocks a stale-window resume after the target becomes %s',
  async (scenario) => {
    const old = await begin();
    await transact({ type: 'scenario', scenario }, 2000);
    const committed = saved();
    await expect(
      transact({ type: 'direct', id: 'unused', sessionId: old.session!.id, ...binding(old) }, 3000),
    ).rejects.toThrow('TASK_CHANGED');
    expect(saved()).toBe(committed);
  },
);

it.each([
  ['archived', 'archived'],
  ['none', 'unavailable'],
  ['writing', 'unavailable'],
] as const)(
  'retracts an already displayed ready state when its saved target becomes %s',
  async (scenario, expectedKind) => {
    await transact({ type: 'direct', id: 'ready-session', sessionId: null, ...binding() }, 1000);
    expect(readState().phase).toBe('ready');
    await transact({ type: 'scenario', scenario }, 2000);
    expect(readState().phase).toBe('return');
    expect(returnKind(readState())).toBe(expectedKind);
  },
);

it('rejects the deleted task version even after selecting the same demo task again', async () => {
  const old = initialState();
  await transact({ type: 'scenario', scenario: 'none' }, 1000);
  await transact({ type: 'scenario', scenario: 'math' }, 2000);
  const committed = saved();
  await expect(
    transact({ type: 'direct', id: 'stale-direct', sessionId: null, ...binding(old) }, 3000),
  ).rejects.toThrow('TASK_CHANGED');
  expect(saved()).toBe(committed);
});

it('rejects a pre-reset window command instead of reusing the original task version', async () => {
  const old = initialState();
  await transact({ type: 'reset' }, 1000);
  const committed = saved();
  await expect(
    transact({ type: 'direct', id: 'pre-reset-direct', sessionId: null, ...binding(old) }, 2000),
  ).rejects.toThrow('TASK_CHANGED');
  expect(saved()).toBe(committed);
});
