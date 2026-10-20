// Surfaces pane and the shape tools reached from the frame: bending, the soft edge, combining shapes.
// The pane keeps only what the frame can't do (a setting, a warning, how the gestures work); everything else is in
// the bar for the selected surface and its menu (edit.js).
// Methods mixed into App (see app.js), so `this` is the app.
import { flatMesh, meshEvaluator } from '../geometry.js';
import { $ } from '../env.js';
import { MAX_SURF } from '../renderer.js';

export const surfacesUI = {
  initSurfacesUI() {
    document.querySelectorAll('#quickMode button').forEach((b) => { b.onclick = () => this.setMode(b.dataset.mode); });
    $('snap').onchange = (e) => { this.editor.snap = this.project.settings.snap = e.target.checked; this.scheduleSave(); };
    $('feather').oninput = (e) => { const s = this.project.surfaces[this.editor.sel]; if (s) { this.checkpoint('feather'); s.feather = +e.target.value; $('featherOut').textContent = s.feather + ' px'; this.changed(); } };
    $('edgeDone').onclick = () => this.setEdgeBar(false);
  },

  // runs on every change, so it stays small
  renderSurfaceUI() {
    // the renderer has fixed room; say so rather than quietly not drawing something
    const lim = this.overLimit, note = $('limitNote');
    note.hidden = !lim;
    if (lim) note.textContent = lim.surfaces < lim.of
      ? `Only the first ${MAX_SURF} surfaces can be shown; surfaces ${MAX_SURF + 1} to ${lim.of} aren't projected. Delete or combine some.`
      : `Too many shapes or outline points to show them all: ${lim.droppedParts} shape${lim.droppedParts === 1 ? ' isn\'t' : 's aren\'t'} projected. Delete some combined shapes, or use a smaller bend grid.`;
    if (!$('edgeBar').hidden && !this.project.surfaces[this.editor.sel]) this.setEdgeBar(false);
    this.renderQuickBar();
  },

  // the soft edge slider, over the frame so the edge can be watched while it changes
  setEdgeBar(on) {
    const s = this.project.surfaces[this.editor.sel];
    $('edgeBar').hidden = !(on && s);
    if (on && s) { $('feather').value = s.feather || 0; $('featherOut').textContent = (s.feather || 0) + ' px'; }
  },

  // give a surface an n x n bend grid (keeping its current shape), or none
  setMesh(s, n) {
    this.checkpoint();
    if (!n) { delete s.mesh; if (this.editor.mode === 'mesh') this.editor.mode = 'warp'; }
    else {
      const old = s.mesh, m = flatMesh(n, n);
      if (old) { const f = meshEvaluator(old); m.pts = m.pts.map(([u, v]) => f(u, v)); }
      s.mesh = m;
    }
    this.editor.selMesh = -1;
    this.changed();
  },
};
