import { z } from 'zod';
import { inspectUrl } from './url';

export const LIMITS = {
  backupBytes: 5 * 1024 * 1024,
  contentBytes: 4 * 1024 * 1024,
  tasks: 500,
  resources: 5000,
  checkpoints: 5000,
  parking: 2000,
  title: 240,
  resourceTitle: 500,
  text: 6000,
  nextStep: 2000,
  excerpt: 12000,
  excerpts: 40,
  url: 8192,
  parkingText: 2000,
} as const;

export const idSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
export const timestampSchema = z.number().int().nonnegative().max(8_640_000_000_000_000);
export const revisionSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const titleSchema = z.string().trim().min(1).max(LIMITS.title);
export const taskStatusSchema = z.enum(['active', 'paused', 'completed', 'archived']);
export const taskFieldsSchema = z.strictObject({
  progress: z.string().max(LIMITS.text),
  blocker: z.string().max(LIMITS.text),
  nextStep: z.string().max(LIMITS.nextStep),
});
export const taskPatchSchema = z.strictObject({
  title: titleSchema.optional(),
  progress: z.string().max(LIMITS.text).optional(),
  blocker: z.string().max(LIMITS.text).optional(),
  nextStep: z.string().max(LIMITS.nextStep).optional(),
});
export const resourceUrlSchema = z
  .string()
  .max(LIMITS.url)
  .refine((raw) => {
    try {
      return inspectUrl(raw).url === raw;
    } catch {
      return false;
    }
  }, 'Resource URL must be a sanitized HTTP(S) URL');
export const taskSchema = z
  .strictObject({
    id: idSchema,
    title: titleSchema,
    status: taskStatusSchema,
    ...taskFieldsSchema.shape,
    primaryResourceId: idSchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    revision: revisionSchema,
    isExample: z.boolean(),
  })
  .refine((task) => task.updatedAt >= task.createdAt, 'Invalid task timestamps');
export const resourceSchema = z.strictObject({
  id: idSchema,
  taskId: idSchema,
  title: z.string().trim().min(1).max(LIMITS.resourceTitle),
  url: resourceUrlSchema.nullable(),
  excerpts: z.array(z.string().min(1).max(LIMITS.excerpt)).max(LIMITS.excerpts),
  note: z.string().max(LIMITS.text),
  source: z.enum(['page', 'selection', 'manual']),
  savedAt: timestampSchema,
  revision: revisionSchema,
});
export const checkpointSchema = z.strictObject({
  id: idSchema,
  taskId: idSchema,
  ...taskFieldsSchema.shape,
  resourceIds: z.array(idSchema).max(LIMITS.resources),
  createdAt: timestampSchema,
});
export const parkingSchema = z
  .strictObject({
    id: idSchema,
    text: z.string().trim().min(1).max(LIMITS.parkingText),
    done: z.boolean(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .refine((item) => item.updatedAt >= item.createdAt, 'Invalid parking timestamps');
export const resourceInputSchema = z.strictObject({
  title: z.string().trim().min(1).max(LIMITS.resourceTitle),
  url: z.string().max(LIMITS.url).nullable(),
  excerpt: z.string().max(LIMITS.excerpt).optional(),
  note: z.string().max(LIMITS.text).optional(),
  source: z.enum(['page', 'selection', 'manual']),
});
export const resourcePatchSchema = z.strictObject({
  title: z.string().trim().min(1).max(LIMITS.resourceTitle).optional(),
  note: z.string().max(LIMITS.text).optional(),
});
export const parkingPatchSchema = z.strictObject({
  text: z.string().trim().min(1).max(LIMITS.parkingText).optional(),
  done: z.boolean().optional(),
});

export const backupSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    exportedAt: timestampSchema,
    tasks: z.array(taskSchema).max(LIMITS.tasks),
    resources: z.array(resourceSchema).max(LIMITS.resources),
    checkpoints: z.array(checkpointSchema).max(LIMITS.checkpoints),
    parking: z.array(parkingSchema).max(LIMITS.parking),
  })
  .superRefine((backup, ctx) => {
    const allIds = new Set<string>();
    const tasks = new Map(backup.tasks.map((task) => [task.id, task]));
    const resources = new Map(backup.resources.map((resource) => [resource.id, resource]));
    let active = 0;
    for (const kind of ['tasks', 'resources', 'checkpoints', 'parking'] as const) {
      backup[kind].forEach((entity, index) => {
        if (allIds.has(entity.id))
          ctx.addIssue({ code: 'custom', path: [kind, index, 'id'], message: 'Duplicate ID' });
        allIds.add(entity.id);
      });
    }
    backup.tasks.forEach((task, index) => {
      if (task.status === 'active') active++;
      if (task.primaryResourceId && resources.get(task.primaryResourceId)?.taskId !== task.id) {
        ctx.addIssue({
          code: 'custom',
          path: ['tasks', index, 'primaryResourceId'],
          message: 'Invalid primary resource reference',
        });
      }
    });
    if (active > 1) ctx.addIssue({ code: 'custom', path: ['tasks'], message: 'Multiple current tasks' });
    const uniqueUrls = new Set<string>();
    backup.resources.forEach((resource, index) => {
      if (!tasks.has(resource.taskId))
        ctx.addIssue({ code: 'custom', path: ['resources', index, 'taskId'], message: 'Orphan resource' });
      if (resource.url) {
        const key = `${resource.taskId}\n${resource.url}`;
        if (uniqueUrls.has(key))
          ctx.addIssue({ code: 'custom', path: ['resources', index, 'url'], message: 'Duplicate task URL' });
        uniqueUrls.add(key);
      }
    });
    backup.checkpoints.forEach((checkpoint, index) => {
      if (!tasks.has(checkpoint.taskId))
        ctx.addIssue({
          code: 'custom',
          path: ['checkpoints', index, 'taskId'],
          message: 'Orphan checkpoint',
        });
      const refs = new Set<string>();
      checkpoint.resourceIds.forEach((id, refIndex) => {
        if (refs.has(id) || resources.get(id)?.taskId !== checkpoint.taskId) {
          ctx.addIssue({
            code: 'custom',
            path: ['checkpoints', index, 'resourceIds', refIndex],
            message: 'Invalid checkpoint reference',
          });
        }
        refs.add(id);
      });
    });
  });
