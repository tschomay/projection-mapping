// Any-shape outlines from a tap on the design photo (issue #37). A mask (one byte per photo pixel, from the
// segmentation model in segment.js or from the colour fill here) becomes a surface: its outline traced and simplified,
// and corner pins that suit it. No DOM here.
import { convexHull, maxQuad, fitLine, intersect } from './photo.js';
import { squareToQuad, inv3, hApply, SHAPES, pointInPoly } from './geometry.js';
import { edgeLevel } from './regions.js';

export const MAX_OUTLINE = 96;   // points per outline; the renderer takes 128 per shape, which leaves room to add some

export function polyArea(p) {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
}

// the connected part of a mask (4-connected) that holds pixel (x, y), with its holes filled; null if (x, y) is outside
export function componentAt(mask, w, h, x, y) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= w || y >= h || !mask[y * w + x]) return null;
  const n = w * h, out = new Uint8Array(n), stack = new Int32Array(n);
  let top = 0, area = 0;
  stack[top++] = y * w + x; out[y * w + x] = 1;
  while (top) {
    const i = stack[--top]; area++;
    const cx = i % w;
    if (i >= w && mask[i - w] && !out[i - w]) { out[i - w] = 1; stack[top++] = i - w; }
    if (i < n - w && mask[i + w] && !out[i + w]) { out[i + w] = 1; stack[top++] = i + w; }
    if (cx > 0 && mask[i - 1] && !out[i - 1]) { out[i - 1] = 1; stack[top++] = i - 1; }
    if (cx < w - 1 && mask[i + 1] && !out[i + 1]) { out[i + 1] = 1; stack[top++] = i + 1; }
  }
  // holes: whatever the outside can't reach from the border
  const outside = new Uint8Array(n); top = 0;
  const seed = (i) => { if (!out[i] && !outside[i]) { outside[i] = 1; stack[top++] = i; } };
  for (let i = 0; i < w; i++) { seed(i); seed(n - w + i); }
  for (let j = 0; j < h; j++) { seed(j * w); seed(j * w + w - 1); }
  while (top) {
    const i = stack[--top], cx = i % w;
    if (i >= w) seed(i - w);
    if (i < n - w) seed(i + w);
    if (cx > 0) seed(i - 1);
    if (cx < w - 1) seed(i + 1);
  }
  for (let i = 0; i < n; i++) if (!out[i] && !outside[i]) { out[i] = 1; area++; }
  return { mask: out, area };
}

// The outer boundary of a hole-free component as a polygon of pixel corners, clockwise on screen: walk the cracks
// between inside and outside pixels, keeping the inside on the right.
export function traceOutline(mask, w, h) {
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  let start = -1;
  for (let i = 0; i < w * h && start < 0; i++) if (mask[i]) start = i;
  if (start < 0) return [];
  const D = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const sx = start % w, sy = Math.floor(start / w);
  let cx = sx, cy = sy, d = 0;
  const pts = [];
  for (let guard = 0; guard < 4 * (w + 1) * (h + 1); guard++) {
    const [dx, dy] = D[d], [rx, ry] = D[(d + 1) % 4];
    // the pixels just ahead, to the left and to the right of the direction of travel
    const left = at(Math.floor(cx + 0.5 * dx - 0.5 * rx), Math.floor(cy + 0.5 * dy - 0.5 * ry));
    const right = at(Math.floor(cx + 0.5 * dx + 0.5 * rx), Math.floor(cy + 0.5 * dy + 0.5 * ry));
    const nd = left ? (d + 3) % 4 : right ? d : (d + 1) % 4;
    if (pts.length && cx === sx && cy === sy && nd === 0) break;   // round, and setting off the same way again
    if (nd !== d || !pts.length) pts.push([cx, cy]);
    d = nd;
    cx += D[d][0]; cy += D[d][1];
  }
  return pts;
}

