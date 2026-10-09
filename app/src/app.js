// Surface Mapper: a phone-first projection mapping app.
// The whole screen is the projector frame (mirror the phone to the projector), or, on a laptop, a separate output
// window placed on the projector display. Surfaces are traced on that frame, filled with effects or media, and
// driven by sound.
import { Renderer, MAX_MEDIA } from './renderer.js';
import { surfaceGeom } from './geometry.js';
import { Editor } from './editor.js';
import { AudioEngine } from './audio.js';
import { MediaLibrary } from './media.js';
import { ConnectionPort, presentationSupported, presentationReceiver } from './link.js';
import { drawPattern } from './capture.js';
import { ShowRunner } from './show.js';
import { namespaced } from './ai.js';
import { $, IS_OUTPUT, COARSE, FIT_CODE, session } from './env.js';
import * as store from './store.js';
import { surfacesUI } from './ui/surfaces.js';
import { contentUI } from './ui/content.js';
import { soundUI } from './ui/sound.js';
import { cuesUI } from './ui/cues.js';
import { projectUI } from './ui/project.js';
import { scanUI } from './ui/scan.js';

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
    // an output display plays the sound, so it reports each beat to the editor as the audio thread counts it
    this.audio.onbeat = () => { if (IS_OUTPUT && this.playing) this.post({ type: 'beat' }); };
    // cues that start by themselves are checked on a timer, not per frame, so a slow frame can't delay them
    if (!IS_OUTPUT) setInterval(() => this.cueTick(), 10);
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
    const fit = this.renderer.setSurfaces(this.geoms, fx, from ? this.project.surfaces.map((s) => fxOf(from[s.id] || s.content)) : fx);
    const over = fit.surfaces < fit.of || fit.droppedParts > 0 ? fit : null;
    if (!IS_OUTPUT && JSON.stringify(over) !== JSON.stringify(this.overLimit || null)) { this.overLimit = over; this.renderSurfaceUI(); }
    this.dirty = false;
  }

  frameLoop(now) {
    const dt = now - (this.lastNow || now); this.lastNow = now;
    if (dt > 0 && dt < 5000) this.fps = this.fps ? this.fps * 0.95 + 50 / dt : 1000 / dt;   // smoothed frame rate; long gaps (a hidden tab) are skipped
    if (this.dirty) this.sync();
    const sounding = this.playing && !!this.soundtrackEl() && !(this.output.connected && !IS_OUTPUT);
    const a = this.audio.update(now, sounding);
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

  // beats so far, from wherever the sound is playing (this device, or a connected output)
  beatCount() { return this.output.connected ? this.remoteBeats : this.audio.beats; }

  cueTick() {
    const sounding = this.output.connected || (this.playing && !!this.soundtrackEl()) || !!this.audio.mic;
    this.show.tick(performance.now(), { active: sounding, beats: this.beatCount() }, this.soundtrackEl() ? this.currentTime() : null, this.playing);
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

  // media worth keeping with the project: on a surface now, in any cue's look, the soundtrack, or the design photo
  isUsed(id) {
    const p = this.project;
    return p.soundtrack === id || p.backdrop?.mediaId === id || p.surfaces.some((s) => s.content && s.content.mediaId === id) ||
      (p.cues || []).some((c) => Object.values(c.looks).some((l) => l && l.mediaId === id));
  }

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
        this.toast(`Sending ${m.name} to the screen…`, 8000);
        port.sendFile(m.id, { blob: m.file, name: m.name, type: m.file.type });
      }
    };
    port.onprogress = ({ name, sent, total }) => {
      this.toast(sent >= total ? `${name} is on the screen.` : `Sending ${name} to the screen: ${Math.floor(sent / total * 100)}%`, sent >= total ? 3200 : 8000);
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

    if (this.channel) this.channel.onmessage = ({ data }) => { if (data.type === 'hello') this.onHello(data); if (data.type === 'beat') this.remoteBeats++; };
    if (!this.channel) $('openOutput').disabled = true;
    for (const init of ['initSurfacesUI', 'initContentUI', 'initSoundUI', 'initProjectUI', 'initCuesUI', 'initScan']) this[init]();
    this.initPresentation();
    this.selectTab('surfaces');
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
    if (this.editor) { this.renderEffectList(); this.renderBackdrop(); }
    this.renderSurfaceUI(); this.renderContentUI(); this.renderMediaUI(); this.renderSoundUI(); this.renderProjectList(); this.renderTransport();
    if (this.editor) this.renderShowUI();
    $('projName').value = this.project.name;
    $('snap').checked = this.project.settings.snap !== false;
    $('loop').checked = this.project.settings.loop !== false;
    $('sens').value = this.project.settings.sensitivity || 1;
  }

  toast(text, ms = 3200) {
    const t = $('toast');
    t.textContent = text; t.hidden = false; t.style.opacity = '1';
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => { t.style.opacity = '0'; setTimeout(() => { t.hidden = true; }, 300); }, ms);
  }
}

// each drawer pane's wiring and rendering lives in its own module under ui/
Object.assign(App.prototype, surfacesUI, contentUI, soundUI, cuesUI, projectUI, scanUI);

// offline support when served over http(s); unavailable in embedded previews, which is fine
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

try {
  window.app = new App();
} catch (err) {
  document.body.innerHTML = `<p style="padding:24px;font:16px system-ui;color:#e3e8ef">Surface Mapper can't start on this device: ${String(err.message || err).replace(/</g, '&lt;')}</p>`;
}
