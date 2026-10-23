import { z } from 'zod';

export const STORAGE_KEY = 'backtoit:detour-research:v1';
export const LOCK_KEY = 'backtoit-detour-research';
export const durations = [45, 90, 180] as const;
export type Duration = (typeof durations)[number];
export type Mode = 'quiet' | 'lines' | 'direct';
export type Language = 'zh-CN' | 'en';
const taskSchema = z
  .object({
    id: z.string().max(80),
    title: z.string().min(1).max(180),
    nextStep: z.string().max(600),
    status: z.enum(['paused', 'archived']),
    revision: z.number().int().positive(),
  })
  .strict();
const sessionSchema = z
  .object({
    id: z.string().max(80),
    mode: z.enum(['quiet', 'lines', 'direct']),
    taskId: z.string().max(80).nullable(),
    snapshot: taskSchema.nullable(),
    startedAt: z.number().nonnegative(),
    deadline: z.number().nonnegative(),
    duration: z.union([z.literal(45), z.literal(90), z.literal(180)]),
    step: z.number().int().min(0).max(3),
    extensions: z.number().int().min(0).max(1),
    endedBy: z.enum(['none', 'elapsed', 'early', 'interaction', 'direct']),
  })
  .strict();
export const stateSchema = z
  .object({
    schema: z.literal(1),
    revision: z.number().int().nonnegative(),
    language: z.enum(['zh-CN', 'en']),
    reducedMotion: z.boolean(),
    phase: z.enum(['resume', 'choose', 'parking', 'rest', 'return', 'done']),
    selectedMode: z.enum(['quiet', 'lines', 'direct']),
    selectedDuration: z.union([z.literal(45), z.literal(90), z.literal(180)]),
    task: taskSchema.nullable(),
    session: sessionSchema.nullable(),
    parking: z.array(z.string().min(1).max(240)).max(12),
  })
  .strict()
  .superRefine((state, ctx) => {
    if ((state.phase === 'rest' || state.phase === 'return') && !state.session)
      ctx.addIssue({ code: 'custom', message: 'Missing session' });
    if (state.session && state.session.deadline !== state.session.startedAt + state.session.duration * 1000)
      ctx.addIssue({ code: 'custom', message: 'Invalid deadline' });
  });
export type DemoTask = z.infer<typeof taskSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type State = z.infer<typeof stateSchema>;
export function sampleTask(language: Language, revision = 1): DemoTask {
  return {
    id: 'demo-parametric',
    title: language === 'zh-CN' ? '理解参数方程的切线' : 'Understand tangents to parametric curves',
    nextStep:
      language === 'zh-CN'
        ? '打开例题 2，分别写出 dx/dt 和 dy/dt。'
        : 'Open example 2 and write down dx/dt and dy/dt separately.',
    status: 'paused',
    revision,
  };
}
export function initialState(language: Language = 'zh-CN'): State {
  return {
    schema: 1,
    revision: 0,
    language,
    reducedMotion: false,
    phase: 'resume',
    selectedMode: 'quiet',
    selectedDuration: 90,
    task: sampleTask(language),
    session: null,
    parking: [],
  };
}
export function remainingSeconds(session: Session, now: number): number {
  return Math.max(0, Math.min(session.duration, Math.ceil((session.deadline - now) / 1000)));
}
export function reconcileTime(state: State, now: number): State {
  if (state.phase === 'rest' && state.session && now >= state.session.deadline)
    return { ...state, phase: 'return', session: { ...state.session, endedBy: 'elapsed' } };
  return state;
}
export type Action =
  | { type: 'navigate'; phase: 'resume' | 'choose' | 'parking' }
  | { type: 'mode'; mode: Mode }
  | { type: 'duration'; duration: Duration }
  | { type: 'start'; id: string }
  | { type: 'interact'; id: string }
  | { type: 'end'; id: string }
  | { type: 'tick'; id: string }
  | { type: 'extend'; duration: Duration; id: string }
  | { type: 'park'; text: string; id: string }
  | { type: 'resume' }
  | { type: 'done' }
  | { type: 'refresh-return' }
  | { type: 'reopen' }
  | { type: 'scenario'; scenario: 'normal' | 'empty-next' | 'archived' | 'none' }
  | { type: 'edit-task'; title: string; nextStep: string; expectedRevision: number }
  | { type: 'language'; language: Language }
  | { type: 'motion'; reduced: boolean }
  | { type: 'delete-thought'; index: number }
  | { type: 'reset' };
