import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';

await mkdir('artifacts/logs', { recursive: true });
const startedAt = new Date().toISOString();
const results = [];
for (const script of ['lint', 'typecheck', 'test', 'build', 'test:e2e']) {
  const started = Date.now();
  let output = '';
  const code = await new Promise((done, reject) => {
    const windows = process.platform === 'win32';
    // Script names are a fixed internal allowlist; no user input enters shell command text.
    const child = spawn(
      windows ? process.env.ComSpec || 'cmd.exe' : 'pnpm',
      windows ? ['/d', '/s', '/c', `pnpm ${script}`] : [script],
      {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    for (const stream of [child.stdout, child.stderr]) {
      stream.on('data', (chunk) => {
        output += chunk.toString();
        process.stdout.write(chunk);
      });
    }
    child.on('error', reject);
    child.on('close', done);
  });
  await writeFile(`artifacts/logs/${script.replace(':', '-')}.log`, output);
  results.push({ command: `pnpm ${script}`, exitCode: code, durationMs: Date.now() - started });
  if (code !== 0) {
    await writeFile('artifacts/verification.json', JSON.stringify({ startedAt, results }, null, 2));
    process.exitCode = 1;
    break;
  }
}
if (!process.exitCode) {
  const files = {};
  const build = resolve('.output/chrome-mv3');
  async function record(dir) {
    for (const file of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, file.name);
      if (file.isDirectory()) await record(path);
      else
        files[relative(build, path).replaceAll('\\', '/')] = createHash('sha256')
          .update(await readFile(path))
          .digest('hex');
    }
  }
  await record(build);
  await writeFile(
    'artifacts/verification.json',
    JSON.stringify(
      { startedAt, finishedAt: new Date().toISOString(), node: process.version, results, buildSha256: files },
      null,
      2,
    ),
  );
  console.log(
    'All verification stages passed. Logs: artifacts/logs; build fingerprints: artifacts/verification.json',
  );
}
