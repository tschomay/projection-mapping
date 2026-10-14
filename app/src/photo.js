// Lining up a photo of the set with the projector frame (issue #34). A photo taken from right beside the projector's
// lens sees every point where that projector pixel's light lands, whatever its depth, so the photo is the frame up
// to one homography: the one that takes the frame's four corners, as they appear in the photo, to the frame's
// corners. That quad is stored with the design photo (backdrop.quad, normalized photo coordinates, top-left first
// and clockwise on screen). No DOM here.
import { fitHomography } from './capture.js';
import { hApply } from './geometry.js';

const UNIT = [[0, 0], [1, 0], [1, 1], [0, 1]];

// normalized photo -> normalized frame, and back
export const photoToFrame = (quad) => fitHomography(quad, UNIT);
export const frameToPhoto = (quad) => fitHomography(UNIT, quad);

// The quad that reproduces a photo simply covering the frame (centred, cropped to the frame's shape): what a photo
// without a quad shows.
export function coverQuad(photoAspect, frameAspect) {
  if (photoAspect > frameAspect) { const f = frameAspect / photoAspect, x0 = (1 - f) / 2; return [[x0, 0], [x0 + f, 0], [x0 + f, 1], [x0, 1]]; }
  const f = photoAspect / frameAspect, y0 = (1 - f) / 2;
  return [[0, y0], [1, y0], [1, y0 + f], [0, y0 + f]];
}

// A 3x3 homography between two boxes' pixels (normalized coordinates scaled by each box's size), as a CSS matrix3d.
export function cssMatrix(Hn, [sw, sh], [dw, dh]) {
  const [a, b, c, d, e, f, g, h, i] = Hn;
  // H = D * Hn * S^-1, with S = diag(sw, sh, 1) and D = diag(dw, dh, 1)
  const m = [a * dw / sw, b * dw / sh, c * dw, d * dh / sw, e * dh / sh, f * dh, g / sw, h / sh, i];
  return `matrix3d(${[m[0], m[3], 0, m[6], m[1], m[4], 0, m[7], 0, 0, 1, 0, m[2], m[5], 0, m[8]].map((v) => +v.toPrecision(10)).join(',')})`;
}

const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
// convex hull, monotone chain; clockwise on screen (y down), so positive shoelace area
export function convexHull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
const triArea = (a, b, c) => Math.abs(cross(a, b, c)) / 2;
export const quadArea = (q) => { let s = 0; for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };

// the largest quad with its corners on a convex polygon's vertices
function maxQuad(h) {
  const n = h.length;
  if (n < 4) return null;
  let best = null, bestA = -1;
  for (let i = 0; i < n; i++) for (let k = i + 2; k < n; k++) {
    let a1 = -1, j1 = -1, a2 = -1, l1 = -1;
    for (let j = i + 1; j < k; j++) { const a = triArea(h[i], h[j], h[k]); if (a > a1) { a1 = a; j1 = j; } }
    for (let l = k + 1; l < n + i; l++) { const a = triArea(h[k], h[l % n], h[i]); if (a > a2) { a2 = a; l1 = l % n; } }
    if (j1 >= 0 && l1 >= 0 && a1 + a2 > bestA) { bestA = a1 + a2; best = [h[i], h[j1], h[k], h[l1]]; }
  }
  return best;
}

// a line through points by total least squares: { n: unit normal, c } with n . p = c
export function fitLine(pts) {
  let mx = 0, my = 0; for (const [x, y] of pts) { mx += x; my += y; } mx /= pts.length; my /= pts.length;
  let sxx = 0, sxy = 0, syy = 0;
  for (const [x, y] of pts) { const dx = x - mx, dy = y - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);           // direction of most spread
  const n = [-Math.sin(th), Math.cos(th)];
  return { n, c: n[0] * mx + n[1] * my };
}
export function intersect(l1, l2) {
  const det = l1.n[0] * l2.n[1] - l1.n[1] * l2.n[0];
  if (Math.abs(det) < 1e-9) return null;
  return [(l1.c * l2.n[1] - l1.n[1] * l2.c) / det, (l1.n[0] * l2.c - l1.c * l2.n[0]) / det];
}

