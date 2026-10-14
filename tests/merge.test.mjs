// Joining two surfaces into one, in Node: outlines that share an edge become one outline, a joined rectangle
// becomes the surface's corner pins, and outlines that overlap or only touch at a corner stay separate shapes.
import { reporter } from './serve.mjs';
import { joinPolygons, mergeSurfaces, surfacesMeet } from '../app/src/merge.js';
import { surfaceGeom, hApply, squareToQuad } from '../app/src/geometry.js';

const sq = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const unit = () => [[0, 0], [1, 0], [1, 1], [0, 1]];
// a flat surface over frame pixels (corners: bottom-left, bottom-right, top-right, top-left), W x H = 1280 x 720
const surf = (id, x, y, w, h, extra = {}) => ({ id, pins: [[x, y + h], [x + w, y + h], [x + w, y], [x, y]].map(([a, b]) => [a / 1280, b / 720]), parts: [{ op: 1, pts: unit() }], content: { kind: 'effect', effect: id }, ...extra });
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const samePts = (P, Q, e = 0.01) => P.length === Q.length && P.every((p) => Q.some((q) => near(p[0], q[0], e) && near(p[1], q[1], e)));
const outline = (s) => surfaceGeom(s, 1280, 720).parts.map((p) => p.px);

export default async function run() {
  const t = reporter('merge');

  t.ok(samePts(joinPolygons(sq(0, 0, 100, 100), sq(100, 0, 100, 100)) || [], sq(0, 0, 200, 100)), 'two squares side by side join into one rectangle');
  const L = joinPolygons(sq(0, 0, 100, 100), sq(100, 50, 100, 100));
  t.ok(L && L.length === 8, `squares sharing part of an edge join into one outline (${L?.length} corners)`);
  const wound = joinPolygons(sq(0, 0, 100, 100), sq(100, 0, 100, 100).reverse());
  t.ok(wound && wound.length === 4, 'outlines wound either way still join');
  t.ok(joinPolygons(sq(0, 0, 100, 100), sq(100, 100, 100, 100)) === null, 'squares touching only at a corner stay separate');
  t.ok(joinPolygons(sq(0, 0, 100, 100), sq(50, 50, 100, 100)) === null, 'overlapping squares stay separate');
  t.ok(joinPolygons(sq(0, 0, 100, 100), sq(300, 0, 100, 100)) === null, 'squares apart stay separate');

  // in the app's terms: two snapped squares in the frame
  const a = surf('a', 200, 200, 200, 200), b = surf('b', 400, 200, 200, 200), far = surf('c', 900, 200, 100, 100);
  t.ok(surfacesMeet(surfaceGeom(a, 1280, 720), surfaceGeom(b, 1280, 720)), 'snapped neighbours meet');
  t.ok(!surfacesMeet(surfaceGeom(a, 1280, 720), surfaceGeom(far, 1280, 720)), 'a surface across the frame doesn\'t');
  const r = mergeSurfaces(a, b, 1280, 720);
  t.ok(r.surface && r.joined && r.surface.parts.length === 1 && r.surface.parts[0].pts.length === 4, 'they become one surface with one four-cornered outline');
  t.ok(r.surface.id === 'a' && r.surface.content.effect === 'a', 'it keeps the first one\'s id and content');
  t.ok(samePts(outline(r.surface)[0], sq(200, 200, 400, 200)), 'its outline covers both');
  t.ok(samePts(r.surface.pins.map(([x, y]) => [x * 1280, y * 720]), sq(200, 200, 400, 200)), 'its corner pins are the joined rectangle\'s corners, so content fills it');
  t.ok(near(r.surface.pins[0][0], a.pins[0][0]) && near(r.surface.pins[0][1], a.pins[0][1]), 'the pins keep the first surface\'s way up');

  // in perspective, and partly sharing an edge: one outline, a's perspective stretched over both
  const p = { ...surf('p', 200, 200, 200, 200), pins: [[200, 420], [400, 400], [400, 200], [200, 180]].map(([x, y]) => [x / 1280, y / 720]) };
  const q = surf('q', 400, 250, 150, 120);
  const r2 = mergeSurfaces(p, q, 1280, 720), o2 = outline(r2.surface)[0];
  t.ok(r2.joined && r2.surface.parts.length === 1, 'a square joined to a smaller one beside it is one outline');
  const want = [[200, 420], [400, 400], [400, 370], [550, 370], [550, 250], [400, 250], [400, 200], [200, 180]];
  t.ok(samePts(o2, want, 0.05), 'the outline runs exactly round both: ' + JSON.stringify(o2.map(([x, y]) => [Math.round(x), Math.round(y)])));
  const H = squareToQuad(r2.surface.pins.map(([x, y]) => [x * 1280, y * 720]));
  t.ok(r2.surface.parts[0].pts.every(([u, v]) => u > -1e-6 && v > -1e-6 && u < 1 + 1e-6 && v < 1 + 1e-6) && hApply(H, 0, 0).every(Number.isFinite), 'the content box holds the whole outline');

  // corner to corner only, or with cut-outs and a bend: one surface, separate shapes
  const d = surf('d', 400, 400, 100, 100);
  const r3 = mergeSurfaces(a, d, 1280, 720);
  t.ok(!r3.joined && r3.surface.parts.length === 2 && samePts(outline(r3.surface)[1], sq(400, 400, 100, 100)), 'squares touching at a corner become one surface of two shapes, each where it was');
  const holed = { ...b, parts: [{ op: 1, pts: unit() }, { op: -1, pts: [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]] }], mesh: { n: [2, 2], pts: [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [0.5, 0.5], [1, 0.5], [0, 1], [0.5, 1], [1, 1]] } };
  const r4 = mergeSurfaces(a, holed, 1280, 720);
  t.ok(r4.joined && r4.surface.parts.length === 2 && r4.surface.parts[1].op === -1 && r4.unbent && !r4.surface.mesh, 'a cut-out comes along, and a flat bend grid is dropped (and said so)');
  const many = { ...b, parts: Array.from({ length: 8 }, () => ({ op: 1, pts: unit() })) };
  const cut = { ...a, parts: [{ op: 1, pts: unit() }, { op: -1, pts: [[0.4, 0.4], [0.6, 0.4], [0.5, 0.6]] }] };
  t.ok(!!mergeSurfaces(cut, many, 1280, 720).error, 'more than eight shapes in one surface is refused');
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
