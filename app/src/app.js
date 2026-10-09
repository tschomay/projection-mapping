// Surface Mapper: a phone-first projection mapping app.
// The whole screen is the projector frame (mirror the phone to the projector), or, on a laptop, a separate output
// window placed on the projector display. Surfaces are traced on that frame, filled with effects or media, and
// driven by sound.
import { Renderer, MAX_MEDIA } from './renderer.js';
import { EFFECTS } from './effects.js';
import { surfaceGeom, newSurface, flatMesh, meshEvaluator } from './geometry.js';
import { Editor } from './editor.js';
import { AudioEngine } from './audio.js';
import { MediaLibrary } from './media.js';
import * as store from './store.js';
import { ConnectionPort, presentationSupported, presentationReceiver } from './link.js';
import { drawPattern, surfacesFromShots } from './capture.js';
import { Camera, CaptureError, listCameras, runCapture } from './camera.js';
import { deviceReport, cameraReport, reportText } from './diagnostics.js';
import { ShowRunner, newCue, fmtTime, parseTime } from './show.js';
import { generateEffect, describeSurfaces, getKey, setKey, namespaced } from './ai.js';

const $ = (id) => document.getElementById(id);
const IS_OUTPUT = location.hash === '#output' || !!presentationReceiver();
const COARSE = matchMedia('(pointer: coarse)').matches;
const FIT_CODE = { fill: 0, fit: 1, stretch: 2 };
// sessionStorage, which can throw where storage is blocked
const session = (op, key, value) => { try { return sessionStorage[op + 'Item'](key, value); } catch { return null; } };

