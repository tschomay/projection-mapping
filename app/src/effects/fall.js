// Fall looks, for September to Thanksgiving: warm, slow and cosy rather than scary. See docs/looks.md.
import { fireLook } from './families.js';

export const FALL = [
  { id: 'leaves', name: 'Falling leaves', group: 'Fall', about: 'Maple and birch leaves in red, orange and gold tumble down across the frame.', code: `
float leaves_leaf(vec2 p, float kind) {
  // a leaf pointing up, at most 0.15 from its centre: a maple's five points, or a pointed oval
  float stem = k_seg(p, vec2(0.0, -0.02), vec2(0.0, -0.14)) - 0.006;
  if (kind < 0.55) {
    float a = atan(p.x, p.y);
    return min(length(p) - 0.12 * (0.5 + 0.5 * abs(cos(a * 2.5)) + 0.05 * abs(sin(a * 12.0))), stem);
  }
  return min(max(length(p - vec2(0.085, 0.0)) - 0.125, length(p + vec2(0.085, 0.0)) - 0.125), stem);
}
vec3 fx_leaves(Surf2 s, float t) {
  vec2 q = k_frame(s);
  vec3 col = vec3(0.0);
  // two layers: small, slow leaves far away, then bigger, brighter ones close up
  for (int layer = 0; layer < 2; layer++) {
    float fl = float(layer);
    vec2 sway = vec2(0.05 * sin(t * 0.9 + q.y * 3.0 + fl * 2.0), 0.0);
    vec3 d = k_drift(q + sway, vec2(0.04 + 0.02 * fl, -0.07 - 0.05 * fl), 0.26 + 0.16 * fl, t, 3.0 + fl * 5.0);
    float h = d.z;
    vec2 p = d.xy * k_rot(t * (0.5 + h) * (h > 0.6 ? 1.0 : -1.0) + h * 6.28);
    p.x /= max(abs(cos(t * (0.8 + 1.5 * h) + h * 9.0)), 0.25);   // tumbling: narrower as it turns edge-on
    float leaf = k_fill(leaves_leaf(p, fract(h * 7.0)), 0.01) * step(0.25, h);
    float tone = fract(h * 13.0);
    vec3 c = tone < 0.25 ? vec3(0.85, 0.12, 0.03) : tone < 0.55 ? vec3(1.0, 0.42, 0.03) : tone < 0.8 ? vec3(1.0, 0.72, 0.1) : vec3(0.6, 0.27, 0.06);
    c *= (0.65 + 0.35 * fl) * (1.0 - 0.35 * exp(-abs(p.x) / 0.006));   // the midrib a little darker
    col = mix(col, c, leaf);
  }
  return col;
}` },
  { id: 'moonrise', name: 'Harvest moon', group: 'Fall', about: 'A huge orange moon rises slowly over dark hills, with clouds drifting across it.', code: `
vec3 fx_moonrise(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  // one rise takes a minute and a half; at the end the moon fades and rises again
  float ph = fract(t / 90.0 + 0.2), up = smoothstep(0.0, 0.85, ph), shown = smoothstep(1.0, 0.94, ph);
  vec2 mc = vec2(aspect * 0.4, mix(0.0, 0.62, up));
  float mr = 0.27, dm = length(q - mc);
  vec3 mcol = mix(vec3(1.0, 0.4, 0.06), vec3(1.0, 0.78, 0.45), up);
  float halo = exp(-max(dm - mr, 0.0) * 5.0) * shown;
  vec3 col = vec3(0.1, 0.04, 0.08) * (1.0 - q.y) + mcol * 0.35 * halo;
  float seas = smoothstep(0.42, 0.62, fbm(vec3((q - mc) * 5.0, 4.0)));
  col = mix(col, mcol * (1.0 - 0.25 * seas), k_fill(dm - mr, 0.003) * shown);
  // clouds: dark bands drifting across, lit at their edges by the moon
  float cloud = smoothstep(0.52, 0.68, fbm(vec3(q.x * 1.6 - t * 0.03, q.y * 5.0, 1.0))) * smoothstep(0.25, 0.45, q.y);
  col = mix(col, vec3(0.04, 0.02, 0.05) + mcol * 0.3 * halo, cloud * 0.85);
  // the hills, in front of everything
  float hill = 0.15 + 0.05 * sin(q.x * 3.0 + 1.0) + 0.05 * fbm(vec3(q.x * 6.0, 0.0, 2.0));
  return col * smoothstep(hill - 0.004, hill + 0.004, q.y);
}` },
  { id: 'dapple', name: 'Sunlight through leaves', group: 'Fall', about: 'Warm patches of sunlight, as if through a tree, swaying gently in the breeze. Cosy on a wall.', code: `
vec3 fx_dapple(Surf2 s, float t) {
  vec2 q = k_frame(s) * 6.0;
  float gust = 0.5 + 0.5 * sin(t * 0.21) * sin(t * 0.13);
  vec2 sway = vec2(sin(t * 0.7), cos(t * 0.53)) * 0.08 * (0.5 + gust);
  float a = fbm(vec3(q + sway, t * 0.05));
  float b = fbm(vec3(q * 2.1 - sway * 1.7, t * 0.08 + 3.0));
  float light = smoothstep(0.56, 0.6, a + 0.12 * (b - 0.5));
  return mix(vec3(0.12, 0.07, 0.02), vec3(1.0, 0.78, 0.42), light);
}` },
  { id: 'rain', name: 'Rain on the window', group: 'Fall', about: 'Raindrops on a pane: small ones sit still, bigger ones slide down leaving a wet trail.', code: `
vec3 fx_rain(Surf2 s, float t) {
  vec2 q = k_square(s);
  vec3 col = vec3(0.1, 0.14, 0.2) * (0.6 + 0.4 * q.y);
  // small drops that stay put: dark body, bright highlight at the top
  vec3 d = k_drift(q, vec2(0.0), 0.05, t, 2.0);
  float r = 0.07 + 0.1 * d.z, on = step(0.35, fract(d.z * 7.0));
  float drop = k_fill(length(d.xy) - r, 0.03) * on;
  float shine = k_fill(length(d.xy - vec2(-0.3, 0.35) * r) - r * 0.35, 0.03) * on;
  // bigger drops, one per column, that slide down in fits and starts and leave a trail
  float cw = 0.1, cx = floor(q.x / cw), h = hash1(vec3(cx, 3.0, 1.0));
  float ph = fract(t * (0.04 + 0.06 * h) + h);
  ph += 0.012 * sin(ph * 50.0);
  float y = 1.15 - 1.35 * ph;
  vec2 dc = vec2((cx + 0.5 + 0.3 * (h - 0.5)) * cw + 0.004 * sin(y * 30.0 + h * 9.0), y);
  float big = k_fill(k_oval((q - dc) / cw, vec2(0.2, 0.25)), 0.05) * step(0.35, h);
  float bigShine = k_fill(k_oval((q - dc) / cw - vec2(-0.05, 0.07), vec2(0.06, 0.07)), 0.04) * step(0.35, h);
  float trail = step(dc.y, q.y) * exp(-abs(q.x - dc.x) / 0.0025) * exp(-(q.y - dc.y) * 4.0) * step(0.35, h);
  col *= 1.0 - 0.6 * max(drop, big);
  return col + vec3(0.7, 0.8, 0.95) * max(shine, bigShine) * 0.8 + vec3(0.3, 0.4, 0.5) * trail;
}` },
  { id: 'embers', name: 'Embers rising', group: 'Fall', about: 'Sparks rise and wander up the frame from a bonfire below, glowing and going out.', code: `
vec3 fx_embers(Surf2 s, float t) {
  vec2 q = k_frame(s);
  vec3 col = vec3(0.35, 0.07, 0.0) * pow(max(1.0 - q.y, 0.0), 3.0) * k_flicker(t * 0.5, 1.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 sway = vec2(0.04 * sin(t * (1.0 + fi * 0.5) + q.y * (5.0 + fi)), 0.0);
    vec3 d = k_drift(q + sway, vec2(0.01, 0.12 + 0.05 * fi), 0.09 - 0.02 * fi, t, 4.0 + fi * 3.0);
    float on = step(0.5, d.z) * (0.5 + 0.5 * sin(t * (2.0 + 4.0 * d.z) + d.z * 30.0));
    col += vec3(1.0, 0.45 + 0.35 * d.z, 0.1) * exp(-length(d.xy) * (14.0 + 6.0 * fi)) * on * max(1.2 - q.y, 0.0);
  }
  return col;
}` },
  { id: 'geese', name: 'Geese flying south', group: 'Fall', about: 'A V of geese crosses a dusk sky now and then, from one surface to the next.', code: `
float geese_bird(vec2 p, float flap) {
  // a goose from the side, flying right, about 1.2 long: body, long neck, head and bill, one wing
  float body = k_oval(p, vec2(0.3, 0.09));
  float neck = k_seg(p, vec2(0.2, 0.02), vec2(0.45, 0.06)) - 0.03;
  float head = min(k_oval(p - vec2(0.48, 0.065), vec2(0.06, 0.04)), k_tri(p, vec2(0.52, 0.085), vec2(0.52, 0.045), vec2(0.63, 0.06)));
  float wing = k_tri(p, vec2(-0.14, 0.02), vec2(0.12, 0.03), vec2(-0.06, 0.05 + 0.42 * flap));
  return min(min(body, neck), min(head, wing));
}
vec3 fx_geese(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  vec3 col = mix(vec3(0.9, 0.38, 0.08), vec3(0.16, 0.05, 0.22), smoothstep(0.0, 1.0, q.y)) * 0.75;
  float cycle = 16.0, ph = fract(t / cycle);
  vec2 lead = vec2(mix(aspect + 0.4, -1.0, ph), 0.55 + 0.12 * sin(floor(t / cycle) * 2.3));
  float shade = 1.0;
  for (int i = 0; i < 9; i++) {
    float fi = float(i), row = floor((fi + 1.0) * 0.5), side = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
    vec2 p = (q - lead - vec2(row * 0.09, side * row * 0.045) - 0.008 * sin(t * 1.3 + fi)) / 0.07;
    p.x = -p.x;
    shade = min(shade, smoothstep(0.0, 0.04, geese_bird(p, sin(t * 6.0 + fi * 0.9))));
  }
  return col * shade;
}` },
  { id: 'wheat', name: 'Wheat field', group: 'Fall', about: 'A golden field under an evening sky, with gusts of wind running through it in waves.', code: `
vec3 fx_wheat(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float horizon = 0.58 + 0.02 * sin(q.x * 3.0);
  vec3 sky = mix(vec3(0.9, 0.5, 0.2), vec3(0.25, 0.18, 0.4), smoothstep(horizon, 1.0, q.y)) * 0.55;
  // wind: waves moving across, bending the stalks; far away (near the horizon) they're smaller
  float depth = clamp(q.y / horizon, 0.0, 1.0);
  float wind = fbm(vec3(q.x * 2.0 - t * 0.6, q.y * 1.5, t * 0.1));
  float x = q.x + (wind - 0.5) * 0.08 * (1.0 - depth);
  float stalk = noise(vec3(x * mix(45.0, 160.0, depth), depth * 4.0, 0.0));
  float sheen = smoothstep(0.5, 0.72, wind);
  vec3 field = vec3(1.0, 0.7, 0.25) * (0.25 + 0.45 * stalk + 0.45 * sheen) * (1.0 - 0.45 * depth);
  float top = horizon + 0.012 * stalk;
  return mix(field, sky, smoothstep(top - 0.003, top + 0.003, q.y));
}` },
  fireLook({ id: 'fireplace', name: 'Fireplace', group: 'Fall', about: 'A low, cosy fire on a bed of glowing coals, with sparks drifting up.', height: 0.6, speed: 1.1, embers: true, coals: true }),
];
