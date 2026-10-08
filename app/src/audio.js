// Audio analysis for audio-reactive effects: bass, mid, treble and level (0..1) plus a beat pulse.
// Sources: any media element the app plays (routed through Web Audio so it is still heard), or the microphone.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.sources = new WeakMap();
    this.mic = null;
    this.sensitivity = 1;
    this.state = { bass: 0, mid: 0, treble: 0, level: 0, beat: 0, beats: 0, active: false };
    this.avgBass = 0; this.lastBeat = 0;
  }

  // must be called from a user gesture the first time (browsers block audio until then)
  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.6;
      this.bins = new Uint8Array(this.analyser.frequencyBinCount);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  // route a media element through the analyser; it keeps playing out loud
  attach(el) {
    if (!this.ensure() || this.sources.has(el)) return;
    try {
      const src = this.ctx.createMediaElementSource(el);
      src.connect(this.analyser);
      src.connect(this.ctx.destination);
      this.sources.set(el, src);
    } catch { /* already attached elsewhere or not allowed */ }
  }

  async useMic(on) {
    if (!on) {
      if (this.mic) { this.mic.stream.getTracks().forEach((t) => t.stop()); this.mic.src.disconnect(); this.mic = null; }
      return true;
    }
    if (!this.ensure() || !navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot use the microphone.');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const src = this.ctx.createMediaStreamSource(stream);
    src.connect(this.analyser);                       // analysed only, never played back (no feedback)
    this.mic = { stream, src };
    return true;
  }

  update(now, sounding) {
    const s = this.state;
    s.beat *= 0.86;
    if (!this.analyser || !(sounding || this.mic)) { s.active = false; s.bass *= 0.9; s.mid *= 0.9; s.treble *= 0.9; s.level *= 0.9; return s; }
    this.analyser.getByteFrequencyData(this.bins);
    const hz = this.ctx.sampleRate / 2 / this.bins.length;
    const band = (lo, hi) => {
      let sum = 0, n = 0;
      for (let i = Math.max(1, Math.floor(lo / hz)); i <= Math.min(this.bins.length - 1, Math.ceil(hi / hz)); i++) { sum += this.bins[i]; n++; }
      return n ? Math.min(1, (sum / n / 255) * this.sensitivity * 1.4) : 0;
    };
    s.bass = band(30, 150); s.mid = band(150, 2000); s.treble = band(2000, 10000);
    s.level = Math.min(1, (s.bass + s.mid + s.treble) / 3 * 1.3);
    // beat: bass jumps well above its recent average, at most ~4 per second
    this.avgBass = this.avgBass * 0.95 + s.bass * 0.05;
    if (s.bass > this.avgBass * 1.3 + 0.08 && now - this.lastBeat > 250) { s.beat = 1; s.beats++; this.lastBeat = now; }
    s.active = true;
    return s;
  }
}