export type ReturnKind = 'ready' | 'empty-next' | 'changed' | 'archived' | 'unavailable';
export function returnKind(state: State): ReturnKind {
  const session = state.session;
  if (!session?.snapshot || !state.task || state.task.id !== session.taskId) return 'unavailable';
  if (state.task.status === 'archived') return 'archived';
  if (state.task.revision !== session.snapshot.revision) return 'changed';
  return state.task.nextStep.trim() ? 'ready' : 'empty-next';
}
function startSession(state: State, id: string, now: number, mode: Mode = state.selectedMode): Session {
  return {
    id,
    mode,
    taskId: state.task?.id ?? null,
    snapshot: state.task ? { ...state.task } : null,
    startedAt: now,
    deadline: now + state.selectedDuration * 1000,
    duration: state.selectedDuration,
    step: 0,
    extensions: 0,
    endedBy: mode === 'direct' ? 'direct' : 'none',
  };
}
export function reduceState(previous: State, action: Action, now: number): State {
  const state = reconcileTime(previous, now);
  let next: State = state;
  switch (action.type) {
    case 'navigate':
      if (state.phase === 'rest') break;
      next = { ...state, phase: action.phase };
      break;
    case 'mode':
      next = { ...state, selectedMode: action.mode };
      break;
    case 'duration':
      next = { ...state, selectedDuration: action.duration };
      break;
    case 'language':
      next = { ...state, language: action.language };
      break;
    case 'motion':
      next = { ...state, reducedMotion: action.reduced };
      break;
    case 'start':
      if (state.phase !== 'choose') break;
      next =
        state.selectedMode === 'direct'
          ? { ...state, phase: 'parking' }
          : { ...state, phase: 'rest', session: startSession(state, action.id, now) };
      break;
    case 'interact':
      if (state.phase !== 'rest' || state.session?.id !== action.id || state.session.mode !== 'lines') break;
      {
        const step = Math.min(3, state.session.step + 1);
        next = {
          ...state,
          phase: step === 3 ? 'return' : 'rest',
          session: { ...state.session, step, endedBy: step === 3 ? 'interaction' : 'none' },
        };
      }
      break;
    case 'end':
      if (state.phase !== 'rest' || state.session?.id !== action.id) break;
      next = { ...state, phase: 'return', session: { ...state.session, endedBy: 'early' } };
      break;
    case 'tick':
      break;
    case 'extend':
      if (
        state.phase !== 'return' ||
        !state.session ||
        state.session.extensions !== 0 ||
        state.session.mode === 'direct'
      )
        break;
      next = {
        ...state,
        phase: 'rest',
        session: {
          ...state.session,
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
    case 'park':
      if (state.phase !== 'parking') break;
      next = {
        ...state,
        phase: 'return',
        selectedMode: 'direct',
        session: startSession(state, action.id, now, 'direct'),
        parking: action.text.trim()
          ? [action.text.trim().slice(0, 240), ...state.parking].slice(0, 12)
          : state.parking,
      };
      break;
    case 'resume':
      if (state.phase === 'return' && !['ready', 'empty-next'].includes(returnKind(state))) break;
      next = { ...state, phase: 'resume', session: null };
      break;
    case 'done':
      next = { ...state, phase: 'done', session: null };
      break;
    case 'refresh-return':
      if (
        !state.task ||
        state.task.status === 'archived' ||
        !state.session?.snapshot ||
        state.task.id !== state.session.taskId
      )
        break;
      next = { ...state, session: { ...state.session, snapshot: { ...state.task } } };
      break;
    case 'reopen':
      if (!state.task) break;
      {
        const task = { ...state.task, status: 'paused' as const, revision: state.task.revision + 1 };
        next = { ...state, task, phase: 'resume', session: null };
      }
      break;
    case 'scenario':
      if (action.scenario === 'none') {
        next = { ...state, task: null, session: state.session ? { ...state.session, snapshot: null } : null };
        break;
      }
      {
        const task = sampleTask(state.language, (state.task?.revision ?? 0) + 1);
        if (action.scenario === 'archived') task.status = 'archived';
        if (action.scenario === 'empty-next') task.nextStep = '';
        next = { ...state, task };
      }
      break;
    case 'edit-task':
      if (!state.task || !action.title.trim()) break;
      if (state.task.revision !== action.expectedRevision) throw new Error('TASK_CHANGED');
      next = {
        ...state,
        task: {
          ...state.task,
          title: action.title.trim().slice(0, 180),
          nextStep: action.nextStep.slice(0, 600),
          revision: state.task.revision + 1,
        },
      };
      break;
    case 'delete-thought':
      next = { ...state, parking: state.parking.filter((_, index) => index !== action.index) };
      break;
    case 'reset':
      next = initialState(state.language);
      break;
  }
  if (next === previous) return previous;
  return stateSchema.parse({ ...next, revision: previous.revision + 1 });
}

export function parseState(raw: string): State {
  if (raw.length > 32_000) throw new Error('PROTOTYPE_DATA_INVALID');
  return stateSchema.parse(JSON.parse(raw));
}
