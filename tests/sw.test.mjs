// The offline cache list and version in app/sw.js match the app's files (tools/sw.mjs writes them).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reporter } from './serve.mjs';

export default async function run() {
  const t = reporter('sw');
  const tool = fileURLToPath(new URL('../tools/sw.mjs', import.meta.url));
  let ok = true, out = '';
  try { out = execFileSync(process.execPath, [tool, '--check'], { encoding: 'utf8', stdio: 'pipe' }); } catch (err) { ok = false; out = String(err.stderr || err.message); }
  t.ok(ok, out.trim());
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
