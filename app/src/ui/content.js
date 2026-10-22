// Content pane: effects (built-in, AI-written and ISF), the user's videos and images, how media sits on a surface,
// and arranging the composition across surfaces.
// Methods mixed into App (see app.js), so `this` is the app.
import { MAX_MEDIA } from '../renderer.js';
import { EFFECTS } from '../effects.js';
import { generateEffect, describeSurfaces, getKey, setKey, keyKind, namespaced, effectName } from '../ai.js';
import { writerPacket, readEffectLink, WRITER_URL } from '../share.js';
import { toISF, fromISF, isfFilename } from '../isf.js';
import { $ } from '../env.js';

export const contentUI = {
  initContentUI() {
    this.renderEffectList();
    this.initAI();
    this.initISF();
    this.initCompose();
    $('addMedia').onchange = async (e) => {
      for (const f of e.target.files) {
        try { const m = await this.media.add(f); if (this.editor.sel >= 0) this.setContent({ kind: 'media', mediaId: m.id, fit: 'fill', space: 'surface' }); } catch (err) { this.toast(err.message); }
      }
      e.target.value = '';
    };
    document.querySelectorAll('#fitSeg button').forEach((b) => { b.onclick = () => this.setContent({ fit: b.dataset.fit }, true); });
    document.querySelectorAll('#spaceSeg button').forEach((b) => { b.onclick = () => this.setContent({ space: b.dataset.space }, true); });
    $('applyAll').onclick = () => {
      const s = this.project.surfaces[this.editor.sel] || this.project.surfaces[0];
      if (!s) return;
      for (const t of this.project.surfaces) t.content = { ...s.content };
      this.changed();
      this.toast('Every surface now shows the same content.');
    };
  },

  // the effects (built in and the project's own) are shown in the content tray (tray.js)
  renderEffectList() {
    this.buildTray();
    this.renderContentUI();
  },

  deleteEffect(id) {
    this.project.effects = (this.project.effects || []).filter((e) => e.id !== id);
    this.thumbs.forget('fx:' + id);
    for (const s of this.project.surfaces) if (s.content?.effect === id) s.content = { kind: 'effect', effect: 'outline' };
    this.changed(); this.renderEffectList();
  },

  initAI() {
    const status = $('aiStatus');
    // with a key the effect is written here; without one, Claude writes it in the writer (share.js)
    const showKey = () => {
      const k = getKey();
      $('aiKeyRow').hidden = !!k; $('aiKeyForget').hidden = !k;
      $('aiGo').textContent = keyKind(k) === 'gemini' ? 'Write it with Gemini' : 'Write it with Claude';
    };
    $('aiKeySave').onclick = () => {
      const k = $('aiKey').value.trim();
      if (!keyKind(k)) { status.textContent = "That doesn't look like an API key. Gemini keys start with AIza, Anthropic keys with sk-ant-."; return; }
      setKey(k); $('aiKey').value = ''; showKey(); status.textContent = 'Key saved on this device.';
    };
    $('aiKeyForget').onclick = () => { setKey(''); showKey(); status.textContent = 'Key removed from this device.'; };
    $('aiGo').onclick = () => (getKey() ? this.runAI() : this.handToWriter());
    $('aiCancel').onclick = () => this.aiAbort?.abort();
    showKey();
    this.takeEffectLink();
  },

  // Claude on the viewer's own plan, in the writer: copy the request (a claude.ai link can't carry it), open the
  // writer, and the viewer pastes it there. Copied and opened in the same tap, while the browser allows both.
  handToWriter() {
    const request = $('aiPrompt').value.trim(), status = $('aiStatus');
    if (!request) { status.textContent = 'Describe the look first, for example "slow blue waves that flash on the beat".'; return; }
    if (!this.project.surfaces.length) { status.textContent = 'Add a surface first.'; return; }
    const sel = this.project.surfaces[this.editor.sel];
    const text = writerPacket({
      request, context: describeSurfaces(this.project.surfaces, this.geoms, this.frame), frame: this.frame,
      surfaces: this.project.surfaces, target: sel ? [sel.id] : null, back: location.origin + location.pathname,
    });
    this.save();   // the effect comes back to another copy of this page, which opens the saved project
    const copied = navigator.clipboard?.writeText(text) || Promise.reject(new Error('no clipboard'));
    window.open(WRITER_URL, '_blank', 'noopener');
    $('aiPacket').hidden = true;
    copied.then(() => {
      status.textContent = 'Copied. In Claude, long-press the box and Paste. When the look is right, tap Add to Surface Mapper.';
    }, () => {
      $('aiPacket').hidden = false; $('aiPacket').value = text; $('aiPacket').select();
      status.textContent = "Couldn't copy by itself. Copy all of the text below, then paste it in Claude.";
    });
  },

  // an effect arriving from the writer in #fx=: added to the open project, which is saved at once (another tab of
  // the app takes the saved copy when it's next shown, see catchUp)
  async takeEffectLink() {
    if (!location.hash.startsWith('#fx=')) return;
    const hash = location.hash;
    history.replaceState(null, '', location.pathname + location.search);
    let fx;
    try { fx = await readEffectLink(hash); } catch (err) { this.toast(err.message, 5000); return; }
    await this.opening;
    if (this.addEffect(fx)) this.save();
  },

  // add a written effect to the project and show it: on the surfaces it was written for, else the selected
  // surface, or all of them
  // id: when it's already been compiled here under that id. Returns whether it was added.
  addEffect({ name, prompt, code, target }, { id = null, quiet = false } = {}) {
    if (!id) {
      id = 'u' + Math.random().toString(36).slice(2, 8);
      const log = this.renderer.tryEffect(id, namespaced(id, code));
      if (log) { this.toast(`"${name}" doesn't compile here: ${log.split('\n').find((l) => l.trim()) || log}`, 6000); return false; }
    }
    (this.project.effects ||= []).push({ id, name, prompt, code });
    const surfaces = this.project.surfaces, picked = (target || []).map((t) => surfaces.find((s) => s.id === t)).filter(Boolean);
    const targets = picked.length ? picked : this.editor.sel >= 0 ? [surfaces[this.editor.sel]] : surfaces;
    const before = targets.map((s) => s.content);
    for (const s of targets) s.content = { kind: 'effect', effect: id };
    this.changed(); this.renderEffectList();
    const where = targets.length === surfaces.length ? 'every surface' : targets.length === 1 ? `surface ${surfaces.indexOf(targets[0]) + 1}` : `${targets.length} surfaces`;
    if (!quiet) this.toast(`"${name}" is on ${where}. It's in Looks, under Yours.`, 5000);
    this.watchFrameRate(() => { targets.forEach((s, i) => { s.content = before[i]; }); this.changed(); }, name);
    return true;
  },

  async runAI() {
    const request = $('aiPrompt').value.trim(), status = $('aiStatus');
    if (!request) { status.textContent = 'Describe the look first, for example "slow blue waves that flash on the beat".'; return; }
    if (!this.project.surfaces.length) { status.textContent = 'Add a surface first.'; return; }
    const id = 'u' + Math.random().toString(36).slice(2, 8);
    this.aiAbort = new AbortController();
    $('aiGo').disabled = true; $('aiCancel').hidden = false;
    try {
      const res = await generateEffect({
        apiKey: getKey(), request, signal: this.aiAbort.signal,
        context: describeSurfaces(this.project.surfaces, this.geoms, this.frame),
        compile: (code) => this.renderer.tryEffect(id, namespaced(id, code)),
        progress: (t) => { status.textContent = t; },
      });
      const sel = this.project.surfaces[this.editor.sel];
      this.addEffect({ name: effectName(request), prompt: request, code: res.code, target: sel ? [sel.id] : null }, { id, quiet: true });
      status.textContent = (res.note || 'Done.') + (res.repaired ? ' (Fixed a compile error on the way.)' : '');
    } catch (err) {
      status.textContent = err.message;
    } finally {
      $('aiGo').disabled = false; $('aiCancel').hidden = true;
    }
  },

  // ISF files (roadmap #10): export the selected surface's effect, import a generator as one of the project's effects
  initISF() {
    $('exportISF').onclick = () => {
      const s = this.project.surfaces[this.editor.sel], c = s?.content;
      if (!c || c.kind !== 'effect') { this.toast('Select a surface that shows an effect, then export it.'); return; }
      const e = EFFECTS.find((x) => x.id === (c.effect || 'outline')) || (this.project.effects || []).find((x) => x.id === c.effect);
      if (!e) return;
      this.download(isfFilename(e.name), toISF(e, c.params), 'text/plain');
      this.toast(`"${e.name}" saved as an ISF file, for MadMapper, VDMX, Resolume and other VJ apps.`, 4000);
    };
    $('importISF').onchange = async (ev) => {
      const f = ev.target.files[0]; ev.target.value = '';
      if (!f) return;
      try {
        const { name, code } = fromISF(await f.text(), f.name);
        const id = 'u' + Math.random().toString(36).slice(2, 8);
        const log = this.renderer.tryEffect(id, namespaced(id, code));
        if (log) throw new Error(`"${f.name}" doesn't compile here: ${log.split('\n').find((l) => l.trim()) || log}`);
        (this.project.effects ||= []).push({ id, name, prompt: `Imported from ${f.name}`, code, source: 'isf' });
        const s = this.project.surfaces[this.editor.sel];
        if (s) s.content = { kind: 'effect', effect: id };
        this.changed(); this.renderEffectList();
        this.toast(`Imported "${name}"${s ? ` onto surface ${this.editor.sel + 1}` : ''}. It's in the effect list with a ✦.`, 4000);
        if (s) this.watchFrameRate(() => { s.content = { kind: 'effect', effect: 'outline' }; this.changed(); }, name);
      } catch (err) { this.toast(err.message, 6000); }
    };
  },

  // the composition canvas (roadmap #7): which rectangle of the frame-wide content each surface shows
  initCompose() {
    $('composeBtn').onclick = () => this.setCompose(!this.editor.compose);
    $('composeDone').onclick = () => this.setCompose(false);
    $('composeReset').onclick = () => {
      const s = this.project.surfaces[this.editor.sel];
      if (!s) { this.toast('Select a surface first.'); return; }
      this.checkpoint(); delete s.input; this.changed();
    };
  },

  setCompose(on) {
    const ed = this.editor;
    if (on && !this.project.surfaces.length) { this.toast('Add a surface first.'); return; }
    if (on && ed.pick) this.setPick(false);
    ed.compose = on; ed.drag = null;
    $('composeBar').hidden = !on;
    $('composeBtn').setAttribute('aria-pressed', String(on));
    if (on) { this.toggleDrawer(false); if (ed.sel < 0) ed.select(0); }
    this.changed({ geometry: false, save: false });
  },

  // what to draw under the rectangles while arranging: the frame-wide video or image on the selected surface, or any
  composeSource() {
    const looks = [this.project.surfaces[this.editor.sel]?.content].concat(this.project.surfaces.map((s) => s.content));
    const c = looks.find((l) => l && l.kind === 'media' && l.space === 'frame' && this.media.get(l.mediaId)?.kind !== 'audio');
    return c ? { el: this.media.get(c.mediaId).el, fit: c.fit || 'fill' } : null;
  },

  // guardrail: if a new effect makes the frame rate collapse, put the previous look back
  watchFrameRate(revert, name) {
    const before = this.fps || 60;
    setTimeout(() => {
      if (this.fps < 20 && before > 35) { revert(); this.toast(`"${name}" was too heavy for this device, so the previous look is back. It stays in the effect list.`, 5000); }
    }, 3000);
  },

  setContent(patch, merge = false) {
    const s = this.project.surfaces[this.editor.sel];
    if (!s) { this.toast('Select a surface first: tap it in the frame or in the Surfaces list.'); return; }
    s.content = merge ? { ...s.content, ...patch } : patch;
    if (s.content.kind === 'media') { const m = this.media.get(s.content.mediaId); if (m && m.kind === 'video' && this.playing) m.el.play().catch(() => {}); }
    this.changed();
  },

  renderContentUI() {
    const s = this.project.surfaces[this.editor.sel];
    $('contentTarget').textContent = s ? `Choosing what surface ${this.editor.sel + 1} shows.` : 'Select a surface to choose what it shows.';
    const c = s ? s.content || {} : {};
    $('mediaOpts').hidden = c.kind !== 'media';
    document.querySelectorAll('#fitSeg button').forEach((b) => b.setAttribute('aria-pressed', String((c.fit || 'fill') === b.dataset.fit)));
    document.querySelectorAll('#spaceSeg button').forEach((b) => b.setAttribute('aria-pressed', String((c.space || 'surface') === b.dataset.space)));
    $('applyAll').disabled = !s;
    const over = this.project.surfaces.filter((x) => x.content?.kind === 'media').map((x) => x.content.mediaId);
    // said once as the limit is passed, not again on every change (a drag changes things on every move)
    const tooMany = new Set(over).size > MAX_MEDIA;
    if (tooMany && !this.mediaOver) this.toast(`Up to ${MAX_MEDIA} different videos or images can show at once.`);
    this.mediaOver = tooMany;
    this.renderTrayState();
  },

  // the videos and images are in the content tray too
  renderMediaUI() {
    this.buildTray();
    this.renderContentUI();
    this.renderSoundUI();
    $('playBtn').hidden = !this.media.list().some((m) => m.kind !== 'image');
  },
};
