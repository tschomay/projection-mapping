// Benchmark for issue #37: the real outline model (SlimSAM through transformers.js, downloaded from jsDelivr and
// Hugging Face, so it needs the network) against the colour fill, on the synthetic wall (scene.mjs). Each round or
// rectangular thing is tapped once; the outline of every mask it gives is compared with the true outlines in the
// projector frame (IoU). Not part of `npm test`. Usage: node bench/segment.bench.mjs
import { readFile } from 'node:fs/promises';
import { loadPlaywright, BROWSER_ARGS } from '../serve.mjs';
import { buildWall } from '../scene.mjs';

const { chromium } = await loadPlaywright();
// behind an HTTPS proxy (as in a sandbox) the browser has to be told about it, and it then sends even local requests
// there, so the app's own files are handed to the page directly instead of from a local server
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const browser = await chromium.launch({ args: BROWSER_ARGS, proxy });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(300000);
  await page.route('https://app.test/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    try { route.fulfill({ status: 200, contentType: path.endsWith('.js') ? 'text/javascript' : 'text/html', body: await readFile(new URL('../../app' + path, import.meta.url)) }); } catch { route.fulfill({ status: 404, body: '' }); }
  });
  await page.goto('https://app.test/manifest.webmanifest');
  const out = await page.evaluate(async (wallSrc) => {
    const buildWall = (0, eval)('(' + wallSrc + ')');
    const [{ loadSegmenter }, { colourFill, maskToSurface }, { frameQuad, photoPointToFrame }, { analysePhoto }, { surfaceGeom, pointInPoly }] = await Promise.all(
      ['segment', 'outline', 'photo', 'regions', 'geometry'].map((m) => import(`/src/${m}.js`)));
    const W = 1280, H = 720, wall = buildWall({ W, H }), { camW: w, camH: h } = wall, n = w * h;
    const lum = (img) => { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = 0.299 * img[i * 4] + 0.587 * img[i * 4 + 1] + 0.114 * img[i * 4 + 2]; return o; };
    const rgba = wall.photo(0, 3), fq = frameQuad(lum(rgba), lum(wall.photo(1, 4)), w, h), A = analysePhoto(rgba, w, h);
    const toFrame = ([x, y]) => { const [u, v] = photoPointToFrame(fq.quad, x / w, y / h); return [u * W, v * H]; };
    const truth = {};
    for (const [k, r] of Object.entries(wall.rects)) truth[k] = r;
    for (const [k, r] of Object.entries(wall.shapes)) truth[k] = r;
    const box = (P) => [Math.min(...P.map((p) => p[0])), Math.max(...P.map((p) => p[0])), Math.min(...P.map((p) => p[1])), Math.max(...P.map((p) => p[1]))];
    const iou = (P, Q) => {
      const a = box(P), b = box(Q);
      if (a[1] < b[0] || b[1] < a[0] || a[3] < b[2] || b[3] < a[2]) return 0;
      let i = 0, u = 0;
      for (let y = Math.min(a[2], b[2]); y <= Math.max(a[3], b[3]); y++) for (let x = Math.min(a[0], b[0]); x <= Math.max(a[1], b[1]); x++) {
        const p = pointInPoly(x, y, P), q = pointInPoly(x, y, Q); if (p && q) i++; if (p || q) u++;
      }
      return i / u;
    };
    const describe = (masks, x, y) => masks.map((m) => {
      const s = maskToSurface(m.mask, w, h, x, y, toFrame, W, H);
      if (!s) return 'none';
      const outline = surfaceGeom(s, W, H).parts[0].outline;
      let best = ['?', 0];
      for (const [k, t] of Object.entries(truth)) { const v = iou(outline, t.frame); if (v > best[1]) best = [k, v]; }
      return `${best[0]} ${best[1].toFixed(3)}${s.quad ? ' (quad)' : ''}`;
    });
    const t0 = performance.now();
    const seg = await loadSegmenter();
    const t1 = performance.now();
    await seg.embed(rgba, w, h, 'wall');
    const t2 = performance.now();
    const rows = [];
    for (const name of ['glass', 'mirror', 'panel2', 'art1', 'art2']) {
      const c = truth[name].cam.reduce((a, p, _, all) => [a[0] + p[0] / all.length, a[1] + p[1] / all.length], [0, 0]);
      const t3 = performance.now(), masks = await seg.masksAt(c[0], c[1]), t4 = performance.now();
      rows.push({ tap: name, model: describe(masks, c[0], c[1]), ms: Math.round(t4 - t3), fill: describe(colourFill(rgba, w, h, c[0], c[1], A), c[0], c[1]) });
    }
    return { load: Math.round(t1 - t0), embed: Math.round(t2 - t1), rows };
  }, buildWall.toString());
  console.log(`model loaded in ${out.load} ms, photo encoded in ${out.embed} ms`);
  for (const r of out.rows) console.log(`tap ${r.tap.padEnd(7)} model (${r.ms} ms): ${r.model.join(', ')}\n${' '.repeat(12)}colour fill: ${r.fill.join(', ')}`);
} finally {
  await browser.close();
}
