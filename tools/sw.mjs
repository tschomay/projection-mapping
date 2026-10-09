// Keeps app/sw.js in step with the app: SHELL lists every file the app needs offline, and VERSION is a hash of
// their contents, so a release refreshes the cache by itself. Run after adding or changing app files:
//   node tools/sw.mjs            rewrite SHELL and VERSION in app/sw.js
//   node tools/sw.mjs --check    exit 1 if app/sw.js is out of date (used by the tests)
// Vercel runs it as the build step, so a deploy is never stale even if a commit forgot to.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../app/', import.meta.url));
const SW = join(APP, 'sw.js');
const FIXED = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const modules = walk(join(APP, 'src')).filter((p) => p.endsWith('.js')).sort().map((p) => './' + relative(APP, p).split('\\').join('/'));
const shell = FIXED.concat(modules);
const hash = createHash('sha256');
for (const f of shell.slice(1)) hash.update(f).update(readFileSync(join(APP, f)));
const version = 'surface-mapper-' + hash.digest('hex').slice(0, 10);

const src = readFileSync(SW, 'utf8');
const lines = [`const VERSION = '${version}';`, `const SHELL = [${shell.map((f) => `'${f}'`).join(', ')}];`];
const next = src.replace(/const VERSION = .*;\n/, lines[0] + '\n').replace(/const SHELL = \[[\s\S]*?\];\n/, lines[1] + '\n');

if (process.argv.includes('--check')) {
  if (next !== src) { console.error('app/sw.js is out of date: run `node tools/sw.mjs`.'); process.exit(1); }
  console.log(`app/sw.js is up to date (${shell.length} files, ${version}).`);
} else {
  writeFileSync(SW, next);
  console.log(`app/sw.js: ${shell.length} files, ${version}.`);
}
