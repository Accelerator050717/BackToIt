import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SettingsView } from '../src/ui/SettingsView';
import { LanguageProvider } from '../src/ui/i18n';
import { OllamaProvider } from '../src/ai/providers';
import { disableOllama, updateSettings } from '../src/browser/settings';
import type { Settings } from '../src/domain/types';
import { repo } from '../src/storage/repository';
import { DATA_CLEAR_GENERATION } from '../src/ui/dataClear';

vi.mock('../src/storage/repository', () => ({ repo: { clearAll: vi.fn() } }));
vi.mock('../src/browser/adapter', () => ({ clearPendingCapture: vi.fn(), clearBrowserFeedback: vi.fn() }));
vi.mock('../src/browser/settings', () => ({
  DEFAULT_SETTINGS: {
    language: 'en',
    appearance: 'light',
    ollama: { enabled: false, endpoint: 'http://127.0.0.1:11434', model: '' },
  },
  updateSettings: vi.fn(),
  disableOllama: vi.fn(),
  enableOllama: vi.fn(),
}));
const settings: Settings = {
  language: 'en',
  appearance: 'light',
  ollama: { enabled: true, endpoint: 'http://127.0.0.1:11434', model: '' },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('chrome', {
    runtime: { id: 'test-extension' },
    storage: { session: { set: vi.fn().mockResolvedValue(undefined) } },
  });
  vi.stubGlobal('navigator', {
    locks: { request: vi.fn(async (_name: string, action: () => Promise<unknown>) => action()) },
  });
  vi.mocked(disableOllama).mockResolvedValue();
  vi.mocked(updateSettings).mockImplementation(async (patch) => ({ ...settings, ...patch }));
  vi.mocked(repo.clearAll).mockResolvedValue(undefined);
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});

it('broadcasts content-free deletion after the database succeeds, before optional settings cleanup can fail', async () => {
  const cleared = vi.fn();
  vi.mocked(disableOllama).mockRejectedValueOnce(new Error('Permission cleanup failed'));
  vi.mocked(repo.clearAll).mockImplementationOnce(async () => {
    expect(chrome.storage.session.set).not.toHaveBeenCalled();
  });
  render(
    <LanguageProvider language="en">
      <SettingsView
        settings={settings}
        state={{ tasks: [], resources: [], checkpoints: [], parking: [], currentTaskId: null }}
        run={async (action) => {
          try {
            await action();
            return true;
          } catch {
            return false;
          }
        }}
        onSettings={vi.fn()}
        onCleared={cleared}
      />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Delete all local data' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete all data' }));
  await waitFor(() => expect(cleared).toHaveBeenCalledOnce());
  expect(navigator.locks.request).toHaveBeenCalledWith('backtoit-data-clear', expect.any(Function));
  expect(chrome.storage.session.set).toHaveBeenCalledOnce();
  const generation = cleared.mock.calls[0]?.[0];
  expect(generation).toEqual(expect.any(String));
  expect(chrome.storage.session.set).toHaveBeenCalledWith({ [DATA_CLEAR_GENERATION]: generation });
  await waitFor(() => expect(disableOllama).toHaveBeenCalledOnce());
  expect(vi.mocked(disableOllama).mock.invocationCallOrder[0]!).toBeGreaterThan(
    vi.mocked(chrome.storage.session.set).mock.invocationCallOrder[0]!,
  );
});

it('does not broadcast deletion when the database transaction fails', async () => {
  const reportError = vi.fn();
  const cleared = vi.fn();
  vi.mocked(repo.clearAll).mockRejectedValueOnce(new Error('Storage unavailable'));
  render(
    <LanguageProvider language="en">
      <SettingsView
        settings={settings}
        state={{ tasks: [], resources: [], checkpoints: [], parking: [], currentTaskId: null }}
        run={async (action) => {
          try {
            await action();
            return true;
          } catch (error) {
            reportError(error);
            return false;
          }
        }}
        onSettings={vi.fn()}
        onCleared={cleared}
      />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Delete all local data' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete all data' }));
  await waitFor(() => expect(reportError).toHaveBeenCalledOnce());
  expect(chrome.storage.session.set).not.toHaveBeenCalled();
  expect(cleared).not.toHaveBeenCalled();
  expect(disableOllama).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: 'Delete all local data?' })).toBeInTheDocument();
});
afterEach(() => vi.unstubAllGlobals());

it('disabling Ollama cancels an in-flight connection test and a late model list cannot turn it back on', async () => {
  let finish!: (models: string[]) => void;
  let signal: AbortSignal | undefined;
  vi.spyOn(OllamaProvider.prototype, 'testConnection').mockImplementation((_config, requestSignal) => {
    signal = requestSignal;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const onSettings = vi.fn();
  render(
    <LanguageProvider language="en">
      <SettingsView
        settings={settings}
        state={{ tasks: [], resources: [], checkpoints: [], parking: [], currentTaskId: null }}
        run={async (action) => {
          await action();
          return true;
        }}
        onSettings={onSettings}
      />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Test / refresh models' }));
  await waitFor(() => expect(OllamaProvider.prototype.testConnection).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button', { name: 'Disable and remove permission' }));
  await waitFor(() => expect(disableOllama).toHaveBeenCalledOnce());
  expect(signal?.aborted).toBe(true);
  await act(async () => finish(['late-local-model']));
  expect(updateSettings).toHaveBeenCalledTimes(1);
  expect(updateSettings).toHaveBeenCalledWith({ ollama: { ...settings.ollama, enabled: false } });
  expect(screen.queryByText('late-local-model')).not.toBeInTheDocument();
});
