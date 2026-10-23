import { useEffect, useState } from 'react';
import { ExternalLink, Link, FileText, Star, MoreHorizontal, Plus, Globe } from 'lucide-react';
import type { AppSnapshot, CaptureDraft, Resource, ResourceInput } from '../domain/types';
import { repo } from '../storage/repository';
import { inspectUrl } from '../domain/url';
import { openResources } from '../browser/adapter';
import { useText } from './i18n';
import { Modal, Confirm } from './primitives';

export type Run = (action: () => Promise<unknown>, success?: string) => Promise<boolean>;
export function ResourceList({
  resources,
  primaryId,
  onAdd,
  onCapture,
  run,
  taskId,
}: {
  resources: Resource[];
  primaryId: string | null;
  onAdd: () => void;
  onCapture: () => void;
  run: Run;
  taskId: string;
}) {
  const { t, date, number } = useText();
  const [all, setAll] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [remove, setRemove] = useState<Resource | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (editing && !resources.some((resource) => resource.id === editing.id)) setEditing(null);
    if (remove && !resources.some((resource) => resource.id === remove.id)) setRemove(null);
  }, [resources, editing, remove]);
  const ordered = [...resources].sort(
    (a, b) => Number(b.id === primaryId) - Number(a.id === primaryId) || b.savedAt - a.savedAt,
  );
  const shown = all ? ordered : ordered.slice(0, 3);
  return (
    <section className="resources-section" aria-labelledby="resources-title">
      <div className="section-title">
        <h2 id="resources-title">
          {t('需要的资料', 'Your resources')} <span className="count">{number(resources.length)}</span>
        </h2>
      </div>
      <div className="resource-actions">
        <button className="secondary compact" onClick={onCapture}>
          <Globe size={16} />
          {t('保存当前网页', 'Save current page')}
        </button>
        <button className="text-button compact" onClick={onAdd}>
          <Plus size={16} />
          {t('链接或笔记', 'Link or note')}
        </button>
      </div>
      {!resources.length && (
        <p className="quiet-note">
          {t(
            '把需要的网页或笔记放在这里，下次少找一会儿。',
            'Keep a useful page or note here, so it is easier to find next time.',
          )}
        </p>
      )}
      <ul className="resource-list">
        {shown.map((resource) => (
          <li key={resource.id}>
            <div className="resource-icon">{resource.url ? <Link size={17} /> : <FileText size={17} />}</div>
            <div className="resource-content">
              <div className="resource-title-row">
                <button
                  className="resource-title"
                  onClick={() =>
                    resource.url ? void run(() => openResources([resource])) : setEditing(resource)
                  }
                >
                  {resource.title}
                </button>
                {resource.id === primaryId && <span className="primary-badge">{t('首要', 'Primary')}</span>}
              </div>
              {resource.note && <p className="resource-note">{resource.note}</p>}
              {resource.excerpts.slice(0, 1).map((text, index) => (
                <blockquote key={index}>{text}</blockquote>
              ))}
              {resource.excerpts.length > 1 && (
                <span className="tiny muted">
                  {t('另有 ', 'Plus ')}
                  {number(resource.excerpts.length - 1)}
                  {t(' 段摘录', ' excerpts')}
                </span>
              )}
              <span className="resource-time">
                {t('保存于 ', 'Saved ')}
                {date(resource.savedAt)}
              </span>
            </div>
            <button
              className="icon-button"
              aria-label={t('编辑资料：', 'Edit resource: ') + resource.title}
              onClick={() => setEditing(resource)}
            >
              <MoreHorizontal size={20} />
            </button>
          </li>
        ))}
      </ul>
      {resources.length > 3 && (
        <button className="text-button" onClick={() => setAll(!all)}>
          {all
            ? t('收起资料', 'Show fewer resources')
            : t(
                `查看全部 ${number(resources.length)} 项资料`,
                `Show all ${number(resources.length)} resources`,
              )}
        </button>
      )}
      {editing && resources.some((resource) => resource.id === editing.id) && (
        <ResourceEditor
          resource={editing}
          isPrimary={editing.id === primaryId}
          onClose={() => setEditing(null)}
          run={run}
          onPrimary={async () => {
            if (
              await run(() => repo.setPrimaryResource(taskId, editing.id === primaryId ? null : editing.id))
            )
              setEditing(null);
          }}
          onRemove={() => {
            setRemove(editing);
            setEditing(null);
          }}
        />
      )}
      {remove && resources.some((resource) => resource.id === remove.id) && (
        <Confirm
          title={t('移除这项资料？', 'Remove this resource?')}
          description={t(
            '资料及其摘录会从任务中删除，历史现场也不再引用它。',
            'The resource and its excerpts will be deleted. Saved checkpoints will no longer reference it.',
          )}
          label={t('移除资料', 'Remove resource')}
          busy={busy}
          onClose={() => setRemove(null)}
          onConfirm={async () => {
            setBusy(true);
            if (await run(() => repo.removeResource(remove.id), t('资料已移除', 'Resource removed')))
              setRemove(null);
            setBusy(false);
          }}
        />
      )}
    </section>
  );
}

