import { useEffect, useRef, useState } from 'react';
import { Download, Upload, ShieldCheck, Plug, ChevronDown } from 'lucide-react';
import type { AppSnapshot, Backup, OllamaConfig, Settings } from '../domain/types';
import { repo } from '../storage/repository';
import { parseBackup } from '../domain/backup';
import { DEFAULT_SETTINGS, disableOllama, enableOllama, updateSettings } from '../browser/settings';
import { OllamaProvider } from '../ai/providers';
import { messageForError } from '../browser/errors';
import { clearPendingCapture, clearBrowserFeedback } from '../browser/adapter';
import { useText } from './i18n';
import { Confirm, download, Modal } from './primitives';
import type { Run } from './Resources';
import { broadcastDataClear } from './dataClear';
import { withDataClearLock } from '../browser/dataClear';

export function SettingsView({
  settings,
  state,
  run,
  onSettings,
  onCleared,
}: {
  settings: Settings;
  state: AppSnapshot;
  run: Run;
  onSettings: (settings: Settings) => void;
  onCleared?: (generation: string) => void;
}) {
  const { t, language, number } = useText();
  const [endpoint, setEndpoint] = useState<OllamaConfig['endpoint']>(settings.ollama.endpoint);
  const [models, setModels] = useState<string[]>([]);
  const [connection, setConnection] = useState('');
  const [testing, setTesting] = useState(false);
  const [preview, setPreview] = useState<Backup | null>(null);
  const [confirm, setConfirm] = useState<'clear' | 'examples' | null>(null);
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const testController = useRef<AbortController | null>(null);
  const testVersion = useRef(0);
  const viewLifetime = useRef(0);
  useEffect(
    () => () => {
      viewLifetime.current++;
      testVersion.current++;
      testController.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!settings.ollama.enabled) {
      testVersion.current++;
      testController.current?.abort();
      setTesting(false);
    }
  }, [settings.ollama.enabled]);
  const saveSettings = async (patch: Partial<Settings>) => {
    onSettings(await updateSettings(patch));
  };
  const test = async (config: OllamaConfig) => {
    testController.current?.abort();
    testController.current = new AbortController();
    const version = ++testVersion.current;
    setTesting(true);
    setConnection(t('正在连接本机服务…', 'Connecting to your local service…'));
    try {
      const available = await new OllamaProvider().testConnection(config, testController.current.signal);
      if (version !== testVersion.current) return;
      setModels(available);
      setConnection(
        available.length
          ? t(
              `已连接，找到 ${number(available.length)} 个已安装模型。`,
              `Connected. Found ${number(available.length)} installed models.`,
            )
          : t('服务可达，但没有已安装的本地模型。', 'Connected, but no installed local models were found.'),
      );
      if (available.length && !available.includes(config.model)) {
        await saveSettings({ ollama: { ...config, model: available[0] ?? '' } });
      }
    } catch (error) {
      if (version === testVersion.current) {
        setConnection(messageForError(error, language));
        setModels([]);
      }
    } finally {
      if (version === testVersion.current) setTesting(false);
    }
  };
  return (
    <div className="settings-view">
      <div className="page-heading">
        <h1>{t('按你的方式来', 'Make it yours')}</h1>
        <p className="muted">
          {t('默认留在本机，不需要账号或模型。', 'Local by default. No account or model required.')}
        </p>
      </div>
      <section className="settings-section">
        <h2>{t('界面', 'Interface')}</h2>
        <label>
          {t('语言', 'Language')}
          <select
            value={settings.language}
            onChange={(e) =>
              void run(() => saveSettings({ language: e.target.value as Settings['language'] }))
            }
          >
            <option value="zh-CN">简体中文</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          {t('外观', 'Appearance')}
          <select
            value={settings.appearance}
            onChange={(e) =>
              void run(() => saveSettings({ appearance: e.target.value as Settings['appearance'] }))
            }
          >
            <option value="light">{t('浅色', 'Light')}</option>
            <option value="system">{t('跟随系统', 'Follow system')}</option>
          </select>
        </label>
      </section>
      <section className="settings-section">
        <h2>
          <ShieldCheck size={19} />
          {t('备份与数据', 'Backup and data')}
        </h2>
        <p className="muted">
          {t(
            '备份包含你保存的文字与链接，不是加密文件，请妥善保管。模型连接设置不会导出。',
            'Backups contain your saved text and links and are not encrypted. Store them carefully. Model connection settings are excluded.',
          )}
        </p>
        <div className="settings-actions">
          <button
            className="secondary"
            onClick={() =>
              void run(
                async () => {
                  const backup = await repo.exportBackup();
                  download(
                    JSON.stringify(backup),
                    `BackToIt-backup-${new Date().toISOString().slice(0, 10)}.json`,
                    'application/json',
                  );
                },
                t('备份文件已创建', 'Backup file created'),
              )
            }
          >
            <Download size={16} />
            {t('导出 JSON 备份', 'Export JSON backup')}
          </button>
          <button className="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
            <Upload size={16} />
            {t('导入备份', 'Import backup')}
          </button>
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept=".json,application/json"
            aria-label={t('选择备份文件', 'Choose backup file')}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              const lifetime = viewLifetime.current;
              setImportError('');
              setBusy(true);
              try {
                if (file.size > 5 * 1024 * 1024) throw new Error('FILE_TOO_LARGE');
                const text = await file.text();
                if (lifetime !== viewLifetime.current) return;
                setPreview(parseBackup(text));
              } catch {
                if (lifetime !== viewLifetime.current) return;
                setImportError(
                  t(
                    '无法读取这个备份。请使用有效的 v1 JSON 文件，大小不超过 5 MiB，且内容与引用完整。现有数据没有改变。',
                    'This backup could not be read. Use a valid v1 JSON file no larger than 5 MiB, with complete records and references. Existing data is unchanged.',
                  ),
                );
              } finally {
                if (lifetime === viewLifetime.current) setBusy(false);
              }
            }}
          />
        </div>
        {importError && (
          <p className="error" role="alert">
            {importError}
          </p>
        )}
        <p className="tiny muted">
          {t(
            '导入为新任务，保留现有内容。支持最多 500 个任务、5000 项资料、5000 条现场及 2000 条暂存想法。',
            'Imports create new tasks and preserve existing content. Limits: 500 tasks, 5,000 resources, 5,000 checkpoints, and 2,000 thoughts set aside.',
          )}
        </p>
        <button
          className="text-button"
          disabled={!state.tasks.some((task) => task.isExample) || busy}
          onClick={() => setConfirm('examples')}
        >
          {t('清理示例数据', 'Remove example data')}
        </button>
        <button className="text-button danger-text" onClick={() => setConfirm('clear')}>
          {t('删除全部本地数据', 'Delete all local data')}
        </button>
      </section>
      <section className="settings-section">
        <div className="section-title">
          <h2>
            <Plug size={19} />
            {t('可选：本地模型', 'Optional: local model')}
          </h2>
          <span className="badge">
            {settings.ollama.enabled ? t('已启用', 'Enabled') : t('已关闭', 'Off')}
          </span>
        </div>
        <p className="muted">
          {t(
            '不连接模型也能完成所有核心操作。开启后，也只有你点“帮我整理一下”并确认内容时，才会发送任务记录。',
            'Every core feature works without a model. When enabled, task content is sent only after you choose “Help me reconnect” and review the input.',
          )}
        </p>
        <label>
          {t('本机 Ollama 地址', 'Local Ollama address')}
          <select
            value={endpoint}
            disabled={testing || settings.ollama.enabled}
            onChange={(e) => setEndpoint(e.target.value as OllamaConfig['endpoint'])}
          >
            <option value="http://127.0.0.1:11434">127.0.0.1:11434</option>
            <option value="http://localhost:11434">localhost:11434</option>
          </select>
        </label>
        {!settings.ollama.enabled ? (
          <button
            className="secondary"
            disabled={testing}
            onClick={() => {
              const permission = enableOllama(endpoint);
              setTesting(true);
              void run(async () => {
                try {
                  if (!(await permission)) {
                    setConnection(
                      t(
                        '没有获得连接权限，本地规则仍可使用。',
                        'Connection permission was not granted. Local rules remain available.',
                      ),
                    );
                    return;
                  }
                  const config = { enabled: true, endpoint, model: '' };
                  await saveSettings({ ollama: config });
                  await test(config);
                } finally {
                  setTesting(false);
                }
              });
            }}
          >
            {t('启用并测试连接', 'Enable and test connection')}
          </button>
        ) : (
          <>
            <label>
              {t('已安装的本地模型', 'Installed local model')}
              <select
                value={settings.ollama.model}
                disabled={testing}
                onChange={(e) =>
                  void run(() => saveSettings({ ollama: { ...settings.ollama, model: e.target.value } }))
                }
              >
                {!settings.ollama.model && (
                  <option value="">{t('先测试连接以获取模型', 'Test the connection to list models')}</option>
                )}
                {settings.ollama.model && !models.includes(settings.ollama.model) && (
                  <option value={settings.ollama.model}>{settings.ollama.model}</option>
                )}
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
            <div className="actions wrap">
              <button className="secondary" disabled={testing} onClick={() => void test(settings.ollama)}>
                {testing ? t('正在连接…', 'Connecting…') : t('测试连接 / 刷新模型', 'Test / refresh models')}
              </button>
              <button
                className="text-button"
                onClick={() => {
                  testVersion.current++;
                  testController.current?.abort();
                  setTesting(false);
                  void run(
                    async () => {
                      await disableOllama();
                      await saveSettings({ ollama: { ...settings.ollama, enabled: false } });
                      setConnection('');
                      setModels([]);
                    },
                    t('已关闭并撤销权限', 'Disabled and permission removed'),
                  );
                }}
              >
                {t('关闭并撤销权限', 'Disable and remove permission')}
              </button>
            </div>
          </>
        )}
        {connection && (
          <p className="notice" role="status">
            {connection}
          </p>
        )}
        <details className="model-help">
          <summary>
            <span>{t('本地服务与隐私说明', 'Local service and privacy')}</span>
            <ChevronDown size={16} />
          </summary>
          <p>
            {t(
              '请求发往本机不代表服务不会再联网。请在 Ollama 的服务环境中设置 OLLAMA_NO_CLOUD=1，或按官方说明关闭云功能；本扩展不会替你改动系统。',
              'Sending to this device does not ensure the service stays offline. Set OLLAMA_NO_CLOUD=1 in your Ollama service environment, or disable cloud features using the official instructions. This extension does not change your system.',
            )}
          </p>
          <p>
            {t(
              '如遇跨域限制，只允许本扩展来源，不要使用 *：',
              'If a CORS rule is needed, allow only this extension origin; do not use *:',
            )}
          </p>
          <code className="code-wrap">
            OLLAMA_ORIGINS=chrome-extension://
            {typeof chrome !== 'undefined' ? chrome.runtime.id : 'YOUR_EXTENSION_ID'}
          </code>
          <p>
            {t(
              '更改后按官方说明重启 Ollama。保持回环地址；不要把服务暴露在公共网络。扩展不会安装或下载模型。',
              'Restart Ollama after applying the setting. Keep the service on a loopback address, away from public networks. This extension does not install or download models.',
            )}
          </p>
          <a href="https://docs.ollama.com/faq" target="_blank" rel="noreferrer">
            {t('查看 Ollama 官方说明', 'Read the official Ollama instructions')}
          </a>
        </details>
      </section>
      <section className="settings-section about">
        <h2>
          {t('接着来', 'BackToIt')} <span className="tiny muted">v0.1</span>
        </h2>
        <p>
          {t(
            '只恢复你主动保存的链接、摘录、笔记和现场。不恢复未提交表单、编辑器光标或桌面布局。',
            'Reconnect with the links, excerpts, notes, and checkpoints you chose to save. Unsaved forms, editor cursors, and desktop layouts are outside this scope.',
          )}
        </p>
        <p className="tiny muted">
          {t(
            '这是日常工作与生活辅助工具，不是诊断、治疗或心理咨询产品。',
            'An everyday work and life aid, not a diagnostic, treatment, or counseling product.',
          )}
        </p>
        <p className="tiny muted">
          {t(
            '默认快捷键：Ctrl+Shift+Y 打开接着来；Alt+Shift+S 保存当前网页。可在 Chrome 扩展快捷键页面调整。',
            'Default shortcuts: Ctrl+Shift+Y opens BackToIt; Alt+Shift+S saves the current page. Adjust them in Chrome’s extension shortcuts settings.',
          )}
        </p>
      </section>
      {preview && (
        <Modal title={t('导入预览', 'Import preview')} onClose={() => setPreview(null)} busy={busy}>
          <p>
            {t(
              '这些内容将作为新的记录导入，不会覆盖现有任务。',
              'These records will be imported as new items. Existing tasks will not be overwritten.',
            )}
          </p>
          <dl className="import-counts">
            <div>
              <dt>{t('任务', 'Tasks')}</dt>
              <dd>{number(preview.tasks.length)}</dd>
            </div>
            <div>
              <dt>{t('资料', 'Resources')}</dt>
              <dd>{number(preview.resources.length)}</dd>
            </div>
            <div>
              <dt>{t('现场', 'Checkpoints')}</dt>
              <dd>{number(preview.checkpoints.length)}</dd>
            </div>
            <div>
              <dt>{t('暂存想法', 'Thoughts set aside')}</dt>
              <dd>{number(preview.parking.length)}</dd>
            </div>
          </dl>
          <ul className="import-titles">
            {preview.tasks.slice(0, 5).map((task) => (
              <li key={task.id}>{task.title}</li>
            ))}
          </ul>
          <div className="actions">
            <button className="secondary" onClick={() => setPreview(null)} disabled={busy}>
              {t('取消', 'Cancel')}
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                if (
                  await run(
                    () => repo.importBackup(preview),
                    t('备份已作为新任务导入', 'Backup imported as new tasks'),
                  )
                )
                  setPreview(null);
                setBusy(false);
              }}
            >
              {busy ? t('正在导入…', 'Importing…') : t('确认导入', 'Confirm import')}
            </button>
          </div>
        </Modal>
      )}
      {confirm && (
        <Confirm
          title={
            confirm === 'clear'
              ? t('删除全部本地数据？', 'Delete all local data?')
              : t('清理示例数据？', 'Remove example data?')
          }
          description={
            confirm === 'clear'
              ? t(
                  '所有任务、资料、现场、暂存想法及设置都会删除，且无法撤销。建议先导出备份。',
                  'All tasks, resources, checkpoints, thoughts, and settings will be deleted. This cannot be undone. Consider exporting a backup first.',
                )
              : t(
                  '只删除标记为示例的任务与关联资料。你自己的任务和暂存想法会保留。',
                  'Only example tasks and their related content will be deleted. Your own tasks and thoughts will remain.',
                )
          }
          label={
            confirm === 'clear' ? t('删除全部数据', 'Delete all data') : t('清理示例', 'Remove examples')
          }
          busy={busy}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            setBusy(true);
            if (
              await run(
                async () => {
                  if (confirm === 'clear') {
                    await withDataClearLock(async () => {
                      await repo.clearAll();
                      await clearPendingCapture();
                      await clearBrowserFeedback();
                      const generation = await broadcastDataClear();
                      onCleared?.(generation);
                    });
                    await disableOllama();
                    await saveSettings(DEFAULT_SETTINGS);
                  } else await repo.clearExamples();
                },
                t('清理完成', 'Data removed'),
              )
            )
              setConfirm(null);
            setBusy(false);
          }}
        />
      )}
    </div>
  );
}
