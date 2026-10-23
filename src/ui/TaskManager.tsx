import { useState } from 'react';
import { Search, Plus, Archive, Trash2, Pencil } from 'lucide-react';
import type { AppSnapshot, Task, TaskStatus } from '../domain/types';
import { repo } from '../storage/repository';
import { useText } from './i18n';
import { Confirm, Empty, Modal } from './primitives';
import type { Run } from './Resources';

export function TaskManager({
  state,
  onSelect,
  onCreate,
  run,
}: {
  state: AppSnapshot;
  onSelect: (id: string) => void;
  onCreate: () => void;
  run: Run;
}) {
  const { t, date } = useText();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | TaskStatus>('all');
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [renaming, setRenaming] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const statusLabel = (status: TaskStatus) =>
    status === 'active'
      ? t('当前', 'Current')
      : status === 'paused'
        ? t('暂停', 'Paused')
        : status === 'completed'
          ? t('完成', 'Completed')
          : t('归档', 'Archived');
  const tasks = state.tasks
    .filter((task) => {
      if (filter !== 'all' && task.status !== filter) return false;
      const value = query.trim().toLocaleLowerCase();
      return (
        !value ||
        [
          task.title,
          task.progress,
          task.blocker,
          task.nextStep,
          ...state.resources
            .filter((r) => r.taskId === task.id)
            .flatMap((r) => [r.title, r.note, ...r.excerpts]),
        ]
          .join('\n')
          .toLocaleLowerCase()
          .includes(value)
      );
    })
    .sort(
      (a, b) =>
        Number(b.id === state.currentTaskId) - Number(a.id === state.currentTaskId) ||
        b.updatedAt - a.updatedAt,
    );
  return (
    <div className="manager">
      <div className="page-heading">
        <h1>{t('留在这里的事', 'Things to come back to')}</h1>
        <p className="muted">
          {t('每件事都有自己的现场。一次接回一件就好。', 'A place for each task. Return to one at a time.')}
        </p>
      </div>
      <button className="primary" onClick={onCreate}>
        <Plus size={18} />
        {t('开始一件事', 'Start something')}
      </button>
      <div className="search-field">
        <Search size={18} />
        <label className="sr-only" htmlFor="task-search">
          {t('搜索任务和资料', 'Search tasks and resources')}
        </label>
        <input
          id="task-search"
          placeholder={t('搜索标题、记录或资料', 'Search titles, notes, or resources')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="filter-row" aria-label={t('任务状态', 'Task status')}>
        {(['all', 'active', 'paused', 'completed', 'archived'] as const).map((status) => (
          <button
            key={status}
            className={filter === status ? 'selected' : ''}
            aria-pressed={filter === status}
            onClick={() => setFilter(status)}
          >
            {status === 'all' ? t('全部', 'All') : statusLabel(status)}
          </button>
        ))}
      </div>
      {!tasks.length && (
        <Empty
          title={
            query ? t('没有找到匹配的记录', 'No matching records') : t('这里还没有任务', 'No tasks here yet')
          }
        >
          <p>
            {query
              ? t('换一个词试试。', 'Try another word.')
              : t('先从想做的一件事开始。', 'Start with one thing you want to do.')}
          </p>
        </Empty>
      )}
      <ul className="task-list">
        {tasks.map((task) => (
          <li key={task.id}>
            <button className="task-list-main" onClick={() => onSelect(task.id)}>
              <div className="task-list-meta">
                <span className={`status-dot ${task.status}`} />
                <span>{statusLabel(task.status)}</span>
                {task.isExample && <span className="badge">{t('示例', 'Example')}</span>}
              </div>
              <h2>{task.title}</h2>
              <p>{task.nextStep || task.progress || t('还没有记录下一步', 'No next step recorded yet')}</p>
              <time>
                {t('更新于 ', 'Updated ')}
                {date(task.updatedAt)}
              </time>
            </button>
            <div className="task-list-actions">
              <button
                className="icon-button"
                aria-label={t('重命名任务：', 'Rename task: ') + task.title}
                onClick={() => {
                  setRenaming(task);
                  setTitle(task.title);
                }}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon-button"
                aria-label={
                  (task.status === 'archived'
                    ? t('取消归档：', 'Unarchive: ')
                    : t('归档任务：', 'Archive task: ')) + task.title
                }
                onClick={() =>
                  void run(() =>
                    repo.setTaskStatus(task.id, task.status === 'archived' ? 'paused' : 'archived'),
                  )
                }
              >
                <Archive size={16} />
              </button>
              <button
                className="icon-button"
                aria-label={t('永久删除任务：', 'Permanently delete task: ') + task.title}
                onClick={() => setDeleting(task)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {renaming && (
        <Modal title={t('修改任务名称', 'Rename task')} onClose={() => setRenaming(null)} busy={busy}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              if (await run(() => repo.updateTask(renaming.id, { title: title.trim() }, renaming.revision)))
                setRenaming(null);
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
              />
            </label>
            <div className="actions">
              <button className="primary" disabled={busy || !title.trim()}>
                {t('保存修改', 'Save changes')}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Confirm
          title={t('永久删除这个任务？', 'Permanently delete this task?')}
          description={t(
            `“${deleting.title}”的记录、资料和历史现场都会删除，无法撤销。`,
            `Notes, resources, and checkpoints for “${deleting.title}” will be deleted. This cannot be undone.`,
          )}
          label={t('永久删除', 'Delete permanently')}
          busy={busy}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            setBusy(true);
            if (await run(() => repo.deleteTask(deleting.id), t('任务已删除', 'Task deleted')))
              setDeleting(null);
            setBusy(false);
          }}
        />
      )}
    </div>
  );
}
