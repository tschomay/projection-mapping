// One tap on the design photo -> the shapes around it, innermost first (issues #35, #37, #39). The same code serves
// the app and the photo benchmarks, so what's measured is what runs. No DOM here.
import { quadsAt } from './regions.js';
import { colourFill, maskToSurface } from './outline.js';
import { SHAPES } from './geometry.js';

export const DEFAULTS = { sense: 0.5, simple: 0.4 };

// Rectangles around photo pixel (x, y). When none turn up at the chosen sensitivity, fainter edges are tried too
// (a white cabinet door's panel next to a textured ceiling): { quads, sense } with the sensitivity that found them.
export function rectsAt(A, x, y, sense = DEFAULTS.sense) {
  for (let s = sense; s <= 1.001; s += 0.25) {
    const quads = quadsAt(A, x, y, { sense: Math.min(1, s) });
    if (quads.length) return { quads, sense: Math.min(1, s) };
  }
  return { quads: [], sense };
}

// Masks around photo pixel (x, y): the segmentation model's when there is one and it finds something, else the
// colour fill's. { masks, source: 'model' | 'fill' }
export async function masksAt({ seg, rgba, w, h, A, x, y, sense = DEFAULTS.sense }) {
  if (seg) {
    try { const masks = await seg.masksAt(x, y, { sense }); if (masks.length) return { masks, source: 'model' }; } catch { /* the model failed here: the fill */ }
  }
  return { masks: colourFill(rgba, w, h, x, y, A, { sense }), source: 'fill' };
}

// Candidates as surface geometry { pins, parts }: rectangles' corners (photo pixels) or masks' outlines, mapped into
// the frame by toFrame([x, y]) -> frame pixels.
export function rectGeometry(quads, toFrame, W, H) {
  return quads.map(({ quad }) => {
    const c = quad.map((p) => { const [fx, fy] = toFrame(p); return [fx / W, fy / H]; });
    return { pins: [c[3], c[2], c[1], c[0]], parts: [{ op: 1, pts: SHAPES.square() }] };
  });
}
export function maskGeometry(masks, w, h, x, y, toFrame, W, H, simple = DEFAULTS.simple) {
  return masks.map((m) => maskToSurface(m.mask, w, h, x, y, toFrame, W, H, { simple })).filter(Boolean);
}
