import { useCallback, useEffect, useRef, useState } from 'react';
import {
  initialState,
  LOCK_KEY,
  parseState,
  reconcileTime,
  reduceState,
  STORAGE_KEY,
  type Action,
  type State,
} from './model';

function read(): State {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === null ? initialState() : parseState(raw);
}
export async function transact(action: Action, now = Date.now()): Promise<State> {
  if (!navigator.locks) throw new Error('LOCK_UNAVAILABLE');
  return navigator.locks.request(LOCK_KEY, async () => {
    const before = read();
    const next = reduceState(before, action, now);
    if (next !== before) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  });
}
export function usePrototypeStore() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState('');
  const [remote, setRemote] = useState(false);
  const alive = useRef(true);
  const refresh = useCallback((external = false) => {
    try {
      const saved = read();
      setState(reconcileTime(saved, Date.now()));
      setError('');
      if (external) setRemote(true);
    } catch {
      setError('storage');
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    refresh();
    const changed = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) refresh(true);
    };
    const visible = () => {
      if (!document.hidden) refresh();
    };
    window.addEventListener('storage', changed);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    return () => {
      alive.current = false;
      window.removeEventListener('storage', changed);
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh]);
  const dispatch = useCallback(async (action: Action) => {
    try {
      const updated = await transact(action);
      if (alive.current) {
        setState(updated);
        setError('');
        setRemote(false);
      }
      return true;
    } catch (failure) {
      if (alive.current)
        setError(failure instanceof Error && failure.message === 'TASK_CHANGED' ? 'conflict' : 'storage');
      return false;
    }
  }, []);
  const resetCorrupt = useCallback(async () => {
    try {
      if (!navigator.locks) throw new Error('LOCK_UNAVAILABLE');
      await navigator.locks.request(LOCK_KEY, async () =>
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState())),
      );
      refresh();
      return true;
    } catch {
      setError('storage');
      return false;
    }
  }, [refresh]);
  return { state, error, remote, dispatch, refresh, resetCorrupt, dismissRemote: () => setRemote(false) };
}
