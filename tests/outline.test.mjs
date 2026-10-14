// Any-shape outlines (issue #37), in Node: masks traced into outlines, outlines into surfaces (a quad's corners as pins,
// or the outline as the shape's points), and the colour fill from a tap on the synthetic wall (scene.mjs) outlining a
// round mirror's glass, then the glass with its ring, and a wainscoting panel as a quad. Compared with the true
// outlines in the projector frame by IoU.
import { frameQuad, photoPointToFrame } from '../app/src/photo.js';
import { analysePhoto } from '../app/src/regions.js';
import { traceOutline, maskPolygon, outlineToSurface, colourFill, maskToSurface, polyArea, MAX_OUTLINE } from '../app/src/outline.js';
import { surfaceGeom, pointInPoly } from '../app/src/geometry.js';
import { buildWall } from './scene.mjs';
import { reporter } from './serve.mjs';

const box = (P) => [Math.min(...P.map((p) => p[0])), Math.max(...P.map((p) => p[0])), Math.min(...P.map((p) => p[1])), Math.max(...P.map((p) => p[1]))];
export function iou(P, Q) {
  const a = box(P), b = box(Q);
  let i = 0, u = 0;
  for (let y = Math.floor(Math.min(a[2], b[2])); y <= Math.max(a[3], b[3]); y++) for (let x = Math.floor(Math.min(a[0], b[0])); x <= Math.max(a[1], b[1]); x++) {
    const p = pointInPoly(x + 0.5, y + 0.5, P), q = pointInPoly(x + 0.5, y + 0.5, Q);
    if (p && q) i++; if (p || q) u++;
  }
  return u ? i / u : 0;
}

