// Touch-first editing of 2D surfaces on the projector frame.
// Works in frame pixels (see App.frame); stores pins normalized so a project survives a change of screen.
import { SHAPES, hApply, pointInPoly, insideSurface, dist } from './geometry.js';
import { MAX_PART_VERTS, MAX_SURF, MAX_PARTS } from './renderer.js';

const HANDLE_CSS_PX = 22;   // touch target radius

export class Editor {
  constructor(app, overlay) {
    this.app = app;
    this.canvas = overlay;
    this.ctx = overlay.getContext('2d');
    this.sel = -1;            // selected surface index
    this.mode = 'warp';       // 'warp' (corner pins), 'points' (outline vertices) or 'mesh' (bend grid points)
    this.selPin = -1;
    this.selVert = null;      // { j, k }
    this.selMesh = -1;        // bend grid point
    this.drag = null;
    this.snap = true;
    overlay.addEventListener('pointerdown', (e) => this.down(e));
    overlay.addEventListener('pointermove', (e) => this.move(e));
    overlay.addEventListener('pointerup', () => this.up());
    overlay.addEventListener('pointercancel', () => this.up());
    overlay.addEventListener('dblclick', (e) => this.dbl(e));
  }

  get surfaces() { return this.app.project.surfaces; }
  get geoms() { return this.app.geoms; }

