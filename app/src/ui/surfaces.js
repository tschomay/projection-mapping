// Surfaces pane: adding and editing surfaces, handle modes, bending, combining, the nudge pad.
// Methods mixed into App (see app.js), so `this` is the app.
import { newSurface, flatMesh, meshEvaluator } from '../geometry.js';
import { $ } from '../env.js';
import { MAX_SURF } from '../renderer.js';

export const surfacesUI = {
  initSurfacesUI() {
    document.querySelectorAll('[data-add]').forEach((b) => {
      b.onclick = () => { if (this.editor.addSurface(newSurface(b.dataset.add, this.project.surfaces.length))) this.toast('Drag it onto a real surface, then drag its corners into place.'); };
    });
    document.querySelectorAll('#modeSeg button').forEach((b) => { b.onclick = () => {
      const ed = this.editor, s = this.project.surfaces[ed.sel];
      ed.mode = b.dataset.mode; ed.selVert = null; ed.selPin = -1; ed.selMesh = -1;
      if (ed.mode === 'mesh' && s && !s.mesh) { this.setMesh(s, 3); return; }   // a grid to bend, to start with
      this.changed({ geometry: false, save: false });
    }; });
    $('meshSize').onchange = (e) => { const s = this.project.surfaces[this.editor.sel]; if (s) this.setMesh(s, +e.target.value); };
    $('feather').oninput = (e) => { const s = this.project.surfaces[this.editor.sel]; if (s) { s.feather = +e.target.value; $('featherOut').textContent = s.feather + ' px'; this.changed(); } };
    $('partAdd').onclick = () => this.editor.addPart($('partShape').value, 1);
    $('partCut').onclick = () => this.editor.addPart($('partShape').value, -1);
    $('delPoint').onclick = () => { const err = this.editor.deletePoint(); if (err) this.toast(err); };
    $('dupSurface').onclick = () => this.editor.duplicateSurface();
    $('delSurface').onclick = () => this.editor.deleteSurface();
    $('snap').onchange = (e) => { this.editor.snap = this.project.settings.snap = e.target.checked; this.scheduleSave(); };

    // nudge pad
    let step = 1;
    $('nudgeStep').onclick = () => { step = step === 1 ? 10 : 1; $('nudgeStep').textContent = step + 'px'; };
    document.querySelectorAll('[data-nudge]').forEach((b) => {
      const [dx, dy] = b.dataset.nudge.split(',').map(Number);
      let rep = 0;
      const go = () => this.editor.nudge(dx * step, dy * step);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); go(); rep = setTimeout(function again() { go(); rep = setTimeout(again, 60); }, 400); });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => clearTimeout(rep));
    });
  },

  renderSurfaceUI() {
    const list = $('surfaceList'), ed = this.editor;
    list.innerHTML = '';
    this.project.surfaces.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'chip'; b.textContent = 'Surface ' + (i + 1);
      b.setAttribute('aria-pressed', String(i === ed.sel));
      b.onclick = () => ed.select(i);
      list.appendChild(b);
    });
    if (!this.project.surfaces.length) list.innerHTML = '<span class="note">None yet. Add one above.</span>';
    // the renderer has fixed room; say so rather than quietly not drawing something
    const lim = this.overLimit;
    $('limitNote').hidden = !lim;
    if (lim) $('limitNote').textContent = lim.surfaces < lim.of
      ? `Only the first ${MAX_SURF} surfaces can be shown; surfaces ${MAX_SURF + 1} to ${lim.of} aren't projected. Delete or combine some.`
      : `Too many shapes or outline points to show them all: ${lim.droppedParts} shape${lim.droppedParts === 1 ? ' isn\'t' : 's aren\'t'} projected. Delete some combined shapes, or use a smaller bend grid.`;
    document.querySelectorAll('#modeSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === ed.mode)));
    const has = ed.sel >= 0;
    for (const id of ['partAdd', 'partCut', 'dupSurface', 'delSurface']) $(id).disabled = !has;
    $('delPoint').disabled = !(has && ed.mode === 'points' && ed.selVert);
    const s = this.project.surfaces[ed.sel];
    $('meshSize').disabled = $('feather').disabled = !has;
    $('meshSize').value = s && s.mesh ? String(s.mesh.n[0]) : '0';
    $('feather').value = s ? s.feather || 0 : 0;
    $('featherOut').textContent = (s ? s.feather || 0 : 0) + ' px';
    $('modeHint').textContent = !has ? 'Tap a surface to select it.'
      : ed.mode === 'warp' ? 'Drag the four corner dots onto the real surface\'s corners. Drag inside to move it.'
      : ed.mode === 'mesh' ? 'Set the corners first. Then drag the grid points so the outline and content follow a curved or bowed surface.'
      : 'Drag a square to move a point. Drag a ring on an edge to add one. Double-tap a point to remove it. Drag inside a shape to move just that shape.';
    this.renderNudge();
  },

  // give a surface an n x n bend grid (keeping its current shape), or none
  setMesh(s, n) {
    if (!n) { delete s.mesh; if (this.editor.mode === 'mesh') this.editor.mode = 'warp'; }
    else {
      const old = s.mesh, m = flatMesh(n, n);
      if (old) { const f = meshEvaluator(old); m.pts = m.pts.map(([u, v]) => f(u, v)); }
      s.mesh = m;
    }
    this.editor.selMesh = -1;
    this.changed();
  },

  renderNudge() {
    const t = this.editor && !document.body.classList.contains('show') ? this.editor.nudgeTarget() : '';
    const pad = $('nudge');
    pad.hidden = !t;
    if (t) { $('nudgeLabel').textContent = 'Nudge ' + t; pad.style.left = ''; }
  },
};
