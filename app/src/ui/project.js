// Project pane: projects, import and export, the design photo, the device check, connecting the projector.
// Methods mixed into App (see app.js), so `this` is the app.
import { deviceReport, cameraReport, reportText } from '../diagnostics.js';
import { $ } from '../env.js';
import * as store from '../store.js';

export const projectUI = {
  initProjectUI() {
    $('projName').onchange = (e) => { this.project.name = e.target.value.trim() || 'Untitled mapping'; this.scheduleSave(); };
    $('projList').onchange = (e) => { const p = store.loadProject(e.target.value); if (p) this.openProject(p); };
    $('newProj').onclick = () => { this.save(); this.openProject(store.newProject()); this.save(); this.toast('New project started.'); };
    $('delProj').onclick = () => {
      if (!this.confirmPending) { this.confirmPending = true; $('delProj').textContent = 'Tap again to delete'; setTimeout(() => { this.confirmPending = false; $('delProj').textContent = 'Delete'; }, 3000); return; }
      this.confirmPending = false; $('delProj').textContent = 'Delete';
      store.deleteProject(this.project.id);
      const idx = store.listProjects();
      this.openProject((idx.current && store.loadProject(idx.current)) || store.newProject());
      this.toast('Project deleted.');
    };
    $('exportProj').onclick = () => this.exportProject();
    $('importProj').onchange = async (e) => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try { const p = store.parseProject(await f.text()); await this.openProject(p); this.save(); this.toast(`Imported "${p.name}".`); } catch (err) { this.toast(err.message || "That file couldn't be read."); }
    };
    $('openOutput').onclick = async () => {
      this.output.win = window.open(location.href.split('#')[0] + '#output', 'pm-output', await this.outputFeatures());
      if (!this.output.win) this.toast('The browser blocked the output window. Allow pop-ups for this page.');
    };
    this.initBackdrop();
    this.initCheck();

    // how to connect: a guide sheet, opened by itself the first time the app runs
    const sheet = $('connectSheet');
    for (const id of ['connectBtn', 'connectBtn2']) $(id).onclick = () => sheet.showModal();
    $('closeConnect').onclick = () => sheet.close();
    sheet.addEventListener('close', () => store.setFlag('connectSeen'));
    if (!store.getFlag('connectSeen') && sheet.showModal) sheet.showModal();
  },

  async exportProject() {
    this.save();
    const text = JSON.stringify(this.project, null, 2);
    const filename = (this.project.name || 'mapping').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + '.json';
    // inside a Claude artifact, downloads go through the platform; elsewhere a plain download link works
    try {
      const dl = window.claude && (await window.claude.use('downloads'));
      if (dl) { await dl.save({ filename, data: text }); return; }
    } catch { /* fall through */ }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  },

  renderProjectList() {
    const idx = store.listProjects(), sel = $('projList');
    const list = idx.list.some((p) => p.id === this.project.id) ? idx.list : idx.list.concat([{ id: this.project.id, name: this.project.name }]);
    sel.innerHTML = list.map((p) => `<option value="${p.id}">${(p.name || 'Untitled').replace(/[<&"]/g, '')}</option>`).join('');
    sel.value = this.project.id;
  },

  renderOutputState() {
    $('outputState').textContent = this.presenting ? 'Presenting to a second screen' : this.output.connected ? 'Output window connected' : '';
    $('presentBtn').textContent = this.presenting ? 'Stop presenting' : 'Present to a screen';
    if (this.presenting) $('presentBtn').disabled = false;
  },

  initBackdrop() {
    $('addBackdrop').onchange = async (e) => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try {
        const m = await this.media.add(f);
        if (m.kind !== 'image') { this.media.remove(m.id); throw new Error('Pick a photo (an image file).'); }
        const old = this.project.backdrop;
        this.project.backdrop = { mediaId: m.id, show: true, dim: old?.dim ?? 0.6 };
        if (old && old.mediaId !== m.id && !this.isUsed(old.mediaId)) this.media.remove(old.mediaId);
        this.scheduleSave(); this.renderBackdrop(); this.renderMediaUI();
        this.toast('Content now shows as projected light on the photo. Take the photo from where the projector will stand.', 4500);
      } catch (err) { this.toast(err.message); }
    };
    $('backdropShow').onchange = (e) => { if (this.project.backdrop) { this.project.backdrop.show = e.target.checked; this.scheduleSave(); this.renderBackdrop(); } };
    $('backdropDim').oninput = (e) => { if (this.project.backdrop) { this.project.backdrop.dim = +e.target.value; this.scheduleSave(); this.renderBackdrop(); } };
    $('removeBackdrop').onclick = () => {
      const b = this.project.backdrop; if (!b) return;
      this.project.backdrop = null;
      if (!this.isUsed(b.mediaId)) this.media.remove(b.mediaId);
      this.scheduleSave(); this.renderBackdrop(); this.renderMediaUI();
    };
  },

  renderBackdrop() {
    const b = this.project.backdrop, m = b && this.media.get(b.mediaId), img = $('backdrop');
    const on = !!(m && b.show);
    if (on && img.getAttribute('src') !== m.url) img.src = m.url;
    img.hidden = !on;
    img.style.filter = `brightness(${b ? b.dim : 0.6})`;
    document.body.classList.toggle('photo', on);
    $('backdropOpts').hidden = !b;
    if (b) { $('backdropShow').checked = b.show; $('backdropDim').value = b.dim; }
  },

  initCheck() {
    const sheet = $('checkSheet');
    let rows = [];
    const draw = () => {
      $('checkList').innerHTML = rows.map((r) => `<li class="${r.ok === true ? 'yes' : r.ok === false ? 'no' : 'info'}"><b>${r.label}</b><span>${String(r.value).replace(/[<&]/g, '')}</span></li>`).join('');
      $('checkPersist').hidden = !rows.some((r) => r.action === 'persist');
    };
    const refresh = async () => { rows = (await deviceReport(this)).concat(rows.filter((r) => r.camera)); draw(); };
    $('checkBtn').onclick = () => { this.toggleDrawer(false); sheet.showModal(); refresh(); };
    $('closeCheck').onclick = () => sheet.close();
    $('checkCamera').onclick = async () => {
      $('checkCamera').disabled = true;
      const cam = (await cameraReport(this.camera)).map((r) => ({ ...r, camera: true }));
      rows = rows.filter((r) => !r.camera).concat(cam); draw();
      $('checkCamera').disabled = false;
    };
    $('checkPersist').onclick = async () => {
      const ok = await navigator.storage.persist().catch(() => false);
      this.toast(ok ? 'This browser will keep your files.' : 'The browser said no. Installing the app to the home screen usually helps.');
      refresh();
    };
    $('checkCopy').onclick = async () => {
      try { await navigator.clipboard.writeText(reportText(rows)); this.toast('Report copied.'); } catch { this.toast("Couldn't copy here; take a screenshot instead."); }
    };
  },
};