// Douglas-Peucker on a closed polygon
export function simplify(pts, eps) { return simplifyIdx(pts, eps).map((i) => pts[i]); }
// the same, as indices into pts
function simplifyIdx(pts, eps) {
  if (pts.length < 4) return pts.map((_, i) => i);
  // split at the point furthest from the first, then simplify each half as an open chain
  let far = 0, fd = -1;
  pts.forEach((p, i) => { const d = Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]); if (d > fd) { fd = d; far = i; } });
  const chain = (a, b) => {
    const idx = [];
    for (let i = a; i !== b; i = (i + 1) % pts.length) idx.push(i);
    idx.push(b);
    const seg = idx.map((i) => pts[i]);
    const keep = new Uint8Array(seg.length); keep[0] = keep[seg.length - 1] = 1;
    const todo = [[0, seg.length - 1]];
    while (todo.length) {
      const [i, j] = todo.pop(), [ax, ay] = seg[i], [bx, by] = seg[j], len = Math.hypot(bx - ax, by - ay) || 1;
      let k = -1, md = eps;
      for (let m = i + 1; m < j; m++) { const dd = Math.abs((bx - ax) * (ay - seg[m][1]) - (ax - seg[m][0]) * (by - ay)) / len; if (dd > md) { md = dd; k = m; } }
      if (k >= 0) { keep[k] = 1; todo.push([i, k], [k, j]); }
    }
    return idx.filter((_, i) => keep[i]);
  };
  return chain(0, far).slice(0, -1).concat(chain(far, 0).slice(0, -1));
}

// A component's outline in pixels: traced, smoothed and simplified until it has at most `max` points. simple (0..1)
// trades detail for clean lines: the pixel staircase along a slanted edge is averaged away (a running mean along
// the boundary, wider for simpler), and the tolerance for dropping points grows, so a slanted edge becomes one
// straight line and, at the simple end, a shape keeps only its main corners.
export function maskPolygon(mask, w, h, { simple = 0.4, max = MAX_OUTLINE } = {}) {
  const raw = traceOutline(mask, w, h);
  if (raw.length < 3) return raw;
  // every pixel step along the boundary
  const dense = [];
  raw.forEach((a, i) => {
    const b = raw[(i + 1) % raw.length], len = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    for (let t = 0; t < len; t++) dense.push([a[0] + (b[0] - a[0]) * t / len, a[1] + (b[1] - a[1]) * t / len]);
  });
  const size = Math.sqrt(Math.abs(polyArea(raw)));
  const r = Math.min(Math.round(simple * Math.min(10, size / 6)), Math.floor((dense.length - 1) / 4));
  let pts = dense;
  if (r > 0) {
    pts = dense.map((_, i) => {
      let sx = 0, sy = 0;
      for (let k = -r; k <= r; k++) { const q = dense[(i + k + dense.length) % dense.length]; sx += q[0]; sy += q[1]; }
      return [sx / (2 * r + 1), sy / (2 * r + 1)];
    });
  }
  // the tolerance stays small next to the shape's size, so curves keep enough points to stay round; straight runs
  // lose their points at any setting once smoothing has taken out the staircase
  let eps = 0.75 + simple ** 2 * 0.03 * size, keep = simplifyIdx(pts, eps);
  while (keep.length > max) { eps *= 1.4; keep = simplifyIdx(pts, eps); }
  if (!r || keep.length < 3) return keep.map((i) => pts[i]);
  // smoothing rounds corners off: refit each straight run to the boundary itself (its middle part), and put the
  // corners where neighbouring runs meet
  const N = dense.length, lines = keep.map((a, j) => {
    const b = keep[(j + 1) % keep.length], len = (b - a + N) % N, run = [];
    for (let t = Math.ceil(len * 0.15); t <= Math.floor(len * 0.85); t++) run.push(dense[(a + t) % N]);
    return run.length >= 6 ? fitLine(run) : null;
  });
  const K = keep.length, prev = (j) => (j - 1 + K) % K, next = (j) => (j + 1) % K;
  const corners = keep.map((i, j) => {
    const L1 = lines[prev(j)], L2 = lines[j], c = L1 && L2 && intersect(L1, L2);
    return c && Math.hypot(c[0] - pts[i][0], c[1] - pts[i][1]) < Math.max(2, 2 * r) ? c : pts[i];
  });
  // a short chord between two straight runs is a corner that smoothing rounded off: the runs' meeting point instead
  for (let j = 0; j < K; j++) {
    if (lines[j] || !lines[prev(j)] || !lines[next(j)] || !corners[j] || !corners[next(j)]) continue;
    const c = intersect(lines[prev(j)], lines[next(j)]);
    if (c && Math.hypot(c[0] - corners[j][0], c[1] - corners[j][1]) < 3 * r && Math.hypot(c[0] - corners[next(j)][0], c[1] - corners[next(j)][1]) < 3 * r) {
      corners[j] = c; corners[next(j)] = null;
    }
  }
  for (let j = K - 1; j >= 0; j--) if (!corners[j]) corners.splice(j, 1);
  // a point where the outline hardly turns is a leftover in the middle of a straight run
  return corners.filter((c, j) => {
    const a = corners[(j - 1 + corners.length) % corners.length], b = corners[(j + 1) % corners.length];
    const u = [c[0] - a[0], c[1] - a[1]], v = [b[0] - c[0], b[1] - c[1]];
    return corners.length <= 3 || Math.abs(Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])) > 0.07 || simple < 0.15;
  });
}

