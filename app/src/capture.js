// Finding flat surfaces with a camera (structured light), ported from the sandbox (sim/index.html).
// The projector shows black, white, then Gray-code stripes and their inverses; a camera beside it photographs each.
// Decoding gives, for every camera pixel, the projector cell that lit it. Points on one plane are related by a
// single homography between projector and camera images, so sequential RANSAC over that mapping finds the planes,
// and each plane becomes an editable 2D surface. No DOM here: the camera and the screen are driven by app.js.
import { SHAPES, squareToQuad, inv3, hApply } from './geometry.js';
import { MAX_SURF, MAX_PART_VERTS } from './renderer.js';

export const CELL = 4;   // projector pixels per decoded cell

// The frames to show, in order: black, white, then each bit of x and of y with its inverse (most significant first).
export function patternFrames(W, H) {
  const GW = Math.ceil(W / CELL), GH = Math.ceil(H / CELL);
  const XBITS = Math.ceil(Math.log2(GW)), YBITS = Math.ceil(Math.log2(GH));
  const frames = [{ mode: 0 }, { mode: 1 }];
  for (let b = XBITS - 1; b >= 0; b--) frames.push({ mode: 2, axis: 0, bit: b }, { mode: 2, axis: 0, bit: b, inv: 1 });
  for (let b = YBITS - 1; b >= 0; b--) frames.push({ mode: 2, axis: 1, bit: b }, { mode: 2, axis: 1, bit: b, inv: 1 });
  return frames;
}

// Draw one frame into a 2D context covering W x H frame pixels.
export function drawPattern(ctx, f, W, H) {
  ctx.fillStyle = f.mode === 1 ? '#fff' : '#000';
  ctx.fillRect(0, 0, W, H);
  if (f.mode !== 2) return;
  ctx.fillStyle = '#fff';
  const n = Math.ceil((f.axis === 0 ? W : H) / CELL);
  for (let idx = 0; idx < n; idx++) {
    let v = ((idx ^ (idx >> 1)) >> f.bit) & 1;
    if (f.inv) v = 1 - v;
    if (!v) continue;
    if (f.axis === 0) ctx.fillRect(idx * CELL, 0, CELL, H); else ctx.fillRect(0, idx * CELL, W, CELL);
  }
}

// ---------- small linear algebra ----------
function solveLinear(A, b) {                        // Gaussian elimination with partial pivoting
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let v = M[r][n]; for (let k = r + 1; k < n; k++) v -= M[r][k] * x[k]; x[r] = v / M[r][r]; }
  return x;
}
const mul3 = (a, b) => [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]));
function normT(pts) {                               // Hartley normalization
  let mx = 0, my = 0; for (const [x, y] of pts) { mx += x; my += y; } mx /= pts.length; my /= pts.length;
  let d = 0; for (const [x, y] of pts) d += Math.hypot(x - mx, y - my); d = d / pts.length || 1;
  const k = Math.SQRT2 / d; return [k, 0, -k * mx, 0, k, -k * my, 0, 0, 1];
}
export function fitHomography(src, dst) {           // least-squares DLT with h33 = 1; exact for 4 points
  const Ts = normT(src), Td = normT(dst);
  const AtA = Array.from({ length: 8 }, () => new Array(8).fill(0)), Atb = new Array(8).fill(0);
  for (let i = 0; i < src.length; i++) {
    const [x, y] = hApply(Ts, ...src[i]), [X, Y] = hApply(Td, ...dst[i]);
    for (const [row, rhs] of [[[x, y, 1, 0, 0, 0, -x * X, -y * X], X], [[0, 0, 0, x, y, 1, -x * Y, -y * Y], Y]]) {
      for (let a = 0; a < 8; a++) { Atb[a] += row[a] * rhs; for (let b = 0; b < 8; b++) AtA[a][b] += row[a] * row[b]; }
    }
  }
  const h = solveLinear(AtA, Atb);
  return h ? mul3(inv3(Td), mul3([...h, 1], Ts)) : null;
}

