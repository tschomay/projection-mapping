// Audio analysis for audio-reactive effects: bass, mid, treble and level (0..1) plus beats.
// Sources: any media element the app plays (routed through Web Audio so it is still heard), or the microphone.
// The measuring happens on the audio thread (beat-worklet.js) so beats are counted even when frames are slow; the
// main thread only reads the latest values. Browsers without AudioWorklet fall back to an AnalyserNode polled on a
// timer (not per frame, for the same reason).

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.input = null;          // everything analysed goes in here
    this.sources = new WeakMap();
    this.mic = null;
    this.sensitivity = 1;
    this.raw = { bass: 0, mid: 0, treble: 0 };
    this.beats = 0;             // running count from the analysis, independent of the frame rate
    this.lastBeatAt = -1e9;     // performance.now() of the latest beat
    this.onbeat = () => {};
    this.state = { bass: 0, mid: 0, treble: 0, level: 0, beat: 0, beats: 0, active: false };
  }

  // must be called from a user gesture the first time (browsers block audio until then)
  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      // mono mix of everything analysed
      this.input = new GainNode(this.ctx, { channelCount: 1, channelCountMode: 'explicit', channelInterpretation: 'speakers' });
      this.ready = this.ctx.audioWorklet
        ? this.ctx.audioWorklet.addModule(new URL('./beat-worklet.js', import.meta.url)).then(() => this.buildWorklet(), () => this.buildAnalyser())
        : Promise.resolve(this.buildAnalyser());
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  buildWorklet() {
    const ctx = this.ctx;
    const merge = new ChannelMergerNode(ctx, { numberOfInputs: 3 });
    const filters = [
      new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 150, Q: 0.7 }),
      new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 550, Q: 0.6 }),
      new BiquadFilterNode(ctx, { type: 'highpass', frequency: 2000, Q: 0.7 }),
    ];
    filters.forEach((f, i) => { this.input.connect(f); f.connect(merge, 0, i); });
    const node = new AudioWorkletNode(ctx, 'bands', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 3, channelCountMode: 'explicit', channelInterpretation: 'discrete' });
    merge.connect(node);
    // keep it in the rendered graph without making a sound
    node.connect(new GainNode(ctx, { gain: 0 })).connect(ctx.destination);
    node.port.onmessage = ({ data }) => this.receive(data);
    this.node = node;
  }

  buildAnalyser() {
    const an = new AnalyserNode(this.ctx, { fftSize: 1024, smoothingTimeConstant: 0.6 });
    this.input.connect(an);
    const bins = new Uint8Array(an.frequencyBinCount);
    let avg = 0, last = -1e9, beats = 0;
    setInterval(() => {
      an.getByteFrequencyData(bins);
      const hz = this.ctx.sampleRate / 2 / bins.length;
      const band = (lo, hi) => {
        let sum = 0, n = 0;
        for (let i = Math.max(1, Math.floor(lo / hz)); i <= Math.min(bins.length - 1, Math.ceil(hi / hz)); i++) { sum += bins[i]; n++; }
        return n ? sum / n / 255 * 1.4 : 0;
      };
      const bass = Math.min(1, band(30, 150)), now = performance.now();
      if (bass > avg * 1.3 + 0.08 && now - last > 250) { beats++; last = now; }
      avg = avg * 0.95 + bass * 0.05;
      this.receive({ bass, mid: Math.min(1, band(150, 2000)), treble: Math.min(1, band(2000, 10000)), beats });
    }, 20);
  }

  receive({ bass, mid, treble, beats }) {
    this.raw = { bass, mid, treble };
    if (beats > this.beats) { this.beats = beats; this.lastBeatAt = performance.now(); this.onbeat(beats); }
  }

  // route a media element through the analysis; it keeps playing out loud
  attach(el) {
    if (!this.ensure() || this.sources.has(el)) return;
    try {
      const src = this.ctx.createMediaElementSource(el);
      src.connect(this.input);
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
    src.connect(this.input);                          // analysed only, never played back (no feedback)
    this.mic = { stream, src };
    return true;
  }

  // the values effects see this frame (sensitivity applied, beat pulse decaying since the latest beat)
  update(now, sounding) {
    const s = this.state, k = this.sensitivity;
    s.active = !!(this.ctx && (sounding || this.mic));
    const ease = (cur, v) => (s.active ? v : cur * 0.9);
    s.bass = ease(s.bass, Math.min(1, this.raw.bass * k));
    s.mid = ease(s.mid, Math.min(1, this.raw.mid * k));
    s.treble = ease(s.treble, Math.min(1, this.raw.treble * k));
    s.level = Math.min(1, (s.bass + s.mid + s.treble) / 3 * 1.3);
    s.beat = Math.exp(-(now - this.lastBeatAt) / 110);
    s.beats = this.beats;
    return s;
  }
}
