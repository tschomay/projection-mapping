/* global AudioWorkletProcessor, registerProcessor, sampleRate */
// Audio-thread analysis (AudioWorklet): bass, mid and treble levels and beats, measured on the audio itself, so a
// slow frame on the main thread can't make the app miss a beat. The input has three channels: the sound through
// a low-pass (bass), band-pass (mid) and high-pass (treble) filter. Every WINDOW samples it posts
// { bass, mid, treble, beats, at } with levels in 0..1, a running beat count and the latest beat's audio time.
const WINDOW = 1024;   // about 21 ms at 48 kHz

class Bands extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sum = [0, 0, 0];
    this.n = 0;
    this.avgBass = 0;
    this.beats = 0;
    this.lastBeat = -1;
    this.t = 0;          // samples processed
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const frames = (input[0] || []).length || 128;
    for (let c = 0; c < 3; c++) {
      const ch = input[c];
      if (!ch) continue;
      let s = 0; for (let i = 0; i < ch.length; i++) s += ch[i] * ch[i];
      this.sum[c] += s;
    }
    this.n += frames; this.t += frames;
    if (this.n >= WINDOW) {
      // RMS in dB, mapped so -70 dB is 0 and -10 dB is 1
      const level = this.sum.map((s) => Math.max(0, Math.min(1, (10 * Math.log10(s / this.n + 1e-12) + 70) / 60)));
      const [bass, mid, treble] = level;
      // a beat: bass jumps well above its recent average, at most four per second
      const now = this.t / sampleRate;
      if (bass > this.avgBass * 1.3 + 0.08 && now - this.lastBeat > 0.25) { this.beats++; this.lastBeat = now; }
      this.avgBass = this.avgBass * 0.95 + bass * 0.05;
      this.port.postMessage({ bass, mid, treble, beats: this.beats, at: this.lastBeat });   // at: audio time of the latest beat, s
      this.sum = [0, 0, 0]; this.n = 0;
    }
    return true;
  }
}

registerProcessor('bands', Bands);
