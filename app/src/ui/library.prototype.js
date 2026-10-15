// PROTOTYPE, throwaway (content library, #42). Not for main.
// Question: what should browsing effects and media look like, now that a name chip tells you nothing about the look?
// Three variants on the real app, switched with ?library=A|B|C and the pill at the bottom ([ and ] cycle too):
//   A  Grid: the Content pane's lists become a filterable grid of live tiles; a tap puts it on the surface.
//   B  Shelf: a strip of live tiles over the bottom of the frame, outside the drawer; a tap auditions the look on the
//      real surface (so on the projector), Keep or Cancel.
//   C  Inspector: a big preview in the selected surface's own shape with what the effect does, and a compact list;
//      a tap only previews, a button commits.
// Previews: one small offscreen WebGL2 canvas compiles each effect on its own (a rectangle standing in for a
// surface, uv = screen) and is copied into each visible tile. With no sound playing, a pretend 120 bpm beat drives
// the audio uniforms so music effects show that they move to music.
import { EFFECTS } from '../effects.js';
import { SURF_API } from '../renderer.js';
import { namespaced } from '../ai.js';
import { $ } from '../env.js';

const VARIANTS = { A: 'Grid in the drawer', B: 'Shelf over the frame', C: 'Inspector' };

// a proposed grouping for the built-ins (the real ones only have 'Halloween'), and what each one does
const GROUP = { outline: 'Basics', white: 'Basics', sequence: 'Music', pulse: 'Music', tiles: 'Music', sweep: 'Ambient', trace: 'Ambient', plasma: 'Ambient' };
const ABOUT = {
  outline: 'A checkerboard and bright outline for lining surfaces up. The dot marks the first corner.',
  white: 'Plain white light: lights up the object itself.',
  sequence: 'Surfaces flash one after another, on the beat when music plays.',
  pulse: 'Bass fills the surface from its centre; treble sparkles along the edge.',
  sweep: 'A bright line sweeps across the whole frame, crossing from one surface to the next.',
  tiles: 'A grid of tiles that switch on and off, sized to each surface, flipping on the beat.',
  trace: 'A light runs around each surface\'s outline.',
  plasma: 'Slow, flowing colour across the whole frame.',
  bats: 'Bats fly across the frame, from one surface to the next, in front of a moonlit haze.',
  eyes: 'Pairs of eyes open in the dark, look around, blink and close.',
  fog: 'Pale green fog rolling across the frame, thicker towards the bottom.',
  lightning: 'A dark storm with a double flash every few seconds, or on the beat.',
  candle: 'Warm flickering candlelight from below.',
};
const ORDER = ['Basics', 'Music', 'Ambient', 'Halloween', 'Yours', 'Videos & images'];

