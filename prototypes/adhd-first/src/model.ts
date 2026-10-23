import { z } from 'zod';

export const STORAGE_KEY = 'backtoit:adhd-first-research:v1';
export const LOCK_KEY = 'backtoit-adhd-first-research';
export const durations = [45, 90, 180] as const;
export type Duration = (typeof durations)[number];
export type Language = 'zh-CN' | 'en';
export type Path = 'start' | 'spark' | 'quiet' | 'park' | 'direct';
const taskSchema = z
  .object({
    id: z.string().min(1).max(80),
    title: z.string().min(1).max(180),
    nextStep: z.string().max(600),
    status: z.enum(['paused', 'archived']),
    revision: z.number().int().positive(),
  })
  .strict();
const sessionSchema = z
  .object({
    id: z.string().min(1).max(80),
    path: z.enum(['start', 'spark', 'quiet', 'park', 'direct']),
    taskId: z.string().nullable(),
    snapshot: taskSchema.nullable(),
    startedAt: z.number().nonnegative(),
    deadline: z.number().nonnegative().nullable(),
    duration: z.union([z.literal(0), z.literal(30), z.literal(45), z.literal(90), z.literal(180)]),
    step: z.number().int().min(0).max(3),
    extensions: z.number().int().min(0).max(1),
    tinyAction: z.string().max(180),
    endedBy: z.enum(['none', 'elapsed', 'early', 'assembled', 'parked', 'direct', 'clock-changed']),
  })
  .strict();
export const stateSchema = z
  .object({
    schema: z.literal(1),
    generation: z.string().max(80),
    revision: z.number().int().nonnegative(),
    language: z.enum(['zh-CN', 'en']),
    reducedMotion: z.boolean(),
    sparkEnabled: z.boolean(),
    phase: z.enum(['home', 'needs', 'start', 'spark', 'quiet', 'park', 'attempt', 'return', 'ready', 'done']),
    duration: z.union([z.literal(45), z.literal(90), z.literal(180)]),
    task: taskSchema.nullable(),
    session: sessionSchema.nullable(),
    parking: z.array(z.string().min(1).max(240)).max(12),
  })
  .strict()
  .superRefine((state, ctx) => {
    const s = state.session;
    if (['start', 'spark', 'quiet', 'park', 'attempt', 'return', 'ready'].includes(state.phase) && !s)
      ctx.addIssue({ code: 'custom', message: 'Session required' });
    if (['home', 'needs', 'done'].includes(state.phase) && s)
      ctx.addIssue({ code: 'custom', message: 'Unexpected session' });
    if (
      s &&
      (s.deadline !== (s.duration ? s.startedAt + s.duration * 1000 : null) ||
        s.taskId !== (s.snapshot?.id ?? null))
    )
      ctx.addIssue({ code: 'custom', message: 'Invalid session binding or deadline' });
    if (
      s &&
      ((state.phase === 'spark' && s.path !== 'spark') ||
        (state.phase === 'quiet' && s.path !== 'quiet') ||
        (['start', 'attempt'].includes(state.phase) && s.path !== 'start') ||
        (state.phase === 'park' && s.path !== 'park'))
    )
      ctx.addIssue({ code: 'custom', message: 'Invalid active path' });
    if (
      s &&
      ((['spark', 'quiet'].includes(s.path) && ![45, 90, 180].includes(s.duration)) ||
        (['park', 'direct'].includes(s.path) && s.duration !== 0) ||
        (s.path === 'start' && ![0, 30].includes(s.duration)) ||
        (state.phase === 'spark' && (s.step === 3 || !state.sparkEnabled)))
    )
      ctx.addIssue({ code: 'custom', message: 'Invalid path boundaries' });
    if (
      s &&
      ((state.phase === 'start' && (s.duration !== 0 || s.tinyAction !== '')) ||
        (state.phase === 'attempt' && !s.tinyAction.trim()))
    )
      ctx.addIssue({ code: 'custom', message: 'Invalid tiny action state' });
  });
