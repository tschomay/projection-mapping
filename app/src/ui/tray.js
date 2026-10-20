// The content tray: every look (effects, the project's own effects, the user's videos and images) as a live tile.
// A tap puts it on the selected surface, or on all of them, and it shows on the projector straight away.
// Portrait: a strip along the bottom, one row of tiles. Landscape: a rail down one side that scrolls as a whole.
// Search and the group filter sit above the tiles and scroll away.
// Methods mixed into App (see app.js), so `this` is the app.
import { EFFECTS } from '../effects.js';
import { namespaced } from '../ai.js';
import { Thumbs, previewAudio } from '../thumbs.js';
import { $ } from '../env.js';

const GROUPS = ['Basics', 'Music', 'Ambient', 'Halloween', 'Yours', 'Videos & images'];
const FPS = 20;
const esc = (t) => String(t).replace(/[<&"]/g, (c) => ({ '<': '&lt;', '&': '&amp;', '"': '&quot;' }[c]));

function keyOf(c) { return !c ? 'fx:outline' : c.kind === 'media' ? 'media:' + c.mediaId : 'fx:' + (c.effect || 'outline'); }

export const trayUI = {
  initTray() {
    this.tray = { all: false, filter: 'All', query: '', tiles: [], visible: new Set(), last: 0 };
    this.thumbs = new Thumbs($('trayGL'));
    this.tray.io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? this.tray.visible.add(e.target) : this.tray.visible.delete(e.target))));
    $('trayBtn').onclick = () => this.setTray($('tray').hidden);
    $('trayClose').onclick = () => this.setTray(false);
    $('trayFlip').onclick = () => $('tray').classList.toggle('left');
    document.querySelectorAll('#trayScope button').forEach((b) => { b.onclick = () => { this.tray.all = b.dataset.all === '1'; this.renderTrayState(); }; });
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

  // portrait: exactly the header and one row of tiles show, with search and the filter just above them, a scroll
  // away; landscape: the rail's full height, from the top
  layoutTray(start = false) {
    if ($('tray').hidden) return;
    const sc = $('trayScroll'), portrait = matchMedia('(orientation: portrait)').matches;
    sc.style.height = portrait ? $('trayHead').offsetHeight + $('trayTiles').offsetHeight + 'px' : '';
    if (start) sc.scrollTop = portrait ? $('trayFind').offsetHeight : 0;
  },

  trayItems() {
    const list = [];
    for (const e of EFFECTS) list.push({ key: 'fx:' + e.id, kind: 'effect', id: e.id, name: e.name, group: e.group, about: e.about || '', code: e.code, fn: 'fx_' + e.id });
    for (const e of this.project.effects || []) list.push({ key: 'fx:' + e.id, kind: 'effect', id: e.id, name: e.name, group: 'Yours', own: true, about: e.prompt || '', code: namespaced(e.id, e.code), fn: 'fx_' + e.id });
    for (const m of this.media.list()) {
      if (m.kind === 'audio' || m.id === this.project.backdrop?.mediaId) continue;
      list.push({ key: 'media:' + m.id, kind: 'media', id: m.id, name: m.name, group: 'Videos & images', media: m, about: m.kind === 'video' ? 'Your video.' : 'Your image.' });
    }
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
    T.io.disconnect(); T.visible.clear();
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
    T.tiles = [...$('trayTiles').querySelectorAll('.tile[data-key]')].map((el) => ({ el, thumb: el.querySelector('.thumb'), item: T.items.find((x) => x.key === el.dataset.key) }));
    for (const t of T.tiles) if (t.item.kind === 'effect') T.io.observe(t.thumb);
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
  },

  applyLook(it) {
    const look = it.kind === 'media' ? { kind: 'media', mediaId: it.id, fit: 'fill', space: 'surface' } : { kind: 'effect', effect: it.id };
    if (!this.tray.all) { this.setContent(look); return; }
    for (const s of this.project.surfaces) s.content = { ...look };
    if (it.kind === 'media' && this.playing) this.media.get(it.id)?.el.play?.().catch(() => {});
    this.changed();
  },

  // from the frame loop: draw the effect tiles that are on screen, a few times a second, and not mid-drag
  trayFrame(now, t) {
    const T = this.tray;
    if (!T || $('tray').hidden || this.editor.drag || now - T.last < 1000 / FPS) return;
    T.last = now;
    const c = $('trayGL').getBoundingClientRect(), sc = $('trayScroll').getBoundingClientRect(), head = $('trayHead').getBoundingClientRect();
    const top = Math.max(sc.top, head.bottom);
    const clip = { x: sc.left - c.left, y: top - c.top, w: sc.width, h: sc.bottom - top };
    const tiles = [];
    for (const tile of T.tiles) {
      if (!T.visible.has(tile.thumb) || tile.el.hidden) continue;
      const r = tile.thumb.getBoundingClientRect();
      tiles.push({ effect: tile.item, idx: tile.item.idx, rect: { x: r.left - c.left + 1, y: r.top - c.top + 1, w: r.width - 2, h: r.height - 2 } });
    }
    this.thumbs.draw(tiles, clip, t, previewAudio(this.audio.state, t));
  },
};
