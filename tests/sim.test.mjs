// The sandbox carries the app's surface-capture pipeline (#19): tools/build-sim.mjs writes it, this checks it's current.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reporter } from './serve.mjs';

export default async function run() {
  const t = reporter('sim');
  const tool = fileURLToPath(new URL('../tools/build-sim.mjs', import.meta.url));
  let ok = true, out = '';
  try { out = execFileSync(process.execPath, [tool, '--check'], { encoding: 'utf8', stdio: 'pipe' }); } catch (err) { ok = false; out = String(err.stderr || err.message); }
  t.ok(ok, out.trim());
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
