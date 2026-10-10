// Geometry for 2D surfaces.
// A surface has four corner pins in normalized frame coordinates (0..1, y down). They define a homography from
// the unit square, so anything drawn in the surface's own uv space lands perspective-correct on a flat surface.
// Its outline is one or more parts: polygons in that uv space, each added (union) or cut out.

export const SHAPES = {
  square: () => [[0, 0], [1, 0], [1, 1], [0, 1]],
  triangle: () => [[0, 0], [1, 0], [0.5, 1]],
  circle: () => Array.from({ length: 48 }, (_, i) => [0.5 + 0.5 * Math.cos(i / 48 * 2 * Math.PI), 0.5 + 0.5 * Math.sin(i / 48 * 2 * Math.PI)]),
};

// Heckbert's square-to-quad: unit square corners (0,0),(1,0),(1,1),(0,1) -> q[0..3]. Row-major 3x3.
export function squareToQuad(q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  let g = 0, h = 0;
  const den = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(den) > 1e-12) { g = (sx * dy2 - dx2 * sy) / den; h = (dx1 * sy - sx * dy1) / den; }
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}

export function inv3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C || 1e-12;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}

export function hApply(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

export function pointInPoly(x, y, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// ---- mesh warp (roadmap #6) ----
// A surface may carry s.mesh = { n: [nx, ny], pts }: (nx+1) x (ny+1) control points, row by row from v = 0, in the
// homography's unit-square space. Content uv maps through a smooth Catmull-Rom surface that passes through every
// point, then through the corner-pin homography, so a surface can bend onto a curved or bowed object with no seams.
export function flatMesh(nx, ny) {
  const pts = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) pts.push([i / nx, j / ny]);
  return { n: [nx, ny], pts };
}

const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);

// A fast evaluator for one mesh: content uv -> homography space. The grid is padded once with a ring of points
// continued linearly past the edges, so every lookup is plain arithmetic.
export function meshEvaluator(mesh) {
  const [nx, ny] = mesh.n, P = mesh.pts, w = nx + 3;
  const X = new Float64Array(w * (ny + 3)), Y = new Float64Array(w * (ny + 3));
  const at = (i, j) => {
    const ci = Math.max(0, Math.min(nx, i)), cj = Math.max(0, Math.min(ny, j));
    let p = P[cj * (nx + 1) + ci];
    if (i !== ci) { const q = P[cj * (nx + 1) + (i < 0 ? 1 : nx - 1)]; p = [2 * p[0] - q[0], 2 * p[1] - q[1]]; }
    if (j !== cj) { const q = at(i, j < 0 ? 1 : ny - 1); p = [2 * p[0] - q[0], 2 * p[1] - q[1]]; }
    return p;
  };
  for (let j = -1; j <= ny + 1; j++) for (let i = -1; i <= nx + 1; i++) { const p = at(i, j), o = (j + 1) * w + i + 1; X[o] = p[0]; Y[o] = p[1]; }
  return (u, v) => {
    const gx = u * nx, gy = v * ny;
    const i = Math.max(0, Math.min(nx - 1, Math.floor(gx))), j = Math.max(0, Math.min(ny - 1, Math.floor(gy)));
    const tx = gx - i, ty = gy - j;
    const rowX = (r) => { const o = r * w + i; return cr(X[o], X[o + 1], X[o + 2], X[o + 3], tx); };
    const rowY = (r) => { const o = r * w + i; return cr(Y[o], Y[o + 1], Y[o + 2], Y[o + 3], tx); };
    return [cr(rowX(j), rowX(j + 1), rowX(j + 2), rowX(j + 3), ty), cr(rowY(j), rowY(j + 1), rowY(j + 2), rowY(j + 3), ty)];
  };
}
export const meshPoint = (mesh, u, v) => meshEvaluator(mesh)(u, v);

