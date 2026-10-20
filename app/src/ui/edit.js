// Quick editing without the drawer: undo, the bar for the selected surface and its menu (also on a long press),
// the Add menu, joining surfaces.
// Methods mixed into App (see app.js), so `this` is the app.
import { newSurface, surfaceGeom } from '../geometry.js';
import { mergeSurfaces, surfacesMeet } from '../merge.js';
import { $ } from '../env.js';

const HISTORY = 60;
const COALESCE_MS = 1500;   // repeated nudges or slider moves within this make one undo step

export const editUI = {
  initEditUI() {
    this.history = [];
    $('undoBtn').onclick = () => this.undo();
    $('addBtn').onclick = (e) => { e.stopPropagation(); this.openAddMenu($('addBtn')); };
    $('quickMore').onclick = (e) => { e.stopPropagation(); this.surfaceMenu(this.editor.sel, $('quickMore')); };
    // a tap outside the menu closes it, and does nothing else
    window.addEventListener('pointerdown', (e) => {
      if ($('ctxMenu').hidden || $('ctxMenu').contains(e.target)) return;
      this.closeMenu();
      if (e.target === this.editor.canvas) { e.stopPropagation(); e.preventDefault(); }
    }, true);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('ctxMenu').hidden) this.closeMenu(); });
  },

  // ---------- undo ----------
  // Before every change to the surfaces' shapes: remember them as they are. A key makes a run of the same change
  // (nudging, a slider) one step.
  checkpoint(key = null) {
    const now = performance.now(), last = this.history[this.history.length - 1];
    if (key && last && last.key === key && now - last.t < COALESCE_MS) { last.t = now; return; }
    const pick = this.pickLast ? { ref: this.pickLast, idx: this.pickLast.idx } : null;
    this.history.push({ key, t: now, surfaces: structuredClone(this.project.surfaces), sel: this.editor.sel, pick });
    if (this.history.length > HISTORY) this.history.shift();
    // an Undo offered in a toast is for the change before this one: drop it rather than undo the wrong thing
    if (this.toastAction) this.hideToast();
    this.renderUndo();
  },
  // a step remembered earlier (a drag's start), kept only if the drag changed something
  commit(step) {
    if (!step || JSON.stringify(step.surfaces) === JSON.stringify(this.project.surfaces)) return;
    this.history.push(step);
    if (this.history.length > HISTORY) this.history.shift();
    if (this.toastAction) this.hideToast();
    this.renderUndo();
  },
  snapshot() { return { key: null, t: performance.now(), surfaces: structuredClone(this.project.surfaces), sel: this.editor.sel, pick: this.pickLast ? { ref: this.pickLast, idx: this.pickLast.idx } : null }; },
  clearHistory() { this.history = []; this.renderUndo(); },

  // Shapes go back; what each surface shows stays as it is now (content isn't part of shape editing)
  undo() {
    const step = this.history.pop();
    if (!step) return;
    this.hideToast();
    const now = new Map(this.project.surfaces.map((s) => [s.id, s]));
    this.project.surfaces = step.surfaces.map((s) => (now.has(s.id) ? { ...s, content: now.get(s.id).content } : s));
    const ed = this.editor;
    ed.drag = null; ed.selPin = -1; ed.selVert = null; ed.selMesh = -1;
    ed.sel = step.sel < this.project.surfaces.length ? step.sel : -1;
    // picking on the photo carries on from the shape that's back
    if (step.pick && this.project.surfaces.some((s) => s.id === step.pick.ref.id)) { this.pickLast = step.pick.ref; this.pickLast.idx = step.pick.idx; } else this.pickLast = null;
    if (ed.pick) this.renderPickTune();
    this.changed();
    this.renderUndo();
  },
  renderUndo() { $('undoBtn').disabled = !this.history?.length; },

  // ---------- the bar for the selected surface ----------
  // Small (under half the screen's width) and on the side away from the surface, so it doesn't cover it. A tap on
  // the selected surface hides or shows it; editing carries on either way.
  renderQuickBar() {
    const ed = this.editor, s = this.project.surfaces[ed.sel];
    if (ed.sel !== this.quickFor) { this.quickFor = ed.sel; this.quickHidden = false; }
    const on = !!s && !ed.compose && !this.quickHidden;
    $('quickBar').hidden = !on;
    document.body.classList.toggle('has-quick', on);
    document.querySelectorAll('#quickMode button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === ed.mode)));
    if (!on) return;
    const g = this.geoms[ed.sel];
    if (g) { const cx = g.pins.reduce((a, q) => a + q[0], 0) / 4; $('quickBar').classList.toggle('left', cx > this.frame[0] / 2); }
  },
  toggleQuickBar() { this.quickHidden = !this.quickHidden; this.renderQuickBar(); },

  // the buttons along the top: a tap on empty space with nothing selected hides or shows them
  toggleChrome() { document.body.classList.toggle('chrome-hidden'); this.layoutBars(); },

  // ---------- menus: long press on a surface, the Add button, joining with one of several ----------
  // items: [{ label, fn, danger, off }] at client point [x, y], or below an element
  openMenu(items, at) {
    const m = $('ctxMenu');
    m.innerHTML = '';
    for (const it of items) {
      if (it.sep) { m.appendChild(document.createElement('hr')); continue; }
      const b = document.createElement('button');
      b.setAttribute('role', 'menuitem'); b.textContent = it.label;
      if (it.danger) b.className = 'danger';
      b.disabled = !!it.off;
      b.onclick = () => { this.closeMenu(); it.fn(); };
      m.appendChild(b);
    }
    m.hidden = false;
    let x, y;
    if (at instanceof Element) { const r = at.getBoundingClientRect(); x = r.left; y = r.bottom + 6; if (y + m.offsetHeight > innerHeight - 8) y = r.top - m.offsetHeight - 6; } else [x, y] = [at[0] + 8, at[1] + 8];
    x = Math.max(8, Math.min(x, innerWidth - m.offsetWidth - 8)); y = Math.max(8, Math.min(y, innerHeight - m.offsetHeight - 8));
    Object.assign(m.style, { left: x + 'px', top: y + 'px' });
  },
  closeMenu() { $('ctxMenu').hidden = true; },
  menuOpen() { return !$('ctxMenu').hidden; },

  // a long press (or right click) at frame point p: on a surface, what can be done with it; on nothing, add one there
  surfaceMenu(i, at, p, vert) {
    const ed = this.editor;
    if (i < 0) {
      const add = (shape) => {
        const s = newSurface(shape, this.project.surfaces.length), [W, H] = this.frame;
        const cx = s.pins.reduce((a, q) => a + q[0], 0) / 4, cy = s.pins.reduce((a, q) => a + q[1], 0) / 4;
        s.pins = s.pins.map(([x, y]) => [x + p[0] / W - cx, y + p[1] / H - cy]);
        ed.addSurface(s);
      };
      this.openMenu([{ label: 'Add a square here', fn: () => add('square') }, { label: 'Add a circle here', fn: () => add('circle') }, { label: 'Add a triangle here', fn: () => add('triangle') }], at);
      return;
    }
    const s = this.project.surfaces[i], items = [];
    if (vert || (ed.mode === 'points' && ed.selVert)) items.push({ label: 'Delete this point', fn: () => { if (vert) ed.selVert = vert; const err = ed.deletePoint(); if (err) this.toast(err); } });
    for (const n of this.neighbours(i)) items.push({ label: `Join with surface ${n + 1}`, fn: () => this.join(i, n) });
    const shapes = (op) => () => this.openMenu(['square', 'circle', 'triangle'].map((sh) => ({ label: (op > 0 ? 'Add a ' : 'Cut out a ') + sh, fn: () => ed.addPart(sh, op) })), at);
    const sizes = [0, 2, 3, 4, 6, 8], now = s.mesh ? s.mesh.n[0] : 0;
    items.push(
      { label: 'Looks…', fn: () => this.setTray(true) },
      { label: 'Soft edge…', fn: () => this.setEdgeBar(true) },
      { label: 'Bend grid…', fn: () => this.openMenu(sizes.map((n) => ({ label: (n === now ? '● ' : '') + (n ? `${n} × ${n}` : 'Off (flat)'), fn: () => { if (n !== now) this.setMesh(s, n); if (n) this.setMode('mesh'); } })), at) },
      { label: 'Add a shape to it…', fn: shapes(1) },
      { label: 'Cut a shape out…', fn: shapes(-1) },
      { label: 'Duplicate', fn: () => ed.duplicateSurface() },
      { sep: true },
      { label: 'Delete surface', danger: true, fn: () => ed.deleteSurface() },
    );
    this.openMenu(items, at);
  },

  openAddMenu(el) {
    const add = (shape) => () => this.addShape(shape);
    const photo = !!this.project.backdrop?.show;
    this.openMenu([
      { label: 'Square', fn: add('square') }, { label: 'Circle', fn: add('circle') }, { label: 'Triangle', fn: add('triangle') },
      { sep: true },
      { label: 'Find with the camera…', fn: () => this.openScan() },
      { label: 'Tap things on the photo', off: !photo, fn: () => this.setPick(true) },
    ], el);
  },

  // a new square, circle or triangle in the middle of the frame
  addShape(shape) {
    if (this.editor.addSurface(newSurface(shape, this.project.surfaces.length))) this.toast('Drag it onto a real surface, then drag its corners into place.');
  },

  setMode(mode) {
    const ed = this.editor, s = this.project.surfaces[ed.sel];
    ed.mode = mode; ed.selVert = null; ed.selPin = -1; ed.selMesh = -1;
    if (mode === 'mesh' && s && !s.mesh) { this.setMesh(s, 3); return; }   // a grid to bend, to start with
    this.changed({ geometry: false, save: false });
  },

  // ---------- joining two surfaces into one ----------
  // surfaces whose outlines touch or overlap surface i's
  neighbours(i) {
    const S = this.project.surfaces;
    if (!S[i]) return [];
    // from the surfaces as they are now: this.geoms only catch up on the next frame
    const gs = S.map((s) => surfaceGeom(s, ...this.frame));
    return gs.map((h, j) => (j !== i && surfacesMeet(gs[i], h) ? j : -1)).filter((j) => j >= 0);
  },

  // surface j joins surface i, which keeps its content
  join(i, j) {
    const S = this.project.surfaces, a = S[i], b = S[j];
    if (!a || !b) return;
    const r = mergeSurfaces(a, b, ...this.frame);
    if (r.error) { this.toast(r.error, 4000); return; }
    this.checkpoint();
    S[i] = r.surface; S.splice(j, 1);
    const at = S.indexOf(r.surface);
    this.editor.select(at);
    this.editor.mode = 'warp';
    this.changed();
    this.toast(`Surfaces ${i + 1} and ${j + 1} are one surface now` + (r.joined ? '.' : ', as two shapes.') + (r.unbent ? ' Its bend grid was reset.' : ''), 6000, { label: 'Undo', fn: () => this.undo() });
  },
};
