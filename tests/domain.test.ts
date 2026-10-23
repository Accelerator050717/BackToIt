import { describe, expect, it } from 'vitest';
import { parseBackup, toMarkdown } from '../src/domain/backup';
import { LIMITS } from '../src/domain/schemas';
import { inspectUrl } from '../src/domain/url';
import type { Backup, Task } from '../src/domain/types';

function fixture(): Backup {
  return {
    schemaVersion: 1,
    exportedAt: 100,
    tasks: [
      {
        id: 'task-1',
        title: 'Task',
        status: 'paused',
        progress: 'Draft',
        blocker: '',
        nextStep: 'Continue',
        primaryResourceId: 'resource-1',
        createdAt: 1,
        updatedAt: 2,
        revision: 1,
        isExample: false,
      },
    ],
    resources: [
      {
        id: 'resource-1',
        taskId: 'task-1',
        title: 'Page',
        url: 'https://example.test/read?q=math#part-2',
        excerpts: ['Saved text'],
        note: 'A note',
        source: 'selection',
        savedAt: 2,
        revision: 1,
      },
    ],
    checkpoints: [
      {
        id: 'checkpoint-1',
        taskId: 'task-1',
        progress: 'Old draft',
        blocker: '',
        nextStep: 'Check example',
        resourceIds: ['resource-1'],
        createdAt: 2,
      },
    ],
    parking: [{ id: 'parking-1', text: 'Later', done: false, createdAt: 1, updatedAt: 1 }],
  };
}

describe('resource URL handling', () => {
  it('removes credentials and known tracking without merging meaningful queries or fragments', () => {
    const result = inspectUrl(
      'https://alice:secret@example.test/p?utm_source=mail&chapter=2&ref=notes#example-4',
    );
    expect(result.url).toBe('https://example.test/p?chapter=2&ref=notes#example-4');
    expect(result.removedTracking).toBe(true);
    expect(result.sensitive).toBe(false);
    expect(inspectUrl('https://example.test/p?chapter=3#example-4').url).not.toBe(result.url);
  });

  it('flags signed and credential URLs, producing an explicit safe alternative', () => {
    const result = inspectUrl('https://example.test/read?chapter=2&X-Amz-Signature=synth&token=demo#part-2');
    expect(result.sensitive).toBe(true);
    expect(result.url).toContain('token=demo');
    expect(result.safeUrl).toBe('https://example.test/read?chapter=2#part-2');
  });

  it('also handles OAuth and route query secrets inside fragments', () => {
    expect(inspectUrl('https://example.test/#access_token=synth&state=ok').safeUrl).toBe(
      'https://example.test/#state=ok',
    );
    expect(inspectUrl('https://example.test/#/lesson?token=synth&chapter=3').safeUrl).toBe(
      'https://example.test/#/lesson?chapter=3',
    );
    expect(inspectUrl('https://example.test/#section-one').safeUrl).toBe('https://example.test/#section-one');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/plain,hi',
    'file:///tmp/read',
    'chrome://settings',
    'about:blank',
    '',
    'not a URL',
  ])('rejects unsupported input %s', (input) => {
    expect(() => inspectUrl(input)).toThrow();
  });
});

describe('backup validation', () => {
  it('roundtrips complete data, and excludes no required content', () => {
    const data = fixture();
    expect(parseBackup(JSON.stringify(data))).toEqual(data);
  });

  it('rejects unknown versions, malformed JSON, unknown fields and prototype-shaped input', () => {
    expect(() => parseBackup('{')).toThrow('BACKUP_INVALID_JSON');
    expect(() => parseBackup(JSON.stringify({ ...fixture(), schemaVersion: 2 }))).toThrow();
    expect(() => parseBackup(JSON.stringify({ ...fixture(), ollama: { model: 'secret' } }))).toThrow();
    const text = JSON.stringify(fixture()).replace(
      '"schemaVersion":1',
      '"schemaVersion":1,"__proto__":{"polluted":true}',
    );
    expect(() => parseBackup(text)).toThrow();
    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it('checks UTF-8 bytes rather than treating characters as bytes', () => {
    const text = '字'.repeat(Math.ceil(LIMITS.backupBytes / 3) + 1);
    expect(text.length).toBeLessThan(LIMITS.backupBytes);
    expect(() => parseBackup(text)).toThrow('BACKUP_TOO_LARGE');
  });

  it('rejects orphan, cross-task and duplicate references before import', () => {
    const orphan = fixture();
    orphan.resources[0]!.taskId = 'missing';
    expect(() => parseBackup(JSON.stringify(orphan))).toThrow();
    const crossTask = fixture();
    crossTask.tasks.push({ ...crossTask.tasks[0]!, id: 'task-2' });
    expect(() => parseBackup(JSON.stringify(crossTask))).toThrow();
    const duplicate = fixture();
    duplicate.checkpoints[0]!.resourceIds.push('resource-1');
    expect(() => parseBackup(JSON.stringify(duplicate))).toThrow();
    const duplicateIds = fixture();
    duplicateIds.parking[0]!.id = 'task-1';
    expect(() => parseBackup(JSON.stringify(duplicateIds))).toThrow();
  });

  it('rejects multiple current tasks and dangerous or unsanitized saved URLs', () => {
    const data = fixture();
    data.tasks[0]!.status = 'active';
    data.tasks.push({ ...data.tasks[0]!, id: 'task-2', primaryResourceId: null });
    expect(() => parseBackup(JSON.stringify(data))).toThrow();
    for (const url of [
      'javascript:alert(1)',
      'https://user:pass@example.test/',
      'https://example.test/?utm_source=mail',
    ]) {
      const data = fixture();
      data.resources[0]!.url = url;
      expect(() => parseBackup(JSON.stringify(data))).toThrow();
    }
  });

  it('rejects oversized collections and fields', () => {
    const data = fixture();
    data.tasks = Array.from({ length: 501 }, (_, i) => ({
      ...data.tasks[0]!,
      id: `task-${i}`,
      primaryResourceId: null,
    }));
    expect(() => parseBackup(JSON.stringify(data))).toThrow();
    const tooLong = fixture();
    tooLong.tasks[0]!.nextStep = 'a'.repeat(LIMITS.nextStep + 1);
    expect(() => parseBackup(JSON.stringify(tooLong))).toThrow();
  });

  it('exports only the selected task as readable safe Markdown and reference-only history', () => {
    const data = fixture();
    const task: Task = { ...data.tasks[0]!, title: '<script>bad</script> **task**' };
    const markdown = toMarkdown(
      task,
      [
        ...data.resources,
        { ...data.resources[0]!, id: 'other', taskId: 'other-task', title: 'Unrelated private text' },
      ],
      data.checkpoints,
    );
    expect(markdown).toContain('Old draft');
    expect(markdown).toContain('Saved text');
    expect(markdown).toContain('https://example.test/read?q=math#part-2');
    expect(markdown).not.toContain('<script>');
    expect(markdown).not.toContain('Unrelated private text');
  });
});
