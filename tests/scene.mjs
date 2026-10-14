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

// A synthetic wall for the photo checks: the projector at the origin looking down +z at a wall turned 25 degrees,
// and a camera just beside the lens with a wider, slightly rolled view. On the wall: wainscoting (a chair rail and
// three panels outlined by a thin molding) and two picture frames, one with a mat. buildWall is self-contained,
// like buildRoom. photo(lit, seed) is an RGBA camera image in room light, with the projector black (lit = 0) or
// white (lit = 1). rects are the things to find, each as four corners (top-left first, clockwise on screen), in
// projector pixels (frame) and camera pixels (cam); frameCam is the projector frame's corners in camera pixels.
export function buildWall({ W, H, camW = 640, camH = 480 } = {}) {
  const fP = 1400 * W / 1280, fC = 560, yaw = 25 * Math.PI / 180;
  const O = [0, 0, 3], e1 = [Math.cos(yaw), 0, Math.sin(yaw)], e2 = [0, 1, 0], N = [Math.sin(yaw), 0, -Math.cos(yaw)];
  const C0 = [0.06, 0.09, 0], cy = -0.02, cr = 0.03;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // camera rotation: roll about z, then yaw about y
  const rot = (v) => {
    const x1 = v[0] * Math.cos(cr) - v[1] * Math.sin(cr), y1 = v[0] * Math.sin(cr) + v[1] * Math.cos(cr);
    return [x1 * Math.cos(cy) + v[2] * Math.sin(cy), y1, -x1 * Math.sin(cy) + v[2] * Math.cos(cy)];
  };
  const unrot = (v) => {
    const x1 = v[0] * Math.cos(cy) - v[2] * Math.sin(cy), z1 = v[0] * Math.sin(cy) + v[2] * Math.cos(cy);
    return [x1 * Math.cos(cr) + v[1] * Math.sin(cr), -x1 * Math.sin(cr) + v[1] * Math.cos(cr), z1];
  };
  const wallPoint = (s, t) => [O[0] + s * e1[0], O[1] + t, O[2] + s * e1[2]];
  const toProj = (p) => [W / 2 + fP * p[0] / p[2], H / 2 - fP * p[1] / p[2]];
  const toCam = (p) => { const c = unrot([p[0] - C0[0], p[1] - C0[1], p[2] - C0[2]]); return [camW / 2 + fC * c[0] / c[2], camH / 2 - fC * c[1] / c[2]]; };
  const hitWall = (o, d) => { const l = dot(N, [O[0] - o[0], O[1] - o[1], O[2] - o[2]]) / dot(N, d); return [o[0] + d[0] * l, o[1] + d[1] * l, o[2] + d[2] * l]; };
  const projRay = (x, y) => hitWall([0, 0, 0], [(x - W / 2) / fP, -(y - H / 2) / fP, 1]);

  // what's on the wall, in wall metres (s right, t up)
  const inR = (s, t, r) => s >= r[0] && s <= r[1] && t >= r[2] && t <= r[3];
  const shrink = (r, m) => [r[0] + m, r[1] - m, r[2] + m, r[3] - m];
  const panels = [[-0.95, -0.45, -0.62, -0.40], [-0.3, 0.2, -0.62, -0.40], [0.35, 0.85, -0.62, -0.40], [1.0, 1.5, -0.62, -0.40]], MOLD = 0.015;
  const frame1 = [-0.8, -0.3, 0.0, 0.42], mat1 = shrink(frame1, 0.04), art1 = shrink(mat1, 0.05);
  const frame2 = [0.3, 0.7, -0.12, 0.3], art2 = shrink(frame2, 0.03);
  const albedo = (s, t) => {
    if (inR(s, t, art1)) { const u = (s - art1[0]) / (art1[1] - art1[0]), v = (t - art1[2]) / (art1[3] - art1[2]); return [0.25 + 0.3 * v, 0.45 + 0.2 * Math.sin(u * 5 + v * 3), 0.7 - 0.3 * u]; }
    if (inR(s, t, mat1)) return [0.93, 0.92, 0.88];
    if (inR(s, t, frame1)) return [0.32, 0.2, 0.12];
    if (inR(s, t, art2)) { const u = (s - art2[0]) / (art2[1] - art2[0]), v = (t - art2[2]) / (art2[3] - art2[2]); return [0.75 - 0.2 * v, 0.3 + 0.15 * Math.cos(u * 7), 0.25 + 0.2 * u * v]; }
    if (inR(s, t, frame2)) return [0.1, 0.1, 0.1];
    if (t < -0.27) {
      if (t > -0.30) return [0.62, 0.62, 0.58];                                  // chair rail
      for (const p of panels) if (inR(s, t, p) && !inR(s, t, shrink(p, MOLD))) return [0.7, 0.7, 0.66];   // molding
      return [0.86, 0.86, 0.82];                                                 // wainscot paint
    }
    return [0.8, 0.73, 0.6];                                                     // wall paint
  };

  // per camera pixel: albedo, and whether the projector's frame lands there
  const alb = new Float32Array(camW * camH * 3), lit = new Uint8Array(camW * camH);
  for (let y = 0; y < camH; y++) for (let x = 0; x < camW; x++) {
    const p = hitWall(C0, rot([(x + 0.5 - camW / 2) / fC, -(y + 0.5 - camH / 2) / fC, 1]));
    const s = dot([p[0] - O[0], p[1] - O[1], p[2] - O[2]], e1), t = p[1] - O[1];
    alb.set(albedo(s, t), (y * camW + x) * 3);
    const q = toProj(p);
    lit[y * camW + x] = q[0] >= 0 && q[1] >= 0 && q[0] < W && q[1] < H ? 1 : 0;
  }
  // corners of a wall rectangle, top-left first and clockwise on screen
  const corners = (r) => [[r[0], r[3]], [r[1], r[3]], [r[1], r[2]], [r[0], r[2]]].map(([s, t]) => wallPoint(s, t));
  const named = { panel1: shrink(panels[0], MOLD), panel2: shrink(panels[1], MOLD), panel3: shrink(panels[2], MOLD), panel1Outer: panels[0], art1, mat1, frame1, art2, frame2 };
  const rects = Object.fromEntries(Object.entries(named).map(([k, r]) => [k, { frame: corners(r).map(toProj), cam: corners(r).map(toCam) }]));
  const frameCam = [[0, 0], [W, 0], [W, H], [0, H]].map(([x, y]) => toCam(projRay(x, y)));

  // the photo: room light plus the projector, a little lens blur and sensor noise
  function photo(f = 0, seed = 5) {
    let sd = seed; const rand = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
    const raw = new Float32Array(camW * camH * 3);
    for (let i = 0; i < camW * camH; i++) {
      const light = 0.6 + (lit[i] ? 0.03 + 0.4 * f : 0);
      for (let c = 0; c < 3; c++) raw[i * 3 + c] = 255 * alb[i * 3 + c] * light;
    }
    const out = new Uint8ClampedArray(camW * camH * 4);
    for (let y = 0; y < camH; y++) for (let x = 0; x < camW; x++) {
      for (let c = 0; c < 3; c++) {
        let s = 0, n = 0;
        for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) {
          const xx = x + j, yy = y + k, w = j || k ? 1 : 4;
          if (xx >= 0 && yy >= 0 && xx < camW && yy < camH) { s += raw[(yy * camW + xx) * 3 + c] * w; n += w; }
        }
        out[(y * camW + x) * 4 + c] = s / n + (rand() - 0.5) * 8;
      }
      out[(y * camW + x) * 4 + 3] = 255;
    }
    return out;
  }
  return { W, H, camW, camH, photo, rects, frameCam };
}
