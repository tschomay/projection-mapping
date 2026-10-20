// The content tray: every look (effects, the project's own effects, the user's videos and images) as a live tile.
// A tap puts it on the selected surface, or on all of them, and it shows on the projector straight away.
// Portrait: a strip along the bottom with search, the groups and one row of tiles. Landscape: a rail down one side
// that scrolls as a whole; only the surface's name and closing it stay put.
// The previews are drawn on a canvas inside the tiles' scrolling area, so they move with the tiles as they scroll.
// Methods mixed into App (see app.js), so `this` is the app.
import { EFFECTS } from '../effects.js';
import { namespaced } from '../ai.js';
import { Thumbs, previewAudio } from '../thumbs.js';
import { $ } from '../env.js';

const GROUPS = ['Basics', 'Music', 'Ambient', 'Halloween', 'Yours', 'Videos & images'];
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
    if (!on) return;
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
      it.music = it.kind === 'effect' && /uBeat|uAudio/.test(it.code);
      it.wide = it.kind === 'effect' && /s\.screen/.test(it.code);
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
        ? (it.media.kind === 'video' ? `<video muted playsinline preload="metadata" src="${esc(it.media.el.src)}#t=0.5"></video>` : `<img alt="" src="${esc(it.media.el.src)}">`)
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

  // which surface, and which look is on it: cheap, so it runs on every change
  renderTrayState() {
    if (!this.tray || $('tray').hidden) return;
    const T = this.tray, sel = this.editor.sel;
    $('trayWho').innerHTML = T.all ? '<b>Every surface</b>' : sel >= 0 ? `<b>Surface ${sel + 1}</b>` : 'Tap a surface';
    document.querySelectorAll('#trayScope button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.all === '1') === T.all)));
    const cur = sel >= 0 ? keyOf(this.project.surfaces[sel]?.content) : null;
    const on = T.all ? new Set(this.project.surfaces.map((s) => keyOf(s.content))) : new Set([cur]);
    for (const t of T.tiles) t.el.setAttribute('aria-pressed', String(on.has(t.item.key)));
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
    return !!e && /s\.screen/.test(e.code);
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
    if (!this.tray.all) { this.setContent(look); return; }
    for (const s of this.project.surfaces) s.content = { ...look };
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
