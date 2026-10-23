import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BackToItDatabase, Repository } from '../src/storage/repository';
import { parseBackup } from '../src/domain/backup';
import { LIMITS } from '../src/domain/schemas';
import type { Backup, ResourceInput } from '../src/domain/types';

let database: BackToItDatabase;
let repository: Repository;
const extraConnections: BackToItDatabase[] = [];
const page = (overrides: Partial<ResourceInput> = {}): ResourceInput => ({
  title: 'Example page',
  url: 'https://example.test/lesson?chapter=2#example-1',
  source: 'page',
  ...overrides,
});

beforeEach(() => {
  database = new BackToItDatabase(`backtoit-test-${crypto.randomUUID()}`);
  repository = new Repository(database);
});

afterEach(async () => {
  for (const connection of extraConnections.splice(0)) connection.close();
  await database.delete();
});

describe('transactional task and resource storage', () => {
  it('serializes concurrent task creation across separate database connections into one current task', async () => {
    const otherDatabase = new BackToItDatabase(database.name);
    extraConnections.push(otherDatabase);
    const other = new Repository(otherDatabase);
    await Promise.all([repository.createTask('First'), other.createTask('Second')]);
    const state = await repository.getState();
    expect(state.tasks).toHaveLength(2);
    expect(state.tasks.filter((task) => task.status === 'active')).toHaveLength(1);
    expect(state.tasks.find((task) => task.id === state.currentTaskId)?.status).toBe('active');
    expect(state.tasks.filter((task) => task.status === 'paused')).toHaveLength(1);
  });

  it('rejects stale edits across contexts and retains the committed draft', async () => {
    const created = await repository.createTask('Read');
    const otherDatabase = new BackToItDatabase(database.name);
    extraConnections.push(otherDatabase);
    const other = new Repository(otherDatabase);
    const result = await Promise.allSettled([
      repository.updateTask(created.id, { progress: 'First draft' }, created.revision),
      other.updateTask(created.id, { progress: 'Other draft' }, created.revision),
    ]);
    expect(result.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(result.find((item) => item.status === 'rejected')).toMatchObject({ reason: { code: 'CONFLICT' } });
    const task = (await repository.getState()).tasks[0]!;
    expect(task.revision).toBe(created.revision + 1);
    expect(['First draft', 'Other draft']).toContain(task.progress);
  });

  it('keeps immutable field snapshots, pauses atomically, and permits reopening a completed task', async () => {
    let task = await repository.createTask('Read');
    const saved = await repository.addResource(task.id, page({ excerpt: 'Selected text' }));
    task = (await repository.getState()).tasks[0]!;
    const checkpoint = await repository.checkpointTask(
      task.id,
      { progress: 'Part 1', blocker: 'A question', nextStep: 'Read part 2' },
      task.revision,
    );
    let state = await repository.getState();
    expect(state.currentTaskId).toBeNull();
    expect(checkpoint.resourceIds).toEqual([saved.resource.id]);
    expect(checkpoint).not.toHaveProperty('resources');
    task = state.tasks[0]!;
    await repository.updateTask(task.id, { progress: 'Part 2' }, task.revision);
    expect((await repository.getState()).checkpoints[0]?.progress).toBe('Part 1');
    await repository.setTaskStatus(task.id, 'completed');
    await repository.activateTask(task.id);
    state = await repository.getState();
    expect(state.currentTaskId).toBe(task.id);
    expect(state.tasks[0]?.status).toBe('active');
    await repository.deleteCheckpoint(checkpoint.id);
    expect((await repository.getState()).checkpoints).toEqual([]);
  });

  it('does not create a snapshot or pause when a checkpoint write fails', async () => {
    const task = await repository.createTask('Read');
    const fail = () => {
      throw new Error('Synthetic storage failure');
    };
    database.tasks.hook('updating', fail);
    await expect(
      repository.checkpointTask(task.id, { progress: 'One', blocker: '', nextStep: '' }, task.revision),
    ).rejects.toThrow('Synthetic storage failure');
    database.tasks.hook('updating').unsubscribe(fail);
    const state = await repository.getState();
    expect(state.tasks[0]).toEqual(task);
    expect(state.checkpoints).toEqual([]);
    expect(state.currentTaskId).toBe(task.id);
  });

  it('merges only identical task URLs while retaining different excerpts and notes', async () => {
    const task = await repository.createTask('Read');
    const first = await repository.addResource(task.id, page({ excerpt: 'First quote', note: 'Useful' }));
    const merged = await repository.addResource(
      task.id,
      page({ url: `${page().url}&utm_source=mail`, excerpt: 'Second quote', note: 'Also useful' }),
    );
    // Tracking inside a fragment is an actual anchor: it is intentionally distinct.
    expect(merged.resource.id).not.toBe(first.resource.id);
    const actualMerge = await repository.addResource(
      task.id,
      page({ excerpt: 'Second quote', note: 'Also useful' }),
    );
    expect(actualMerge.resource.id).toBe(first.resource.id);
    expect(actualMerge.resource.excerpts).toEqual(['First quote', 'Second quote']);
    expect(actualMerge.resource.note).toBe('Useful\n\nAlso useful');
    await repository.addResource(task.id, page({ excerpt: 'Second quote' }));
    expect(
      (await repository.getState()).resources.find((item) => item.id === first.resource.id)?.excerpts,
    ).toHaveLength(2);
    await repository.addResource(task.id, page({ url: 'https://example.test/lesson?chapter=3#example-1' }));
    expect((await repository.getState()).resources).toHaveLength(3);
  });

  it('undos a new resource or a merge without clobbering a later edit', async () => {
    const task = await repository.createTask('Read');
    const original = await repository.addResource(task.id, page({ excerpt: 'Original' }));
    const merge = await repository.addResource(task.id, page({ excerpt: 'Additional' }));
    expect(await repository.undoResource(merge.undoId)).toBe(true);
    expect((await repository.getState()).resources[0]?.excerpts).toEqual(['Original']);
    const latest = await repository.addResource(task.id, page({ excerpt: 'Newer' }));
    await repository.updateResource(
      latest.resource.id,
      { note: 'Edited after save' },
      latest.resource.revision,
    );
    expect(await repository.undoResource(latest.undoId)).toBe(false);
    expect((await repository.getState()).resources[0]?.note).toBe('Edited after save');
    expect(await repository.undoResource(original.undoId)).toBe(false);
    const newResource = await repository.addResource(task.id, page({ url: null, title: 'A note' }));
    expect(await repository.undoResource(newResource.undoId)).toBe(true);
    expect(await repository.undoResource(newResource.undoId)).toBe(false);
    expect((await repository.getState()).resources).toHaveLength(1);
  });

  it('bumps task revisions for resource content and primary-resource changes', async () => {
    const task = await repository.createTask('Read');
    const saved = await repository.addResource(task.id, page());
    let revision = (await repository.getState()).tasks[0]!.revision;
    expect(revision).toBeGreaterThan(task.revision);
    await repository.updateResource(saved.resource.id, { note: 'New note' }, saved.resource.revision);
    let next = (await repository.getState()).tasks[0]!.revision;
    expect(next).toBeGreaterThan(revision);
    revision = next;
    await repository.setPrimaryResource(task.id, null);
    next = (await repository.getState()).tasks[0]!.revision;
    expect(next).toBeGreaterThan(revision);
  });

  it('removes deleted resource IDs from checkpoints, primary references and persisted undo copies', async () => {
    let task = await repository.createTask('Read');
    const saved = await repository.addResource(task.id, page({ excerpt: 'Private synthetic text' }));
    await repository.addResource(task.id, page({ excerpt: 'More synthetic text' }));
    task = (await repository.getState()).tasks[0]!;
    await repository.checkpointTask(task.id, { progress: 'Step', blocker: '', nextStep: '' }, task.revision);
    await repository.removeResource(saved.resource.id);
    const state = await repository.getState();
    expect(state.resources).toEqual([]);
    expect(state.checkpoints[0]?.resourceIds).toEqual([]);
    expect(state.tasks[0]?.primaryResourceId).toBeNull();
    expect(await database.undos.count()).toBe(0);
    expect(JSON.stringify(await repository.exportBackup())).not.toContain('Private synthetic text');
  });

  it('deletes task data as one cascade and keeps unrelated tasks and parking', async () => {
    const first = await repository.createTask('Delete');
    await repository.addResource(first.id, page());
    const task = (await repository.getState()).tasks[0]!;
    await repository.checkpointTask(task.id, { progress: 'One', blocker: '', nextStep: '' }, task.revision);
    const second = await repository.createTask('Keep');
    await repository.addParking('Remember');
    await repository.deleteTask(first.id);
    const state = await repository.getState();
    expect(state.tasks.map((item) => item.id)).toEqual([second.id]);
    expect(state.resources).toEqual([]);
    expect(state.checkpoints).toEqual([]);
    expect(state.parking).toHaveLength(1);
    expect(await database.undos.count()).toBe(0);
  });

  it('saves to the current task atomically and fails explicitly when no current task exists', async () => {
    await expect(repository.addResourceToCurrent(page())).rejects.toMatchObject({ code: 'NO_CURRENT_TASK' });
    const task = await repository.createTask('Current');
    const saved = await repository.addResourceToCurrent(page());
    expect(saved.resource.taskId).toBe(task.id);
    expect(saved.taskTitle).toBe('Current');
    await repository.setTaskStatus(task.id, 'paused');
    await expect(repository.addResourceToCurrent(page())).rejects.toMatchObject({ code: 'NO_CURRENT_TASK' });
  });

  it('rejects a capture whose destination changed in another extension context before commit', async () => {
    const first = await repository.createTask('Capture started here');
    const capturedCurrentId = (await repository.getState()).currentTaskId;
    const otherDatabase = new BackToItDatabase(database.name);
    extraConnections.push(otherDatabase);
    const other = new Repository(otherDatabase);
    const second = await other.createTask('Another window started this');
    await expect(repository.addResourceToCurrent(page(), capturedCurrentId)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    let state = await repository.getState();
    expect(state.resources).toEqual([]);
    expect(state.currentTaskId).toBe(second.id);
    expect(state.tasks.find((task) => task.id === first.id)?.status).toBe('paused');
    await other.setTaskStatus(second.id, 'paused');
    await expect(repository.addResourceToCurrent(page(), second.id)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await expect(repository.addResourceToCurrent(page(), null)).rejects.toMatchObject({
      code: 'NO_CURRENT_TASK',
    });
    await other.activateTask(first.id);
    await expect(repository.addResourceToCurrent(page(), null)).rejects.toMatchObject({ code: 'CONFLICT' });
    state = await repository.getState();
    expect(state.resources).toEqual([]);
    expect(await database.undos.count()).toBe(0);
  });

  it('serializes a concurrent capture commit and task switch without saving to an unintended task', async () => {
    const first = await repository.createTask('Original capture task');
    const second = await repository.createTask('Other task');
    await repository.activateTask(first.id);
    const otherDatabase = new BackToItDatabase(database.name);
    extraConnections.push(otherDatabase);
    const other = new Repository(otherDatabase);
    const results = await Promise.allSettled([
      repository.addResourceToCurrent(page(), first.id),
      other.activateTask(second.id),
    ]);
    const save = results[0]!;
    const state = await repository.getState();
    expect(results[1]?.status).toBe('fulfilled');
    expect(state.currentTaskId).toBe(second.id);
    if (save.status === 'fulfilled') {
      expect(save.value).toMatchObject({ resource: { taskId: first.id } });
      expect(state.resources).toHaveLength(1);
    } else {
      expect(save.reason).toMatchObject({ code: 'CONFLICT' });
      expect(state.resources).toHaveLength(0);
    }
    expect(state.resources.some((resource) => resource.taskId === second.id)).toBe(false);
  });

  it('preserves data on close/reopen and reports corrupt references without clearing data', async () => {
    const task = await repository.createTask('Persistent', 'Continue');
    await repository.addResource(task.id, page({ excerpt: 'Saved' }));
    database.close();
    await database.open();
    expect((await repository.getState()).tasks[0]?.nextStep).toBe('Continue');
    expect((await repository.getState()).resources[0]?.excerpts).toEqual(['Saved']);
    await database.meta.put({ id: 'current', taskId: 'missing' });
    await expect(repository.getState()).rejects.toMatchObject({ code: 'CORRUPT_DATA' });
    expect(await database.tasks.count()).toBe(1);
    expect(await database.resources.count()).toBe(1);
  });

  it('keeps parking independent and converts only on explicit request', async () => {
    const task = await repository.createTask('Current');
    const parking = await repository.addParking('Check a camera');
    await repository.updateParking(parking.id, { done: true, text: 'Compare cameras' });
    expect((await repository.getState()).currentTaskId).toBe(task.id);
    const converted = await repository.parkingToTask(parking.id);
    const state = await repository.getState();
    expect(converted.title).toBe('Compare cameras');
    expect(state.currentTaskId).toBe(converted.id);
    expect(state.tasks.find((item) => item.id === task.id)?.status).toBe('paused');
    expect(state.parking).toEqual([]);
  });

  it('cleans only explicitly created example data, then clears all tables on request', async () => {
    expect((await repository.getState()).tasks).toEqual([]);
    const own = await repository.createTask('My task');
    await repository.addResource(own.id, page());
    const sample = await repository.createExample();
    expect(sample.isExample).toBe(true);
    await repository.clearExamples();
    let state = await repository.getState();
    expect(state.tasks.map((task) => task.id)).toEqual([own.id]);
    expect(state.resources).toHaveLength(1);
    await repository.clearAll();
    state = await repository.getState();
    expect(state.tasks).toEqual([]);
    expect(state.resources).toEqual([]);
    expect(state.currentTaskId).toBeNull();
    for (const table of database.tables) expect(await table.count()).toBe(0);
  });
});

describe('backup import transactions', () => {
  async function savedBackup(): Promise<Backup> {
    let task = await repository.createTask('Imported title', 'Next');
    await repository.addResource(task.id, page({ excerpt: 'Quote', note: 'Note' }));
    task = (await repository.getState()).tasks[0]!;
    await repository.checkpointTask(
      task.id,
      { progress: 'Recorded', blocker: 'Question', nextStep: 'Next' },
      task.revision,
    );
    await repository.activateTask(task.id);
    await repository.addParking('Independent');
    return parseBackup(JSON.stringify(await repository.exportBackup()));
  }

  it('remaps every ID and reference, keeps the existing current task and preserves all content', async () => {
    const backup = await savedBackup();
    const originalCurrent = (await repository.getState()).currentTaskId;
    const result = await repository.importBackup(backup);
    expect(result).toEqual({ tasks: 1, resources: 1, checkpoints: 1, parking: 1 });
    const state = await repository.getState();
    expect(state.currentTaskId).toBe(originalCurrent);
    const imported = state.tasks.find((task) => task.id !== originalCurrent)!;
    expect(imported.status).toBe('paused');
    expect(imported.title).toBe('Imported title');
    const resource = state.resources.find((item) => item.taskId === imported.id)!;
    const checkpoint = state.checkpoints.find((item) => item.taskId === imported.id)!;
    expect(resource.id).not.toBe(backup.resources[0]!.id);
    expect(resource.excerpts).toEqual(['Quote']);
    expect(imported.primaryResourceId).toBe(resource.id);
    expect(checkpoint.resourceIds).toEqual([resource.id]);
    expect(checkpoint.progress).toBe('Recorded');
    expect(state.parking).toHaveLength(2);
    expect(new Set(state.parking.map((item) => item.id)).size).toBe(2);
    expect(await database.undos.count()).toBe(1);
  });

  it('rejects invalid backups before writing and rolls back injected mid-import storage failures', async () => {
    const backup = await savedBackup();
    const before = await repository.getState();
    const bad = structuredClone(backup);
    bad.resources[0]!.taskId = 'missing';
    await expect(repository.importBackup(bad)).rejects.toThrow();
    expect(await repository.getState()).toEqual(before);
    const fail = () => {
      throw new Error('Synthetic quota failure');
    };
    database.resources.hook('creating', fail);
    await expect(repository.importBackup(backup)).rejects.toThrow('Synthetic quota failure');
    database.resources.hook('creating').unsubscribe(fail);
    expect(await repository.getState()).toEqual(before);
  });

  it('blocks overlapping import submissions instead of duplicating an import', async () => {
    const backup = await savedBackup();
    const results = await Promise.allSettled([
      repository.importBackup(backup),
      repository.importBackup(backup),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((item) => item.status === 'rejected')).toMatchObject({
      reason: { code: 'IMPORT_IN_PROGRESS' },
    });
    expect((await repository.getState()).tasks).toHaveLength(2);
  });

  it('rolls back aggregate quota failures so its own exports stay below the import ceiling', async () => {
    const backup = await savedBackup();
    const before = await repository.getState();
    const large = structuredClone(backup);
    const template = large.resources[0]!;
    large.tasks[0]!.primaryResourceId = null;
    large.checkpoints[0]!.resourceIds = [];
    large.resources = Array.from({ length: 9 }, (_, index) => ({
      ...template,
      id: `large-resource-${index}`,
      url: `https://example.test/large-${index}`,
      excerpts: Array.from({ length: 40 }, (_, excerpt) => `${excerpt}:`.padEnd(LIMITS.excerpt, 'x')),
    }));
    const bytes = new TextEncoder().encode(JSON.stringify(large)).byteLength;
    expect(bytes).toBeGreaterThan(LIMITS.contentBytes);
    expect(bytes).toBeLessThan(LIMITS.backupBytes);
    await expect(repository.importBackup(large)).rejects.toMatchObject({ code: 'LIMIT_REACHED' });
    expect(await repository.getState()).toEqual(before);
    expect(new TextEncoder().encode(JSON.stringify(await repository.exportBackup())).byteLength).toBeLessThan(
      LIMITS.backupBytes,
    );
  });
});
