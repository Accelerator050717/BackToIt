import Dexie, { type Table } from 'dexie';
import {
  backupSchema,
  idSchema,
  LIMITS,
  parkingPatchSchema,
  resourceInputSchema,
  resourcePatchSchema,
  resourceSchema,
  revisionSchema,
  taskFieldsSchema,
  taskPatchSchema,
  taskStatusSchema,
  titleSchema,
} from '../domain/schemas';
import { inspectUrl } from '../domain/url';
import type {
  AppSnapshot,
  Backup,
  Checkpoint,
  ParkingItem,
  Resource,
  ResourceInput,
  Task,
  TaskFields,
  TaskStatus,
} from '../domain/types';

interface CurrentState {
  id: 'current';
  taskId: string | null;
}
interface ResourceUndo {
  id: string;
  taskId: string;
  resourceId: string;
  afterRevision: number;
  before: Resource | null;
  createdAt: number;
}

export class RepositoryError extends Error {
  constructor(
    public readonly code:
      | 'CONFLICT'
      | 'NOT_FOUND'
      | 'NO_CURRENT_TASK'
      | 'LIMIT_REACHED'
      | 'CORRUPT_DATA'
      | 'IMPORT_IN_PROGRESS',
    message = code,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export class BackToItDatabase extends Dexie {
  tasks!: Table<Task, string>;
  resources!: Table<Resource, string>;
  checkpoints!: Table<Checkpoint, string>;
  parking!: Table<ParkingItem, string>;
  meta!: Table<CurrentState, string>;
  undos!: Table<ResourceUndo, string>;

  constructor(name = 'backtoit-v1') {
    super(name);
    this.version(1).stores({
      tasks: 'id, status, updatedAt',
      resources: 'id, taskId, [taskId+url], savedAt',
      checkpoints: 'id, taskId, createdAt',
      parking: 'id, createdAt',
      meta: 'id',
      undos: 'id, taskId, resourceId, createdAt',
    });
  }
}

const newId = () => crypto.randomUUID();
const now = () => Date.now();
function assertRevision(actual: number, expected: number): void {
  revisionSchema.parse(expected);
  if (actual !== expected) throw new RepositoryError('CONFLICT');
}

export class Repository {
  private importing = false;
  constructor(public readonly database: BackToItDatabase) {}

  private write<T>(operation: () => Promise<T>, checkCapacity = true): Promise<T> {
    // Every command shares the same transaction scope across extension contexts.
    // No network requests or timers run inside these transactions.
    return this.database.transaction('rw', this.database.tables, async () => {
      const result = await operation();
      if (checkCapacity) {
        const [tasks, resources, checkpoints, parking] = await Promise.all([
          this.database.tasks.toArray(),
          this.database.resources.toArray(),
          this.database.checkpoints.toArray(),
          this.database.parking.toArray(),
        ]);
        // Keep a full MiB below the import ceiling so our own exports remain
        // importable. This local quota rolls the entire command back on failure.
        const content = JSON.stringify({
          schemaVersion: 1,
          exportedAt: now(),
          tasks,
          resources,
          checkpoints,
          parking,
        });
        if (new TextEncoder().encode(content).byteLength > LIMITS.contentBytes)
          throw new RepositoryError('LIMIT_REACHED');
      }
      return result;
    });
  }

  private async task(id: string): Promise<Task> {
    idSchema.parse(id);
    const task = await this.database.tasks.get(id);
    if (!task) throw new RepositoryError('NOT_FOUND');
    return task;
  }

  private async resource(id: string): Promise<Resource> {
    idSchema.parse(id);
    const resource = await this.database.resources.get(id);
    if (!resource) throw new RepositoryError('NOT_FOUND');
    return resource;
  }

  private async limit(table: Table, max: number, adding = 1): Promise<void> {
    if ((await table.count()) + adding > max) throw new RepositoryError('LIMIT_REACHED');
  }

  private async touch(task: Task, patch: Partial<Task> = {}): Promise<Task> {
    const updated = {
      ...task,
      ...patch,
      revision: task.revision + 1,
      updatedAt: Math.max(now(), task.updatedAt),
    };
    await this.database.tasks.put(updated);
    return updated;
  }

  private async activate(task: Task): Promise<Task> {
    const active = await this.database.tasks.where('status').equals('active').toArray();
    for (const previous of active) {
      if (previous.id !== task.id) await this.touch(previous, { status: 'paused' });
    }
    const updated = task.status === 'active' ? task : await this.touch(task, { status: 'active' });
    await this.database.meta.put({ id: 'current', taskId: task.id });
    return updated;
  }

  private async clearPointer(id: string): Promise<void> {
    const current = await this.database.meta.get('current');
    if (current?.taskId === id) await this.database.meta.put({ id: 'current', taskId: null });
  }

  async getState(): Promise<AppSnapshot> {
    return this.database.transaction('r', this.database.tables, async () => {
      const [tasks, resources, checkpoints, parking, current] = await Promise.all([
        this.database.tasks.toArray(),
        this.database.resources.toArray(),
        this.database.checkpoints.toArray(),
        this.database.parking.toArray(),
        this.database.meta.get('current'),
      ]);
      const parsed = backupSchema.safeParse({
        schemaVersion: 1,
        exportedAt: now(),
        tasks,
        resources,
        checkpoints,
        parking,
      });
      const currentTaskId = current?.taskId ?? null;
      const active = tasks.filter((task) => task.status === 'active');
      if (
        !parsed.success ||
        (currentTaskId === null
          ? active.length !== 0
          : active.length !== 1 || active[0]?.id !== currentTaskId)
      ) {
        throw new RepositoryError('CORRUPT_DATA');
      }
      return {
        tasks: tasks.sort((a, b) => b.updatedAt - a.updatedAt),
        resources: resources.sort((a, b) => b.savedAt - a.savedAt),
        checkpoints: checkpoints.sort((a, b) => b.createdAt - a.createdAt),
        parking: parking.sort((a, b) => b.createdAt - a.createdAt),
        currentTaskId,
      };
    });
  }

  private async create(title: string, nextStep: string, isExample: boolean): Promise<Task> {
    await this.limit(this.database.tasks, LIMITS.tasks);
    const timestamp = now();
    const task: Task = {
      id: newId(),
      title,
      status: 'paused',
      progress: '',
      blocker: '',
      nextStep,
      primaryResourceId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: 1,
      isExample,
    };
    await this.database.tasks.add(task);
    return this.activate(task);
  }

  async createTask(title: string, nextStep = '', isExample = false): Promise<Task> {
    const validTitle = titleSchema.parse(title);
    const fields = taskFieldsSchema.parse({ progress: '', blocker: '', nextStep });
    return this.write(() => this.create(validTitle, fields.nextStep, isExample === true));
  }

  async updateTask(
    id: string,
    patch: Partial<Pick<Task, 'title' | 'progress' | 'blocker' | 'nextStep'>>,
    expectedRevision: number,
  ): Promise<Task> {
    const valid = taskPatchSchema.parse(patch);
    return this.write(async () => {
      const task = await this.task(id);
      assertRevision(task.revision, expectedRevision);
      if (Object.entries(valid).every(([key, value]) => task[key as keyof typeof valid] === value))
        return task;
      return this.touch(task, valid);
    });
  }

  async activateTask(id: string): Promise<Task> {
    return this.write(async () => this.activate(await this.task(id)));
  }

  async checkpointTask(id: string, fields: TaskFields, expectedRevision: number): Promise<Checkpoint> {
    const valid = taskFieldsSchema.parse(fields);
    return this.write(async () => {
      const task = await this.task(id);
      assertRevision(task.revision, expectedRevision);
      await this.limit(this.database.checkpoints, LIMITS.checkpoints);
      const resources = await this.database.resources.where('taskId').equals(id).primaryKeys();
      const checkpoint: Checkpoint = {
        id: newId(),
        taskId: id,
        ...valid,
        resourceIds: resources,
        createdAt: now(),
      };
      await this.database.checkpoints.add(checkpoint);
      await this.touch(task, { ...valid, status: 'paused' });
      await this.clearPointer(id);
      return checkpoint;
    });
  }

  async setTaskStatus(id: string, status: TaskStatus): Promise<Task> {
    taskStatusSchema.parse(status);
    return this.write(async () => {
      const task = await this.task(id);
      if (status === 'active') return this.activate(task);
      await this.clearPointer(id);
      return task.status === status ? task : this.touch(task, { status });
    });
  }

  private async deleteTaskData(id: string): Promise<void> {
    await this.database.resources.where('taskId').equals(id).delete();
    await this.database.checkpoints.where('taskId').equals(id).delete();
    await this.database.undos.where('taskId').equals(id).delete();
    await this.database.tasks.delete(id);
    await this.clearPointer(id);
  }

  async deleteTask(id: string): Promise<void> {
    idSchema.parse(id);
    return this.write(() => this.deleteTaskData(id), false);
  }

  private async add(task: Task, input: ResourceInput): Promise<{ resource: Resource; undoId: string }> {
    const url = input.url === null ? null : inspectUrl(input.url).url;
    const existing =
      url === null
        ? undefined
        : await this.database.resources.where('[taskId+url]').equals([task.id, url]).first();
    const excerpt = input.excerpt?.trim();
    const excerpts = existing ? [...existing.excerpts] : [];
    if (excerpt && !excerpts.includes(excerpt)) excerpts.push(excerpt);
    let note = existing?.note ?? '';
    const incomingNote = input.note?.trim();
    if (incomingNote && incomingNote !== note) note = note ? `${note}\n\n${incomingNote}` : incomingNote;
    const resource: Resource = resourceSchema.parse({
      id: existing?.id ?? newId(),
      taskId: task.id,
      title: existing?.title ?? input.title,
      url,
      excerpts,
      note,
      source: existing?.source ?? input.source,
      savedAt: now(),
      revision: (existing?.revision ?? 0) + 1,
    });
    if (!existing) await this.limit(this.database.resources, LIMITS.resources);
    const undo: ResourceUndo = {
      id: newId(),
      taskId: task.id,
      resourceId: resource.id,
      afterRevision: resource.revision,
      before: existing ?? null,
      createdAt: now(),
    };
    await this.database.resources.put(resource);
    // Only the last save for a resource can be undone. Do not retain stale text copies.
    await this.database.undos.where('resourceId').equals(resource.id).delete();
    await this.database.undos.add(undo);
    const oldUndoIds = await this.database.undos.orderBy('createdAt').reverse().offset(50).primaryKeys();
    await this.database.undos.bulkDelete(oldUndoIds);
    await this.touch(task, { primaryResourceId: task.primaryResourceId ?? resource.id });
    return { resource, undoId: undo.id };
  }

  async addResource(taskId: string, input: ResourceInput): Promise<{ resource: Resource; undoId: string }> {
    const valid = resourceInputSchema.parse(input);
    return this.write(async () => this.add(await this.task(taskId), valid));
  }

  async addResourceToCurrent(
    input: ResourceInput,
    expectedCurrentTaskId?: string | null,
  ): Promise<{ resource: Resource; undoId: string; taskTitle: string }> {
    const valid = resourceInputSchema.parse(input);
    if (expectedCurrentTaskId !== undefined && expectedCurrentTaskId !== null)
      idSchema.parse(expectedCurrentTaskId);
    return this.write(async () => {
      const current = await this.database.meta.get('current');
      // Browser capture runs outside IndexedDB. Its starting task must still be
      // current at commit; otherwise retain the capture for an explicit choice.
      if (expectedCurrentTaskId !== undefined && (current?.taskId ?? null) !== expectedCurrentTaskId) {
        throw new RepositoryError('CONFLICT');
      }
      if (!current?.taskId) throw new RepositoryError('NO_CURRENT_TASK');
      const task = await this.task(current.taskId);
      if (task.status !== 'active') throw new RepositoryError('CORRUPT_DATA');
      return { ...(await this.add(task, valid)), taskTitle: task.title };
    });
  }

  private async removeResourceData(resource: Resource): Promise<void> {
    await this.database.resources.delete(resource.id);
    await this.database.undos.where('resourceId').equals(resource.id).delete();
    const checkpoints = await this.database.checkpoints.where('taskId').equals(resource.taskId).toArray();
    for (const checkpoint of checkpoints) {
      if (checkpoint.resourceIds.includes(resource.id)) {
        await this.database.checkpoints.update(checkpoint.id, {
          resourceIds: checkpoint.resourceIds.filter((id) => id !== resource.id),
        });
      }
    }
    const task = await this.task(resource.taskId);
    await this.touch(task, {
      primaryResourceId: task.primaryResourceId === resource.id ? null : task.primaryResourceId,
    });
  }

  async undoResource(undoId: string): Promise<boolean> {
    idSchema.parse(undoId);
    return this.write(async () => {
      const undo = await this.database.undos.get(undoId);
      if (!undo) return false;
      const resource = await this.database.resources.get(undo.resourceId);
      if (!resource || resource.revision !== undo.afterRevision) throw new RepositoryError('CONFLICT');
      if (undo.before === null) await this.removeResourceData(resource);
      else {
        await this.database.resources.put({ ...undo.before, revision: resource.revision + 1 });
        await this.database.undos.delete(undoId);
        await this.touch(await this.task(resource.taskId));
      }
      return true;
    }, false);
  }

  async updateResource(
    id: string,
    patch: Partial<Pick<Resource, 'title' | 'note'>>,
    expectedRevision: number,
  ): Promise<Resource> {
    const valid = resourcePatchSchema.parse(patch);
    return this.write(async () => {
      const resource = await this.resource(id);
      assertRevision(resource.revision, expectedRevision);
      if (Object.entries(valid).every(([key, value]) => resource[key as keyof typeof valid] === value))
        return resource;
      const updated = { ...resource, ...valid, revision: resource.revision + 1 };
      await this.database.resources.put(updated);
      await this.database.undos.where('resourceId').equals(id).delete();
      await this.touch(await this.task(resource.taskId));
      return updated;
    });
  }

  async removeResource(id: string): Promise<void> {
    idSchema.parse(id);
    return this.write(async () => {
      const resource = await this.database.resources.get(id);
      if (resource) await this.removeResourceData(resource);
    }, false);
  }

  async setPrimaryResource(taskId: string, resourceId: string | null): Promise<Task> {
    return this.write(async () => {
      const task = await this.task(taskId);
      if (resourceId !== null && (await this.resource(resourceId)).taskId !== taskId)
        throw new RepositoryError('NOT_FOUND');
      return task.primaryResourceId === resourceId
        ? task
        : this.touch(task, { primaryResourceId: resourceId });
    });
  }

  async deleteCheckpoint(id: string): Promise<void> {
    idSchema.parse(id);
    return this.write(async () => {
      const checkpoint = await this.database.checkpoints.get(id);
      if (!checkpoint) return;
      await this.database.checkpoints.delete(id);
    }, false);
  }

  async addParking(text: string): Promise<ParkingItem> {
    const valid = parkingPatchSchema.parse({ text }).text!;
    return this.write(async () => {
      await this.limit(this.database.parking, LIMITS.parking);
      const timestamp = now();
      const item: ParkingItem = {
        id: newId(),
        text: valid,
        done: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await this.database.parking.add(item);
      return item;
    });
  }

  async updateParking(id: string, patch: Partial<Pick<ParkingItem, 'text' | 'done'>>): Promise<ParkingItem> {
    idSchema.parse(id);
    const valid = parkingPatchSchema.parse(patch);
    return this.write(async () => {
      const item = await this.database.parking.get(id);
      if (!item) throw new RepositoryError('NOT_FOUND');
      const updated = { ...item, ...valid, updatedAt: Math.max(now(), item.updatedAt) };
      await this.database.parking.put(updated);
      return updated;
    });
  }

  async deleteParking(id: string): Promise<void> {
    idSchema.parse(id);
    return this.write(() => this.database.parking.delete(id), false);
  }

  async parkingToTask(id: string): Promise<Task> {
    idSchema.parse(id);
    return this.write(async () => {
      const item = await this.database.parking.get(id);
      if (!item) throw new RepositoryError('NOT_FOUND');
      const task = await this.create(
        item.text.slice(0, LIMITS.title),
        item.text.length > LIMITS.title ? item.text : '',
        false,
      );
      await this.database.parking.delete(id);
      return task;
    });
  }

  async exportBackup(): Promise<Backup> {
    const state = await this.getState();
    return backupSchema.parse({
      schemaVersion: 1,
      exportedAt: now(),
      tasks: state.tasks,
      resources: state.resources,
      checkpoints: state.checkpoints,
      parking: state.parking,
    });
  }

  async importBackup(
    input: Backup,
  ): Promise<{ tasks: number; resources: number; checkpoints: number; parking: number }> {
    if (this.importing) throw new RepositoryError('IMPORT_IN_PROGRESS');
    const backup = backupSchema.parse(input);
    if (new TextEncoder().encode(JSON.stringify(backup)).byteLength > LIMITS.backupBytes)
      throw new RepositoryError('LIMIT_REACHED');
    this.importing = true;
    try {
      const ids = new Map<string, string>();
      for (const entity of [...backup.tasks, ...backup.resources, ...backup.checkpoints, ...backup.parking])
        ids.set(entity.id, newId());
      const mappedId = (id: string) => ids.get(id)!;
      const tasks: Task[] = backup.tasks.map((task) => ({
        ...task,
        id: mappedId(task.id),
        status: task.status === 'active' ? 'paused' : task.status,
        primaryResourceId: task.primaryResourceId ? mappedId(task.primaryResourceId) : null,
        revision: 1,
      }));
      const resources: Resource[] = backup.resources.map((resource) => ({
        ...resource,
        id: mappedId(resource.id),
        taskId: mappedId(resource.taskId),
        revision: 1,
      }));
      const checkpoints: Checkpoint[] = backup.checkpoints.map((checkpoint) => ({
        ...checkpoint,
        id: mappedId(checkpoint.id),
        taskId: mappedId(checkpoint.taskId),
        resourceIds: checkpoint.resourceIds.map(mappedId),
      }));
      const parking: ParkingItem[] = backup.parking.map((item) => ({ ...item, id: mappedId(item.id) }));
      return await this.write(async () => {
        await this.limit(this.database.tasks, LIMITS.tasks, tasks.length);
        await this.limit(this.database.resources, LIMITS.resources, resources.length);
        await this.limit(this.database.checkpoints, LIMITS.checkpoints, checkpoints.length);
        await this.limit(this.database.parking, LIMITS.parking, parking.length);
        await this.database.tasks.bulkAdd(tasks);
        await this.database.resources.bulkAdd(resources);
        await this.database.checkpoints.bulkAdd(checkpoints);
        await this.database.parking.bulkAdd(parking);
        return {
          tasks: tasks.length,
          resources: resources.length,
          checkpoints: checkpoints.length,
          parking: parking.length,
        };
      });
    } finally {
      this.importing = false;
    }
  }

  async clearExamples(): Promise<void> {
    return this.write(async () => {
      const examples = await this.database.tasks.filter((task) => task.isExample).primaryKeys();
      for (const id of examples) await this.deleteTaskData(id);
    }, false);
  }

  async clearAll(): Promise<void> {
    return this.write(async () => {
      for (const table of this.database.tables) await table.clear();
    }, false);
  }

  async createExample(): Promise<Task> {
    return this.write(async () => {
      const existing = await this.database.tasks.filter((task) => task.isExample).first();
      if (existing) return this.activate(existing);
      let task = await this.create('理解参数方程的切线', '打开例题，分别写出 dx/dt 和 dy/dt。', true);
      task = await this.touch(task, {
        progress: '看完了 dy/dx 的推导。',
        blocker: '想再看一次 dx/dt 等于 0 的情况。',
      });
      await this.add(task, {
        title: '示例笔记：参数方程',
        url: null,
        excerpt: '先分别求 x(t) 与 y(t) 的导数，再检查 dx/dt 是否为 0。',
        note: '这是一条演示笔记，可以编辑或移除。',
        source: 'manual',
      });
      return this.task(task.id);
    });
  }
}

export const db = new BackToItDatabase();
export const repo = new Repository(db);