// ---------- live previews ----------
class Thumbs {
  constructor(w, h) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    const gl = this.gl = this.canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false });
    this.programs = new Map();
    if (!gl) return;
    gl.bindVertexArray(gl.createVertexArray());
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  program(item) {
    if (this.programs.has(item.key)) return this.programs.get(item.key);
    const gl = this.gl;
    const frag = `#version 300 es
precision highp float; precision highp int;
uniform float uTime, uId, uBeat, uBeats, uHasAudio; uniform vec2 uRes, uView; uniform vec4 uAudio;
out vec4 outColor;
${SURF_API}
${item.code}
void main() {
  vec2 uv = gl_FragCoord.xy / uView;
  Surf2 s; s.uv = uv; s.screen = uv; s.px = vec2(uv.x, 1.0 - uv.y) * uRes; s.id = uId; s.count = 3.0;
  s.edge = min(min(uv.x, 1.0 - uv.x) * uRes.x, min(uv.y, 1.0 - uv.y) * uRes.y); s.size = uRes;
  outColor = vec4(clamp(${item.fn}(s, uTime), 0.0, 1.0), 1.0);
}`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, '#version 300 es\nin vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }'));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, 'position'); gl.linkProgram(p);
    const ok = gl.getProgramParameter(p, gl.LINK_STATUS);
    const u = {};
    if (ok) for (const n of ['uTime', 'uId', 'uBeat', 'uBeats', 'uHasAudio', 'uRes', 'uView', 'uAudio']) u[n] = gl.getUniformLocation(p, n);
    const prog = ok ? { p, u } : null;
    this.programs.set(item.key, prog);
    return prog;
  }

  // draw an item into a 2D canvas; res is the pretend surface size in frame pixels
  draw(item, ctx, t, audio, res = [640, 400]) {
    const { width: w, height: h } = ctx.canvas;
    if (item.kind === 'media') return drawMedia(item.el, ctx);
    const prog = this.gl && this.program(item);
    if (!prog) { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, w, h); return; }
    const gl = this.gl, u = prog.u;
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    gl.viewport(0, 0, w, h); gl.useProgram(prog.p);
    gl.uniform1f(u.uTime, t); gl.uniform1f(u.uId, item.idx % 3);
    gl.uniform2f(u.uRes, res[0], res[1]); gl.uniform2f(u.uView, w, h);
    gl.uniform4f(u.uAudio, audio.bass, audio.mid, audio.treble, audio.level);
    gl.uniform1f(u.uBeat, audio.beat); gl.uniform1f(u.uBeats, audio.beats); gl.uniform1f(u.uHasAudio, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    ctx.drawImage(this.canvas, 0, 0);
  }
}

function drawMedia(el, ctx) {
  const { width: w, height: h } = ctx.canvas;
  const iw = el.videoWidth || el.naturalWidth, ih = el.videoHeight || el.naturalHeight;
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h);
  if (!iw || !ih) return;
  const k = Math.max(w / iw, h / ih);
  ctx.drawImage(el, (w - iw * k) / 2, (h - ih * k) / 2, iw * k, ih * k);
}

// real sound when it's playing, otherwise a pretend 120 bpm beat
function audioNow(app, t) {
  const a = app.audio.state;
  if (a && a.active) return a;
  const f = (t * 2) % 1, beat = Math.exp(-f * 5);
  return { bass: 0.25 + 0.75 * beat, mid: 0.5 + 0.3 * Math.sin(t * 1.3), treble: 0.4 + 0.4 * Math.sin(t * 7) ** 2, level: 0.6, beat, beats: Math.floor(t * 2) };
}

