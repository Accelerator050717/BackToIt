import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  CirclePause,
  CornerDownLeft,
  Minus,
  SlidersHorizontal,
  VolumeX,
  X,
} from 'lucide-react';
import {
  durations,
  remainingSeconds,
  returnKind,
  type Action,
  type DemoTask,
  type Duration,
  type Language,
  type Mode,
  type State,
} from './model';
import { usePrototypeStore } from './store';

type Text = (zh: string, en: string) => string;
type Perform = (action: Action) => Promise<boolean>;
const copy =
  (language: Language): Text =>
  (zh, en) =>
    language === 'zh-CN' ? zh : en;
function Mark() {
  return (
    <svg className="dt-mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M9 12h11c7 0 11 4 11 11v4M39 36H28c-7 0-11-4-11-11v-4"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="m12 25 5-5 5 5M26 23l5 5 5-5"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      className={secondary ? 'dt-button dt-secondary' : 'dt-button dt-primary'}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function DurationOptions({
  value,
  onChange,
  t,
  disabled = false,
  label,
}: {
  value: Duration;
  onChange: (value: Duration) => void;
  t: Text;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <fieldset className="dt-duration">
      <legend>{label ?? t('这一段的时间上限', 'A time boundary for this break')}</legend>
      <div>
        {durations.map((duration) => (
          <label key={duration} className={value === duration ? 'dt-selected' : ''}>
            <input
              type="radio"
              name={label ? 'extension-duration' : 'duration'}
              value={duration}
              checked={value === duration}
              onChange={() => onChange(duration)}
              disabled={disabled}
            />
            <span>
              {duration}
              <small>{t(' 秒', ' sec')}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
function SavedStep({ task, t, compact = false }: { task: DemoTask; t: Text; compact?: boolean }) {
  return (
    <section
      className={`dt-saved-step ${compact ? 'dt-compact' : ''}`}
      aria-label={t('原始下一步', 'Original next step')}
    >
      <div>
        <Bookmark size={15} />
        <span>{t('你原来留下的下一步', 'The next step you left for yourself')}</span>
      </div>
      {task.nextStep.trim() ? (
        <blockquote>{task.nextStep}</blockquote>
      ) : (
        <p className="dt-missing">{t('还没有记录下一步。', 'No next step recorded yet.')}</p>
      )}
    </section>
  );
}
function TaskBadge({ t }: { t: Text }) {
  return <span className="dt-badge">{t('演示样例', 'Demo example')}</span>;
}

export function App() {
  const store = usePrototypeStore();
  const state = store.state;
  const t = copy(state?.language ?? 'zh-CN');
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const perform: Perform = async (action) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await store.dispatch(action);
      if (result) setNotice('');
      return result;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!state) return;
    document.documentElement.lang = state.language;
    document.documentElement.dataset.reduced = String(state.reducedMotion);
    document.title = t('歇一下 · 接着来研究原型', 'Detour · BackToIt research prototype');
  }, [state?.language, state?.reducedMotion]);
  useEffect(() => {
    if (state?.phase !== 'rest') return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [state?.phase, state?.session?.id]);
  useEffect(() => {
    if (state?.phase === 'rest' && state.session && now >= state.session.deadline)
      void store.dispatch({ type: 'tick', id: state.session.id });
  }, [now, state?.phase, state?.session?.id]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [state?.phase]);
  if (!state)
    return (
      <main className="dt-load">
        <Mark />
        <h1>{t('接着来研究原型', 'BackToIt research prototype')}</h1>
        {store.error ? (
          <>
            <p role="alert">
              {t(
                '无法读取原型样例。现有内容没有被自动清空。',
                'Prototype data could not be read. Existing content was not automatically cleared.',
              )}
            </p>
            <Button secondary onClick={() => store.refresh()}>
              {t('重试读取', 'Retry reading')}
            </Button>
            <button className="dt-link" onClick={() => setResetOpen(true)}>
              {t('重置原型样例', 'Reset prototype examples')}
            </button>
            {resetOpen && (
              <ResetDialog
                t={t}
                onClose={() => setResetOpen(false)}
                onReset={() =>
                  void store.resetCorrupt().then((ok) => {
                    if (ok) setResetOpen(false);
                  })
                }
              />
            )}
          </>
        ) : (
          <p>{t('正在读取本机样例…', 'Loading the local example…')}</p>
        )}
      </main>
    );
  const session = state.session;
  const kind = returnKind(state);
  const resume = async () => {
    if (await perform({ type: 'resume' }))
      setNotice(
        t(
          '已回到示例恢复卡。这不代表已经真正开始现实任务。',
          'You are back at the demo recovery card. This does not mean you have started the real task.',
        ),
      );
  };
  return (
    <div className="dt-app">
      <div className="dt-prototype-strip">
        <span>{t('研究原型 · 非正式扩展', 'Research prototype · not the extension')}</span>
        <span>{t('仅本机样例', 'Local examples only')}</span>
      </div>
      <header className="dt-header">
        <div className="dt-brand">
          <Mark />
          <span>{t('接着来', 'BackToIt')}</span>
        </div>
        <label className="dt-language">
          <span className="dt-sr-only">{t('界面语言', 'Interface language')}</span>
          <select
            value={state.language}
            onChange={(event) => void perform({ type: 'language', language: event.target.value as Language })}
          >
            <option value="zh-CN">中文</option>
            <option value="en">English</option>
          </select>
        </label>
      </header>
      <div className="dt-layout">
        <aside className="dt-side-note">
          <p>{t('不是每一次离开，\n都需要一个新去处。', 'Not every pause\nneeds somewhere new to go.')}</p>
          <span>
            {t(
              '这里在比较三种小小的岔路，\n终点都是你自己选的下一步。',
              'Three small detours to compare.\nEach leads back to your own next step.',
            )}
          </span>
          <div className="dt-side-line" />
        </aside>
        <main className="dt-main">
          {store.error && (
            <div className="dt-alert" role="alert">
              <p>
                {store.error === 'conflict'
                  ? t(
                      '另一窗口已经保存新记录。这次保存被阻止；你的草稿仍保留在研究设置中。',
                      'Another window saved newer notes. This save was blocked; your draft remains in research settings.',
                    )
                  : t(
                      '这次操作没有保存。原型可能无法使用本地存储，或样例已损坏。请重试；不会清空扩展数据。',
                      'This change was not saved. Prototype storage may be unavailable or damaged. Retry; extension data will not be cleared.',
                    )}
              </p>
              <button className="dt-link" onClick={() => store.refresh()}>
                {t('重新读取', 'Read again')}
              </button>
            </div>
          )}
          {store.remote && (
            <div className="dt-info" role="status">
              <p>{t('已接到另一个原型窗口的更新。', 'Updated from another prototype window.')}</p>
              <button
                className="dt-icon"
                aria-label={t('关闭提示', 'Dismiss notice')}
                onClick={store.dismissRemote}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="dt-info" role="status">
              <p>{notice}</p>
              <button
                className="dt-icon"
                aria-label={t('关闭提示', 'Dismiss notice')}
                onClick={() => setNotice('')}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {state.phase === 'resume' && (
            <>
              <div className="dt-task-heading">
                <div className="dt-meta">
                  <span className="dt-dot" />
                  {t('留在这里的事', 'Right where you left it')}
                  <TaskBadge t={t} />
                </div>
                <h1 ref={heading} tabIndex={-1}>
                  {state.task?.title ?? t('先选一件想回来的事。', 'Choose something to return to.')}
                </h1>
                <p className="dt-muted">
                  {state.task
                    ? t(
                        '不用重新开始，从这一小步接上。',
                        'No need to start over. Pick up this small next step.',
                      )
                    : t(
                        '没有当前任务时，也可以休息。这里不会替你猜一个。',
                        'You can rest without a task. The prototype will not invent one for you.',
                      )}
                </p>
              </div>
              {state.task ? (
                <>
                  <SavedStep task={state.task} t={t} />
                  {state.task.status === 'archived' ? (
                    <>
                      <p className="dt-state-note">
                        {t(
                          '此示例任务已归档，不会自动重新激活。',
                          'This example is archived. It will not be reopened automatically.',
                        )}
                      </p>
                      <Button onClick={() => void perform({ type: 'reopen' })}>
                        {t('重新打开此示例任务', 'Reopen this example')}
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => void resume()} disabled={busy}>
                      {t('接着做', 'Continue')}
                      <ArrowRight size={19} />
                    </Button>
                  )}
                  {!state.task.nextStep.trim() && (
                    <button className="dt-link" onClick={() => setResearchOpen(true)}>
                      {t('在研究设置中留一个下一步', 'Leave a next step in research settings')}
                    </button>
                  )}
                </>
              ) : (
                <Button onClick={() => void perform({ type: 'scenario', scenario: 'normal' })}>
                  {t('载入一个演示任务', 'Load an example task')}
                </Button>
              )}
              <div className="dt-detour-invitation">
                <p>{t('此刻想离开一下？', 'Feel like stepping away?')}</p>
                <button
                  className="dt-link"
                  onClick={() => void perform({ type: 'navigate', phase: 'choose' })}
                >
                  <CirclePause size={17} />
                  {t('歇一下', 'Take a detour')}
                  <ArrowRight size={15} />
                </button>
              </div>
              <button
                className="dt-parking-entry"
                onClick={() => void perform({ type: 'navigate', phase: 'parking' })}
              >
                <span>
                  {t('先放这里', 'Set it aside')}{' '}
                  <small>{new Intl.NumberFormat(state.language).format(state.parking.length)}</small>
                </span>
                <ChevronDown size={17} />
              </button>
            </>
          )}
          {state.phase === 'choose' && (
            <>
              <Back t={t} onClick={() => void perform({ type: 'navigate', phase: 'resume' })} />
              <h1 ref={heading} tabIndex={-1}>
                {t('歇一下，然后自己决定。', 'A small detour. Your choice after.')}
              </h1>
              <p className="dt-intro">
                {t(
                  '没有自动播放，也不用完成什么才准回来。',
                  'Nothing autoplays. You do not have to finish anything to return.',
                )}
              </p>
              <div className="dt-mode-list" role="group" aria-label={t('比较体验', 'Compare experiences')}>
                <ModeOption
                  mode="quiet"
                  selected={state.selectedMode}
                  onSelect={(mode) => void perform({ type: 'mode', mode })}
                  t={t}
                />
                <ModeOption
                  mode="lines"
                  selected={state.selectedMode}
                  onSelect={(mode) => void perform({ type: 'mode', mode })}
                  t={t}
                />
                <ModeOption
                  mode="direct"
                  selected={state.selectedMode}
                  onSelect={(mode) => void perform({ type: 'mode', mode })}
                  t={t}
                />
              </div>
              {state.selectedMode !== 'direct' && (
                <>
                  <DurationOptions
                    value={state.selectedDuration}
                    onChange={(duration) => void perform({ type: 'duration', duration })}
                    t={t}
                  />
                  <p className="dt-fine">
                    {t(
                      '45 / 90 / 180 秒都是研究候选。默认 90 秒只是本轮假设，不是科学规定。',
                      '45 / 90 / 180 seconds are research candidates. The 90-second default is a hypothesis, not a scientific prescription.',
                    )}
                  </p>
                </>
              )}
              <Button
                disabled={busy}
                onClick={() => void perform({ type: 'start', id: crypto.randomUUID() })}
              >
                {state.selectedMode === 'direct'
                  ? t('只留一句，看看下一步', 'Leave a thought, see the next step')
                  : t('开始这一段', 'Start this break')}
                <ArrowRight size={18} />
              </Button>
              <p className="dt-fine dt-center">
                {t('随时提前结束，不自动延长。', 'End early whenever you like. No automatic extensions.')}
              </p>
            </>
          )}
          {state.phase === 'rest' && session && (
            <Rest state={state} now={now} busy={busy} t={t} perform={perform} headingRef={heading} />
          )}
          {state.phase === 'return' && session && (
            <>
              <div className="dt-end-mark">
                <Check size={20} />
              </div>
              <h1 ref={heading} tabIndex={-1}>
                {session.endedBy === 'elapsed'
                  ? t('这一段，到这里了。', 'This break has reached its end.')
                  : session.endedBy === 'interaction'
                    ? t('三段线，接到终点了。', 'Three pieces. One endpoint.')
                    : session.endedBy === 'direct'
                      ? t('先放下，再看下一步。', 'Set it aside. See the next step.')
                      : t('可以在这里停下来。', 'You can stop right here.')}
              </h1>
              <p className="dt-intro">{t('接不接着做，由你决定。', 'Whether to continue is up to you.')}</p>
              {kind === 'unavailable' ? (
                <div className="dt-no-task">
                  <h2>{t('没有可返回的原任务。', 'The original task is unavailable.')}</h2>
                  <p>
                    {t(
                      '它可能已被删除，或这段休息开始时没有任务。不会自动换到另一件事。',
                      'It may have been removed, or this break began without a task. The prototype will not switch to another task.',
                    )}
                  </p>
                  <Button secondary onClick={() => void perform({ type: 'navigate', phase: 'resume' })}>
                    {t('回到示例任务卡', 'Back to the demo task card')}
                  </Button>
                </div>
              ) : (
                session.snapshot && (
                  <div className="dt-return-card">
                    <div className="dt-meta">
                      <TaskBadge t={t} />
                      <span>{t('这段休息关联的任务', 'The task linked to this break')}</span>
                    </div>
                    <h2>{session.snapshot.title}</h2>
                    <SavedStep task={session.snapshot} t={t} compact />
                    {kind === 'archived' ? (
                      <>
                        <p className="dt-state-note">
                          {t(
                            '这件事已在另一个操作中归档。先确认是否重新打开。',
                            'This task has been archived. Choose whether to reopen it first.',
                          )}
                        </p>
                        <Button secondary onClick={() => void perform({ type: 'reopen' })}>
                          {t('重新打开此示例任务', 'Reopen this example')}
                        </Button>
                      </>
                    ) : kind === 'changed' ? (
                      <>
                        <p className="dt-state-note">
                          {t(
                            '这件事的记录已改变。上方是休息开始时留下的原文，不会静默换掉。',
                            'The task has changed. Above is the original text saved when the break began; it is not silently replaced.',
                          )}
                        </p>
                        <Button secondary onClick={() => void perform({ type: 'refresh-return' })}>
                          {t('查看同一任务的最新记录', 'Review this task’s latest notes')}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button onClick={() => void resume()} disabled={busy}>
                          {t('接着做', 'Continue')}
                          <ArrowRight size={18} />
                        </Button>
                        <p className="dt-fine">
                          {kind === 'empty-next'
                            ? t(
                                '没有原始下一步；回到卡片后可以先写一个小动作。',
                                'No original next step is saved. You can write one small action on the task card.',
                              )
                            : t(
                                '只返回示例恢复卡，不代表已经真实开始学习。',
                                'Returns to the demo recovery card; it does not prove learning has begun.',
                              )}
                        </p>
                      </>
                    )}
                  </div>
                )
              )}
              <Extension state={state} t={t} perform={perform} busy={busy} />
              <button className="dt-link dt-leave" onClick={() => void perform({ type: 'done' })}>
                {t('今天先到这里', 'Leave it here for today')}
              </button>
            </>
          )}
          {state.phase === 'parking' && (
            <Parking state={state} t={t} perform={perform} busy={busy} headingRef={heading} />
          )}
          {state.phase === 'done' && (
            <>
              <div className="dt-quiet-art dt-finished" aria-hidden="true">
                <span />
                <i />
              </div>
              <h1 ref={heading} tabIndex={-1}>
                {t('今天先到这里。', 'Leave it here for today.')}
              </h1>
              <p className="dt-intro">
                {t(
                  '示例任务和原来的下一步还在。\n不用现在决定什么时候回来。',
                  'Your example task and its next step are still here.\nYou do not need to decide when to return.',
                )}
              </p>
              <Button secondary onClick={() => void perform({ type: 'navigate', phase: 'resume' })}>
                {t('回到示例恢复卡', 'Back to the demo recovery card')}
              </Button>
              <p className="dt-fine">
                {t('没有记为失败，没有提醒或倒计时。', 'No failure recorded. No reminder or countdown.')}
              </p>
            </>
          )}
          <footer className="dt-footer">
            <span>
              <VolumeX size={14} />
              {t('无声音', 'No sound')}
            </span>
            <button
              className="dt-link"
              aria-expanded={researchOpen}
              onClick={() => setResearchOpen(!researchOpen)}
            >
              <SlidersHorizontal size={14} />
              {t('研究设置', 'Research settings')}
            </button>
          </footer>
          {researchOpen && (
            <Research state={state} t={t} perform={perform} onReset={() => setResetOpen(true)} />
          )}
          <p className="dt-disclaimer">
            {t(
              '仅比较交互，不监测手机或网页，也不记录使用事件。',
              'Interaction comparison only. No phone or webpage monitoring, and no usage-event tracking.',
            )}
          </p>
        </main>
        <aside className="dt-study-note">
          <span>{t('本轮比较', 'In this study')}</span>
          <p>{t('少一点内容，\n会不会更容易回来？', 'Could less content\nmake returning easier?')}</p>
          <small>{t('尚无用户试验结论。', 'No user-test conclusion yet.')}</small>
        </aside>
      </div>
      {resetOpen && (
        <ResetDialog
          t={t}
          onClose={() => setResetOpen(false)}
          onReset={() =>
            void perform({ type: 'reset' }).then((ok) => {
              if (ok) setResetOpen(false);
            })
          }
        />
      )}
    </div>
  );
}

function Back({ t, onClick }: { t: Text; onClick: () => void }) {
  return (
    <button className="dt-link dt-back" onClick={onClick}>
      <ArrowLeft size={16} />
      {t('回到任务卡', 'Back to the task card')}
    </button>
  );
}
function ModeOption({
  mode,
  selected,
  onSelect,
  t,
}: {
  mode: Mode;
  selected: Mode;
  onSelect: (mode: Mode) => void;
  t: Text;
}) {
  const title =
    mode === 'quiet'
      ? t('留一点空白', 'Leave some space')
      : mode === 'lines'
        ? t('把三段线接起来', 'Connect three line pieces')
        : t('只留一句，直接回来', 'One thought, straight back');
  const description =
    mode === 'quiet'
      ? t(
          '不提供新内容。可以看远一点，也可以什么都不做。',
          'No new content. Look away, or do nothing at all.',
        )
      : mode === 'lines'
        ? t(
            '最多三个动作，有明确终点。用来比较互动是否增加负担。',
            'At most three actions, with a clear endpoint. Compare whether interaction adds effort.',
          )
        : t(
            '暂存想离开的念头，直接看回原来的下一步。',
            'Set the thought aside, then see your original next step.',
          );
  return (
    <button
      className={`dt-mode ${selected === mode ? 'dt-mode-selected' : ''}`}
      aria-pressed={selected === mode}
      onClick={() => onSelect(mode)}
    >
      <span className="dt-mode-symbol" aria-hidden="true">
        {mode === 'quiet' ? (
          <Minus size={25} />
        ) : mode === 'lines' ? (
          <LineArt step={1} />
        ) : (
          <CornerDownLeft size={23} />
        )}
      </span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span className="dt-mode-letter">{mode === 'quiet' ? 'C' : mode === 'lines' ? 'B' : 'D'}</span>
    </button>
  );
}
function LineArt({ step }: { step: number }) {
  return (
    <svg className="dt-line-art" viewBox="0 0 280 90" fill="none" aria-hidden="true">
      <path d="M15 65H70Q90 65 90 45V25" className={step >= 1 ? 'dt-connected' : ''} />
      <path d="M110 25V45Q110 65 130 65H155" className={step >= 2 ? 'dt-connected' : ''} />
      <path d="M175 65H195Q215 65 215 45V25H265" className={step >= 3 ? 'dt-connected' : ''} />
      <circle cx="15" cy="65" r="4" />
      <circle cx="265" cy="25" r="4" />
    </svg>
  );
}
function Rest({
  state,
  now,
  busy,
  t,
  perform,
  headingRef,
}: {
  state: State;
  now: number;
  busy: boolean;
  t: Text;
  perform: Perform;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const session = state.session!;
  const [showTime, setShowTime] = useState(false);
  const remaining = remainingSeconds(session, now);
  return (
    <>
      <div className="dt-rest-meta">
        <span>
          {session.extensions
            ? t('额外这一段', 'This extra break')
            : t('自己选的一小段', 'A small break you chose')}
        </span>
        <button className="dt-link" onClick={() => setShowTime(!showTime)} aria-expanded={showTime}>
          {showTime ? t('隐藏剩余时间', 'Hide time remaining') : t('查看剩余时间', 'Show time remaining')}
        </button>
      </div>
      <h1 ref={headingRef} tabIndex={-1}>
        {session.mode === 'quiet'
          ? t('这里，什么都不用接。', 'Nothing to keep up with here.')
          : t('三段线，只接这一轮。', 'Three pieces. Just this one round.')}
      </h1>
      {session.mode === 'quiet' ? (
        <>
          <p className="dt-intro">
            {t(
              '把目光放远一点，或只是留一点空白。\n不需要跟着节拍，也没有标准做法。',
              'Look a little farther away, or leave some space.\nNo rhythm to follow. No right way to do this.',
            )}
          </p>
          <div className="dt-quiet-art" aria-hidden="true">
            <span />
            <i />
          </div>
        </>
      ) : (
        <>
          <p className="dt-intro">
            {t(
              '按一下，接上一段。三段后就到终点。\n不计分，也不用等时间走完。',
              'One press connects one piece. Three pieces reach the end.\nNo score, and no need to wait for the timer.',
            )}
          </p>
          <div className="dt-interaction">
            <LineArt step={session.step} />
            <p className="dt-fine">
              {t(`下一段：${session.step + 1} / 3`, `Next piece: ${session.step + 1} of 3`)}
            </p>
            <Button
              secondary
              disabled={busy}
              onClick={() => void perform({ type: 'interact', id: session.id })}
            >
              {t('接上这一段', 'Connect this piece')}
            </Button>
          </div>
        </>
      )}
      <div className="dt-time" aria-live="off">
        {showTime ? (
          <>
            <span>{t('剩余上限', 'Time remaining')}</span>
            <time>
              {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
            </time>
          </>
        ) : (
          <span>
            {t(`这一段最多 ${session.duration} 秒`, `This break lasts at most ${session.duration} seconds`)}
          </span>
        )}
      </div>
      <Button disabled={busy} onClick={() => void perform({ type: 'end', id: session.id })}>
        {t('现在结束，看看下一步', 'End now and see the next step')}
        <ArrowRight size={18} />
      </Button>
      <button className="dt-link dt-leave" onClick={() => void perform({ type: 'done' })}>
        {t('今天先到这里', 'Leave it here for today')}
      </button>
      <p className="dt-fine dt-center">
        {t(
          '到点后停在返回卡，不自动开始下一轮。关闭后重新打开会按时间戳恢复。',
          'At the boundary, the return card stays. No new round starts. Reopening restores the timestamp-based state.',
        )}
      </p>
    </>
  );
}
function Extension({ state, t, perform, busy }: { state: State; t: Text; perform: Perform; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState<Duration>(90);
  if (!state.session || state.session.mode === 'direct') return null;
  if (state.session.extensions === 1)
    return (
      <p className="dt-fine dt-extension-limit">
        {t(
          '这次比较已延长过一段。需要更久，可以离开屏幕休息；不用留在原型里。',
          'This comparison has already had one extra break. If you need longer, you can leave the screen; there is no need to stay in the prototype.',
        )}
      </p>
    );
  return (
    <div className="dt-extension">
      <button className="dt-link" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t('再休息一会儿', 'Rest a little longer')}
        <ChevronDown size={16} />
      </button>
      {open && (
        <div>
          <DurationOptions
            value={duration}
            onChange={setDuration}
            t={t}
            label={t('新一段的明确上限', 'A clear boundary for the extra break')}
          />
          <p className="dt-fine">
            {t(
              '这次最多再加一段，由你点选后开始。不会自动循环。',
              'One extra break for this visit, started only by your choice. It will not loop.',
            )}
          </p>
          <Button
            secondary
            disabled={busy}
            onClick={() => void perform({ type: 'extend', duration, id: crypto.randomUUID() })}
          >
            {t(`明确再歇 ${duration} 秒`, `Start ${duration} more seconds`)}
          </Button>
        </div>
      )}
    </div>
  );
}
function Parking({
  state,
  t,
  perform,
  busy,
  headingRef,
}: {
  state: State;
  t: Text;
  perform: Perform;
  busy: boolean;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const [text, setText] = useState('');
  return (
    <>
      <Back t={t} onClick={() => void perform({ type: 'navigate', phase: 'resume' })} />
      <h1 ref={headingRef} tabIndex={-1}>
        {t('这个念头，先放这里。', 'Leave that thought here.')}
      </h1>
      <p className="dt-intro">
        {t(
          '不加新内容，也不设等待。写一句就够，留空也可以。',
          'No new content, and no waiting. One sentence is enough; you can also leave it blank.',
        )}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void perform({ type: 'park', text, id: crypto.randomUUID() });
        }}
      >
        <label className="dt-field">
          {t('刚才想去做什么？（可选样例）', 'What were you about to do? (optional example)')}
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={240}
            rows={3}
            placeholder={t('比如：想去看一个 B 站视频', 'For example: wanted to open a video')}
          />
        </label>
        <Button type="submit" disabled={busy}>
          {text.trim()
            ? t('先暂存，看看下一步', 'Set it aside and see the next step')
            : t('不填了，直接看下一步', 'Skip this and see the next step')}
          <ArrowRight size={18} />
        </Button>
      </form>
      {state.parking.length > 0 && (
        <details className="dt-parked">
          <summary>
            {t('原型里暂存的想法', 'Thoughts saved in this prototype')} ({state.parking.length})
          </summary>
          <ul>
            {state.parking.map((thought, index) => (
              <li key={`${index}-${thought}`}>
                <span>{thought}</span>
                <button
                  className="dt-icon"
                  aria-label={t('删除想法：', 'Delete thought: ') + thought}
                  onClick={() => void perform({ type: 'delete-thought', index })}
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="dt-fine">
        {t(
          '只保留最多 12 条原型样例；不自动变成任务。请勿填写私人资料。',
          'Keeps up to 12 prototype examples. They do not become tasks automatically. Please do not enter private information.',
        )}
      </p>
    </>
  );
}
function Research({
  state,
  t,
  perform,
  onReset,
}: {
  state: State;
  t: Text;
  perform: Perform;
  onReset: () => void;
}) {
  const [title, setTitle] = useState(state.task?.title ?? '');
  const [next, setNext] = useState(state.task?.nextStep ?? '');
  const [baseRevision, setBaseRevision] = useState(state.task?.revision ?? 0);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (dirty && state.task) return;
    setTitle(state.task?.title ?? '');
    setNext(state.task?.nextStep ?? '');
    setBaseRevision(state.task?.revision ?? 0);
    if (!state.task) setDirty(false);
  }, [state.task?.revision, state.task?.id, dirty]);
  const changed = dirty && state.task?.revision !== baseRevision;
  return (
    <section className="dt-research" aria-label={t('研究设置', 'Research settings')}>
      <h2>{t('研究设置 / 边界状态', 'Research settings / edge cases')}</h2>
      <p className="dt-fine">
        {t(
          '这些控件只修改原型样例。另一页签会同步看到变化；不会读取正式扩展数据。',
          'These controls change only prototype examples. Another tab sees the update; no extension data is read.',
        )}
      </p>
      <label className="dt-field">
        {t('切换示例状态', 'Change the example state')}
        <select
          value={
            !state.task
              ? 'none'
              : state.task.status === 'archived'
                ? 'archived'
                : !state.task.nextStep
                  ? 'empty-next'
                  : 'normal'
          }
          onChange={(event) =>
            void perform({
              type: 'scenario',
              scenario: event.target.value as 'normal' | 'empty-next' | 'archived' | 'none',
            })
          }
        >
          <option value="normal">{t('有任务和原始下一步', 'Task with original next step')}</option>
          <option value="empty-next">{t('有任务，没有下一步', 'Task without a next step')}</option>
          <option value="archived">{t('此任务已归档', 'This task is archived')}</option>
          <option value="none">{t('删除示例任务 / 没有任务', 'Remove example / no task')}</option>
        </select>
      </label>
      <label className="dt-check">
        <input
          type="checkbox"
          checked={state.reducedMotion}
          onChange={(event) => void perform({ type: 'motion', reduced: event.target.checked })}
        />
        <span>{t('减少动画（也遵循系统设置）', 'Reduce motion (also follows the system)')}</span>
      </label>
      <p className="dt-fine">
        {t(
          '声音始终关闭。本原型没有音频、闪烁或连续动画。',
          'Sound is always off. This prototype has no audio, flashing, or continuous animation.',
        )}
      </p>
      {state.task && (
        <details>
          <summary>{t('编辑原始示例文字', 'Edit the original example text')}</summary>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void perform({ type: 'edit-task', title, nextStep: next, expectedRevision: baseRevision }).then(
                (ok) => {
                  if (ok) setDirty(false);
                },
              );
            }}
          >
            <label className="dt-field">
              {t('示例任务名称', 'Example task title')}
              <input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setDirty(true);
                }}
                maxLength={180}
                required
              />
            </label>
            <label className="dt-field">
              {t('示例原始下一步', 'Example original next step')}
              <textarea
                aria-label={t('示例原始下一步', 'Example original next step')}
                value={next}
                onChange={(event) => {
                  setNext(event.target.value);
                  setDirty(true);
                }}
                maxLength={600}
                rows={3}
              />
            </label>
            {changed && (
              <div className="dt-state-note" role="status">
                <p>
                  {t(
                    '另一窗口已经更新了任务。你的草稿留在这里，保存会被阻止，避免覆盖新记录。',
                    'Another window updated this task. Your draft stays here; saving is blocked to protect the newer notes.',
                  )}
                </p>
                <button
                  type="button"
                  className="dt-link"
                  onClick={() => {
                    setDirty(false);
                  }}
                >
                  {t('放弃本地草稿，载入最新记录', 'Discard this draft and load the latest notes')}
                </button>
              </div>
            )}
            <Button secondary type="submit" disabled={!title.trim()}>
              {t('保存示例文字', 'Save example text')}
            </Button>
          </form>
        </details>
      )}
      <button className="dt-link" onClick={onReset}>
        {t('重置原型样例', 'Reset prototype examples')}
      </button>
      <p className="dt-fine">
        {t(
          '完整的试用、证据和决策文档在项目 docs/product。原型不能得知你是否在刷手机，也不能跨设备同步。',
          'Study, evidence, and decision documents are in docs/product. This prototype cannot tell whether you are using your phone and cannot sync across devices.',
        )}
      </p>
    </section>
  );
}
function ResetDialog({ t, onClose, onReset }: { t: Text; onClose: () => void; onReset: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      if (opener.current?.isConnected) opener.current.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dt-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby="reset-title"
    >
      <h2 id="reset-title">{t('重置原型样例？', 'Reset prototype examples?')}</h2>
      <p>
        {t(
          '只清除此网页原型的文字、暂存想法与当前体验。不会访问或修改正式扩展。',
          'Clears only this webpage prototype’s text, thoughts, and current break. It does not access or change the extension.',
        )}
      </p>
      <div>
        <Button secondary onClick={onClose}>
          {t('取消', 'Cancel')}
        </Button>
        <Button onClick={onReset}>{t('确认重置样例', 'Reset the examples')}</Button>
      </div>
    </dialog>
  );
}
