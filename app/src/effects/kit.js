// The kit: GLSL building blocks every look can use (built-in, AI-written, imported or exported as ISF), so a new
// look is mostly its idea rather than its plumbing. Part of SURF_API (renderer.js), so it comes after the uniforms.
// Every name starts with k_, which keeps it clear of the looks' own helpers and of older AI-written effects.
// Each function has a one-line comment right above it: the AI prompt (ai.js) lists the kit from those lines.
// It has to stay GLSL ES 1.00 as well as 3.00 (no %, round, arrays or integer tricks): ISF export uses it too.
// See docs/looks.md for how to add a look.

export const KIT = `
// the surface in square units, centred: (0, 0) in the middle, the shorter side running -0.5..0.5
vec2 k_centred(Surf2 s) { return (s.uv - 0.5) * s.size / max(min(s.size.x, s.size.y), 1.0); }
// the surface in square units from its bottom-left corner: y 0..1, x 0..its width over its height
vec2 k_square(Surf2 s) { return s.uv * vec2(s.size.x / max(s.size.y, 1.0), 1.0); }
// the whole frame in square units: y 0..1, x 0..the frame's aspect; continuous from one surface to the next
vec2 k_frame(Surf2 s) { return s.screen * vec2(uRes.x / uRes.y, 1.0); }
// a rotation by a radians: p * k_rot(a)
mat2 k_rot(float a) { float c = cos(a), n = sin(a); return mat2(c, n, -n, c); }
// signed distance to a circle of radius r (negative inside)
float k_circle(vec2 p, float r) { return length(p) - r; }
// signed distance to a box with half-size b
float k_box(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
// approximate signed distance to an ellipse with radii r
float k_oval(vec2 p, vec2 r) { return (length(p / r) - 1.0) * min(r.x, r.y); }
// distance to the segment a-b; subtract a radius for a capsule
float k_seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
// signed distance to the triangle a, b, c
float k_tri(vec2 p, vec2 a, vec2 b, vec2 c) {
  vec2 e0 = b - a, e1 = c - b, e2 = a - c, v0 = p - a, v1 = p - b, v2 = p - c;
  vec2 q0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 q1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 q2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float sg = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(q0, q0), sg * (v0.x * e0.y - v0.y * e0.x)), vec2(dot(q1, q1), sg * (v1.x * e1.y - v1.y * e1.x))), vec2(dot(q2, q2), sg * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
// signed distance to a five-pointed star of radius r, point up; inner 0..1 sets how deep the notches are (0.4 is classic)
float k_star(vec2 p, float r, float inner) {
  vec2 k1 = vec2(0.809017, -0.587785), k2 = vec2(-0.809017, -0.587785);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = inner * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}
// signed distance to a heart about r tall, centred on p = 0
float k_heart(vec2 p, float r) {
  p = p / r + vec2(0.0, 0.5);
  p.x = abs(p.x) * 1.15;
  vec2 a = p - vec2(0.25, 0.75), b = p - 0.5 * max(p.x + p.y, 0.0), c = p - vec2(0.0, 1.0);
  float d = p.y + p.x > 1.0 ? sqrt(dot(a, a)) - 0.353553 : sqrt(min(dot(c, c), dot(b, b))) * sign(p.x - p.y);
  return d * r * 0.8;
}
// smooth union of two distances, blending over k
float k_smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
// 1 inside a shape, 0 outside, from its distance d, softened over w (same units)
float k_fill(float d, float w) { return 1.0 - smoothstep(-w, w, d); }
// a glow around a shape: 1 at its edge (and inside), fading over w outside
float k_glow(float d, float w) { return exp(-max(d, 0.0) / w); }
// a bright rim along the surface's outline, w frame pixels wide
float k_rim(Surf2 s, float w) { return exp(-s.edge / w); }
// candle-like flicker, about 0.7..1.05, different for each seed
float k_flicker(float t, float seed) { return 0.75 + 0.15 * noise(vec3(t * 6.0, seed, 0.0)) + 0.1 * noise(vec3(t * 17.0, seed, 3.0)); }
// the beat: the music's pulse when there is sound, otherwise a pretend one at bpm (1 on the beat, decaying)
float k_pulse(float t, float bpm) { return uHasAudio > 0.5 ? uBeat : exp(-fract(t * bpm / 60.0) * 5.0); }
// how loud, 0..1: the music's level when there is sound, otherwise a slow made-up swell
float k_level(float t) { return uHasAudio > 0.5 ? uAudio.w : 0.45 + 0.35 * sin(t * 1.7) * sin(t * 0.63); }
// now and then: per slot of period seconds, with chance odds, something starts somewhere in the slot's first half. x = seconds since it started (-1 if not yet, or not this slot), y = a 0..1 hash for it
vec2 k_now_and_then(float t, float period, float odds, float seed) {
  float slot = floor(t / period), dt = t - (slot + 0.5 * hash1(vec3(slot, seed, 1.7))) * period;
  return vec2(hash1(vec3(slot, seed, 4.3)) < odds && dt >= 0.0 ? dt : -1.0, hash1(vec3(slot, seed, 8.9)));
}
// many things drifting at vel (units a second), one per cell of size cell, each somewhere in the middle of its cell. xy = the point relative to this cell's thing, in cell units (keep each within 0.2 of its centre); z = a 0..1 hash for it
vec3 k_drift(vec2 q, vec2 vel, float cell, float t, float seed) {
  vec2 p = (q - vel * t) / cell, id = floor(p);
  vec2 at = 0.2 + 0.6 * vec2(hash1(vec3(id, seed + 1.3)), hash1(vec3(id, seed + 2.7)));
  return vec3(fract(p) - at, hash1(vec3(id, seed)));
}
// fire colours for heat 0..1: black, red, orange, yellow, near white
vec3 k_fire(float x) { x = clamp(x, 0.0, 1.0) * 3.0; return vec3(min(x, 1.0), clamp(x - 0.9, 0.0, 1.0) * 0.8, clamp(x - 2.0, 0.0, 1.0) * 0.6); }
`;

// the kit as a list for the AI prompt: each signature with the comment above it
export const kitSummary = () => KIT.split('\n').reduce((out, line, i, lines) => {
  const m = line.match(/^(\w+ k_\w+\([^)]*\))/);
  if (m) out.push(`  ${m[1]};   ${lines[i - 1].replace(/^\/\/\s*/, '')}`);
  return out;
}, []).join('\n');
