import { createRequire } from 'node:module';
import { dirname, join, resolve, relative } from 'node:path';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(join(root, 'package.json'));
const { zipSync, unzipSync } = require('fflate');
const evidence = join(root, 'artifacts/product-discovery');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fromDom = createRequire(require.resolve('react-dom/package.json'));
const fromVitest = createRequire(require.resolve('vitest/package.json'));
const dependencyManifests = [
  ...['react', 'react-dom', 'zod', 'lucide-react'].map((name) => require.resolve(`${name}/package.json`)),
  fromDom.resolve('scheduler/package.json'),
  fromVitest.resolve('vite/package.json'),
];
let notices =
  'Third-party licenses for the BackToIt independent research prototype.\nGenerated from the already-installed locked dependencies; no packages installed.\n';
for (const manifestPath of dependencyManifests) {
  const metadata = JSON.parse(await readFile(manifestPath, 'utf8'));
  const licensePath = ['LICENSE', 'LICENSE.md', 'LICENSE.txt']
    .map((name) => join(dirname(manifestPath), name))
    .find((pathname) => existsSync(pathname));
  if (!licensePath) throw new Error(`Missing license for ${metadata.name}`);
  notices += `\n\n===== ${metadata.name} ${metadata.version} =====\n${await readFile(licensePath, 'utf8')}`;
}
await writeFile(join(root, 'prototypes/detour/THIRD_PARTY_NOTICES.txt'), notices);

const files = {};
async function add(pathname) {
  if (!existsSync(pathname))
    throw new Error(`Required delivery path does not exist: ${relative(root, pathname)}`);
  const name = relative(root, pathname).replaceAll('\\', '/');
  files[name] = new Uint8Array(await readFile(pathname));
}
async function collect(pathname) {
  for (const entry of await readdir(pathname, { withFileTypes: true })) {
    if (
      [
        'node_modules',
        'profiles',
        'upstream',
        'browser-test-results',
        'test-results',
        'browser-report',
        '.vite',
      ].includes(entry.name) ||
      entry.name.startsWith('.env')
    )
      continue;
    const file = join(pathname, entry.name);
    if (entry.isDirectory()) await collect(file);
    else await add(file);
  }
}
for (const folder of ['src', 'entrypoints', 'public', 'tests', 'e2e', 'docs', 'prototypes/detour'])
  await collect(join(root, folder));
for (const name of [
  'README.md',
  'IMPLEMENTATION.md',
  'BackToIt_v0.2_Product_Discovery_Codex_Prompt.md',
  'package.json',
  'pnpm-lock.yaml',
  '.npmrc',
  '.gitignore',
  '.prettierrc.json',
  '.prettierignore',
  'wxt.config.ts',
  'tsconfig.json',
  'eslint.config.js',
  'vitest.config.ts',
  'playwright.config.ts',
])
  await add(join(root, name));
await collect(join(root, 'scripts'));
for (const name of [
  '.gitignore',
  'baseline.json',
  'v01-before-sha256.json',
  'isolation.json',
  'skills-reviewed.json',
  'prd-review.md',
  'prd-review.json',
  'prd-review-final.md',
  'prd-review-final.json',
  'static-server-check.json',
  'wxt-isolation.config.ts',
  'delivery-checks.json',
])
  await add(join(evidence, name));
for (const folder of ['baseline-logs', 'isolation-logs', 'independent-review', 'prototype/screenshots'])
  await collect(join(evidence, folder));
for (const name of [
  'prototype/unit-results.json',
  'prototype/browser-results.json',
  'research/README.md',
  'research/sources.json',
  'research/code-audit.json',
  'research/evidence-verification.json',
  'research/neuroflow-runtime.json',
  'research/resettle-fixture-runtime.json',
])
  await add(join(evidence, name));
