import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task, TaskFields } from '../domain/types';
import { repo } from '../storage/repository';

export type DraftStatus = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';
const fieldsOf = (task: Task): TaskFields => ({
  progress: task.progress,
  blocker: task.blocker,
  nextStep: task.nextStep,
});
export function useTaskDraft(task: Task) {
  const [fields, setFields] = useState<TaskFields>(() => fieldsOf(task));
  const [status, setStatus] = useState<DraftStatus>('saved');
  const [failure, setFailure] = useState<unknown>(null);
  const draft = useRef(fields);
  const committed = useRef(fieldsOf(task));
  const revision = useRef(task.revision);
  const statusRef = useRef<DraftStatus>('saved');
  const pending = useRef<Promise<Task> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(task);
  if (task.revision >= latest.current.revision) latest.current = task;
  const changeStatus = useCallback((s: DraftStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);
  useEffect(() => {
    if (statusRef.current === 'saved' && !pending.current) {
      revision.current = task.revision;
      committed.current = fieldsOf(task);
      draft.current = fieldsOf(task);
      setFields(fieldsOf(task));
    }
  }, [task.revision, task.progress, task.blocker, task.nextStep]);
  const flush = useCallback(async (): Promise<Task> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current) return pending.current;
    if (statusRef.current === 'conflict') throw Object.assign(new Error('CONFLICT'), { code: 'CONFLICT' });
    const operation = (async () => {
      let saved = latest.current;
      while (JSON.stringify(draft.current) !== JSON.stringify(committed.current)) {
        const writing = { ...draft.current };
        changeStatus('saving');
        try {
          saved = await repo.updateTask(task.id, writing, revision.current);
          revision.current = saved.revision;
          committed.current = writing;
          latest.current = saved;
        } catch (error) {
          setFailure(error);
          changeStatus((error as { code?: string }).code === 'CONFLICT' ? 'conflict' : 'error');
          throw error;
        }
      }
      setFailure(null);
      changeStatus('saved');
      return saved;
    })();
    pending.current = operation;
    try {
      return await operation;
    } finally {
      pending.current = null;
    }
  }, [task.id, changeStatus]);
  const edit = useCallback(
    (key: keyof TaskFields, value: string) => {
      draft.current = { ...draft.current, [key]: value };
      setFields(draft.current);
      if (statusRef.current !== 'conflict') changeStatus('pending');
      if (timer.current) clearTimeout(timer.current);
      if (statusRef.current !== 'conflict')
        timer.current = setTimeout(() => {
          void flush().catch(() => undefined);
        }, 300);
    },
    [flush, changeStatus],
  );
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const resolve = async (keep: boolean) => {
    const snapshot = await repo.getState();
    const fresh = snapshot.tasks.find((t) => t.id === task.id);
    if (!fresh) throw new Error('TASK_NOT_FOUND');
    revision.current = fresh.revision;
    committed.current = fieldsOf(fresh);
    latest.current = fresh;
    if (!keep) {
      draft.current = fieldsOf(fresh);
      setFields(draft.current);
      changeStatus('saved');
      setFailure(null);
      return;
    }
    changeStatus('pending');
    await flush();
  };
  return { fields, status, failure, edit, flush, resolve };
}
