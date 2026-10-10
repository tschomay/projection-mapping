// Content pane: effects (built-in, AI-written and ISF), the user's videos and images, how media sits on a surface,
// and arranging the composition across surfaces.
// Methods mixed into App (see app.js), so `this` is the app.
import { MAX_MEDIA } from '../renderer.js';
import { EFFECTS } from '../effects.js';
import { generateEffect, describeSurfaces, getKey, setKey, keyKind, claudePlan, namespaced } from '../ai.js';
import { toISF, fromISF, isfFilename } from '../isf.js';
import { $ } from '../env.js';

export const contentUI = {
  initContentUI() {
    $('effectList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-effect]'); if (!b) return;
      if (e.target.closest('[data-del]')) { this.deleteEffect(b.dataset.effect); return; }
      this.setContent({ kind: 'effect', effect: b.dataset.effect });
    });
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

  renderEffectList() {
    const own = this.project.effects || [];
    const esc = (t) => String(t).replace(/[<&"]/g, '');
    let group = '';
    $('effectList').innerHTML = EFFECTS.map((e) => {
      const head = (e.group || '') !== group && (group = e.group || '') ? `<span class="chip-group">${group}</span>` : '';
      return head + `<button class="chip" data-effect="${e.id}">${e.name}</button>`;
    }).join('') +
      own.map((e) => `<span class="chip own" data-effect="${e.id}" role="button" tabindex="0" title="${esc(e.prompt || '')}">✦ ${esc(e.name)}<button data-del aria-label="Delete ${esc(e.name)}">×</button></span>`).join('');
    this.renderContentUI();
  },

  deleteEffect(id) {
    this.project.effects = (this.project.effects || []).filter((e) => e.id !== id);
    for (const s of this.project.surfaces) if (s.content?.effect === id) s.content = { kind: 'effect', effect: 'outline' };
    this.changed(); this.renderEffectList();
  },

  initAI() {
    const status = $('aiStatus');
    this.aiPlan = null;   // the viewer's Claude plan, when running as a Claude artifact
    this.aiReady = () => !!(this.aiPlan || getKey());
    const showKey = () => {
      const k = getKey(), plan = !!this.aiPlan;
      $('aiKeyRow').hidden = plan || !!k; $('aiKeyForget').hidden = plan || !k; $('aiKeyNote').hidden = plan; $('aiPlanNote').hidden = !plan;
      $('aiGo').disabled = !this.aiReady();
      $('aiGo').textContent = !plan && keyKind(k) === 'gemini' ? 'Write it with Gemini' : 'Write it with Claude';
    };
    $('aiKeySave').onclick = () => {
      const k = $('aiKey').value.trim();
      if (!keyKind(k)) { status.textContent = "That doesn't look like an API key. Gemini keys start with AIza, Anthropic keys with sk-ant-."; return; }
      setKey(k); $('aiKey').value = ''; showKey(); status.textContent = 'Key saved on this device.';
    };
    $('aiKeyForget').onclick = () => { setKey(''); showKey(); status.textContent = 'Key removed from this device.'; };
    $('aiGo').onclick = () => this.runAI();
    $('aiCancel').onclick = () => this.aiAbort?.abort();
    showKey();
    claudePlan().then((sample) => { if (sample) { this.aiPlan = sample; showKey(); } });
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
        sample: this.aiPlan, apiKey: getKey(), request, signal: this.aiAbort.signal,
        context: describeSurfaces(this.project.surfaces, this.geoms, this.frame),
        compile: (code) => this.renderer.tryEffect(id, namespaced(id, code)),
        progress: (t) => { status.textContent = t; },
      });
      const name = request.length > 28 ? request.slice(0, 27).trim() + '…' : request;
      (this.project.effects ||= []).push({ id, name, prompt: request, code: res.code });
      // show it on the selected surface, or on all of them
      const targets = this.editor.sel >= 0 ? [this.project.surfaces[this.editor.sel]] : this.project.surfaces;
      const before = targets.map((s) => s.content);
      for (const s of targets) s.content = { kind: 'effect', effect: id };
      this.changed(); this.renderEffectList();
      status.textContent = (res.note || 'Done.') + (res.repaired ? ' (Fixed a compile error on the way.)' : '');
      this.watchFrameRate(() => { targets.forEach((s, i) => { s.content = before[i]; }); this.changed(); }, name);
    } catch (err) {
      status.textContent = err.message;
    } finally {
      $('aiGo').disabled = !this.aiReady(); $('aiCancel').hidden = true;
    }
  },

  // ISF files (roadmap #10): export the selected surface's effect, import a generator as one of the project's effects
  initISF() {
    $('exportISF').onclick = () => {
      const s = this.project.surfaces[this.editor.sel], c = s?.content;
      if (!c || c.kind !== 'effect') { this.toast('Select a surface that shows an effect, then export it.'); return; }
      const e = EFFECTS.find((x) => x.id === (c.effect || 'outline')) || (this.project.effects || []).find((x) => x.id === c.effect);
      if (!e) return;
      this.download(isfFilename(e.name), toISF(e), 'text/plain');
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
      delete s.input; this.changed();
    };
  },

  setCompose(on) {
    const ed = this.editor;
    if (on && !this.project.surfaces.length) { this.toast('Add a surface first.'); return; }
    ed.compose = on; ed.drag = null;
    $('composeBar').hidden = !on;
    $('composeBtn').setAttribute('aria-pressed', String(on));
    if (on) { this.toggleDrawer(false); if (ed.sel < 0) ed.select(0); }
    this.renderNudge();
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
    document.querySelectorAll('#effectList .chip').forEach((b) => b.setAttribute('aria-pressed', String(c.kind === 'effect' && c.effect === b.dataset.effect)));
    document.querySelectorAll('#mediaList .chip').forEach((b) => b.setAttribute('aria-pressed', String(c.kind === 'media' && c.mediaId === b.dataset.media)));
    $('mediaOpts').hidden = c.kind !== 'media';
    document.querySelectorAll('#fitSeg button').forEach((b) => b.setAttribute('aria-pressed', String((c.fit || 'fill') === b.dataset.fit)));
    document.querySelectorAll('#spaceSeg button').forEach((b) => b.setAttribute('aria-pressed', String((c.space || 'surface') === b.dataset.space)));
    $('applyAll').disabled = !s;
    const over = this.project.surfaces.filter((x) => x.content?.kind === 'media').map((x) => x.content.mediaId);
    if (new Set(over).size > MAX_MEDIA) this.toast(`Up to ${MAX_MEDIA} different videos or images can show at once.`);
  },

  renderMediaUI() {
    const list = $('mediaList');
    list.innerHTML = '';
    const visual = this.media.list().filter((m) => m.kind !== 'audio' && m.id !== this.project.backdrop?.mediaId);
    for (const m of visual) {
      const b = document.createElement('button');
      b.className = 'chip'; b.textContent = (m.kind === 'video' ? 'Video: ' : 'Image: ') + m.name; b.dataset.media = m.id;
      b.onclick = () => this.setContent({ kind: 'media', mediaId: m.id, fit: 'fill', space: 'surface' });
      list.appendChild(b);
    }
    if (!visual.length) list.innerHTML = '<span class="note">Nothing added yet.</span>';
    this.renderContentUI();
    this.renderSoundUI();
    $('playBtn').hidden = !this.media.list().some((m) => m.kind !== 'image');
  },
};
