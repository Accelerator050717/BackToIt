import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskView } from '../src/ui/TaskView';
import { AIAssistant } from '../src/ui/AIAssistant';
import { LanguageProvider } from '../src/ui/i18n';
import { repo } from '../src/storage/repository';
import { openResources } from '../src/browser/adapter';
import { OllamaProvider, type Suggestion } from '../src/ai/providers';
import type { Resource, Settings, Task } from '../src/domain/types';
import { Modal } from '../src/ui/primitives';

vi.mock('../src/storage/repository', () => ({
  repo: { updateTask: vi.fn(), getState: vi.fn(), activateTask: vi.fn(), checkpointTask: vi.fn() },
}));
vi.mock('../src/browser/adapter', () => ({ openResources: vi.fn() }));
const task: Task = {
  id: 'task-1',
  title: 'Finish the report',
  status: 'paused',
  progress: 'Section one is done',
  blocker: '',
  nextStep: 'Read section two',
  primaryResourceId: null,
  createdAt: 1,
  updatedAt: 1,
  revision: 1,
  isExample: false,
};
const resource: Resource = {
  id: 'resource-1',
  taskId: 'task-1',
  title: 'Course notes',
  url: 'https://example.org/notes',
  excerpts: ['Private saved excerpt'],
  note: 'Read section two',
  source: 'manual',
  savedAt: 1,
  revision: 1,
};
const settings: Settings = {
  language: 'en',
  appearance: 'light',
  ollama: { enabled: false, endpoint: 'http://127.0.0.1:11434', model: '' },
};
const run = async (action: () => Promise<unknown>) => {
  await action();
  return true;
};
const noop = () => undefined;
const view = (current: Task, resources: Resource[]) => (
  <LanguageProvider language="en">
    <TaskView
      task={current}
      resources={resources}
      checkpoints={[]}
      settings={settings}
      run={run}
      onSwitch={noop}
      onAdd={noop}
      onCapture={noop}
    />
  </LanguageProvider>
);

describe('recovery controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repo.activateTask).mockResolvedValue({ ...task, status: 'active' });
    vi.mocked(openResources).mockResolvedValue();
  });
  it('selects the first saved link and follows primary changes until the user chooses explicitly', async () => {
    const { rerender } = render(view(task, []));
    expect(screen.getByRole('button', { name: 'Continue without opening pages' })).toBeInTheDocument();
    rerender(view({ ...task, revision: 2, primaryResourceId: resource.id }, [resource]));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open 1 resource' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(openResources).toHaveBeenCalledWith([resource]));
    const second = {
      ...resource,
      id: 'resource-2',
      title: 'Second page',
      url: 'https://example.org/second',
      savedAt: 2,
    };
    rerender(view({ ...task, revision: 3, primaryResourceId: second.id }, [resource, second]));
    fireEvent.click(screen.getByRole('button', { name: 'Open 1 resource' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Second page' })).toBeChecked());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Second page' }));
    expect(screen.getByRole('button', { name: 'Continue without opening pages' })).toBeInTheDocument();
    rerender(view({ ...task, revision: 4, primaryResourceId: resource.id }, [resource, second]));
    expect(screen.getByRole('checkbox', { name: 'Course notes' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Second page' })).not.toBeChecked();
  });
  it('deduplicates rapid synchronous Continue events before React can disable the button', async () => {
    let finish!: () => void;
    vi.mocked(openResources).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(view({ ...task, primaryResourceId: resource.id }, [resource]));
    const button = screen.getByRole('button', { name: 'Continue' });
    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitFor(() => expect(openResources).toHaveBeenCalledOnce());
    expect(repo.activateTask).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
    await act(async () => finish());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled());
  });
  it('deduplicates rapid pause events so one checkpoint is created', async () => {
    let finish!: (value: Awaited<ReturnType<typeof repo.checkpointTask>>) => void;
    vi.mocked(repo.checkpointTask).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(view(task, []));
    const button = screen.getByRole('button', { name: 'Leave for now' });
    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitFor(() => expect(repo.checkpointTask).toHaveBeenCalledOnce());
    await act(async () =>
      finish({
        id: 'point-1',
        taskId: task.id,
        progress: task.progress,
        blocker: task.blocker,
        nextStep: task.nextStep,
        resourceIds: [],
        createdAt: 1,
      }),
    );
  });
});

describe('model deletion privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
  });
  it('aborts a request and discards a late suggestion when an included resource is deleted', async () => {
    let finish!: (value: Suggestion) => void;
    let requestSignal: AbortSignal | undefined;
    vi.spyOn(OllamaProvider.prototype, 'generate').mockImplementation((_input, _config, signal) => {
      requestSignal = signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const activeSettings = {
      ...settings,
      ollama: { ...settings.ollama, enabled: true, model: 'installed-model' },
    };
    const flush = vi.fn().mockResolvedValue(task);
    const adopt = vi.fn().mockResolvedValue(undefined);
    const component = (resources: Resource[]) => (
      <LanguageProvider language="en">
        <AIAssistant
          task={task}
          resources={resources}
          settings={activeSettings}
          flush={flush}
          onAdopt={adopt}
          run={run}
        />
      </LanguageProvider>
    );
    const { rerender } = render(component([resource]));
    fireEvent.click(screen.getByRole('button', { name: 'Help me reconnect' }));
    await screen.findByRole('dialog');
    expect(screen.getByText('Private saved excerpt')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send and organize' }));
    await waitFor(() => expect(OllamaProvider.prototype.generate).toHaveBeenCalledOnce());
    rerender(component([]));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(requestSignal?.aborted).toBe(true);
    await act(async () =>
      finish({
        taskId: task.id,
        revision: task.revision,
        recap: 'Private saved excerpt',
        suggestedNextStep: 'Use deleted notes',
        resourceIds: [resource.id],
        sourceIds: [task.id, resource.id],
      }),
    );
    expect(screen.queryByText('Private saved excerpt')).not.toBeInTheDocument();
    expect(screen.queryByText('Use deleted notes')).not.toBeInTheDocument();
    expect(adopt).not.toHaveBeenCalled();
  });
  it('restores focus to the opener even when a modal field uses autofocus', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <LanguageProvider language="en">
          <button onClick={() => setOpen(true)}>Open editor</button>
          {open && (
            <Modal title="Edit note" onClose={() => setOpen(false)}>
              <input aria-label="Note" autoFocus />
            </Modal>
          )}
        </LanguageProvider>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open editor' });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(opener).toHaveFocus();
  });
});
