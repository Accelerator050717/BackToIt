import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ExternalLink, Plus, X, List, Settings as SettingsIcon } from 'lucide-react';
import { repo } from '../storage/repository';
import type { CaptureDraft, ResourceInput, Settings } from '../domain/types';
import {
  captureCurrentPage,
  clearBrowserFeedback,
  clearPendingCapture,
  getBrowserFeedback,
  getPendingCapture,
  openApp,
} from '../browser/adapter';
import { DEFAULT_SETTINGS, getSettings } from '../browser/settings';
import { messageForError } from '../browser/errors';
import { LanguageProvider, useText } from './i18n';
import { Mark, Modal } from './primitives';
import { TaskView, type TaskHandle } from './TaskView';
import { TaskManager } from './TaskManager';
import { SettingsView } from './SettingsView';
import { Parking } from './Parking';
import { AddResourceModal, type Run } from './Resources';
import { DATA_CLEAR_GENERATION } from './dataClear';
import './styles.css';

type View = 'recovery' | 'tasks' | 'settings';
export function App({ fullPage = false }: { fullPage?: boolean }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsError, setSettingsError] = useState(false);
  useEffect(() => {
    let alive = true;
    const read = async () => {
      try {
        const saved = await getSettings();
        if (alive) {
          setSettings(saved);
          setSettingsError(false);
        }
      } catch {
        if (alive) setSettingsError(true);
      }
    };
    void read();
    const listener = (_changes: unknown, area: string) => {
      if (area === 'local') void read();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => {
      alive = false;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = settings.language;
    document.documentElement.dataset.appearance = settings.appearance;
    document.title = settings.language === 'zh-CN' ? '接着来 · BackToIt' : 'BackToIt';
  }, [settings.language, settings.appearance]);
  return (
    <LanguageProvider language={settings.language}>
      <AppErrorBoundary>
        {settingsError && (
          <div className="settings-load-error" role="alert">
            {settings.language === 'zh-CN'
              ? '暂时无法读取设置，已使用默认界面。原设置未删除，请重新打开扩展后重试。'
              : 'Settings could not be read. The default interface is shown; saved settings have not been deleted. Reopen the extension to retry.'}
          </div>
        )}
        <Workspace fullPage={fullPage} settings={settings} setSettings={setSettings} />
      </AppErrorBoundary>
    </LanguageProvider>
  );
}

function Workspace({
  fullPage,
  settings,
  setSettings,
}: {
  fullPage: boolean;
  settings: Settings;
  setSettings: (settings: Settings) => void;
}) {
  const state = useLiveQuery(() => repo.getState(), []);
  const { t, language } = useText();
  const [view, setView] = useState<View>(() => {
    const section = new URLSearchParams(location.search).get('section') || location.hash.slice(1);
    return section === 'settings' || section === 'tasks' ? section : 'recovery';
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [capture, setCapture] = useState<CaptureDraft | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean; undoId?: string } | null>(null);
  const [clearGeneration, setClearGeneration] = useState('');
  const clearedGenerationRef = useRef('');
  const taskRef = useRef<TaskHandle>(null);
  const operationCount = useRef(0);
  const run: Run = useCallback(
    async (action, success) => {
      const generation = clearedGenerationRef.current;
      try {
        await action();
        if (success && generation === clearedGenerationRef.current) setNotice({ text: success });
        return true;
      } catch (error) {
        if (generation === clearedGenerationRef.current)
          setNotice({ text: messageForError(error, language), error: true });
        return false;
      }
    },
    [language],
  );
  useEffect(() => {
    const url = new URL(location.href);
    if (view === 'recovery') url.searchParams.delete('section');
    else url.searchParams.set('section', view);
    url.hash = '';
    history.replaceState(null, '', url);
  }, [view]);
  const captureRef = useRef<CaptureDraft | null>(null);
  const pendingQueue = useRef<CaptureDraft[]>([]);
  const seenCapture = useRef('');
  const sessionVersion = useRef(0);
  const clearViewCaches = useCallback((generation: string) => {
    if (generation === clearedGenerationRef.current) return;
    clearedGenerationRef.current = generation;
    sessionVersion.current++;
    captureRef.current = null;
    pendingQueue.current = [];
    seenCapture.current = '';
    setCapture(null);
    setAddOpen(false);
    setCreateOpen(false);
    setSelectedId(null);
    setNotice(null);
    // Remount child views to release imports, resource editors, and other local form snapshots.
    setClearGeneration(generation);
  }, []);
  const acceptCapture = useCallback((pending: CaptureDraft) => {
    const identity = JSON.stringify(pending);
    if (identity === seenCapture.current) return;
    seenCapture.current = identity;
    if (captureRef.current && JSON.stringify(captureRef.current) !== identity) {
      if (!pendingQueue.current.some((item) => JSON.stringify(item) === identity))
        pendingQueue.current.push(pending);
      return;
    }
    captureRef.current = pending;
    setCapture(pending);
    setAddOpen(true);
  }, []);
  useEffect(() => {
    if (state && selectedId === null) {
      const initial =
        state.tasks.find((item) => item.id === state.currentTaskId) ??
        [...state.tasks]
          .filter((item) => item.status === 'paused')
          .sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (initial) setSelectedId(initial.id);
    }
  }, [state, selectedId]);
  const flush = () => taskRef.current?.flush() ?? Promise.resolve();
  const navigate = (next: View) =>
    void run(async () => {
      await flush();
      setView(next);
    });
  const select = (id: string) =>
    void run(async () => {
      await flush();
      setSelectedId(id);
      setView('recovery');
    });
  useEffect(() => {
    let alive = true;
    const read = async () => {
      const version = ++sessionVersion.current;
      try {
        const pending = await getPendingCapture();
        if (alive && version === sessionVersion.current && pending) acceptCapture(pending);
        const feedback = await getBrowserFeedback();
        if (alive && version === sessionVersion.current && feedback?.kind === 'saved') {
          setNotice({
            text:
              (language === 'zh-CN'
                ? `已放进【${feedback.taskTitle ?? ''}】`
                : `Saved to “${feedback.taskTitle ?? ''}”`) +
              (feedback.truncated
                ? t('；摘录已限制为 12,000 字符。', '; excerpt limited to 12,000 characters.')
                : ''),
            undoId: feedback.undoId,
          });
          await clearBrowserFeedback();
        } else if (alive && version === sessionVersion.current && feedback?.kind === 'error') {
          setNotice({ text: messageForError({ code: feedback.code }, language), error: true });
          await clearBrowserFeedback();
        }
      } catch (error) {
        if (alive && version === sessionVersion.current)
          setNotice({ text: messageForError(error, language), error: true });
      }
    };
    void read();
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'session') return;
      const generation = changes[DATA_CLEAR_GENERATION]?.newValue;
      if (typeof generation === 'string' && generation) {
        clearViewCaches(generation);
        return;
      }
      void read();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => {
      alive = false;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, [language, clearViewCaches]);
  if (!state)
    return (
      <div className="loading" role="status">
        <Mark />
        <p>{t('正在找回你的记录…', 'Finding your saved place…')}</p>
      </div>
    );
  const task =
    state.tasks.find((item) => item.id === selectedId) ??
    state.tasks.find((item) => item.id === state.currentTaskId) ??
    [...state.tasks].filter((item) => item.status === 'paused').sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const startCreate = () =>
    void run(async () => {
      await flush();
      setCreateOpen(true);
    });
  const capturePage = () =>
    void run(async () => {
      const generation = clearedGenerationRef.current;
      await flush();
      if (generation !== clearedGenerationRef.current) return;
      const draft = await captureCurrentPage();
      if (generation !== clearedGenerationRef.current) return;
      if (draft.error) throw Object.assign(new Error(draft.error), { code: draft.error });
      acceptCapture(draft);
    });
  const closeResource = () => {
    const next = pendingQueue.current.shift();
    if (next) {
      if (captureRef.current) pendingQueue.current.push(captureRef.current);
      captureRef.current = next;
      setCapture(next);
      setAddOpen(true);
    } else setAddOpen(false);
  };
  const saveResource = async (taskId: string, input: ResourceInput) => {
    const generation = clearedGenerationRef.current;
    await flush();
    if (generation !== clearedGenerationRef.current) return;
    const { undoId } = await repo.addResource(taskId, input);
    if (generation !== clearedGenerationRef.current) return;
    const pending = await getPendingCapture();
    if (generation !== clearedGenerationRef.current) return;
    if (!pending || JSON.stringify(pending) === JSON.stringify(captureRef.current))
      await clearPendingCapture();
    const fresh = await repo.getState();
    if (generation !== clearedGenerationRef.current) return;
    setNotice({
      text: t(
        `已放进【${fresh.tasks.find((item) => item.id === taskId)?.title ?? ''}】`,
        `Saved to “${fresh.tasks.find((item) => item.id === taskId)?.title ?? ''}”`,
      ),
      undoId,
    });
    captureRef.current = null;
    seenCapture.current = '';
    setCapture(null);
  };
  return (
    <div className={`app-shell ${fullPage ? 'full-page' : 'side-panel'}`}>
      <header className="app-header">
        <button
          className="brand"
          aria-label={t('接着来首页', 'BackToIt home')}
          onClick={() => navigate('recovery')}
        >
          <Mark />
          <span>{t('接着来', 'BackToIt')}</span>
        </button>
        <div className="header-actions">
          {!fullPage && (
            <button
              className="icon-button"
              aria-label={t('打开完整页面', 'Open full page')}
              onClick={() =>
                void run(async () => {
                  await flush();
                  await openApp(view === 'recovery' ? undefined : view);
                })
              }
            >
              <ExternalLink size={18} />
            </button>
          )}
          <button
            className="icon-button"
            aria-label={t('开始一件事', 'Start something')}
            onClick={startCreate}
          >
            <Plus size={20} />
          </button>
        </div>
      </header>
      <div className="app-layout" key={clearGeneration}>
        <nav className="main-nav" aria-label={t('主导航', 'Main navigation')}>
          <button
            className={view === 'recovery' ? 'active' : ''}
            aria-current={view === 'recovery' ? 'page' : undefined}
            onClick={() => navigate('recovery')}
          >
            <Mark />
            {t('接着做', 'Return')}
          </button>
          <button
            className={view === 'tasks' ? 'active' : ''}
            aria-current={view === 'tasks' ? 'page' : undefined}
            onClick={() => navigate('tasks')}
          >
            <List size={17} />
            {t('任务', 'Tasks')}
          </button>
          <button
            className={view === 'settings' ? 'active' : ''}
            aria-current={view === 'settings' ? 'page' : undefined}
            onClick={() => navigate('settings')}
          >
            <SettingsIcon size={17} />
            {t('设置', 'Settings')}
          </button>
          {fullPage && (
            <div className="nav-note">
              <span className="local-dot" />
              {t('你的记录留在本机', 'Your notes stay on this device')}
            </div>
          )}
        </nav>
        <main id="main-content" className="main-content">
          {notice && (
            <div
              className={`feedback ${notice.error ? 'error-feedback' : ''}`}
              role={notice.error ? 'alert' : 'status'}
            >
              <p>{notice.text}</p>
              {notice.undoId && (
                <button
                  className="text-button"
                  onClick={() => {
                    if (operationCount.current) return;
                    operationCount.current++;
                    void run(async () => {
                      const undone = await repo.undoResource(notice.undoId!);
                      setNotice({
                        text: undone
                          ? t('已撤销这次保存', 'This save was undone')
                          : t(
                              '这次保存已无法撤销；可以在资料中手动移除。',
                              'This save can no longer be undone. You can remove the resource manually.',
                            ),
                      });
                    }).finally(() => {
                      operationCount.current--;
                    });
                  }}
                >
                  {t('撤销', 'Undo')}
                </button>
              )}
              <button
                className="icon-button"
                aria-label={t('关闭提示', 'Dismiss message')}
                onClick={() => setNotice(null)}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {view === 'recovery' &&
            (task ? (
              <TaskView
                key={task.id}
                ref={taskRef}
                task={task}
                resources={state.resources.filter((resource) => resource.taskId === task.id)}
                checkpoints={state.checkpoints.filter((point) => point.taskId === task.id)}
                settings={settings}
                run={run}
                onSwitch={() => navigate('tasks')}
                onAdd={() => {
                  if (captureRef.current) {
                    setCapture(captureRef.current);
                  } else setCapture(null);
                  setAddOpen(true);
                }}
                onCapture={capturePage}
              />
            ) : (
              <section className="welcome">
                <div className="welcome-visual">
                  <Mark large />
                  <span className="reconnect-line" />
                </div>
                <h1>
                  {t(
                    '留住做到哪一步，\n下次回来直接接着做。',
                    'Keep your place.\nCome back to a clear next step.',
                  )}
                </h1>
                <p>
                  {t(
                    '一件事、一句进度、用得上的资料。\n想离开时放心放下，回来时有处可接。',
                    'One task, a note on your progress, and the resources you need. Leave when you need to. Find your place when you return.',
                  )}
                </p>
                <button className="primary welcome-start" onClick={startCreate}>
                  {t('开始一件事', 'Start something')}
                  <Plus size={18} />
                </button>
                <button
                  className="text-button"
                  onClick={() =>
                    void run(
                      async () => {
                        const example = await repo.createExample();
                        setSelectedId(example.id);
                      },
                      t('已创建一份标记清楚的示例', 'A clearly marked example is ready'),
                    )
                  }
                >
                  {t('看看示例', 'Explore an example')}
                </button>
                <p className="welcome-private">
                  {t('无需登录。默认保存在这台设备。', 'No sign-in. Saved on this device by default.')}
                </p>
              </section>
            ))}
          {view === 'tasks' && (
            <TaskManager state={state} onSelect={select} onCreate={startCreate} run={run} />
          )}
          {view === 'settings' && (
            <SettingsView
              settings={settings}
              state={state}
              run={run}
              onSettings={setSettings}
              onCleared={clearViewCaches}
            />
          )}
          {view === 'recovery' && (
            <Parking
              items={[...state.parking].sort(
                (a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt,
              )}
              run={run}
              onConvert={async (id) => {
                await flush();
                const converted = await repo.parkingToTask(id);
                setSelectedId(converted.id);
                setView('recovery');
              }}
            />
          )}
          <footer className="app-footer">
            {t('留一点线索，给下一次的自己。', 'A small clue for the next time you return.')}
          </footer>
        </main>
        {fullPage && view === 'recovery' && (
          <aside className="context-note" aria-label={t('使用提示', 'A small reminder')}>
            <span className="note-line" />
            <p>{t('现在只要\n接上这一小步。', 'For now,\njust the next small step.')}</p>
            <span>{t('随时可以暂停。', 'It is okay to pause.')}</span>
          </aside>
        )}
      </div>
      {createOpen && (
        <CreateTask
          onClose={() => setCreateOpen(false)}
          run={run}
          onCreate={async (title, next) => {
            await flush();
            const created = await repo.createTask(title, next);
            setSelectedId(created.id);
            setView('recovery');
          }}
        />
      )}
      {addOpen && (
        <AddResourceModal
          key={capture ? JSON.stringify(capture) : 'manual'}
          state={state}
          draft={capture}
          onClose={closeResource}
          onSave={saveResource}
          run={(action, success) =>
            run(async () => {
              await flush();
              return action();
            }, success)
          }
        />
      )}
      {capture && !addOpen && (
        <button className="pending-button" onClick={() => setAddOpen(true)}>
          {t('继续保存暂存的资料', 'Finish saving your captured resource')}
        </button>
      )}
    </div>
  );
}

function CreateTask({
  onClose,
  onCreate,
  run,
}: {
  onClose: () => void;
  onCreate: (title: string, next: string) => Promise<void>;
  run: Run;
}) {
  const { t } = useText();
  const [title, setTitle] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={t('开始一件事', 'Start something')} onClose={onClose} busy={busy}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          if (await run(() => onCreate(title.trim(), next.trim()))) onClose();
          setBusy(false);
        }}
      >
        <label>
          {t('这次想做什么？', 'What would you like to work on?')}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={240}
            required
            autoFocus
            placeholder={t('比如：把课程报告的第二部分写完', 'For example: finish section two of my report')}
          />
        </label>
        <details className="optional-field">
          <summary>{t('留一个下一步（可选）', 'Leave a next step (optional)')}</summary>
          <label>
            {t('下一步准备做什么', 'What will you do next?')}
            <textarea value={next} onChange={(e) => setNext(e.target.value)} maxLength={2000} rows={3} />
          </label>
        </details>
        <p className="tiny muted">
          {t(
            '开始后，之前的当前任务会可靠保存并暂停。',
            'Starting this task saves your edits and pauses the previous current task.',
          )}
        </p>
        <div className="actions">
          <button type="button" className="secondary" onClick={onClose} disabled={busy}>
            {t('取消', 'Cancel')}
          </button>
          <button className="primary" disabled={busy || !title.trim()}>
            {busy ? t('正在创建…', 'Creating…') : t('开始这件事', 'Start this task')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (this.state.failed)
      return (
        <div className="fatal-error" role="alert">
          <Mark />
          <h1>暂时无法读取本地记录</h1>
          <p>数据没有被清空。请重新打开扩展或刷新后重试。</p>
          <p>
            Local records could not be read. Your data has not been cleared. Reopen the extension or reload to
            retry.
          </p>
          <button className="secondary" onClick={() => location.reload()}>
            重试 / Retry
          </button>
        </div>
      );
    return this.props.children;
  }
}