// the smallest-area rectangle around a convex polygon (it has a side on one of the polygon's), top-left first
function minRect(hull) {
  let best = null, bestA = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-9) continue;
    const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len], v = [-u[1], u[0]];
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of hull) { const pu = p[0] * u[0] + p[1] * u[1], pv = p[0] * v[0] + p[1] * v[1]; u0 = Math.min(u0, pu); u1 = Math.max(u1, pu); v0 = Math.min(v0, pv); v1 = Math.max(v1, pv); }
    const area = (u1 - u0) * (v1 - v0);
    if (area < bestA) { bestA = area; best = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([s, t]) => [s * u[0] + t * v[0], s * u[1] + t * v[1]]); }
  }
  return best;
}
// four corners, top-left first and clockwise on screen (y down)
function orderCorners(q) {
  if (polyArea(q) < 0) q = q.slice().reverse();
  let first = 0; q.forEach((p, k) => { if (p[0] + p[1] < q[first][0] + q[first][1]) first = k; });
  return [0, 1, 2, 3].map((k) => q[(first + k) % 4]);
}

// An outline (frame pixels) as a surface's geometry: { pins (normalized, bottom-left first), parts, quad }. An outline
// that is nearly a quad keeps that quad's corners as pins and a square shape, like a tapped rectangle; anything else
// gets the smallest rectangle around it as pins and the outline itself as the shape's points.
// the quad an outline nearly is (top-left first, clockwise on screen), or null when it isn't four-sided
export function quadOf(poly, { fill = 0.95, hull: maxHull = 1.04 } = {}) {
  const hull = convexHull(poly), area = Math.abs(polyArea(poly)), q = maxQuad(hull);
  return q && Math.abs(polyArea(q)) >= fill * area && Math.abs(polyArea(hull)) <= maxHull * area ? orderCorners(q) : null;
}

export function outlineToSurface(poly, W, H, detail = poly) {
  // whether it's four-sided is judged on the detailed outline (`detail`), before smoothing rounds the corners
  const dq = quadOf(detail), quadLike = !!dq, q = dq;
  const hull = convexHull(poly);
  const corners = orderCorners(quadLike ? q : minRect(hull));
  const pinsPx = [corners[3], corners[2], corners[1], corners[0]];
  const pins = pinsPx.map(([x, y]) => [x / W, y / H]);
  if (quadLike) return { pins, parts: [{ op: 1, pts: SHAPES.square() }], quad: true };
  const Hi = inv3(squareToQuad(pinsPx));
  let pts = poly.map(([x, y]) => hApply(Hi, x, y));
  if (polyArea(pts) < 0) pts = pts.reverse();
  return { pins, parts: [{ op: 1, pts }], quad: false };
}