  toFrame(e) {
    const r = this.canvas.getBoundingClientRect(), [W, H] = this.app.frame;
    return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H];
  }
  handleR() { return HANDLE_CSS_PX * this.app.frame[0] / this.canvas.getBoundingClientRect().width; }
  norm([x, y]) { const [W, H] = this.app.frame; return [x / W, y / H]; }

  snapPoint(p) {
    if (!this.snap) return p;
    let best = null, bd = this.handleR() * 0.8;
    this.geoms.forEach((g, si) => {
      if (si === this.sel) return;
      for (const q of g.pins.concat(...g.parts.map((pt) => pt.outline))) { const d = dist(p, q); if (d < bd) { bd = d; best = q; } }
    });
    return best ? [best[0], best[1]] : p;
  }

  surfaceAt(x, y) { for (let i = this.geoms.length - 1; i >= 0; i--) if (insideSurface(this.geoms[i], x, y)) return i; return -1; }

  select(i) { this.sel = i; this.selPin = -1; this.selVert = null; this.selMesh = -1; this.app.changed({ geometry: false }); }

  down(e) {
    this.canvas.setPointerCapture(e.pointerId);
    this.app.gesture();
    const p = this.toFrame(e), r = this.handleR();
    const s = this.surfaces[this.sel], g = this.geoms[this.sel];
    if (s && this.mode === 'warp') {
      const k = g.pins.findIndex((q) => dist(q, p) <= r);
      if (k >= 0) { this.drag = { type: 'pin', k }; this.selPin = k; this.app.changed({ geometry: false }); return; }
    }
    if (s && this.mode === 'mesh' && g.meshPx) {
      let k = -1, bd = r;
      g.meshPx.forEach((q, i) => { const d = dist(q, p); if (d <= bd) { bd = d; k = i; } });
      if (k >= 0) { this.drag = { type: 'mesh', k }; this.selMesh = k; this.app.changed({ geometry: false }); return; }
    }
    if (s && this.mode === 'points') {
      for (let j = g.parts.length - 1; j >= 0; j--) {
        const k = g.parts[j].px.findIndex((q) => dist(q, p) <= r);
        if (k >= 0) { this.drag = { type: 'vert', j, k }; this.selVert = { j, k }; this.app.changed({ geometry: false }); return; }
      }
      for (let j = g.parts.length - 1; j >= 0; j--) {
        const px = g.parts[j].px;
        for (let k = 0; k < px.length; k++) {
          const a = px[k], b = px[(k + 1) % px.length];
          if (s.parts[j].pts.length < MAX_PART_VERTS && dist([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], p) <= r * 0.7) {
            s.parts[j].pts.splice(k + 1, 0, g.toUV(...p));
            this.drag = { type: 'vert', j, k: k + 1 }; this.selVert = { j, k: k + 1 };
            this.app.changed(); return;
          }
        }
      }
      for (let j = g.parts.length - 1; j >= 0; j--) {
        if (pointInPoly(p[0], p[1], g.parts[j].outline)) {
          this.drag = { type: 'part', j, start: g.toUV(...p), pts: s.parts[j].pts.map((q) => [...q]) };
          return;
        }
      }
    }
    const hit = this.surfaceAt(...p);
    if (hit >= 0) {
      if (hit !== this.sel) { this.sel = hit; this.selPin = -1; this.selVert = null; this.selMesh = -1; }
      this.drag = { type: 'move', start: p, pins: this.surfaces[hit].pins.map((q) => [...q]) };
    } else { this.sel = -1; this.selPin = -1; this.selVert = null; this.selMesh = -1; }
    this.app.changed({ geometry: false });
  }

  move(e) {
    if (!this.drag) return;
    const p = this.toFrame(e), s = this.surfaces[this.sel], g = this.geoms[this.sel];
    if (!s) return;
    const d = this.drag;
    if (d.type === 'pin') s.pins[d.k] = this.norm(this.snapPoint(p));
    else if (d.type === 'vert') s.parts[d.j].pts[d.k] = g.toUV(...this.snapPoint(p));
    else if (d.type === 'mesh') s.mesh.pts[d.k] = hApply(g.Hi, ...p);
    else if (d.type === 'part') {
      const [u, v] = g.toUV(...p);
      s.parts[d.j].pts = d.pts.map(([a, b]) => [a + u - d.start[0], b + v - d.start[1]]);
    } else if (d.type === 'move') {
      const [W, H] = this.app.frame, dx = (p[0] - d.start[0]) / W, dy = (p[1] - d.start[1]) / H;
      s.pins = d.pins.map(([x, y]) => [x + dx, y + dy]);
    }
    this.app.changed();
  }

  up() { if (this.drag) { this.drag = null; this.app.changed({ geometry: false, save: true }); } }

  dbl(e) {
    if (this.mode !== 'points' || !this.surfaces[this.sel]) return;
    const p = this.toFrame(e), g = this.geoms[this.sel];
    for (let j = 0; j < g.parts.length; j++) {
      const k = g.parts[j].px.findIndex((q) => dist(q, p) <= this.handleR());
      if (k >= 0) { this.selVert = { j, k }; this.deletePoint(); return; }
    }
  }

  // ---- commands ----
  addSurface(surface) {
    if (this.surfaces.length >= MAX_SURF) { this.app.toast(`Up to ${MAX_SURF} surfaces can be projected. Combine shapes into one surface to cover more.`); return false; }
    this.surfaces.push(surface); this.select(this.surfaces.length - 1); this.app.changed();
    return true;
  }
  addPart(shape, op) {
    const s = this.surfaces[this.sel];
    if (!s || s.parts.length >= 8) return false;
    if (this.surfaces.reduce((a, x) => a + x.parts.length, 0) >= MAX_PARTS) { this.app.toast(`Up to ${MAX_PARTS} shapes in all can be projected.`); return false; }
    s.parts.push({ op, pts: SHAPES[shape]().map(([u, v]) => [0.3 + 0.4 * u, 0.3 + 0.4 * v]) });
    this.mode = 'points'; this.selVert = null;
    this.app.changed();
    return true;
  }
  deletePoint() {
    const s = this.surfaces[this.sel], v = this.selVert;
    if (!s || !v || !s.parts[v.j]) return 'Select a point first.';
    if (s.parts[v.j].pts.length <= 3) return 'A shape needs at least three points. Delete the surface instead.';
    s.parts[v.j].pts.splice(v.k, 1); this.selVert = null; this.app.changed();
    return null;
  }
  deleteSurface() { if (this.sel < 0) return; this.surfaces.splice(this.sel, 1); this.select(-1); this.app.changed(); }
  duplicateSurface() {
    const s = this.surfaces[this.sel];
    if (!s) return;
    const c = JSON.parse(JSON.stringify(s));
    c.id = Math.random().toString(36).slice(2, 10);
    c.pins = c.pins.map(([x, y]) => [x + 0.03, y + 0.03]);
    this.addSurface(c);
  }
  // nudge whatever is selected by (dx, dy) frame pixels: a corner, a point, or the whole surface
  nudge(dx, dy) {
    const s = this.surfaces[this.sel], g = this.geoms[this.sel];
    if (!s) return;
    const [W, H] = this.app.frame;
    if (this.mode === 'warp' && this.selPin >= 0) { const q = s.pins[this.selPin]; s.pins[this.selPin] = [q[0] + dx / W, q[1] + dy / H]; }
    else if (this.mode === 'points' && this.selVert) {
      const q = g.parts[this.selVert.j].px[this.selVert.k];
      s.parts[this.selVert.j].pts[this.selVert.k] = g.toUV(q[0] + dx, q[1] + dy);
    } else if (this.mode === 'mesh' && this.selMesh >= 0 && s.mesh) {
      const q = g.meshPx[this.selMesh];
      s.mesh.pts[this.selMesh] = hApply(g.Hi, q[0] + dx, q[1] + dy);
    } else s.pins = s.pins.map(([x, y]) => [x + dx / W, y + dy / H]);
    this.app.changed({ save: true });
  }
  nudgeTarget() {
    if (this.sel < 0) return '';
    if (this.mode === 'warp' && this.selPin >= 0) return 'corner';
    if (this.mode === 'points' && this.selVert) return 'point';
    if (this.mode === 'mesh' && this.selMesh >= 0) return 'bend point';
    return 'surface';
  }

  // ---- drawing (edit mode only; when mirroring, these handles are projected too, which helps alignment) ----
  draw() {
    const c = this.canvas, r = c.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    if (c.width !== Math.round(r.width * dpr) || c.height !== Math.round(r.height * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
    const ctx = this.ctx, [W, H] = this.app.frame, sx = c.width / W, sy = c.height / H;
    ctx.clearRect(0, 0, c.width, c.height);
    const path = (pts) => { ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x * sx, y * sy) : ctx.moveTo(x * sx, y * sy))); ctx.closePath(); };
    const hr = HANDLE_CSS_PX * dpr * 0.45;
    this.geoms.forEach((g, si) => {
      const sel = si === this.sel;
      for (const part of g.parts) {
        ctx.setLineDash(part.op < 0 ? [6 * dpr, 4 * dpr] : []);
        ctx.strokeStyle = sel ? '#ffb547' : 'rgba(255,255,255,0.5)';
        ctx.lineWidth = (sel ? 2 : 1.25) * dpr;
        path(part.outline); ctx.stroke();
      }
      ctx.setLineDash([]);
      // surface number, so tiny surfaces can be found from the list too
      const cx = g.pins.reduce((a, p) => a + p[0], 0) / 4 * sx, cy = g.pins.reduce((a, p) => a + p[1], 0) / 4 * sy;
      ctx.font = `600 ${12 * dpr}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = sel ? '#ffb547' : 'rgba(255,255,255,0.7)'; ctx.fillText(String(si + 1), cx, cy);
      if (!sel) return;
      if (this.mode === 'warp') {
        ctx.setLineDash([4 * dpr, 4 * dpr]); ctx.strokeStyle = 'rgba(255,181,71,0.55)'; ctx.lineWidth = dpr;
        path(g.pins); ctx.stroke(); ctx.setLineDash([]);
        g.pins.forEach(([x, y], k) => {
          ctx.beginPath(); ctx.arc(x * sx, y * sy, hr, 0, Math.PI * 2);
          ctx.fillStyle = k === this.selPin ? '#ffffff' : 'rgba(255,181,71,0.9)'; ctx.fill();
          ctx.strokeStyle = '#0d1016'; ctx.lineWidth = 2 * dpr; ctx.stroke();
        });
      } else if (this.mode === 'mesh') {
        if (!g.mesh) return;
        // the bend grid as curves, then its points
        const [nx, ny] = g.mesh.n, line = (f) => { ctx.beginPath(); for (let t = 0; t <= 24; t++) { const [x, y] = f(t / 24); t ? ctx.lineTo(x * sx, y * sy) : ctx.moveTo(x * sx, y * sy); } ctx.stroke(); };
        ctx.strokeStyle = 'rgba(255,181,71,0.45)'; ctx.lineWidth = dpr;
        for (let i = 0; i <= nx; i++) line((t) => g.toFrame(i / nx, t));
        for (let j = 0; j <= ny; j++) line((t) => g.toFrame(t, j / ny));
        g.meshPx.forEach(([x, y], k) => {
          ctx.beginPath(); ctx.arc(x * sx, y * sy, hr * 0.7, 0, Math.PI * 2);
          ctx.fillStyle = k === this.selMesh ? '#ffffff' : 'rgba(255,181,71,0.9)'; ctx.fill();
          ctx.strokeStyle = '#0d1016'; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
        });
      } else {
        g.parts.forEach((part, j) => {
          part.px.forEach(([x, y], k) => {
            const a = part.px[(k + 1) % part.px.length];
            ctx.beginPath(); ctx.arc((x + a[0]) / 2 * sx, (y + a[1]) / 2 * sy, hr * 0.45, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,181,71,0.8)'; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
          });
          part.px.forEach(([x, y], k) => {
            const on = this.selVert && this.selVert.j === j && this.selVert.k === k;
            ctx.fillStyle = on ? '#ffffff' : '#ffb547';
            ctx.fillRect(x * sx - hr * 0.55, y * sy - hr * 0.55, hr * 1.1, hr * 1.1);
          });
        });
      }
    });
  }
}
