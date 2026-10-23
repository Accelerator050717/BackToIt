import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const project = fileURLToPath(new URL('../', import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(join(root, 'package.json'));
const fromVitest = createRequire(require.resolve('vitest/package.json'));
const vite = join(dirname(fromVitest.resolve('vite/package.json')), 'bin/vite.js');
const commands = {
  dev: [vite, '--config', join(project, 'vite.config.ts'), '--host', '127.0.0.1'],
  build: [vite, 'build', '--config', join(project, 'vite.config.ts')],
  preview: [vite, 'preview', '--config', join(project, 'vite.config.ts'), '--host', '127.0.0.1'],
  typecheck: [require.resolve('typescript/bin/tsc'), '--noEmit', '-p', join(project, 'tsconfig.json')],
  test: [
    join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs'),
    'run',
    '--config',
    join(project, 'vitest.config.ts'),
  ],
  'browser-test': [
    join(dirname(require.resolve('@playwright/test/package.json')), 'cli.js'),
    'test',
    '--config',
    join(project, 'playwright.config.ts'),
  ],
};
const command = process.argv[2];
if (!Object.hasOwn(commands, command)) {
  process.stderr.write('Use dev, build, preview, typecheck, test, or browser-test.\n');
  process.exit(1);
}
const child = spawn(process.execPath, [...commands[command], ...process.argv.slice(3)], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || join(root, '.playwright-browsers'),
  },
});
child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
