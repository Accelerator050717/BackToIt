import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSnapshot, CaptureDraft, Resource, Task } from '../src/domain/types';
import { App } from '../src/ui/App';
import { ResourceList } from '../src/ui/Resources';
import { LanguageProvider } from '../src/ui/i18n';
import { DATA_CLEAR_GENERATION } from '../src/ui/dataClear';

const mocks = vi.hoisted(() => ({
  state: { tasks: [], resources: [], checkpoints: [], parking: [], currentTaskId: null } as AppSnapshot,
  pending: null as CaptureDraft | null,
  getPending: vi.fn(),
  capturePage: vi.fn(),
}));
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => mocks.state }));
vi.mock('../src/storage/repository', () => ({ repo: { getState: vi.fn(() => mocks.state) } }));
vi.mock('../src/browser/adapter', () => ({
  getPendingCapture: mocks.getPending,
  captureCurrentPage: mocks.capturePage,
  getBrowserFeedback: vi.fn().mockResolvedValue(null),
  clearBrowserFeedback: vi.fn().mockResolvedValue(undefined),
  clearPendingCapture: vi.fn().mockResolvedValue(undefined),
  openResources: vi.fn().mockResolvedValue(undefined),
  openApp: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/browser/settings', () => {
  const defaults = {
    language: 'en',
    appearance: 'light',
    ollama: { enabled: false, endpoint: 'http://127.0.0.1:11434', model: '' },
  };
  return {
    DEFAULT_SETTINGS: defaults,
    getSettings: vi.fn().mockResolvedValue(defaults),
    updateSettings: vi.fn().mockResolvedValue(defaults),
    enableOllama: vi.fn(),
    disableOllama: vi.fn(),
  };
});

const emptyState: AppSnapshot = {
  tasks: [],
  resources: [],
  checkpoints: [],
  parking: [],
  currentTaskId: null,
};
const task: Task = {
  id: 'task-1',
  title: 'Private imported task',
  status: 'paused',
  progress: 'Saved progress',
  blocker: '',
  nextStep: 'Read the next page',
  primaryResourceId: null,
  createdAt: 1,
  updatedAt: 1,
  revision: 1,
  isExample: false,
};
const resource: Resource = {
  id: 'resource-1',
  taskId: task.id,
  title: 'Private resource',
  url: 'https://example.org/notes',
  excerpts: ['Private deleted excerpt'],
  note: 'Private resource note',
  source: 'manual',
  savedAt: 1,
  revision: 1,
};
const firstCapture: CaptureDraft = {
  title: 'First captured page',
  url: 'https://example.org/first',
  excerpt: 'First captured excerpt',
  source: 'selection',
};
const secondCapture: CaptureDraft = {
  title: 'Queued captured page',
  url: 'https://example.org/queued',
  excerpt: 'Queued captured excerpt',
  source: 'selection',
};
const listeners = new Set<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void>();
const emit = (changes: Record<string, chrome.storage.StorageChange>) => {
  for (const listener of listeners) listener(changes, 'session');
};
const clearEvent = (generation: string) => {
  mocks.pending = null;
  emit({ [DATA_CLEAR_GENERATION]: { newValue: generation } });
};

beforeEach(() => {
  vi.clearAllMocks();
  listeners.clear();
  mocks.state = emptyState;
  mocks.pending = null;
  mocks.getPending.mockImplementation(async () => mocks.pending);
  window.history.replaceState(null, '', '/');
  vi.stubGlobal('chrome', {
    runtime: { id: 'test-extension' },
    storage: {
      onChanged: {
        addListener: (
          listener: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void,
        ) => listeners.add(listener),
        removeListener: (
          listener: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void,
        ) => listeners.delete(listener),
      },
    },
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('cross-window deletion clears UI-held content', () => {
  it('preserves a capture on normal consumption, but clears captures and queued drafts in all open views on explicit deletion', async () => {
    mocks.pending = firstCapture;
    const { container } = render(
      <>
        <div data-testid="first-view">
          <App />
        </div>
        <div data-testid="second-view">
          <App />
        </div>
      </>,
    );
    await waitFor(() =>
      expect(screen.getAllByRole('dialog', { name: 'Keep this resource' })).toHaveLength(2),
    );
    await act(async () => {
      mocks.pending = null;
      emit({ pendingCapture: { oldValue: firstCapture } });
    });
    expect(screen.getAllByRole('dialog', { name: 'Keep this resource' })).toHaveLength(2);
    await act(async () => {
      mocks.pending = secondCapture;
      emit({ pendingCapture: { newValue: secondCapture } });
    });
    await act(async () => clearEvent('deleted-in-another-window'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Finish saving your captured resource' }),
    ).not.toBeInTheDocument();
    const freshCapture = { ...firstCapture, title: 'Fresh capture after deletion', excerpt: 'Fresh excerpt' };
    await act(async () => {
      mocks.pending = freshCapture;
      emit({ pendingCapture: { newValue: freshCapture } });
    });
    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(2));
    const firstView = within(container.querySelector('[data-testid="first-view"]') as HTMLElement);
    fireEvent.click(firstView.getByRole('button', { name: 'Close' }));
    expect(firstView.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('First captured excerpt')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Queued captured excerpt')).not.toBeInTheDocument();
  });

  it('drops an open import preview and ignores a late file read after another window clears data', async () => {
    window.history.replaceState(null, '', '/?section=settings');
    render(<App />);
    const backup = JSON.stringify({
      schemaVersion: 1,
      exportedAt: 1,
      tasks: [task],
      resources: [],
      checkpoints: [],
      parking: [],
    });
    const file = new File([backup], 'backup.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => backup });
    fireEvent.change(await screen.findByLabelText('Choose backup file'), { target: { files: [file] } });
    await screen.findByRole('dialog', { name: 'Import preview' });
    expect(screen.getByText(task.title)).toBeInTheDocument();
    await act(async () => clearEvent('clear-import-preview'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(task.title)).not.toBeInTheDocument();
    let finish!: (text: string) => void;
    const lateFile = new File([backup], 'late-backup.json', { type: 'application/json' });
    Object.defineProperty(lateFile, 'text', {
      value: () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    });
    fireEvent.change(screen.getByLabelText('Choose backup file'), { target: { files: [lateFile] } });
    await act(async () => clearEvent('clear-during-file-read'));
    await act(async () => finish(backup));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(task.title)).not.toBeInTheDocument();
  });

  it('ignores a pending-capture read and a capture request that finish after deletion', async () => {
    let finishRead!: (draft: CaptureDraft | null) => void;
    mocks.getPending.mockImplementationOnce(
      () =>
        new Promise<CaptureDraft | null>((resolve) => {
          finishRead = resolve;
        }),
    );
    mocks.state = { ...emptyState, tasks: [task] };
    let finishCapture!: (draft: CaptureDraft) => void;
    mocks.capturePage.mockImplementationOnce(
      () =>
        new Promise<CaptureDraft>((resolve) => {
          finishCapture = resolve;
        }),
    );
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Save current page' }));
    await waitFor(() => expect(mocks.capturePage).toHaveBeenCalledOnce());
    await act(async () => {
      mocks.state = emptyState;
      clearEvent('clear-pending-work');
    });
    await act(async () => {
      finishRead(firstCapture);
      finishCapture(secondCapture);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Finish saving your captured resource' }),
    ).not.toBeInTheDocument();
  });
});

describe('externally deleted resources leave no open editor snapshot', () => {
  for (const stage of ['editing', 'confirming removal'] as const) {
    it(`closes and releases the ${stage} dialog when the resource disappears`, () => {
      const component = (resources: Resource[]) => (
        <LanguageProvider language="en">
          <ResourceList
            resources={resources}
            primaryId={null}
            taskId={task.id}
            onAdd={() => undefined}
            onCapture={() => undefined}
            run={async (action) => {
              await action();
              return true;
            }}
          />
        </LanguageProvider>
      );
      const { rerender } = render(component([resource]));
      fireEvent.click(screen.getByRole('button', { name: 'Edit resource: Private resource' }));
      if (stage === 'confirming removal')
        fireEvent.click(screen.getByRole('button', { name: 'Remove resource' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      rerender(component([]));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText('Private deleted excerpt')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('Private resource note')).not.toBeInTheDocument();
      rerender(component([resource]));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  }
});
