// Families of looks and shared shapes. A look's GLSL has to stand alone (the renderer compiles only the looks in
// use, so one look can't call another's helper), so what several looks share is written here as JS functions that
// return GLSL: a family makes a whole look from a few settings (fireLook, dripLook), and a part returns a helper
// under a name prefixed with the look's id (skull, hand), so two looks using it never define the same name twice.

// flames rising from the bottom edge: fbm scrolled upwards, hotter near the bottom, with sparks and coals if asked
export const fireLook = ({ id, height, speed, tint = 'vec3(1.0)', embers = false, coals = false, music = false, ...meta }) => ({ id, ...meta, code: `
float ${id}_height = ${height.toFixed(2)}; // param: Height, 0.2..1.5
vec3 ${id}_tint = ${tint}; // param: Tint
vec3 fx_${id}(Surf2 s, float t) {
  vec2 q = k_square(s);
  float surge = ${music ? '0.25 * k_pulse(t, 100.0)' : '0.0'};
  float n = fbm(vec3(q.x * 4.0, q.y * 2.5 - t * ${speed.toFixed(2)}, t * 0.3 + s.id * 7.0));
  float n2 = noise(vec3(q.x * 10.0, q.y * 6.0 - t * ${(speed * 2.2).toFixed(2)}, t * 0.7));
  float heat = clamp(1.0 - q.y / (${id}_height * (1.0 + surge)), 0.0, 1.0);
  // tongues: the noise eats into the heat, more so higher up, so flames break up into black at their tips
  float f = heat * heat * (0.2 + 1.3 * n) + 0.25 * heat * (n2 - 0.5) - 0.1 * (1.0 - heat);
  vec3 c = k_fire(f * 1.1) * ${id}_tint;${coals ? `
  // the glowing bed of coals along the bottom
  c += vec3(1.0, 0.32, 0.04) * smoothstep(0.1, 0.0, q.y) * (0.35 + 0.65 * noise(vec3(q.x * 14.0, t * 0.6, 2.0)));` : ''}${embers ? `
  // sparks drifting up
  vec3 e = k_drift(q + vec2(0.03 * sin(t * 1.7 + q.y * 6.0), 0.0), vec2(0.0, ${(speed * 0.18).toFixed(3)}), 0.07, t, 7.0);
  c += vec3(1.0, 0.55, 0.15) * exp(-length(e.xy) * 32.0) * step(0.65, e.z) * smoothstep(1.0, 0.2, q.y) * (0.5 + 0.5 * sin(t * 9.0 + e.z * 40.0));` : ''}
  return c;
}` });

// something oozing down from the top edge: a wet band along the top with drips that grow, run and start again
export const dripLook = ({ id, colour, period, ...meta }) => ({ id, ...meta, code: `
vec3 ${id}_colour = ${colour}; // param: Colour
float ${id}_speed = 1.0; // param: Speed, 0.3..3
vec3 fx_${id}(Surf2 s, float t) {
  vec2 q = k_square(s);
  float w = 0.1, col = floor(q.x / w), h = hash1(vec3(col, s.id, 3.0));
  float ph = fract(t * ${id}_speed / (${period.toFixed(1)} * (0.7 + 0.6 * h)) + h * 3.0);
  // each column's drip: a stem from the top and a round bead at its tip; a few columns don't drip
  float len = h < 0.3 ? 0.0 : (0.05 + 0.9 * h) * ph * ph;
  float cx = (col + 0.5 + 0.2 * (fract(h * 7.0) - 0.5)) * w;
  vec2 tip = vec2(cx, 1.0 - 0.05 - len);
  float d = min(k_seg(q, vec2(cx, 1.0), tip) - w * (0.17 + 0.15 * (q.y - tip.y)), k_circle(q - tip, w * (0.28 + 0.05 * h)));
  d = h < 0.3 ? 1.0 : d;
  float band = 1.0 - q.y - 0.04 - 0.025 * noise(vec3(q.x * 12.0, 1.0, s.id));
  d = k_smin(d, band, 0.03);
  float fade = smoothstep(1.0, 0.88, ph);
  d = mix(band, d, fade);
  float inside = k_fill(d, 0.004);
  // a glossy highlight down the left of each stem and bead
  float gx = (q.x - cx + w * 0.09) / (w * 0.05);
  float gloss = exp(-gx * gx) * step(0.3, h) * fade * step(tip.y - w * 0.1, q.y);
  float depth = smoothstep(0.0, -0.02, d);
  return inside * (${id}_colour * (0.55 + 0.45 * depth) + mix(${id}_colour, vec3(1.0), 0.6) * gloss * 0.6) + ${id}_colour * 0.3 * k_glow(d, 0.01) * (1.0 - inside);
}` });

// a skull about 1 tall, centred: x = distance to its outline, y = to its holes (eyes, nose, teeth), z = to its eyes
export const skull = (prefix) => `
vec3 ${prefix}_skull(vec2 p) {
  float head = k_smin(k_circle(p - vec2(0.0, 0.12), 0.36), k_box(p - vec2(0.0, -0.2), vec2(0.15, 0.1)) - 0.07, 0.1);
  vec2 m = vec2(abs(p.x), p.y);
  float eyes = k_oval(m - vec2(0.14, 0.02), vec2(0.1, 0.085));
  float nose = k_tri(p, vec2(-0.045, -0.16), vec2(0.045, -0.16), vec2(0.0, -0.07));
  float gaps = max(abs(fract(p.x * 14.0 + 0.5) - 0.5) / 14.0 - 0.005, max(abs(p.y + 0.27) - 0.05, abs(p.x) - 0.13));
  float mouth = max(abs(p.y + 0.27) - 0.006, abs(p.x) - 0.15);
  return vec3(head, min(min(eyes, nose), min(gaps, mouth)), eyes);
}`;

// an open hand, palm at the origin and fingers up, about 0.3 tall: its signed distance
export const hand = (prefix) => `
float ${prefix}_hand(vec2 p) {
  float fingers = 1e3;
  for (int i = 0; i < 4; i++) {
    float a = -0.33 + 0.22 * float(i), len = i == 1 || i == 2 ? 0.12 : 0.095;
    vec2 dir = vec2(sin(a), cos(a));
    fingers = min(fingers, k_seg(p, dir * 0.05, dir * (0.05 + len)) - 0.017);
  }
  float thumb = k_seg(p, vec2(0.05, -0.02), vec2(0.12, 0.05)) - 0.019;
  return k_smin(k_oval(p + vec2(0.0, 0.01), vec2(0.065, 0.075)), min(fingers, thumb), 0.025);
}`;