// homography space -> content uv (Newton's method; the warp is close to the identity). f: meshEvaluator(mesh).
export function meshInverse(f, q, guess = q) {
  let [u, v] = guess;
  for (let it = 0; it < 12; it++) {
    const p = f(u, v), ex = p[0] - q[0], ey = p[1] - q[1];
    if (Math.abs(ex) + Math.abs(ey) < 1e-7) break;
    const e = 1e-4, fu = f(u + e, v), fv = f(u, v + e);
    const a = (fu[0] - p[0]) / e, b = (fv[0] - p[0]) / e, c = (fu[1] - p[1]) / e, d = (fv[1] - p[1]) / e, det = a * d - b * c;
    if (Math.abs(det) < 1e-9) break;
    let du = (d * ex - b * ey) / det, dv = (a * ey - c * ex) / det;
    const m = Math.hypot(du, dv); if (m > 0.25) { du *= 0.25 / m; dv *= 0.25 / m; }
    u -= du; v -= dv;
  }
  return [u, v];
}

// a polygon's edges split finely enough to follow a bent surface
function densify(pts, steps, max) {
  const out = [];
  const per = Math.max(1, Math.min(steps, Math.floor(max / pts.length)));
  pts.forEach((a, k) => {
    const b = pts[(k + 1) % pts.length], n = Math.max(1, Math.min(per, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * steps)));
    for (let t = 0; t < n; t++) out.push([a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n]);
  });
  return out;
}

// Pins are stored normalized; geometry works in frame pixels (W x H) so distances mean something on screen.
// toFrame(u, v) and toUV(x, y) map between content uv and frame pixels, through the mesh when there is one.
// Each part has px (its own points, for handles) and outline (what's drawn and hit-tested: px, or finer when bent).
export function surfaceGeom(s, W, H, maxVerts = 128) {
  const pins = s.pins.map(([x, y]) => [x * W, y * H]);
  const Hm = squareToQuad(pins), Hi = inv3(Hm), mesh = s.mesh || null, f = mesh && meshEvaluator(mesh);
  const toFrame = mesh ? (u, v) => hApply(Hm, ...f(u, v)) : (u, v) => hApply(Hm, u, v);
  const toUV = mesh ? (x, y) => meshInverse(f, hApply(Hi, x, y)) : (x, y) => hApply(Hi, x, y);
  return {
    pins,
    H: Hm,
    Hi,
    mesh,
    toFrame,
    toUV,
    meshPx: mesh ? mesh.pts.map(([x, y]) => hApply(Hm, x, y)) : null,
    parts: s.parts.map((p) => {
      const px = p.pts.map(([u, v]) => toFrame(u, v));
      return { op: p.op, px, outline: mesh ? densify(p.pts, Math.max(mesh.n[0], mesh.n[1]) * 4, maxVerts).map(([u, v]) => toFrame(u, v)) : px };
    }),
    size: [(dist(pins[0], pins[1]) + dist(pins[3], pins[2])) / 2, (dist(pins[0], pins[3]) + dist(pins[1], pins[2])) / 2],
    feather: s.feather || 0,
    input: s.input && s.input.w > 0 && s.input.h > 0 ? s.input : null,
  };
}

export function insideSurface(g, x, y) {
  let inside = false;
  g.parts.forEach((p, j) => {
    const pin = pointInPoly(x, y, p.outline);
    inside = j === 0 ? pin : p.op > 0 ? inside || pin : inside && !pin;
  });
  return inside;
}

export function newSurface(shape, index) {
  const k = index % 5, cx = 0.5 + k * 0.03, cy = 0.5 + k * 0.04, rx = 0.09, ry = 0.16;
  // corner order: bottom-left, bottom-right, top-right, top-left (uv v points up)
  return {
    id: Math.random().toString(36).slice(2, 10),
    pins: [[cx - rx, cy + ry], [cx + rx, cy + ry], [cx + rx, cy - ry], [cx - rx, cy - ry]],
    parts: [{ op: 1, pts: SHAPES[shape]() }],
    content: { kind: 'effect', effect: 'outline' },
  };
}

// ---- composition canvas (roadmap #7) ----
// A surface may carry s.input = { x, y, w, h }: the rectangle of the composition (the frame-wide content: "one
// image across all" media and effects that use s.screen) that it shows, in screen units (0..1, y up). Without
// one, a surface shows the part of the composition it covers. This is that default, as a rectangle: the box
// around its corner pins.
export function inputRect(s) {
  if (s.input && s.input.w > 0 && s.input.h > 0) return s.input;
  const xs = s.pins.map((p) => p[0]), ys = s.pins.map((p) => 1 - p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
