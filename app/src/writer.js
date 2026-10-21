// The writer (writer.html), published as a Claude artifact: Claude writes an effect for Surface Mapper on the
// viewer's own Claude plan. The app copies a request (share.js) that the viewer pastes here; the effect is shown
// on their real surfaces, changed by asking or by editing the code, and sent back in a link (#fx=).
import { Renderer } from './renderer.js';
import { surfaceGeom } from './geometry.js';
import { generateEffect, claudePlan, getKey, namespaced, effectName } from './ai.js';
import { readWriterPacket, effectLink } from './share.js';
import { $, MAX_RENDER_PIXELS } from './env.js';

const LAST = 'pmw.last';   // the last request's surfaces, so another look for them needs no paste
const QUIET = { bass: 0, mid: 0, treble: 0, level: 0, beat: 0, beats: 0, active: false };

let renderer = null;
try { renderer = new Renderer($('gl')); } catch (err) { $('pasteStatus').textContent = err.message; }
let job = null;        // the request: { request, context, frame, surfaces, target, back }
let versions = [];     // { id, code, note, changes, hand }
let current = -1;
let abort = null, busyTimer = null, editTimer = null, tries = 0;
const t0 = performance.now();

const remember = (job) => { try { localStorage.setItem(LAST, JSON.stringify({ ...job, request: '' })); } catch { /* storage blocked */ } };
const recall = () => { try { return JSON.parse(localStorage.getItem(LAST)); } catch { return null; } };
const say = (el, text, bad = false) => { el.textContent = text; el.classList.toggle('bad', bad); };
const compile = (code) => { const id = 't' + ++tries; return renderer.tryEffect(id, namespaced(id, code)); };

// ---------- start: a pasted request, or another look for the last one's surfaces ----------
function showStart() {
  $('start').hidden = false; $('work').hidden = true;
  const last = recall();
  $('again').hidden = !last?.surfaces?.length;
  if (last?.surfaces?.length) $('againNote').textContent = `${last.surfaces.length} surface${last.surfaces.length === 1 ? '' : 's'}, from your last request.`;
}

$('paste').addEventListener('input', () => {
  const text = $('paste').value.trim();
  if (!text) { say($('pasteStatus'), ''); return; }
  let p;
  try { p = readWriterPacket(text); } catch (err) { say($('pasteStatus'), err.message, true); return; }
  if (!p) { say($('pasteStatus'), "That isn't a request from Surface Mapper. There, describe a look and tap Write it with Claude, then paste here.", true); return; }
  $('paste').value = ''; say($('pasteStatus'), '');
  begin(p);
});
$('againGo').onclick = () => {
  const request = $('againPrompt').value.trim(), last = recall();
  if (!request) { $('againPrompt').focus(); return; }
  if (last) { $('againPrompt').value = ''; begin({ ...last, request }); }
};
$('startOver').onclick = () => { abort?.abort(); showStart(); };

async function begin(p) {
  if (!renderer) return;
  job = p; versions = []; current = -1;
  remember(job);
  $('start').hidden = true; $('work').hidden = false;
  $('reqText').textContent = job.request;
  const small = document.createElement('small');
  small.textContent = job.target ? 'For the surface you had selected.' : `For all ${job.surfaces.length} surface${job.surfaces.length === 1 ? '' : 's'}.`;
  $('reqText').append(small);
  $('code').value = ''; say($('codeStatus'), ''); say($('note'), ''); say($('status'), '');
  draw();
  renderVersions(); updateSend();
  await write();
}

// ---------- writing and changing ----------
async function write(change = null) {
  const base = change ? versions[current] : null;
  const sample = await claudePlan();
  if (!sample && !getKey()) { say($('status'), 'Writing needs Claude. Open this page in Claude and allow it to use Claude when asked.', true); return; }
  abort = new AbortController();
  $('retry').hidden = true;
  busy(true, change ? 'Changing it…' : 'Writing…');
  try {
    const res = await generateEffect({
      sample, apiKey: getKey(), request: job.request, context: job.context, signal: abort.signal, compile,
      revise: base && { code: base.code, note: change },
      progress: (t) => { $('busyText').textContent = t; },
    });
    versions.push({ id: 'v' + versions.length, code: res.code, note: res.note, changes: base ? base.changes.concat([change]) : [] });
    show(versions.length - 1);
    if (change) $('change').value = '';
    say($('status'), res.repaired ? 'Fixed a compile error on the way.' : '');
  } catch (err) {
    say($('status'), err.message, true);
    $('retry').hidden = versions.length > 0;
  } finally {
    busy(false);
  }
}

$('changeGo').onclick = () => {
  const note = $('change').value.trim();
  if (!note) { $('change').focus(); return; }
  if (current < 0) return;
  write(note);
};
$('stop').onclick = () => abort?.abort();
$('retry').onclick = () => write();

function busy(on, text = '') {
  $('busy').hidden = !on;
  $('changeGo').disabled = on;
  $('code').readOnly = on;
  clearInterval(busyTimer);
  if (on) {
    $('busyText').textContent = text;
    const start = Date.now();
    $('busyTime').textContent = '';
    busyTimer = setInterval(() => { $('busyTime').textContent = `${Math.round((Date.now() - start) / 1000)} s · usually under a minute`; }, 1000);
  }
  updateSend();
}

