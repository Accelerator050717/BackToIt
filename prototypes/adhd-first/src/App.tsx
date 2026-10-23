import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, Coffee, Leaf, Pencil, Puzzle, X } from 'lucide-react';
import {
  durations,
  remaining,
  returnKind,
  tinySuggestion,
  type Language,
  type Path,
  type Task,
} from './model';
import { useStore } from './store';

function Island({ step }: { step: number }) {
  return (
    <div className={`af-island af-island-${step}`} aria-hidden="true">
      <svg viewBox="0 0 320 230" focusable="false">
        <ellipse cx="160" cy="178" rx="126" ry="32" fill="#d9e9ef" />
        <path
          className="af-piece af-piece-1"
          d="M63 146 Q103 117 155 128 L171 169 Q115 192 63 163Z"
          fill="#3b7165"
        />
        <path
          className="af-piece af-piece-2"
          d="M155 128 Q208 106 253 143 L251 165 Q204 188 171 169Z"
          fill="#edbe75"
        />
        <g className="af-piece af-piece-3">
          <path
            d="M170 139 Q172 99 182 72"
            fill="none"
            stroke="#674b31"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M181 83 Q147 50 131 80 Q155 75 181 91 M182 83 Q207 44 226 75 Q202 74 182 91"
            fill="#3b7165"
          />
        </g>
        <path
          d="M56 198 Q92 206 119 197 M230 198 Q250 203 268 196"
          stroke="#7cabbc"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export default function App() {
  const { state, error, remote, dispatch, refresh, reset, dismissRemote } = useStore();
  const [fallbackLanguage, setFallbackLanguage] = useState<Language>('zh-CN');
  const language = state?.language ?? fallbackLanguage;
  const t = (zh: string, en: string) => (language === 'zh-CN' ? zh : en);
  const [now, setNow] = useState(Date.now());
  const [tiny, setTiny] = useState('');
  const [thought, setThought] = useState('');
  const [edit, setEdit] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStep, setEditStep] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const editTrigger = useRef<HTMLButtonElement | null>(null);
  const session = state?.session;
  const sessionId = session?.id;
  const phase = state?.phase;
  useEffect(() => {
    document.documentElement.lang = language;
    document.title =
      language === 'zh-CN' ? '接着来 · ADHD-first 研究原型' : 'BackToIt · ADHD-first research prototype';
  }, [language]);
  useEffect(() => {
    heading.current?.focus();
  }, [phase]);
  useEffect(() => {
    if (phase === 'start' && state) setTiny(tinySuggestion(state.task, state.language));
    if (phase === 'park') setThought('');
    // A new session creates a suggestion; language changes never replace authored text.
  }, [sessionId]);
  useEffect(() => {
    if (!['quiet', 'spark', 'attempt'].includes(phase ?? '')) return;
    const update = () => {
      setNow(Date.now());
      void dispatch({ type: 'tick' });
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [phase, sessionId, dispatch]);
  useEffect(() => {
    if (edit && !dialog.current?.open) dialog.current?.showModal();
  }, [edit]);
  function closeEditor() {
    dialog.current?.close();
    setEdit(null);
    editTrigger.current?.focus();
  }
  const id = () => crypto.randomUUID();
  const binding = { taskId: state?.task?.id ?? null, revision: state?.task?.revision ?? null };
  const direct = () =>
    void dispatch({ type: 'direct', id: id(), sessionId: session?.id ?? null, ...binding });
  const begin = (path: Path) => void dispatch({ type: 'begin', path, id: id(), ...binding });
  const openEditor = (button: HTMLButtonElement) => {
    if (!state?.task) return;
    editTrigger.current = button;
    setEdit({ ...state.task });
    setEditTitle(state.task.title);
    setEditStep(state.task.nextStep);
  };
  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!edit) return;
    if (
      await dispatch({
        type: 'edit',
        taskId: edit.id,
        expectedRevision: edit.revision,
        title: editTitle,
        nextStep: editStep,
      })
    )
      closeEditor();
  }
  function taskCard(target: Task | null, compact = false) {
    return (
      <section
        className={`af-task ${compact ? 'af-task-compact' : ''}`}
        aria-label={t('原任务现场', 'Original task context')}
      >
        <p className="af-label">{t('演示样例 · 你保存的现场', 'Demo sample · Your saved place')}</p>
        <h2>{target?.title ?? t('还没有选中的任务', 'No task selected')}</h2>
        {target?.status === 'archived' && (
          <p className="af-notice">
            {t('这个样例已归档，不能直接恢复。', 'This sample is archived and cannot be resumed.')}
          </p>
        )}
        <div className="af-next">
          <span>{t('已保存的下一步', 'Saved next step')}</span>
          <p>
            {target?.nextStep ||
              t(
                '还没有下一步。可以在研究设置中补写样例，或先离开。',
                'No saved next step. Add one in research settings, or leave for now.',
              )}
          </p>
        </div>
      </section>
    );
  }
  const header = (
    <header className="af-header">
      <span className="af-brand" aria-label="BackToIt / 接着来">
        <span className="af-brand-mark" aria-hidden="true">
          ↳
        </span>
        <span>{t('接着来', 'BackToIt')}</span>
      </span>
      <button
        className="af-language"
        onClick={() => {
          if (state) void dispatch({ type: 'language', language: language === 'zh-CN' ? 'en' : 'zh-CN' });
          else setFallbackLanguage(language === 'zh-CN' ? 'en' : 'zh-CN');
        }}
      >
        {language === 'zh-CN' ? 'English' : '中文'}
      </button>
    </header>
  );
  if (!state)
    return (
      <div className="af-app">
        {header}
        <main id="main" className="af-shell">
          <p className="af-label">{t('研究原型 · 只用演示样例', 'Research prototype · Demo samples only')}</p>
          <h1 tabIndex={-1} ref={heading}>
            {error
              ? t('样例暂时读不出来', 'Sample data cannot be read')
              : t('正在打开样例', 'Opening the sample')}
          </h1>
          {error && (
            <>
              <p role="alert">
                {t(
                  '存储不可用或内容损坏。原值已保留，没有自动清空。只会重置本原型的样例。',
                  'Storage is unavailable or corrupted. The original value is retained. Reset affects only this prototype.',
                )}
              </p>
              <button
                className="af-primary"
                onClick={() => {
                  if (
                    confirm(
                      t(
                        '只重置这个 ADHD-first 原型的样例？原型中的暂存内容会删除。',
                        'Reset only this ADHD-first prototype? Its parked sample thoughts will be deleted.',
                      ),
                    )
                  )
                    void reset();
                }}
              >
                {t('重置本原型样例', 'Reset this prototype')}
              </button>
              <button onClick={() => refresh()}>{t('重试读取', 'Retry reading')}</button>
            </>
          )}
        </main>
      </div>
    );
  const kind = session ? returnKind(state) : null;
  const seconds = remaining(session ?? null, now);
  const active = !['home', 'done', 'ready'].includes(state.phase);
  const invalid = session && !['ready', 'empty-next'].includes(kind ?? '');
  const returnProblems = (
    <div className="af-notice" role="status">
      <p>
        {kind === 'changed'
          ? t(
              '另一窗口修改了这个任务。先看最新内容，再决定返回；旧的小动作不会替你覆盖它。',
              'This task changed in another window. Review the latest text before returning; the old tiny action will not overwrite it.',
            )
          : kind === 'archived'
            ? t(
                '原任务已归档，不能恢复。请回到任务卡自行选择，不会替你换任务。',
                'The original task is archived. Return to the task card to choose; no replacement is selected for you.',
              )
            : t(
                '原任务已删除或不再是选中的任务。没有可恢复目标，不会打开其他任务。',
                'The original task was deleted or replaced. There is no valid return target; no other task will be opened.',
              )}
      </p>
      {kind === 'changed' && (
        <>
          <p>{state.task?.nextStep || t('最新版本没有下一步。', 'The latest version has no next step.')}</p>
          <button onClick={() => void dispatch({ type: 'refresh-return', id: session!.id })}>
            {t('采用最新现场，重新确认', 'Review and use the latest saved place')}
          </button>
        </>
      )}
      {kind === 'archived' && state.task && (
        <button
          onClick={() =>
            void dispatch({
              type: 'reopen',
              id: session!.id,
              taskId: state.task!.id,
              expectedRevision: state.task!.revision,
            })
          }
        >
          {t('重新打开这个样例，查看返回卡', 'Reopen this sample and review the return card')}
        </button>
      )}
      <button onClick={() => void dispatch({ type: 'home' })}>
        {t('回到任务卡自行选择', 'Return to the task card to choose')}
      </button>
    </div>
  );

  return (
    <div className={`af-app ${state.reducedMotion ? 'af-reduced' : ''}`}>
      <a href="#main" className="af-skip">
        {t('跳到当前一步', 'Skip to the current step')}
      </a>
      {header}
      <div className="af-intro">
        <span>{t('ADHD-first 研究原型', 'ADHD-first research prototype')}</span>
        <p>{t('分心了，也能接着来。', 'A small step back to your task.')}</p>
      </div>
      {error && (
        <div className="af-alert" role="alert">
          {error === 'conflict'
            ? t(
                '样例已在另一窗口变化；没有保存。你的输入仍留在这里，请先查看最新内容。',
                'The sample changed in another window; nothing was saved. Your draft is still here. Review the latest content first.',
              )
            : t(
                '存储失败；这次操作没有保存。请保留输入并重试，或重新读取。',
                'Storage failed; this action was not saved. Keep your draft and retry, or reload the saved state.',
              )}
          <button onClick={() => refresh()}>{t('读取已保存状态', 'Read saved state')}</button>
        </div>
      )}
      {remote && (
        <div className="af-remote" role="status">
          {t(
            '已读取另一窗口的更新。未提交的输入仍保留。',
            'Loaded another window’s update. Your unsubmitted draft is retained.',
          )}
          <button onClick={dismissRemote} aria-label={t('关闭更新提示', 'Dismiss update notice')}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
      <div className={`af-layout ${['home', 'start'].includes(state.phase) ? 'af-home-layout' : ''}`}>
        <main id="main" className="af-shell">
          <p className="af-label">
            {t('只用演示样例 · 不读取正式任务', 'Demo samples only · No real task access')}
          </p>
          {state.phase === 'home' && (
            <>
              <h1 tabIndex={-1} ref={heading}>
                {t('从这一小步接回来', 'Pick up from this small step')}
              </h1>
              {taskCard(state.task)}
              <button
                className="af-primary af-main-resume"
                onClick={direct}
                disabled={!state.task || state.task.status === 'archived'}
              >
                {t('接着做', 'Resume')}
                <ArrowRight size={19} aria-hidden="true" />
              </button>
              <div className="af-home-actions">
                <button className="af-secondary" onClick={() => void dispatch({ type: 'needs' })}>
                  {t('我卡住了', 'I’m stuck')}
                </button>
                <button className="af-plain" onClick={() => begin('park')}>
                  {t('先放这里', 'Park a thought')}
                </button>
              </div>
              <p className="af-footnote">
                {t('没有卡住也可以直接继续，不必先休息。', 'You can continue directly. No break required.')}
              </p>
            </>
          )}
          {state.phase === 'needs' && (
            <>
              <h1 tabIndex={-1} ref={heading}>
                {t('现在需要哪一种帮助？', 'What would help right now?')}
              </h1>
              <p className="af-lead">
                {t('只选现在需要的。不用解释原因。', 'Choose only what you need now. No explanation needed.')}
              </p>
              <div className="af-needs">
                <button onClick={() => begin('start')}>
                  <span className="af-need-icon">
                    <ArrowRight aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{t('开始不了', 'I can’t get started')}</strong>
                    <small>{t('把下一步变小一点', 'Make the next step smaller')}</small>
                  </span>
                </button>
                {state.sparkEnabled && (
                  <button onClick={() => begin('spark')}>
                    <span className="af-need-icon af-spark-icon">
                      <Puzzle aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{t('想刷点别的', 'I want something else')}</strong>
                      <small>
                        {t('拼一座小岛，三片就结束', 'Build a little island. Three pieces, then done.')}
                      </small>
                    </span>
                  </button>
                )}
                <button onClick={() => begin('quiet')}>
                  <span className="af-need-icon">
                    <Coffee aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{t('我真的累了', 'I’m actually tired')}</strong>
                    <small>{t('安静歇一下，不必盯着屏幕', 'A quiet pause. No need to watch.')}</small>
                  </span>
                </button>
              </div>
              <fieldset className="af-duration">
                <legend>{t('休息或拼接的时间上限', 'Time limit for a pause or puzzle')}</legend>
                {durations.map((d) => (
                  <label key={d}>
                    <input
                      type="radio"
                      name="duration"
                      checked={state.duration === d}
                      onChange={() => void dispatch({ type: 'duration', duration: d })}
                    />
                    {d}
                    {t('秒', 's')}
                  </label>
                ))}
              </fieldset>
              <button className="af-plain" onClick={() => begin('park')}>
                {t('突然想到其他事？先放这里', 'Something on your mind? Park a thought')}
              </button>
            </>
          )}
          {state.phase === 'start' && (
            <>
              <h1 tabIndex={-1} ref={heading}>
                {t('先让第一步变小', 'Make the first step smaller')}
              </h1>
              {invalid ? (
                returnProblems
              ) : (
                <>
                  {taskCard(session?.snapshot ?? null, true)}
                  <p className="af-lead">
                    {t(
                      '原来的下一步不变。只试一个你愿意动手的小动作。',
                      'Your saved step stays unchanged. Try one action you are willing to make.',
                    )}
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void dispatch({ type: 'attempt', id: session!.id, text: tiny, timed: false });
                    }}
                  >
                    <label className="af-field">
                      {t('一个最小行动（可以修改）', 'One tiny action (editable)')}
                      <textarea
                        maxLength={180}
                        value={tiny}
                        onChange={(e) => setTiny(e.target.value)}
                        disabled={!state.task?.nextStep.trim()}
                        rows={3}
                      />
                    </label>
                    <p className="af-footnote">
                      {state.task?.nextStep.trim()
                        ? t(
                            '本地规则建议，不是你保存的原文，也不是 AI 判断。',
                            'A local rule suggestion, separate from your saved words. No AI judgement.',
                          )
                        : t(
                            '还没有保存下一步，不能替你编一个。先在研究设置中补写样例。',
                            'No next step is saved. We will not invent one. Add it in research settings first.',
                          )}
                    </p>
                    <button
                      className="af-primary"
                      disabled={!tiny.trim() || !state.task?.nextStep.trim()}
                      type="submit"
                    >
                      {t('先做这一小步', 'Try this small step')}
                      <ArrowRight size={18} aria-hidden="true" />
                    </button>
                    <button
                      className="af-secondary"
                      type="button"
                      disabled={!tiny.trim() || !state.task?.nextStep.trim()}
                      onClick={() =>
                        void dispatch({ type: 'attempt', id: session!.id, text: tiny, timed: true })
                      }
                    >
                      {t('自愿试 30 秒', 'Try an optional 30 seconds')}
                    </button>
                  </form>
                </>
              )}
            </>
          )}
          {state.phase === 'attempt' && (
            <>
              <h1 tabIndex={-1} ref={heading}>
                {t('可以把手放回任务上了', 'You can turn back to your task')}
              </h1>
              <div className="af-tiny-action">
                <ArrowRight aria-hidden="true" />
                <p>{session?.tinyAction}</p>
              </div>
              {session?.deadline != null ? (
                <p className="af-clock" aria-live="off">
                  {seconds}
                  {t(' 秒 · 自愿尝试', 's · optional attempt')}
                </p>
              ) : (
                <p className="af-lead">
                  {t('这里没有倒计时。按自己的节奏试试。', 'No timer here. Try it at your own pace.')}
                </p>
              )}
              <p className="af-footnote">
                {t(
                  '点击和计时都不代表你已经动手。可以继续手上的事，或回到任务卡。',
                  'A click or timer does not mean you started. Continue your real action, or return to the task card.',
                )}
              </p>
              <button
                className="af-secondary"
                onClick={() => void dispatch({ type: 'end', id: session!.id })}
              >
                {t('回到返回卡', 'Show the return card')}
              </button>
            </>
          )}
          {state.phase === 'spark' && (
            <>
              <h1 tabIndex={-1} ref={heading}>
                {t('给这座小岛拼上最后三片', 'Give this little island three pieces')}
              </h1>
              <p className="af-lead">
                {t(
                  '每次放一片，三片就结束。没有速度要求。',
                  'Place one piece at a time. Three is the end. No speed required.',
                )}
              </p>
              <Island step={session?.step ?? 0} />
              <p className="af-progress" role="status">
                {t(`已放 ${session?.step ?? 0} / 3 片`, `${session?.step ?? 0} / 3 pieces placed`)}
              </p>
              <button
                className="af-primary af-place"
                onClick={() => void dispatch({ type: 'place', id: session!.id, expectedStep: session!.step })}
              >
                <Puzzle size={18} aria-hidden="true" />
                {t(`放入第 ${(session?.step ?? 0) + 1} 片`, `Place piece ${(session?.step ?? 0) + 1}`)}
              </button>
              <p className="af-clock" aria-live="off">
                {t('最多还剩 ', 'At most ')}
                {seconds}
                {t(' 秒；随时可以返回', 's left; you can return anytime')}
              </p>
              <button className="af-plain" onClick={() => void dispatch({ type: 'end', id: session!.id })}>
                {t('提前结束拼接', 'End the puzzle early')}
              </button>
            </>
          )}
          {state.phase === 'quiet' && (
            <>
              <h1 tabIndex={-1} ref={heading}>
                {t('可以暂时什么都不做', 'You can do nothing for a moment')}
              </h1>
              <div className="af-quiet-art" aria-hidden="true">
                <Leaf size={48} strokeWidth={1.3} />
                <span />
              </div>
              <p className="af-lead">
                {t(
                  '看看远处，或离开屏幕。回来时下一步还在。',
                  'Look away, or leave the screen. Your next step will still be here.',
                )}
              </p>
              <p className="af-clock" aria-live="off">
                {seconds}
                {t(' 秒', 's')}
              </p>
              <p className="af-footnote">
                {t(
                  '不会在浏览器关闭时响铃，也不要求配合呼吸。',
                  'No alarm when the browser is closed. No breathing rhythm required.',
                )}
              </p>
              <button
                className="af-secondary"
                onClick={() => void dispatch({ type: 'end', id: session!.id })}
              >
                {t('提前结束休息', 'End the pause early')}
              </button>
            </>
          )}
          {state.phase === 'park' && (
            <>
              <h1 tabIndex={-1} ref={heading}>
                {t('这件事可以先放这里', 'This thought can wait here')}
              </h1>
              <p className="af-lead">
                {t(
                  '不用现在处理。写一句就好，也可以空着跳过。',
                  'No need to deal with it now. One line, or skip it.',
                )}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void dispatch({ type: 'park', id: session!.id, text: thought });
                }}
              >
                <label className="af-field">
                  {t('想先放下的念头（仅演示）', 'A thought to park (demo only)')}
                  <textarea
                    value={thought}
                    maxLength={240}
                    rows={3}
                    onChange={(e) => setThought(e.target.value)}
                  />
                </label>
                <p className="af-footnote">
                  {t(
                    '只留在此原型，不创建任务，不计时。请勿输入私人内容。',
                    'Stays in this prototype. No new task or timer. Do not enter private content.',
                  )}
                </p>
                <button className="af-primary" type="submit">
                  {thought.trim()
                    ? t('暂存并返回', 'Park and return')
                    : t('不填写，直接返回', 'Skip and return')}
                </button>
              </form>
            </>
          )}
          {state.phase === 'return' && (
            <>
              <h1 tabIndex={-1} ref={heading}>
                {session?.endedBy === 'assembled'
                  ? t('三片齐了，留在这里就好', 'Three pieces. A good place to stop.')
                  : session?.endedBy === 'elapsed'
                    ? t('这一段结束了', 'This moment has ended')
                    : session?.endedBy === 'clock-changed'
                      ? t('设备时间变了，这一段已停止', 'The device clock changed. This moment has stopped.')
                      : t('下一步还在这里', 'Your next step is still here')}
              </h1>
              {invalid ? (
                returnProblems
              ) : (
                <>
                  {taskCard(state.task)}
                  {session?.tinyAction && (
                    <p className="af-footnote">
                      {t('刚才选择的小动作：', 'The tiny action you chose: ')}
                      {session.tinyAction}
                    </p>
                  )}
                  <button className="af-primary" onClick={direct}>
                    {t('接着做', 'Resume')}
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </>
              )}
              {session && ['spark', 'quiet'].includes(session.path) && session.extensions === 0 && (
                <button
                  className="af-secondary"
                  onClick={() =>
                    void dispatch({ type: 'extend', id: id(), sessionId: session.id, duration: 45 })
                  }
                >
                  {t('再安静休息 45 秒（仅一次）', 'Pause quietly for 45s more (once)')}
                </button>
              )}
              {session?.endedBy === 'assembled' && (
                <div className="af-finished-island">
                  <Island step={3} />
                </div>
              )}
              <p className="af-footnote">
                {t(
                  '返回是你的选择，没有完成奖励，也不记失败。',
                  'Returning is your choice. No reward and no failure score.',
                )}
              </p>
            </>
          )}
          {state.phase === 'ready' && (
            <>
              <h1 tabIndex={-1} ref={heading}>
                {t('接回这个任务', 'Back to this task')}
              </h1>
              {invalid ? (
                returnProblems
              ) : (
                <>
                  {taskCard(state.task)}
                  <div className="af-ready">
                    <Check size={21} aria-hidden="true" />
                    <p>
                      {t(
                        '这是样例恢复卡。可以在现实里做下一步了；这里不知道你是否已真正开始。',
                        'This is the sample recovery card. You can take the real action now; this page cannot know whether you started.',
                      )}
                    </p>
                  </div>
                  <p className="af-footnote">
                    {t(
                      '没有真实资料链接，因此不会假装打开课件或另一个应用。',
                      'No real resource link is provided, so no course page or other app is opened.',
                    )}
                  </p>
                </>
              )}
              <button className="af-secondary" onClick={() => void dispatch({ type: 'home' })}>
                {t('回到任务卡', 'Back to the task card')}
              </button>
            </>
          )}
          {state.phase === 'done' && (
            <>
              <h1 tabIndex={-1} ref={heading}>
                {t('今天先到这里，也可以', 'It’s okay to stop here today')}
              </h1>
              <p className="af-lead">
                {t(
                  '样例任务和已保存的下一步都保留。不需要补打卡。',
                  'The sample task and saved step are kept. Nothing to catch up on.',
                )}
              </p>
              <button className="af-primary" onClick={() => void dispatch({ type: 'home' })}>
                {t('看看保留的任务卡', 'See the saved task card')}
              </button>
            </>
          )}
          {active && (
            <nav className="af-exits" aria-label={t('随时离开', 'Leave anytime')}>
              <button className="af-plain" onClick={direct}>
                <ArrowRight size={16} aria-hidden="true" />
                {t('直接接着做', 'Resume directly')}
              </button>
              <button className="af-plain" onClick={() => void dispatch({ type: 'done' })}>
                {t('今天先到这里', 'Stop here today')}
              </button>
            </nav>
          )}
        </main>
        {!['home', 'start'].includes(state.phase) && (
          <aside className="af-context">
            {taskCard(session?.snapshot ?? state.task, true)}
            <p>
              {t(
                '这是你选中样例时保存的下一步。返回前会核对任务是否变化。',
                'The next step saved when you chose this sample. It is checked again before returning.',
              )}
            </p>
          </aside>
        )}
      </div>
      <details className="af-settings">
        <summary>{t('研究设置与暂存样例', 'Research settings and parked samples')}</summary>
        <p>
          {t(
            '仅用于验证，不是诊断问卷。请只编辑合成样例。',
            'For research, not diagnosis. Edit synthetic samples only.',
          )}
        </p>
        <label className="af-check">
          <input
            type="checkbox"
            checked={state.reducedMotion}
            onChange={(e) => void dispatch({ type: 'motion', reduced: e.target.checked })}
          />
          {t('减少动画（也尊重系统设置）', 'Reduce motion (also respects system settings)')}
        </label>
        <label className="af-check">
          <input
            type="checkbox"
            checked={state.sparkEnabled}
            onChange={(e) => void dispatch({ type: 'spark-enabled', enabled: e.target.checked })}
          />
          {t('显示小拼接入口', 'Show the little puzzle option')}
        </label>
        <p className="af-footnote">
          {t('无声音、无通知、无自动追踪。', 'No sound, notifications or automatic tracking.')}
        </p>
        <div className="af-scenarios">
          {(['math', 'writing', 'empty-next', 'archived', 'none'] as const).map((scenario, i) => (
            <button key={scenario} onClick={() => void dispatch({ type: 'scenario', scenario })}>
              {t(
                ['选中数学样例', '选中写作样例', '清空样例下一步', '归档当前样例', '删除当前样例'][i]!,
                [
                  'Select math sample',
                  'Select writing sample',
                  'Clear sample next step',
                  'Archive current sample',
                  'Delete current sample',
                ][i]!,
              )}
            </button>
          ))}
          <button disabled={!state.task} onClick={(e) => openEditor(e.currentTarget)}>
            <Pencil size={15} aria-hidden="true" />
            {t('编辑当前样例', 'Edit current sample')}
          </button>
        </div>
        <h2>{t('先放这里', 'Parked thoughts')}</h2>
        {state.parking.length ? (
          <ul className="af-thoughts">
            {state.parking.map((text, i) => (
              <li key={`${i}-${text}`}>
                <span>{text}</span>
                <button
                  aria-label={t(`删除暂存第 ${i + 1} 条`, `Delete parked thought ${i + 1}`)}
                  onClick={() => void dispatch({ type: 'delete-thought', index: i, expectedText: text })}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('还没有暂存样例。', 'No parked samples yet.')}</p>
        )}
        <button
          onClick={() => {
            if (
              confirm(
                t(
                  '只重置这个 ADHD-first 原型的样例？原型中的暂存内容会删除。',
                  'Reset only this ADHD-first prototype? Its parked sample thoughts will be deleted.',
                ),
              )
            )
              void dispatch({ type: 'reset' });
          }}
        >
          {t('重置本原型样例', 'Reset this prototype')}
        </button>
      </details>
      <footer className="af-footer">
        <p>
          {t(
            '为 ADHD 相关启动与切换困难探索的辅助工具。无需诊断；不是治疗。',
            'Exploring support for ADHD-related starting and switching difficulties. No diagnosis required; not a treatment.',
          )}
        </p>
        <p>
          {t('不知道你是否在刷手机，也不读取其他标签页。', 'Cannot detect phone use or read other tabs.')}
        </p>
      </footer>
      <dialog
        ref={dialog}
        className="af-dialog"
        onCancel={(e) => {
          e.preventDefault();
          closeEditor();
        }}
        aria-labelledby="edit-title"
      >
        <h2 id="edit-title">{t('编辑演示样例', 'Edit the demo sample')}</h2>
        <p>
          {t(
            '只改研究样例，请勿输入私人任务。',
            'Only changes the research sample. Do not enter private tasks.',
          )}
        </p>
        <form onSubmit={saveEdit}>
          <label className="af-field">
            {t('任务名称', 'Task title')}
            <input
              required
              maxLength={180}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
          </label>
          <label className="af-field">
            {t('保存的下一步', 'Saved next step')}
            <textarea
              maxLength={600}
              value={editStep}
              onChange={(e) => setEditStep(e.target.value)}
              rows={4}
            />
          </label>
          {error === 'conflict' && (
            <p role="alert">
              {t(
                '旧草稿未保存，输入仍保留。关闭后查看最新样例，再重新编辑。',
                'The stale draft was not saved. Your input is retained. Close, review the latest sample and edit again.',
              )}
            </p>
          )}
          <div className="af-dialog-actions">
            <button className="af-primary" disabled={!editTitle.trim()} type="submit">
              {t('保存样例', 'Save sample')}
            </button>
            <button type="button" onClick={closeEditor}>
              {t('取消', 'Cancel')}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
