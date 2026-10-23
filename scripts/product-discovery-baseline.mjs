import { mkdir, mkdtemp, readdir, readFile, writeFile, cp, symlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const evidence = join(root, 'artifacts/product-discovery');
await mkdir(join(evidence, 'baseline-logs'), { recursive: true });
const originalFolders = ['src', 'entrypoints', 'tests', 'e2e', 'public'];
const originalFiles = [
  'package.json',
  'pnpm-lock.yaml',
  '.npmrc',
  'wxt.config.ts',
  'tsconfig.json',
  'eslint.config.js',
  'vitest.config.ts',
  'playwright.config.ts',
  '.prettierrc.json',
  '.prettierignore',
  'scripts/package.mjs',
  'scripts/verify.mjs',
  'scripts/diagnose-entrypoints.mjs',
];
async function hashes(paths, base = root) {
  const result = {};
  async function visit(path) {
    const entries = await readdir(path, { withFileTypes: true });
    for (const entry of entries) {
      const pathname = join(path, entry.name);
      if (entry.isDirectory()) await visit(pathname);
      else
        result[relative(base, pathname).replaceAll('\\', '/')] = createHash('sha256')
          .update(await readFile(pathname))
          .digest('hex');
    }
  }
  for (const item of paths) {
    const path = resolve(base, item);
    if (!existsSync(path)) continue;
    if (item.endsWith('/') || originalFolders.includes(item) || item === '.output/chrome-mv3')
      await visit(path);
    else
      result[item] = createHash('sha256')
        .update(await readFile(path))
        .digest('hex');
  }
  return result;
}
const protectedPaths = [
  ...originalFolders,
  ...originalFiles,
  '.output/chrome-mv3',
  'artifacts/backtoit-0.1.0-chrome.zip',
];
const before = await hashes(protectedPaths);
await writeFile(join(evidence, 'v01-before-sha256.json'), JSON.stringify(before, null, 2));
const work = await mkdtemp(join(evidence, 'baseline-workspace-'));
for (const item of [...originalFolders, ...originalFiles, 'docs', 'README.md', 'IMPLEMENTATION.md']) {
  if (existsSync(join(root, item))) await cp(join(root, item), join(work, item), { recursive: true });
}
await symlink(join(root, 'node_modules'), join(work, 'node_modules'), 'junction');
if (existsSync(join(root, '.playwright-browsers')))
  await symlink(join(root, '.playwright-browsers'), join(work, '.playwright-browsers'), 'junction');
const results = [];
const startedAt = new Date().toISOString();
for (const script of ['lint', 'typecheck', 'test', 'build', 'test:e2e']) {
  let output = '';
  const started = Date.now();
  const code = await new Promise((done, reject) => {
    const windows = process.platform === 'win32';
    const child = spawn(
      windows ? process.env.ComSpec || 'cmd.exe' : 'pnpm',
      windows ? ['/d', '/s', '/c', `pnpm ${script}`] : [script],
      { cwd: work, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    for (const stream of [child.stdout, child.stderr])
      stream.on('data', (chunk) => {
        output += chunk;
        process.stdout.write(chunk);
      });
    child.on('error', reject);
    child.on('close', done);
  });
  await writeFile(join(evidence, `baseline-logs/${script.replace(':', '-')}.log`), output);
  results.push({ command: `pnpm ${script}`, exitCode: code, durationMs: Date.now() - started });
  // Keep independent baseline stages running so a pre-existing failure is fully reported.
}
const after = await hashes(protectedPaths);
const changed = Object.keys(before).filter((name) => before[name] !== after[name]);
const report = {
  date: '2026-10-22',
  timeZone: 'America/Los_Angeles',
  startedAt,
  finishedAt: new Date().toISOString(),
  node: process.version,
  workspace: relative(root, work).replaceAll('\\', '/'),
  method:
    'Exact selected v0.1 sources copied to a new workspace; installed dependencies and official browser runtime shared read-only by directory junction. Generated files and browser profiles stay in that copy.',
  results,
  protectedFileCount: Object.keys(before).length,
  changedProtectedPaths: changed,
  productionOutputUntouched: !changed.some((name) => name.startsWith('.output/')),
  productionZipUntouched: !changed.includes('artifacts/backtoit-0.1.0-chrome.zip'),
  copiedBuildSha256: await hashes(['.output/chrome-mv3'], work),
};
await writeFile(join(evidence, 'baseline.json'), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({ results, changedProtectedPaths: changed, workspace: report.workspace }, null, 2),
);
if (changed.length || results.some((result) => result.exitCode !== 0)) process.exitCode = 1;