export default async function run() {
  const t = reporter('outline');

  // tracing: an L of six pixels gives its eight corners, clockwise on screen
  const m = new Uint8Array(30);
  for (const [x, y] of [[1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [1, 3]]) m[y * 6 + x] = 1;
  t.ok(JSON.stringify(traceOutline(m, 6, 5)) === '[[1,1],[4,1],[4,2],[3,2],[3,3],[2,3],[2,4],[1,4]]', 'a mask is traced along its pixel edges, clockwise');

  // a big disc: simplified to the outline limit, still round, and a surface with the disc as its shape
  const R = 150, w = 400, disc = new Uint8Array(w * w);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) if (Math.hypot(x + 0.5 - 200, y + 0.5 - 200) < R) disc[y * w + x] = 1;
  const poly = maskPolygon(disc, w, w, { simple: 0 });
  t.ok(poly.length <= MAX_OUTLINE && Math.abs(Math.abs(polyArea(poly)) / (Math.PI * R * R) - 1) < 0.01, `a disc becomes ${poly.length} points within 1% of its area`);

  // simplicity (issue #39): a square turned 20 degrees has a pixel staircase along every side. Detailed keeps it, simple
  // straightens it to about its four corners, and every setting still matches the square.
  const sqr = new Uint8Array(w * w), c20 = Math.cos(0.35), s20 = Math.sin(0.35);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const u = (x + 0.5 - 200) * c20 + (y + 0.5 - 200) * s20, v = -(x + 0.5 - 200) * s20 + (y + 0.5 - 200) * c20; if (Math.abs(u) < 90 && Math.abs(v) < 90) sqr[y * w + x] = 1; }
  const truthSq = [[-90, -90], [90, -90], [90, 90], [-90, 90]].map(([u, v]) => [200 + u * c20 - v * s20, 200 + u * s20 + v * c20]);
  const counts = [0, 0.4, 1].map((simple) => { const pl = maskPolygon(sqr, w, w, { simple }); return { n: pl.length, iou: iou(pl, truthSq) }; });
  t.ok(counts[0].n > 3 * counts[1].n && counts[2].n <= 6, `a slanted square: ${counts.map((c) => c.n).join(' → ')} points from detailed to simple`);
  t.ok(counts.every((c) => c.iou > 0.97), `and its outline matches at every setting (IoU ${counts.map((c) => c.iou.toFixed(3)).join(', ')})`);

  // hard corners stay hard whatever the shape, and curves stay curves: an L and a hexagon (turned) come out as just
  // their corners, a disc stays round even at the simple end, and an arch keeps its sharp bottom corners under its
  // curved top
  const rot = (P, a) => P.map(([x, y]) => [200 + (x - 200) * Math.cos(a) - (y - 200) * Math.sin(a), 200 + (x - 200) * Math.sin(a) + (y - 200) * Math.cos(a)]);
  const raster = (P) => { const mk = new Uint8Array(w * w); for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) if (pointInPoly(x + 0.5, y + 0.5, P)) mk[y * w + x] = 1; return mk; };
  const L = rot([[100, 100], [220, 100], [220, 220], [300, 220], [300, 300], [100, 300]], 0.26);
  const hex = Array.from({ length: 6 }, (_, k) => [200 + 110 * Math.cos(k * Math.PI / 3 + 0.2), 200 + 110 * Math.sin(k * Math.PI / 3 + 0.2)]);
  for (const [name, P] of [['an L', L], ['a hexagon', hex]]) {
    const q = maskPolygon(raster(P), w, w, { simple: 0.4 }), v = iou(q, P);
    t.ok(q.length === P.length && v > 0.99, `${name} comes out as its ${P.length} corners (${q.length} points, IoU ${v.toFixed(3)})`);
  }
  const ring = Array.from({ length: 200 }, (_, k) => [200 + 120 * Math.cos(k * Math.PI / 100), 200 + 120 * Math.sin(k * Math.PI / 100)]);
  const round = maskPolygon(raster(ring), w, w, { simple: 1 });
  t.ok(round.length >= 12 && iou(round, ring) > 0.98, `a disc stays round at the simple end (${round.length} points, IoU ${iou(round, ring).toFixed(3)})`);
  const arch = rot([[120, 320], [280, 320], ...Array.from({ length: 61 }, (_, k) => [200 + 80 * Math.cos(k * Math.PI / 60), 160 - 80 * Math.sin(k * Math.PI / 60)])], 0.12);
  const aq = maskPolygon(raster(arch), w, w, { simple: 0.6 }), off = Math.max(...[arch[0], arch[1]].map((c) => Math.min(...aq.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1])))));
  t.ok(off < 0.5 && iou(aq, arch) > 0.99, `an arch keeps its sharp bottom corners (within ${off.toFixed(2)} px) under a round top (IoU ${iou(aq, arch).toFixed(3)})`);
  const s = outlineToSurface(poly, 1280, 720);
  const back = surfaceGeom(s, 1280, 720).parts[0].outline;
  t.ok(!s.quad && iou(back, poly) > 0.99, 'a round outline keeps its shape as the surface\'s points');
  const sq = outlineToSurface([[100, 100], [300, 110], [290, 300], [105, 290]], 1280, 720);
  t.ok(sq.quad && Math.abs(sq.pins[3][0] * 1280 - 100) < 1e-6 && Math.abs(sq.pins[3][1] * 720 - 100) < 1e-6, 'a four-sided outline becomes a quad, its corners the pins');

  // the colour fill on the wall
  const W = 1280, H = 720, wall = buildWall({ W, H }), { camW, camH } = wall, n = camW * camH;
  const lum = (img) => { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = 0.299 * img[i * 4] + 0.587 * img[i * 4 + 1] + 0.114 * img[i * 4 + 2]; return o; };
  const rgba = wall.photo(0, 3), fq = frameQuad(lum(rgba), lum(wall.photo(1, 4)), camW, camH), A = analysePhoto(rgba, camW, camH);
  const toFrame = ([x, y]) => { const [u, v] = photoPointToFrame(fq.quad, x / camW, y / camH); return [u * W, v * H]; };
  const centre = (P) => P.reduce((a, p) => [a[0] + p[0] / P.length, a[1] + p[1] / P.length], [0, 0]);
  const outlines = (c) => colourFill(rgba, camW, camH, c[0], c[1], A).map((mk) => maskToSurface(mk.mask, camW, camH, c[0], c[1], toFrame, W, H));

  const t0 = Date.now(), mirror = outlines(centre(wall.shapes.glass.cam)), ms = Date.now() - t0;
  const g = mirror[0] && iou(surfaceGeom(mirror[0], W, H).parts[0].outline, wall.shapes.glass.frame);
  const r = mirror[1] && iou(surfaceGeom(mirror[1], W, H).parts[0].outline, wall.shapes.mirror.frame);
  t.ok(g > 0.9 && !mirror[0].quad, `a tap on a round mirror outlines its glass (IoU ${g?.toFixed(3)}, in ${ms} ms)`);
  t.ok(r > 0.9, `tapping again takes in its ring (IoU ${r?.toFixed(3)})`);
  const panel = outlines(centre(wall.rects.panel2.cam))[0];
  const pi = panel && iou(surfaceGeom(panel, W, H).parts[0].outline, wall.rects.panel2.frame);
  t.ok(panel?.quad && pi > 0.9, `a tap on a panel gives a quad surface (IoU ${pi?.toFixed(3)})`);
  const flat = new Uint8ClampedArray(160 * 120 * 4).fill(128);
  t.ok(colourFill(flat, 160, 120, 80, 60, analysePhoto(flat, 160, 120)).length === 0, 'a tap on a plain photo finds nothing (no area that big is a surface)');
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
