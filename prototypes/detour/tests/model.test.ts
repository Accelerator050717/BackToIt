import { describe, expect, it } from 'vitest';
import {
  initialState,
  parseState,
  reconcileTime,
  reduceState,
  remainingSeconds,
  returnKind,
  type State,
} from '../src/model';

const at = 10_000;
function started(mode: 'quiet' | 'lines' = 'quiet', duration: 45 | 90 | 180 = 90): State {
  let state = reduceState(initialState(), { type: 'navigate', phase: 'choose' }, at);
  state = reduceState(state, { type: 'mode', mode }, at);
  state = reduceState(state, { type: 'duration', duration }, at);
  return reduceState(state, { type: 'start', id: 'round-one' }, at);
}
describe('bounded detours and faithful return', () => {
  it('never starts automatically on the Resume card', () => {
    const state = initialState();
    expect(reduceState(state, { type: 'start', id: 'unsolicited' }, at)).toBe(state);
    expect(state.phase).toBe('resume');
  });
  it('binds the exact original next step and revision independently of a current-task pointer', () => {
    const state = started();
    expect(state.session?.snapshot).toEqual(state.task);
    expect(state.session?.snapshot?.nextStep).toBe('打开例题 2，分别写出 dx/dt 和 dy/dt。');
    expect(state.session?.deadline).toBe(at + 90_000);
  });
  it('recovers a completed break from timestamps after reopening, without starting a new round', () => {
    const state = started('quiet', 45);
    const reopened = parseState(JSON.stringify(state));
    const ended = reconcileTime(reopened, at + 600_000);
    expect(ended.phase).toBe('return');
    expect(ended.session?.endedBy).toBe('elapsed');
    expect(ended.session?.id).toBe('round-one');
    expect(remainingSeconds(ended.session!, at + 600_000)).toBe(0);
  });
  it('handles duration boundaries deterministically and never shows a negative countdown', () => {
    const state = started('quiet', 180);
    expect(remainingSeconds(state.session!, at - 60_000)).toBe(180);
    expect(remainingSeconds(state.session!, at + 179_001)).toBe(1);
    expect(reconcileTime(state, at + 180_000).phase).toBe('return');
  });
  it('ends the finite interaction after exactly three actions and ignores further touches', () => {
    let state = started('lines');
    for (let index = 0; index < 3; index++)
      state = reduceState(state, { type: 'interact', id: 'round-one' }, at + index + 1);
    expect(state.phase).toBe('return');
    expect(state.session?.step).toBe(3);
    expect(state.session?.endedBy).toBe('interaction');
    expect(reduceState(state, { type: 'interact', id: 'round-one' }, at + 100)).toBe(state);
  });
  it('accepts early exit but ignores stale actions from another round', () => {
    const state = started();
    expect(reduceState(state, { type: 'end', id: 'old-round' }, at + 1)).toBe(state);
    expect(reduceState(state, { type: 'end', id: 'round-one' }, at + 1).session?.endedBy).toBe('early');
  });
  it('requires an explicit bounded extension and allows only one extra round per visit', () => {
    let state = reduceState(started(), { type: 'end', id: 'round-one' }, at + 1);
    state = reduceState(state, { type: 'extend', id: 'extra-round', duration: 45 }, at + 2);
    expect(state.session?.deadline).toBe(at + 2 + 45_000);
    expect(state.session?.extensions).toBe(1);
    state = reduceState(state, { type: 'end', id: 'extra-round' }, at + 3);
    expect(reduceState(state, { type: 'extend', id: 'forbidden-auto-loop', duration: 180 }, at + 4)).toBe(
      state,
    );
  });
  it('does not activate or silently adopt changed task text', () => {
    let state = reduceState(
      started(),
      { type: 'edit-task', title: '另一窗口的新名称', nextStep: '用户新写的步骤', expectedRevision: 1 },
      at + 1,
    );
    state = reduceState(state, { type: 'end', id: 'round-one' }, at + 2);
    expect(returnKind(state)).toBe('changed');
    expect(state.session?.snapshot?.nextStep).toBe('打开例题 2，分别写出 dx/dt 和 dy/dt。');
    expect(reduceState(state, { type: 'resume' }, at + 3)).toBe(state);
    state = reduceState(state, { type: 'refresh-return' }, at + 4);
    expect(returnKind(state)).toBe('ready');
    expect(state.session?.snapshot?.nextStep).toBe('用户新写的步骤');
  });
  it('makes archive and missing-next states explicit', () => {
    let state = reduceState(started(), { type: 'scenario', scenario: 'archived' }, at + 1);
    expect(returnKind(state)).toBe('archived');
    state = reduceState(initialState(), { type: 'scenario', scenario: 'empty-next' }, at);
    state = reduceState(state, { type: 'navigate', phase: 'choose' }, at);
    state = reduceState(state, { type: 'start', id: 'empty-next' }, at);
    expect(returnKind(state)).toBe('empty-next');
    expect(state.session?.snapshot?.nextStep).toBe('');
  });
  it('drops the textual snapshot on deletion and never binds a replacement task silently', () => {
    let state = reduceState(started(), { type: 'scenario', scenario: 'none' }, at + 1);
    expect(state.session?.snapshot).toBeNull();
    expect(returnKind(state)).toBe('unavailable');
    state = reduceState(state, { type: 'scenario', scenario: 'normal' }, at + 2);
    expect(returnKind(state)).toBe('unavailable');
  });
  it('supports the no-content control without requiring a timer or inventing a task', () => {
    let state = reduceState(initialState(), { type: 'scenario', scenario: 'none' }, at);
    state = reduceState(state, { type: 'navigate', phase: 'parking' }, at);
    state = reduceState(state, { type: 'park', text: '想看视频', id: 'direct' }, at);
    expect(state.phase).toBe('return');
    expect(state.session?.mode).toBe('direct');
    expect(returnKind(state)).toBe('unavailable');
    expect(state.parking).toEqual(['想看视频']);
  });
  it('preserves user-authored wording when switching interface language and ends today without failure state', () => {
    const state = started();
    const english = reduceState(state, { type: 'language', language: 'en' }, at + 1);
    expect(english.session?.snapshot?.nextStep).toBe(state.session?.snapshot?.nextStep);
    const ended = reduceState(english, { type: 'done' }, at + 2);
    expect(ended.phase).toBe('done');
    expect(ended.task).toEqual(state.task);
    expect(ended.session).toBeNull();
  });
  it('rejects unknown fields and invalid deadline data without silently replacing it', () => {
    expect(() =>
      parseState(JSON.stringify({ ...initialState(), productionTaskId: 'not-allowed' })),
    ).toThrow();
    const state = started();
    expect(() =>
      parseState(JSON.stringify({ ...state, session: { ...state.session, deadline: at } })),
    ).toThrow();
  });
  it('cannot navigate away and silently replace an unfinished break', () => {
    const state = started();
    const stillResting = reduceState(state, { type: 'navigate', phase: 'choose' }, at + 1);
    expect(stillResting).toBe(state);
    expect(reduceState(stillResting, { type: 'start', id: 'replacement' }, at + 2)).toBe(state);
    expect(state.session?.id).toBe('round-one');
  });
});