function ResourceEditor({
  resource,
  isPrimary,
  onPrimary,
  onRemove,
  onClose,
  run,
}: {
  resource: Resource;
  isPrimary: boolean;
  onPrimary: () => Promise<void>;
  onRemove: () => void;
  onClose: () => void;
  run: Run;
}) {
  const { t } = useText();
  const [title, setTitle] = useState(resource.title);
  const [note, setNote] = useState(resource.note);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={t('这项资料', 'Resource details')} onClose={onClose} busy={busy}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          if (
            await run(
              () => repo.updateResource(resource.id, { title: title.trim(), note }, resource.revision),
              t('资料已更新', 'Resource updated'),
            )
          )
            onClose();
          setBusy(false);
        }}
      >
        <label>
          {t('资料标题', 'Resource title')}
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={500} required />
        </label>
        {resource.url && (
          <a className="break-link" href={resource.url} target="_blank" rel="noreferrer">
            {resource.url}
            <ExternalLink size={14} />
          </a>
        )}
        <label>
          {t('一句用途备注', 'A note on why it matters')}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={6000} rows={3} />
        </label>
        {resource.excerpts.map((excerpt, i) => (
          <blockquote className="full-excerpt" key={i}>
            {excerpt}
          </blockquote>
        ))}
        <div className="actions">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onPrimary();
              setBusy(false);
            }}
          >
            <Star size={16} />
            {isPrimary ? t('取消首要', 'Unset primary') : t('设为首要', 'Make primary')}
          </button>
          <button className="primary" disabled={busy || !title.trim()}>
            {t('保存修改', 'Save changes')}
          </button>
        </div>
        <button type="button" className="text-button danger-text" disabled={busy} onClick={onRemove}>
          {t('移除资料', 'Remove resource')}
        </button>
      </form>
    </Modal>
  );
}

export function AddResourceModal({
  state,
  draft,
  onClose,
  onSave,
  run,
}: {
  state: AppSnapshot;
  draft: CaptureDraft | null;
  onClose: () => void;
  onSave: (taskId: string, input: ResourceInput) => Promise<void>;
  run: Run;
}) {
  const { t } = useText();
  const [title, setTitle] = useState(draft?.title ?? '');
  const [url, setUrl] = useState(draft?.url ?? '');
  const [note, setNote] = useState('');
  const [excerpt, setExcerpt] = useState(draft?.excerpt ?? '');
  const [taskId, setTaskId] = useState(state.currentTaskId ?? '');
  const [newTitle, setNewTitle] = useState('');
  const [choice, setChoice] = useState<'safe' | 'original' | null>(null);
  const [risk, setRisk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    let parsed: ReturnType<typeof inspectUrl> | null = null;
    try {
      if (url.trim()) parsed = inspectUrl(url.trim());
    } catch {
      setError(
        t(
          '请输入完整的 http 或 https 链接；也可以留空，仅保存笔记。',
          'Enter a complete http or https link, or leave it empty to save a note.',
        ),
      );
      return;
    }
    if (parsed?.sensitive && !choice) {
      setRisk(true);
      return;
    }
    if (!taskId && !newTitle.trim()) {
      setError(t('选择一个任务，或给新任务起个名字。', 'Choose a task or name a new one.'));
      return;
    }
    setBusy(true);
    const success = await run(async () => {
      let destination = taskId;
      if (!destination) {
        destination = (await repo.createTask(newTitle.trim())).id;
        setTaskId(destination);
      }
      await onSave(destination, {
        title: title.trim() || t('一条笔记', 'A note'),
        url: parsed ? (choice === 'safe' ? parsed.safeUrl : parsed.url) : null,
        note,
        excerpt: excerpt || undefined,
        source: draft?.source ?? 'manual',
      });
    });
    if (success) onClose();
    setBusy(false);
  };
  return (
    <Modal
      title={draft ? t('留住这项资料', 'Keep this resource') : t('添加链接或笔记', 'Add a link or note')}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        {draft?.truncated && (
          <p className="notice">
            {t(
              '选中文字过长，已保留允许范围内的片段。',
              'The selection was long; only the supported portion was kept.',
            )}
          </p>
        )}
        <label>
          {t('放进哪个任务', 'Save to task')}
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">{t('创建一个新任务', 'Create a new task')}</option>
            {state.tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
        </label>
        {!taskId && (
          <label>
            {t('这次想做什么？', 'What would you like to work on?')}
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={240}
              required
              autoFocus
            />
          </label>
        )}
        <label>
          {t('资料标题', 'Resource title')}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={500}
            placeholder={t('便于下次认出来', 'A name you will recognize')}
          />
        </label>
        <label>
          {t('链接（可选）', 'Link (optional)')}
          <input
            type="text"
            inputMode="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setChoice(null);
              setRisk(false);
            }}
            maxLength={8192}
            placeholder="https://"
          />
        </label>
        <label>
          {t('笔记 / 用途', 'Note / purpose')}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={6000} rows={3} />
        </label>
        {excerpt && (
          <label>
            {t('主动保存的摘录', 'Your selected excerpt')}
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              maxLength={12000}
              rows={4}
            />
          </label>
        )}
        {risk && (
          <fieldset className="notice">
            <legend>{t('链接可能含有敏感参数', 'This link may contain sensitive parameters')}</legend>
            <p>
              {t(
                '例如登录令牌或分享签名。请选择保留方式；删除参数可能影响链接使用。',
                'It may contain a login token or share signature. Removing those parameters may affect the link.',
              )}
            </p>
            <label className="choice">
              <input
                type="radio"
                name="url-choice"
                checked={choice === 'safe'}
                onChange={() => setChoice('safe')}
              />
              {t('移除敏感参数后保存', 'Remove sensitive parameters')}
            </label>
            <label className="choice">
              <input
                type="radio"
                name="url-choice"
                checked={choice === 'original'}
                onChange={() => setChoice('original')}
              />
              {t('我确认保留这些参数', 'I choose to keep these parameters')}
            </label>
          </fieldset>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="actions">
          <button type="button" className="secondary" onClick={onClose} disabled={busy}>
            {t('取消', 'Cancel')}
          </button>
          <button className="primary" disabled={busy || (!title.trim() && !note.trim() && !url.trim())}>
            {busy ? t('正在保存…', 'Saving…') : t('保存资料', 'Save resource')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
