// Builds the "studio" copy of the app to publish as a Claude artifact, where AI effects run on the viewer's own
// Claude plan. The artifact platform wraps the page in its own document, so this keeps only the title, the font
// link, the styles and the body, and drops the install bits (manifest, icons, service worker). The modules go
// alongside as supporting files at the same relative paths.
//   node tools/artifact.mjs <out-dir>      writes <out-dir>/index.html and <out-dir>/src/**
// Then publish <out-dir>/index.html with every src file in `files` and capabilities { sample: {}, downloads: true }.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../app/', import.meta.url));
const out = process.argv[2];
if (!out) { console.error('usage: node tools/artifact.mjs <out-dir>'); process.exit(1); }

const html = readFileSync(join(APP, 'index.html'), 'utf8');
const pick = (re) => { const m = html.match(re); if (!m) throw new Error('index.html changed shape: ' + re); return m[0]; };
const page = [
  pick(/<title>[\s\S]*?<\/title>/),
  pick(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/),
  pick(/<style>[\s\S]*?<\/style>/),
  html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>')).trim(),
].join('\n') + '\n';
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'index.html'), page);

const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(join(APP, 'src')).filter((p) => p.endsWith('.js')).map((p) => relative(APP, p).split('\\').join('/')).sort();
for (const f of files) { mkdirSync(dirname(join(out, f)), { recursive: true }); copyFileSync(join(APP, f), join(out, f)); }
writeFileSync(join(out, 'files.json'), JSON.stringify(Object.fromEntries(files.map((f) => [f, join(out, f)])), null, 2));
console.log(`${out}/index.html and ${files.length} modules (map in files.json).`);
