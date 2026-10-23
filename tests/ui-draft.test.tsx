import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaskDraft } from '../src/ui/useTaskDraft';
import { LanguageProvider } from '../src/ui/i18n';
import { Parking } from '../src/ui/Parking';
import type { Task } from '../src/domain/types';
import { repo } from '../src/storage/repository';

vi.mock('../src/storage/repository', () => ({
  repo: {
    updateTask: vi.fn(),
    getState: vi.fn(),
    addParking: vi.fn(),
    updateParking: vi.fn(),
    deleteParking: vi.fn(),
  },
}));
const task: Task = {
  id: 'task-1',
  title: 'Finish the report',
  status: 'active',
  progress: '',
  blocker: '',
  nextStep: 'Read section two',
  primaryResourceId: null,
  createdAt: 1,
  updatedAt: 1,
  revision: 1,
  isExample: false,
};
const run = async (action: () => Promise<unknown>) => {
  try {
    await action();
    return true;
  } catch {
    return false;
  }
};

describe('reliable local draft UI', () => {
  beforeEach(() => vi.clearAllMocks());
  it('never reports saved when persistence fails, and retains the typed text for retry', async () => {
    vi.mocked(repo.updateTask)
      .mockRejectedValueOnce(new Error('Disk write failed'))
      .mockImplementationOnce(async (_id, patch) => ({ ...task, ...patch, revision: 2 }));
    const { result } = renderHook(() => useTaskDraft(task));
    act(() => result.current.edit('progress', 'This must not be lost'));
    await act(async () => {
      await expect(result.current.flush()).rejects.toThrow('Disk write failed');
    });
    expect(result.current.status).toBe('error');
    expect(result.current.fields.progress).toBe('This must not be lost');
    await act(async () => {
      await result.current.flush();
    });
    expect(result.current.status).toBe('saved');
    expect(repo.updateTask).toHaveBeenLastCalledWith(
      'task-1',
      expect.objectContaining({ progress: 'This must not be lost' }),
      1,
    );
    await act(async () => {
      const current = await result.current.flush();
      expect(current.revision).toBe(2);
      expect(current.progress).toBe('This must not be lost');
    });
  });
  it('serializes edits made during a save and flushes the most recent draft before continuing', async () => {
    let finish!: (task: Task) => void;
    vi.mocked(repo.updateTask)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockImplementationOnce(async (_id, patch) => ({ ...task, ...patch, revision: 3 }));
    const { result } = renderHook(() => useTaskDraft(task));
    act(() => result.current.edit('progress', 'First note'));
    let flushing!: Promise<Task>;
    act(() => {
      flushing = result.current.flush();
    });
    act(() => result.current.edit('progress', 'Latest note'));
    await act(async () => {
      finish({ ...task, progress: 'First note', revision: 2 });
      await flushing;
    });
    expect(repo.updateTask).toHaveBeenCalledTimes(2);
    expect(repo.updateTask).toHaveBeenLastCalledWith(
      'task-1',
      expect.objectContaining({ progress: 'Latest note' }),
      2,
    );
    expect(result.current.status).toBe('saved');
  });
  it('keeps conflicting edits and requires an explicit resolution against the newest revision', async () => {
    vi.mocked(repo.updateTask)
      .mockRejectedValueOnce(Object.assign(new Error('CONFLICT'), { code: 'CONFLICT' }))
      .mockImplementationOnce(async (_id, patch) => ({ ...task, ...patch, revision: 5 }));
    vi.mocked(repo.getState).mockResolvedValue({
      tasks: [{ ...task, progress: 'Other window', revision: 4 }],
      resources: [],
      checkpoints: [],
      parking: [],
      currentTaskId: task.id,
    });
    const { result } = renderHook(() => useTaskDraft(task));
    act(() => result.current.edit('progress', 'My edit'));
    await act(async () => {
      await expect(result.current.flush()).rejects.toThrow('CONFLICT');
    });
    expect(result.current.status).toBe('conflict');
    expect(result.current.fields.progress).toBe('My edit');
    await act(async () => {
      await result.current.resolve(true);
    });
    expect(repo.updateTask).toHaveBeenLastCalledWith(
      'task-1',
      expect.objectContaining({ progress: 'My edit' }),
      4,
    );
    expect(result.current.status).toBe('saved');
  });
});

describe('quiet parking flow and language', () => {
  beforeEach(() => vi.clearAllMocks());
  it('starts collapsed, saves a thought without changing task, and clears only after success', async () => {
    vi.mocked(repo.addParking)
      .mockRejectedValueOnce(new Error('Storage failed'))
      .mockResolvedValueOnce({
        id: 'idea-1',
        text: 'Check camera prices',
        done: false,
        createdAt: 1,
        updatedAt: 1,
      });
    const convert = vi.fn();
    render(
      <LanguageProvider language="en">
        <Parking items={[]} run={run} onConvert={convert} />
      </LanguageProvider>,
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Set it aside/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Thought to set aside' }), {
      target: { value: 'Check camera prices' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(repo.addParking).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
    expect(screen.getByRole('textbox')).toHaveValue('Check camera prices');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));
    expect(convert).not.toHaveBeenCalled();
  });
  it('uses Chinese labels and converts a thought only after the explicit action', async () => {
    const convert = vi.fn().mockResolvedValue(undefined);
    render(
      <LanguageProvider language="zh-CN">
        <Parking
          items={[{ id: 'p1', text: '查相机价格', done: false, createdAt: 1, updatedAt: 1 }]}
          run={run}
          onConvert={convert}
        />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /先放这里/ }));
    expect(screen.getByRole('textbox', { name: '暂存想法' })).toBeInTheDocument();
    expect(convert).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '转成新任务：查相机价格' }));
    await waitFor(() => expect(convert).toHaveBeenCalledWith('p1'));
  });
});
