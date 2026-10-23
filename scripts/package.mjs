import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';
import { zipSync, unzipSync } from 'fflate';
const root = resolve('.output/chrome-mv3');
const files = {};
async function collect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await collect(path);
    else files[relative(root, path).replaceAll('\\', '/')] = new Uint8Array(await readFile(path));
  }
}
await collect(root);
const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
if (manifest.manifest_version !== 3 || manifest.host_permissions?.length || manifest.content_scripts?.length)
  throw new Error('Unsafe build manifest');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const buildSha256 = Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, digest(bytes)]));
let verification;
try {
  verification = JSON.parse(await readFile('artifacts/verification.json', 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (
  verification &&
  (!verification.finishedAt ||
    !verification.buildSha256 ||
    verification.results.some((result) => result.exitCode !== 0) ||
    Object.keys(verification.buildSha256).length !== Object.keys(files).length ||
    Object.entries(buildSha256).some(([name, hash]) => verification.buildSha256[name] !== hash))
)
  throw new Error('Build differs from the last successful verification. Run pnpm verify before packaging.');
const output = `artifacts/backtoit-${manifest.version}-chrome.zip`;
await mkdir('artifacts', { recursive: true });
const zip = zipSync(files, { level: 9 });
const unpacked = unzipSync(zip);
if (
  Object.keys(unpacked).length !== Object.keys(files).length ||
  Object.entries(buildSha256).some(([name, hash]) => !unpacked[name] || digest(unpacked[name]) !== hash)
)
  throw new Error('ZIP content verification failed');
await writeFile(output, zip);
await writeFile(`${output}.sha256`, `${digest(zip)}  ${output.split('/').at(-1)}\n`);
await writeFile(
  'artifacts/package-verification.json',
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      archive: output,
      archiveSha256: digest(zip),
      archiveBytes: zip.length,
      fileCount: Object.keys(files).length,
      extractedFilesMatchBuild: true,
      matchesVerifiedBuild: Boolean(verification),
      verificationFinishedAt: verification?.finishedAt ?? null,
      buildSha256,
    },
    null,
    2,
  ),
);
console.log(`Packaged ${Object.keys(files).length} files: ${output} (${zip.length} bytes)`);
