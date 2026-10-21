// Any-shape outlines in the app (issue #37). The design photo is the synthetic wall (scene.mjs), lined up with the
// frame, and *Tap things on the photo → Any shape* is tried two ways:
// - with a fake transformers.js in place of the CDN module, whose "model" answers a tap with the true outlines of
//   the things under it (glass, then glass and ring): the surface takes the outline, and a second tap steps out;
// - with the model unreachable: the app says so and the colour fill outlines the mirror instead.
import { serveApp, loadPlaywright, BROWSER_ARGS, reporter, setHidden } from './serve.mjs';
import { buildWall } from './scene.mjs';

const LIB = /cdn\.jsdelivr\.net\/npm\/@huggingface\/transformers/;
// just enough of transformers.js for segment.js: masks are the true outlines (camera pixels) holding the point
const FAKE_LIB = `
const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
export class Tensor { constructor(type, data, dims) { this.type = type; this.data = data; this.dims = dims; } }
export class RawImage { constructor(data, w, h, c) { this.data = data; this.width = w; this.height = h; } rgb() { return this; } }
export const SamModel = { async from_pretrained(id, o) { window.__fakeModel = { id, dtype: o.dtype };
  o.progress_callback?.({ status: 'progress', file: 'a', loaded: 5, total: 10 }); o.progress_callback?.({ status: 'progress', file: 'a', loaded: 10, total: 10 });
  const model = async ({ input_points }) => ({ pred_masks: input_points, iou_scores: { data: [0.9, 0.9, 0.9] } });
  model.get_image_embeddings = async () => { window.__fakeEncoded = (window.__fakeEncoded || 0) + 1; return {}; };
  model.dispose = async () => { window.__fakeDisposed = (window.__fakeDisposed || 0) + 1; };
  return model; } };
export const AutoProcessor = { async from_pretrained() {
  const p = async (img) => ({ original_sizes: [[img.height, img.width]], reshaped_input_sizes: [[img.height, img.width]], w: img.width, h: img.height });
  p.post_process_masks = async (pts, [[h, w]]) => {
    const [x, y] = pts.data, all = Object.values(window.__wall.shapes).concat(Object.values(window.__wall.rects)).map((r) => r.cam);
    const sx = w / window.__wall.camW, sy = h / window.__wall.camH;
    const hits = all.filter((P) => inPoly(x / sx, y / sy, P)).slice(0, 3);
    // scores, like the real model's: positive inside, negative outside
    const data = new Float32Array(3 * w * h).fill(-4);
    hits.forEach((P, k) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (inPoly((i + 0.5) / sx, (j + 0.5) / sy, P)) data[k * w * h + j * w + i] = 4; });
    return [{ dims: [1, 3, h, w], data }];
  };
  return p; } };
`;

