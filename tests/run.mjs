// Runs every check. `--quick` skips the slow browser tests.
const quick = process.argv.includes('--quick');
const suites = ['./sw.test.mjs', './capture.test.mjs', ...(quick ? [] : ['./check.e2e.mjs', './link.e2e.mjs', './show.e2e.mjs', './ai.e2e.mjs', './mesh.e2e.mjs', './photo.e2e.mjs', './scan.e2e.mjs'])];
let failed = 0;
for (const s of suites) {
  const t0 = Date.now();
  try { failed += await (await import(s)).default(); } catch (err) { console.log(`FAIL ${s}: ${err.stack || err}`); failed++; }
  console.log(`     ${s} took ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
console.log(failed ? `${failed} check(s) failed` : 'All checks passed');
process.exitCode = failed ? 1 : 0;
