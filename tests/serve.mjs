// A static server for app/ on a free port, for the browser tests.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../app/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.css': 'text/css' };

export function serveApp() {
  const server = http.createServer(async (req, res) => {
    let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    if (path.endsWith('/')) path += 'index.html';
    try {
      const body = await readFile(join(ROOT, path));
      res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() })));
}

// playwright from tests/node_modules, or from PLAYWRIGHT_PATH (a preinstalled copy)
export async function loadPlaywright() {
  try { return await import('playwright'); } catch {
    if (process.env.PLAYWRIGHT_PATH) return import(process.env.PLAYWRIGHT_PATH);
    throw new Error('Playwright is missing: run `npm install` in tests/, or set PLAYWRIGHT_PATH.');
  }
}

export const BROWSER_ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'];

// tiny reporting helpers shared by the tests
export function reporter(name) {
  let failed = 0;
  return {
    ok(cond, msg) { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}: ${msg}`); if (!cond) failed++; },
    get failed() { return failed; },
  };
}
