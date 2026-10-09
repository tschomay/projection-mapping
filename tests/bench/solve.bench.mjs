// Benchmark for roadmap #5: on random sandbox layouts, how close does camera scan + 2D-to-3D solve get the
// projector's aim? Drives sim/index.html headless with a seeded Math.random, so each seed is one fixed layout and
// camera spot. Usage: node bench/solve.bench.mjs [runs=20] [firstSeed=1]
import { fileURLToPath } from 'node:url';
import { loadPlaywright, BROWSER_ARGS } from '../serve.mjs';

const SIM = 'file://' + (process.env.SIM_PATH || fileURLToPath(new URL('../../sim/index.html', import.meta.url)));
const runs = +(process.argv[2] || 20), first = +(process.argv[3] || 1);
const seeded = (seed) => `(() => { let a = ${seed} >>> 0; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();`;

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ args: BROWSER_ARGS });
const results = [];
async function trial(seed) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  page.setDefaultTimeout(120000);
  await page.addInitScript(seeded(seed));
  await page.goto(SIM);
  await page.waitForFunction(() => document.getElementById('capture'), null, { timeout: 60000 });
  const click = (id) => page.evaluate((i) => document.getElementById(i).click(), id);
  await click('newLayout');
  await click('camSpot');
  await click('capture');
  await page.waitForFunction(() => /Surfaces created/.test(document.getElementById('capStats').textContent), null, { timeout: 300000 });
  const cap = await page.textContent('#capStats');
  if (process.env.THROW !== undefined) await page.evaluate((v) => { document.getElementById('mThrow').value = v; }, process.env.THROW);
  await click('solve3d');
  await page.waitForFunction(() => !document.getElementById('solveStats').hidden || /Map some|Enter/.test(document.getElementById('solveMsg').textContent), null, { timeout: 300000 });
  const txt = await page.textContent('#solveStats');
  const m = txt.match(/aim ([\d.]+)° off/), rms = txt.match(/([\d.]+) px<\/b>|error: ([\d.]+) px/);
  const surf = cap.match(/Surfaces created: (\d+)/);
  const r = { seed, aim: m ? +m[1] : null, surfaces: surf ? +surf[1] : 0, rms: txt.match(/error: ([\d.]+) px/)?.[1] };
  await page.close();
  return r;
}
for (let seed = first; seed < first + runs; seed++) {
  let r;
  try { r = await trial(seed); } catch (err) { r = { seed, aim: null, surfaces: 0, error: err.message.split('\n')[0] }; }
  results.push(r);
  console.log(`seed ${seed}: aim ${r.aim ?? 'no solve'}°, ${r.surfaces} surfaces, reprojection ${r.rms} px${r.error ? ' (' + r.error + ')' : ''}`);
}
await browser.close();
const ok = results.filter((r) => r.aim !== null && r.aim <= 2).length;
const aims = results.map((r) => r.aim ?? 99).sort((a, b) => a - b);
console.log(`\nwithin 2°: ${ok} of ${results.length} (${Math.round(ok / results.length * 100)}%), median ${aims[aims.length >> 1].toFixed(2)}°`);