// ---------- versions ----------
function show(i, { keepCode = false } = {}) {
  current = i;
  const v = versions[i];
  const err = renderer.setEffects([{ id: v.id, code: namespaced(v.id, v.code) }], new Set([v.id]));
  if (err) say($('status'), "This version doesn't compile here.", true);
  draw();
  say($('note'), v.hand ? 'Edited by hand.' : v.note);
  if (!keepCode) { $('code').value = v.code; say($('codeStatus'), ''); }
  renderVersions(); updateSend();
}

function renderVersions() {
  const box = $('versions');
  box.replaceChildren(...versions.map((v, i) => {
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = `${i + 1}${v.hand ? ' ✎' : ''}`;
    b.title = i === 0 ? 'As first written' : v.changes[v.changes.length - 1];
    b.setAttribute('aria-pressed', String(i === current));
    b.onclick = () => show(i);
    return b;
  }));
}

// a hand edit makes a new version once, then changes it as you type; it's compiled first, and shown only if it works
$('code').addEventListener('input', () => {
  clearTimeout(editTimer);
  editTimer = setTimeout(() => {
    if (current < 0) return;
    const code = $('code').value;
    if (!/vec3\s+fx_custom\s*\(/.test(code)) { say($('codeStatus'), 'Keep the function vec3 fx_custom(Surf2 s, float t).', true); return; }
    const log = compile(code);
    if (log) { say($('codeStatus'), log.split('\n').filter((l) => l.trim()).slice(0, 3).join('\n'), true); return; }
    say($('codeStatus'), 'Compiled.');
    const v = versions[current];
    if (v.hand) { v.code = code; show(current, { keepCode: true }); return; }
    versions.push({ id: 'v' + versions.length, code, note: '', changes: v.changes.concat(['edited by hand']), hand: true });
    show(versions.length - 1, { keepCode: true });
  }, 500);
});

// ---------- sending it back ----------
async function updateSend() {
  const send = $('send'), v = versions[current];
  const ready = !!v && $('busy').hidden;
  send.setAttribute('aria-disabled', String(!ready));
  if (!job) return;
  const host = new URL(job.back).host;
  $('sendNote').textContent = ready ? `Opens Surface Mapper (${host}) with this version on ${job.target ? 'the surface you had selected' : 'your surfaces'}.` : '';
  if (!ready) { send.removeAttribute('href'); return; }
  const prompt = job.request + (v.changes.length ? ` (then: ${v.changes.join('; ')})` : '');
  const code = v.code, href = await effectLink({ name: effectName(job.request), prompt, code, target: job.target }, job.back);
  if (versions[current] === v && v.code === code) send.href = href;   // not overtaken while it was packed
}

// ---------- the preview: the real surfaces, the effect on the ones it's for, the rest as outlines ----------
function draw() {
  if (!job) return;
  const [W, H] = job.frame, v = versions[current];
  renderer.frame = [W, H];
  const geoms = job.surfaces.map((s) => surfaceGeom(s, W, H));
  const on = renderer.effectIndex(v ? v.id : 'outline'), outline = renderer.effectIndex('outline');
  const fx = job.surfaces.map((s) => [!job.target || job.target.includes(s.id) ? on : outline, 0, 0, 0]);
  renderer.setSurfaces(geoms, fx);
  size();
}

function size() {
  if (!job) return;
  const c = $('gl'), [W, H] = job.frame;
  let w = Math.round(c.clientWidth * Math.min(devicePixelRatio || 1, 2)) || 640, h = Math.round(w * H / W);
  const k = Math.sqrt(Math.min(1, MAX_RENDER_PIXELS / (w * h)));
  w = Math.round(w * k); h = Math.round(h * k);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
}
addEventListener('resize', size);

// steady 120 bpm with a bass hit on each beat, for looks that react to music
function music(t) {
  if (!$('fakeMusic').checked) return QUIET;
  const phase = t * 2, beat = Math.exp(-(phase % 1) * 5);
  return { bass: 0.25 + 0.7 * beat, mid: 0.4 + 0.2 * Math.sin(t * 1.7), treble: 0.3 + 0.25 * Math.sin(t * 3.1 + 1), level: 0.35 + 0.5 * beat, beat, beats: Math.floor(phase), active: true };
}

function frame(now) {
  if (renderer && job && !$('work').hidden && !document.hidden) {
    const t = (now - t0) / 1000;
    renderer.render(t, music(t));
  }
  requestAnimationFrame(frame);
}
if (renderer) {
  renderer.onrestore = () => (current >= 0 ? show(current, { keepCode: true }) : draw());
  document.addEventListener('visibilitychange', () => (document.hidden ? renderer.release() : renderer.restore()));
  requestAnimationFrame(frame);
}

showStart();
claudePlan().then((sample) => { if (!sample && !getKey()) $('unavailable').hidden = false; });
window.writer = { renderer, state: () => ({ job, versions, current }) };   // for the tests
