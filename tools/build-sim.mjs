// The sandbox (sim/index.html) is one file that opens straight from disk, where module imports don't work, so it
// carries a copy of the app's surface-capture pipeline (app/src/capture.js) between two marker lines. This script
// writes that copy; the tests run it with --check so the two can't drift apart.
//   node tools/build-sim.mjs            update sim/index.html
//   node tools/build-sim.mjs --check    exit 1 if it's out of date
// The pipeline's imports (SHAPES, squareToQuad, inv3, hApply, MAX_SURF, MAX_PART_VERTS) are defined by the sandbox
// itself with the same meaning, so imports are dropped and exports become plain declarations.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SIM = fileURLToPath(new URL('../sim/index.html', import.meta.url));
const SRC = fileURLToPath(new URL('../app/src/capture.js', import.meta.url));
const BEGIN = /^\/\/ ---- BEGIN app\/src\/capture\.js.*$/m, END = /^\/\/ ---- END app\/src\/capture\.js ----$/m;

const code = readFileSync(SRC, 'utf8')
  .replace(/^import .*\n/gm, '')
  .replace(/^export (function|const|class|let) /gm, '$1 ')
  .trim();
const sim = readFileSync(SIM, 'utf8');
const b = sim.match(BEGIN), e = sim.match(END);
if (!b || !e) { console.error('sim/index.html has no BEGIN/END markers for app/src/capture.js'); process.exit(1); }
const next = sim.slice(0, b.index + b[0].length) + '\n' + code + '\n' + sim.slice(e.index);

if (process.argv.includes('--check')) {
  if (next !== sim) { console.error('sim/index.html has an outdated copy of app/src/capture.js: run `node tools/build-sim.mjs`.'); process.exit(1); }
  console.log('sim/index.html carries the current app/src/capture.js.');
} else {
  writeFileSync(SIM, next);
  console.log('sim/index.html: pipeline updated from app/src/capture.js.');
}
