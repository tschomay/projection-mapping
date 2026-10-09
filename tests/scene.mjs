// A synthetic room for testing surface capture: a projector at the origin looking down +z, a camera beside it,
// a wall, a floor and one box. buildRoom is self-contained (no outside references) so browser tests can inject
// it into a page with buildRoom.toString().
export function buildRoom({ W, H, camW = 640, camH = 480 } = {}) {
  const fP = 700 * W / 1280, fC = 400, P0 = [0, 0.45, 0], C0 = [0.5, 0.6, 0], camYaw = -0.12;
  const box = { min: [-1.2, -0.5, 2.4], max: [-0.45, 0.1, 3.0] }, WALL_Z = 3.8, FLOOR_Y = -0.5;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  function hitBox(o, d) {
    let t0 = -Infinity, t1 = Infinity;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(d[k]) < 1e-12) { if (o[k] < box.min[k] || o[k] > box.max[k]) return null; continue; }
      let ta = (box.min[k] - o[k]) / d[k], tb = (box.max[k] - o[k]) / d[k];
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    }
    return t0 <= t1 && t0 > 1e-6 ? t0 : null;
  }
  function hit(o, d) {
    let t = hitBox(o, d);
    if (d[2] > 0) { const u = (WALL_Z - o[2]) / d[2]; if (u > 0 && (t === null || u < t)) t = u; }
    if (d[1] < 0) { const u = (FLOOR_Y - o[1]) / d[1]; if (u > 0 && (t === null || u < t)) t = u; }
    return t;
  }
  // projector pixel (frame y down) for a world point
  const toProj = (p) => [W / 2 + fP * (p[0] - P0[0]) / (p[2] - P0[2]), H / 2 - fP * (p[1] - P0[1]) / (p[2] - P0[2])];
  // for every camera pixel, the projector pixel lighting it (-1 where unlit: off-frame or in a projector shadow)
  const lit = new Float32Array(camW * camH * 2).fill(-1);
  for (let y = 0; y < camH; y++) for (let x = 0; x < camW; x++) {
    const dx = (x + 0.5 - camW / 2) / fC, dy = -(y + 0.5 - camH / 2) / fC;
    const d = [dx * Math.cos(camYaw) + Math.sin(camYaw), dy, -dx * Math.sin(camYaw) + Math.cos(camYaw)];
    const t = hit(C0, d); if (t === null) continue;
    const p = [C0[0] + d[0] * t, C0[1] + d[1] * t, C0[2] + d[2] * t], q = toProj(p);
    if (q[0] < 0 || q[1] < 0 || q[0] >= W || q[1] >= H) continue;
    const back = hit(P0, sub(p, P0)); if (back !== null && back < 0.999) continue;
    lit[(y * camW + x) * 2] = q[0]; lit[(y * camW + x) * 2 + 1] = q[1];
  }
  const B = box;
  const faces = {
    front: [[B.min[0], B.min[1], B.min[2]], [B.max[0], B.min[1], B.min[2]], [B.max[0], B.max[1], B.min[2]], [B.min[0], B.max[1], B.min[2]]],
    right: [[B.max[0], B.min[1], B.min[2]], [B.max[0], B.min[1], B.max[2]], [B.max[0], B.max[1], B.max[2]], [B.max[0], B.max[1], B.min[2]]],
    top: [[B.min[0], B.max[1], B.min[2]], [B.max[0], B.max[1], B.min[2]], [B.max[0], B.max[1], B.max[2]], [B.min[0], B.max[1], B.max[2]]],
  };
  // each visible box face as four projector-pixel corners
  const faceCorners = Object.fromEntries(Object.entries(faces).map(([k, pts]) => [k, pts.map(toProj)]));
  // the brightness a pattern frame gives a projector pixel (same coding as app/src/capture.js)
  const patternValue = (f, px, py) => {
    if (!f) return 0.05;
    if (f.mode !== 2) return f.mode;
    const idx = Math.floor((f.axis === 0 ? px : py) / 4), v = ((idx ^ (idx >> 1)) >> f.bit) & 1;
    return f.inv ? 1 - v : v;
  };
  return { W, H, camW, camH, lit, faceCorners, patternValue };
}

// mean distance from each true corner to the nearest pin of the best-matching surface (frame pixels)
export function cornerError(corners, surfaces, W, H) {
  return Math.min(...surfaces.map((s) => corners.reduce((a, t) => a + Math.min(...s.pins.map(([x, y]) => Math.hypot(x * W - t[0], y * H - t[1]))), 0) / 4));
}