export type Task = z.infer<typeof taskSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type State = z.infer<typeof stateSchema>;
export function sampleTask(
  language: Language = 'zh-CN',
  kind: 'math' | 'writing' = 'math',
  revision = 1,
  generation = '',
): Task {
  const zh = language === 'zh-CN';
  return {
    id: `${kind === 'math' ? 'demo-parametric' : 'demo-writing'}${generation ? `-${generation}` : ''}`,
    title:
      kind === 'math'
        ? zh
          ? '理解参数方程的切线'
          : 'Understand tangents to parametric curves'
        : zh
          ? '写课程报告的开头'
          : 'Write the opening of a course report',
    nextStep:
      kind === 'math'
        ? zh
          ? '打开例题 2，分别写出 dx/dt 和 dy/dt。'
          : 'Open example 2, then write down dx/dt and dy/dt.'
        : zh
          ? '打开报告草稿，写下这一节最想解释的问题。'
          : 'Open the report draft, then write the question this section should explain.',
    status: 'paused',
    revision,
  };
}
export function initialState(language: Language = 'zh-CN', generation = ''): State {
  return {
    schema: 1,
    generation,
    revision: 0,
    language,
    reducedMotion: false,
    sparkEnabled: true,
    phase: 'home',
    duration: 90,
    task: sampleTask(language, 'math', 1, generation),
    session: null,
    parking: [],
  };
}
export function tinySuggestion(task: Task | null, language: Language): string {
  if (!task?.nextStep.trim() || task.status === 'archived') return '';
  const first = task.nextStep
    .trim()
    .split(/[，,。.!！\n]/)[0]
    ?.trim();
  if (first && first.length <= 120) return first;
  return language === 'zh-CN' ? '先读一遍已保存的下一步。' : 'Read your saved next step once.';
}
export type ReturnKind = 'ready' | 'empty-next' | 'changed' | 'archived' | 'unavailable';
export function returnKind(state: State): ReturnKind {
  const snapshot = state.session?.snapshot;
  if (!state.task || !snapshot || state.task.id !== snapshot.id) return 'unavailable';
  if (state.task.status === 'archived') return 'archived';
  if (state.task.revision !== snapshot.revision) return 'changed';
  return state.task.nextStep.trim() ? 'ready' : 'empty-next';
}
export function remaining(session: Session | null, now: number): number | null {
  return session?.deadline == null
    ? null
    : Math.max(0, Math.min(session.duration, Math.ceil((session.deadline - now) / 1000)));
}
export function reconcileTime(state: State, now: number): State {
  if (
    ['spark', 'quiet', 'attempt'].includes(state.phase) &&
    state.session?.deadline != null &&
    now < state.session.startedAt
  )
    return { ...state, phase: 'return', session: { ...state.session, endedBy: 'clock-changed' } };
  if (
    ['spark', 'quiet', 'attempt'].includes(state.phase) &&
    state.session?.deadline != null &&
    now >= state.session.deadline
  )
    return { ...state, phase: 'return', session: { ...state.session, endedBy: 'elapsed' } };
  return state;
}
type Binding = { taskId: string | null; revision: number | null };
export type Action =
  | { type: 'needs' | 'home' | 'done' | 'reset' | 'tick' }
  | ({ type: 'begin'; path: Path; id: string } & Binding)
  | ({ type: 'direct'; id: string; sessionId: string | null } & Binding)
  | { type: 'duration'; duration: Duration }
  | { type: 'attempt'; id: string; text: string; timed: boolean }
  | { type: 'place' | 'end'; id: string; expectedStep?: number }
  | { type: 'park'; id: string; text: string }
  | { type: 'extend'; id: string; sessionId: string; duration: Duration }
  | { type: 'refresh-return'; id: string }
  | { type: 'reopen'; id: string; taskId: string; expectedRevision: number }
  | { type: 'language'; language: Language }
  | { type: 'motion'; reduced: boolean }
  | { type: 'spark-enabled'; enabled: boolean }
  | { type: 'delete-thought'; index: number; expectedText: string }
  | { type: 'scenario'; scenario: 'math' | 'writing' | 'none' | 'archived' | 'empty-next' }
  | { type: 'edit'; title: string; nextStep: string; taskId: string; expectedRevision: number };