// ---------- checks on the black and white photos ----------
// How much of the camera image the projector visibly lights: the share of pixels where white - black > minContrast.
export function litShare(black, white, minContrast = 20) {
  let n = 0; for (let i = 0; i < white.length; i++) if (white[i] - black[i] > minContrast) n++;
  return n / white.length;
}
// Mean absolute difference between two photos (did the camera move?).
export function meanDiff(a, b) {
  let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

// ---------- decode and segment ----------
// shots: luminance images (Float32Array, camW x camH, row 0 at the top) in patternFrames order.
export function decodeAndSegment(shots, { camW, camH, W, H, minContrast = 20, seed = 1 }) {
  const GW = Math.ceil(W / CELL), GH = Math.ceil(H / CELL);
  const XBITS = Math.ceil(Math.log2(GW)), YBITS = Math.ceil(Math.log2(GH));
  let rngSeed = seed >>> 0;
  const rand = () => { rngSeed = (rngSeed * 1664525 + 1013904223) >>> 0; return rngSeed / 4294967296; };
  const N = camW * camH, black = shots[0], white = shots[1];
  const sumX = new Float32Array(GW * GH), sumY = new Float32Array(GW * GH), cnt = new Uint16Array(GW * GH);
  let decoded = 0;
  for (let i = 0; i < N; i++) {
    const span = white[i] - black[i];
    if (span < minContrast) continue;                  // not lit by the projector, or not seen
    const bitThr = Math.max(4, span * 0.12);           // a bit is trusted only when pattern and inverse clearly differ
    let gx = 0, gy = 0, ok = true;
    for (let b = 0; b < XBITS && ok; b++) { const d = shots[2 + 2 * b][i] - shots[3 + 2 * b][i]; if (Math.abs(d) < bitThr) ok = false; gx = (gx << 1) | (d > 0 ? 1 : 0); }
    for (let b = 0; b < YBITS && ok; b++) { const d = shots[2 + 2 * XBITS + 2 * b][i] - shots[3 + 2 * XBITS + 2 * b][i]; if (Math.abs(d) < bitThr) ok = false; gy = (gy << 1) | (d > 0 ? 1 : 0); }
    if (!ok) continue;
    for (let s = 1; s < 16; s <<= 1) { gx ^= gx >> s; gy ^= gy >> s; }   // Gray -> binary
    if (gx >= GW || gy >= GH) continue;
    const c = gy * GW + gx;
    sumX[c] += i % camW; sumY[c] += (i / camW) | 0; cnt[c]++; decoded++;
  }
  const valid = new Uint8Array(GW * GH), cam = new Float32Array(GW * GH * 2);
  for (let c = 0; c < GW * GH; c++) if (cnt[c]) { valid[c] = 1; cam[c * 2] = sumX[c] / cnt[c]; cam[c * 2 + 1] = sumY[c] / cnt[c]; }
  const proj = (c) => [(c % GW) * CELL + CELL / 2, ((c / GW) | 0) * CELL + CELL / 2];
  const err = (Hm, c) => { const q = hApply(Hm, ...proj(c)); return Math.hypot(q[0] - cam[c * 2], q[1] - cam[c * 2 + 1]); };
  const THR = 1.5 * Math.max(1, camW / 480);         // inlier distance in camera pixels; a little looser for lens distortion
  const free = valid.slice();                         // decoded and not yet claimed by a plane
  const label = new Int16Array(GW * GH).fill(-1);
  const regions = [];
  let nValid = 0; for (let c = 0; c < GW * GH; c++) nValid += valid[c];

  const component = (start, ok) => {                  // 4-connected cells containing start where ok(c)
    const out = [start], seen = new Uint8Array(GW * GH); seen[start] = 1;
    for (let q = 0; q < out.length; q++) {
      const c = out[q], x = c % GW, y = (c / GW) | 0;
      for (const n of [x > 0 ? c - 1 : -1, x < GW - 1 ? c + 1 : -1, y > 0 ? c - GW : -1, y < GH - 1 ? c + GW : -1]) {
        if (n >= 0 && !seen[n] && ok(n)) { seen[n] = 1; out.push(n); }
      }
    }
    return out;
  };
  const fitCells = (cells) => {
    const step = Math.max(1, Math.floor(cells.length / 1500));
    const src = [], dst = [];
    for (let k = 0; k < cells.length; k += step) { src.push(proj(cells[k])); dst.push([cam[cells[k] * 2], cam[cells[k] * 2 + 1]]); }
    return fitHomography(src, dst);
  };

  for (let iter = 0; iter < 40; iter++) {
    const rem = []; for (let c = 0; c < GW * GH; c++) if (free[c]) rem.push(c);
    if (rem.length < 120) break;
    let best = null;
    for (let h = 0; h < 250; h++) {
      const s0 = rem[(rand() * rem.length) | 0], sx = s0 % GW, sy = (s0 / GW) | 0;
      const pick = [s0];
      for (let t = 0; t < 40 && pick.length < 4; t++) {
        const x = sx + Math.round((rand() * 2 - 1) * 10), y = sy + Math.round((rand() * 2 - 1) * 10);
        if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
        const c = y * GW + x;
        if (free[c] && !pick.includes(c)) pick.push(c);
      }
      if (pick.length < 4) continue;
      const P = pick.map(proj);
      const area = Math.abs((P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]));
      if (area < 100) continue;
      const Hm = fitHomography(P, pick.map((c) => [cam[c * 2], cam[c * 2 + 1]]));
      if (!Hm) continue;
      let score = 0;
      for (let y = Math.max(0, sy - 15); y <= Math.min(GH - 1, sy + 15); y++) for (let x = Math.max(0, sx - 15); x <= Math.min(GW - 1, sx + 15); x++) {
        const c = y * GW + x; if (free[c] && err(Hm, c) < THR) score++;
      }
      if (!best || score > best.score) best = { score, H: Hm, seed: s0 };
    }
    if (!best || best.score < 40) break;
    let Hm = best.H, cells = [best.seed];
    for (let k = 0; k < 3; k++) {                       // grow: inliers connected to the seed, refit, repeat
      if (err(Hm, best.seed) >= THR * 2) break;
      cells = component(best.seed, (c) => free[c] && err(Hm, c) < THR);
      const H2 = cells.length >= 8 ? fitCells(cells) : null;
      if (H2) Hm = H2;
    }
    for (const c of cells) free[c] = 0;
    if (cells.length < 120) continue;                   // a sliver or noise; drop it
    regions.push({ H: Hm, cells });
    for (const c of cells) label[c] = regions.length - 1;
  }

  // creases between neighbouring planes: hand each cell to whichever nearby plane predicts it best
  for (let pass = 0; pass < 2; pass++) {
    for (let c = 0; c < GW * GH; c++) {
      if (label[c] < 0) continue;
      const x = c % GW, y = (c / GW) | 0;
      let bestL = label[c], bestE = err(regions[label[c]].H, c);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const l = label[ny * GW + nx];
        if (l >= 0 && l !== bestL) { const e = err(regions[l].H, c); if (e < bestE) { bestE = e; bestL = l; } }
      }
      label[c] = bestL;
    }
  }
  // keep each plane's largest connected piece
  const out = [], pieces = [];
  regions.forEach((r, l) => {
    const seen = new Uint8Array(GW * GH); let bestCells = [];
    for (let c = 0; c < GW * GH; c++) {
      if (label[c] !== l || seen[c]) continue;
      const comp = component(c, (n) => label[n] === l);
      for (const n of comp) seen[n] = 1;
      if (comp.length > bestCells.length) bestCells = comp;
    }
    if (bestCells.length < 120) return;
    pieces.push({ cells: bestCells, H: fitCells(bestCells) || r.H });
  });
  // pieces of the same physical plane (the floor seen between boxes) fit each other's homography;
  // group them, and call a group wall/floor if it is big and reaches across the frame
  const group = pieces.map((_, i) => i), gfind = (i) => (group[i] === i ? i : (group[i] = gfind(group[i])));
  for (let i = 0; i < pieces.length; i++) for (let j = 0; j < pieces.length; j++) {
    if (i === j || gfind(i) === gfind(j)) continue;
    const cells = pieces[j].cells, step = Math.max(1, Math.floor(cells.length / 300));
    let fit = 0, n = 0;
    for (let k = 0; k < cells.length; k += step) { n++; if (err(pieces[i].H, cells[k]) < THR * 2) fit++; }
    if (fit / n > 0.8) group[gfind(j)] = gfind(i);
  }
  const touchesX = (cells, x) => cells.some((c) => c % GW === x);
  const plabel = new Int16Array(GW * GH).fill(-1);
  pieces.forEach((pc, i) => {
    const mates = pieces.filter((_, j) => gfind(j) === gfind(i));
    const size = mates.reduce((a, m) => a + m.cells.length, 0);
    for (const c of pc.cells) plabel[c] = out.length;
    // wall and floor reach across the frame, though a camera beside the projector may miss its far edges
    let x0 = GW, x1 = 0;
    for (const m of mates) for (const c of m.cells) { const x = c % GW; if (x < x0) x0 = x; if (x > x1) x1 = x; }
    const spans = (mates.some((m) => touchesX(m.cells, 0)) && mates.some((m) => touchesX(m.cells, GW - 1))) || x1 - x0 > GW * 0.75;
    out.push({ cells: pc.cells, H: pc.H, background: spans || size > GW * GH * 0.25 });
  });
  // Where two planes meet at a crease the projector->camera mapping is continuous, so each plane's homography also
  // predicts the cells just across the boundary. Where one object hides another there's a depth jump (parallax).
  const pairErr = new Map();
  for (let c = 0; c < GW * GH; c++) {
    const a = plabel[c]; if (a < 0) continue;
    for (const n of [c % GW < GW - 1 ? c + 1 : -1, c + GW < GW * GH ? c + GW : -1]) {
      if (n < 0) continue;
      const b = plabel[n]; if (b < 0 || b === a) continue;
      const key = Math.min(a, b) + ',' + Math.max(a, b);
      if (!pairErr.has(key)) pairErr.set(key, []);
      pairErr.get(key).push((err(out[a].H, n) + err(out[b].H, c)) / 2);
    }
  }
  const relation = new Map();
  pairErr.forEach((es, key) => { es.sort((x, y) => x - y); relation.set(key, { crease: es[es.length >> 1] < 3, n: es.length }); });
  const rel = (a, b) => relation.get(Math.min(a, b) + ',' + Math.max(a, b));
  const degenerate = out.length > 0 && Math.max(...out.map((r) => r.cells.length)) > nValid * 0.85;
  return { regions: out, decoded, nValid, plabel, rel, degenerate, GW, GH };
}

