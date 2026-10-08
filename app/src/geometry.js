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

// Pins are stored normalized; geometry works in frame pixels (W x H) so distances mean something on screen.
export function surfaceGeom(s, W, H) {
  const pins = s.pins.map(([x, y]) => [x * W, y * H]);
  const Hm = squareToQuad(pins);
  return {
    pins,
    H: Hm,
    Hi: inv3(Hm),
    parts: s.parts.map((p) => ({ op: p.op, px: p.pts.map(([u, v]) => hApply(Hm, u, v)) })),
    size: [(dist(pins[0], pins[1]) + dist(pins[3], pins[2])) / 2, (dist(pins[0], pins[3]) + dist(pins[1], pins[2])) / 2],
  };
}

export function insideSurface(g, x, y) {
  let inside = false;
  g.parts.forEach((p, j) => {
    const pin = pointInPoly(x, y, p.px);
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
