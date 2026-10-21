// Christmas looks: snow, lights along the outline, candy stripes and a winter sky. See docs/looks.md.

export const CHRISTMAS = [
  { id: 'snow', name: 'Snow', group: 'Christmas', about: 'Soft snow falls across the frame, from one surface to the next, blown by the wind.', code: `
float snow_amount = 0.6; // param: How much, 0.1..1
float snow_wind = 0.15; // param: Wind, -1..1
vec3 fx_snow(Surf2 s, float t) {
  vec2 q = k_frame(s);
  vec3 col = vec3(0.0);
  // three layers: small, slow flakes far away, bigger, brighter ones close up
  for (int layer = 0; layer < 3; layer++) {
    float fl = float(layer), near = 0.5 + 0.25 * fl;
    vec2 sway = vec2(0.03 * sin(t * (0.7 + 0.3 * fl) + q.y * 4.0 + fl * 2.0), 0.0);
    vec3 d = k_drift(q + sway, vec2(snow_wind * 0.15 * near, -0.05 - 0.05 * fl), 0.05 + 0.035 * fl, t, 11.0 + fl * 7.0);
    float flake = exp(-length(d.xy) * (26.0 - 6.0 * fl)) * step(1.0 - snow_amount, d.z);
    col += vec3(0.85, 0.92, 1.0) * flake * near;
  }
  return col;
}` },
  { id: 'twinkle', name: 'Twinkle lights', group: 'Christmas', about: 'A string of bulbs round the outline of each surface, twinkling one by one. More of them light on the beat.', code: `
int twinkle_colours = 0; // param: Colours, choice: Multicolour=0|Warm white=1|Red and green=2|Blue and white=3
float twinkle_speed = 1.0; // param: Twinkle, 0..3
float twinkle_spacing = 40.0; // param: Bulb spacing, 20..120, whole
vec3 twinkle_bulb(float k) {
  // the colour of bulb k for the chosen set
  float h = fract(k * 0.618);
  if (twinkle_colours == 1) return vec3(1.0, 0.75, 0.4);
  if (twinkle_colours == 2) return h < 0.5 ? vec3(1.0, 0.08, 0.05) : vec3(0.1, 0.9, 0.2);
  if (twinkle_colours == 3) return h < 0.5 ? vec3(0.2, 0.45, 1.0) : vec3(0.9, 0.95, 1.0);
  return h < 0.25 ? vec3(1.0, 0.1, 0.05) : h < 0.5 ? vec3(0.1, 0.9, 0.2) : h < 0.75 ? vec3(0.2, 0.4, 1.0) : vec3(1.0, 0.75, 0.1);
}
vec3 fx_twinkle(Surf2 s, float t) {
  // along the outline: how far round it this pixel is, in bulbs, and how far in from the edge
  float a = atan(s.uv.y - 0.5, s.uv.x - 0.5) / 6.2832 + 0.5;
  float along = a * 2.0 * (s.size.x + s.size.y) / twinkle_spacing;
  float k = floor(along), f = fract(along) - 0.5;
  float inset = 12.0;
  float d = length(vec2(f * twinkle_spacing, s.edge - inset));
  float on = 0.35 + 0.65 * smoothstep(0.2, 0.8, noise(vec3(k * 1.7, t * 1.5 * twinkle_speed, s.id)));
  if (uHasAudio > 0.5) on = max(on, uBeat * step(0.5, hash1(vec3(k, s.id, uBeats))));
  vec3 c = twinkle_bulb(k + s.id * 7.0);
  float bulb = k_fill(d - 4.5, 1.0), halo = exp(-d / 7.0) * 0.45;
  float wire = exp(-abs(s.edge - inset) / 1.0) * 0.08;
  return c * (bulb + halo) * on + vec3(0.1, 0.25, 0.1) * wire;
}` },
  { id: 'candy', name: 'Candy stripes', group: 'Christmas', about: 'Glossy diagonal stripes, like a candy cane, slowly turning.', code: `
vec3 candy_colour = vec3(0.9, 0.04, 0.08); // param: Stripe colour
float candy_width = 0.12; // param: Stripe width, 0.04..0.4
float candy_speed = 0.3; // param: Speed, 0..2
vec3 fx_candy(Surf2 s, float t) {
  vec2 q = k_square(s);
  float x = (q.x + q.y) / candy_width - t * candy_speed * 2.0;
  float stripe = smoothstep(0.23, 0.27, abs(fract(x) - 0.5));   // half the cane red, half white
  // a soft sheen down the middle, as on a rounded cane
  float g = (s.uv.x - 0.35) * 4.0, sheen = 0.75 + 0.35 * exp(-g * g);
  return mix(vec3(0.95, 0.93, 0.9), candy_colour, stripe) * sheen * 0.9;
}` },
  { id: 'aurora', name: 'Northern lights', group: 'Christmas', about: 'Green and violet curtains of light ripple slowly across a starry winter sky.', code: `
float aurora_speed = 1.0; // param: Speed, 0.2..3
vec3 aurora_colour = vec3(0.15, 1.0, 0.45); // param: Colour
vec3 fx_aurora(Surf2 s, float t) {
  t *= aurora_speed;
  vec2 q = k_frame(s);
  vec3 col = vec3(0.01, 0.02, 0.05);
  vec3 st = k_drift(q, vec2(0.0), 0.05, t, 3.0);
  col += vec3(0.8) * exp(-length(st.xy) * 40.0) * step(0.75, st.z) * (0.6 + 0.4 * sin(t * 2.0 + st.z * 40.0));
  // curtains: bright bands whose bottom edges wave, fading upwards
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float base = 0.35 + 0.12 * fi + 0.08 * sin(q.x * (1.5 + fi) + t * 0.3 + fi * 2.0) + 0.05 * fbm(vec3(q.x * 3.0, t * 0.1, fi));
    float rise = q.y - base;
    float band = smoothstep(-0.01, 0.02, rise) * exp(-max(rise, 0.0) * (3.0 + fi));
    float rays = 0.6 + 0.4 * noise(vec3(q.x * 30.0 + fi * 5.0, t * 0.5, fi));
    vec3 c = mix(aurora_colour, vec3(0.6, 0.2, 1.0), smoothstep(0.0, 0.35, rise) * 0.8);
    col += c * band * rays * (0.55 - 0.12 * fi);
  }
  return col;
}` },
];