// ---------- regions to editable surfaces ----------
function convexHull(pts) {
  const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of P) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
const shoelace = (q) => q.reduce((a, p, i) => { const n = q[(i + 1) % q.length]; return a + p[0] * n[1] - n[0] * p[1]; }, 0) / 2;
function segDist(p, a, b) {
  const bx = b[0] - a[0], by = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * bx + (p[1] - a[1]) * by) / (bx * bx + by * by || 1)));
  return Math.hypot(p[0] - a[0] - bx * t, p[1] - a[1] - by * t);
}
function fitLine(pts) {                                    // total least squares: point + unit direction
  let mx = 0, my = 0; for (const [x, y] of pts) { mx += x; my += y; } mx /= pts.length; my /= pts.length;
  let sxx = 0, syy = 0, sxy = 0; for (const [x, y] of pts) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
  const a = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { p: [mx, my], d: [Math.cos(a), Math.sin(a)] };
}
function intersect(l1, l2) {
  const den = l1.d[0] * l2.d[1] - l1.d[1] * l2.d[0];
  if (Math.abs(den) < 1e-6) return null;
  const t = ((l2.p[0] - l1.p[0]) * l2.d[1] - (l2.p[1] - l1.p[1]) * l2.d[0]) / den;
  return [l1.p[0] + l1.d[0] * t, l1.p[1] + l1.d[1] * t];
}
function traceContour(member, start, GW, GH) {            // Moore-neighbour boundary trace, clockwise on screen
  const D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const out = [start]; let cur = start, dir = 0;
  for (let it = 0; it < GW * GH; it++) {
    let found = false;
    for (let k = 0; k < 8; k++) {
      const d = (dir + 6 + k) % 8, x = cur % GW + D[d][0], y = ((cur / GW) | 0) + D[d][1];
      if (x < 0 || y < 0 || x >= GW || y >= GH || !member(y * GW + x)) continue;
      cur = y * GW + x; dir = d; found = true; break;
    }
    if (!found || cur === start) break;
    out.push(cur);
  }
  return out;
}
function simplify(pts, eps) {                             // Douglas-Peucker on an open polyline
  if (pts.length < 3) return pts;
  let idx = 0, dmax = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = segDist(pts[i], pts[0], pts[pts.length - 1]); if (d > dmax) { dmax = d; idx = i; } }
  if (dmax <= eps) return [pts[0], pts[pts.length - 1]];
  return simplify(pts.slice(0, idx + 1), eps).slice(0, -1).concat(simplify(pts.slice(idx), eps));
}

