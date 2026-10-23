import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ChevronDown, Pause, Bookmark, History, Check, ArrowRight, PencilLine } from 'lucide-react';
import type { Checkpoint, Resource, Settings, Task } from '../domain/types';
import { repo } from '../storage/repository';
import { LocalRulesProvider } from '../ai/providers';
import { openResources } from '../browser/adapter';
import { toMarkdown } from '../domain/backup';
import { useText } from './i18n';
import { useTaskDraft } from './useTaskDraft';
import { ResourceList, type Run } from './Resources';
import { AIAssistant } from './AIAssistant';
import { Confirm, download } from './primitives';

export interface TaskHandle {
  flush: () => Promise<Task>;
}
export const TaskView = forwardRef<
  TaskHandle,
  {
    task: Task;
    resources: Resource[];
    checkpoints: Checkpoint[];
    settings: Settings;
    run: Run;
    onSwitch: () => void;
    onAdd: () => void;
    onCapture: () => void;
  }
>(function TaskView({ task, resources, checkpoints, settings, run, onSwitch, onAdd, onCapture }, ref) {
  const { t, language, date, number } = useText();
  const draft = useTaskDraft(task);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<string[]>(() => {
    const first =
      resources.find((r) => r.id === task.primaryResourceId && r.url) ??
      resources.filter((r) => r.url).sort((a, b) => b.savedAt - a.savedAt)[0];
    return first ? [first.id] : [];
  });
  const [removeCheckpoint, setRemoveCheckpoint] = useState<Checkpoint | null>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const nextRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({ flush: draft.flush }), [draft.flush]);
  const actionBusy = useRef(false);
  const [draftAnnouncement, setDraftAnnouncement] = useState('');
  useEffect(() => {
    setDraftAnnouncement('');
    if (draft.status !== 'saved') return;
    const announce = setTimeout(
      () => setDraftAnnouncement(t('修改已保存在本机', 'Your changes are saved on this device')),
      1200,
    );
    return () => clearTimeout(announce);
  }, [draft.status, language]);
  const changedSelection = useRef(false);
  useEffect(() => {
    if (changedSelection.current) {
      setSelected((previous) =>
        previous.filter((id) => resources.some((resource) => resource.id === id && resource.url)),
      );
      return;
    }
    const first =
      resources.find((resource) => resource.id === task.primaryResourceId && resource.url) ??
      [...resources].filter((resource) => resource.url).sort((a, b) => b.savedAt - a.savedAt)[0];
    setSelected(first ? [first.id] : []);
  }, [task.primaryResourceId, resources.map((resource) => resource.id).join('|')]);
  const guarded: Run = (action, success) =>
    run(async () => {
      await draft.flush();
      return action();
    }, success);
  const recovery = new LocalRulesProvider().generate({ ...task, ...draft.fields }, resources, language);
  const resourceSelection = resources.filter((r) => r.url && selected.includes(r.id));
  const editNext = () => {
    if (detailsRef.current) detailsRef.current.open = true;
    nextRef.current?.focus();
  };
  const pause = async () => {
    if (actionBusy.current) return;
    actionBusy.current = true;
    setBusy(true);
    try {
      const success = await run(
        async () => {
          const saved = await draft.flush();
          await repo.checkpointTask(
            task.id,
            { progress: saved.progress, blocker: saved.blocker, nextStep: saved.nextStep },
            saved.revision,
          );
        },
        t('现场已保存。这次先到这里。', 'Your place is saved. You can leave it here.'),
      );
      if (success && detailsRef.current) detailsRef.current.open = false;
    } finally {
      actionBusy.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="task-view">
      <div className="task-heading">
        <div className="task-state">
          <span className={`status-dot ${task.status}`} />
          {task.status === 'active'
            ? t('当前这件事', 'Your current task')
            : task.status === 'paused'
              ? t('留在这里的事', 'Right where you left it')
              : task.status === 'completed'
                ? t('已完成，仍可接着做', 'Completed — ready to revisit')
                : t('已归档，仍可接着做', 'Archived — ready to revisit')}
          {task.isExample && <span className="badge">{t('示例', 'Example')}</span>}
        </div>
        <h1>{task.title}</h1>
        <p className="quiet-note">
          {t('不用重新开始，从这里接上。', 'No need to start over. Pick up from here.')}
        </p>
      </div>
      <section className="recovery-card" aria-label={t('恢复卡', 'Recovery card')}>
        <div className="record-row">
          <span>{t('做到哪了', 'Where you left off')}</span>
          <p>{recovery.progress || t('还没有记录', 'Nothing recorded yet')}</p>
        </div>
        {recovery.blocker && (
          <div className="record-row">
            <span>{t('卡在哪里', 'What got in the way')}</span>
            <p>{recovery.blocker}</p>
          </div>
        )}
        <div className="next-step">
          <div className="next-label">
            <span>{t('下一步，只做这一件', 'Next, just this one thing')}</span>
            <button
              className="icon-button"
              aria-label={t('改一下下一步', 'Edit the next step')}
              onClick={editNext}
            >
              <PencilLine size={17} />
            </button>
          </div>
          <p>{recovery.nextStep}</p>
          {recovery.isSuggestion && (
            <span className="rule-label">{t('本地规则建议', 'Suggestion from local rules')}</span>
          )}
        </div>
        <button
          className="primary continue-button"
          disabled={busy}
          onClick={async () => {
            if (actionBusy.current) return;
            actionBusy.current = true;
            setBusy(true);
            try {
              await guarded(
                async () => {
                  await repo.activateTask(task.id);
                  await openResources(resourceSelection);
                },
                t('已接回当前任务', 'Your task is ready to continue'),
              );
            } finally {
              actionBusy.current = false;
              setBusy(false);
            }
          }}
        >
          {busy ? t('正在处理…', 'Working…') : t('接着做', 'Continue')}
          <ArrowRight size={19} />
        </button>
        <button
          className="resource-choice-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {resourceSelection.length === 0
            ? t('继续时不打开网页', 'Continue without opening pages')
            : t(
                `将打开 ${number(resourceSelection.length)} 项资料`,
                `Open ${number(resourceSelection.length)} ${resourceSelection.length === 1 ? 'resource' : 'resources'}`,
              )}
          <ChevronDown size={15} className={expanded ? 'rotated' : ''} />
        </button>
        {expanded && (
          <fieldset className="resource-choices">
            <legend className="sr-only">{t('继续时打开的资料', 'Resources to open')}</legend>
            {resources
              .filter((r) => r.url)
              .map((resource) => (
                <label className="choice" key={resource.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(resource.id)}
                    onChange={(e) => {
                      changedSelection.current = true;
                      setSelected((previous) =>
                        e.target.checked
                          ? [...previous, resource.id]
                          : previous.filter((id) => id !== resource.id),
                      );
                    }}
                  />
                  <span>{resource.title}</span>
                </label>
              ))}
            <p className="tiny muted">
              {t(
                '默认仅选一项；不会关闭或替换你已有的标签页。',
                'One resource is selected by default. Your existing tabs stay in place.',
              )}
            </p>
          </fieldset>
        )}
        <div className="recovery-secondary">
          <button className="text-button" disabled={busy} onClick={pause}>
            <Pause size={15} />
            {t('暂时不做', 'Leave for now')}
          </button>
          <button className="text-button" disabled={busy} onClick={onSwitch}>
            {t('换一个任务', 'Switch task')}
          </button>
        </div>
      </section>
      <details className="checkpoint-editor" ref={detailsRef}>
        <summary>
          <span>
            <Bookmark size={18} />
            {t('保存现场', 'Save your place')}
          </span>
          <span className={`save-state ${draft.status}`}>
            {draft.status === 'saved'
              ? t('已保存', 'Saved')
              : draft.status === 'saving'
                ? t('正在保存…', 'Saving…')
                : draft.status === 'pending'
                  ? t('等待保存…', 'Waiting to save…')
                  : draft.status === 'conflict'
                    ? t('需要处理冲突', 'Resolve a conflict')
                    : t('尚未保存', 'Not saved')}
          </span>
        </summary>
        <span className="sr-only" role="status" aria-live="polite">
          {draftAnnouncement}
        </span>
        <div className="editor-body">
          <p className="tiny muted">
            {t(
              '留一句也可以。输入会自动保存在本机。',
              'A sentence is enough. Your edits are saved on this device.',
            )}
          </p>
          <label>
            {t('做到哪了？', 'Where did you get to?')}
            <textarea
              value={draft.fields.progress}
              maxLength={6000}
              rows={3}
              onChange={(e) => draft.edit('progress', e.target.value)}
              placeholder={t('已经看完、写完或试过的部分', 'What you have read, written, or tried')}
            />
          </label>
          <label>
            {t('卡在哪里？', 'What is getting in the way?')}
            <textarea
              value={draft.fields.blocker}
              maxLength={6000}
              rows={2}
              onChange={(e) => draft.edit('blocker', e.target.value)}
              placeholder={t('可以留空', 'You can leave this blank')}
            />
          </label>
          <label>
            {t('回来后先做什么？', 'What will you do first when you return?')}
            <textarea
              ref={nextRef}
              value={draft.fields.nextStep}
              maxLength={2000}
              rows={3}
              onChange={(e) => draft.edit('nextStep', e.target.value)}
              placeholder={t('写一个小到可以马上开始的动作', 'One small action you can start right away')}
            />
          </label>
          {draft.status === 'error' && (
            <div role="alert" className="notice error">
              <p>
                {t(
                  '这次修改还没有保存。文字仍在这里，请重试后再离开。',
                  'These edits have not been saved. They are still here; retry before leaving.',
                )}
              </p>
              <button className="secondary" onClick={() => void run(() => draft.flush())}>
                {t('重试保存', 'Retry saving')}
              </button>
            </div>
          )}
          {draft.status === 'conflict' && (
            <div role="alert" className="notice">
              <p>
                {t(
                  '这个任务在另一个窗口有更新。你的输入仍保留在这里，请选择使用哪一份。',
                  'This task changed in another window. Your edits are still here; choose which version to keep.',
                )}
              </p>
              <div className="actions wrap">
                <button className="secondary" onClick={() => void run(() => draft.resolve(false))}>
                  {t('载入最新记录', 'Load latest version')}
                </button>
                <button className="secondary" onClick={() => void run(() => draft.resolve(true))}>
                  {t('保留我的输入', 'Keep my edits')}
                </button>
              </div>
            </div>
          )}
          <button className="primary" disabled={busy || draft.status === 'conflict'} onClick={pause}>
            <Bookmark size={17} />
            {t('保存并暂停', 'Save and pause')}
          </button>
        </div>
      </details>
      <ResourceList
        taskId={task.id}
        resources={resources}
        primaryId={task.primaryResourceId}
        run={guarded}
        onAdd={() =>
          void guarded(async () => {
            onAdd();
          })
        }
        onCapture={() =>
          void guarded(async () => {
            onCapture();
          })
        }
      />
      <AIAssistant
        contentDirty={draft.status !== 'saved'}
        task={task}
        resources={resources}
        settings={settings}
        flush={draft.flush}
        run={run}
        onAdopt={async (next) => {
          draft.edit('nextStep', next);
          await draft.flush();
        }}
      />
      <details className="history">
        <summary>
          <span>
            <History size={17} />
            {t('之前留下的现场', 'Saved checkpoints')}
          </span>
          <span className="count">{number(checkpoints.length)}</span>
        </summary>
        <div className="history-body">
          {!checkpoints.length && (
            <p className="muted tiny">
              {t('点“保存并暂停”后，现场会留在这里。', 'Use “Save and pause” to keep a checkpoint here.')}
            </p>
          )}
          {[...checkpoints]
            .sort((a, b) => b.createdAt - a.createdAt)
            .map((point) => (
              <article className="checkpoint" key={point.id}>
                <time>{date(point.createdAt)}</time>
                <dl>
                  {[
                    [t('进度', 'Progress'), point.progress],
                    [t('卡点', 'Blocker'), point.blocker],
                    [t('下一步', 'Next step'), point.nextStep],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value || t('还没有记录', 'Nothing recorded yet')}</dd>
                    </div>
                  ))}
                </dl>
                <p className="tiny muted">
                  {t('当时的资料：', 'Resources at that time: ')}
                  {point.resourceIds
                    .map((id) => resources.find((r) => r.id === id)?.title)
                    .filter(Boolean)
                    .join(' / ') || t('没有资料', 'No resources')}
                </p>
                <button className="text-button danger-text" onClick={() => setRemoveCheckpoint(point)}>
                  {t('删除这条现场', 'Delete checkpoint')}
                </button>
              </article>
            ))}
        </div>
      </details>
      <div className="task-footer">
        <button
          className="text-button"
          onClick={() =>
            void guarded(
              () => repo.setTaskStatus(task.id, task.status === 'completed' ? 'paused' : 'completed'),
              task.status === 'completed'
                ? t('已重新打开', 'Task reopened')
                : t('已标记完成', 'Marked complete'),
            )
          }
        >
          <Check size={16} />
          {task.status === 'completed' ? t('重新打开', 'Reopen') : t('标记完成', 'Mark complete')}
        </button>
        <button
          className="text-button"
          onClick={() =>
            void guarded(async () => {
              const state = await repo.getState();
              const fresh = state.tasks.find((value) => value.id === task.id);
              if (fresh)
                download(
                  toMarkdown(
                    fresh,
                    state.resources.filter((r) => r.taskId === task.id),
                    state.checkpoints.filter((c) => c.taskId === task.id),
                  ),
                  `BackToIt-${task.title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 60)}.md`,
                  'text/markdown;charset=utf-8',
                );
            })
          }
        >
          {t('导出这件事', 'Export this task')}
        </button>
      </div>
      {removeCheckpoint && (
        <Confirm
          title={t('删除这条现场？', 'Delete this checkpoint?')}
          description={t(
            '只删除这条历史快照，当前记录与资料会保留。',
            'Only this historical checkpoint will be deleted. Your current notes and resources will remain.',
          )}
          label={t('删除现场', 'Delete checkpoint')}
          busy={busy}
          onClose={() => setRemoveCheckpoint(null)}
          onConfirm={async () => {
            setBusy(true);
            if (await guarded(() => repo.deleteCheckpoint(removeCheckpoint.id))) setRemoveCheckpoint(null);
            setBusy(false);
          }}
        />
      )}
    </div>
  );
});
