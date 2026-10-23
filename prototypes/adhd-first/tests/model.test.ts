import { describe, expect, it } from 'vitest';
import {
  initialState,
  parseState,
  reconcileTime,
  reduceState,
  remaining,
  returnKind,
  tinySuggestion,
  type Action,
  type Path,
  type State,
} from '../src/model';

const at = 10_000;
function act(state: State, action: Action, now = at) {
  return reduceState(state, action, now);
}
function begin(path: Path, base = initialState(), id = 'session'): State {
  return act(base, {
    type: 'begin',
    path,
    id,
    taskId: base.task?.id ?? null,
    revision: base.task?.revision ?? null,
  });
}
describe('ADHD-first finite, task-bound re-entry', () => {
  it('starts on the saved task without forcing help, a timer or a diagnosis', () => {
    const state = initialState();
    expect(state.phase).toBe('home');
    expect(state.session).toBeNull();
    const next = begin('direct', state);
    expect(next.phase).toBe('ready');
    expect(next.session?.snapshot).toEqual(state.task);
    expect(next.session?.deadline).toBeNull();
  });
  it('suggests only a first saved clause; empty/archived steps get no invented action', () => {
    const task = initialState().task!;
    expect(tinySuggestion(task, 'zh-CN')).toBe('打开例题 2');
    expect(tinySuggestion({ ...task, nextStep: '' }, 'zh-CN')).toBe('');
    expect(tinySuggestion({ ...task, status: 'archived' }, 'zh-CN')).toBe('');
    expect(tinySuggestion({ ...task, nextStep: 'x'.repeat(150) }, 'en')).toBe(
      'Read your saved next step once.',
    );
  });
  it('keeps an editable tiny suggestion separate from the original saved task', () => {
    const initial = initialState();
    const state = begin('start', initial);
    const next = act(state, { type: 'attempt', id: 'session', text: '  拿起笔  ', timed: false });
    expect(next.phase).toBe('attempt');
    expect(next.task).toEqual(initial.task);
    expect(next.session?.tinyAction).toBe('拿起笔');
    expect(next.session?.deadline).toBeNull();
    expect(reconcileTime(next, at + 999999).phase).toBe('attempt');
  });
  it('uses 30 seconds only when chosen, and expiry does not mark real work as complete', () => {
    const state = act(begin('start'), { type: 'attempt', id: 'session', text: '写第一行', timed: true });
    expect(state.session?.deadline).toBe(at + 30000);
    const ended = reconcileTime(state, at + 30000);
    expect(ended.phase).toBe('return');
    expect(ended.session?.endedBy).toBe('elapsed');
    expect(ended.task?.status).toBe('paused');
    expect(ended.session?.tinyAction).toBe('写第一行');
  });
  it('does not start a made-up tiny action when the saved step is missing', () => {
    const state = begin('start', act(initialState(), { type: 'scenario', scenario: 'empty-next' }));
    expect(act(state, { type: 'attempt', id: 'session', text: 'Invented action', timed: true }).phase).toBe(
      'start',
    );
    expect(returnKind(state)).toBe('empty-next');
  });
  it('places exactly three predictable pieces; duplicate clicks cannot skip a step', () => {
    let state = begin('spark');
    state = act(state, { type: 'place', id: 'session', expectedStep: 0 });
    state = act(state, { type: 'place', id: 'session', expectedStep: 0 });
    expect(state.session?.step).toBe(1);
    state = act(state, { type: 'place', id: 'session', expectedStep: 1 });
    state = act(state, { type: 'place', id: 'session', expectedStep: 2 });
    expect(state.phase).toBe('return');
    expect(state.session?.endedBy).toBe('assembled');
    expect(act(state, { type: 'place', id: 'session', expectedStep: 3 })).toEqual(state);
  });
  it('enforces the selected cap without waiting for all pieces or auto-starting again', () => {
    const state = begin('spark', act(initialState(), { type: 'duration', duration: 45 }));
    const ended = act(state, { type: 'place', id: 'session', expectedStep: 0 }, at + 45000);
    expect(ended.phase).toBe('return');
    expect(ended.session?.step).toBe(0);
    expect(ended.session?.endedBy).toBe('elapsed');
    expect(
      act(ended, {
        type: 'begin',
        path: 'spark',
        id: 'loop',
        taskId: ended.task!.id,
        revision: ended.task!.revision,
      }).session?.id,
    ).toBe('session');
  });
  it('allows leaving the interaction before the cap and turns one extension into quiet time', () => {
    let state = act(begin('spark'), { type: 'end', id: 'session' });
    state = act(state, { type: 'extend', id: 'extra', sessionId: 'session', duration: 45 });
    expect(state.phase).toBe('quiet');
    expect(state.session?.path).toBe('quiet');
    expect(state.session?.extensions).toBe(1);
    state = reconcileTime(state, at + 45000);
    expect(
      act(state, { type: 'extend', id: 'again', sessionId: 'extra', duration: 180 }, at + 45000),
    ).toEqual(state);
  });
  it('recovers elapsed wall time from a reopened serialized session and bounds clock rollback', () => {
    const state = begin('quiet');
    const reopened = parseState(JSON.stringify(state));
    expect(remaining(reopened.session, at + 20000)).toBe(70);
    expect(remaining(reopened.session, 0)).toBe(90);
    expect(remaining(reopened.session, at + 999999)).toBe(0);
    expect(reconcileTime(reopened, at + 90000).phase).toBe('return');
  });
  it('changing a future duration does not rewrite the running deadline', () => {
    const state = begin('quiet');
    expect(act(state, { type: 'duration', duration: 180 }).session?.deadline).toBe(state.session?.deadline);
  });
  it('stops a timed session safely if the device clock moves before its start', () => {
    const next = reconcileTime(begin('quiet'), at - 1000);
    expect(next.phase).toBe('return');
    expect(next.session?.endedBy).toBe('clock-changed');
  });
  it('parks or skips one thought without a countdown or a second task', () => {
    const state = begin('park');
    const next = act(state, { type: 'park', id: 'session', text: ' 晚些再看 ' });
    expect(next.phase).toBe('return');
    expect(next.parking).toEqual(['晚些再看']);
    expect(next.session?.deadline).toBeNull();
    expect(next.task).toEqual(state.task);
    expect(act(state, { type: 'park', id: 'session', text: ' ' }).parking).toEqual([]);
  });
  it('bounds parked content and retains other entries when deleting one', () => {
    const state = { ...initialState(), parking: Array.from({ length: 12 }, (_, i) => `sample ${i}`) };
    const next = act(begin('park', state), { type: 'park', id: 'session', text: 'x'.repeat(300) });
    expect(next.parking).toHaveLength(12);
    expect(next.parking[0]).toHaveLength(240);
    expect(act(next, { type: 'delete-thought', index: 0, expectedText: next.parking[0]! }).parking).toEqual(
      state.parking.slice(0, 11),
    );
    expect(() => act(next, { type: 'delete-thought', index: 0, expectedText: 'stale thought' })).toThrow(
      'TASK_CHANGED',
    );
  });
  it('cannot resume or accept a tiny action against a changed task until explicitly reviewed', () => {
    let state = begin('start');
    state = act(state, {
      type: 'edit',
      taskId: state.task!.id,
      expectedRevision: state.task!.revision,
      title: 'Revised sample',
      nextStep: 'Read the diagram',
    });
    expect(returnKind(state)).toBe('changed');
    state = act(state, { type: 'attempt', id: 'session', text: 'Old suggestion', timed: false });
    expect(state.phase).toBe('return');
    state = act(state, { type: 'refresh-return', id: 'session' });
    expect(returnKind(state)).toBe('ready');
    expect(state.session?.snapshot?.nextStep).toBe('Read the diagram');
  });
  it.each(['archived', 'none', 'writing'] as const)(
    'does not adopt an %s target for the original session',
    (scenario) => {
      let state = begin('quiet');
      const originalId = state.session!.snapshot!.id;
      state = act(state, { type: 'scenario', scenario });
      state = act(state, {
        type: 'direct',
        id: 'resume',
        sessionId: 'session',
        taskId: state.task?.id ?? null,
        revision: state.task?.revision ?? null,
      });
      expect(state.phase).toBe('return');
      expect(returnKind(state)).toBe(scenario === 'archived' ? 'archived' : 'unavailable');
      if (scenario === 'none') expect(state.session?.snapshot).toBeNull();
      else expect(state.session?.snapshot?.id).toBe(originalId);
    },
  );
  it('rejects stale direct intents, edits and deleted/recreated task versions', () => {
    const before = initialState();
    let after = act(before, { type: 'scenario', scenario: 'none' });
    after = act(after, { type: 'scenario', scenario: 'math' });
    expect(after.task?.revision).toBeGreaterThan(before.task!.revision);
    expect(() =>
      act(after, {
        type: 'direct',
        id: 'old',
        sessionId: null,
        taskId: before.task!.id,
        revision: before.task!.revision,
      }),
    ).toThrow('TASK_CHANGED');
    expect(() =>
      act(after, {
        type: 'edit',
        taskId: before.task!.id,
        expectedRevision: before.task!.revision,
        title: 'stale',
        nextStep: '',
      }),
    ).toThrow('TASK_CHANGED');
  });
  it('reopens an archived original only after an explicit version-checked choice', () => {
    let state = act(begin('quiet'), { type: 'scenario', scenario: 'archived' });
    state = act(state, { type: 'end', id: 'session' });
    expect(returnKind(state)).toBe('archived');
    expect(() =>
      act(state, { type: 'reopen', id: 'session', taskId: state.task!.id, expectedRevision: 1 }),
    ).toThrow('TASK_CHANGED');
    const next = act(state, {
      type: 'reopen',
      id: 'session',
      taskId: state.task!.id,
      expectedRevision: state.task!.revision,
    });
    expect(next.phase).toBe('return');
    expect(next.task?.status).toBe('paused');
    expect(returnKind(next)).toBe('ready');
  });
  it('removes a deleted task’s derived tiny action as well as its text snapshot', () => {
    const state = act(begin('start'), {
      type: 'attempt',
      id: 'session',
      text: 'demo derived action',
      timed: false,
    });
    const next = act(state, { type: 'scenario', scenario: 'none' });
    expect(next.session?.snapshot).toBeNull();
    expect(next.session?.tinyAction).toBe('');
  });
  it('rejects stale session actions and refuses replacing an unfinished round', () => {
    const state = begin('spark');
    expect(act(state, { type: 'place', id: 'old', expectedStep: 0 })).toBe(state);
    expect(
      act(state, {
        type: 'begin',
        path: 'quiet',
        id: 'new',
        taskId: state.task!.id,
        revision: state.task!.revision,
      }),
    ).toBe(state);
  });
  it('keeps a corruption-reset generation through later sample deletion and reselection', () => {
    const old = act(initialState(), { type: 'scenario', scenario: 'math' });
    let fresh = initialState('zh-CN', 'new-corruption-reset');
    fresh = act(fresh, { type: 'scenario', scenario: 'none' });
    fresh = act(fresh, { type: 'scenario', scenario: 'math' });
    expect(fresh.task?.id).not.toBe(old.task?.id);
    expect(() =>
      act(fresh, {
        type: 'direct',
        id: 'stale-old-generation',
        sessionId: null,
        taskId: old.task!.id,
        revision: old.task!.revision,
      }),
    ).toThrow('TASK_CHANGED');
  });
  it('keeps authored text on language changes, respects disabling spark and preserves stopping', () => {
    let state = begin('spark');
    const task = state.task;
    state = act(state, { type: 'language', language: 'en' });
    expect(state.task).toEqual(task);
    state = act(state, { type: 'spark-enabled', enabled: false });
    expect(state.phase).toBe('return');
    state = act(state, { type: 'done' });
    expect(state.task).toEqual(task);
    expect(state.session).toBeNull();
    state = act(state, { type: 'home' });
    expect(begin('spark', state)).toEqual(state);
  });
  it('makes unavailable targets explicit without inventing a task', () => {
    let state = act(initialState(), { type: 'scenario', scenario: 'none' });
    state = begin('direct', state);
    expect(state.phase).toBe('return');
    expect(returnKind(state)).toBe('unavailable');
    expect(state.task).toBeNull();
  });
  it('rejects corrupted deadlines, impossible path/phase combinations, unknown fields and oversized data', () => {
    const state = begin('quiet');
    expect(() => parseState(JSON.stringify({ ...state, extra: true }))).toThrow();
    expect(() =>
      parseState(JSON.stringify({ ...state, session: { ...state.session, deadline: 1 } })),
    ).toThrow();
    expect(() => parseState(JSON.stringify({ ...state, phase: 'start' }))).toThrow();
    expect(() => parseState(JSON.stringify({ ...state, phase: 'home' }))).toThrow();
    expect(() => parseState(' '.repeat(48001))).toThrow();
  });
});