// ---------- what the library holds ----------
function items(app) {
  const list = [];
  EFFECTS.filter((e) => e.id !== 'off').forEach((e) => list.push({ key: 'fx:' + e.id, kind: 'effect', id: e.id, name: e.name, group: e.group || GROUP[e.id] || 'Ambient', code: e.code, fn: 'fx_' + e.id, about: ABOUT[e.id] || '' }));
  (app.project.effects || []).forEach((e) => list.push({ key: 'fx:' + e.id, kind: 'effect', id: e.id, name: e.name, group: 'Yours', own: true, code: namespaced(e.id, e.code), fn: 'fx_' + e.id, about: e.prompt || '' }));
  app.media.list().filter((m) => m.kind !== 'audio' && m.id !== app.project.backdrop?.mediaId)
    .forEach((m) => list.push({ key: 'media:' + m.id, kind: 'media', id: m.id, name: m.name, group: 'Videos & images', el: m.el, about: m.kind === 'video' ? 'Your video.' : 'Your image.' }));
  list.forEach((it, i) => {
    it.idx = i;
    it.beat = it.kind === 'effect' && /uBeat|uAudio|uHasAudio/.test(it.code);
    it.wide = it.kind === 'effect' && /s\.screen/.test(it.code);
  });
  return list;
}
const groupsOf = (list) => ORDER.filter((g) => list.some((it) => it.group === g));
const badges = (it) => (it.beat ? '<b title="Moves to music">♪</b>' : '') + (it.wide ? '<b title="Flows across surfaces">⇆</b>' : '') + (it.own ? '<b title="Yours">✦</b>' : '');
const badgeText = (it) => [it.beat && 'moves to music', it.wide && 'flows across surfaces', it.own && 'yours'].filter(Boolean).join(' · ');
const esc = (t) => String(t).replace(/[<&"]/g, (c) => ({ '<': '&lt;', '&': '&amp;', '"': '&quot;' }[c]));

function contentOf(it) { return it.kind === 'media' ? { kind: 'media', mediaId: it.id, fit: 'fill', space: 'surface' } : { kind: 'effect', effect: it.id }; }
function keyOf(c) { return !c ? 'fx:outline' : c.kind === 'media' ? 'media:' + c.mediaId : 'fx:' + (c.effect || 'outline'); }
function currentKey(app) { const s = app.project.surfaces[app.editor.sel]; return s ? keyOf(s.content) : null; }
function apply(app, it, all = false) {
  if (!all) return app.setContent(contentOf(it));
  for (const s of app.project.surfaces) s.content = contentOf(it);
  if (it.kind === 'media' && app.playing) app.media.get(it.id)?.el.play?.().catch(() => {});
  app.changed();
}

// ---------- shared: a tile canvas that the frame loop keeps drawing while it's on screen ----------
function makeLoop(app) {
  const thumbs = new Thumbs(192, 120), visible = new Set(), all = new Map();
  const io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target))));
  let last = 0, raf = 0, extra = [];
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    if (now - last < 40) return; last = now;
    const t = (now - app.t0) / 1000, a = audioNow(app, t);
    for (const c of visible) { const it = all.get(c); if (it && c.offsetParent) thumbs.draw(it, c.getContext('2d'), t, a); }
    for (const f of extra) f(t, a);
  };
  raf = requestAnimationFrame(tick);
  return {
    tile(it, w = 192, h = 120) { const c = document.createElement('canvas'); c.width = w; c.height = h; all.set(c, it); io.observe(c); return c; },
    every(f) { extra.push(f); },
    clear() { io.disconnect(); visible.clear(); all.clear(); extra = []; },
    stop() { cancelAnimationFrame(raf); this.clear(); },
  };
}

