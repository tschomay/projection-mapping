// Finding rectangles in a photo of the set from a tap (issue #35): picture frames, wainscoting panels, doors,
// windows. Things on a wall that the stripe capture can't tell from the wall, because they're flat, but that show in
// a photo as straight edges. Classical and quick: edges, straight lines by a Hough transform, then the quads around
// the tap whose four sides are backed by edges. No DOM here.
import { fitLine, intersect, quadArea } from './photo.js';

const TH = 360;   // Hough angle bins over the full circle: a line's normal points from dark to light, so the two
                  // edges of a thin molding are different lines

// Edges and straight lines of an RGBA image (w x h). Keep the result: quadsAt() asks it about any number of taps.
export function analysePhoto(rgba, w, h) {
  const n = w * h;
  // a light blur per channel, then Sobel; each pixel keeps the gradient of its strongest channel, so a boundary
  // between two colours of the same brightness still counts
  const ch = [0, 1, 2].map((c) => {
    const a = new Float32Array(n), b = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = rgba[i * 4 + c];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, l = x > 0 ? i - 1 : i, r = x < w - 1 ? i + 1 : i;
      b[i] = (a[l] + 2 * a[i] + a[r]) / 4;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, u = y > 0 ? i - w : i, dn = y < h - 1 ? i + w : i;
      a[i] = (b[u] + 2 * b[i] + b[dn]) / 4;
    }
    return a;
  });
  const gx = new Float32Array(n), gy = new Float32Array(n), mag = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    let best = -1;
    for (const a of ch) {
      const sx = (a[i - w + 1] + 2 * a[i + 1] + a[i + w + 1] - a[i - w - 1] - 2 * a[i - 1] - a[i + w - 1]) / 8;
      const sy = (a[i + w - 1] + 2 * a[i + w] + a[i + w + 1] - a[i - w - 1] - 2 * a[i - w] - a[i - w + 1]) / 8;
      const m = sx * sx + sy * sy;
      if (m > best) { best = m; gx[i] = sx; gy[i] = sy; }
    }
    mag[i] = Math.sqrt(best);
  }
  // threshold: well above the typical (mostly flat, noisy) gradient
  const sample = []; for (let i = 0; i < n; i += 13) sample.push(mag[i]);
  sample.sort((a, b) => a - b);
  const thr = Math.max(2.5, 4 * sample[Math.floor(sample.length / 2)]);

  // thin to ridges along the gradient, placing each edge point to a fraction of a pixel
  const ex = [], ey = [], ea = [], grid = new Int32Array(n).fill(-1);
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    const i = y * w + x, m = mag[i];
    if (m < thr) continue;
    const ux = gx[i] / m, uy = gy[i] / m;
    const step = Math.abs(ux) > Math.abs(uy) * 2.414 ? [1, 0] : Math.abs(uy) > Math.abs(ux) * 2.414 ? [0, 1] : [Math.sign(ux), Math.sign(uy)];
    const j = (y + step[1]) * w + x + step[0], k = (y - step[1]) * w + x - step[0];
    if (!(m >= mag[j] && m > mag[k])) continue;
    const den = mag[k] - 2 * m + mag[j], off = den < 0 ? Math.max(-0.5, Math.min(0.5, (mag[k] - mag[j]) / (2 * den))) : 0;
    grid[i] = ex.length;
    ex.push(x + 0.5 + off * step[0]); ey.push(y + 0.5 + off * step[1]); ea.push(Math.atan2(uy, ux));
  }

  // Hough: each edge point votes for lines within 5 degrees of its own direction (the direction of a weak edge is
  // noisy)
  const diag = Math.ceil(Math.hypot(w, h)) + 1, R = 2 * diag + 1, acc = new Float32Array(TH * R);
  const cs = Float64Array.from({ length: TH }, (_, t) => Math.cos(t * 2 * Math.PI / TH)), sn = Float64Array.from({ length: TH }, (_, t) => Math.sin(t * 2 * Math.PI / TH));
  for (let e = 0; e < ex.length; e++) {
    const t0 = Math.round(((ea[e] + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * TH);
    for (let dt = -5; dt <= 5; dt++) {
      // shared between the two nearest distance bins, so a line on a bin boundary still makes one clear peak
      const t = (t0 + dt + TH) % TH, rf = ex[e] * cs[t] + ey[e] * sn[t] + diag, r = Math.floor(rf), f = rf - r;
      acc[t * R + r] += 1 - f; acc[t * R + r + 1] += f;
    }
  }
  const lines = [];
  for (let t = 0; t < TH; t++) for (let r = 1; r < R - 1; r++) {
    const v = acc[t * R + r];
    if (v < 12) continue;
    let peak = true;
    for (let dt = -2; dt <= 2 && peak; dt++) for (let dr = -2; dr <= 2; dr++) {
      if (!dt && !dr) continue;
      const tt = (t + dt + TH) % TH, rr = r + dr;
      if (rr < 0 || rr >= R) continue;
      const u = acc[tt * R + rr];
      if (u > v || (u === v && (dt < 0 || (dt === 0 && dr < 0)))) { peak = false; break; }
    }
    if (peak) lines.push({ n: [cs[t], sn[t]], c: r - diag, votes: v, angle: t * 2 * Math.PI / TH });
  }
  return { w, h, ex, ey, ea, grid, lines };
}

const angDiff = (a, b) => { let d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };

// edge points within `band` pixels of a line (n . p = c), facing its way, along the stretch from t0 to t1
// (t: position along the line's direction [-n1, n0])
function along(A, L, t0, t1, band, maxAng, cb) {
  const dir = [-L.n[1], L.n[0]], base = [L.n[0] * L.c, L.n[1] * L.c];
  const ang = Math.atan2(L.n[1], L.n[0]);
  let hits = 0, steps = 0;
  for (let t = t0; t <= t1; t += 1) {
    const px = base[0] + dir[0] * t, py = base[1] + dir[1] * t;
    steps++;
    let found = false;
    for (let o = -Math.ceil(band); o <= Math.ceil(band); o++) {
      const x = Math.floor(px + L.n[0] * o), y = Math.floor(py + L.n[1] * o);
      if (x < 0 || y < 0 || x >= A.w || y >= A.h) continue;
      const e = A.grid[y * A.w + x];
      if (e < 0 || angDiff(A.ea[e], ang) > maxAng) continue;
      const off = (A.ex[e] - px) * L.n[0] + (A.ey[e] - py) * L.n[1];
      if (Math.abs(off) > band) continue;
      found = true;
      if (cb) cb(e);
    }
    if (found) hits++;
  }
  return steps ? hits / steps : 0;
}
const tOf = (L, p) => -L.n[1] * p[0] + L.n[0] * p[1];

// a Hough line refitted to the edge points along it (the Hough grid is a degree and a pixel coarse)
function refine(A, L) {
  if (L.fine) return L.fine;
  let cur = L;
  for (const band of [2, 1.25]) {
    const pts = [];
    along(A, cur, -A.w - A.h, A.w + A.h, band, 0.2, (e) => pts.push([A.ex[e], A.ey[e]]));
    if (pts.length < 8) break;
    // fit, then again without the points furthest off (texture next to the edge)
    let f = fitLine(pts);
    const res = pts.map(([x, y]) => Math.abs(f.n[0] * x + f.n[1] * y - f.c)), cut = Math.max(0.5, 2.5 * res.slice().sort((a, b) => a - b)[res.length >> 1]);
    const inl = pts.filter((_, i) => res[i] <= cut);
    if (inl.length >= 8) f = fitLine(inl);
    if (f.n[0] * cur.n[0] + f.n[1] * cur.n[1] < 0) { f.n = [-f.n[0], -f.n[1]]; f.c = -f.c; }   // keep its facing
    cur = { ...cur, n: f.n, c: f.c };
  }
  return (L.fine = cur);
}

// where a line passes the point p, and on which side: horizontal-ish lines are above or below it, the rest left
// or right
function placement(L, [x, y]) {
  if (Math.abs(L.n[1]) >= Math.abs(L.n[0])) { const ly = (L.c - L.n[0] * x) / L.n[1]; return { side: ly < y ? 'top' : 'bottom', dist: Math.abs(ly - y) }; }
  const lx = (L.c - L.n[1] * y) / L.n[0];
  return { side: lx < x ? 'left' : 'right', dist: Math.abs(lx - x) };
}

// is quad a inside quad b, at least `margin` pixels in from each of b's sides?
function within(a, b, margin) {
  for (let i = 0; i < 4; i++) {
    const o = b[i], c = b[(i + 1) % 4], len = Math.hypot(c[0] - o[0], c[1] - o[1]);
    for (const p of a) if (((c[0] - o[0]) * (p[1] - o[1]) - (c[1] - o[1]) * (p[0] - o[0])) / len < margin) return false;
  }
  return true;
}

// Rectangles around the point (x, y), innermost first, each enclosing the one before (artwork, then its mat, then
// the frame): each { quad: four corners in pixels, top-left first and clockwise on screen, support: the share of
// its outline backed by edges }.
export function quadsAt(A, x, y, { k = 10, minSupport = 0.75 } = {}) {
  const p = [x, y], groups = { top: [], bottom: [], left: [], right: [] };
  for (const L of A.lines) {
    const { side, dist } = placement(L, p);
    if (dist < 2) continue;
    // a side of a rectangle around the tap has edges next to the tap, not only further along
    const ft = tOf(L, p), reach = Math.max(6, dist * 0.25);
    if (along(A, L, ft - reach, ft + reach, 2, 0.25) < 0.5) continue;
    const F = refine(A, L), pl = placement(F, p);
    if (pl.side !== side || pl.dist < 2) continue;
    groups[side].push({ L: F, dist: pl.dist, votes: L.votes });
  }
  // the Hough grid finds one edge several times over: keep one of each, then the nearest few
  for (const [side, g] of Object.entries(groups)) {
    g.sort((a, b) => b.votes - a.votes);
    const kept = [];
    for (const c of g) if (!kept.some((o) => Math.abs(o.dist - c.dist) < 1 && o.L.n[0] * c.L.n[0] + o.L.n[1] * c.L.n[1] > 0.9995)) kept.push(c);
    groups[side] = kept.sort((a, b) => a.dist - b.dist).slice(0, k);
  }
  if (Object.values(groups).some((g) => !g.length)) return [];

  const found = [];
  for (const t of groups.top) for (const b of groups.bottom) for (const l of groups.left) for (const r of groups.right) {
    const T = t.L, B = b.L, Lf = l.L, Rt = r.L;
    const q = [intersect(Lf, T), intersect(Rt, T), intersect(Rt, B), intersect(Lf, B)];
    if (q.some((c) => !c)) continue;
    const area = quadArea(q);
    if (area <= 0) continue;
    // convex, sensible angles, sides long enough, and the tap inside
    let ok = true;
    for (let i = 0; i < 4 && ok; i++) {
      const a = q[(i + 3) % 4], o = q[i], c = q[(i + 1) % 4];
      const v1 = [a[0] - o[0], a[1] - o[1]], v2 = [c[0] - o[0], c[1] - o[1]], l1 = Math.hypot(...v1), l2 = Math.hypot(...v2);
      const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2);
      if (l2 < 8 || Math.abs(cos) > 0.82) ok = false;
      if ((c[0] - o[0]) * (p[1] - o[1]) - (c[1] - o[1]) * (p[0] - o[0]) < 0) ok = false;
    }
    if (!ok) continue;
    // each side backed by edges along most of its length (the corners themselves are often rounded or blurred)
    let min = 1, sum = 0;
    for (const [L, a, c] of [[T, q[0], q[1]], [Rt, q[1], q[2]], [B, q[2], q[3]], [Lf, q[3], q[0]]]) {
      const ta = tOf(L, a), tc = tOf(L, c), lo = Math.min(ta, tc), hi = Math.max(ta, tc), m = (hi - lo) * 0.06 + 1;
      const s = along(A, L, lo + m, hi - m, 1.2, 0.2);
      min = Math.min(min, s); sum += s;
      if (min < minSupport) break;
    }
    if (min < minSupport) continue;
    found.push({ quad: q, support: sum / 4, area });
  }
  // innermost first, then each next one out that encloses it on every side. Of near-identical candidates (the
  // same rectangle from neighbouring lines), the best backed.
  found.sort((a, b) => a.area - b.area);
  const out = [];
  let cur = null;
  for (;;) {
    const i = found.findIndex((f) => !cur || within(cur.quad, f.quad, 1.5));
    if (i < 0) break;
    const tol = Math.max(2.5, 0.03 * Math.sqrt(found[i].area));
    let best = found[i];
    for (const f of found.slice(i + 1)) if (f.quad.every((c, j) => Math.hypot(c[0] - found[i].quad[j][0], c[1] - found[i].quad[j][1]) < tol) && f.support > best.support) best = f;
    out.push(best); cur = best;
  }
  return out.map(({ quad, support }) => ({ quad, support }));
}
