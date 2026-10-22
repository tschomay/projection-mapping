// One tap on the design photo -> the shapes around it (issues #35, #37, #39). The same code serves the app and the
// photo benchmarks, so what's measured is what runs. No DOM here.
//
// With the segmentation model, its masks decide what was tapped, and where a mask closely matches a rectangle found
// from the photo's straight edges, that rectangle is used: the model is better at telling which thing it is (a
// textured backsplash, a door behind a towel), the edges at where exactly its sides are. Without the model (offline,
// or while it downloads), rectangles come from the edges alone and other shapes from a
// colour fill. On a set of labelled photos the model with matching gets the right shape first time about twice as
// often as edges alone (tests/bench/pick.bench.mjs).
import { quadsAt } from './regions.js';
import { colourFill, maskToSurface } from './outline.js';
import { SHAPES } from './geometry.js';

export const DEFAULTS = { sense: 0.5, simple: 0.4 };

// Rectangles around photo pixel (x, y) from edges. When none turn up at the chosen sensitivity, fainter edges are
// tried too (a white cabinet door's panel next to a textured ceiling): { quads, sense } with the one that found them.
export function rectsAt(A, x, y, sense = DEFAULTS.sense) {
  for (let s = sense; s <= 1.001; s += 0.25) {
    const quads = quadsAt(A, x, y, { sense: Math.min(1, s) });
    if (quads.length) return { quads, sense: Math.min(1, s) };
  }
  return { quads: [], sense };
}

// What's around photo pixel (x, y) of photo P ({ rgba, w, h, A }): { masks (from the model or the colour fill),
// quads (rectangles from edges, every strictness tried), source: 'model' | 'edges' }. kind 'rect' or 'any' only
// decides the fallback without the model. memo (a Map, one per tap) keeps the rectangles found at each strictness, so
// moving Sensitivity back and forth doesn't search again.
export async function findAt({ seg, P, x, y, kind = 'any', sense = DEFAULTS.sense, memo = new Map() }) {
  const { rgba, w, h, A } = P;
  const rects = (s) => { if (!memo.has(s)) memo.set(s, quadsAt(A, x, y, { sense: s })); return memo.get(s); };
  if (!seg && kind === 'rect') {
    for (let s = sense; s <= 1.001; s += 0.25) { const q = rects(Math.min(1, s)); if (q.length) return { masks: [], quads: q.map((f) => f.quad), source: 'edges' }; }
    return { masks: [], quads: [], source: 'edges' };
  }
  const seen = new Set(), quads = [];
  for (const s of [sense, 0.75, 1]) for (const f of rects(s)) {
    const key = f.quad.map((p) => p.map(Math.round).join(',')).join(' ');
    if (!seen.has(key)) { seen.add(key); quads.push(f.quad); }
  }
  if (seg) {
    try { const masks = await seg.masksAt(x, y, { sense }); if (masks.length) return { masks, quads, source: 'model' }; } catch { /* the model failed here */ }
  }
  if (kind === 'rect') return { masks: [], quads: rectsAt(A, x, y, sense).quads.map((f) => f.quad), source: 'edges' };
  return { masks: colourFill(rgba, w, h, x, y, A, { sense }), quads, source: 'edges' };
}

// The candidates as surface geometry { pins, parts }, mapped into the frame by toFrame([x, y]) -> frame pixels.
// Masks first (each a matched rectangle, a quad, or its outline; always four corners for kind 'rect'); without
// masks, the rectangles themselves.
export function shapesOf(found, { kind = 'any', P, x, y, toFrame, W, H, simple = DEFAULTS.simple }) {
  if (!found.masks.length) {
    return found.quads.map((q) => {
      const c = q.map((p) => { const [fx, fy] = toFrame(p); return [fx / W, fy / H]; });
      return { pins: [c[3], c[2], c[1], c[0]], parts: [{ op: 1, pts: SHAPES.square() }] };
    });
  }
  return found.masks.map((m) => maskToSurface(m.mask, P.w, P.h, x, y, toFrame, W, H, { simple, quads: found.quads, rect: kind === 'rect' })).filter(Boolean);
}
