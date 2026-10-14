// Joining two surfaces into one: two squares snapped corner to corner become a single surface, so content runs
// across both and they move, bend and fade as one.
// Works in frame pixels. Where the two outlines meet along an edge, they become one outline with the shared edge
// gone; a joined outline with four corners becomes the surface's corner pins, so its content fills it exactly.
import { surfaceGeom, squareToQuad, inv3, hApply, pointInPoly, dist, SHAPES } from './geometry.js';
import { MAX_PART_VERTS } from './renderer.js';

const MAX_PARTS_PER_SURFACE = 8;
const EPS = 0.75;   // frame pixels: snapped corners land on exactly the same point, so this only absorbs rounding

const area = (P) => P.reduce((a, [x, y], k) => { const [x2, y2] = P[(k + 1) % P.length]; return a + x * y2 - x2 * y; }, 0) / 2;
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

// distance from p to segment ab, and how far along it (0..1) the nearest point is
function toSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return { d: Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy), t };
}

// P with Q's vertices that lie on its edges added as vertices, so edges the two only partly share match up
function splitAt(P, Q, eps) {
  const out = [];
  P.forEach((a, k) => {
    const b = P[(k + 1) % P.length];
    out.push(a);
    const on = [];
    for (const q of Q) {
      const { d, t } = toSegment(q, a, b);
      if (d <= eps && dist(q, a) > eps && dist(q, b) > eps) on.push([t, q]);
    }
    on.sort((x, y) => x[0] - y[0]).forEach(([, q]) => out.push([q[0], q[1]]));
  });
  return out;
}

// the edges of two polygons cross somewhere other than where they touch
function edgesCross(A, B, eps) {
  for (let i = 0; i < A.length; i++) {
    const a = A[i], b = A[(i + 1) % A.length], la = dist(a, b) || 1;
    for (let j = 0; j < B.length; j++) {
      const c = B[j], d = B[(j + 1) % B.length], lc = dist(c, d) || 1;
      const d1 = cross(a, b, c) / la, d2 = cross(a, b, d) / la, d3 = cross(c, d, a) / lc, d4 = cross(c, d, b) / lc;
      if (((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps))) return true;
    }
  }
  return false;
}

const onBoundary = (p, P, eps) => P.some((a, k) => toSegment(p, a, P[(k + 1) % P.length]).d <= eps);
// some vertex of A is inside B, not just on its edge
const poke = (A, B, eps) => A.some((p) => pointInPoly(p[0], p[1], B) && !onBoundary(p, B, eps));

function dropCollinear(P, eps) {
  let out = P.slice(), changed = true;
  while (changed && out.length > 3) {
    changed = false;
    for (let k = 0; k < out.length; k++) {
      const a = out[(k + out.length - 1) % out.length], p = out[k], b = out[(k + 1) % out.length];
      if (dist(a, p) <= eps || toSegment(p, a, b).d <= eps * 0.5) { out.splice(k, 1); changed = true; break; }
    }
  }
  return out;
}

// The union of two simple polygons that meet along one or more edges, as one outline. null when they don't share
// an edge, overlap, only touch at a corner, or would leave a hole: those stay separate shapes of one surface.
export function joinPolygons(A, B, eps = EPS) {
  let a = area(A) < 0 ? A.slice().reverse() : A.slice(), b = area(B) < 0 ? B.slice().reverse() : B.slice();
  a = splitAt(a, b, eps); b = splitAt(b, a, eps);
  if (edgesCross(a, b, eps) || poke(a, b, eps) || poke(b, a, eps)) return null;
  const edges = [];
  for (const P of [a, b]) P.forEach((p, k) => edges.push([p, P[(k + 1) % P.length]]));
  const same = (p, q) => dist(p, q) <= eps;
  // with both wound the same way, an edge they share runs in opposite directions: drop both copies
  const keep = edges.filter((e, i) => !edges.some((f, j) => j !== i && same(e[0], f[1]) && same(e[1], f[0])));
  if (keep.length === edges.length || keep.length < 3) return null;
  const out = [], used = new Set();
  let i = 0;
  while (!used.has(i)) {
    used.add(i); out.push(keep[i][0]);
    const next = keep.map((_, j) => j).filter((j) => (!used.has(j) || j === 0) && same(keep[j][0], keep[i][1]));
    if (next.length !== 1) return null;   // they only touch at a point here
    i = next[0];
  }
  if (used.size !== keep.length) return null;   // more than one loop: a hole
  const joined = dropCollinear(out, eps);
  return joined.length >= 3 ? joined : null;
}

