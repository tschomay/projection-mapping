// How well a tap on a photo finds the thing meant (issues #35, #37, #39), on the labelled photos in tests/photos
// (and PHOTOS=dir, a folder of your own laid out the same way). Runs the app's own picking (src/pick.js) in Chromium
// four ways: the shape model in Any-shape and Rectangle mode, and without it, rectangles from edges and the colour
// fill. A tap scores by how its shapes overlap the labelled outline (IoU, 0.85 or more counts as right): the first
// shape, and the best of the first three (tapping inside it twice more). The model is downloaded from jsDelivr and
// Hugging Face, so this needs the network; --no-model leaves it out. Not part of `npm test`.
// Usage: node bench/pick.bench.mjs [--no-model] [--split dev|holdout] [--sense 0.5] [--simple 0.4] [--verbose]
//        [--dump runs.json] (every tap's shapes, for trying other orderings)
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, BROWSER_ARGS } from '../serve.mjs';
import { pointInPoly } from '../../app/src/geometry.js';

const arg = (name, dflt) => { const i = process.argv.indexOf('--' + name); return i < 0 ? dflt : process.argv[i + 1]; };
const flag = (name) => process.argv.includes('--' + name);
const split = arg('split', 'all'), sense = +arg('sense', 0.5), simple = +arg('simple', 0.4), useModel = !flag('no-model');
const APP = fileURLToPath(new URL('../../app/', import.meta.url));
const dirs = [fileURLToPath(new URL('../photos/', import.meta.url))].concat(process.env.PHOTOS ? [process.env.PHOTOS] : []);
const photos = [];
for (const dir of dirs) for (const [name, p] of Object.entries(JSON.parse(readFileSync(join(dir, 'labels.json'), 'utf8')))) {
  if (split === 'all' || p.split === split) photos.push({ name, path: join(dir, p.file), ...p });
}

// overlap of two outlines, sampled at pixel centres
const box = (P) => [Math.min(...P.map((p) => p[0])), Math.max(...P.map((p) => p[0])), Math.min(...P.map((p) => p[1])), Math.max(...P.map((p) => p[1]))];
function areas(P, Q) {
  const a = box(P), b = box(Q);
  let i = 0, p = 0, q = 0;
  if (a[1] < b[0] || b[1] < a[0] || a[3] < b[2] || b[3] < a[2]) return { p: 1, q: 1, i: 0 };
  for (let y = Math.floor(Math.min(a[2], b[2])); y <= Math.max(a[3], b[3]); y++) for (let x = Math.floor(Math.min(a[0], b[0])); x <= Math.max(a[1], b[1]); x++) {
    const ip = pointInPoly(x + 0.5, y + 0.5, P), iq = pointInPoly(x + 0.5, y + 0.5, Q);
    if (ip) p++; if (iq) q++; if (ip && iq) i++;
  }
  return { p, q, i };
}
const iou = (P, Q) => { const { p, q, i } = areas(P, Q); return p + q - i ? i / (p + q - i) : 0; };
// a shape's score for a target: IoU with its best level, or 1 when it lies between the innermost and outermost level
function quality(c, levels) {
  let best = Math.max(0, ...levels.map((l) => iou(c, l)));
  if (levels.length > 1 && best < 0.85) {
    const inner = areas(levels[0], c), outer = areas(c, levels[levels.length - 1]);
    if (inner.i / inner.p >= 0.93 && outer.i / outer.p >= 0.93) best = 1;
  }
  return best;
}

const { chromium } = await loadPlaywright();
// behind an HTTPS proxy the browser has to be told about it; it then sends even local requests there, so the app's
// files and the photos are handed to the page directly
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const browser = await chromium.launch({ args: BROWSER_ARGS, proxy });
const TYPES = { '.js': 'text/javascript', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(900000);
  await page.route('https://bench.test/**', (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname);
    const file = path.startsWith('/photo/') ? photos[+path.split('/')[2]].path : join(APP, path);
    if (!existsSync(file)) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ status: 200, contentType: TYPES[extname(file).toLowerCase()] || 'text/html', body: path === '/' ? '<!doctype html>' : readFileSync(file) });
  });
  await page.goto('https://bench.test/');
  const t0 = Date.now();
  const runs = await page.evaluate(async ({ photos, sense, simple, useModel }) => {
    const [{ findAt, shapesOf }, { analysePhoto }, { surfaceGeom }, { loadSegmenter }] = await Promise.all(['pick', 'regions', 'geometry', 'segment'].map((m) => import(`/src/${m}.js`)));
    const seg = useModel ? await loadSegmenter() : null;
    const out = [];
    for (let pi = 0; pi < photos.length; pi++) {
      // the photo as the app reads it: decoded by the browser, drawn 1024 pixels wide
      const img = new Image(); img.src = `/photo/${pi}/x`; await img.decode();
      const w = 1024, h = Math.round(img.naturalHeight * w / img.naturalWidth), c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, w, h);
      const P = { rgba: ctx.getImageData(0, 0, w, h).data, w, h, A: analysePhoto(ctx.getImageData(0, 0, w, h).data, w, h) };
      if (seg) await seg.embed(P.rgba, w, h, photos[pi].name);
      const id = (p) => p, outline = (g) => surfaceGeom(g, w, h).parts[0].outline;
      for (const t of photos[pi].targets) {
        const [x, y] = t.tap, row = { photo: photos[pi].name, split: photos[pi].split, name: t.name, kind: t.kind, levels: t.levels, ways: {} };
        const ways = { edges: [null, 'rect'], fill: [null, 'any'] };
        if (seg) Object.assign(ways, { model: [seg, 'any'], 'model, rectangles': [seg, 'rect'] });
        for (const [way, [s, kind]] of Object.entries(ways)) {
          if (way === 'edges' && t.kind !== 'rect') continue;
          const found = await findAt({ seg: s, P, x, y, kind, sense });
          row.ways[way] = shapesOf(found, { kind, P, x, y, toFrame: id, W: w, H: h, simple }).map(outline);
        }
        out.push(row);
      }
    }
    return out;
  }, { photos: photos.map(({ name, split, targets }) => ({ name, split, targets })), sense, simple, useModel });

  if (arg('dump')) writeFileSync(arg('dump'), JSON.stringify(runs));
  const tot = {};
  for (const r of runs) {
    const line = [];
    for (const [way, shapes] of Object.entries(r.ways)) {
      const s = shapes.map((c) => quality(c, r.levels)), first = s[0] ?? 0, three = Math.max(0, ...s.slice(0, 3));
      for (const k of [r.split, 'all']) {
        const t = ((tot[k] ||= {})[way] ||= [0, 0, 0]);
        t[0]++; if (first >= 0.85) t[1]++; if (three >= 0.85) t[2]++;
      }
      line.push(`${way} ${s.slice(0, 3).map((v) => v.toFixed(2)).join('/') || '-'}`);
    }
    if (flag('verbose')) console.log(`${r.photo.padEnd(14)} ${r.name.padEnd(20)} ${line.join('  |  ')}`);
  }
  console.log(`${runs.length} taps on ${photos.length} photos in ${((Date.now() - t0) / 1000).toFixed(0)} s (sensitivity ${sense}, simplify ${simple})`);
  for (const [k, ways] of Object.entries(tot)) for (const [way, [n, a, b]] of Object.entries(ways)) console.log(`${k.padEnd(8)} ${way.padEnd(18)} first shape right ${a}/${n}, within three taps ${b}/${n}`);
} finally {
  await browser.close();
}
