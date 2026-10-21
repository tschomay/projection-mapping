// Builds the writer (app/writer.html) to publish as a Claude artifact, where Claude writes effects on the viewer's own
// plan. The artifact platform wraps the page in its own document, so this keeps only the title, the font link, the
// styles and the body. Only the modules the writer imports go alongside, at the same relative paths.
//   node tools/writer.mjs <out-dir>      writes <out-dir>/index.html, <out-dir>/src/** and <out-dir>/files.json
// Then publish <out-dir>/index.html with every entry of files.json in `files` and capabilities { sample: {} }.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../app/', import.meta.url));
const out = process.argv[2];
if (!out) { console.error('usage: node tools/writer.mjs <out-dir>'); process.exit(1); }

const html = readFileSync(join(APP, 'writer.html'), 'utf8');
const pick = (re) => { const m = html.match(re); if (!m) throw new Error('writer.html changed shape: ' + re); return m[0]; };
const page = [
  pick(/<title>[\s\S]*?<\/title>/),
  pick(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/),
  pick(/<style>[\s\S]*?<\/style>/),
  html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>')).trim(),
].join('\n') + '\n';
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'index.html'), page);

// the writer's modules: everything src/writer.js reaches through static imports
const files = new Set();
const visit = (f) => {
  if (files.has(f)) return;
  files.add(f);
  const src = readFileSync(join(APP, f), 'utf8');
  for (const m of src.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]/gm)) visit(posix.join(posix.dirname(f), m[1]));
};
visit('src/writer.js');
const list = [...files].sort();
for (const f of list) { mkdirSync(dirname(join(out, f)), { recursive: true }); copyFileSync(join(APP, f), join(out, f)); }
writeFileSync(join(out, 'files.json'), JSON.stringify(Object.fromEntries(list.map((f) => [f, join(out, f)])), null, 2));
console.log(`${out}/index.html and ${list.length} modules (map in files.json).`);