// ---------- the colour fill: the fallback when the model isn't available ----------
// From the tap, the pixels of about the same colour that the photo's edges don't cut off (A: analysePhoto() from
// regions.js, for its edges). Then, stepping out, the same from just outside the result, joined to it: the ring
// around a mirror, the frame around a picture. Returns up to three masks, innermost first, each { mask, area }.
export function colourFill(rgba, w, h, x, y, A, { steps = 3, maxShare = 0.35, sense = 0.5 } = {}) {
  // stricter: smaller colour steps allowed, and fainter edges stop the fill
  const n = w * h, f = 2 ** ((0.5 - sense) * 3), minMag = edgeLevel(A, sense);
  const wall = (i) => A.grid[i] >= 0 && A.em[A.grid[i]] >= minMag;
  const sm = new Float32Array(n * 3);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    for (let c = 0; c < 3; c++) {
      let s = 0, k = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = i + dx, yy = j + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += rgba[(yy * w + xx) * 4 + c]; k++; }
      }
      sm[(j * w + i) * 3 + c] = s / k;
    }
  }
  const grow = (sx, sy, inside) => {
    sx = Math.floor(sx); sy = Math.floor(sy);
    // the seed colour and how much it varies, from a 7 x 7 patch
    const mean = [0, 0, 0]; let cnt = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const xx = sx + dx, yy = sy + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || inside?.[yy * w + xx]) continue;
      for (let c = 0; c < 3; c++) mean[c] += sm[(yy * w + xx) * 3 + c];
      cnt++;
    }
    if (!cnt) return null;
    for (let c = 0; c < 3; c++) mean[c] /= cnt;
    let vr = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const xx = sx + dx, yy = sy + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || inside?.[yy * w + xx]) continue;
      for (let c = 0; c < 3; c++) vr += (sm[(yy * w + xx) * 3 + c] - mean[c]) ** 2;
    }
    // a step from a pixel to its neighbour may change the colour a little (shading, a gradient across glass), the
    // colour may drift further from the seed's, and an edge stops it
    const sd = Math.sqrt(vr / cnt), step = Math.max(5, 2.5 * sd) * f, drift = Math.max(60, 6 * sd) * f;
    const out = new Uint8Array(n), stack = new Int32Array(n);
    let top = 0;
    const near = (i, j, t) => Math.hypot(sm[i * 3] - sm[j * 3], sm[i * 3 + 1] - sm[j * 3 + 1], sm[i * 3 + 2] - sm[j * 3 + 2]) < t;
    const ok = (from, i) => {
      if (out[i] || inside?.[i] || wall(i) || !near(from, i, step)) return false;
      return Math.hypot(sm[i * 3] - mean[0], sm[i * 3 + 1] - mean[1], sm[i * 3 + 2] - mean[2]) < drift;
    };
    const s0 = sy * w + sx;
    out[s0] = 1; stack[top++] = s0;
    let area = 0;
    while (top) {
      const i = stack[--top], cx = i % w; area++;
      for (const j of [i - w, i + w, cx > 0 ? i - 1 : -1, cx < w - 1 ? i + 1 : -1]) if (j >= 0 && j < n && ok(i, j)) { out[j] = 1; stack[top++] = j; }
    }
    // edge pixels on the region's border belong to it: grow one step into them
    const grown = out.slice();
    for (let i = 0; i < n; i++) if (out[i]) { const cx = i % w; for (const j of [i - w, i + w, cx > 0 ? i - 1 : -1, cx < w - 1 ? i + 1 : -1]) if (j >= 0 && j < n && wall(j) && !inside?.[j]) grown[j] = 1; }
    return grown;
  };
  const masks = [];
  let cur = grow(x, y, null);
  for (let s = 0; s < steps && cur; s++) {
    const comp = componentAt(cur, w, h, x, y);
    if (!comp || comp.area > n * maxShare || comp.area < 30) break;
    if (!masks.length || comp.area > masks[masks.length - 1].area * 1.05) masks.push(comp);   // a step that didn't grow isn't a new one
    // step out: the colour around the outside of this one, from the most common neighbouring colour
    const ring = [];
    for (let i = 0; i < n; i++) if (comp.mask[i]) {
      const cx = i % w;
      for (const [j, ox, oy] of [[i - 2 * w, 0, -2], [i + 2 * w, 0, 2], [cx > 1 ? i - 2 : -1, -2, 0], [cx < w - 2 ? i + 2 : -1, 2, 0]]) if (j >= 0 && j < n && !comp.mask[j]) ring.push(j);
    }
    if (!ring.length) break;
    // seed from the ring pixel whose colour is most typical of the ring
    const med = [0, 1, 2].map((c) => { const v = ring.map((j) => sm[j * 3 + c]).sort((a, b) => a - b); return v[v.length >> 1]; });
    let seed = ring[0], sd = Infinity;
    for (const j of ring) { const d = Math.hypot(sm[j * 3] - med[0], sm[j * 3 + 1] - med[1], sm[j * 3 + 2] - med[2]); if (d < sd) { sd = d; seed = j; } }
    const next = grow(seed % w, Math.floor(seed / w), comp.mask);
    if (!next) break;
    for (let i = 0; i < n; i++) if (comp.mask[i]) next[i] = 1;
    cur = next;
  }
  return masks;
}

