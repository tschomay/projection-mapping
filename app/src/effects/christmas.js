// Christmas looks: snow and ice, lights, decorations, Santa and his sleigh, a winter village. See docs/looks.md.
import { candleLook } from './families.js';

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
  { id: 'ornaments', name: 'Ornaments', group: 'Christmas', about: 'Shiny baubles hang from the top edge on strings, swaying a little and catching the light.', code: `
float ornaments_count = 6.0; // param: How many, 1..12, whole
int ornaments_colours = 0; // param: Colours, choice: Multicolour=0|Red and gold=1|Silver and blue=2|Purple and pink=3
float ornaments_sway = 1.0; // param: Sway, 0..3
vec3 ornaments_tint(float h) {
  if (ornaments_colours == 1) return h < 0.5 ? vec3(0.85, 0.05, 0.06) : vec3(1.0, 0.7, 0.2);
  if (ornaments_colours == 2) return h < 0.5 ? vec3(0.75, 0.8, 0.9) : vec3(0.15, 0.35, 1.0);
  if (ornaments_colours == 3) return h < 0.5 ? vec3(0.6, 0.15, 0.9) : vec3(1.0, 0.3, 0.6);
  return hsv(floor(h * 5.0) / 5.0 + 0.02, 0.85, 1.0);
}
vec3 fx_ornaments(Surf2 s, float t) {
  vec2 q = k_square(s);
  float w = s.size.x / max(s.size.y, 1.0);
  vec3 col = vec3(0.0);
  vec3 sun = normalize(vec3(-0.5, 0.6, 0.65));
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    if (fi >= ornaments_count) break;
    float h = hash1(vec3(fi, s.id, 2.3)), h2 = hash1(vec3(fi, s.id, 5.9));
    float r = min(0.07 + 0.06 * h2, 0.42 * w / ornaments_count);
    float len = 0.08 + 0.45 * h;
    float a = ornaments_sway * 0.07 * sin(t * (1.1 + 0.6 * h) + fi * 1.7);
    vec2 top = vec2((fi + 0.5) / ornaments_count * w, 1.0);
    vec2 dir = vec2(sin(a), -cos(a));
    vec2 c = top + dir * (len + r + 0.02);
    // the string, then the ball in its own frame (hanging straight down)
    col += vec3(0.55, 0.5, 0.35) * 0.6 * (1.0 - smoothstep(0.0015, 0.004, k_seg(q, top, top + dir * len)));
    vec2 p = (q - c) * k_rot(a);
    float cap = k_box(p - vec2(0.0, r + 0.012), vec2(r * 0.22, 0.014));
    col = mix(col, vec3(0.8, 0.65, 0.3) * (0.5 + 0.5 * smoothstep(r * 0.2, -r * 0.2, p.x)), k_fill(cap, 0.002));
    float d = k_circle(p, r);
    if (d < 0.01) {
      vec2 n2 = p / r;
      vec3 n = vec3(n2, sqrt(max(1.0 - dot(n2, n2), 0.0)));
      vec3 base = ornaments_tint(fract(h * 3.7 + h2));
      // some have a band of glitter round the middle
      float band = step(0.6, h2) * (1.0 - smoothstep(0.16, 0.2, abs(n2.y)));
      base = mix(base, vec3(1.0, 0.85, 0.5) * (0.6 + 0.4 * hash2(floor(p * 300.0) + floor(t * 6.0))), band);
      float diff = 0.25 + 0.75 * max(dot(n, sun), 0.0);
      float spec = pow(max(dot(reflect(-sun, n), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);
      vec3 ball = base * diff + vec3(1.0) * spec * 0.9 + base * 0.25 * pow(1.0 - n.z, 3.0);
      col = mix(col, ball, k_fill(d, 0.002));
    }
    // now and then a glint: a little four-pointed star at the highlight
    vec2 g = p - r * vec2(-0.38, 0.45);
    float glint = pow(max(0.0, sin(t * 1.3 + h * 20.0)), 12.0);
    col += vec3(1.0) * glint * 0.8 * (exp(-abs(g.x) * 400.0) * exp(-abs(g.y) * 60.0) + exp(-abs(g.y) * 400.0) * exp(-abs(g.x) * 60.0));
  }
  return col;
}` },
  { id: 'stockings', name: 'Stockings by the fire', group: 'Christmas', about: 'Stockings hang from the top edge, lit warm by a crackling fire along the bottom.', code: `
float stockings_count = 4.0; // param: How many, 1..8, whole
bool stockings_fire = true; // param: Fire, toggle
float stockings_sock(vec2 p) {
  // a stocking hanging from its top at the origin, about 0.45 tall, toe pointing right
  float leg = k_box(p - vec2(0.0, -0.2), vec2(0.065, 0.15)) - 0.02;
  float foot = k_oval(p - vec2(0.05, -0.36), vec2(0.11, 0.065));
  return k_smin(leg, foot, 0.04);
}
vec3 fx_stockings(Surf2 s, float t) {
  vec2 q = k_square(s);
  float w = s.size.x / max(s.size.y, 1.0);
  float fl = k_flicker(t, s.id);
  vec3 col = vec3(0.0);
  if (stockings_fire) {
    float n = fbm(vec3(q.x * 4.0, q.y * 2.5 - t * 1.4, t * 0.3 + s.id * 7.0));
    float hgt = clamp(1.0 - q.y / 0.45, 0.0, 1.0);
    col = k_fire((hgt * hgt * (0.2 + 1.3 * n) - 0.1 * (1.0 - hgt)) * 1.1);
    col += vec3(1.0, 0.32, 0.04) * smoothstep(0.08, 0.0, q.y) * (0.35 + 0.65 * noise(vec3(q.x * 14.0, t * 0.6, 2.0)));
  }
  // firelight on the stockings: brighter lower down, flickering
  float lit = stockings_fire ? (0.55 + 0.45 * smoothstep(0.9, 0.4, q.y)) * fl : 0.8;
  float sc = min(1.4, 2.2 * w / stockings_count);
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    if (fi >= stockings_count) break;
    float h = hash1(vec3(fi, s.id, 4.1));
    vec2 top = vec2((fi + 0.5) / stockings_count * w, 0.98);
    vec2 p = (q - top) * k_rot(0.03 * sin(t * 0.9 + fi * 2.0)) / sc;
    float d = stockings_sock(p);
    float cuff = k_box(p - vec2(0.0, -0.04), vec2(0.095, 0.045)) - 0.012;
    vec3 c = h < 0.5 ? vec3(0.85, 0.06, 0.06) : h < 0.8 ? vec3(0.08, 0.6, 0.18) : vec3(0.9, 0.9, 0.85);
    // stripes on some, a white heel and toe on the others
    if (fract(h * 7.0) < 0.4) c = mix(c, vec3(0.95), step(0.5, fract(p.y * 18.0)));
    else c = mix(c, vec3(0.95), min(1.0, step(k_circle(p - vec2(0.13, -0.36), 0.06), 0.0) + step(k_circle(p - vec2(-0.04, -0.41), 0.05), 0.0)));
    float fuzz = 0.85 + 0.15 * noise(vec3(p * 60.0, 1.0));
    col = mix(col, c * lit * (0.75 + 0.25 * smoothstep(0.1, -0.06, p.x)), k_fill(d, 0.004 / sc));
    col = mix(col, vec3(0.95, 0.95, 0.92) * lit * fuzz, k_fill(cuff, 0.004 / sc));
    col += vec3(0.6, 0.45, 0.3) * (1.0 - smoothstep(0.002, 0.005, k_seg(q, top, top + vec2(0.0, 0.03))));
  }
  return col;
}` },
  { id: 'sleigh', name: 'Sleigh across the moon', group: 'Christmas', about: "A big moon in a starry sky. Every so often Santa's sleigh flies past it behind four reindeer, the leader's nose glowing.", code: `
float sleigh_deer(vec2 p, float run) {
  // a reindeer leaping right, about 0.4 long, body at the origin; run is where it is in its stride
  float body = k_oval(p, vec2(0.1, 0.042));
  float neck = k_seg(p, vec2(0.07, 0.01), vec2(0.12, 0.08)) - 0.02;
  float head = k_oval(p - vec2(0.15, 0.09), vec2(0.042, 0.022));
  float ant = min(k_seg(p, vec2(0.125, 0.11), vec2(0.1, 0.2)), k_seg(p, vec2(0.108, 0.16), vec2(0.15, 0.19))) - 0.007;
  float a = 0.6 * sin(run), b = 0.6 * sin(run + 2.5);
  float legs = min(k_seg(p, vec2(0.07, -0.02), vec2(0.07, -0.02) + 0.11 * vec2(sin(a) + 0.4, -cos(a))),
                   k_seg(p, vec2(-0.07, -0.02), vec2(-0.07, -0.02) + 0.11 * vec2(sin(b) - 0.4, -cos(b)))) - 0.012;
  float tail = k_seg(p, vec2(-0.09, 0.01), vec2(-0.12, 0.04)) - 0.01;
  return min(min(min(body, neck), min(head, ant)), min(legs, tail));
}
float sleigh_shape(vec2 p, float t) {
  // the sleigh at the origin with Santa and his sack, and four reindeer ahead of it on the right: about 2 long
  float body = min(k_box(p - vec2(0.0, 0.05), vec2(0.17, 0.06)) - 0.02, k_box(p - vec2(-0.13, 0.13), vec2(0.05, 0.07)) - 0.02);
  float runner = min(k_seg(p, vec2(-0.2, -0.07), vec2(0.2, -0.07)), max(abs(length(p - vec2(0.2, -0.01)) - 0.06), -(p.x - 0.2))) - 0.012;
  float struts = min(k_seg(p, vec2(-0.1, -0.07), vec2(-0.1, 0.0)), k_seg(p, vec2(0.1, -0.07), vec2(0.1, 0.0))) - 0.01;
  float santa = min(k_circle(p - vec2(-0.02, 0.17), 0.075), k_circle(p - vec2(0.02, 0.27), 0.045));
  float hat = k_tri(p, vec2(-0.025, 0.3), vec2(0.065, 0.3), vec2(-0.05, 0.38));
  float sack = k_circle(p - vec2(-0.16, 0.22), 0.08);
  float d = min(min(min(body, runner), struts), min(min(santa, hat), sack));
  if (p.x > 0.0 && p.x < 2.0 && abs(p.y - 0.1) < 0.35) {
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      d = min(d, sleigh_deer(p - vec2(0.55 + 0.34 * fi, 0.08 + 0.025 * sin(t * 3.0 + fi)), t * 9.0 + fi * 1.3));
    }
    d = min(d, k_seg(p, vec2(0.05, 0.2), vec2(1.65, 0.12)) - 0.004);   // the reins
  }
  return d;
}
float sleigh_every = 14.0; // param: Seconds between flights, 8..60
bool sleigh_nose = true; // param: A red nose, toggle
vec3 fx_sleigh(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  vec2 mc = vec2(aspect * 0.38, 0.6);
  float mr = 0.24, dm = length(q - mc);
  // a deep blue sky, glowing round the moon, with twinkling stars
  vec3 col = vec3(0.02, 0.04, 0.12) + vec3(0.18, 0.22, 0.32) * exp(-max(dm - mr, 0.0) * 4.0);
  vec3 st = k_drift(q, vec2(0.0), 0.06, t, 13.0);
  col += vec3(0.9) * exp(-length(st.xy) * 35.0) * step(0.7, st.z) * (0.55 + 0.45 * sin(t * 2.0 + st.z * 50.0));
  float seas = smoothstep(0.42, 0.62, fbm(vec3((q - mc) * 6.0, 4.0)));
  col = mix(col, vec3(0.95, 0.95, 0.88) * (1.0 - 0.2 * seas), k_fill(dm - mr, 0.003));
  // the sleigh: crosses in the first part of each wait, climbing a little, past the moon
  float n = floor(t / sleigh_every), ph = (t - n * sleigh_every) / 9.0;
  float dir = hash1(vec3(n, 4.0, 1.0)) < 0.5 ? 1.0 : -1.0;
  float x = mix(-0.5, aspect + 0.5, ph);
  if (dir < 0.0) x = aspect - x;
  float sc = 0.25;
  vec2 p = (q - vec2(x, mc.y - 0.12 + 0.15 * ph + 0.04 * sin(ph * 5.0))) / sc;
  p.x *= dir;
  p *= k_rot(-0.12);
  float d = sleigh_shape(p, t);
  // a trail of gold sparkles behind it
  vec3 sp = k_drift(p * 0.5 + vec2(t * 0.1, 0.0), vec2(0.0), 0.05, t, 21.0);
  float trail = smoothstep(-1.6, -0.25, p.x) * step(p.x, -0.2) * exp(-abs(p.y - 0.02 * p.x) * 5.0) * step(0.6, sp.z);
  col += vec3(1.0, 0.8, 0.4) * exp(-length(sp.xy) * 30.0) * trail * (0.5 + 0.5 * sin(t * 12.0 + sp.z * 40.0)) * step(ph, 1.0);
  col *= 1.0 - k_fill(d, 0.012) * step(ph, 1.0);
  if (sleigh_nose && ph < 1.0) {
    float nd = length(p - vec2(1.75, 0.08 + 0.025 * sin(t * 3.0 + 3.0) + 0.09));
    col += vec3(1.0, 0.08, 0.04) * (k_fill(nd - 0.025, 0.01) + 0.6 * exp(-nd / 0.06));
  }
  return col;
}` },
  { id: 'gingerbread', name: 'Gingerbread house', group: 'Christmas', about: 'Turns a wall or a door into gingerbread: piped icing scallops round the outline, gumdrops, and an icing lattice.', code: `
vec3 gingerbread_icing = vec3(1.0, 0.97, 0.92); // param: Icing
float gingerbread_spacing = 60.0; // param: Scallop size, 25..100, whole
bool gingerbread_lattice = true; // param: Icing lattice, toggle
vec3 fx_gingerbread(Surf2 s, float t) {
  vec2 q = k_square(s);
  // the gingerbread: warm brown, a little speckled and darker at the edge
  float bake = 0.8 + 0.2 * fbm(vec3(q * 12.0, s.id));
  vec3 col = vec3(0.5, 0.25, 0.09) * bake * (0.65 + 0.35 * smoothstep(0.0, 40.0, s.edge));
  col *= 0.9 + 0.1 * step(0.8, hash2(floor(s.px / 3.0)));
  // scallops of piped icing in from the outline, with a gumdrop where each pair meets
  float sp = gingerbread_spacing;
  float n = max(floor(2.0 * (s.size.x + s.size.y) / sp), 3.0);
  float along = (atan(s.uv.y - 0.5, s.uv.x - 0.5) / 6.2832 + 0.5) * n;
  float f = fract(along) - 0.5;
  float curve = 9.0 + 0.4 * sp * (1.0 - 4.0 * f * f);
  float pipe = 2.5 + sp * 0.03;
  float icing = exp(-pow((s.edge - curve) / pipe, 2.0)) + exp(-pow((s.edge - 4.0) / 2.5, 2.0));
  if (gingerbread_lattice) {
    vec2 g = q * 5.0;
    float lat = min(abs(fract(g.x + g.y) - 0.5), abs(fract(g.x - g.y) - 0.5));
    icing += 0.8 * exp(-pow(lat / 0.035, 2.0)) * smoothstep(curve + pipe, curve + pipe * 3.0, s.edge + 0.4 * sp * 4.0 * f * f);
  }
  // icing: a raised bead, its top catching the light, with sugar sparkles
  float sugar = step(0.97, hash2(floor(s.px / 2.0) + floor(t * 3.0)));
  col = mix(col, gingerbread_icing * (0.8 + 0.2 * icing + 0.4 * sugar), clamp(icing * 1.6 - 0.3, 0.0, 1.0));
  float gd = length(vec2((0.5 - abs(f)) * 2.0 * (s.size.x + s.size.y) / n, s.edge - 12.0)) - sp * 0.14;
  vec3 gum = hsv(fract(floor(along + 0.5) * 0.37 + s.id * 0.2), 0.85, 1.0);
  col = mix(col, gum * (0.7 + 0.3 * smoothstep(sp * 0.14, -sp * 0.1, gd + 2.0)) * (0.85 + 0.15 * sin(t * 1.5 + floor(along + 0.5))), k_fill(gd, 1.5));
  return col;
}` },
  { id: 'present', name: 'Wrapped present', group: 'Christmas', about: 'Wraps a box or a door like a present: patterned paper, a satin ribbon each way and a bow.', code: `
vec3 present_paper = vec3(0.75, 0.05, 0.08); // param: Paper
vec3 present_ribbon = vec3(1.0, 0.78, 0.25); // param: Ribbon
int present_pattern = 1; // param: Pattern, choice: Plain=0|Stars=1|Stripes=2|Dots=3
bool present_bow = true; // param: Bow, toggle
vec3 fx_present(Surf2 s, float t) {
  vec2 p = k_centred(s);
  vec2 q = k_square(s);
  vec3 paper = present_paper;
  if (present_pattern == 1) {
    vec2 g = q * 6.0, id = floor(g), f = fract(g) - 0.5;
    float st = k_star((f + vec2(0.0, 0.03)) * k_rot(hash2(id) * 1.2 - 0.6), 0.28, 0.45);
    paper = mix(paper, vec3(1.0, 0.9, 0.6), k_fill(st, 0.02) * 0.9);
  } else if (present_pattern == 2) {
    paper = mix(paper, vec3(0.95), smoothstep(0.02, 0.0, abs(fract((q.x - q.y) * 5.0) - 0.5) - 0.18));
  } else if (present_pattern == 3) {
    vec2 g = q * 8.0;
    g.x += 0.5 * mod(floor(g.y), 2.0);
    paper = mix(paper, vec3(0.95), k_fill(length(fract(g) - 0.5) - 0.18, 0.03));
  }
  vec3 col = paper * (0.8 + 0.2 * smoothstep(0.0, 30.0, s.edge));
  // the ribbons: one each way through the middle, a satin sheen sliding along them
  float rw = 0.07, m = min(abs(p.x), abs(p.y));
  float sheen = 0.75 + 0.35 * sin((abs(p.x) < rw ? p.y : p.x) * 6.0 - t * 1.2);
  col = mix(col, present_ribbon * sheen * (0.85 + 0.15 * smoothstep(rw, 0.0, m)), k_fill(m - rw, 0.004));
  if (present_bow) {
    // two loops and two tails from a knot in the middle, casting a soft shadow
    vec2 b = vec2(abs(p.x), p.y), lp = (b - vec2(0.13, 0.06)) * k_rot(-0.45);
    float bow = max(k_oval(lp, vec2(0.13, 0.075)), -k_oval(lp, vec2(0.07, 0.025)));
    bow = min(bow, k_tri(b, vec2(0.02, -0.02), vec2(0.16, -0.22), vec2(0.07, -0.24)));
    float knot = k_circle(p, 0.05);
    bow = min(bow, knot);
    col *= 1.0 - 0.5 * k_glow(bow, 0.02);
    col = mix(col, present_ribbon * (0.6 + 0.3 * sheen + 0.3 * smoothstep(0.1, 0.0, length(lp - vec2(0.0, 0.04)))), k_fill(bow, 0.004));
    col = mix(col, present_ribbon * 1.1, k_fill(knot, 0.004));
  }
  return col;
}` },
  { id: 'santa', name: 'Santa', group: 'Christmas', about: "Santa's face for something round: a red hat, rosy cheeks and a big white beard. He winks, and laughs along with music.", code: `
vec3 fx_santa(Surf2 s, float t) {
  vec2 p = k_centred(s) * 1.05;
  // ho ho ho: every few seconds without music, along with it when there is some
  float ph = fract(t / 7.0 + s.id * 0.31);
  float laugh = uHasAudio > 0.5 ? clamp(uAudio.w * 1.3 + 0.5 * uBeat - 0.1, 0.0, 1.0) : step(0.7, ph) * (0.5 + 0.5 * sin((ph - 0.7) * 62.83));
  p.y -= 0.01 * laugh;
  float fluff = noise(vec3(p * 28.0, 1.0)) * 0.6 + noise(vec3(p * 60.0, 2.0)) * 0.4;
  // the beard fills it all, then the face, the hat and its trim on top
  vec3 col = vec3(0.95, 0.95, 0.92) * (0.7 + 0.3 * fluff) * (0.8 + 0.2 * smoothstep(-0.5, 0.0, p.y));
  float face = k_oval(p - vec2(0.0, 0.06), vec2(0.21, 0.16));
  vec3 skin = vec3(1.0, 0.68, 0.55) * 0.85;
  col = mix(col, skin, k_fill(face, 0.004));
  // rosy cheeks and nose
  col = mix(col, vec3(1.0, 0.35, 0.35), 0.5 * exp(-pow(length(vec2(abs(p.x) - 0.13, p.y + 0.0)) / 0.05, 2.0)) * k_fill(face, 0.004));
  float nose = k_circle(p - vec2(0.0, 0.0), 0.045);
  col = mix(col, vec3(1.0, 0.45, 0.4) * (0.8 + 0.4 * smoothstep(0.04, 0.0, length(p - vec2(-0.015, 0.015)))), k_fill(nose, 0.003));
  // eyes, one of them winking now and then; bushy brows
  vec2 e = vec2(abs(p.x) - 0.08, p.y - 0.075);
  float wink = k_now_and_then(t, 5.0, 0.7, s.id + 2.0).x;
  float shut = p.x > 0.0 && wink >= 0.0 && wink < 0.5 ? 0.12 : 1.0;
  float eye = k_oval(e, vec2(0.028, 0.032 * shut));
  col = mix(col, vec3(0.05, 0.03, 0.03), k_fill(eye, 0.003));
  col += vec3(0.8) * k_fill(k_circle(e - vec2(-0.008, 0.01), 0.008), 0.002) * step(0.5, shut);
  float brow = k_oval((e - vec2(0.0, 0.055)) * k_rot(sign(p.x) * 0.2), vec2(0.06, 0.022));
  col = mix(col, vec3(0.97) * (0.8 + 0.2 * fluff), k_fill(brow, 0.006));
  // the moustache and the mouth under it, open when he laughs
  float mouth = k_oval(p - vec2(0.0, -0.13), vec2(0.06, 0.012 + 0.045 * laugh));
  col = mix(col, vec3(0.45, 0.05, 0.08), k_fill(mouth, 0.004));
  vec2 m = vec2(abs(p.x), p.y);
  float tache = k_oval((m - vec2(0.075, -0.07)) * k_rot(-0.35), vec2(0.085, 0.04));
  col = mix(col, vec3(0.98) * (0.85 + 0.15 * fluff), k_fill(tache, 0.006));
  // the hat, flopping off to the right, with a fluffy trim and a pompom
  float trimY = 0.2 + 0.025 * cos(p.x * 5.0);
  float hat = trimY - p.y;
  col = mix(col, vec3(0.8, 0.05, 0.06) * (0.6 + 0.4 * smoothstep(0.5, 0.0, p.x + p.y * 0.5)), k_fill(hat, 0.004));
  col = mix(col, vec3(0.97) * (0.75 + 0.25 * fluff), k_fill(abs(p.y - trimY) - 0.045 - 0.012 * fluff, 0.004));
  col = mix(col, vec3(0.97) * (0.75 + 0.25 * fluff), k_fill(k_circle(p - vec2(0.3, 0.3), 0.08 + 0.01 * fluff), 0.004));
  return col;
}` },
  { id: 'star', name: 'Star of Bethlehem', group: 'Christmas', about: 'One bright star with long rays shines over dark hills and a little town, in a sky full of smaller ones.', code: `
float star_glow = 1.0; // param: Brightness, 0.3..2
bool star_town = true; // param: Hills and a town, toggle
vec3 fx_star(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  vec2 c = vec2(aspect * 0.5, 0.74);
  vec3 col = mix(vec3(0.04, 0.06, 0.18), vec3(0.01, 0.02, 0.07), q.y);
  vec3 st = k_drift(q, vec2(0.0), 0.045, t, 5.0);
  col += vec3(0.85, 0.9, 1.0) * exp(-length(st.xy) * 40.0) * step(0.7, st.z) * (0.5 + 0.5 * sin(t * 1.5 + st.z * 60.0));
  vec2 d = q - c;
  float r = length(d);
  float pulse = 0.9 + 0.1 * sin(t * 1.3);
  // four long rays (the one pointing down longest), four short ones between, a glow and a white-hot middle
  float rays = exp(-abs(d.x) * 220.0) * exp(-abs(d.y) * (d.y < 0.0 ? 1.4 : 5.0)) + exp(-abs(d.y) * 220.0) * exp(-abs(d.x) * 5.0);
  vec2 e = d * k_rot(0.785398);
  rays += 0.4 * (exp(-abs(e.x) * 260.0) + exp(-abs(e.y) * 260.0)) * exp(-r * 10.0);
  col += vec3(1.0, 0.9, 0.7) * star_glow * pulse * (rays + 0.6 * exp(-r * 12.0) + 0.15 * exp(-r * 3.0)) + vec3(1.0) * exp(-r * 120.0);
  if (star_town) {
    float hill = 0.15 + 0.05 * sin(q.x * 3.0 + 1.0) + 0.03 * sin(q.x * 7.3);
    // the town: flat-roofed houses of different heights, a dome or two, a few lit windows
    float bx = floor(q.x / 0.05), hb = hash1(vec3(bx, 3.0, 1.0));
    float inTown = step(abs(q.x - aspect * 0.5), 0.3 + 0.15 * hash1(vec3(1.0, 2.0, 3.0)));
    float roof = hill + (0.02 + 0.05 * hb) * inTown;
    float dome = inTown * step(0.85, hb) * sqrt(max(0.0004 - pow(fract(q.x / 0.05) * 0.05 - 0.025, 2.0), 0.0));
    float top = roof + dome;
    float ground = step(q.y, top);
    col = mix(col, vec3(0.01, 0.012, 0.03) + vec3(0.06, 0.06, 0.1) * exp(-(top - q.y) * 80.0), ground);
    vec2 wg = q / vec2(0.012, 0.014);
    float lit = step(0.8, hash1(vec3(floor(wg), 9.0))) * step(0.3, abs(fract(wg.x) - 0.5)) * step(0.3, abs(fract(wg.y) - 0.5));
    col += vec3(1.0, 0.65, 0.25) * 0.8 * lit * inTown * ground * step(hill + 0.01, q.y) * step(q.y, roof - 0.008);
  }
  return col;
}` },
  { id: 'snowman', name: 'Snowman', group: 'Christmas', about: 'A snowman face for something round: coal eyes that blink, a carrot nose and a smile of stones.', code: `
vec3 fx_snowman(Surf2 s, float t) {
  vec2 p = k_centred(s) * 1.05;
  // snow: white with a cool shade away from the light, and a little sparkle
  vec2 b = p * 2.0;
  vec3 n = vec3(b, sqrt(max(1.0 - dot(b, b), 0.0)));
  float lt = 0.5 + 0.5 * max(dot(n, normalize(vec3(-0.4, 0.5, 0.8))), 0.0);
  vec3 col = mix(vec3(0.45, 0.6, 0.9), vec3(1.0), lt) * (0.88 + 0.12 * noise(vec3(p * 30.0, 1.0)));
  vec2 sg = floor(p * 160.0);
  col += vec3(1.0) * step(0.985, hash2(sg)) * (0.5 + 0.5 * sin(t * 3.0 + hash2(sg + 3.0) * 30.0));
  // coal eyes, blinking now and then
  vec2 e = vec2(abs(p.x) - 0.12, p.y - 0.11);
  float bl = k_now_and_then(t, 4.0, 0.8, s.id).x;
  float lid = bl >= 0.0 && bl < 0.18 ? 0.15 : 1.0;
  float coal = k_oval(e, vec2(0.045, 0.045 * lid));
  // a smile of coal stones
  for (int i = 0; i < 7; i++) {
    float a = -0.75 + 0.25 * float(i);
    coal = min(coal, k_circle(p - vec2(0.0, 0.03) - 0.22 * vec2(sin(a), -cos(a)), 0.021 + 0.006 * hash1(vec3(float(i), 1.0, 2.0))));
  }
  col = mix(col, vec3(0.03), k_fill(coal, 0.004));
  col += vec3(0.6) * k_fill(k_circle(e - vec2(-0.015, 0.015), 0.01), 0.003) * step(0.5, lid);
  // a carrot nose pointing off to the right, with its rings
  float nose = k_tri(p, vec2(-0.01, 0.03), vec2(-0.01, -0.05), vec2(0.25, -0.03));
  col = mix(col, vec3(1.0, 0.42, 0.04) * (0.8 + 0.2 * sin(p.x * 120.0)) * (0.8 + 0.2 * smoothstep(-0.04, 0.02, p.y)), k_fill(nose, 0.004));
  // cold pink cheeks
  col = mix(col, vec3(1.0, 0.5, 0.6), 0.3 * exp(-pow(length(vec2(abs(p.x) - 0.21, p.y + 0.04)) / 0.06, 2.0)));
  return col;
}` },
  { id: 'xtree', name: 'Tree of lights', group: 'Christmas', about: 'A Christmas tree drawn in lights: rows of twinkling bulbs wrapped round it, and a star on top.', code: `
int xtree_colours = 0; // param: Colours, choice: Multicolour=0|Warm white=1|Red and gold=2|Blue and white=3
float xtree_twinkle = 1.0; // param: Twinkle, 0..3
bool xtree_star = true; // param: Star on top, toggle
vec3 xtree_bulb(float h) {
  if (xtree_colours == 1) return vec3(1.0, 0.75, 0.4);
  if (xtree_colours == 2) return h < 0.5 ? vec3(1.0, 0.1, 0.05) : vec3(1.0, 0.7, 0.2);
  if (xtree_colours == 3) return h < 0.5 ? vec3(0.2, 0.45, 1.0) : vec3(0.9, 0.95, 1.0);
  return h < 0.25 ? vec3(1.0, 0.1, 0.05) : h < 0.5 ? vec3(0.1, 0.9, 0.2) : h < 0.75 ? vec3(0.2, 0.4, 1.0) : vec3(1.0, 0.75, 0.1);
}
vec3 fx_xtree(Surf2 s, float t) {
  vec2 p = k_centred(s);
  float y0 = -0.4, y1 = 0.34, hw0 = 0.33;
  float f = clamp((p.y - y0) / (y1 - y0), 0.0, 1.0);
  // the tree: a dim green cone of needles in four tiers, and its trunk
  float tier = fract(f * 4.0);
  float body = max(abs(p.x) - hw0 * (1.0 - f) * (0.72 + 0.28 * tier), max(y0 - p.y, p.y - y1));
  vec3 col = vec3(0.02, 0.13, 0.05) * (0.6 + 0.4 * noise(vec3(p * 50.0, 1.0))) * k_fill(body, 0.004);
  col += vec3(0.12, 0.06, 0.02) * k_fill(k_box(p - vec2(0.0, y0 - 0.04), vec2(0.035, 0.04)), 0.003);
  // the lights: rows wrapping round the cone, a bulb every so far round; those at the front are brighter
  float rows = 9.0, rf = f * rows;
  for (int j = 0; j < 2; j++) {
    float r = floor(rf - 0.5) + float(j);
    if (r < 0.0 || r >= rows) continue;
    float yr = y0 + (r + 0.5) / rows * (y1 - y0), hw = hw0 * (1.0 - (r + 0.5) / rows) * 0.85;
    float nb = max(floor(hw * 70.0), 3.0), stp = 6.2832 / nb;
    float th = asin(clamp(p.x / max(hw, 0.001), -1.0, 1.0));
    float tq = (floor(th / stp + 0.5) + 0.5 * mod(r, 2.0)) * stp;
    float front = cos(tq);
    vec2 bp = vec2(hw * sin(tq), yr + 0.015 * tq);
    float d = length(p - bp);
    float k = r * 31.0 + floor(th / stp + 0.5);
    float on = 0.35 + 0.65 * smoothstep(0.2, 0.8, noise(vec3(k * 1.7, t * 1.5 * xtree_twinkle, s.id)));
    col += xtree_bulb(fract(k * 0.618)) * (k_fill(d - 0.011 - 0.004 * front, 0.003) + 0.35 * exp(-d / 0.02)) * on * (0.3 + 0.7 * max(front, 0.0));
  }
  if (xtree_star) {
    float sd = k_star(p - vec2(0.0, y1 + 0.035), 0.06, 0.45);
    vec3 gold = vec3(1.0, 0.82, 0.35) * (1.0 + 0.2 * sin(t * 2.0));
    col = mix(col, gold, k_fill(sd, 0.003)) + gold * 0.35 * k_glow(sd, 0.03) * step(0.0, sd);
  }
  return col;
}` },
  { id: 'icicles', name: 'Icicles', group: 'Christmas', about: 'Icicles hang from the top edge, glinting, and now and then one drips.', code: `
float icicles_length = 0.35; // param: Length, 0.1..0.8
bool icicles_drips = true; // param: Drips, toggle
vec3 fx_icicles(Surf2 s, float t) {
  vec2 q = k_square(s);
  float cw = 0.045;
  vec3 col = vec3(0.0);
  // a band of ice along the top, then an icicle in each column (checking the neighbours, which can be wide)
  float d = 1.0 - q.y - 0.025 - 0.012 * noise(vec3(q.x * 20.0, 1.0, s.id));
  float best = 1e3, bx = 0.0, bw = 0.01, bl = 0.1, bh = 0.0;
  for (int j = -1; j <= 1; j++) {
    float c = floor(q.x / cw) + float(j);
    float h = hash1(vec3(c, s.id, 7.0));
    float l = icicles_length * (0.12 + 0.88 * h * h);
    float x = (c + 0.5) * cw, hwid = cw * (0.3 + 0.35 * fract(h * 9.0));
    float di = k_tri(q, vec2(x - hwid, 1.0), vec2(x + hwid, 1.0), vec2(x + 0.15 * hwid * (fract(h * 5.0) - 0.5), 1.0 - l));
    if (di < best) { best = di; bx = x; bw = hwid; bl = l; bh = h; }
    d = k_smin(d, di, 0.006);
    if (icicles_drips) {
      // a drop gathers at the tip, then falls
      vec2 e = k_now_and_then(t, 5.0, 0.35, c + s.id * 31.0);
      if (e.x >= 0.0) {
        float grow = clamp(e.x / 1.2, 0.0, 1.0), fall = max(e.x - 1.2, 0.0);
        vec2 dp = vec2(x, 1.0 - l - 0.006 - 2.0 * fall * fall);
        col += vec3(0.75, 0.9, 1.0) * (k_fill(k_circle(q - dp, 0.006 * grow), 0.002) + 0.3 * exp(-length(q - dp) / 0.01) * grow);
      }
    }
  }
  float ice = k_fill(d, 0.002);
  // ice: clear blue, brighter at its edges like glass, with a highlight down one side and a glint sliding down
  float rim = exp(-abs(d) / 0.004);
  float down = clamp((1.0 - q.y) / max(bl, 0.01), 0.0, 1.0);
  float side = exp(-pow((q.x - bx + bw * 0.35 * (1.0 - down)) / (bw * 0.18 + 0.002), 2.0));
  float gy = 1.0 - fract(t * 0.25 + bh * 7.0) * bl * 1.6;
  float glint = exp(-pow((q.y - gy) / 0.015, 2.0)) * side;
  col += ice * (vec3(0.25, 0.45, 0.75) * (0.5 + 0.5 * (1.0 - down)) + vec3(0.85, 0.95, 1.0) * (rim * 0.6 + side * 0.35 + glint * 0.9));
  col += ice * vec3(1.0) * step(0.996, hash2(floor(s.px / 2.0) + floor(t * 5.0)));
  return col;
}` },
  { id: 'chase', name: 'Chasing lights', group: 'Christmas', about: 'Bulbs round the outline light in a running chase, alternate, or fill up and empty. On the beat with music.', code: `
int chase_colours = 0; // param: Colours, choice: Multicolour=0|Warm white=1|Red and green=2|Blue and white=3
int chase_pattern = 0; // param: Pattern, choice: Chase=0|Alternate=1|Fill and empty=2
float chase_speed = 1.0; // param: Speed, 0.2..4
float chase_spacing = 30.0; // param: Bulb spacing, 15..100, whole
vec3 chase_bulb(float h) {
  if (chase_colours == 1) return vec3(1.0, 0.75, 0.4);
  if (chase_colours == 2) return h < 0.5 ? vec3(1.0, 0.08, 0.05) : vec3(0.1, 0.9, 0.2);
  if (chase_colours == 3) return h < 0.5 ? vec3(0.2, 0.45, 1.0) : vec3(0.9, 0.95, 1.0);
  return h < 0.25 ? vec3(1.0, 0.1, 0.05) : h < 0.5 ? vec3(0.1, 0.9, 0.2) : h < 0.75 ? vec3(0.2, 0.4, 1.0) : vec3(1.0, 0.75, 0.1);
}
vec3 fx_chase(Surf2 s, float t) {
  float n = max(floor(2.0 * (s.size.x + s.size.y) / chase_spacing), 3.0);
  float along = (atan(s.uv.y - 0.5, s.uv.x - 0.5) / 6.2832 + 0.5) * n;
  float k = floor(along), f = fract(along) - 0.5;
  float sp = 2.0 * (s.size.x + s.size.y) / n;
  float st = floor(uHasAudio > 0.5 ? uBeats : t * chase_speed * 6.0);
  float on;
  if (chase_pattern == 1) on = step(mod(k + st, 2.0), 0.5);
  else if (chase_pattern == 2) { float c = mod(st, 2.0 * n); on = c < n ? step(k, c) : step(c - n, k); }
  else on = step(mod(k - st, 4.0), 1.5);
  float d = length(vec2(f * sp, s.edge - 11.0));
  vec3 c = chase_bulb(chase_colours == 0 ? fract(k * 0.618) : fract(k * 0.5) + 0.01);
  float lvl = mix(0.07, 1.0, on);
  float wire = exp(-abs(s.edge - 11.0) / 1.0) * 0.08;
  return c * (k_fill(d - 4.5, 1.0) + exp(-d / 7.0) * 0.5 * on) * lvl + vec3(0.1, 0.2, 0.1) * wire;
}` },
  { id: 'snowglobe', name: 'Snow globe', group: 'Christmas', about: 'A little snowy house and tree inside a glass globe for something round. Every so often it is shaken and the snow swirls.', code: `
float snowglobe_every = 14.0; // param: Seconds between shakes, 6..40
vec3 fx_snowglobe(Surf2 s, float t) {
  vec2 p = k_centred(s) * 1.05;
  float r = length(p);
  // inside: a deep blue night, a little house with a lit window, a fir tree and snow on the ground
  vec3 col = mix(vec3(0.02, 0.04, 0.14), vec3(0.08, 0.14, 0.32), p.y + 0.5);
  float walls = k_box(p - vec2(-0.08, -0.12), vec2(0.11, 0.08));
  float roof = k_tri(p, vec2(-0.22, -0.045), vec2(0.06, -0.045), vec2(-0.08, 0.08));
  col = mix(col, vec3(0.45, 0.12, 0.08), k_fill(walls, 0.003));
  col = mix(col, vec3(0.85, 0.9, 1.0) * (0.75 + 0.25 * smoothstep(-0.04, 0.0, roof)), k_fill(roof, 0.003));
  float win = k_box(p - vec2(-0.04, -0.11), vec2(0.03, 0.03));
  col = mix(col, vec3(1.0, 0.75, 0.3) * k_flicker(t, 2.0), k_fill(win, 0.002));
  col = mix(col, vec3(0.2, 0.08, 0.04), k_fill(k_box(p - vec2(-0.14, -0.15), vec2(0.025, 0.05)), 0.002));
  float tree = min(k_tri(p, vec2(0.1, -0.17), vec2(0.3, -0.17), vec2(0.2, 0.0)), k_tri(p, vec2(0.12, -0.07), vec2(0.28, -0.07), vec2(0.2, 0.11)));
  col = mix(col, vec3(0.04, 0.32, 0.12) * (0.7 + 0.3 * smoothstep(0.3, 0.1, p.x)), k_fill(tree, 0.003));
  float ground = p.y + 0.2 - 0.03 * cos(p.x * 6.0);
  col = mix(col, vec3(0.8, 0.86, 0.98) * (0.85 + 0.15 * noise(vec3(p * 40.0, 1.0))), k_fill(ground, 0.004));
  // the snow: every shake gives it a burst of energy that dies away; it swirls round and drifts down with it
  float per = snowglobe_every, k = floor((t + s.id * 3.0) / per), since = t + s.id * 3.0 - k * per;
  float burst = 2.0 * (1.0 - exp(-0.5 * per));
  float moved = k * burst + 2.0 * (1.0 - exp(-0.5 * since));
  float energy = exp(-0.5 * since);
  for (int l = 0; l < 2; l++) {
    float fl = float(l);
    vec2 sp = p * k_rot(moved * (1.2 + 0.6 * fl)) + vec2(0.0, 0.03 * t + 0.25 * moved);
    vec3 d = k_drift(sp, vec2(0.0), 0.05 + 0.02 * fl, t, 3.0 + fl);
    col += vec3(1.0) * exp(-length(d.xy) * (28.0 - 6.0 * fl)) * step(0.4 - 0.2 * energy, d.z) * (0.6 + 0.3 * fl);
  }
  // the glass: a curved highlight at the top left and a bright rim
  float a = atan(p.y, p.x);
  col += vec3(0.8, 0.9, 1.0) * exp(-abs(r - 0.4) / 0.012) * smoothstep(0.75, 1.0, cos(a - 2.2)) * 0.6;
  col += vec3(0.6, 0.75, 1.0) * exp(-max(0.5 - r, 0.0) / 0.015) * 0.35;
  return col;
}` },
  { id: 'frost', name: 'Frost', group: 'Christmas', about: 'Feathery frost creeps in from the edges of a window, sparkling, and slowly breathes back.', code: `
float frost_reach = 0.3; // param: How far in, 0.05..0.6
vec3 frost_colour = vec3(0.7, 0.85, 1.0); // param: Colour
vec3 fx_frost(Surf2 s, float t) {
  vec2 q = k_square(s);
  // how far in from the edge, as a share of the shorter side
  float m = max(min(s.size.x, s.size.y), 1.0);
  float e = min(min(s.uv.x, 1.0 - s.uv.x) * s.size.x, min(s.uv.y, 1.0 - s.uv.y) * s.size.y) / m;
  // feathers: ridges of noise at three scales, each stretched a different way
  float fern = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 g = q * k_rot(fi * 2.1 + 0.3) * (7.0 + fi * 9.0);
    float r = 1.0 - abs(2.0 * noise(vec3(g.x * 0.4, g.y, fi * 5.0 + s.id)) - 1.0);
    fern += pow(r, 6.0) * (0.6 - fi * 0.15);
  }
  float front = frost_reach * (0.85 + 0.15 * sin(t * 0.15 + s.id));
  float cover = smoothstep(front, front - 0.12, e + 0.15 * (noise(vec3(q * 6.0, 2.0)) - 0.5));
  float spark = step(0.993, hash2(floor(s.px / 2.0) + floor(t * 4.0))) * cover;
  return frost_colour * cover * (0.12 + 0.9 * fern) + vec3(1.0) * spark;
}` },
  { id: 'curtain', name: 'Light curtain', group: 'Christmas', about: 'Strands of little lights hang down over a window or wall, twinkling, or falling like icicle lights.', code: `
float curtain_spacing = 30.0; // param: Strand spacing, 15..80, whole
int curtain_mode = 0; // param: Lights, choice: Twinkle=0|Falling=1|Steady=2
vec3 curtain_colour = vec3(1.0, 0.78, 0.45); // param: Colour
vec3 fx_curtain(Surf2 s, float t) {
  vec2 px = s.uv * s.size;
  float sp = curtain_spacing, vs = sp / 1.3;
  float c = floor(px.x / sp), h = hash1(vec3(c, s.id, 2.0));
  float x = (c + 0.5) * sp;
  float len = s.size.y * (0.55 + 0.45 * h);
  float down = s.size.y - px.y;
  float k = floor(down / vs);
  float d = length(vec2(px.x - x, px.y - (s.size.y - (k + 0.5) * vs)));
  float on = 1.0;
  if (curtain_mode == 0) on = 0.25 + 0.75 * smoothstep(0.3, 0.8, noise(vec3(c * 3.1, k * 1.7, t * 1.2)));
  if (curtain_mode == 1) {
    // a light runs down each strand, leaving a fading trail
    float head = fract(t * 0.35 + h * 3.0) * (len / vs + 8.0);
    on = step(k, head) * exp(-(head - k) * 0.5) + 0.06;
  }
  float hang = step(down, len);
  return curtain_colour * ((k_fill(d - 3.0, 1.0) + 0.5 * exp(-d / 5.0)) * on + exp(-abs(px.x - x) / 0.8) * 0.04) * hang;
}` },
  { id: 'glitter', name: 'Glitter', group: 'Christmas', about: 'Fine gold or silver glitter that catches the light in sparkles, with more of them on the treble.', code: `
vec3 glitter_colour = vec3(1.0, 0.75, 0.3); // param: Colour
float glitter_sparkle = 1.0; // param: Sparkle, 0.2..3
vec3 fx_glitter(Surf2 s, float t) {
  vec2 g = s.uv * s.size / 5.0;
  vec2 id = floor(g), f = fract(g) - 0.5;
  float h = hash2(id + s.id * 13.0);
  float ph = fract(h * 7.3 + t * (0.3 + 0.5 * h) * glitter_sparkle);
  float flash = pow(max(0.0, 1.0 - abs(ph - 0.5) * 8.0), 3.0);
  float treble = uHasAudio > 0.5 ? uAudio.z : 0.0;
  flash *= step(0.6 - 0.35 * treble, fract(h * 31.0));
  // a base of flakes catching a slow wave of light
  float wave = 0.5 + 0.5 * sin(s.uv.x * 6.0 + s.uv.y * 3.0 - t * 0.8);
  vec3 base = glitter_colour * (0.1 + 0.18 * wave) * (0.5 + fract(h * 17.0));
  return base + mix(glitter_colour, vec3(1.0), 0.5) * flash * exp(-dot(f, f) * 12.0) * 1.5;
}` },
  { id: 'village', name: 'Winter village', group: 'Christmas', about: 'Snowy rooftops along the bottom of the frame with lit windows and chimney smoke, under falling snow.', code: `
float village_snow = 0.5; // param: Snow, 0..1
vec3 fx_village(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  vec3 col = mix(vec3(0.06, 0.08, 0.2), vec3(0.01, 0.01, 0.05), q.y);
  vec2 mc = vec2(aspect * 0.82, 0.8);
  col += vec3(0.9, 0.9, 0.8) * k_fill(length(q - mc) - 0.07, 0.003) + vec3(0.1, 0.12, 0.18) * exp(-length(q - mc) * 6.0);
  float hills = 0.3 + 0.05 * sin(q.x * 2.3 + 0.5) + 0.03 * sin(q.x * 5.1);
  col = mix(col, vec3(0.13, 0.15, 0.25), step(q.y, hills));
  // a house in each cell of the street: its own width, height and roof, a chimney, windows lit or not
  float cell = 0.22, c = floor(q.x / cell), h = hash1(vec3(c, 4.0, 2.0));
  float hw = cell * (0.3 + 0.12 * h), hh = 0.08 + 0.07 * fract(h * 5.0), cx = (c + 0.5) * cell + (fract(h * 11.0) - 0.5) * cell * 0.12;
  float base = 0.11, eaves = base + hh, rh = 0.06 + 0.04 * fract(h * 3.0);
  float walls = k_box(q - vec2(cx, base + hh * 0.5), vec2(hw, hh * 0.5));
  float roof = k_tri(q, vec2(cx - hw - 0.015, eaves), vec2(cx + hw + 0.015, eaves), vec2(cx, eaves + rh));
  vec2 ch = vec2(cx + hw * 0.5, eaves + rh * 0.45);
  float house = min(min(walls, roof), k_box(q - ch, vec2(0.008, 0.035)));
  col = mix(col, vec3(0.03, 0.03, 0.06), k_fill(house, 0.001));
  col = mix(col, vec3(0.8, 0.85, 0.95), k_fill(roof, 0.001) * smoothstep(-0.015, -0.01, roof) * step(eaves + 0.006, q.y));
  vec2 wg = (q - vec2(cx - hw, base)) / vec2(0.03, 0.035);
  float lit = step(0.45, hash1(vec3(c, floor(wg) + floor(t / 25.0 + h * 9.0))));
  float pane = step(abs(fract(wg.x) - 0.5), 0.28) * step(abs(fract(wg.y) - 0.5), 0.3) * step(walls, -0.01) * step(1.0, wg.y);
  col += vec3(1.0, 0.7, 0.3) * lit * pane * k_flicker(t * 0.3, c);
  // chimney smoke, rising and drifting
  vec2 sm = q - ch - vec2(0.0, 0.035);
  float smoke = smoothstep(0.35, 0.75, fbm(vec3(sm * 18.0 - vec2(0.0, t * 0.6), c))) * exp(-sm.y * 6.0) * exp(-pow((sm.x - 0.15 * sm.y) / (0.012 + 0.08 * sm.y), 2.0)) * step(0.0, sm.y);
  col += vec3(0.22, 0.23, 0.28) * smoke;
  // fir trees between some houses
  float tx = c * cell;
  float tree = k_tri(q, vec2(tx - 0.025, base), vec2(tx + 0.025, base), vec2(tx, base + 0.12)) + step(hash1(vec3(c, 8.0, 1.0)), 0.4);
  col = mix(col, vec3(0.02, 0.07, 0.04), k_fill(tree, 0.001));
  // the snowy street, and falling snow
  col = mix(col, vec3(0.65, 0.7, 0.88) * (0.8 + 0.2 * noise(vec3(q * 40.0, 1.0))), step(q.y, base + 0.006 * sin(q.x * 9.0)));
  vec3 d = k_drift(q + vec2(0.02 * sin(t + q.y * 5.0), 0.0), vec2(0.02, -0.06), 0.04, t, 9.0);
  col += vec3(0.9) * exp(-length(d.xy) * 30.0) * step(1.0 - village_snow, d.z);
  return col;
}` },
  { id: 'peppermint', name: 'Peppermint', group: 'Christmas', about: 'A round peppermint candy, red and white swirls turning slowly, for something round.', code: `
vec3 peppermint_colour = vec3(0.9, 0.05, 0.1); // param: Colour
float peppermint_speed = 0.3; // param: Speed, -2..2
vec3 fx_peppermint(Surf2 s, float t) {
  vec2 p = k_centred(s) * 1.05;
  float r = length(p), a = atan(p.y, p.x);
  // eight red wedges that curl as they near the middle, a white middle and a white rim
  float sw = fract((a + r * 3.0) / 6.2832 * 8.0 - t * peppermint_speed);
  float red = smoothstep(0.23, 0.26, abs(sw - 0.5)) * smoothstep(0.06, 0.09, r) * smoothstep(0.47, 0.44, r);
  vec3 col = mix(vec3(0.95, 0.94, 0.92), peppermint_colour, red);
  // a glossy dome: darker at the rim, a highlight up and to the left
  col *= 0.75 + 0.25 * smoothstep(0.5, 0.2, r);
  col += vec3(1.0) * 0.5 * exp(-pow((r - 0.3) / 0.05, 2.0)) * smoothstep(0.6, 1.0, cos(a - 2.3));
  return col * k_fill(r - 0.49, 0.004);
}` },
  { id: 'holly', name: 'Holly garland', group: 'Christmas', about: 'A garland of holly leaves and red berries round the outline, with little lights between, for a door or a window frame.', code: `
float holly_spacing = 60.0; // param: Leaf size, 25..90, whole
bool holly_lights = true; // param: Little lights, toggle
float holly_leaf(vec2 p) {
  // a holly leaf about 1 long along x, its spiky edge bitten out of an ellipse
  float d = k_oval(p, vec2(0.5, 0.2));
  for (int i = 0; i < 4; i++) {
    float x = -0.33 + 0.22 * float(i);
    d = max(d, -(length(vec2(p.x - x, abs(p.y) - 0.25)) - 0.1));
  }
  return d;
}
vec3 fx_holly(Surf2 s, float t) {
  float sp = holly_spacing;
  float n = max(floor(2.0 * (s.size.x + s.size.y) / sp), 3.0);
  float along = (atan(s.uv.y - 0.5, s.uv.x - 0.5) / 6.2832 + 0.5) * n;
  float k = floor(along), f = fract(along) - 0.5;
  float real = 2.0 * (s.size.x + s.size.y) / n;
  vec2 p = vec2(f * real, s.edge - sp * 0.42) / sp;
  // two leaves in a V and a cluster of berries where they meet
  float sway = 0.06 * sin(t * 0.8 + k);
  vec2 l1 = (p - vec2(-0.2, 0.04)) * k_rot(0.45 + sway), l2 = (p - vec2(0.2, 0.04)) * k_rot(-0.45 - sway);
  float leaf = min(holly_leaf(l1 * 2.2), holly_leaf(l2 * 2.2)) / 2.2;
  float vein = exp(-abs(p.x < 0.0 ? l1.y : l2.y) * 200.0) * 0.4;
  vec3 col = vec3(0.03, 0.32, 0.09) * (0.7 + 0.3 * smoothstep(0.0, 0.2, abs(p.x)) + vein) * k_fill(leaf, 0.008);
  float b = min(min(k_circle(p - vec2(-0.06, -0.04), 0.065), k_circle(p - vec2(0.06, -0.04), 0.065)), k_circle(p - vec2(0.0, 0.05), 0.065));
  col = mix(col, vec3(0.85, 0.03, 0.04) * (0.6 + 0.4 * smoothstep(0.0, 0.1, p.y + 0.06)), k_fill(b, 0.008));
  col += vec3(1.0) * 0.6 * k_fill(min(min(k_circle(p - vec2(-0.08, -0.02), 0.015), k_circle(p - vec2(0.04, -0.02), 0.015)), k_circle(p - vec2(-0.02, 0.07), 0.015)), 0.008);
  if (holly_lights) {
    float d = length(vec2((0.5 - abs(f)) * real, s.edge - sp * 0.42));
    float on = 0.4 + 0.6 * smoothstep(0.3, 0.8, noise(vec3(floor(along + 0.5) * 1.3, t * 1.4, s.id)));
    col += vec3(1.0, 0.78, 0.45) * (k_fill(d - 3.0, 1.0) + 0.4 * exp(-d / 6.0)) * on;
  }
  return col;
}` },
  { id: 'wreath', name: 'Wreath', group: 'Christmas', about: 'A green wreath with twinkling lights and a red bow, for something round.', code: `
int wreath_colours = 0; // param: Lights, choice: Multicolour=0|Warm white=1|None=2
bool wreath_bow = true; // param: Bow, toggle
vec3 fx_wreath(Surf2 s, float t) {
  vec2 p = k_centred(s) * 1.05;
  float r = length(p), a = atan(p.y, p.x);
  // the ring of greenery: tufts of needles, rough at its edges
  float ring = abs(r - 0.34) - 0.12 - 0.03 * (noise(vec3(a * 18.0, r * 30.0, 3.0)) - 0.5);
  float needles = 0.5 * noise(vec3(a * 40.0, r * 60.0, 0.0)) + 0.5 * noise(vec3(p * 70.0, 2.0));
  vec3 col = mix(vec3(0.01, 0.1, 0.03), vec3(0.08, 0.42, 0.14), needles) * (0.7 + 0.3 * smoothstep(0.4, 0.2, length(p - vec2(-0.2, 0.2)))) * k_fill(ring, 0.006);
  // red berries here and there
  vec3 bd = k_drift(vec2(a * 0.6, r), vec2(0.0), 0.05, 0.0, 6.0);
  col = mix(col, vec3(0.85, 0.05, 0.05), k_fill(length(bd.xy * vec2(1.0, 1.0)) - 0.12, 0.05) * step(0.75, bd.z) * k_fill(ring + 0.02, 0.006));
  if (wreath_colours < 2) {
    float nb = 18.0, k = floor(a / 6.2832 * nb + 0.5), ba = k / nb * 6.2832;
    vec2 bp = (0.34 + 0.06 * sin(k * 2.7)) * vec2(cos(ba), sin(ba));
    float d = length(p - bp);
    float h = fract(k * 0.618);
    vec3 c = wreath_colours == 1 ? vec3(1.0, 0.75, 0.4) : h < 0.25 ? vec3(1.0, 0.1, 0.05) : h < 0.5 ? vec3(0.1, 0.9, 0.2) : h < 0.75 ? vec3(0.2, 0.4, 1.0) : vec3(1.0, 0.75, 0.1);
    float on = 0.35 + 0.65 * smoothstep(0.2, 0.8, noise(vec3(k * 1.7, t * 1.5, s.id)));
    col += c * (k_fill(d - 0.014, 0.003) + 0.4 * exp(-d / 0.025)) * on;
  }
  if (wreath_bow) {
    vec2 b = vec2(abs(p.x), p.y + 0.38);
    vec2 lp = (b - vec2(0.08, 0.03)) * k_rot(-0.3);
    float bow = min(max(k_oval(lp, vec2(0.085, 0.05)), -k_oval(lp, vec2(0.04, 0.015))), k_tri(b, vec2(0.01, -0.01), vec2(0.1, -0.12), vec2(0.04, -0.13)));
    bow = min(bow, k_circle(p - vec2(0.0, -0.38), 0.03));
    col = mix(col * (1.0 - 0.4 * k_glow(bow, 0.015)), vec3(0.85, 0.03, 0.05) * (0.65 + 0.35 * smoothstep(0.08, 0.0, length(lp))), k_fill(bow, 0.003));
  }
  return col;
}` },
  candleLook({ id: 'advent', name: 'Advent candles', group: 'Christmas', about: 'Four Advent candles, three purple and one pink, in a ring of greenery. Set how many are lit.', lit: 1, max: 4, base: 0.14,
    candles: [
      { x: 0.2, h: 0.5, colour: 'vec3(0.45, 0.15, 0.7)', rank: 0 },
      { x: 0.4, h: 0.48, colour: 'vec3(0.45, 0.15, 0.7)', rank: 1 },
      { x: 0.6, h: 0.46, colour: 'vec3(1.0, 0.45, 0.7)', rank: 2 },
      { x: 0.8, h: 0.44, colour: 'vec3(0.45, 0.15, 0.7)', rank: 3 },
    ],
    holder: `// the greenery round their feet, with a few red berries
  float leaves = q.y - 0.15 - 0.04 * noise(vec3(q.x * 25.0, 1.0, s.id)) - 0.03 * sin(q.x * 40.0);
  col += mix(vec3(0.01, 0.1, 0.03), vec3(0.06, 0.38, 0.12), noise(vec3(q * 60.0, 2.0))) * k_fill(leaves, 0.004) * step(0.02, q.y);
  vec3 bd = k_drift(q, vec2(0.0), 0.04, 0.0, 4.0);
  col = mix(col, vec3(0.85, 0.05, 0.05), k_fill(length(bd.xy) - 0.12, 0.05) * step(0.8, bd.z) * k_fill(leaves + 0.02, 0.004));` }),
  { id: 'train', name: 'Christmas train', group: 'Christmas', about: 'A little red steam train with lit carriages chugs along the bottom of the frame, puffing smoke, from one surface to the next.', code: `
float train_every = 20.0; // param: Seconds between trains, 14..60
vec3 fx_train(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  vec3 col = mix(vec3(0.04, 0.05, 0.15), vec3(0.01, 0.01, 0.05), q.y);
  vec3 st = k_drift(q, vec2(0.0), 0.05, t, 17.0);
  col += vec3(0.8) * exp(-length(st.xy) * 40.0) * step(0.75, st.z) * (0.6 + 0.4 * sin(t * 2.0 + st.z * 50.0));
  float gy = 0.1;
  col = mix(col, vec3(0.6, 0.65, 0.82) * (0.8 + 0.2 * noise(vec3(q * 40.0, 1.0))), step(q.y, gy - 0.008));
  col += vec3(0.5) * exp(-abs(q.y - gy + 0.004) / 0.002) * 0.6;
  // the train: an engine and three carriages, crossing in the first part of each wait
  float n = floor(t / train_every), since = t - n * train_every, speed = 0.28;
  float x0 = -0.15 + since * speed;
  float puffs = 0.0;
  if (q.x < x0 + 0.4 && q.x > x0 - 1.2) {
    vec2 p = vec2(x0 - q.x, q.y - gy);
    float d = 1e3;
    // the engine: a boiler, a cab, a chimney, wheels
    float boiler = k_box(p - vec2(0.09, 0.06), vec2(0.08, 0.032)) - 0.008;
    float cab = k_box(p - vec2(0.21, 0.08), vec2(0.045, 0.06));
    float chim = k_box(p - vec2(0.035, 0.115), vec2(0.012, 0.025));
    float eng = min(min(boiler, cab), chim);
    col = mix(col, vec3(0.8, 0.08, 0.06) * (0.7 + 0.3 * smoothstep(0.09, 0.04, p.y)), k_fill(eng, 0.001));
    col = mix(col, vec3(1.0, 0.75, 0.25), k_fill(abs(p.x - 0.12) - 0.006, 0.001) * k_fill(boiler, 0.001));
    col = mix(col, vec3(1.0, 0.75, 0.3), k_fill(k_box(p - vec2(0.21, 0.1), vec2(0.025, 0.02)), 0.001));
    // carriages behind, each with three lit windows
    float ci = floor((p.x - 0.26) / 0.24);
    if (ci >= 0.0 && ci < 3.0) {
      vec2 cp = vec2(p.x - 0.26 - ci * 0.24 - 0.115, p.y);
      float car = k_box(cp - vec2(0.0, 0.065), vec2(0.105, 0.04)) - 0.006;
      vec3 cc = mod(ci, 2.0) < 0.5 ? vec3(0.1, 0.5, 0.15) : vec3(0.75, 0.1, 0.08);
      col = mix(col, cc * (0.7 + 0.3 * smoothstep(0.09, 0.04, cp.y)), k_fill(car, 0.001));
      float win = k_box(vec2(mod(cp.x + 0.105, 0.07) - 0.035, cp.y - 0.072), vec2(0.022, 0.018));
      col = mix(col, vec3(1.0, 0.75, 0.35) * k_flicker(t * 0.4, ci), k_fill(win, 0.001) * k_fill(car + 0.01, 0.001));
      col = mix(col, vec3(0.1), k_fill(k_seg(cp, vec2(-0.13, 0.03), vec2(-0.105, 0.03)) - 0.004, 0.001));
      d = min(d, min(length(cp - vec2(-0.065, 0.02)), length(cp - vec2(0.065, 0.02))) - 0.019);
    }
    if (p.x < 0.27) d = min(min(length(p - vec2(0.05, 0.022)), length(p - vec2(0.11, 0.022))), length(p - vec2(0.2, 0.026)) - 0.004) - 0.021;
    // wheels with turning spokes
    col = mix(col, vec3(0.15) + vec3(0.3) * step(0.8, abs(sin(atan(p.y - 0.022, mod(p.x, 0.06) - 0.03) * 3.0 + t * speed / 0.02))), k_fill(d, 0.001));
    col = mix(col, vec3(0.8, 0.8, 0.85), k_fill(abs(d + 0.004) - 0.002, 0.001));
    // a headlamp shining ahead
    col += vec3(1.0, 0.85, 0.5) * exp(-length((p - vec2(0.0, 0.07)) * vec2(1.0, 4.0)) * 12.0) * step(p.x, 0.0) * 0.8;
    col += vec3(1.0, 0.9, 0.6) * k_fill(length(p - vec2(0.0, 0.07)) - 0.01, 0.001);
    // smoke: puffs left behind where the chimney was, growing and fading
    for (int i = 0; i < 6; i++) {
      float age = fract(t * 1.1 + float(i) / 6.0) * 1.6;
      vec2 pc = vec2(x0 - 0.035 - speed * age + 0.03 * age, gy + 0.14 + age * 0.09);
      float rp = 0.015 + age * 0.03;
      puffs += k_fill(length(q - pc) - rp * (0.8 + 0.3 * noise(vec3((q - pc) * 40.0, float(i)))), 0.01) * (1.0 - age / 1.6);
    }
  }
  return col + vec3(0.4, 0.42, 0.48) * min(puffs, 1.0) * step(since * speed, aspect + 2.0);
}` },
  { id: 'snowdrift', name: 'Snowdrift', group: 'Christmas', about: 'Snow falls and piles up along the bottom edge, deeper and deeper, then melts away and starts again.', code: `
float snowdrift_minutes = 1.0; // param: Minutes to fill, 0.3..5
float snowdrift_depth = 0.35; // param: Deepest, 0.1..0.8
vec3 fx_snowdrift(Surf2 s, float t) {
  vec2 q = k_square(s);
  float w = s.size.x / max(s.size.y, 1.0);
  float cycle = snowdrift_minutes * 75.0;
  float ph = fract(t / cycle + s.id * 0.1);
  float level = snowdrift_depth * (ph < 0.8 ? ph / 0.8 : (1.0 - ph) / 0.2);
  // a lumpy drift, deepest against the sides
  float prof = level * (0.65 + 0.3 * noise(vec3(q.x * 3.0, s.id, 1.0)) + 0.15 * noise(vec3(q.x * 9.0, 2.0, s.id)) + 0.4 * exp(-q.x * 6.0) + 0.4 * exp(-(w - q.x) * 6.0));
  vec3 snow = mix(vec3(0.4, 0.5, 0.8), vec3(0.95, 0.97, 1.0), smoothstep(prof - 0.12, prof, q.y)) * (0.85 + 0.15 * noise(vec3(q * 50.0, 1.0)));
  snow += vec3(1.0) * step(0.99, hash2(floor(s.px / 2.0) + floor(t * 3.0))) * step(prof - 0.05, q.y);
  vec3 col = snow * k_fill(q.y - prof, 0.003);
  // flakes falling on it
  for (int l = 0; l < 2; l++) {
    float fl = float(l);
    vec3 d = k_drift(q + vec2(0.03 * sin(t * 0.8 + q.y * 4.0 + fl), 0.0), vec2(0.01, -0.07 - 0.04 * fl), 0.05 + 0.03 * fl, t, 2.0 + fl * 9.0);
    col += vec3(0.9, 0.95, 1.0) * exp(-length(d.xy) * (26.0 - 6.0 * fl)) * step(0.4, d.z) * step(prof, q.y) * (0.6 + 0.3 * fl);
  }
  return col;
}` },
  { id: 'plaid', name: 'Plaid', group: 'Christmas', about: 'Cosy woven tartan or buffalo check, for a pillar, a box or a door.', code: `
int plaid_kind = 0; // param: Pattern, choice: Red tartan=0|Buffalo check=1|Green tartan=2
float plaid_size = 1.0; // param: Size, 0.4..3
vec3 plaid_thread(float x) {
  // the colour of a thread at x (0..1 through one repeat of the pattern)
  if (plaid_kind == 1) return x < 0.5 ? vec3(0.75, 0.04, 0.04) : vec3(0.03);
  vec3 ground = plaid_kind == 2 ? vec3(0.03, 0.3, 0.12) : vec3(0.72, 0.04, 0.05);
  vec3 band = plaid_kind == 2 ? vec3(0.02, 0.05, 0.25) : vec3(0.02, 0.22, 0.08);
  vec3 c = ground;
  if (x > 0.1 && x < 0.38) c = band;
  if (x > 0.48 && x < 0.6) c = vec3(0.02, 0.03, 0.18);
  if (abs(x - 0.79) < 0.012) c = vec3(0.95, 0.8, 0.2);
  if (abs(x - 0.24) < 0.008) c = plaid_kind == 2 ? vec3(0.8, 0.1, 0.08) : vec3(0.9);
  return c;
}
vec3 fx_plaid(Surf2 s, float t) {
  vec2 q = k_square(s) * 3.0 / plaid_size;
  // the weave: threads one way cross the other, showing in turn along a diagonal twill
  float twill = step(0.5, fract((s.px.x + s.px.y) / 4.0));
  vec3 c = mix(plaid_thread(fract(q.x)), plaid_thread(fract(q.y)), twill * 0.6 + 0.2);
  return c * (0.85 + 0.15 * noise(vec3(s.px * 0.3, 1.0)));
}` },
  { id: 'snowflakes', name: 'Big snowflakes', group: 'Christmas', about: 'Big six-armed snowflakes drift down slowly, turning, from one surface to the next.', code: `
float snowflakes_size = 1.0; // param: Size, 0.4..2
float snowflakes_speed = 1.0; // param: Speed, 0.2..3
float snowflakes_flake(vec2 p) {
  // a six-armed flake about 1 across: fold into one twelfth, then an arm with two pairs of branches
  float a = mod(atan(p.y, p.x), 1.047198) - 0.523599, r = length(p);
  vec2 q = r * vec2(cos(a), abs(sin(a)));
  float arm = k_seg(q, vec2(0.0), vec2(0.5, 0.0));
  float br = min(k_seg(q, vec2(0.2, 0.0), vec2(0.27, 0.12)), k_seg(q, vec2(0.34, 0.0), vec2(0.39, 0.08)));
  return min(min(arm, br), abs(r - 0.09)) - 0.022;
}
vec3 fx_snowflakes(Surf2 s, float t) {
  vec2 q = k_frame(s);
  vec3 col = vec3(0.0);
  for (int l = 0; l < 2; l++) {
    float fl = float(l);
    float cell = (0.2 + 0.1 * fl) * snowflakes_size;
    vec3 d = k_drift(q + vec2(0.03 * sin(t * 0.5 + q.y * 3.0 + fl), 0.0), vec2(0.01, -(0.035 + 0.03 * fl)) * snowflakes_speed, cell, t, 3.0 + fl * 5.0);
    if (d.z < 0.5) continue;
    vec2 p = d.xy * 2.5 * k_rot(t * 0.6 * (d.z - 0.75) * snowflakes_speed + d.z * 20.0);
    float f = snowflakes_flake(p) / 2.5;
    col += vec3(0.75, 0.88, 1.0) * (0.6 + 0.4 * fl) * (k_fill(f, 0.006) + 0.3 * k_glow(f, 0.03));
  }
  return col;
}` },
  { id: 'bells', name: 'Jingle bells', group: 'Christmas', about: 'Two golden bells under a red bow swing and ring, harder on the beat.', code: `
vec3 bells_colour = vec3(1.0, 0.72, 0.22); // param: Colour
float bells_swing = 1.0; // param: Swing, 0..2
float bells_bell(vec2 p) {
  // a bell hanging from the origin, mouth down, about 0.45 tall: a dome, sides that flare, a lip
  float dome = k_circle(p - vec2(0.0, -0.15), 0.1);
  float y = clamp((-0.15 - p.y) / 0.24, 0.0, 1.0);
  float sides = max(abs(p.x) - (0.1 + 0.09 * y * y), max(p.y + 0.15, -0.39 - p.y));
  float lip = k_box(p - vec2(0.0, -0.4), vec2(0.2, 0.018)) - 0.01;
  return min(min(dome, sides), lip);
}
vec3 fx_bells(Surf2 s, float t) {
  vec2 p = k_centred(s);
  float kick = k_pulse(t, 100.0);
  vec3 col = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    float side = float(i) * 2.0 - 1.0;
    vec2 pivot = vec2(side * 0.12, 0.28);
    // they hang splayed apart from the bow and swing in towards each other, never quite crossing
    float a = side * max(0.42 + bells_swing * (0.1 * sin(t * 2.4) - 0.08 * kick), 0.25);
    vec2 lp = (p - pivot) * k_rot(a);
    float d = bells_bell(lp);
    // metal: brighter on one side, a highlight down it, darker inside the mouth
    float shine = 0.45 + 0.55 * smoothstep(0.15, -0.08, lp.x) + 0.6 * exp(-pow((lp.x + 0.05) / 0.02, 2.0));
    col = mix(col, bells_colour * shine * (0.7 + 0.3 * smoothstep(-0.4, -0.1, lp.y)), k_fill(d, 0.003));
    col = mix(col, bells_colour * 0.25, k_fill(k_circle(lp - vec2(0.0, -0.41), 0.035), 0.003));
    // rings of sound off each bell on the beat
    float ring = abs(length(lp - vec2(0.0, -0.3)) - (0.3 - 0.2 * kick)) - 0.004;
    col += bells_colour * 0.5 * kick * k_glow(ring, 0.01) * step(0.0, d);
  }
  // the bow they hang from
  vec2 b = vec2(abs(p.x), p.y - 0.3);
  vec2 lp = (b - vec2(0.08, 0.02)) * k_rot(-0.35);
  float bow = min(k_oval(lp, vec2(0.085, 0.05)), k_tri(b, vec2(0.01, 0.0), vec2(0.1, -0.13), vec2(0.04, -0.14)));
  bow = min(bow, k_circle(p - vec2(0.0, 0.3), 0.03));
  col = mix(col, vec3(0.85, 0.04, 0.06) * (0.6 + 0.4 * smoothstep(0.08, 0.0, length(lp))), k_fill(bow, 0.003));
  return col;
}` },
];