// put the wall's photo in as the design photo, lined up with the frame
const setUp = async (page) => {
  await page.waitForFunction(() => window.app && window.app.editor);
  await page.evaluate(async () => {
    document.getElementById('connectSheet').close();
    // every message shown, since one replaces another
    const toast = window.app.toast.bind(window.app);
    window.__toasts = [];
    window.app.toast = (text, ms) => { window.__toasts.push(text); toast(text, ms); };
    const [W, H] = window.app.frame, wall = window.__wall = window.__buildWall({ W, H });
    const c = document.createElement('canvas'); c.width = wall.camW; c.height = wall.camH;
    c.getContext('2d').putImageData(new ImageData(wall.photo(0, 3), wall.camW, wall.camH), 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    await window.app.setBackdropFile(new File([blob], 'wall.png', { type: 'image/png' }), wall.frameCam.map(([x, y]) => [x / wall.camW, y / wall.camH]));
  });
  await page.waitForFunction(() => document.getElementById('backdrop').complete && document.getElementById('backdrop').naturalWidth);
  await page.evaluate(() => { window.app.setPick(true); });
  await page.click('#pickKind [data-kind="any"]');
};
const tapShape = async (page, name) => {
  const pt = await page.evaluate((n) => {
    const r = document.getElementById('overlay').getBoundingClientRect(), [W, H] = window.app.frame, f = window.__wall.shapes[n].frame;
    const c = f.reduce((a, p) => [a[0] + p[0] / f.length, a[1] + p[1] / f.length], [0, 0]);
    return [r.left + c[0] / W * r.width, r.top + c[1] / H * r.height];
  }, name);
  await page.mouse.click(pt[0], pt[1]);
};
// a surface's outline against a true one, in the frame: IoU, and whether it kept its own points
const overlap = (page, i, name) => page.evaluate(([i, n]) => {
  const g = window.app.geoms[i], T = window.__wall.shapes[n].frame, P = g.parts[0].outline;
  const inPoly = (x, y, Q) => { let c = false; for (let a = 0, b = Q.length - 1; a < Q.length; b = a++) { const [xi, yi] = Q[a], [xj, yj] = Q[b]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const xs = P.concat(T).map((p) => p[0]), ys = P.concat(T).map((p) => p[1]);
  let a = 0, u = 0;
  for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x++) { const p = inPoly(x, y, P), q = inPoly(x, y, T); if (p && q) a++; if (p || q) u++; }
  return { iou: a / u, points: window.app.project.surfaces[i].parts[0].pts.length };
}, [i, name]);

export default async function run() {
  const t = reporter('outline');
  const { chromium } = await loadPlaywright();
  const server = await serveApp();
  const browser = await chromium.launch({ args: BROWSER_ARGS });
  const errors = [];
  try {
    // with the (fake) model
    let ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
    await ctx.route(LIB, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: FAKE_LIB }));
    await ctx.addInitScript(`window.__buildWall = ${buildWall.toString()};`);
    let page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url);
    await setUp(page);
    const early = await page.waitForFunction(() => window.__fakeEncoded === 1, null, { timeout: 15000 }).then(() => true, () => false);
    const st = await page.evaluate(() => ({ model: window.__fakeModel, toast: window.__toasts.join(' / ') }));
    t.ok(st.model?.id === 'Xenova/slimsam-77-uniform' && st.model.dtype === 'q8', 'Any shape loads the quantized SlimSAM model');
    t.ok(/Loading the shape model/.test(st.toast) && /ready/.test(st.toast), 'and says how loading went');
    t.ok(early, 'the photo is encoded as soon as the model is ready, before any tap');
    t.ok(await page.evaluate(() => document.getElementById('pickTune').hidden), 'the sliders wait for a pick');
    await tapShape(page, 'glass');
    await page.waitForFunction(() => window.app.project.surfaces.length === 1, null, { timeout: 15000 });
    t.ok(await page.evaluate(() => !document.getElementById('pickTune').hidden && !document.getElementById('pickSimpleRow').hidden), 'then show, Simplify included for outlines');
    const g = await overlap(page, 0, 'glass');
    t.ok(g.iou > 0.9 && g.points > 4, `a tap on the mirror makes a surface with its round outline (IoU ${g.iou.toFixed(3)}, ${g.points} points)`);
    const before = await page.evaluate(() => JSON.stringify(window.app.project.surfaces[0].pins));
    await tapShape(page, 'glass');
    await page.waitForFunction((b) => JSON.stringify(window.app.project.surfaces[0].pins) !== b, before, { timeout: 5000 }).catch(() => {});
    const r = await overlap(page, 0, 'mirror');
    const n = await page.evaluate(() => window.app.project.surfaces.length);
    t.ok(r.iou > 0.9 && n === 1, `tapping again steps out to the mirror with its ring, on the same surface (IoU ${r.iou.toFixed(3)})`);
    t.ok(await page.evaluate(() => window.__fakeEncoded === 1), 'the photo is encoded only once');
    // Simplify reshapes that same surface: fewer points, still the mirror
    const pts = () => page.evaluate(() => window.app.project.surfaces[0].parts[0].pts.length);
    // (sliding only shows a spinner; the shape is worked out when the finger lifts or pauses)
    const slide = async (v) => {
      const busy = await page.evaluate((v) => { const s = document.getElementById('pickSimple'); s.value = v; s.dispatchEvent(new Event('input')); return !document.getElementById('pickBusy').hidden; }, v);
      await page.evaluate(() => document.getElementById('pickSimple').dispatchEvent(new Event('change')));
      await page.waitForFunction(() => document.getElementById('pickBusy').hidden, null, { timeout: 10000 });
      return busy;
    };
    const busy = await slide(0), detailed = await pts();
    t.ok(busy, 'a slider moving shows that the shape is being updated');
    await slide(1);
    const simple = await pts(), rs = await overlap(page, 0, 'mirror');
    t.ok(simple < detailed && rs.iou > 0.9 && await page.evaluate(() => window.app.project.surfaces.length) === 1, `Simplify reshapes the same surface (${detailed} → ${simple} points, IoU ${rs.iou.toFixed(3)})`);
    t.ok(await page.evaluate(() => window.app.project.settings.pickSimple === 1), 'and is saved with the project');
    // a tap outside it starts a new surface rather than stepping out
    const away = await page.evaluate(() => { const b = document.getElementById('overlay').getBoundingClientRect(); return [b.left + b.width * 0.08, b.top + b.height * 0.5]; });
    await page.mouse.click(away[0], away[1]);
    await page.waitForTimeout(800);
    t.ok(await page.evaluate(() => window.app.project.surfaces.length !== 1 || /No outline/.test(window.__toasts.at(-1))), 'a tap elsewhere starts a new one');

    // pinch to zoom on the photo (two fingers spreading), then Fit; a pinch doesn't pick anything
    const n0 = await page.evaluate(() => window.app.project.surfaces.length);
    const zoomed = await page.evaluate(async () => {
      const o = document.getElementById('overlay'), r = o.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const ev = (type, id, x, y) => o.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: id === 1 }));
      ev('pointerdown', 1, cx - 20, cy); ev('pointerdown', 2, cx + 20, cy);
      for (let k = 1; k <= 5; k++) { ev('pointermove', 1, cx - 20 - 20 * k, cy); ev('pointermove', 2, cx + 20 + 20 * k, cy); }
      ev('pointerup', 1, cx - 120, cy); ev('pointerup', 2, cx + 120, cy);
      await new Promise((res) => setTimeout(res, 300));
      return { s: window.app.view.s, fit: !document.getElementById('viewFit').hidden, n: window.app.project.surfaces.length };
    });
    t.ok(zoomed.s > 2.5 && zoomed.fit && zoomed.n === n0, `two fingers spreading zoom the photo in (${zoomed.s.toFixed(1)}x), Fit appears, nothing is picked`);
    await page.click('#viewFit');
    t.ok(await page.evaluate(() => window.app.view.s === 1 && document.getElementById('viewFit').hidden), 'Fit zooms back out');
    const r2 = await page.evaluate(() => { const b = document.getElementById('overlay').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
    await page.mouse.move(r2[0], r2[1]); await page.mouse.wheel(0, -400); await page.waitForTimeout(200);
    t.ok(await page.evaluate(() => window.app.view.s > 1), 'the mouse wheel zooms too');
    await page.click('#viewFit');

    // hidden, the model is let go; shown again while still picking, it loads and encodes the photo again
    await setHidden(page, true);
    t.ok(await page.waitForFunction(() => window.__fakeDisposed === 1, null, { timeout: 5000 }).then(() => true, () => false), 'hidden, the shape model is let go');
    await setHidden(page, false);
    t.ok(await page.waitForFunction(() => window.__fakeEncoded === 2, null, { timeout: 15000 }).then(() => true, () => false), 'shown again while picking, it loads and encodes the photo again');
    await ctx.close();

    // without the model, on a phone held upright: the pick bar fits and leaves the toolbar uncovered
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route(LIB, (route) => route.fulfill({ status: 404, body: '' }));
    await ctx.addInitScript(`window.__buildWall = ${buildWall.toString()};`);
    page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url);
    await setUp(page);
    const told = await page.waitForFunction(() => window.__toasts.some((m) => /can't load here/.test(m)), null, { timeout: 15000 }).then(() => true, () => false);
    t.ok(told, 'where the model can\'t load, the app says shapes come from edges and colours instead');
    const fit = await page.evaluate(() => {
      const b = document.getElementById('pickBar').getBoundingClientRect(), tb = document.getElementById('toolbar').getBoundingClientRect();
      return { inside: b.left >= 0 && b.right <= innerWidth, below: b.top >= tb.bottom };
    });
    t.ok(fit.inside && fit.below, `upright on a phone, the pick bar fits the screen and sits below the toolbar (${JSON.stringify(fit)})`);
    await tapShape(page, 'glass');
    await page.waitForFunction(() => window.app.project.surfaces.length === 1, null, { timeout: 15000 });
    const f = await overlap(page, 0, 'glass');
    t.ok(f.iou > 0.88 && f.points > 4, `the colour fill outlines the mirror's glass (IoU ${f.iou.toFixed(3)})`);
    // the sliders show now; on a narrow phone each sits on its own row, wholly on screen
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 800 });
      const rows = await page.evaluate(() => ['pickSense', 'pickSimple'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), w: Math.round(r.width) }; }).concat([{ vw: innerWidth }]));
      const [a, b] = rows;
      t.ok(a.w > 120 && b.w > 120 && a.l >= 0 && b.l >= 0 && a.r <= width && b.r <= width && b.t > a.t + 10, `at ${width} px both sliders stack and fit (${JSON.stringify(rows)})`);
    }
    await ctx.close();
    t.ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  } finally {
    await browser.close(); server.close();
  }
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