// One region of projector cells -> { pins (frame pixels, BL BR TR TL), parts } or null.
export function regionToSurface(region, idx, res) {
  const { plabel, GW, GH } = res;
  const inR = new Uint8Array(GW * GH); for (const c of region.cells) inR[c] = 1;
  const center = (c) => [(c % GW) * CELL + CELL / 2, ((c / GW) | 0) * CELL + CELL / 2];
  const boundary = region.cells.filter((c) => { const x = c % GW, y = (c / GW) | 0; return x === 0 || y === 0 || x === GW - 1 || y === GH - 1 || !inR[c - 1] || !inR[c + 1] || !inR[c - GW] || !inR[c + GW]; });
  const corners = [];
  for (const c of boundary) { const [x, y] = center(c); corners.push([x - 2, y - 2], [x + 2, y - 2], [x + 2, y + 2], [x - 2, y + 2]); }
  const q = convexHull(corners);
  while (q.length > 4) {                                  // drop the vertex whose removal loses the least area
    let bi = 0, ba = Infinity;
    for (let i = 0; i < q.length; i++) { const a = Math.abs(shoelace([q[(i + q.length - 1) % q.length], q[i], q[(i + 1) % q.length]])); if (a < ba) { ba = a; bi = i; } }
    q.splice(bi, 1);
  }
  if (q.length < 4) return null;
  // refine each side with a line fit to the boundary, then intersect neighbouring sides
  const bpts = boundary.map(center);
  const cx = bpts.reduce((a, p) => a + p[0], 0) / bpts.length, cy = bpts.reduce((a, p) => a + p[1], 0) / bpts.length;
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const lines = q.map((a, e) => {
    const b = q[(e + 1) % 4];
    const mineCells = boundary.filter((c) => { const p = center(c), d = segDist(p, a, b); return d < 6 && [0, 1, 2, 3].every((k) => k === e || segDist(p, q[k], q[(k + 1) % 4]) >= d); });
    const mine = mineCells.map(center);
    // a side that borders another surface along most of its length is a crease: both surfaces fit one line to the
    // cells on either side of it, so their shared edge comes out identical. Look outward across any shadow gap.
    const votes = new Map(); let total = 0;
    for (const c of mineCells) for (const [dx, dy] of N4) {
      const x0 = c % GW, y0 = (c / GW) | 0;
      if (x0 + dx < 0 || y0 + dy < 0 || x0 + dx >= GW || y0 + dy >= GH || plabel[(y0 + dy) * GW + x0 + dx] === idx) continue;
      for (let k = 1; k <= 6; k++) {
        const x = x0 + dx * k, y = y0 + dy * k;
        if (x < 0 || y < 0 || x >= GW || y >= GH) break;
        const l = plabel[y * GW + x];
        if (l < 0 || l === idx) continue;
        total++; if (!res.regions[l].background) votes.set(l, (votes.get(l) || 0) + 1);
        break;
      }
    }
    let other = -1, ov = 0; votes.forEach((v, l) => { if (v > ov) { ov = v; other = l; } });
    const r2 = other >= 0 ? res.rel(idx, other) : null;
    if (other >= 0 && ov > total * 0.6 && r2 && r2.crease && mineCells.length >= 4) {
      const pts = [];
      for (const c of mineCells) {
        let adj = false;
        for (const [dx, dy] of N4) {
          const x = c % GW + dx, y = ((c / GW) | 0) + dy;
          if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
          const n = y * GW + x;
          if (plabel[n] === other) { pts.push(center(n)); adj = true; }
        }
        if (adj) pts.push(center(c));
      }
      if (pts.length >= 6) return fitLine(pts);
    }
    if (mine.length < 4) { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return { p: a, d: [(b[0] - a[0]) / l, (b[1] - a[1]) / l] }; }
    const L = fitLine(mine);
    const n = [-L.d[1], L.d[0]], outward = (L.p[0] - cx) * n[0] + (L.p[1] - cy) * n[1] > 0 ? 1 : -1;
    L.p = [L.p[0] + n[0] * outward * CELL / 2, L.p[1] + n[1] * outward * CELL / 2];  // boundary cell centres sit half a cell inside
    return L;
  });
  const pins = q.map((c, k) => { const r = intersect(lines[(k + 3) % 4], lines[k]); return r && Math.hypot(r[0] - c[0], r[1] - c[1]) < 25 ? r : c; });
  // pin order: bottom-left, bottom-right, top-right, top-left
  if (shoelace(pins) > 0) pins.reverse();
  let k0 = 0; pins.forEach((p, k) => { if (p[1] - p[0] > pins[k0][1] - pins[k0][0]) k0 = k; });
  const P = [0, 1, 2, 3].map((k) => pins[(k0 + k) % 4]);
  const surf = { pins: P, parts: [{ op: 1, pts: SHAPES.square() }] };
  // partly hidden or not four-sided: use the traced outline instead of the full quad
  if (region.cells.length * CELL * CELL < Math.abs(shoelace(P)) * 0.92) {
    const start = region.cells.reduce((a, c) => Math.min(a, c));
    let eps = 6, poly;
    const ring = traceContour((c) => inR[c] === 1, start, GW, GH).map(center);
    do { poly = simplify(ring.concat([ring[0]]), eps).slice(0, -1); eps *= 1.5; } while (poly.length > MAX_PART_VERTS);
    if (poly.length >= 3) {
      const Hi = inv3(squareToQuad(P));
      surf.parts = [{ op: 1, pts: poly.map(([x, y]) => hApply(Hi, x, y)) }];
    }
  }
  return surf;
}