// the outlines of two surfaces touch or overlap (within tol frame pixels)
export function surfacesMeet(ga, gb, tol = 2) {
  const polys = (g) => g.parts.filter((p) => p.op > 0).map((p) => p.outline);
  for (const A of polys(ga)) for (const B of polys(gb)) {
    if (A.some((p) => onBoundary(p, B, tol) || pointInPoly(p[0], p[1], B))) return true;
    if (B.some((p) => onBoundary(p, A, tol) || pointInPoly(p[0], p[1], A))) return true;
    if (edgesCross(A, B, 0)) return true;
  }
  return false;
}

const convex = (Q) => { const s = Q.map((p, k) => Math.sign(cross(p, Q[(k + 1) % 4], Q[(k + 2) % 4]))); return s.every((x) => x === s[0] && x !== 0); };

// four frame points as corner pins in the order of a's corners (so the content keeps its way up)
function orderPins(Q, Hi) {
  const uv = Q.map((p) => hApply(Hi, ...p));
  const xs = uv.map((p) => p[0]), ys = uv.map((p) => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), sx = Math.max(...xs) - x0 || 1, sy = Math.max(...ys) - y0 || 1;
  const n = uv.map(([u, v]) => [(u - x0) / sx, (v - y0) / sy]), corners = SHAPES.square();
  let best = null, bd = Infinity;
  for (const dir of [1, -1]) for (let r = 0; r < 4; r++) {
    const idx = [0, 1, 2, 3].map((k) => (r + dir * k + 8) % 4);
    const d = idx.reduce((s, q, k) => s + dist(n[q], corners[k]) ** 2, 0);
    if (d < bd) { bd = d; best = idx.map((q) => Q[q]); }
  }
  return best;
}

// Surface b joined into surface a: a's id, content and soft edge, both outlines. W x H: the frame in pixels.
// Returns { surface, joined (one outline), unbent (a bend grid was dropped) } or { error }.
export function mergeSurfaces(a, b, W, H) {
  const ga = surfaceGeom(a, W, H), gb = surfaceGeom(b, W, H);
  let parts = ga.parts.concat(gb.parts).map((p) => ({ op: p.op, px: p.outline }));
  let joined = false;
  if (ga.parts[0]?.op > 0 && gb.parts[0]?.op > 0) {
    const j = joinPolygons(ga.parts[0].outline, gb.parts[0].outline);
    if (j && j.length <= MAX_PART_VERTS) {
      parts = [{ op: 1, px: j }].concat(ga.parts.slice(1).map((p) => ({ op: p.op, px: p.outline })), gb.parts.slice(1).map((p) => ({ op: p.op, px: p.outline })));
      joined = true;
    }
  }
  if (parts.length > MAX_PARTS_PER_SURFACE) return { error: `Together they'd have ${parts.length} shapes; a surface can have ${MAX_PARTS_PER_SURFACE}.` };
  if (parts.some((p) => p.px.length > MAX_PART_VERTS)) return { error: 'One of the outlines has too many points to join.' };
  // a's flat perspective (its bend grid, if any, can't stretch over b)
  const Hm = squareToQuad(ga.pins), Hi = inv3(Hm);
  let pins, toUV;
  const quad = parts.length === 1 && parts[0].px.length === 4 && convex(parts[0].px) ? orderPins(parts[0].px, Hi) : null;
  if (quad) {
    pins = quad;
    const Hq = inv3(squareToQuad(quad));
    toUV = (p) => hApply(Hq, ...p);
  } else {
    // a's perspective stretched over the box that holds both, in a's own uv
    const uv = parts.flatMap((p) => p.px.map((q) => hApply(Hi, ...q)));
    const us = uv.map((p) => p[0]), vs = uv.map((p) => p[1]);
    const u0 = Math.min(...us), v0 = Math.min(...vs), du = Math.max(...us) - u0 || 1, dv = Math.max(...vs) - v0 || 1;
    pins = [[u0, v0], [u0 + du, v0], [u0 + du, v0 + dv], [u0, v0 + dv]].map(([u, v]) => hApply(Hm, u, v));
    toUV = (p) => { const [u, v] = hApply(Hi, ...p); return [(u - u0) / du, (v - v0) / dv]; };
  }
  if (pins.some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) return { error: 'These two can\'t be joined: their perspectives are too different.' };
  const surface = structuredClone(a);
  delete surface.mesh; delete surface.input;
  surface.pins = pins.map(([x, y]) => [x / W, y / H]);
  surface.parts = parts.map((p) => ({ op: p.op, pts: quad ? SHAPES.square() : p.px.map(toUV) }));
  return { surface, joined, unbent: !!(a.mesh || b.mesh) };
}