const CSS = `
.lib-hidden { display: none !important; }
.lib-badges { display: flex; gap: 3px; }
.lib-badges b { font: 600 11px/1 var(--sans); background: #000b; color: var(--lamp); border-radius: 4px; padding: 3px 4px; }
/* A: grid */
.libA { display: grid; gap: 10px; }
.libA input[type=search] { width: 100%; box-sizing: border-box; }
.libA .filters { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 0 -12px; padding: 0 12px; }
.libA .filters .chip { flex: none; }
.libA .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.libA .tile { position: relative; display: grid; gap: 5px; background: none; border: 0; padding: 0; color: inherit; text-align: left; cursor: pointer; font: inherit; }
.libA .tile canvas, .libA .tile .add { width: 100%; aspect-ratio: 16 / 10; border-radius: 8px; border: 2px solid var(--line); display: block; box-sizing: border-box; background: #000; }
.libA .tile .add { display: grid; place-items: center; color: var(--muted); font-size: 13px; border-style: dashed; text-align: center; padding: 8px; }
.libA .tile[aria-pressed=true] canvas { border-color: var(--lamp); box-shadow: 0 0 0 3px var(--lamp-dim); }
.libA .tile .lib-badges { position: absolute; top: 6px; right: 6px; }
.libA .tile span { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.libA .tile[aria-pressed=true] span::before { content: "● "; color: var(--lamp); }
/* B: shelf. Portrait (the phone as a remote for a second screen): the frame pinned to the top, the shelf across
   the bottom half with two rows of tiles. Landscape (mirroring): a rail down one side, so the frame keeps its height. */
#libB { position: fixed; z-index: 4; left: calc(10px + env(safe-area-inset-left, 0px)); right: calc(10px + env(safe-area-inset-right, 0px)); bottom: calc(10px + env(safe-area-inset-bottom, 0px)); background: #12161ef0; backdrop-filter: blur(8px); border: 1px solid var(--line); border-radius: 12px; padding: 10px 0; display: grid; gap: 10px; overflow: hidden; }
#libB .top { display: grid; grid-template-columns: 1fr auto; grid-template-areas: "who acts" "seg seg"; align-items: center; gap: 8px; padding: 0 10px; }
#libB .who { grid-area: who; min-width: 0; font-size: 13px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#libB .who b { color: var(--fg); font-size: 15px; }
#libB .top .seg { grid-area: seg; justify-self: start; }
#libB .seg button { white-space: nowrap; min-height: 34px; }
#libB .acts { grid-area: acts; display: flex; gap: 6px; }
#libB .acts .btn { min-height: 36px; justify-content: center; }
#libB .flip { grid-area: flip; display: none; min-height: 34px; padding: 4px 9px; }
#libB .groups { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 0 10px; }
#libB .groups .chip { flex: none; min-height: 32px; padding: 4px 11px; font-size: 13px; }
#libB .strip { display: grid; grid-auto-flow: column; grid-template-rows: auto auto; grid-auto-columns: auto; gap: 10px; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x proximity; padding: 2px 10px; scrollbar-width: none; }
#libB .strip .sep { grid-row: 1 / span 2; width: 1px; background: var(--line); font-size: 0; color: transparent; scroll-snap-align: start; }
#libB .strip .sep:first-child { display: none; }
#libB .tile { width: 140px; min-width: 0; position: relative; display: grid; gap: 4px; background: none; border: 0; padding: 0; color: inherit; cursor: pointer; scroll-snap-align: start; font: inherit; text-align: left; }
#libB .tile canvas { width: 100%; aspect-ratio: 16 / 10; border-radius: 8px; border: 2px solid var(--line); display: block; box-sizing: border-box; }
#libB .tile[aria-pressed=true] canvas { border-color: var(--lamp); box-shadow: 0 0 0 3px var(--lamp-dim); }
#libB .tile .lib-badges { position: absolute; top: 5px; right: 5px; }
#libB .tile span { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
body.libB-open #quickBar, body.libB-open #nudge { display: none !important; }
@media (orientation: portrait) {
  body.libB-open #box { top: calc(108px + env(safe-area-inset-top, 0px)) !important; }
}
@media (orientation: landscape) {
  #libB { left: auto; top: calc(58px + env(safe-area-inset-top, 0px)); width: 236px; grid-template-rows: auto 1fr; padding-bottom: 0; }
  #libB.left { right: auto; left: calc(10px + env(safe-area-inset-left, 0px)); }
  #libB .top { grid-template-areas: "who flip" "seg seg" "acts acts"; }
  #libB .top .seg { justify-self: stretch; display: flex; }
  #libB .top .seg button { flex: 1; }
  #libB .acts .btn { flex: 1; }
  #libB .tile { width: auto; }
  #libB .tile span { font-size: 11.5px; }
  #libB .flip { display: inline-flex; }
  #libB .groups { display: none; }
  #libB .strip { grid-auto-flow: row; grid-template-rows: none; grid-template-columns: 1fr 1fr; gap: 8px; overflow-x: hidden; overflow-y: auto; scroll-snap-type: y proximity; padding: 0 10px 10px; min-height: 0; }
  #libB .strip .sep, #libB .strip .sep:first-child { display: block; grid-row: auto; grid-column: 1 / -1; width: auto; background: none; margin-top: 4px; font: 600 10.5px/1 var(--sans); letter-spacing: .09em; text-transform: uppercase; color: var(--muted); }
}
/* C: inspector */
.libC { display: grid; gap: 12px; }
.libC .hero { display: grid; gap: 8px; background: #0008; border: 1px solid var(--line); border-radius: 10px; padding: 10px; position: sticky; top: -12px; z-index: 1; backdrop-filter: blur(8px); }
.libC .hero canvas { width: 100%; height: 170px; display: block; object-fit: contain; }
.libC .hero h4 { margin: 0; font-size: 16px; display: flex; gap: 8px; align-items: center; }
.libC .hero .now { font-size: 11px; color: var(--muted); font-weight: 400; margin-left: auto; }
.libC .hero p { margin: 0; font-size: 12.5px; color: var(--muted); }
.libC .hero .row { display: flex; gap: 8px; }
.libC .list { display: grid; }
.libC .list h5 { margin: 10px 0 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .09em; color: var(--muted); }
.libC .row-item { display: grid; grid-template-columns: 64px 1fr auto; align-items: center; gap: 10px; background: none; border: 0; border-radius: 8px; padding: 5px 6px; color: inherit; text-align: left; cursor: pointer; font: inherit; }
.libC .row-item:hover { background: var(--raise); }
.libC .row-item[data-focus=true] { background: var(--lamp-dim); }
@media (max-height: 500px) { .libC .hero { position: static; } .libC .hero canvas { height: 110px; } }
.libC .row-item canvas { width: 64px; height: 40px; border-radius: 5px; display: block; }
.libC .row-item .t { display: grid; min-width: 0; }
.libC .row-item .t span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.libC .row-item .t small { color: var(--muted); font-size: 11.5px; }
.libC .row-item .on { font-size: 11px; color: var(--lamp); }
/* the prototype switcher: deliberately not part of the design */
#libSwitch { display: flex; align-items: center; gap: 2px; background: #fff; color: #111; border-radius: 999px; padding: 3px; box-shadow: 0 2px 10px #0009; font: 600 11.5px/1 system-ui, sans-serif; height: 38px; box-sizing: border-box; }
#libSwitch button { border: 0; background: #e6e6e6; color: #111; border-radius: 999px; width: 30px; height: 30px; cursor: pointer; font-size: 12px; }
#libSwitch span { padding: 0 8px; white-space: nowrap; }
`;