// corners that nearly coincide become one shared corner, so neighbouring faces share their edge exactly
export function weldPins(surfaces, tol) {
  const all = []; surfaces.forEach((s) => s.pins.forEach((p) => all.push(p)));
  const used = new Set();
  for (let i = 0; i < all.length; i++) {
    if (used.has(i)) continue;
    const grp = [i];
    for (let j = i + 1; j < all.length; j++) if (!used.has(j) && Math.hypot(all[i][0] - all[j][0], all[i][1] - all[j][1]) < tol) grp.push(j);
    if (grp.length < 2) continue;
    const mx = grp.reduce((a, k) => a + all[k][0], 0) / grp.length, my = grp.reduce((a, k) => a + all[k][1], 0) / grp.length;
    for (const k of grp) { all[k][0] = mx; all[k][1] = my; used.add(k); }
  }
}

// The whole analysis: photos -> surfaces in the app's format (normalized pins), plus stats for the UI.
export function surfacesFromShots(shots, { camW, camH, W, H, keepBackground = false, minContrast = 20 }) {
  const res = decodeAndSegment(shots, { camW, camH, W, H, minContrast });
  const raw = res.regions.map((r, i) => (keepBackground || !r.background ? regionToSurface(r, i, res) : null)).filter(Boolean);
  weldPins(raw, 10);
  const surfaces = raw.slice(0, MAX_SURF).map((s) => ({
    id: Math.random().toString(36).slice(2, 10),
    pins: s.pins.map(([x, y]) => [x / W, y / H]),
    parts: s.parts,
    content: { kind: 'effect', effect: 'outline' },
  }));
  return {
    surfaces,
    planes: res.regions.length,
    background: res.regions.filter((r) => r.background).length,
    decoded: res.decoded,
    coverage: res.nValid / (res.GW * res.GH),
    degenerate: res.degenerate,
    res,
  };
}
