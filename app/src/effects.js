// Built-in effects. Each defines `vec3 fx_<id>(Surf2 s, float t)`.
// Available to every effect (see HEAD in renderer.js): the Surf2 fields, helpers (hash1, hash2, noise, fbm, hsv,
// pal), and audio: uAudio = (bass, mid, treble, level) in 0..1, uBeat = pulse that jumps to 1 on a beat and
// decays, uBeats = beat count, uHasAudio = 1 when sound is being analysed.

export const EFFECTS = [
  { id: 'outline', name: 'Alignment grid', code: `
vec3 fx_outline(Surf2 s, float t) {
  // checkerboard in the surface's own uv plus a bright outline; the dot marks the first corner
  vec3 col = hsv(fract(s.id * 0.13), 0.7, 1.0);
  vec2 g = floor(s.uv * 8.0);
  vec3 c = col * (0.12 + 0.22 * mod(g.x + g.y, 2.0));
  c += vec3(1.0) * smoothstep(3.0, 1.0, s.edge);
  c += vec3(1.0, 0.8, 0.3) * smoothstep(0.07, 0.05, length(s.uv));
  return c;
}` },
  { id: 'white', name: 'White light', code: `
vec3 fx_white(Surf2 s, float t) { return vec3(1.0); }` },
  { id: 'sequence', name: 'Beat sequence', code: `
vec3 fx_sequence(Surf2 s, float t) {
  // surfaces flash one after another: on real beats when there's sound, otherwise twice a second
  float beat = uHasAudio > 0.5 ? uBeats : floor(t * 2.0);
  float phase = uHasAudio > 0.5 ? uBeat : 1.0 - fract(t * 2.0);
  float on = s.id == mod(beat, max(s.count, 1.0)) ? 1.0 : 0.0;
  vec3 col = hsv(fract(s.id * 0.17 + beat * 0.03), 0.75, 1.0);
  return col * (on * phase * 0.9 + exp(-s.edge / 4.0) * 0.6);
}` },
  { id: 'pulse', name: 'Pulse to music', code: `
vec3 fx_pulse(Surf2 s, float t) {
  // bass fills the surface from its centre, treble sparkles along the edge
  float r = length(s.uv - 0.5) * 2.0;
  float bass = uHasAudio > 0.5 ? uAudio.x : 0.5 + 0.5 * sin(t * 3.0);
  vec3 c = hsv(fract(0.6 + s.id * 0.11 + t * 0.02), 0.8, 1.0) * smoothstep(bass * 1.3 + 0.05, bass * 1.3 - 0.15, r);
  c += vec3(1.0) * exp(-s.edge / (2.0 + 10.0 * uAudio.z)) * (0.3 + uAudio.z);
  return c * (0.6 + 0.6 * uBeat);
}` },
  { id: 'sweep', name: 'Screen sweep', code: `
vec3 fx_sweep(Surf2 s, float t) {
  // defined across the whole frame, so it crosses shared edges with no seam
  float x = s.screen.x * 1.6 + s.screen.y * 0.6 - mod(t * 0.45, 2.8) + 0.3;
  vec3 c = vec3(0.2, 0.9, 1.0) * exp(-abs(x) * 16.0) * (1.0 + uBeat) + vec3(0.02, 0.03, 0.05);
  return c + vec3(0.6) * exp(-s.edge / 2.5) * 0.5;
}` },
  { id: 'tiles', name: 'Tiles', code: `
vec3 fx_tiles(Surf2 s, float t) {
  // tile count follows each surface's size, and tiles follow its perspective
  vec2 n = max(floor(s.size / 40.0), 1.0);
  vec2 g = s.uv * n; vec2 id = floor(g); vec2 f = fract(g);
  float h = hash2(id + s.id * 17.0);
  float step_ = uHasAudio > 0.5 ? uBeats : floor(t * 0.7 + h * 5.0);
  float on = step(0.5, fract(h + step_ * 0.31));
  float tile = step(0.1, f.x) * step(f.x, 0.9) * step(0.1, f.y) * step(f.y, 0.9);
  return tile * mix(vec3(0.05), hsv(0.08 + h * 0.1, 0.6, 1.0), on);
}` },
  { id: 'trace', name: 'Outline trace', code: `
vec3 fx_trace(Surf2 s, float t) {
  float a = atan(s.uv.y - 0.5, s.uv.x - 0.5);
  float run = fract(a / 6.2832 - t * 0.3 + s.id * 0.21);
  float pulse = smoothstep(0.0, 0.03, run) * smoothstep(0.2, 0.03, run);
  vec3 col = hsv(fract(s.id * 0.13 + t * 0.02), 0.7, 1.0);
  return col * exp(-s.edge / 3.0) * (0.4 + 2.0 * pulse + uBeat) + col * 0.03;
}` },
  { id: 'plasma', name: 'Plasma', code: `
vec3 fx_plasma(Surf2 s, float t) {
  vec2 p = s.screen * vec2(uRes.x / uRes.y, 1.0) * 3.0;
  float v = sin(p.x * 2.0 + t) + sin(p.y * 3.0 - t * 1.3) + sin((p.x + p.y) * 2.0 + t * 0.7) + sin(length(p - 2.0) * 4.0 - t * 2.0);
  vec3 c = pal(v * 0.15 + t * 0.05 + uAudio.y * 0.3, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  return c * (0.6 + 0.4 * exp(-s.edge / 6.0)) * (0.8 + 0.4 * uAudio.w);
}` },
  { id: 'off', name: 'Off', code: `
vec3 fx_off(Surf2 s, float t) { return vec3(0.0); }` },
];

export const effectIndex = (id) => Math.max(0, EFFECTS.findIndex((e) => e.id === id));
