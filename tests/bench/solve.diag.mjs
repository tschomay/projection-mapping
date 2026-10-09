// One seed of the #5 benchmark, in detail: what each scanned surface really is (which box face, wall or floor),
// and the true vs solved projector. Usage: node bench/solve.diag.mjs <seed>
import { fileURLToPath } from 'node:url';
import { loadPlaywright, BROWSER_ARGS } from '../serve.mjs';

const SIM = 'file://' + (process.env.SIM_PATH || fileURLToPath(new URL('../../sim/index.html', import.meta.url)));
const seed = +(process.argv[2] || 1);
const seeded = `(() => { let a = ${seed} >>> 0; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();`;
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ args: BROWSER_ARGS });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
await page.addInitScript(seeded);
await page.goto(SIM);
await page.waitForFunction(() => window.__sandbox);
const click = (id) => page.evaluate((i) => document.getElementById(i).click(), id);
await click('newLayout'); await click('camSpot'); await click('capture');
await page.waitForFunction(() => /Surfaces created/.test(document.getElementById('capStats').textContent), null, { timeout: 300000 });
if (process.env.THROW !== undefined) await page.evaluate((v) => { document.getElementById('mThrow').value = v; }, process.env.THROW);
await click('solve3d');
await page.waitForFunction(() => !document.getElementById('solveStats').hidden, null, { timeout: 300000 });
const out = await page.evaluate(() => {
  const { state } = window.__sandbox, D = Math.PI / 180, W = 1280, H = 720;
  const truth = { x: 0, y: 1.55, z: 3.3, yaw: 0, pitch: Math.atan2(0.75 - 1.55, 3.0), roll: 0, fov: 36 * D, shift: 0 };
  const ray = (cam, px, py) => {
    const t = Math.tan(cam.fov / 2);
    let x = (px / W * 2 - 1) * t * W / H, y = (1 - py / H * 2 - cam.shift) * t, z = -1;
    const cr = Math.cos(cam.roll), sr = Math.sin(cam.roll), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    [x, y] = [cr * x - sr * y, sr * x + cr * y]; [y, z] = [cp * y - sp * z, sp * y + cp * z]; [x, z] = [cy * x + sy * z, -sy * x + cy * z];
    return { o: [cam.x, cam.y, cam.z], d: [x, y, z] };
  };
  const FACES = ['front', 'back', 'right', 'left', 'top', 'bottom'];
  const label = (px, py) => {
    const { o, d } = ray(truth, px, py);
    let best = { t: Infinity, what: 'nothing' };
    state.real.forEach((b, i) => {
      const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
      const lo = [c * (o[0] - b.x) - s * (o[2] - b.z), o[1], s * (o[0] - b.x) + c * (o[2] - b.z)];
      const ld = [c * d[0] - s * d[2], d[1], s * d[0] + c * d[2]];
      const mn = [-b.w / 2, 0, -b.d / 2], mx = [b.w / 2, b.h, b.d / 2];
      let t0 = -Infinity, t1 = Infinity, ax = -1, sgn = 0;
      for (let k = 0; k < 3; k++) {
        if (Math.abs(ld[k]) < 1e-12) { if (lo[k] < mn[k] || lo[k] > mx[k]) return; continue; }
        let ta = (mn[k] - lo[k]) / ld[k], tb = (mx[k] - lo[k]) / ld[k], sa = -1;
        if (ta > tb) { [ta, tb] = [tb, ta]; sa = 1; }
        if (ta > t0) { t0 = ta; ax = k; sgn = sa; }
        t1 = Math.min(t1, tb);
      }
      if (t0 <= t1 && t0 > 0 && t0 < best.t) best = { t: t0, what: `box${i}.${ax === 2 ? (sgn > 0 ? 'front' : 'back') : ax === 0 ? (sgn > 0 ? 'right' : 'left') : 'top'}` };
    });
    if (d[1] < 0) { const t = -o[1] / d[1]; if (t < best.t) best = { t, what: 'floor' }; }
    if (d[2] < 0) { const t = -o[2] / d[2]; if (t < best.t) best = { t, what: 'wall' }; }
    return best.what;
  };
  const surfaces = state.surfaces.map((s, i) => {
    const cx = s.pins.reduce((a, p) => a + p[0], 0) / 4, cy = s.pins.reduce((a, p) => a + p[1], 0) / 4;
    const area = Math.abs(s.pins.reduce((a, p, k) => { const n = s.pins[(k + 1) % 4]; return a + p[0] * n[1] - n[0] * p[1]; }, 0) / 2);
    return `${i}: ${label(cx, cy)} (area ${Math.round(area)}, object ${s.object})`;
  });
  const sc = state.projSolved;
  return {
    boxes: state.real.length, model: state.model.length,
    truth: { pitch: truth.pitch / D, fov: 36 },
    solved: { pitch: sc.pitch / D, yaw: sc.yaw / D, roll: sc.roll / D, fov: sc.fov / D, shift: sc.shift },
    surfaces, stats: document.getElementById('solveStats').textContent,
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