// ---------- A: grid in the drawer ----------
function variantA(app, loop) {
  const pane = document.querySelector('[data-pane=content]');
  const root = document.createElement('div');
  root.className = 'libA';
  $('contentTarget').after(root);
  let filter = 'All', query = '';
  const render = () => {
    loop.clear();
    const list = items(app), cur = currentKey(app);
    const shown = list.filter((it) => (filter === 'All' || it.group === filter) && (!query || (it.name + ' ' + it.about + ' ' + it.group).toLowerCase().includes(query)));
    root.innerHTML = `<input type="search" placeholder="Search looks" aria-label="Search looks" value="${esc(query)}">
      <div class="filters">${['All', ...groupsOf(list)].map((g) => `<button class="chip" data-g="${g}" aria-pressed="${g === filter}">${g}</button>`).join('')}</div>
      <div class="grid"></div>`;
    const grid = root.querySelector('.grid');
    for (const it of shown) {
      const b = document.createElement('button');
      b.className = 'tile'; b.dataset.key = it.key; b.setAttribute('aria-pressed', String(it.key === cur)); b.title = it.about;
      b.append(loop.tile(it));
      b.insertAdjacentHTML('beforeend', `<div class="lib-badges">${badges(it)}</div><span>${esc(it.name)}</span>`);
      b.onclick = () => apply(app, it);
      grid.append(b);
    }
    if (filter === 'All' || filter === 'Yours') grid.insertAdjacentHTML('beforeend', '<button class="tile" data-act="ai"><div class="add">✦ Describe a look<br>and AI writes it</div><span>&nbsp;</span></button>');
    if (filter === 'All' || filter === 'Videos & images') grid.insertAdjacentHTML('beforeend', '<button class="tile" data-act="media"><div class="add">＋ Add a video<br>or image</div><span>&nbsp;</span></button>');
    const s = root.querySelector('input');
    s.oninput = () => { query = s.value.trim().toLowerCase(); const pos = s.selectionStart; render(); const n = root.querySelector('input'); n.focus(); n.setSelectionRange(pos, pos); };
    root.querySelectorAll('[data-g]').forEach((b) => { b.onclick = () => { filter = b.dataset.g; render(); }; });
    root.querySelector('[data-act=ai]')?.addEventListener('click', () => { $('aiPrompt').scrollIntoView({ block: 'center', behavior: 'smooth' }); $('aiPrompt').focus(); });
    root.querySelector('[data-act=media]')?.addEventListener('click', () => $('addMedia').click());
  };
  const hidden = [$('effectList').closest('.group'), $('mediaList').closest('.group')];
  hidden.forEach((g) => g.classList.add('lib-hidden'));
  render();
  return {
    refresh: () => { const cur = currentKey(app); root.querySelectorAll('.tile[data-key]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.key === cur))); },
    rebuild: render,
    unmount() { root.remove(); hidden.forEach((g) => g.classList.remove('lib-hidden')); pane.scrollTop = 0; },
  };
}

// ---------- B: shelf over the frame, auditioning on the real surface ----------
function variantB(app, loop) {
  const btn = document.createElement('button');
  btn.className = 'btn'; btn.id = 'libBBtn';
  btn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="3" width="5" height="4" rx="1"/><rect x="9" y="3" width="5" height="4" rx="1"/><rect x="2" y="9" width="5" height="4" rx="1"/><rect x="9" y="9" width="5" height="4" rx="1"/></svg><span class="lbl">Looks</span>';
  $('toolsBtn').after(btn);
  const shelf = document.createElement('div');
  shelf.id = 'libB'; shelf.className = 'ui'; shelf.hidden = true;
  document.body.append(shelf);
  let all = false, before = null;   // before: every surface's content when auditioning started
  const looks = () => app.project.surfaces.map((s) => s.content);
  const restore = () => { if (!before) return; app.project.surfaces.forEach((s, i) => { s.content = before[i]; }); before = null; app.changed(); };
  const open = (on) => {
    if (on && !app.project.surfaces.length) { app.toast('Add a surface first.'); return; }
    if (!on && before) before = null;   // closing keeps what's showing
    shelf.hidden = !on; document.body.classList.toggle('libB-open', on); btn.setAttribute('aria-pressed', String(on));
    if (on) { app.toggleDrawer(false); if (app.editor.sel < 0) app.editor.select(0); render(); } else loop.clear();
  };
  btn.onclick = () => open(shelf.hidden);
  const render = () => {
    if (shelf.hidden) return;
    loop.clear();
    const list = items(app), cur = currentKey(app), n = app.editor.sel + 1;
    shelf.innerHTML = `<div class="top">
        <div class="who">${all ? '<b>Every surface</b>' : `<b>Surface ${n}</b>`}${before ? ' · trying it' : ''}</div>
        <button class="btn flip" data-act="flip" aria-label="Move to the other side" title="Move to the other side">⇆</button>
        <div class="seg"><button data-all="0" aria-pressed="${!all}">This surface</button><button data-all="1" aria-pressed="${all}">All</button></div>
        <div class="acts">${before ? '<button class="btn" data-act="cancel">Cancel</button><button class="btn primary" data-act="keep">Keep</button>' : '<button class="btn" data-act="close">Done</button>'}</div>
      </div>
      <div class="groups">${groupsOf(list).map((g) => `<button class="chip" data-jump="${g}">${g}</button>`).join('')}<button class="chip" data-act="ai">✦ Describe…</button><button class="chip" data-act="media">＋ Video or image</button></div>
      <div class="strip"></div>`;
    const strip = shelf.querySelector('.strip');
    let g = '';
    for (const it of list) {
      if (it.group !== g) { strip.insertAdjacentHTML('beforeend', `<div class="sep" data-group="${it.group}">${it.group}</div>`); g = it.group; }
      const b = document.createElement('button');
      b.className = 'tile'; b.dataset.group = it.group; b.title = it.about;
      b.setAttribute('aria-pressed', String(it.key === cur));
      b.append(loop.tile(it, 136 * 1.5, 85 * 1.5));
      b.insertAdjacentHTML('beforeend', `<div class="lib-badges">${badges(it)}</div><span>${esc(it.name)}</span>`);
      b.onclick = () => { if (!before) before = looks(); apply(app, it, all); render(); };
      strip.append(b);
    }
    shelf.querySelectorAll('[data-jump]').forEach((c) => { c.onclick = () => strip.querySelector(`.sep[data-group="${c.dataset.jump}"]`)?.scrollIntoView({ inline: 'start', block: 'start', behavior: 'smooth' }); });
    shelf.querySelectorAll('[data-all]').forEach((c) => { c.onclick = () => { all = c.dataset.all === '1'; render(); }; });
    shelf.querySelector('[data-act=keep]')?.addEventListener('click', () => { before = null; render(); });
    shelf.querySelector('[data-act=cancel]')?.addEventListener('click', () => { restore(); render(); });
    shelf.querySelector('[data-act=close]')?.addEventListener('click', () => open(false));
    shelf.querySelector('[data-act=flip]').onclick = () => { shelf.classList.toggle('left'); };
    shelf.querySelector('[data-act=ai]').onclick = () => { open(false); app.toggleDrawer(true); app.selectTab('content'); $('aiPrompt').focus(); };
    shelf.querySelector('[data-act=media]').onclick = () => $('addMedia').click();
    // keep the strip where it was
    strip.scrollLeft = render.sx || 0; strip.scrollTop = render.sy || 0;
    strip.onscroll = () => { render.sx = strip.scrollLeft; render.sy = strip.scrollTop; };
  };
  return {
    refresh: () => { const k = app.editor.sel + ':' + currentKey(app); if (k !== render.k) { render.k = k; render(); } },
    rebuild: render,
    unmount() { restore(); btn.remove(); shelf.remove(); document.body.classList.remove('libB-open'); },
  };
}

// ---------- C: inspector ----------
function variantC(app, loop) {
  const root = document.createElement('div');
  root.className = 'libC';
  $('contentTarget').after(root);
  const hidden = [$('effectList').closest('.group'), $('mediaList').closest('.group')];
  hidden.forEach((g) => g.classList.add('lib-hidden'));
  const hero = new Thumbs(480, 300);
  let focus = null;
  const render = () => {
    loop.clear();
    const list = items(app), cur = currentKey(app), s = app.project.surfaces[app.editor.sel];
    const it = list.find((x) => x.key === focus) || list.find((x) => x.key === cur) || list[0];
    focus = it.key;
    root.innerHTML = `<div class="hero">
        <canvas width="480" height="300"></canvas>
        <h4>${esc(it.name)}<div class="lib-badges">${badges(it)}</div><span class="now">${it.key === cur ? 'showing now' : cur ? 'not showing yet' : ''}</span></h4>
        <p>${esc(it.about)}${badgeText(it) ? ` <i>(${badgeText(it)})</i>` : ''}</p>
        <div class="row"><button class="btn primary" data-act="use" ${s ? '' : 'disabled'}>${s ? `Use on surface ${app.editor.sel + 1}` : 'Select a surface'}</button><button class="btn" data-act="all" ${app.project.surfaces.length ? '' : 'disabled'}>Every surface</button></div>
      </div><div class="list"></div>`;
    const box = root.querySelector('.list');
    for (const g of groupsOf(list)) {
      box.insertAdjacentHTML('beforeend', `<h5>${g}</h5>`);
      for (const x of list.filter((y) => y.group === g)) {
        const b = document.createElement('button');
        b.className = 'row-item'; b.dataset.focus = String(x.key === focus);
        b.append(loop.tile(x, 128, 80));
        b.insertAdjacentHTML('beforeend', `<div class="t"><span>${esc(x.name)}</span><small>${badgeText(x) || '&nbsp;'}</small></div><span class="on">${x.key === cur ? '● on' : ''}</span>`);
        b.onclick = () => { focus = x.key; render(); };
        b.ondblclick = () => apply(app, x);
        box.append(b);
      }
    }
    box.insertAdjacentHTML('beforeend', '<div class="row" style="margin-top:8px"><label class="btn file">＋ Video or image<input type="file" accept="video/*,image/*" multiple hidden></label><button class="btn" data-act="ai">✦ Describe a look</button></div>');
    box.querySelector('input[type=file]').onchange = (e) => { $('addMedia').files = e.target.files; $('addMedia').dispatchEvent(new Event('change')); };
    box.querySelector('[data-act=ai]').onclick = () => { $('aiPrompt').scrollIntoView({ block: 'center', behavior: 'smooth' }); $('aiPrompt').focus(); };
    root.querySelector('[data-act=use]').onclick = () => apply(app, it);
    root.querySelector('[data-act=all]').onclick = () => apply(app, it, true);
    // the big preview in the selected surface's own shape (its outline in uv space), at its own proportions
    const c = root.querySelector('.hero canvas'), ctx = c.getContext('2d');
    const g = s && app.geoms[app.editor.sel];
    const size = g ? g.size : [640, 400];
    const k = Math.min(480 / size[0], 300 / size[1]);
    c.width = Math.max(8, Math.round(size[0] * k)); c.height = Math.max(8, Math.round(size[1] * k));
    loop.every((t, a) => {
      if (!c.isConnected || !c.offsetParent) return;
      hero.draw(it, ctx, t, a, size);
      if (!s) return;
      const path = (op) => { const p = new Path2D(); s.parts.filter((q) => q.op === op).forEach((q) => { q.pts.forEach(([u, v], i) => p[i ? 'lineTo' : 'moveTo'](u * c.width, (1 - v) * c.height)); p.closePath(); }); return p; };
      ctx.save();
      ctx.globalCompositeOperation = 'destination-in'; ctx.fill(path(1));
      ctx.globalCompositeOperation = 'destination-out'; ctx.fill(path(-1));
      ctx.restore();
    });
  };
  render();
  return {
    refresh: () => { const k = app.editor.sel + ':' + currentKey(app); if (k !== render.k) { render.k = k; focus = null; render(); } },
    rebuild: render,
    unmount() { root.remove(); hidden.forEach((g) => g.classList.remove('lib-hidden')); },
  };
}

// ---------- mounting and the switcher ----------
export function mount(app) {
  if (!app.editor) return;
  document.head.insertAdjacentHTML('beforeend', `<style id="libCSS">${CSS}</style>`);
  const loop = makeLoop(app);
  const keys = Object.keys(VARIANTS);
  let key = (new URLSearchParams(location.search).get('library') || 'A').toUpperCase();
  if (!VARIANTS[key]) key = 'A';
  let v = null;
  const sw = document.createElement('div');
  sw.id = 'libSwitch';
  sw.innerHTML = '<button aria-label="Previous variant">◀</button><span></span><button aria-label="Next variant">▶</button>';
  $('toolbar').append(sw);   // in the toolbar's flow, so it never covers it; white so it's clearly not the design
  const show = (k) => {
    v?.unmount(); loop.clear();
    key = k;
    const url = new URL(location.href); url.searchParams.set('library', k); history.replaceState(null, '', url);
    sw.querySelector('span').textContent = `Prototype ${k}: ${VARIANTS[k]}`;
    v = { A: variantA, B: variantB, C: variantC }[k](app, loop);
    if (k !== 'B') { app.toggleDrawer(true); app.selectTab('content'); }
  };
  const step = (d) => show(keys[(keys.indexOf(key) + d + keys.length) % keys.length]);
  sw.querySelectorAll('button')[0].onclick = () => step(-1);
  sw.querySelectorAll('button')[1].onclick = () => step(1);
  window.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable) return;
    if (e.key === '[') step(-1); if (e.key === ']') step(1);
  });
  // follow the app: selection and content changes, new effects and media
  const wrap = (name, after) => { const f = app[name].bind(app); app[name] = (...a) => { const r = f(...a); after(); return r; }; };
  wrap('renderContentUI', () => v?.refresh());
  wrap('renderEffectList', () => v?.rebuild());
  wrap('renderMediaUI', () => v?.rebuild());
  show(key);
}
