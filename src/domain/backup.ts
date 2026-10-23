import { backupSchema, LIMITS } from './schemas';
import type { Backup, Checkpoint, Resource, Task } from './types';

export function parseBackup(text: string): Backup {
  if (
    typeof text !== 'string' ||
    text.length > LIMITS.backupBytes ||
    new TextEncoder().encode(text).byteLength > LIMITS.backupBytes
  ) {
    throw new Error('BACKUP_TOO_LARGE');
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new Error('BACKUP_INVALID_JSON');
  }
  return backupSchema.parse(value);
}

function plain(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([\\`*_{}[\]()#+.!|~-])/g, '\\$1');
}

export function toMarkdown(task: Task, resources: Resource[], checkpoints: Checkpoint[]): string {
  const ownResources = resources.filter((resource) => resource.taskId === task.id);
  const ownCheckpoints = checkpoints
    .filter((checkpoint) => checkpoint.taskId === task.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  const resourceMap = new Map(ownResources.map((resource) => [resource.id, resource]));
  const lines = [
    `# ${plain(task.title)}`,
    '',
    `Status / 状态: ${task.status}`,
    '',
    '## Progress / 做到哪了',
    '',
    plain(task.progress) || '—',
    '',
    '## Blocker / 卡在哪里',
    '',
    plain(task.blocker) || '—',
    '',
    '## Next step / 下一步',
    '',
    plain(task.nextStep) || '—',
    '',
    '## Resources / 资料',
    '',
  ];
  for (const resource of ownResources.sort((a, b) => b.savedAt - a.savedAt)) {
    lines.push(
      `### ${plain(resource.title)}`,
      '',
      `Saved / 保存于: ${new Date(resource.savedAt).toISOString()}`,
      '',
    );
    if (resource.url) lines.push(`<${resource.url.replace(/</g, '%3C').replace(/>/g, '%3E')}>`, '');
    if (resource.note) lines.push(plain(resource.note), '');
    for (const excerpt of resource.excerpts)
      lines.push(
        ...plain(excerpt)
          .split('\n')
          .map((line) => `> ${line}`),
        '',
      );
  }
  lines.push('## Checkpoints / 历史现场', '');
  for (const checkpoint of ownCheckpoints) {
    lines.push(
      `### ${new Date(checkpoint.createdAt).toISOString()}`,
      '',
      `Progress / 进度: ${plain(checkpoint.progress) || '—'}`,
      '',
      `Blocker / 卡点: ${plain(checkpoint.blocker) || '—'}`,
      '',
      `Next step / 下一步: ${plain(checkpoint.nextStep) || '—'}`,
      '',
      ...checkpoint.resourceIds.flatMap((id) => {
        const resource = resourceMap.get(id);
        return resource ? [`- ${plain(resource.title)}`] : [];
      }),
      '',
    );
  }
  return `${lines.join('\n')}\n`;
}