class App {
  constructor() {
    this.box = $('box');
    this.renderer = new Renderer($('gl'));
    this.audio = new AudioEngine();
    this.media = new MediaLibrary();
    this.project = store.newProject();
    this.geoms = [];
    this.frame = [1280, 720];
    this.playing = false;
    this.dirty = true;
    this.output = { win: null, connected: false, lastSeen: 0, aspect: null };
    this.channel = 'BroadcastChannel' in window ? new BroadcastChannel('pm-sync') : null;
    this.ports = new Set();   // second screens started through the Presentation API
    this.t0 = performance.now();
    this.show = new ShowRunner(this);
    this.remoteBeats = 0;     // beats heard by a connected output, which plays the sound
    this.media.onchange = () => { this.dirty = true; if (!IS_OUTPUT) this.renderMediaUI(); };

    if (IS_OUTPUT) this.initOutput(); else this.initEditor();
    window.addEventListener('resize', () => this.layout());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.keepAwake(); });
    this.layout();
    requestAnimationFrame((t) => this.frameLoop(t));
  }

  // ---------- layout: the canvas box fills the screen, or matches the output window's shape ----------
  layout() {
    const W = window.innerWidth, H = window.innerHeight;
    const aspect = !IS_OUTPUT && this.output.connected && this.output.aspect ? this.output.aspect : W / H;
    let bw = W, bh = W / aspect;
    if (bh > H) { bh = H; bw = H * aspect; }
    Object.assign(this.box.style, { width: bw + 'px', height: bh + 'px', left: (W - bw) / 2 + 'px', top: (H - bh) / 2 + 'px' });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(dpr, Math.sqrt(2.6e6 / (bw * bh)));   // cap the pixel count on high-density phones
    const c = $('gl');
    c.width = Math.max(1, Math.round(bw * scale)); c.height = Math.max(1, Math.round(bh * scale));
    const frame = [1280, Math.round(1280 / aspect)];
    if (frame[1] !== this.frame[1]) { this.frame = frame; this.renderer.frame = frame; this.dirty = true; }
    if (IS_OUTPUT) this.hello();
  }

  // ---------- state changes ----------
  changed({ geometry = true, save = true } = {}) {
    if (geometry) this.dirty = true;
    if (!IS_OUTPUT) {
      this.renderSurfaceUI();
      this.renderContentUI();
      if (save) this.scheduleSave();
      this.broadcast();
    }
  }

  sync() {
    const [W, H] = this.frame;
    // the project's own effects join the built-in ones (recompiles only when they change)
    const err = this.renderer.setEffects((this.project.effects || []).map((e) => ({ id: e.id, code: namespaced(e.id, e.code) })));
    if (err && !IS_OUTPUT) this.toast('One of this project\'s own effects no longer compiles here.');
    this.geoms = this.project.surfaces.map((s) => surfaceGeom(s, W, H));
    // media used by surfaces get the four texture slots, in order of first use
    const slots = [];
    const looks = this.project.surfaces.map((s) => s.content);
    if (this.show.fade) looks.push(...Object.values(this.show.fade.from));
    for (const c of looks) {
      if (c && c.kind === 'media' && this.media.get(c.mediaId) && !slots.includes(c.mediaId) && slots.length < MAX_MEDIA) slots.push(c.mediaId);
    }
    this.slots = slots;
    for (let i = 0; i < MAX_MEDIA; i++) this.renderer.setMedia(i, slots[i] ? this.media.get(slots[i]).el : null);
    const fxOf = (c) => {
      c = c || { kind: 'effect', effect: 'outline' };
      if (c.kind === 'media') {
        const slot = slots.indexOf(c.mediaId);
        return slot < 0 ? [this.renderer.effectIndex('off'), 0, 0, 0] : [-1, slot, c.space === 'frame' ? 1 : 0, FIT_CODE[c.fit || 'fill']];
      }
      return [this.renderer.effectIndex(c.effect), 0, 0, 0];
    };
    const fx = this.project.surfaces.map((s) => fxOf(s.content));
    // during a cue transition, the previous look too
    const from = this.show.fade && this.show.fade.from;
    this.renderer.setSurfaces(this.geoms, fx, from ? this.project.surfaces.map((s) => fxOf(from[s.id] || s.content)) : fx);
    this.dirty = false;
  }

  frameLoop(now) {
    const dt = now - (this.lastNow || now); this.lastNow = now;
    if (dt > 0 && dt < 5000) this.fps = this.fps ? this.fps * 0.95 + 50 / dt : 1000 / dt;   // smoothed frame rate; long gaps (a hidden tab) are skipped
    if (this.dirty) this.sync();
    const sounding = this.playing && !!this.soundtrackEl() && !(this.output.connected && !IS_OUTPUT);
    const a = this.audio.update(now, sounding);
    if (!IS_OUTPUT) {
      // cues that start by themselves; with an output connected, it plays the sound and reports the beats
      const beats = this.output.connected ? { active: true, beats: this.remoteBeats } : a;
      this.show.tick(now, beats, this.soundtrackEl() ? this.currentTime() : null, this.playing);
    } else if (a.beats !== this.lastBeats) { this.lastBeats = a.beats; if (a.active) this.post({ type: 'beat' }); }
    const mix = this.show.mix(now);
    if (mix === null && this.wasMixing) this.sync();   // the transition just ended
    this.wasMixing = mix !== null;
    this.renderer.render((now - this.t0) / 1000, a, mix);
    if (!IS_OUTPUT) {
      this.drawTimeline();
      if (!document.body.classList.contains('show')) this.editor.draw();
      this.drawMeter(a);
      if (this.output.connected && now - this.output.lastSeen > 6000) { this.output.connected = false; this.applyMute(); this.layout(); this.renderOutputState(); }
      if (this.playing && this.output.connected && now - (this.lastTimeSync || 0) > 1000) { this.lastTimeSync = now; this.broadcast(true); }
    }
    requestAnimationFrame((t) => this.frameLoop(t));
  }

  // ---------- playback ----------
  soundtrackEl() { const m = this.project.soundtrack && this.media.get(this.project.soundtrack); return m ? m.el : null; }
  playingEls() {
    const els = new Set();
    for (const id of this.slots || []) { const m = this.media.get(id); if (m && m.kind === 'video') els.add(m.el); }
    const st = this.soundtrackEl(); if (st) els.add(st);
    return [...els];
  }
  applyMute() {
    // when an output window is connected it plays the sound; this window stays silent
    const st = this.soundtrackEl();
    for (const m of this.media.list()) {
      if (m.kind === 'image') continue;
      m.el.loop = this.project.settings.loop !== false;
      m.el.muted = !(m.el === st && !(this.output.connected && !IS_OUTPUT));
    }
  }
  play() {
    this.gesture();
    const st = this.soundtrackEl();
    if (st && !(this.output.connected && !IS_OUTPUT)) this.audio.attach(st);
    this.applyMute();
    this.playing = true;
    for (const el of this.playingEls()) el.play().catch(() => { if (!IS_OUTPUT) this.toast('Tap Play again to start playback.'); });
    this.renderTransport(); this.broadcast(true);
  }
  pause() {
    this.playing = false;
    for (const m of this.media.list()) if (m.el.pause) m.el.pause();
    this.renderTransport(); this.broadcast(true);
  }
  restart() { for (const m of this.media.list()) if (m.kind !== 'image') m.el.currentTime = 0; this.broadcast(true); }
  currentTime() { const el = this.soundtrackEl() || this.playingEls()[0]; return el ? el.currentTime : 0; }

  // first touch anywhere: unlock audio and keep the screen awake
  gesture() { this.audio.ensure(); this.keepAwake(); }
  async keepAwake() {
    if (!('wakeLock' in navigator) || (this.wakeLock && !this.wakeLock.released)) return;
    try { this.wakeLock = await navigator.wakeLock.request('screen'); } catch { /* not allowed here; fine */ }
  }

  // ---------- Show mode ----------
  setShow(on) {
    document.body.classList.toggle('show', on);
    if (on) {
      this.gesture();
      $('drawer').hidden = true; $('toolsBtn').setAttribute('aria-expanded', 'false');
      // full screen, then hold landscape on phones so a nudge doesn't rotate the projected frame
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen()
          .then(() => COARSE && screen.orientation?.lock?.('landscape'))
          .catch(() => {});
      }
      // the hint is projected too when mirroring, so it shows only until someone has left Show mode once
      if (!store.getFlag('showHintDone')) this.toast('Double-tap to go back to editing', 2500);
    } else {
      store.setFlag('showHintDone');
      screen.orientation?.unlock?.();
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
    this.renderNudge();
  }

  // ---------- persistence ----------
  scheduleSave() {
    clearTimeout(this.saveTimer);
    $('saveState').textContent = 'Saving…';
    this.saveTimer = setTimeout(() => this.save(), 400);
  }
  save() {
    this.project.media = this.media.meta().filter((m) => this.isUsed(m.id));
    const ok = store.saveProject(this.project);
    $('saveState').textContent = ok ? 'Saved on this device' : 'Not saved: this browser blocks storage here. Export a file to keep your work.';
    this.renderProjectList();
  }
  isUsed(id) { return this.project.soundtrack === id || this.project.surfaces.some((s) => s.content && s.content.mediaId === id); }

  async openProject(p) {
    this.pause();
    this.project = p;
    this.show.index = -1; this.show.fade = null;
    p.settings = { snap: true, sensitivity: 1, loop: true, ...(p.settings || {}) };
    this.editor.select(-1);
    this.editor.snap = p.settings.snap;
    this.audio.sensitivity = p.settings.sensitivity;
    const missing = await this.media.restore(p.media || []);
    const warn = $('missingMedia');
    warn.hidden = !missing.length;
    warn.textContent = missing.length ? `Not on this device: ${missing.map((m) => m.name).join(', ')}. Add the files again and reassign them.` : '';
    this.dirty = true;
    this.renderAll();
    this.broadcast();
  }

  // ---------- output window (laptop + projector as second display) ----------
  post(msg) {
    if (this.channel) this.channel.postMessage(msg);
    for (const p of this.ports) p.post(msg);
  }

  broadcast(transportOnly = false) {
    if (IS_OUTPUT || !this.output.connected) return;
    const msg = { type: 'state', playing: this.playing, time: this.currentTime() };
    if (!transportOnly) { msg.project = this.project; msg.fade = this.show.snapshot(performance.now()); msg.media = [...this.media.items.values()].map(({ id, name, kind, url }) => ({ id, name, kind, url })); }
    this.post(msg);
  }

  hello() { this.post({ type: 'hello', aspect: innerWidth / innerHeight }); }

  initOutput() {
    document.title = 'Surface Mapper output';
    document.body.classList.add('show');
    this.editor = null;
    const receiver = presentationReceiver();
    if (receiver) {
      // a second screen has no one to tap a gate: start straight away (Cast receivers allow autoplay)
      this.gesture();
      const attach = (conn) => {
        const port = new ConnectionPort(conn);
        port.onmessage = (data) => this.onState(data, port);
        port.onfile = ({ id, file }) => {
          this.media.replaceFile(id, file);
          this.dirty = true;
          if (this.playing) this.play();
        };
        port.onclose = () => this.ports.delete(port);
        this.ports.add(port);
        this.hello();
      };
      receiver.connectionList.then((list) => {
        list.connections.forEach(attach);
        list.onconnectionavailable = (e) => attach(e.connection);
      });
    } else {
      $('gate').hidden = false;
      $('gate').classList.remove('ui');
      $('gateBtn').onclick = () => {
        this.gesture();
        document.documentElement.requestFullscreen?.().catch(() => {});
        $('gate').hidden = true;
        if (this.playing) this.play();
      };
      $('stage').addEventListener('dblclick', () => document.documentElement.requestFullscreen?.().catch(() => {}));
    }
    if (this.channel) this.channel.onmessage = ({ data }) => this.onState(data, null);
    setInterval(() => this.hello(), 1000);
  }

  // output side: apply the editor's state. A port is set for a second screen, which may be another device.
  onState(data, port) {
    if (data.type === 'pattern') { this.showPattern(data.f); return; }
    if (data.type !== 'state') return;
    if (data.project) {
      this.project = data.project;
      this.show.restore(data.fade, performance.now());
      for (const m of data.media || []) {
        if (this.media.get(m.id)) continue;
        const item = this.media.addUrl(m);
        // the editor's object URL only opens in the same browser; otherwise ask for the file itself
        if (port) item.el.addEventListener('error', () => { if (this.media.get(m.id) === item) port.post({ type: 'need', id: m.id }); }, { once: true });
      }
      this.dirty = true;
    }
    if (data.playing && !this.playing) this.play();
    if (!data.playing && this.playing) this.pause();
    const el = this.soundtrackEl() || this.playingEls()[0];
    if (el && Math.abs(el.currentTime - data.time) > 0.3) for (const e of this.playingEls()) e.currentTime = data.time;
  }

  // editor side: an output said hello
  onHello(data) {
    const first = !this.output.connected;
    Object.assign(this.output, { connected: true, lastSeen: performance.now(), aspect: data.aspect });
    if (first) { this.applyMute(); this.layout(); this.renderOutputState(); this.broadcast(); this.toast('Output connected. It plays the sound; this device is silent.'); }
    else if (Math.abs(this.output.aspect - data.aspect) > 0.001) this.layout();
  }

  // ---------- second screen through the Presentation API (Chrome: Cast devices, wired or wireless displays) ----------
  initPresentation() {
    const btn = $('presentBtn');
    if (!presentationSupported()) { btn.hidden = true; $('presentNote').hidden = true; return; }
    const url = location.href.split('#')[0] + '#output';
    this.presentReq = new PresentationRequest([url]);
    try { navigator.presentation.defaultRequest = this.presentReq; } catch { /* read-only in some browsers */ }
    this.presentReq.getAvailability()
      .then((av) => { const upd = () => { btn.disabled = !av.value && !this.presenting; this.renderOutputState(); }; av.onchange = upd; upd(); })
      .catch(() => { /* can't watch for screens here; the button simply tries */ });
    this.presentReq.onconnectionavailable = (e) => this.addPresentation(e.connection);
    btn.onclick = () => {
      if (this.presenting) { this.presenting.terminate(); return; }
      this.presentReq.start().then((c) => this.addPresentation(c)).catch((err) => {
        if (err.name !== 'AbortError') this.toast('No screen to present to. Check the projector or Chromecast is on the same Wi-Fi.');
      });
    };
    // pick a running presentation back up after a reload
    const last = session('get', 'pm-presentation');
    if (last) this.presentReq.reconnect(last).then((c) => this.addPresentation(c)).catch(() => session('remove', 'pm-presentation'));
  }

  addPresentation(conn) {
    if (this.presenting === conn) return;
    this.presenting = conn;
    session('set', 'pm-presentation', conn.id);
    const port = new ConnectionPort(conn);
    port.onmessage = (data) => {
      if (data.type === 'hello') this.onHello(data);
      if (data.type === 'beat') this.remoteBeats++;
      if (data.type === 'need') {
        const m = this.media.get(data.id);
        if (!m || !m.file) return;
        this.toast(`Sending ${m.name} to the screen…`);
        port.sendFile(m.id, { blob: m.file, name: m.name, type: m.file.type });
      }
    };
    port.onclose = () => {
      this.ports.delete(port);
      if (this.presenting === conn) this.presenting = null;
      if (conn.state === 'terminated') session('remove', 'pm-presentation');
      this.renderOutputState();
    };
    this.ports.add(port);
    // the connection may open after it's handed over; say hello once it does
    if (conn.state === 'connected') this.broadcast(); else conn.addEventListener('connect', () => this.broadcast(), { once: true });
    this.renderOutputState();
  }

  // ---------- effects, including AI-written ones ----------
  renderEffectList() {
    const own = this.project.effects || [];
    const esc = (t) => String(t).replace(/[<&"]/g, '');
    $('effectList').innerHTML = EFFECTS.map((e) => `<button class="chip" data-effect="${e.id}">${e.name}</button>`).join('') +
      own.map((e) => `<span class="chip own" data-effect="${e.id}" role="button" tabindex="0" title="${esc(e.prompt || '')}">✦ ${esc(e.name)}<button data-del aria-label="Delete ${esc(e.name)}">×</button></span>`).join('');
    this.renderContentUI();
  }

  deleteEffect(id) {
    this.project.effects = (this.project.effects || []).filter((e) => e.id !== id);
    for (const s of this.project.surfaces) if (s.content?.effect === id) s.content = { kind: 'effect', effect: 'outline' };
    this.changed(); this.renderEffectList();
  }

  initAI() {
    const status = $('aiStatus');
    const showKey = () => { const has = !!getKey(); $('aiKeyRow').hidden = has; $('aiKeyForget').hidden = !has; $('aiGo').disabled = !has; };
    $('aiKeySave').onclick = () => {
      const k = $('aiKey').value.trim();
      if (!/^sk-ant-/.test(k)) { status.textContent = 'That doesn\'t look like an Anthropic API key (they start with sk-ant-).'; return; }
      setKey(k); $('aiKey').value = ''; showKey(); status.textContent = 'Key saved on this device.';
    };
    $('aiKeyForget').onclick = () => { setKey(''); showKey(); status.textContent = 'Key removed from this device.'; };
    $('aiGo').onclick = () => this.runAI();
    $('aiCancel').onclick = () => this.aiAbort?.abort();
    showKey();
  }

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
      $('aiGo').disabled = !getKey(); $('aiCancel').hidden = true;
    }
  }

  // guardrail: if a new effect makes the frame rate collapse, put the previous look back
  watchFrameRate(revert, name) {
    const before = this.fps || 60;
    setTimeout(() => {
      if (this.fps < 20 && before > 35) { revert(); this.toast(`"${name}" was too heavy for this device, so the previous look is back. It stays in the effect list.`, 5000); }
    }, 3000);
  }

  // ---------- cues and timeline ----------
  onCue() {
    this.changed();
    this.renderShowUI();
  }

  initShowUI() {
    const list = $('cueList');
    $('cueAdd').onclick = () => {
      if (!this.project.surfaces.length) { this.toast('Add surfaces first: a cue remembers what each one shows.'); return; }
      const cues = this.show.cues;
      cues.push(newCue(this.project.surfaces, cues.length + 1));
      this.show.index = cues.length - 1;
      this.scheduleSave(); this.renderShowUI();
      this.toast('Cue saved. Change what the surfaces show, then add the next cue.');
    };
    $('cueGo').onclick = () => { if (this.show.index < 0) this.show.go(0); else this.show.next(); };
    $('cueFirst').onclick = () => { this.show.go(0, { transition: false }); if (this.soundtrackEl()) this.restart(); };
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const i = +b.closest('[data-i]').dataset.i, cues = this.show.cues, c = cues[i];
      const act = b.dataset.act;
      if (act === 'go') this.show.go(i);
      if (act === 'save') { Object.assign(c, { looks: newCue(this.project.surfaces, 0).looks }); this.toast(`${c.name} now has the current look.`); }
      if (act === 'up' && i > 0) [cues[i - 1], cues[i]] = [cues[i], cues[i - 1]];
      if (act === 'down' && i < cues.length - 1) [cues[i + 1], cues[i]] = [cues[i], cues[i + 1]];
      if (act === 'del') { cues.splice(i, 1); if (this.show.index >= cues.length) this.show.index = cues.length - 1; }
      if (act === 'now') { c.start.value = Math.round(this.currentTime() * 10) / 10; }
      this.scheduleSave(); this.renderShowUI();
    });
    list.addEventListener('change', (e) => {
      const el = e.target, i = +el.closest('[data-i]').dataset.i, c = this.show.cues[i];
      if (el.dataset.f === 'name') c.name = el.value.trim() || c.name;
      if (el.dataset.f === 'mode') { c.start.mode = el.value; c.start.value = el.value === 'after' ? 5 : el.value === 'beats' ? 8 : el.value === 'at' ? Math.round(this.currentTime() * 10) / 10 : 0; }
      if (el.dataset.f === 'value') {
        const v = c.start.mode === 'at' ? parseTime(el.value) : parseFloat(el.value);
        if (v != null && v >= 0) c.start.value = v;
      }
      if (el.dataset.f === 'type') c.transition.type = el.value;
      if (el.dataset.f === 'dur') { const v = parseFloat(el.value); if (v >= 0) c.transition.dur = v; }
      this.scheduleSave(); this.renderShowUI();
    });
    $('timeline').addEventListener('pointerdown', (e) => {
      const st = this.soundtrackEl(); if (!st || !st.duration) return;
      const r = e.currentTarget.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * st.duration;
      for (const el of this.playingEls()) el.currentTime = t;
      this.broadcast(true);
    });
    this.renderShowUI();
  }

  renderShowUI() {
    const cues = this.show.cues, list = $('cueList');
    const esc = (t) => String(t).replace(/[<&"]/g, '');
    const opt = (v, label, cur) => `<option value="${v}"${v === cur ? ' selected' : ''}>${label}</option>`;
    list.innerHTML = cues.map((c, i) => {
      const m = c.start.mode;
      const val = m === 'tap' ? '' : `<input type="text" inputmode="decimal" data-f="value" aria-label="${m === 'at' ? 'Time in the soundtrack' : m === 'after' ? 'Seconds' : 'Beats'}" value="${m === 'at' ? fmtTime(c.start.value) : c.start.value}">${m === 'at' ? '<button class="btn" data-act="now" title="Use the soundtrack\'s current time">Now</button>' : `<span class="note">${m === 'after' ? 's' : 'beats'}</span>`}`;
      return `<div class="cue${i === this.show.index ? ' live' : ''}" data-i="${i}">
        <div class="row"><input type="text" data-f="name" aria-label="Cue name" value="${esc(c.name)}"><button class="btn${i === this.show.index ? ' primary' : ''}" data-act="go">Go</button></div>
        <div class="row"><select data-f="mode" aria-label="How it starts">${opt('tap', 'On a tap', m)}${opt('after', 'After the previous, by', m)}${opt('beats', 'After the previous, beats', m)}${opt('at', 'At a time in the song', m)}</select>${val}</div>
        <div class="row"><select data-f="type" aria-label="Transition">${opt('fade', 'Crossfade', c.transition.type)}${opt('cut', 'Cut', c.transition.type)}${opt('wipe', 'Wipe across', c.transition.type)}</select>
          ${c.transition.type === 'cut' ? '' : `<input type="text" inputmode="decimal" data-f="dur" aria-label="Transition seconds" value="${c.transition.dur}"><span class="note">s</span>`}</div>
        <div class="row"><button class="btn" data-act="save">Save current look</button><button class="btn" data-act="up" aria-label="Move up"${i ? '' : ' disabled'}>↑</button><button class="btn" data-act="down" aria-label="Move down"${i < cues.length - 1 ? '' : ' disabled'}>↓</button><button class="btn" data-act="del">Delete</button></div>
      </div>`;
    }).join('') || '<p class="note">No cues yet. Set up a look on the surfaces, then add it as a cue.</p>';
    const cur = cues[this.show.index];
    $('cueState').textContent = cur ? `On stage: ${cur.name} (${this.show.index + 1} of ${cues.length})` : cues.length ? 'No cue running yet: tap Go.' : '';
    $('cueGo').textContent = this.show.index < 0 ? 'Go: first cue' : 'Go: next cue';
    $('cueGo').disabled = !cues.length || this.show.index >= cues.length - 1;
    $('cueFirst').disabled = !cues.length;
    $('timelineGroup').hidden = !cues.some((c) => c.start.mode === 'at');
    this.timelineKey = '';
  }

  // the soundtrack as a strip, with a marker per timed cue and the playhead
  drawTimeline() {
    const tl = $('timeline');
    if ($('drawer').hidden || $('timelineGroup').hidden || tl.offsetParent === null) return;
    const st = this.soundtrackEl(), dur = st && st.duration && isFinite(st.duration) ? st.duration : 0;
    const key = dur + '|' + this.show.cues.map((c) => c.start.mode + c.start.value).join() + '|' + this.show.index;
    if (key !== this.timelineKey) {
      this.timelineKey = key;
      tl.innerHTML = dur ? '<i class="playhead"></i>' + this.show.cues.map((c, i) => c.start.mode === 'at' ? `<b class="${i === this.show.index ? 'live' : ''}" style="left:${Math.min(100, c.start.value / dur * 100)}%"><span>${i + 1}</span></b>` : '').join('') : '<span class="note">Pick a soundtrack in Sound to place cues in time.</span>';
    }
    const ph = tl.querySelector('.playhead');
    if (ph) ph.style.left = dur ? (st.currentTime / dur * 100) + '%' : '0';
  }

  // ---------- device check ----------
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
  }

  // ---------- find surfaces with the camera (structured light) ----------
  // a capture pattern over the whole frame; null hides it
  showPattern(f) {
    const c = $('pattern');
    if (!f) { c.hidden = true; return; }
    const [W, H] = this.frame;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    drawPattern(c.getContext('2d'), f, W, H);
    c.hidden = false;
  }

  initScan() {
    const sheet = $('scanSheet');
    this.camera = new Camera($('scanVideo'));
    $('scanBtn').onclick = () => {
      this.toggleDrawer(false);
      $('scanView').hidden = true; $('scanUndo').hidden = true;
      sheet.showModal();
      this.openCamera($('scanCam').value);
    };
    $('closeScan').onclick = () => sheet.close();
    sheet.addEventListener('close', () => { if (!this.scanning) this.camera.close(); });
    $('scanCam').onchange = (e) => this.openCamera(e.target.value);
    $('scanStart').onclick = () => this.runScan();
    $('scanUndo').onclick = () => {
      if (!this.scanPrev) return;
      this.project.surfaces = this.scanPrev; this.scanPrev = null;
      this.editor.select(-1); this.changed();
      $('scanUndo').hidden = true;
      $('scanStatus').textContent = 'Your earlier surfaces are back.';
    };
    // cancel a capture: tap anywhere, or Escape
    $('stage').addEventListener('pointerdown', () => { if (this.scanning) this.scanAbort?.abort(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.scanning) this.scanAbort?.abort(); });
  }

  async openCamera(deviceId) {
    const status = $('scanStatus');
    $('scanStart').disabled = true;
    status.textContent = 'Opening the camera…';
    try {
      const used = await this.camera.open(deviceId || undefined);
      // camera names are only readable once permission is granted
      const cams = await listCameras(), sel = $('scanCam');
      if (cams.length > 1) {
        sel.innerHTML = cams.map((c, i) => `<option value="${c.deviceId}">${(c.label || 'Camera ' + (i + 1)).replace(/[<&"]/g, '')}</option>`).join('');
        sel.value = used || deviceId || cams[0].deviceId;
      }
      sel.hidden = cams.length < 2;
      $('scanStart').disabled = false;
      status.textContent = 'Aim the camera at the set, then tap Start. Use the main camera, not the ultra-wide one.';
    } catch (err) {
      status.textContent = err.message;
    }
  }

  async runScan() {
    const sheet = $('scanSheet'), status = $('scanStatus');
    const [W, H] = this.frame;
    // with an output window or second screen the patterns go there and this screen shows progress;
    // otherwise this screen is the projector, so everything but the pattern is hidden
    const remote = this.output.connected;
    const show = (f) => { if (remote) this.post({ type: 'pattern', f }); else this.showPattern(f); };
    this.scanning = true;
    this.scanAbort = new AbortController();
    $('scanStart').disabled = true; $('scanUndo').hidden = true; $('scanView').hidden = true;
    if (!remote) {
      sheet.close();
      document.body.classList.add('capturing');
      this.gesture();
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    }
    let message;
    try {
      const cap = await runCapture(this.camera, {
        W, H, show, signal: this.scanAbort.signal,
        progress: (i, n, text) => { status.textContent = text; },
      });
      show(null);
      status.textContent = 'Looking for flat surfaces…';
      await new Promise((r) => setTimeout(r, 30));
      const res = surfacesFromShots(cap.shots, { camW: cap.camW, camH: cap.camH, W, H, keepBackground: $('scanKeepBg').checked });
      this.drawScan(res);
      if (!res.surfaces.length) throw new CaptureError(res.planes ? 'Only wall and floor were found. Tick "Keep wall and floor" to use them, or bring objects closer to the projector.' : 'No flat surfaces were found. Check the camera sees the projection clearly, and dim the lights.');
      this.scanPrev = this.project.surfaces;
      this.project.surfaces = res.surfaces;
      this.editor.select(-1);
      this.changed();
      $('scanUndo').hidden = !this.scanPrev.length;
      message = `Found ${res.surfaces.length} surface${res.surfaces.length === 1 ? '' : 's'}` +
        (res.background && !$('scanKeepBg').checked ? `; ${res.background} wall or floor area${res.background === 1 ? '' : 's'} left out` : '') + '.\n' +
        `The camera decoded ${Math.round(res.coverage * 100)}% of the frame. Projection lag ${Math.round(cap.latency)} ms.` +
        (cap.locked.length ? ` Locked ${cap.locked.join(', ')}.` : '') +
        (res.degenerate ? '\nAlmost everything looked like one plane: move the camera further to the side of the projector.' : '') +
        '\nCheck each surface in Edit mode and drag any corner that is off.';
    } catch (err) {
      message = err instanceof CaptureError ? err.message : 'The capture failed: ' + (err.message || err);
    } finally {
      show(null);
      document.body.classList.remove('capturing');
      this.scanning = false;
      $('scanStart').disabled = false;
      if (!sheet.open) sheet.showModal();
      status.textContent = message;
      ($('scanView').hidden ? status : $('scanView')).scrollIntoView({ block: 'nearest' });
    }
  }

  // the flat areas found, one colour each, in the projector frame (grey: wall and floor)
  drawScan(res) {
    const { GW, GH, regions } = res.res, c = $('scanView');
    c.width = GW; c.height = GH;
    const ctx = c.getContext('2d'), img = ctx.createImageData(GW, GH);
    regions.forEach((r, i) => {
      const keep = !r.background || $('scanKeepBg').checked;
      const h = (i * 0.137) % 1, col = keep ? [0, 8, 4].map((n) => { const k = (n + h * 12) % 12; return 255 * (0.55 - 0.41 * Math.max(-1, Math.min(k - 3, 9 - k, 1))); }) : [45, 52, 64];
      for (const cell of r.cells) img.data.set([col[0], col[1], col[2], 255], cell * 4);
    });
    for (let k = 3; k < img.data.length; k += 4) if (!img.data[k]) img.data[k] = 255;
    ctx.putImageData(img, 0, 0);
    c.hidden = false;
  }

  // laptop: put the output window on the projector straight away when the browser can see the second display
  async outputFeatures() {
    try {
      if (window.screen.isExtended && 'getScreenDetails' in window) {
        const d = await window.getScreenDetails();
        const s = d.screens.find((x) => x !== d.currentScreen);
        if (s) return `popup,left=${s.availLeft},top=${s.availTop},width=${s.availWidth},height=${s.availHeight}`;
      }
    } catch { /* permission refused: open it here and let the user drag it */ }
    return 'popup,width=960,height=540';
  }

  // ---------- editor UI ----------
  initEditor() {
    this.editor = new Editor(this, $('overlay'));
    // open the last project, or start one
    const idx = store.listProjects();
    const last = idx.current && store.loadProject(idx.current);
    this.openProject(last || store.newProject());

    $('toolsBtn').onclick = () => this.toggleDrawer();
    $('closeDrawer').onclick = () => this.toggleDrawer(false);
    $('showBtn').onclick = () => this.setShow(true);
    for (const b of ['playBtn', 'playBtn2']) $(b).onclick = () => (this.playing ? this.pause() : this.play());
    $('restartBtn').onclick = () => this.restart();
    document.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => this.selectTab(b.dataset.tab); });

    // leave Show mode: double-tap, or a long press
    const stage = $('stage');
    let pressT = 0, lastTap = 0;
    let nextT = 0;
    stage.addEventListener('pointerdown', () => {
      if (!document.body.classList.contains('show')) return;
      const now = performance.now();
      clearTimeout(nextT);
      if (now - lastTap < 350) { this.setShow(false); lastTap = 0; return; }
      lastTap = now;
      pressT = setTimeout(() => this.setShow(false), 900);
      // a single tap runs the next cue, once it's clear it wasn't the start of a double-tap
      if (this.show.cues.length) nextT = setTimeout(() => { if (document.body.classList.contains('show')) this.show.next(); }, 360);
    });
    stage.addEventListener('pointerup', () => clearTimeout(pressT));
    window.addEventListener('keydown', (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
      if (e.key === 'Escape' && document.body.classList.contains('show')) { this.setShow(false); return; }
      if ((e.key === ' ' || e.key === 'PageDown' || (e.key === 'ArrowRight' && document.body.classList.contains('show'))) && this.show.cues.length) { e.preventDefault(); this.show.next(); return; }
      const step = e.shiftKey ? 10 : 1;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d && this.editor.sel >= 0) { e.preventDefault(); this.editor.nudge(...d); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.editor.mode === 'points' && this.editor.selVert) { e.preventDefault(); const err = this.editor.deletePoint(); if (err) this.toast(err); }
    });

    // surfaces
    document.querySelectorAll('[data-add]').forEach((b) => {
      b.onclick = () => { this.editor.addSurface(newSurface(b.dataset.add, this.project.surfaces.length)); this.toast('Drag it onto a real surface, then drag its corners into place.'); };
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

    // content
    $('effectList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-effect]'); if (!b) return;
      if (e.target.closest('[data-del]')) { this.deleteEffect(b.dataset.effect); return; }
      this.setContent({ kind: 'effect', effect: b.dataset.effect });
    });
    this.renderEffectList();
    this.initAI();
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

    // sound
    $('addAudio').onchange = async (e) => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try { const m = await this.media.add(f); this.project.soundtrack = m.id; this.applyMute(); this.renderSoundUI(); this.scheduleSave(); } catch (err) { this.toast(err.message); }
    };
    $('soundtrack').onchange = (e) => {
      const was = this.playing; this.pause();
      this.project.soundtrack = e.target.value || null; this.applyMute(); this.scheduleSave();
      if (was) this.play();
    };
    $('loop').onchange = (e) => { this.project.settings.loop = e.target.checked; this.applyMute(); this.scheduleSave(); };
    $('sens').oninput = (e) => { this.audio.sensitivity = this.project.settings.sensitivity = parseFloat(e.target.value); this.scheduleSave(); };
    $('micToggle').onchange = async (e) => {
      try { await this.audio.useMic(e.target.checked); } catch (err) { e.target.checked = false; this.toast(err.message || 'The microphone is not available.'); }
    };

    // project
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
    if (this.channel) this.channel.onmessage = ({ data }) => { if (data.type === 'hello') this.onHello(data); if (data.type === 'beat') this.remoteBeats++; };
    if (!this.channel) $('openOutput').disabled = true;
    this.initPresentation();
    this.initScan();
    this.initCheck();
    this.initShowUI();

    // how to connect: a guide sheet, opened by itself the first time the app runs
    const sheet = $('connectSheet');
    for (const id of ['connectBtn', 'connectBtn2']) $(id).onclick = () => sheet.showModal();
    $('closeConnect').onclick = () => sheet.close();
    sheet.addEventListener('close', () => store.setFlag('connectSeen'));
    if (!store.getFlag('connectSeen') && sheet.showModal) sheet.showModal();
    this.selectTab('surfaces');
  }

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
  }

  setContent(patch, merge = false) {
    const s = this.project.surfaces[this.editor.sel];
    if (!s) { this.toast('Select a surface first: tap it in the frame or in the Surfaces list.'); return; }
    s.content = merge ? { ...s.content, ...patch } : patch;
    if (s.content.kind === 'media') { const m = this.media.get(s.content.mediaId); if (m && m.kind === 'video' && this.playing) m.el.play().catch(() => {}); }
    this.changed();
  }

  toggleDrawer(force) {
    const d = $('drawer'), open = force ?? d.hidden;
    d.hidden = !open;
    $('toolsBtn').setAttribute('aria-expanded', String(open));
    this.renderNudge();
  }
  selectTab(tab) {
    document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    document.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== tab; });
  }

  // ---------- rendering the UI from state ----------
  renderAll() {
    if (this.editor) this.renderEffectList();
    this.renderSurfaceUI(); this.renderContentUI(); this.renderMediaUI(); this.renderSoundUI(); this.renderProjectList(); this.renderTransport();
    if (this.editor) this.renderShowUI();
    $('projName').value = this.project.name;
    $('snap').checked = this.project.settings.snap !== false;
    $('loop').checked = this.project.settings.loop !== false;
    $('sens').value = this.project.settings.sensitivity || 1;
  }
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
  }
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
  }

  renderNudge() {
    const t = this.editor && !document.body.classList.contains('show') ? this.editor.nudgeTarget() : '';
    const pad = $('nudge');
    pad.hidden = !t;
    if (t) { $('nudgeLabel').textContent = 'Nudge ' + t; pad.style.left = ''; }
  }
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
  }
  renderMediaUI() {
    const list = $('mediaList');
    list.innerHTML = '';
    const visual = this.media.list().filter((m) => m.kind !== 'audio');
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
  }
  renderSoundUI() {
    const sel = $('soundtrack');
    sel.innerHTML = '<option value="">No soundtrack</option>' + this.media.list().filter((m) => m.kind !== 'image')
      .map((m) => `<option value="${m.id}">${m.kind === 'video' ? 'Sound of video: ' : ''}${m.name.replace(/[<&"]/g, '')}</option>`).join('');
    sel.value = this.project.soundtrack && this.media.get(this.project.soundtrack) ? this.project.soundtrack : '';
  }
  renderTransport() {
    for (const id of ['playBtn', 'playBtn2']) {
      const b = $(id), label = this.playing ? 'Pause' : 'Play';
      if (id === 'playBtn') {
        b.querySelector('span').textContent = label;
        b.querySelector('svg').innerHTML = this.playing ? '<path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/>' : '<path d="M4 2.5v11l9-5.5z"/>';
      } else b.textContent = label;
    }
  }
  renderProjectList() {
    const idx = store.listProjects(), sel = $('projList');
    const list = idx.list.some((p) => p.id === this.project.id) ? idx.list : idx.list.concat([{ id: this.project.id, name: this.project.name }]);
    sel.innerHTML = list.map((p) => `<option value="${p.id}">${(p.name || 'Untitled').replace(/[<&"]/g, '')}</option>`).join('');
    sel.value = this.project.id;
  }
  renderOutputState() {
    $('outputState').textContent = this.presenting ? 'Presenting to a second screen' : this.output.connected ? 'Output window connected' : '';
    $('presentBtn').textContent = this.presenting ? 'Stop presenting' : 'Present to a screen';
    if (this.presenting) $('presentBtn').disabled = false;
  }

  drawMeter(a) {
    if ($('drawer').hidden) return;
    $('mBass').style.height = Math.round(a.bass * 100) + '%';
    $('mMid').style.height = Math.round(a.mid * 100) + '%';
    $('mTreble').style.height = Math.round(a.treble * 100) + '%';
    $('mBeat').style.background = a.beat > 0.3 ? 'var(--lamp)' : 'var(--raise)';
  }

  toast(text, ms = 3200) {
    const t = $('toast');
    t.textContent = text; t.hidden = false; t.style.opacity = '1';
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => { t.style.opacity = '0'; setTimeout(() => { t.hidden = true; }, 300); }, ms);
  }
}

// offline support when served over http(s); unavailable in embedded previews, which is fine
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

try {
  window.app = new App();
} catch (err) {
  document.body.innerHTML = `<p style="padding:24px;font:16px system-ui;color:#e3e8ef">Surface Mapper can't start on this device: ${String(err.message || err).replace(/</g, '&lt;')}</p>`;
}
