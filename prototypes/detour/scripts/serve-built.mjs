import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.argv[2] || 4174);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('Use a local port from 1024 to 65535.');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405);
    response.end();
    return;
  }
  try {
    const route = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    let pathname = resolve(directory, `.${route}`);
    if (pathname !== resolve(directory) && !pathname.startsWith(resolve(directory) + sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    try {
      if ((await stat(pathname)).isDirectory()) pathname = resolve(pathname, 'index.html');
    } catch (error) {
      if (error.code === 'ENOENT' && !extname(pathname)) pathname = resolve(directory, 'index.html');
      else throw error;
    }
    const bytes = await readFile(pathname);
    response.writeHead(200, {
      'Content-Type': mime[extname(pathname)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 400);
    response.end();
  }
});
server.listen(port, '127.0.0.1', () =>
  console.log(`BackToIt research prototype: http://127.0.0.1:${port}/ (Ctrl+C to stop)`),
);
server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());