// Where the projector frame is in a photo: the area that's lit when the projector shows white and not when it shows
// black. black and white are luminance images (w x h, row 0 at the top). Returns { quad (normalized, top-left first,
// clockwise), share (of the photo that's lit) }, or null when no frame-like area is seen.
export function frameQuad(black, white, w, h, { minContrast = 12 } = {}) {
  const n = w * h, d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = white[i] - black[i];
  // the threshold: a share of how bright the projector makes a typical lit pixel
  const pos = []; for (let i = 0; i < n; i += 7) if (d[i] > minContrast) pos.push(d[i]);
  if (pos.length < n / 7 * 0.03) return null;
  pos.sort((a, b) => a - b);
  const thr = Math.max(minContrast, 0.35 * pos[Math.floor(pos.length * 0.9)]);
  const mask = new Uint8Array(n); let lit = 0;
  for (let i = 0; i < n; i++) if (d[i] > thr) { mask[i] = 1; lit++; }

  // drop specks: keep connected areas of at least 1% of what's lit
  const label = new Int32Array(n), keep = new Uint8Array(n), stack = new Int32Array(n);
  for (let s = 0, id = 0; s < n; s++) {
    if (!mask[s] || label[s]) continue;
    id++; let top = 0, size = 0; stack[top++] = s; label[s] = id;
    const members = [];
    while (top) {
      const i = stack[--top]; size++; members.push(i);
      const x = i % w;
      for (const j of [i - w, i + w, x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1]) if (j >= 0 && j < n && mask[j] && !label[j]) { label[j] = id; stack[top++] = j; }
    }
    if (size >= lit * 0.01) for (const i of members) keep[i] = 1;
  }

  // the outline: the first and last lit pixel of each row and column, placed where the brightness crosses halfway
  // between outside and inside (sub-pixel)
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  const cross1 = (get, i0, step) => {   // along a scan line: from the first kept pixel i0, going outward by -step
    const inside = get(i0 + 3 * step), outside = get(i0 - 3 * step), mid = (inside + outside) / 2;
    for (let k = -3; k < 3; k++) {
      const a = get(i0 + k * step), b = get(i0 + (k + 1) * step);
      if ((a - mid) * (b - mid) <= 0 && a !== b) return i0 + (k + (mid - a) / (b - a)) * step;
    }
    return i0 - 0.5 * step;
  };
  const rowPts = [], colPts = [];
  for (let y = 0; y < h; y++) {
    let x0 = -1, x1 = -1;
    for (let x = 0; x < w; x++) if (keep[y * w + x]) { if (x0 < 0) x0 = x; x1 = x; }
    if (x0 < 0) continue;
    const get = (x) => at(x, y);
    rowPts.push([cross1(get, x0, 1) + 0.5, y + 0.5], [cross1(get, x1, -1) + 0.5, y + 0.5]);
  }
  for (let x = 0; x < w; x++) {
    let y0 = -1, y1 = -1;
    for (let y = 0; y < h; y++) if (keep[y * w + x]) { if (y0 < 0) y0 = y; y1 = y; }
    if (y0 < 0) continue;
    const get = (y) => at(x, y);
    colPts.push([x + 0.5, cross1(get, y0, 1) + 0.5], [x + 0.5, cross1(get, y1, -1) + 0.5]);
  }
  const hull = convexHull(rowPts.concat(colPts));
  // a staircase hull has many nearly collinear vertices; thin them so the search stays quick
  let poly = hull;
  while (poly.length > 120) poly = poly.filter((_, i) => i % 2 === 0);
  let q = maxQuad(poly);
  if (!q || quadArea(q) < w * h * 0.03) return null;

  // refine each side: a line through the outline points near it, then the corners where neighbouring sides meet
  const sides = [];
  for (let k = 0; k < 4; k++) {
    const a = q[k], b = q[(k + 1) % 4], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dir = [(b[0] - a[0]) / len, (b[1] - a[1]) / len], nrm = [-dir[1], dir[0]];
    // a steep side is crossed cleanly by rows; a flat one by columns
    const src = Math.abs(dir[1]) > Math.abs(dir[0]) ? rowPts : colPts;
    const near = src.filter(([x, y]) => {
      const t = (x - a[0]) * dir[0] + (y - a[1]) * dir[1], off = (x - a[0]) * nrm[0] + (y - a[1]) * nrm[1];
      return t > len * 0.1 && t < len * 0.9 && Math.abs(off) < 3;
    });
    sides.push(near.length >= 8 ? fitLine(near) : fitLine([a, b]));
  }
  const refined = [3, 0, 1, 2].map((k) => intersect(sides[k], sides[(k + 1) % 4]));
  if (refined.every(Boolean) && refined.every((p, k) => Math.hypot(p[0] - q[k][0], p[1] - q[k][1]) < Math.max(w, h) * 0.05)) q = refined;

  // top-left first: the corner nearest the photo's top-left, keeping the clockwise order
  let first = 0; q.forEach((p, k) => { if (p[0] + p[1] < q[first][0] + q[first][1]) first = k; });
  q = [0, 1, 2, 3].map((k) => q[(first + k) % 4]);
  return { quad: q.map(([x, y]) => [x / w, y / h]), share: lit / n };
}

// normalized frame point -> normalized photo point, and back, for a quad
export const framePointToPhoto = (quad, x, y) => hApply(frameToPhoto(quad), x, y);
export const photoPointToFrame = (quad, x, y) => hApply(photoToFrame(quad), x, y);
