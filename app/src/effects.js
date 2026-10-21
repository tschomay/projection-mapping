// Built-in effects. Each defines `vec3 fx_<id>(Surf2 s, float t)`; `group` and `about` are for the content tray.
// Available to every effect (see HEAD in renderer.js): the Surf2 fields, helpers (hash1, hash2, noise, fbm, hsv,
// pal), and audio: uAudio = (bass, mid, treble, level) in 0..1, uBeat = pulse that jumps to 1 on a beat and
// decays, uBeats = beat count, uHasAudio = 1 when sound is being analysed. And the kit (effects/kit.js): shapes,
// glows, flicker, events now and then, drifting things, fire colours. Seasonal sets live in effects/<group>.js.
// docs/looks.md has the guide to writing a look and the list of looks planned.
import { HALLOWEEN } from './effects/halloween.js';
import { FALL } from './effects/fall.js';
import { CHRISTMAS } from './effects/christmas.js';
import { MUSIC } from './effects/music.js';
import { AMBIENT } from './effects/ambient.js';

// the tray shows effect groups in this order (then the project's own effects, then videos and images)
export const LOOK_GROUPS = ['Basics', 'Music', 'Ambient', 'Halloween', 'Fall', 'Christmas'];

export const EFFECTS = [
  { id: 'outline', name: 'Alignment grid', group: 'Basics', about: 'A checkerboard and bright outline for lining surfaces up. The dot marks the first corner.', code: `
vec3 fx_outline(Surf2 s, float t) {
  // checkerboard in the surface's own uv plus a bright outline; the dot marks the first corner
  vec3 col = hsv(fract(s.id * 0.13), 0.7, 1.0);
  vec2 g = floor(s.uv * 8.0);
  vec3 c = col * (0.12 + 0.22 * mod(g.x + g.y, 2.0));
  c += vec3(1.0) * smoothstep(3.0, 1.0, s.edge);
  c += vec3(1.0, 0.8, 0.3) * smoothstep(0.07, 0.05, length(s.uv));
  return c;
}` },
  { id: 'white', name: 'White light', group: 'Basics', about: 'Plain white light: lights the object itself.', code: `
vec3 white_colour = vec3(1.0); // param: Colour
vec3 fx_white(Surf2 s, float t) { return white_colour; }` },
  { id: 'sequence', name: 'Beat sequence', group: 'Music', about: 'Surfaces flash one after another, on the beat when music plays.', code: `
float sequence_rate = 2.0; // param: Flashes a second without music, 0.5..8
vec3 fx_sequence(Surf2 s, float t) {
  // surfaces flash one after another: on real beats when there's sound, otherwise sequence_rate times a second
  float beat = uHasAudio > 0.5 ? uBeats : floor(t * sequence_rate);
  float phase = uHasAudio > 0.5 ? uBeat : 1.0 - fract(t * sequence_rate);
  float on = s.id == mod(beat, max(s.count, 1.0)) ? 1.0 : 0.0;
  vec3 col = hsv(fract(s.id * 0.17 + beat * 0.03), 0.75, 1.0);
  return col * (on * phase * 0.9 + exp(-s.edge / 4.0) * 0.6);
}` },
  { id: 'pulse', name: 'Pulse to music', group: 'Music', about: 'Bass fills the surface from its centre; treble sparkles along the edge.', code: `
vec3 fx_pulse(Surf2 s, float t) {
  // bass fills the surface from its centre, treble sparkles along the edge
  float r = length(s.uv - 0.5) * 2.0;
  float bass = uHasAudio > 0.5 ? uAudio.x : 0.5 + 0.5 * sin(t * 3.0);
  vec3 c = hsv(fract(0.6 + s.id * 0.11 + t * 0.02), 0.8, 1.0) * smoothstep(bass * 1.3 + 0.05, bass * 1.3 - 0.15, r);
  c += vec3(1.0) * exp(-s.edge / (2.0 + 10.0 * uAudio.z)) * (0.3 + uAudio.z);
  return c * (0.6 + 0.6 * uBeat);
}` },
  { id: 'sweep', name: 'Screen sweep', group: 'Ambient', about: 'A bright line sweeps across the whole frame, from one surface to the next.', code: `
vec3 sweep_colour = vec3(0.2, 0.9, 1.0); // param: Colour
float sweep_speed = 1.0; // param: Speed, 0.2..3
vec3 fx_sweep(Surf2 s, float t) {
  // defined across the whole frame, so it crosses shared edges with no seam
  float x = s.screen.x * 1.6 + s.screen.y * 0.6 - mod(t * 0.45 * sweep_speed, 2.8) + 0.3;
  vec3 c = sweep_colour * exp(-abs(x) * 16.0) * (1.0 + uBeat) + vec3(0.02, 0.03, 0.05);
  return c + vec3(0.6) * exp(-s.edge / 2.5) * 0.5;
}` },
  { id: 'tiles', name: 'Tiles', group: 'Music', about: 'Tiles sized to each surface switch on and off, flipping on the beat.', code: `
float tiles_size = 40.0; // param: Tile size, 15..150, whole
vec3 fx_tiles(Surf2 s, float t) {
  // tile count follows each surface's size, and tiles follow its perspective
  vec2 n = max(floor(s.size / tiles_size), 1.0);
  vec2 g = s.uv * n; vec2 id = floor(g); vec2 f = fract(g);
  float h = hash2(id + s.id * 17.0);
  float step_ = uHasAudio > 0.5 ? uBeats : floor(t * 0.7 + h * 5.0);
  float on = step(0.5, fract(h + step_ * 0.31));
  float tile = step(0.1, f.x) * step(f.x, 0.9) * step(0.1, f.y) * step(f.y, 0.9);
  return tile * mix(vec3(0.05), hsv(0.08 + h * 0.1, 0.6, 1.0), on);
}` },
  { id: 'trace', name: 'Outline trace', group: 'Ambient', about: 'A light runs around the outline of each surface.', code: `
float trace_speed = 1.0; // param: Speed, 0.2..4
vec3 fx_trace(Surf2 s, float t) {
  float a = atan(s.uv.y - 0.5, s.uv.x - 0.5);
  float run = fract(a / 6.2832 - t * 0.3 * trace_speed + s.id * 0.21);
  float pulse = smoothstep(0.0, 0.03, run) * smoothstep(0.2, 0.03, run);
  vec3 col = hsv(fract(s.id * 0.13 + t * 0.02), 0.7, 1.0);
  return col * exp(-s.edge / 3.0) * (0.4 + 2.0 * pulse + uBeat) + col * 0.03;
}` },
  { id: 'plasma', name: 'Plasma', group: 'Ambient', about: 'Slow, flowing colour across the whole frame.', code: `
float plasma_speed = 1.0; // param: Speed, 0.1..3
vec3 fx_plasma(Surf2 s, float t) {
  t *= plasma_speed;
  vec2 p = s.screen * vec2(uRes.x / uRes.y, 1.0) * 3.0;
  float v = sin(p.x * 2.0 + t) + sin(p.y * 3.0 - t * 1.3) + sin((p.x + p.y) * 2.0 + t * 0.7) + sin(length(p - 2.0) * 4.0 - t * 2.0);
  vec3 c = pal(v * 0.15 + t * 0.05 + uAudio.y * 0.3, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  return c * (0.6 + 0.4 * exp(-s.edge / 6.0)) * (0.8 + 0.4 * uAudio.w);
}` },
  { id: 'off', name: 'Off', group: 'Basics', about: 'Nothing: the surface stays dark.', code: `
vec3 fx_off(Surf2 s, float t) { return vec3(0.0); }` },
  ...MUSIC,
  ...AMBIENT,
  ...HALLOWEEN,
  ...FALL,
  ...CHRISTMAS,
];

// the tray's badges, read from the code: ♪ moves to music, ⇆ flows from one surface to the next
export const movesToMusic = (code) => /\buBeat|\buAudio|\bk_pulse\s*\(|\bk_level\s*\(/.test(code);
export const flowsAcross = (code) => /\bs\.screen\b|\bk_frame\s*\(/.test(code);

export const effectIndex = (id) => Math.max(0, EFFECTS.findIndex((e) => e.id === id));
