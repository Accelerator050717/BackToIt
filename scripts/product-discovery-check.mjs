import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const evidence = join(root, 'artifacts/product-discovery');
await mkdir(join(evidence, 'isolation-logs'), { recursive: true });
const original = JSON.parse(await readFile(join(evidence, 'v01-before-sha256.json'), 'utf8'));
const commands = [
  ['pnpm', 'lint'],
  ['pnpm', 'typecheck'],
  ['pnpm', 'build', '--config', 'artifacts/product-discovery/wxt-isolation.config.ts'],
];
const results = [];
for (const [tool, ...args] of commands) {
  let output = '';
  const windows = process.platform === 'win32';
  const code = await new Promise((done, reject) => {
    // All command arguments are a fixed internal list.
    const child = spawn(
      windows ? process.env.ComSpec || 'cmd.exe' : tool,
      windows ? ['/d', '/s', '/c', `${tool} ${args.join(' ')}`] : args,
      { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    for (const stream of [child.stdout, child.stderr])
      stream.on('data', (chunk) => {
        output += chunk;
        process.stdout.write(chunk);
      });
    child.on('error', reject);
    child.on('close', done);
  });
  const command = `${tool} ${args.join(' ')}`;
  await writeFile(join(evidence, `isolation-logs/${args[0]}.log`), output);
  results.push({ command, exitCode: code });
}
const digest = async (pathname) =>
  createHash('sha256')
    .update(await readFile(pathname))
    .digest('hex');
const protectedChanges = [];
for (const [name, hash] of Object.entries(original))
  if (!existsSync(join(root, name)) || (await digest(join(root, name))) !== hash) protectedChanges.push(name);
const build = join(evidence, 'production-build-check/chrome-mv3');
const buildFiles = {};
async function visit(pathname, prefix = '') {
  for (const entry of await readdir(pathname, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) await visit(join(pathname, entry.name), `${name}/`);
    else buildFiles[`.output/chrome-mv3/${name}`] = await digest(join(pathname, entry.name));
  }
}
if (existsSync(build)) await visit(build);
const productionBefore = Object.fromEntries(
  Object.entries(original).filter(([name]) => name.startsWith('.output/chrome-mv3/')),
);
const changedBuild = Object.keys(productionBefore).filter(
  (name) => buildFiles[name] !== productionBefore[name],
);
const addedBuild = Object.keys(buildFiles).filter((name) => !Object.hasOwn(productionBefore, name));
const markers = [];
for (const name of Object.keys(buildFiles).filter((name) => /\.(js|css|html)$/.test(name))) {
  const content = await readFile(join(build, name.slice('.output/chrome-mv3/'.length)), 'utf8');
  if (
    ['backtoit:detour-research:v1', 'dt-saved-step', 'backtoit-detour-research'].some((marker) =>
      content.includes(marker),
    )
  )
    markers.push(name);
}
const report = {
  date: '2026-10-22',
  timeZone: 'America/Los_Angeles',
  finishedAt: new Date().toISOString(),
  method:
    'Run root lint/typecheck with all research sources present. Build the original WXT config from the actual project root, overriding only outDir to a separate ignored research directory; never overwrite .output.',
  outputDirectory: 'artifacts/product-discovery/production-build-check/chrome-mv3',
  results,
  protectedFileCount: Object.keys(original).length,
  changedProtectedOriginalPaths: protectedChanges,
  changedProductionBuildPaths: changedBuild,
  addedProductionBuildPaths: addedBuild,
  prototypeMarkersFound: markers,
  productionBuildByteIdenticalToBaseline: !changedBuild.length && !addedBuild.length,
  originalOutputAndZipUntouched: !protectedChanges.some(
    (name) => name.startsWith('.output/') || name.endsWith('-chrome.zip'),
  ),
};
await writeFile(join(evidence, 'isolation.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (
  results.some((result) => result.exitCode !== 0) ||
  protectedChanges.length ||
  changedBuild.length ||
  addedBuild.length ||
  markers.length
)
  process.exitCode = 1;
