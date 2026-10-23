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
export function readState(): State {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === null ? initialState() : parseState(raw);
}
export async function transact(action: Action, now?: number): Promise<State> {
  if (!navigator.locks) throw new Error('LOCK_UNAVAILABLE');
  return navigator.locks.request(LOCK_KEY, async () => {
    const before = readState();
    const next = reduceState(before, action, now ?? Date.now());
    if (next !== before) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  });
}
export function useStore() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<'storage' | 'conflict' | ''>('');
  const [remote, setRemote] = useState(false);
  const alive = useRef(true);
  const refresh = useCallback((external = false) => {
    try {
      setState(reconcileTime(readState(), Date.now()));
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
      if (event.key === STORAGE_KEY || event.key === null) refresh(true);
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
  const reset = useCallback(async () => {
    try {
      if (!navigator.locks) throw new Error('LOCK_UNAVAILABLE');
      await navigator.locks.request(LOCK_KEY, async () => {
        const fresh = initialState('zh-CN', crypto.randomUUID());
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      });
      refresh();
    } catch {
      setError('storage');
    }
  }, [refresh]);
  return { state, error, remote, dispatch, refresh, reset, dismissRemote: () => setRemote(false) };
}
