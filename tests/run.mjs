// Runs the checks. `--quick` runs only the Node ones (seconds); `--only a,b` runs the named suites (file names
// without .mjs, e.g. --only scan.e2e,link.e2e), which is how CI splits them across parallel jobs.
const QUICK = ['./sw.test.mjs', './capture.test.mjs', './transfer.test.mjs', './sim.test.mjs'];
const BROWSER = ['./check.e2e.mjs', './link.e2e.mjs', './show.e2e.mjs', './ai.e2e.mjs', './mesh.e2e.mjs', './limits.e2e.mjs', './photo.e2e.mjs', './scan.e2e.mjs', './share.e2e.mjs'];
const onlyArg = process.argv.find((a) => a.startsWith('--only'));
const only = onlyArg ? (onlyArg.includes('=') ? onlyArg.split('=')[1] : process.argv[process.argv.indexOf(onlyArg) + 1]).split(',').map((n) => `./${n.replace(/\.mjs$/, '')}.mjs`) : null;
const suites = only || (process.argv.includes('--quick') ? QUICK : QUICK.concat(BROWSER));
let failed = 0;
for (const s of suites) {
  const t0 = Date.now();
  try { failed += await (await import(s)).default(); } catch (err) { console.log(`FAIL ${s}: ${err.stack || err}`); failed++; }
  console.log(`     ${s} took ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
console.log(failed ? `${failed} check(s) failed` : 'All checks passed');
process.exitCode = failed ? 1 : 0;
