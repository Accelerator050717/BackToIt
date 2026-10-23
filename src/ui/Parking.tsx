import { useState } from 'react';
import { ChevronDown, Check, Pencil, Trash2, ArrowUpRight } from 'lucide-react';
import type { ParkingItem } from '../domain/types';
import { repo } from '../storage/repository';
import { useText } from './i18n';
import { Modal } from './primitives';
import type { Run } from './Resources';

export function Parking({
  items,
  run,
  onConvert,
}: {
  items: ParkingItem[];
  run: Run;
  onConvert: (id: string) => Promise<void>;
}) {
  const { t, number } = useText();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<ParkingItem | null>(null);
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <section className="parking">
      <button className="parking-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>
          {t('先放这里', 'Set it aside')}{' '}
          <span className="count">{number(items.filter((item) => !item.done).length)}</span>
        </span>
        <ChevronDown size={18} className={open ? 'rotated' : ''} />
      </button>
      {open && (
        <div className="parking-body">
          <p className="muted tiny">
            {t(
              '突然想到的事，先留一句。然后接着做。',
              'Leave a thought here. Then return to what you were doing.',
            )}
          </p>
          <form
            className="parking-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              if (await run(() => repo.addParking(text.trim()), t('已放在这里', 'Thought saved')))
                setText('');
              setBusy(false);
            }}
          >
            <label className="sr-only" htmlFor="parking-thought">
              {t('暂存想法', 'Thought to set aside')}
            </label>
            <input
              id="parking-thought"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              placeholder={t('之后再想的一件事…', 'Something for later…')}
            />
            <button className="secondary" disabled={!text.trim() || busy}>
              {t('放下', 'Save')}
            </button>
          </form>
          <ul className="parking-list">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  className={`check-button ${item.done ? 'checked' : ''}`}
                  aria-label={
                    (item.done
                      ? t('标记未完成：', 'Mark incomplete: ')
                      : t('完成想法：', 'Complete thought: ')) + item.text
                  }
                  onClick={() => void run(() => repo.updateParking(item.id, { done: !item.done }))}
                >
                  {item.done && <Check size={15} />}
                </button>
                <span className={item.done ? 'done' : ''}>{item.text}</span>
                <div className="parking-controls">
                  <button
                    className="icon-button"
                    aria-label={t('编辑想法：', 'Edit thought: ') + item.text}
                    onClick={() => {
                      setEditing(item);
                      setEditText(item.text);
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={t('转成新任务：', 'Turn into a task: ') + item.text}
                    onClick={() => void run(() => onConvert(item.id))}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={t('删除想法：', 'Delete thought: ') + item.text}
                    onClick={() => void run(() => repo.deleteParking(item.id))}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {editing && (
        <Modal title={t('编辑想法', 'Edit thought')} onClose={() => setEditing(null)} busy={busy}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              if (await run(() => repo.updateParking(editing.id, { text: editText.trim() })))
                setEditing(null);
              setBusy(false);
            }}
          >
            <label>
              {t('暂存想法', 'Thought to set aside')}
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                maxLength={2000}
                rows={3}
                required
                autoFocus
              />
            </label>
            <div className="actions">
              <button className="primary" disabled={busy || !editText.trim()}>
                {t('保存修改', 'Save changes')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