await collect(join(evidence, 'research/screenshots'));
const startHere = `# BackToIt v0.2 product-discovery delivery\n\nThis is a local research/source package, not an installable extension ZIP.\nRead docs/product/README.md and docs/product/12_DELIVERY_AND_VALIDATION.md.\n\nRun the prebuilt interactive prototype without installing dependencies:\n\n    node prototypes/detour/scripts/serve-built.mjs\n\nOpen http://127.0.0.1:4174/ . Add a port number if that port is already in use.\nThe server listens only on loopback. Ctrl+C stops it. All tasks are synthetic demo data.\n\nThe archive contains the preserved v0.1 source and lockfile, new product docs, independent prototype source/build/tests, and selected synthetic evidence. It excludes browser profiles, user databases, dependencies, browser runtimes, downloaded upstream repositories, and the existing v0.1 .output/ZIP.\nNo interviews or real-world product effects have been claimed.\n`;
files['RESEARCH_START_HERE.md'] = new TextEncoder().encode(startHere);
const secretPattern =
  /(?:gh[pousr]_[A-Za-z0-9]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{40,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
const flagged = Object.entries(files)
  .filter(
    ([name, bytes]) => !/\.(png|zip)$/.test(name) && secretPattern.test(new TextDecoder().decode(bytes)),
  )
  .map(([name]) => name);
if (flagged.length) throw new Error(`Review possible credentials before packaging: ${flagged.join(', ')}`);
const manifest = {
  date: '2026-10-22',
  timeZone: 'America/Los_Angeles',
  type: 'Local product-discovery source and evidence delivery',
  modifiedExistingPaths: ['README.md', 'docs/PRODUCT.md', 'docs/HANDOFF.md'],
  createdSourcePaths: Object.keys(files).filter(
    (name) =>
      name.startsWith('docs/product/') ||
      name.startsWith('prototypes/detour/') ||
      name.startsWith('scripts/product-discovery-') ||
      name === 'scripts/package-product-discovery.mjs',
  ),
  entries: Object.fromEntries(
    Object.entries(files).map(([name, bytes]) => [name, { bytes: bytes.length, sha256: digest(bytes) }]),
  ),
  excluded: [
    'browser profiles',
    'real user databases',
    'dependencies and browser runtimes',
    'downloaded upstream code',
    'old .output and original extension ZIP',
    'temporary baseline/isolation workspaces',
  ],
  credentialPatternScan: {
    flaggedFiles: 0,
    scope:
      'Selected text files only; high-confidence token/private-key patterns. This is not a claim that every possible secret type can be detected.',
  },
};
await mkdir(evidence, { recursive: true });
await writeFile(join(evidence, 'delivery-manifest.json'), JSON.stringify(manifest, null, 2));
files['artifacts/product-discovery/delivery-manifest.json'] = new TextEncoder().encode(
  JSON.stringify(manifest, null, 2),
);
const archive = zipSync(files, { level: 9 });
const extracted = unzipSync(archive);
if (
  Object.keys(extracted).length !== Object.keys(files).length ||
  Object.entries(files).some(([name, bytes]) => !extracted[name] || digest(extracted[name]) !== digest(bytes))
)
  throw new Error('Delivery archive verification failed');
const name = 'backtoit-v0.2-product-discovery.zip';
await writeFile(join(evidence, name), archive);
await writeFile(join(evidence, `${name}.sha256`), `${digest(archive)}  ${name}\n`);
await writeFile(
  join(evidence, 'package-verification.json'),
  JSON.stringify(
    {
      date: '2026-10-22',
      archive: name,
      bytes: archive.length,
      sha256: digest(archive),
      fileCount: Object.keys(files).length,
      extractedFilesMatch: true,
      excludedProfilesAndRuntime: true,
      credentialPatternFlags: flagged,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      archive: `artifacts/product-discovery/${name}`,
      bytes: archive.length,
      files: Object.keys(files).length,
      sha256: digest(archive),
    },
    null,
    2,
  ),
);