// overlap of a mask component ({ mask, area }) and a quad, as IoU
function maskQuadIoU(comp, w, h, q) {
  const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(w - 1, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(h - 1, Math.ceil(Math.max(...ys)));
  let inter = 0, qa = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!pointInPoly(x + 0.5, y + 0.5, q)) continue;
    qa++; if (comp.mask[y * w + x]) inter++;
  }
  return inter / (comp.area + qa - inter || 1);
}

// A mask (from either source) as surface geometry: the part holding the tap (photo pixel x, y), outlined, mapped into
// the frame by toFrame([x, y]) -> frame pixels, then given pins. Null when the tap isn't in the mask. quads (photo
// pixels), when given, are rectangles found from the photo's edges around the same tap: a mask that closely matches
// one (IoU 0.8 or more) takes that rectangle, whose sides follow real edges, instead of its own wobbly outline.
// rect: always four corners (a mask that is neither gets the smallest rectangle around it).
// what doesn't depend on Simplify, kept per mask, so moving that slider only re-outlines
const prepared = new WeakMap();
export function maskToSurface(mask, w, h, x, y, toFrame, W, H, { simple = 0.4, quads = null, rect = false } = {}) {
  let pre = prepared.get(mask);
  if (!pre || pre.x !== x || pre.y !== y || pre.quads !== quads) {
    const comp = componentAt(mask, w, h, x, y);
    let match = null, bestI = 0.8;
    for (const qd of (comp && quads) || []) {
      const v = maskQuadIoU(comp, w, h, qd);
      if (v > bestI) { bestI = v; match = qd; }
    }
    pre = { x, y, quads, comp, match, detail: comp && maskPolygon(comp.mask, w, h, { simple: 0 }) };
    prepared.set(mask, pre);
  }
  const { comp, match, detail } = pre;
  if (!comp) return null;
  const q = match || quadOf(detail) || (rect && orderCorners(minRect(convexHull(detail))));
  if (q) {
    const c = q.map(toFrame);
    return { pins: [c[3], c[2], c[1], c[0]].map(([fx, fy]) => [fx / W, fy / H]), parts: [{ op: 1, pts: SHAPES.square() }], quad: true };
  }
  const poly = maskPolygon(comp.mask, w, h, { simple }).map(toFrame);
  return poly.length >= 3 ? outlineToSurface(poly, W, H, detail.map(toFrame)) : null;
}