function assertBinding(state: State, binding: Binding) {
  if ((state.task?.id ?? null) !== binding.taskId || (state.task?.revision ?? null) !== binding.revision)
    throw new Error('TASK_CHANGED');
}
function makeSession(state: State, path: Path, id: string, now: number): Session {
  const timed = path === 'spark' || path === 'quiet';
  return {
    id,
    path,
    taskId: state.task?.id ?? null,
    snapshot: state.task ? { ...state.task } : null,
    startedAt: now,
    deadline: timed ? now + state.duration * 1000 : null,
    duration: timed ? state.duration : 0,
    step: 0,
    extensions: 0,
    tinyAction: '',
    endedBy: 'none',
  };
}
export function reduceState(previous: State, action: Action, now: number): State {
  const state = reconcileTime(previous, now);
  let next = state;
  switch (action.type) {
    case 'needs':
      if (['home', 'done'].includes(state.phase)) next = { ...state, phase: 'needs', session: null };
      break;
    case 'home':
      next = { ...state, phase: 'home', session: null };
      break;
    case 'begin':
      if (!['home', 'needs'].includes(state.phase)) break;
      assertBinding(state, action);
      if (action.path === 'spark' && !state.sparkEnabled) break;
      next = {
        ...state,
        phase: action.path === 'direct' ? 'ready' : action.path,
        session: makeSession(state, action.path, action.id, now),
      };
      if (action.path === 'direct' && state.task?.status !== 'paused') next.phase = 'return';
      break;
    case 'direct':
      assertBinding(state, action);
      if (state.session) {
        if (state.session.id !== action.sessionId) break;
        next = ['ready', 'empty-next'].includes(returnKind(state))
          ? { ...state, phase: 'ready', session: { ...state.session, endedBy: 'direct' } }
          : { ...state, phase: 'return' };
      } else {
        if (action.sessionId !== null) break;
        const session = makeSession(state, 'direct', action.id, now);
        next = { ...state, session, phase: state.task?.status === 'paused' ? 'ready' : 'return' };
      }
      break;
    case 'duration':
      // Duration changes affect future sessions, never an already running deadline.
      next = { ...state, duration: action.duration };
      break;
    case 'attempt':
      if (state.phase !== 'start' || state.session?.id !== action.id) break;
      if (!['ready', 'empty-next'].includes(returnKind(state))) {
        next = { ...state, phase: 'return' };
        break;
      }
      if (!action.text.trim() || !state.task?.nextStep.trim()) break;
      next = {
        ...state,
        phase: 'attempt',
        session: {
          ...state.session,
          tinyAction: action.text.trim().slice(0, 180),
          startedAt: now,
          duration: action.timed ? 30 : 0,
          deadline: action.timed ? now + 30_000 : null,
        },
      };
      break;
    case 'place':
      if (
        state.phase !== 'spark' ||
        state.session?.id !== action.id ||
        action.expectedStep !== state.session.step
      )
        break;
      {
        const step = Math.min(3, state.session.step + 1);
        next = {
          ...state,
          phase: step === 3 ? 'return' : 'spark',
          session: { ...state.session, step, endedBy: step === 3 ? 'assembled' : 'none' },
        };
      }
      break;
    case 'end':
      if (!['spark', 'quiet', 'attempt', 'start'].includes(state.phase) || state.session?.id !== action.id)
        break;
      next = { ...state, phase: 'return', session: { ...state.session, endedBy: 'early' } };
      break;
    case 'park':
      if (state.phase !== 'park' || state.session?.id !== action.id) break;
      next = {
        ...state,
        phase: 'return',
        session: { ...state.session, endedBy: 'parked' },
        parking: action.text.trim()
          ? [action.text.trim().slice(0, 240), ...state.parking].slice(0, 12)
          : state.parking,
      };
      break;
    case 'extend':
      if (
        state.phase !== 'return' ||
        state.session?.id !== action.sessionId ||
        state.session.extensions !== 0 ||
        !['spark', 'quiet'].includes(state.session.path)
      )
        break;
      next = {
        ...state,
        phase: 'quiet',
        session: {
          ...state.session,
          path: 'quiet',
          id: action.id,
          startedAt: now,
          deadline: now + action.duration * 1000,
          duration: action.duration,
          step: 0,
          extensions: 1,
          endedBy: 'none',
        },
      };
      break;
    case 'refresh-return':
      if (state.session?.id !== action.id || returnKind(state) !== 'changed' || !state.task) break;
      next = {
        ...state,
        phase: 'return',
        session: { ...state.session, snapshot: { ...state.task }, tinyAction: '' },
      };
      break;
    case 'reopen':
      if (
        state.phase !== 'return' ||
        state.session?.id !== action.id ||
        returnKind(state) !== 'archived' ||
        !state.task
      )
        break;
      if (state.task.id !== action.taskId || state.task.revision !== action.expectedRevision)
        throw new Error('TASK_CHANGED');
      {
        const task = {
          ...state.task,
          status: 'paused' as const,
          revision: Math.max(state.revision, state.task.revision) + 1,
        };
        next = { ...state, task, session: { ...state.session, snapshot: { ...task }, tinyAction: '' } };
      }
      break;
    case 'done':
      next = { ...state, phase: 'done', session: null };
      break;
    case 'language':
      next = { ...state, language: action.language };
      break;
    case 'motion':
      next = { ...state, reducedMotion: action.reduced };
      break;
    case 'spark-enabled':
      next = { ...state, sparkEnabled: action.enabled };
      if (!action.enabled && state.phase === 'spark' && state.session)
        next = { ...next, phase: 'return', session: { ...state.session, endedBy: 'early' } };
      break;
    case 'delete-thought':
      if (state.parking[action.index] !== action.expectedText) throw new Error('TASK_CHANGED');
      next = { ...state, parking: state.parking.filter((_, i) => i !== action.index) };
      break;
    case 'scenario':
      if (action.scenario === 'none') {
        next = {
          ...state,
          task: null,
          session: state.session ? { ...state.session, taskId: null, snapshot: null, tinyAction: '' } : null,
        };
      } else if (['archived', 'empty-next'].includes(action.scenario) && state.task) {
        next = {
          ...state,
          task: {
            ...state.task,
            revision: Math.max(state.revision, state.task.revision) + 1,
            status: action.scenario === 'archived' ? 'archived' : state.task.status,
            nextStep: action.scenario === 'empty-next' ? '' : state.task.nextStep,
          },
        };
      } else if (action.scenario === 'math' || action.scenario === 'writing') {
        next = {
          ...state,
          task: sampleTask(
            state.language,
            action.scenario,
            Math.max(state.revision, state.task?.revision ?? 0) + 1,
            state.generation,
          ),
        };
      }
      break;
    case 'edit':
      if (!state.task || state.task.id !== action.taskId || state.task.revision !== action.expectedRevision)
        throw new Error('TASK_CHANGED');
      if (!action.title.trim()) break;
      next = {
        ...state,
        task: {
          ...state.task,
          title: action.title.trim().slice(0, 180),
          nextStep: action.nextStep.slice(0, 600),
          revision: Math.max(state.revision, state.task.revision) + 1,
        },
      };
      break;
    case 'reset': {
      const fresh = initialState(state.language, state.generation);
      fresh.task!.revision = Math.max(state.revision, state.task?.revision ?? 0) + 1;
      next = fresh;
      break;
    }
    case 'tick':
      break;
  }
  if (
    next.session &&
    (next.phase === 'ready' || ['edit', 'scenario'].includes(action.type)) &&
    !['ready', 'empty-next'].includes(returnKind(next))
  )
    next = { ...next, phase: 'return' };
  return next === previous ? previous : stateSchema.parse({ ...next, revision: previous.revision + 1 });
}
export function parseState(raw: string): State {
  if (raw.length > 48_000) throw new Error('INVALID_STORAGE');
  return stateSchema.parse(JSON.parse(raw));
}
