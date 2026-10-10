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
  // Halloween set: dark backgrounds with things moving in them, made for a single cabinet door or a few
  { id: 'bats', name: 'Bats', group: 'Halloween', code: `
float bat_shape(vec2 p, float flap) {
  // one bat in its own units, about 2 wide: body, ears, and wings with a scalloped trailing edge
  p.x = abs(p.x);
  float body = length(p * vec2(2.2, 1.2)) - 0.2;
  float ear = max(abs(p.x - 0.09) - 0.05 + (p.y - 0.15) * 0.4, abs(p.y - 0.22) - 0.08);
  vec2 w = p - vec2(0.55, 0.05 + flap * 0.35 * p.x);
  float wing = length(w / vec2(0.55, 0.2 + 0.08 * flap)) - 1.0;
  for (int k = 0; k < 3; k++) {
    float x = 0.38 + float(k) * 0.28;
    wing = max(wing, -(length(p - vec2(x, -0.2 + flap * 0.35 * x)) - 0.13) * 4.0);
  }
  return min(min(body, ear), wing * 0.2);
}
vec3 fx_bats(Surf2 s, float t) {
  // bats cross the whole frame (so they fly from one surface to the next) in front of an orange moonlit haze
  float aspect = uRes.x / uRes.y;
  vec2 q = vec2(s.screen.x * aspect, s.screen.y);
  float glow = 0.55 + 0.45 * fbm(vec3(q * 2.0, t * 0.1));
  // a moon glow on every surface, so the silhouettes read wherever they are
  float moon = smoothstep(0.85, 0.0, length((s.uv - vec2(0.62, 0.62)) * vec2(1.0, s.size.y / max(s.size.x, 1.0))));
  vec3 sky = mix(vec3(0.45, 0.08, 0.3), vec3(1.0, 0.5, 0.08), moon * glow) * (0.8 + 0.2 * moon);
  sky *= 0.75 + 0.5 * uBeat;
  float shade = 1.0;
  for (int i = 0; i < 14; i++) {
    float fi = float(i), h = hash1(vec3(fi, 3.1, 7.7));
    float speed = 0.12 + 0.12 * h;
    float size = 0.05 + 0.07 * hash1(vec3(fi, 9.2, 1.3));
    float dir = h > 0.5 ? 1.0 : -1.0;
    float x = (fract(h * 7.0 + t * speed) * (aspect + 0.6) - 0.3);
    if (dir < 0.0) x = aspect - x;
    float y = 0.15 + 0.7 * hash1(vec3(fi, 5.5, 2.2)) + 0.08 * sin(t * (1.0 + h) + fi);
    vec2 p = (q - vec2(x, y)) / size;
    p.x *= dir;
    float flap = sin(t * (9.0 + 5.0 * h) + fi * 2.0);
    float d = bat_shape(p, flap) * size;
    shade = min(shade, smoothstep(0.0, 0.004, d));
  }
  return sky * shade + vec3(1.0, 0.5, 0.1) * exp(-s.edge / 3.0) * 0.25;
}` },
  { id: 'eyes', name: 'Glowing eyes', group: 'Halloween', code: `
vec3 fx_eyes(Surf2 s, float t) {
  // pairs of eyes open in the dark, look around, blink and close again
  vec2 n = max(floor(s.size / vec2(160.0, 110.0)), 1.0);
  vec2 g = s.uv * n, id = floor(g), f = fract(g) - 0.5;
  float h = hash2(id + s.id * 13.0);
  float cycle = 6.0 + 5.0 * h, ph = fract(t / cycle + h * 3.7);
  float open = smoothstep(0.0, 0.08, ph) * smoothstep(0.7, 0.62, ph);
  open *= step(0.06, abs(fract(t * 0.37 + h * 5.0) - 0.5));   // a blink now and then
  vec2 look = 0.05 * vec2(sin(t * 0.7 + h * 9.0), 0.4 * sin(t * 0.5 + h * 4.0));
  vec3 col = h > 0.5 ? vec3(1.0, 0.85, 0.1) : vec3(0.95, 0.15, 0.05);
  float eyes = 0.0;
  for (int k = 0; k < 2; k++) {
    vec2 p = (f - vec2(k == 0 ? -0.16 : 0.16, 0.0)) / vec2(0.12, 0.12 * open + 0.001);
    float e = smoothstep(1.0, 0.8, length(p));
    float pupil = smoothstep(0.25, 0.4, abs(p.x - look.x * 8.0));
    eyes += e * pupil + 0.35 * exp(-length(p) * 1.2) * open;
  }
  return col * eyes * (0.8 + 0.4 * uBeat) * step(0.25, h);
}` },
  { id: 'fog', name: 'Ghostly fog', group: 'Halloween', code: `
vec3 fx_fog(Surf2 s, float t) {
  // pale green fog rolling across the frame, thicker towards the bottom
  vec2 q = s.screen * vec2(uRes.x / uRes.y, 1.0) * 2.5;
  float f = fbm(vec3(q.x - t * 0.15, q.y + 0.2 * sin(t * 0.2), t * 0.05));
  f = smoothstep(0.35, 0.8, f + 0.4 * (1.0 - s.screen.y) - 0.15);
  float wisp = fbm(vec3(q * 3.0 + vec2(t * 0.3, 0.0), t * 0.1));
  return vec3(0.45, 0.95, 0.6) * f * (0.4 + 0.6 * wisp) * (0.8 + 0.4 * uAudio.w);
}` },
  { id: 'lightning', name: 'Lightning', group: 'Halloween', code: `
vec3 fx_lightning(Surf2 s, float t) {
  // a dark stormy purple; every few seconds (or on the beat) a double flash of cold light
  float slot = floor(t / 2.5), h = hash1(vec3(slot, 4.0, 1.0));
  float at = slot * 2.5 + h * 1.5, dt = t - at;
  float flash = dt > 0.0 && h > 0.35 ? exp(-dt * 14.0) + 0.7 * exp(-max(dt - 0.12, 0.0) * 10.0) * step(0.12, dt) : 0.0;
  if (uHasAudio > 0.5) flash = max(flash, uBeat * uBeat);
  vec2 q = s.screen * vec2(uRes.x / uRes.y, 1.0);
  float cloud = fbm(vec3(q * 3.0, t * 0.1));
  // the bolt: a jagged line down the frame, in a new place for each flash
  float bx = 0.2 + 1.2 * hash1(vec3(slot, 8.0, 2.0)) + 0.08 * (fbm(vec3(q.y * 6.0, slot, 0.0)) - 0.5) * 4.0;
  float bolt = exp(-abs(q.x - bx) * 120.0) * step(0.15, q.y);
  vec3 c = vec3(0.08, 0.02, 0.12) * (0.5 + cloud);
  return c + vec3(0.75, 0.8, 1.0) * flash * (0.35 + 0.65 * cloud) + vec3(0.9, 0.95, 1.0) * bolt * flash * 3.0;
}` },
  { id: 'candle', name: 'Candle glow', group: 'Halloween', code: `
vec3 fx_candle(Surf2 s, float t) {
  // warm light from below that flickers like candles, brighter near the bottom edge
  float flick = 0.75 + 0.15 * noise(vec3(t * 6.0, s.id, 0.0)) + 0.1 * noise(vec3(t * 17.0, s.id, 3.0));
  float lift = mix(1.0, 0.25, s.uv.y) * (0.85 + 0.3 * fbm(vec3(s.uv * 3.0 + vec2(0.0, -t * 0.4), t * 0.2)));
  return vec3(1.0, 0.45, 0.08) * lift * flick + vec3(1.0, 0.6, 0.2) * exp(-s.edge / 4.0) * 0.2;
}` },
];

export const effectIndex = (id) => Math.max(0, EFFECTS.findIndex((e) => e.id === id));
