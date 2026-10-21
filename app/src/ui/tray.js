// The content tray: every look (effects, the project's own effects, the user's videos and images) as a live tile.
// A tap puts it on the selected surface, or on all of them, and it shows on the projector straight away.
// Portrait: a strip along the bottom with search, the groups and one row of tiles. Landscape: a rail down one side
// that scrolls as a whole; only the surface's name and closing it stay put.
// The previews are drawn on a canvas inside the tiles' scrolling area, so they move with the tiles as they scroll.
// Methods mixed into App (see app.js), so `this` is the app.
import { EFFECTS, LOOK_GROUPS, movesToMusic, flowsAcross } from '../effects.js';
import { namespaced } from '../ai.js';
import { Thumbs, previewAudio } from '../thumbs.js';
import { toHex, fromHex } from '../params.js';
import { $ } from '../env.js';

const GROUPS = [...LOOK_GROUPS, 'Yours', 'Videos & images'];
const FPS = 30;
const AHEAD = 160;   // px beyond the visible part of the tray where tiles are drawn, ready to scroll in
const esc = (t) => String(t).replace(/[<&"]/g, (c) => ({ '<': '&lt;', '&': '&amp;', '"': '&quot;' }[c]));

const isWhole = (r) => !!r && r.x === 0 && r.y === 0 && r.w === 1 && r.h === 1;
function keyOf(c) { return !c ? 'fx:outline' : c.kind === 'media' ? 'media:' + c.mediaId : 'fx:' + (c.effect || 'outline'); }

export const trayUI = {
  initTray() {
    this.tray = { all: false, filter: 'All', query: '', tiles: [], last: 0 };
    this.thumbs = new Thumbs($('trayGL'));
    $('trayBtn').onclick = () => this.setTray($('tray').hidden);
    $('trayClose').onclick = () => this.setTray(false);
    $('trayFlip').onclick = () => $('tray').classList.toggle('left');
    document.querySelectorAll('#trayScope button').forEach((b) => { b.onclick = () => { this.tray.all = b.dataset.all === '1'; this.renderTrayState(); }; });
    document.querySelectorAll('#trayScene button').forEach((b) => { b.onclick = () => this.setWholeScene(b.dataset.whole === '1'); });
    $('traySearch').oninput = (e) => { this.tray.query = e.target.value.trim().toLowerCase(); this.filterTray(); };
    // a setting moving: every target surface takes it at once (and the projector shows it), without rebuilding the tray
    const onSetting = (e) => { const el = e.target.closest('[data-p]'); if (el) this.setSetting(el.dataset.p, el); };
    $('trayParamsBody').addEventListener('input', onSetting);
    $('trayParamsBody').addEventListener('change', onSetting);
    $('trayParamsReset').onclick = () => {
      for (const s of this.settingsTargets().surfaces) { const { params, ...rest } = s.content; s.content = rest; }
      this.tray.settingsKey = null; this.settingsChanged();
    };
    $('trayFilters').onclick = (e) => { const b = e.target.closest('[data-g]'); if (b) { this.tray.filter = b.dataset.g; this.filterTray(); } };
    $('trayTiles').addEventListener('click', (e) => {
      const del = e.target.closest('[data-del]');
      if (del) { e.stopPropagation(); this.deleteEffect(del.dataset.del); return; }
      const t = e.target.closest('.tile');
      if (!t) return;
      if (t.dataset.act === 'ai') { this.setTray(false); this.selectTab('content'); this.toggleDrawer(true); $('aiPrompt').focus(); return; }
      if (t.dataset.act === 'media') { $('addMedia').click(); return; }
      const it = this.tray.items.find((x) => x.key === t.dataset.key);
      if (it) this.applyLook(it);
    });
    addEventListener('resize', () => this.layoutTray(true));
    $('trayTiles').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('tile')) { e.preventDefault(); e.target.click(); } });
  },

  setTray(on) {
    if (on && !this.project.surfaces.length) { this.toast('Add a surface first: tap Add.'); return; }
    $('tray').hidden = !on;
    document.body.classList.toggle('tray-open', on);
    $('trayBtn').setAttribute('aria-pressed', String(on));
    // closed, it gives back the previews' graphics memory and its tiles' videos and images (they're rebuilt on opening)
    if (!on) { this.thumbs.release(); $('trayTiles').replaceChildren(this.thumbs.canvas); return; }
    this.toggleDrawer(false); this.closeMenu();
    if (this.editor.sel < 0 && !this.tray.all) this.editor.select(0);
    this.buildTray();
    this.layoutTray(true);
  },

  // This one / All: in the header upright; on its side, it scrolls away with search and the groups
  layoutTray(start = false) {
    if ($('tray').hidden) return;
    const portrait = matchMedia('(orientation: portrait)').matches, scope = $('trayScope');
    if (portrait && scope.parentElement !== $('trayHead')) $('trayClose').before(scope);
    if (!portrait && scope.parentElement !== $('trayFind')) $('trayFind').prepend(scope);
    if (start) $('trayScroll').scrollTop = 0;
    this.sizeTrayGL();
  },

  // the preview canvas covers the whole scrolling area of the tiles (it's drawn only where tiles are on screen)
  sizeTrayGL() {
    const tiles = $('trayTiles'), c = this.thumbs.canvas;
    c.style.width = '0px'; c.style.height = '0px';
    c.style.width = tiles.scrollWidth + 'px'; c.style.height = tiles.scrollHeight + 'px';
  },

  trayItems() {
    const list = [];
    for (const e of EFFECTS) list.push({ key: 'fx:' + e.id, kind: 'effect', id: e.id, name: e.name, group: e.group, about: e.about || '', code: e.code, fn: 'fx_' + e.id });
    for (const e of this.project.effects || []) list.push({ key: 'fx:' + e.id, kind: 'effect', id: e.id, name: e.name, group: 'Yours', own: true, about: e.prompt || '', code: namespaced(e.id, e.code), fn: 'fx_' + e.id });
    for (const m of this.media.list()) {
      if (m.kind === 'audio' || m.id === this.project.backdrop?.mediaId) continue;
      list.push({ key: 'media:' + m.id, kind: 'media', id: m.id, name: m.name, group: 'Videos & images', media: m, about: m.kind === 'video' ? 'Your video.' : 'Your image.' });
    }
    // grouped, in the groups' order (sort is stable, so each group keeps its own order)
    list.sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group));
    list.forEach((it, i) => {
      it.idx = i;
      it.music = it.kind === 'effect' && movesToMusic(it.code);
      it.wide = it.kind === 'effect' && flowsAcross(it.code);
    });
    return list;
  },

  // tiles for every look; rebuilt when effects or media change, not on every selection
  buildTray() {
    if ($('tray').hidden) return;
    const T = this.tray;
    T.items = this.trayItems();
    const groups = GROUPS.filter((g) => T.items.some((it) => it.group === g));
    if (T.filter !== 'All' && !groups.includes(T.filter)) T.filter = 'All';
    $('trayFilters').innerHTML = ['All', ...groups].map((g) => `<button class="chip" data-g="${g}">${g}</button>`).join('');
    let html = '', g = '';
    for (const it of T.items) {
      if (it.group !== g) { g = it.group; html += `<div class="tray-group" data-group="${esc(g)}">${esc(g)}</div>`; }
      const badges = (it.music ? '<b title="Moves to music">♪</b>' : '') + (it.wide ? '<b title="Flows across surfaces">⇆</b>' : '');
      const thumb = it.kind === 'media'
        ? (it.media.kind === 'video' ? `<video muted playsinline preload="metadata" src="${esc(it.media.url)}#t=0.5"></video>` : `<img alt="" src="${esc(it.media.url)}">`)
        : '';
      html += `<div class="tile" role="button" tabindex="0" data-key="${esc(it.key)}" data-group="${esc(it.group)}" title="${esc(it.about)}">
        <div class="thumb">${thumb}${badges ? `<span class="badges">${badges}</span>` : ''}${it.own ? `<button class="del" data-del="${esc(it.id)}" aria-label="Delete ${esc(it.name)}" title="Delete this effect">×</button>` : ''}</div>
        <span class="name">${esc(it.name)}</span></div>`;
    }
    html += '<div class="tile add" role="button" tabindex="0" data-act="ai" data-group="Yours"><div class="thumb">✦ Describe a look</div><span class="name">AI writes it</span></div>';
    html += '<div class="tile add" role="button" tabindex="0" data-act="media" data-group="Videos & images"><div class="thumb">＋ Video or image</div><span class="name">From this device</span></div>';
    $('trayTiles').innerHTML = html;
    $('trayTiles').prepend(this.thumbs.canvas);
    T.tiles = [...$('trayTiles').querySelectorAll('.tile[data-key]')].map((el) => ({ el, thumb: el.querySelector('.thumb'), item: T.items.find((x) => x.key === el.dataset.key) }));
    this.filterTray();
  },

  filterTray() {
    const T = this.tray, q = T.query;
    document.querySelectorAll('#trayFilters [data-g]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.g === T.filter)));
    const show = (group, text) => (T.filter === 'All' || group === T.filter) && (!q || text.toLowerCase().includes(q));
    for (const t of T.tiles) t.el.hidden = !show(t.item.group, `${t.item.name} ${t.item.about} ${t.item.group}`);
    document.querySelectorAll('#trayTiles .tile.add').forEach((el) => { el.hidden = !show(el.dataset.group, el.textContent) && !(T.filter === 'All' && q); });
    document.querySelectorAll('#trayTiles .tray-group').forEach((h) => { h.hidden = !T.tiles.some((t) => !t.el.hidden && t.item.group === h.dataset.group); });
    this.renderTrayState();
    if (!$('tray').hidden) this.sizeTrayGL();
  },

  // ---------- the look's settings (params.js) ----------
  // the surfaces they apply to: the selected one, or with All every surface showing the same look
  settingsTargets() {
    const sel = this.project.surfaces[this.editor.sel] || (this.tray?.all ? this.project.surfaces[0] : null);
    const c = sel?.content || (sel ? { kind: 'effect', effect: 'outline' } : null);
    if (!c || c.kind === 'media') return { look: null, surfaces: [], values: {} };
    const look = c.effect || 'outline', same = (s) => s.content?.kind !== 'media' && (s.content?.effect || 'outline') === look;
    return { look, surfaces: this.tray?.all ? this.project.surfaces.filter(same) : [sel], values: c.params || {} };
  },

  renderLookSettings() {
    const { look, surfaces, values } = this.settingsTargets(), T = this.tray;
    const params = look ? this.lookParams(look) : [];
    $('trayParams').hidden = !params.length;
    if (!params.length) { T.settingsKey = null; return; }
    // the controls are rebuilt only when the look or its surfaces change, so one being dragged keeps its place
    const key = look + '|' + surfaces.map((s) => s.id).join();
    if (T.settingsKey !== key) {
      T.settingsKey = key;
      const e = this.trayItems().find((it) => it.kind === 'effect' && it.id === look);
      $('trayParamsTitle').textContent = `${e ? e.name : 'Look'} settings` + (surfaces.length > 1 ? ` · ${surfaces.length} surfaces` : '');
      $('trayParamsBody').innerHTML = params.map((p) => {
        const label = esc(p.label), at = `data-p="${esc(p.name)}" aria-label="${label}"`;
        if (p.kind === 'toggle') return `<label class="check"><input type="checkbox" ${at}> ${label}</label>`;
        if (p.kind === 'colour') return `<label class="param"><span>${label}</span><input type="color" ${at}><output></output></label>`;
        if (p.kind === 'choice') return `<label class="param"><span>${label}</span><select ${at}>${p.options.map((o) => `<option value="${o.value}">${esc(o.label)}</option>`).join('')}</select><output></output></label>`;
        return `<label class="param"><span>${label}</span><input type="range" ${at} min="${p.min}" max="${p.max}" step="${p.step}"><output></output></label>`;
      }).join('');
    }
    for (const p of params) {
      const el = $('trayParamsBody').querySelector(`[data-p="${CSS.escape(p.name)}"]`);
      if (!el || el === document.activeElement) continue;
      const v = values[p.name] ?? p.def;
      if (p.kind === 'toggle') el.checked = !!v;
      else if (p.kind === 'colour') el.value = toHex(v);
      else el.value = String(v);
      this.showSettingValue(p, el);
    }
  },

  showSettingValue(p, el) {
    const out = el.parentElement.querySelector('output');
    if (out) out.textContent = p.kind === 'range' ? (p.step >= 1 ? String(Math.round(el.value)) : Number(el.value).toFixed(p.max - p.min > 10 ? 0 : 2)) : '';
  },

  setSetting(name, el) {
    const { look, surfaces } = this.settingsTargets();
    const p = this.lookParams(look).find((x) => x.name === name);
    if (!p) return;
    const v = p.kind === 'toggle' ? el.checked : p.kind === 'colour' ? fromHex(el.value, p.type === 'vec4' ? (p.def[3] ?? 1) : undefined) : Number(el.value);
    for (const s of surfaces) s.content = { ...(s.content || { kind: 'effect', effect: look }), params: { ...(s.content?.params || {}), [name]: v } };
    this.showSettingValue(p, el);
    this.settingsChanged();
  },

  // what changes with a setting: the frame, the save, a connected output; not the tray or the panels
  settingsChanged() {
    this.dirty = true;
    this.scheduleSave();
    this.broadcast();
    this.renderLookSettings();
  },

  // which surface, and which look is on it: cheap, so it runs on every change
  renderTrayState() {
    if (!this.tray || $('tray').hidden) return;
    const T = this.tray, sel = this.editor.sel;
    $('trayWho').innerHTML = T.all ? '<b>Every surface</b>' : sel >= 0 ? `<b>Surface ${sel + 1}</b>` : 'Tap a surface';
    document.querySelectorAll('#trayScope button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.all === '1') === T.all)));
    const cur = sel >= 0 ? keyOf(this.project.surfaces[sel]?.content) : null;
    const on = T.all ? new Set(this.project.surfaces.map((s) => keyOf(s.content))) : new Set([cur]);
    for (const t of T.tiles) t.el.setAttribute('aria-pressed', String(on.has(t.item.key)));
    this.renderLookSettings();
    // for looks that are one scene across the frame: flow across the surfaces, or the whole scene on this one
    const targets = this.sceneTargets();
    $('trayScene').hidden = !targets.length;
    if (targets.length) {
      const whole = targets.every((s) => isWhole(s.input)), flow = targets.every((s) => !s.input);
      document.querySelectorAll('#trayScene button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.whole === '1' ? whole : flow)));
    }
  },

  // the surfaces the switch acts on: the selected one (or, with All, every one) showing a frame-wide look
  sceneTargets() {
    const sel = this.project.surfaces[this.editor.sel];
    const list = this.tray.all ? this.project.surfaces : sel ? [sel] : [];
    return list.filter((s) => this.isFrameWide(s.content));
  },

  isFrameWide(c) {
    if (!c) return false;
    if (c.kind === 'media') return c.space === 'frame';
    const e = EFFECTS.find((x) => x.id === (c.effect || 'outline')) || (this.project.effects || []).find((x) => x.id === c.effect);
    return !!e && flowsAcross(e.code);
  },

  // whole scene: the surface shows the full frame's composition (see inputRect); flow across: back to the part it covers
  setWholeScene(whole) {
    const targets = this.sceneTargets();
    if (!targets.length) return;
    this.checkpoint();
    for (const s of targets) { if (whole) s.input = { x: 0, y: 0, w: 1, h: 1 }; else delete s.input; }
    this.changed();
  },

  applyLook(it) {
    const look = it.kind === 'media' ? { kind: 'media', mediaId: it.id, fit: 'fill', space: 'surface' } : { kind: 'effect', effect: it.id };
    // tapping the look a surface already shows keeps its settings
    const keep = (s) => (look.kind === 'effect' && s?.content?.kind !== 'media' && (s?.content?.effect || 'outline') === look.effect && s?.content?.params ? { ...look, params: s.content.params } : { ...look });
    if (!this.tray.all) { this.setContent(keep(this.project.surfaces[this.editor.sel])); return; }
    for (const s of this.project.surfaces) s.content = keep(s);
    if (it.kind === 'media' && this.playing) this.media.get(it.id)?.el.play?.().catch(() => {});
    this.changed();
  },

  // from the frame loop: draw the effect tiles that are on screen (or about to be), and not mid-drag. Positions are
  // taken relative to the canvas, which scrolls with the tiles, so scrolling never moves a preview off its tile.
  trayFrame(now, t) {
    const T = this.tray;
    if (!T || $('tray').hidden || this.editor.drag || now - T.last < 1000 / FPS) return;
    T.last = now;
    const c = this.thumbs.canvas.getBoundingClientRect(), sc = $('trayScroll').getBoundingClientRect(), tl = $('trayTiles').getBoundingClientRect();
    const view = { l: Math.max(sc.left, tl.left) - AHEAD, r: Math.min(sc.right, tl.right) + AHEAD, t: sc.top - AHEAD, b: sc.bottom + AHEAD };
    const tiles = [];
    for (const tile of T.tiles) {
      if (tile.item.kind !== 'effect' || tile.el.hidden) continue;
      const r = tile.thumb.getBoundingClientRect();
      if (r.right < view.l || r.left > view.r || r.bottom < view.t || r.top > view.b) continue;
      tiles.push({ effect: tile.item, idx: tile.item.idx, rect: { x: r.left - c.left + 2, y: r.top - c.top + 2, w: r.width - 4, h: r.height - 4 } });
    }
    this.thumbs.draw(tiles, { x: 0, y: 0, w: c.width, h: c.height }, t, previewAudio(this.audio.state, t));
  },
};
