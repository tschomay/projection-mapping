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
float leaves_amount = 0.75; // param: How many, 0.1..1
float leaves_speed = 1.0; // param: Speed, 0.3..3
vec3 fx_leaves(Surf2 s, float t) {
  t *= leaves_speed;
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
    float leaf = k_fill(leaves_leaf(p, fract(h * 7.0)), 0.01) * step(1.0 - leaves_amount, h);
    float tone = fract(h * 13.0);
    vec3 c = tone < 0.25 ? vec3(0.85, 0.12, 0.03) : tone < 0.55 ? vec3(1.0, 0.42, 0.03) : tone < 0.8 ? vec3(1.0, 0.72, 0.1) : vec3(0.6, 0.27, 0.06);
    c *= (0.65 + 0.35 * fl) * (1.0 - 0.35 * exp(-abs(p.x) / 0.006));   // the midrib a little darker
    col = mix(col, c, leaf);
  }
  return col;
}` },
  { id: 'moonrise', name: 'Harvest moon', group: 'Fall', about: 'A huge orange moon rises slowly over dark hills, with clouds drifting across it.', code: `
float moonrise_minutes = 1.5; // param: Minutes to rise, 0.5..10
vec3 fx_moonrise(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  // one rise takes a minute and a half (by default); at the end the moon fades and rises again
  float ph = fract(t / (60.0 * moonrise_minutes) + 0.2), up = smoothstep(0.0, 0.85, ph), shown = smoothstep(1.0, 0.94, ph);
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
vec3 dapple_colour = vec3(1.0, 0.78, 0.42); // param: Sunlight
vec3 fx_dapple(Surf2 s, float t) {
  vec2 q = k_frame(s) * 6.0;
  float gust = 0.5 + 0.5 * sin(t * 0.21) * sin(t * 0.13);
  vec2 sway = vec2(sin(t * 0.7), cos(t * 0.53)) * 0.08 * (0.5 + gust);
  float a = fbm(vec3(q + sway, t * 0.05));
  float b = fbm(vec3(q * 2.1 - sway * 1.7, t * 0.08 + 3.0));
  float light = smoothstep(0.56, 0.6, a + 0.12 * (b - 0.5));
  return mix(dapple_colour * vec3(0.12, 0.09, 0.05), dapple_colour, light);
}` },
  { id: 'rain', name: 'Rain on the window', group: 'Fall', about: 'Raindrops on a pane: small ones sit still, bigger ones slide down leaving a wet trail.', code: `
float rain_amount = 0.65; // param: How much, 0.1..1
vec3 fx_rain(Surf2 s, float t) {
  vec2 q = k_square(s);
  vec3 col = vec3(0.1, 0.14, 0.2) * (0.6 + 0.4 * q.y);
  // small drops that stay put: dark body, bright highlight at the top
  vec3 d = k_drift(q, vec2(0.0), 0.05, t, 2.0);
  float r = 0.07 + 0.1 * d.z, on = step(1.0 - rain_amount, fract(d.z * 7.0));
  float drop = k_fill(length(d.xy) - r, 0.03) * on;
  float shine = k_fill(length(d.xy - vec2(-0.3, 0.35) * r) - r * 0.35, 0.03) * on;
  // bigger drops, one per column, that slide down in fits and starts and leave a trail
  float cw = 0.1, cx = floor(q.x / cw), h = hash1(vec3(cx, 3.0, 1.0));
  float ph = fract(t * (0.04 + 0.06 * h) + h);
  ph += 0.012 * sin(ph * 50.0);
  float y = 1.15 - 1.35 * ph;
  vec2 dc = vec2((cx + 0.5 + 0.3 * (h - 0.5)) * cw + 0.004 * sin(y * 30.0 + h * 9.0), y);
  float sliding = step(1.0 - rain_amount, h);
  float big = k_fill(k_oval((q - dc) / cw, vec2(0.2, 0.25)), 0.05) * sliding;
  float bigShine = k_fill(k_oval((q - dc) / cw - vec2(-0.05, 0.07), vec2(0.06, 0.07)), 0.04) * sliding;
  float trail = step(dc.y, q.y) * exp(-abs(q.x - dc.x) / 0.0025) * exp(-(q.y - dc.y) * 4.0) * sliding;
  col *= 1.0 - 0.6 * max(drop, big);
  return col + vec3(0.7, 0.8, 0.95) * max(shine, bigShine) * 0.8 + vec3(0.3, 0.4, 0.5) * trail;
}` },
  { id: 'embers', name: 'Embers rising', group: 'Fall', about: 'Sparks rise and wander up the frame from a bonfire below, glowing and going out.', code: `
float embers_amount = 0.5; // param: How many, 0.1..1
vec3 fx_embers(Surf2 s, float t) {
  vec2 q = k_frame(s);
  vec3 col = vec3(0.35, 0.07, 0.0) * pow(max(1.0 - q.y, 0.0), 3.0) * k_flicker(t * 0.5, 1.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 sway = vec2(0.04 * sin(t * (1.0 + fi * 0.5) + q.y * (5.0 + fi)), 0.0);
    vec3 d = k_drift(q + sway, vec2(0.01, 0.12 + 0.05 * fi), 0.09 - 0.02 * fi, t, 4.0 + fi * 3.0);
    float on = step(1.0 - embers_amount, d.z) * (0.5 + 0.5 * sin(t * (2.0 + 4.0 * d.z) + d.z * 30.0));
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
float geese_every = 16.0; // param: Seconds between flocks, 10..60
vec3 fx_geese(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  vec3 col = mix(vec3(0.9, 0.38, 0.08), vec3(0.16, 0.05, 0.22), smoothstep(0.0, 1.0, q.y)) * 0.75;
  float cycle = geese_every, ph = fract(t / cycle) * cycle / 16.0;   // the same speed, however long the wait
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
float wheat_wind = 1.0; // param: Wind, 0..3
vec3 fx_wheat(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float horizon = 0.58 + 0.02 * sin(q.x * 3.0);
  vec3 sky = mix(vec3(0.9, 0.5, 0.2), vec3(0.25, 0.18, 0.4), smoothstep(horizon, 1.0, q.y)) * 0.55;
  // wind: waves moving across, bending the stalks; far away (near the horizon) they're smaller
  float depth = clamp(q.y / horizon, 0.0, 1.0);
  float wind = fbm(vec3(q.x * 2.0 - t * 0.6 * wheat_wind, q.y * 1.5, t * 0.1));
  float x = q.x + (wind - 0.5) * 0.08 * wheat_wind * (1.0 - depth);
  float stalk = noise(vec3(x * mix(45.0, 160.0, depth), depth * 4.0, 0.0));
  float sheen = smoothstep(0.5, 0.72, wind);
  vec3 field = vec3(1.0, 0.7, 0.25) * (0.25 + 0.45 * stalk + 0.45 * sheen) * (1.0 - 0.45 * depth);
  float top = horizon + 0.012 * stalk;
  return mix(field, sky, smoothstep(top - 0.003, top + 0.003, q.y));
}` },
  fireLook({ id: 'fireplace', name: 'Fireplace', group: 'Fall', about: 'A low, cosy fire on a bed of glowing coals, with sparks drifting up.', height: 0.6, speed: 1.1, embers: true, coals: true }),
  fireLook({ id: 'bonfire', name: 'Bonfire', group: 'Fall', about: 'A big bonfire roaring up from the bottom edge, throwing off sparks.', height: 0.95, speed: 1.4, embers: true }),
  { id: 'turkey', name: 'Turkey', group: 'Fall', about: 'A cheerful Thanksgiving turkey for something round: a fan of tail feathers, a wobbly wattle, a blink now and then.', code: `
vec3 fx_turkey(Surf2 s, float t) {
  vec2 p = k_centred(s) * 1.05;
  vec3 col = vec3(0.0);
  // the tail: a fan of rounded feathers, banded brown, orange, red and gold, ruffling a little
  vec2 c = p - vec2(0.0, -0.14);
  float r = length(c), a = atan(c.y, c.x) + 0.02 * sin(t * 1.3);
  float n = 13.0, f = a / 3.1416 * n, fk = fract(f);
  float tip = 0.4 + 0.035 * sin(fk * 3.1416);
  float fan = step(0.0, c.y + 0.05) * step(r, tip);
  vec3 band = r < 0.2 ? vec3(0.4, 0.22, 0.08) : r < 0.28 ? vec3(0.95, 0.5, 0.08) : r < 0.35 ? vec3(0.85, 0.12, 0.05) : vec3(1.0, 0.75, 0.2);
  col = band * fan * (0.55 + 0.45 * sin(fk * 3.1416)) * (0.85 + 0.15 * hash1(vec3(floor(f), 1.0, 2.0)));
  // the body and the head on its neck
  float body = k_oval(p - vec2(0.0, -0.17), vec2(0.17, 0.19));
  col = mix(col, vec3(0.45, 0.25, 0.1) * (0.6 + 0.4 * smoothstep(0.1, -0.1, p.x)) * (0.85 + 0.15 * sin(p.y * 90.0)), k_fill(body, 0.004));
  float bob = 0.012 * sin(t * 2.5);
  vec2 hp = vec2(0.0, 0.08 + bob);
  float head = min(k_circle(p - hp, 0.075), k_seg(p, vec2(0.0, -0.05), hp) - 0.045);
  col = mix(col, vec3(0.55, 0.35, 0.25), k_fill(head, 0.004));
  vec2 e = vec2(abs(p.x - hp.x) - 0.03, p.y - hp.y - 0.02);
  vec2 bl = k_now_and_then(t, 4.0, 0.7, s.id);
  float open = bl.x >= 0.0 && bl.x < 0.2 ? 0.15 : 1.0;
  col = mix(col, vec3(0.95), k_fill(k_oval(e, vec2(0.02, 0.022 * open)), 0.002));
  col = mix(col, vec3(0.02), k_fill(k_oval(e - vec2(0.004, 0.0), vec2(0.01, 0.012 * open)), 0.002));
  col = mix(col, vec3(1.0, 0.75, 0.15), k_fill(k_tri(p, hp + vec2(-0.025, -0.01), hp + vec2(0.025, -0.01), hp + vec2(0.0, -0.06)), 0.002));
  // the wattle, swinging
  vec2 wp = (p - hp - vec2(0.03, -0.03)) * k_rot(0.3 * sin(t * 3.0));
  col = mix(col, vec3(0.9, 0.1, 0.1), k_fill(min(k_seg(wp, vec2(0.0), vec2(0.0, -0.07)) - 0.014, k_circle(wp - vec2(0.0, -0.08), 0.022)), 0.003));
  // feet
  for (int i = 0; i < 2; i++) {
    float x = float(i) * 0.12 - 0.06;
    col = mix(col, vec3(1.0, 0.55, 0.1), k_fill(min(k_seg(p, vec2(x, -0.34), vec2(x, -0.42)), k_seg(p, vec2(x - 0.04, -0.43), vec2(x + 0.04, -0.43))) - 0.01, 0.003));
  }
  return col;
}` },
  { id: 'owl', name: 'Owl', group: 'Fall', about: 'An owl face for something round: big amber eyes that blink, one at a time, as it tilts its head.', code: `
vec3 owl_eyes = vec3(1.0, 0.6, 0.05); // param: Eye colour
vec3 fx_owl(Surf2 s, float t) {
  vec2 p = k_centred(s) * 1.05 * k_rot(0.15 * sin(t * 0.4) * step(0.5, fract(t / 9.0)));
  // brown feathers, streaked; a pale disc round each eye with fine lines running out from it
  vec3 col = vec3(0.42, 0.28, 0.16) * (0.7 + 0.3 * noise(vec3(p.x * 50.0, p.y * 12.0, 1.0)));
  vec2 m = vec2(abs(p.x), p.y);
  vec2 ec = vec2(0.15, 0.05);
  float dr = length(m - ec);
  vec3 disc = vec3(0.85, 0.72, 0.52) * (0.8 + 0.2 * sin(atan(m.y - ec.y, m.x - ec.x) * 40.0));
  col = mix(col, disc, k_fill(dr - 0.17 - 0.01 * sin(atan(m.y - ec.y, m.x - ec.x) * 9.0), 0.01));
  // a chest of pale feathers with dark chevrons
  vec2 ch = vec2(abs(fract(p.x * 10.0) - 0.5), fract(p.y * 9.0 + abs(fract(p.x * 10.0) - 0.5)));
  col = mix(col, vec3(0.8, 0.7, 0.55) * (1.0 - 0.6 * step(0.8, ch.y)), k_fill(k_oval(p - vec2(0.0, -0.48), vec2(0.3, 0.27)), 0.02));
  // brows and ear tufts
  col = mix(col, vec3(0.2, 0.12, 0.06), k_fill(k_seg(m, vec2(0.02, 0.18), vec2(0.27, 0.25)) - 0.02, 0.006));
  col = mix(col, vec3(0.3, 0.18, 0.08), k_fill(k_tri(m, vec2(0.22, 0.3), vec2(0.34, 0.26), vec2(0.36, 0.48)), 0.006));
  // the eyes: amber, black pupils that widen and narrow, a glint; lids that close one at a time
  float side = p.x < 0.0 ? 0.0 : 1.0;
  vec2 bl = k_now_and_then(t, 3.0, 0.6, s.id + side * 7.0);
  float shut = bl.x >= 0.0 && bl.x < 0.35 ? sin(bl.x / 0.35 * 3.1416) : 0.0;
  vec2 ep = m - ec;
  float iris = length(ep) - 0.095;
  col = mix(col, owl_eyes * (0.6 + 0.4 * smoothstep(0.09, 0.03, length(ep))), k_fill(iris, 0.004));
  col = mix(col, vec3(0.0), k_fill(length(ep) - 0.045 - 0.012 * sin(t * 0.5), 0.004));
  col += vec3(1.0) * 0.8 * k_fill(length(ep - vec2(-0.03 * sign(p.x + 0.0001), 0.035)) - 0.014, 0.004);
  float lid = ep.y - 0.1 + 0.2 * shut;
  col = mix(col, vec3(0.35, 0.22, 0.12), step(0.0, lid) * k_fill(iris - 0.01, 0.004));
  // the beak
  col = mix(col, vec3(0.5, 0.45, 0.35) * (0.7 + 0.3 * smoothstep(0.02, -0.02, p.x)), k_fill(k_tri(p, vec2(-0.035, 0.0), vec2(0.035, 0.0), vec2(0.0, -0.11)), 0.004));
  return col;
}` },
  { id: 'mist', name: 'Morning mist', group: 'Fall', about: 'A golden dawn behind two rows of dark trees, with mist drifting between them, across the frame.', code: `
vec3 mist_light = vec3(1.0, 0.72, 0.4); // param: Light
float mist_speed = 1.0; // param: Mist speed, 0.2..3
vec3 fx_mist(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  vec2 sun = vec2(aspect * 0.3, 0.38);
  vec3 col = mix(mist_light, vec3(0.45, 0.6, 0.8), smoothstep(0.25, 0.9, q.y));
  col += mist_light * 0.6 * exp(-length(q - sun) * 6.0) + vec3(1.0) * k_fill(length(q - sun) - 0.04, 0.004);
  // far trees: a row of pointed tops, hazy
  for (int l = 0; l < 2; l++) {
    float fl = float(l), cell = 0.03 + 0.02 * fl;
    float c = floor(q.x / cell), h = hash1(vec3(c, fl, 5.0));
    float x = fract(q.x / cell) - 0.5;
    float top = 0.3 - 0.13 * fl + (0.04 + 0.04 * fl) * h - abs(x) * cell * 3.0 * (1.0 + h);
    float tree = step(q.y, max(top, 0.24 - 0.13 * fl));
    vec3 tc = mix(vec3(0.25, 0.25, 0.3), vec3(0.03, 0.04, 0.05), fl) + mist_light * (0.15 - 0.12 * fl) * exp(-length(q - sun) * 3.0);
    col = mix(col, tc, tree);
    // mist in front of this row
    float m = fbm(vec3(q * vec2(2.0, 7.0) - vec2(t * 0.02 * mist_speed * (1.0 + fl), 0.0), fl * 3.0));
    float band = exp(-pow((q.y - 0.22 + 0.12 * fl) / 0.06, 2.0));
    col += mix(vec3(0.7, 0.72, 0.8), mist_light, exp(-abs(q.x - sun.x) * 2.0)) * smoothstep(0.3, 0.75, m) * band * 0.7;
  }
  return col;
}` },
  { id: 'squirrel', name: 'Squirrel', group: 'Fall', about: 'Now and then a squirrel bounds along the bottom of the frame with an acorn, from one surface to the next.', code: `
float squirrel_every = 12.0; // param: Seconds between runs, 5..40
float squirrel_shape(vec2 p, float run) {
  // a squirrel bounding right, about 0.9 long with its tail: body, head, ear, legs and a big curled tail
  float body = k_oval((p - vec2(0.0, 0.13)) * k_rot(-0.25 * sin(run)), vec2(0.17, 0.085));
  float head = k_circle(p - vec2(0.19, 0.2 + 0.02 * sin(run)), 0.065);
  float ear = k_tri(p, vec2(0.16, 0.25), vec2(0.2, 0.25), vec2(0.17, 0.31));
  float legs = min(k_seg(p, vec2(0.11, 0.1), vec2(0.17 + 0.07 * sin(run), 0.01)), k_seg(p, vec2(-0.1, 0.1), vec2(-0.13 - 0.07 * sin(run), 0.01))) - 0.028;
  float tail = 1e3;
  for (int k = 0; k < 5; k++) {
    float fk = float(k) / 4.0, a = 2.4 - 2.6 * fk + 0.25 * sin(run - fk * 2.0);
    tail = min(tail, k_circle(p - vec2(-0.2, 0.32) - 0.17 * vec2(cos(a), sin(a)) * (0.6 + 0.4 * fk), 0.05 + 0.04 * fk));
  }
  return min(min(min(body, head), min(ear, legs)), tail);
}
vec3 fx_squirrel(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  float n = floor(t / squirrel_every), since = t - n * squirrel_every;
  float x = -0.4 + since * 0.5;
  if (x > aspect + 0.4) return vec3(0.0);
  float dir = hash1(vec3(n, 2.0, 7.0)) < 0.5 ? 1.0 : -1.0;
  if (dir < 0.0) x = aspect - x;
  float run = since * 14.0;
  vec2 p = (q - vec2(x, 0.02 + 0.06 * abs(sin(run * 0.5)))) / 0.36;
  p.x *= dir;
  float d = squirrel_shape(p, run);
  float fluff = 0.85 + 0.15 * noise(vec3(p * 40.0, 1.0));
  vec3 fur = mix(vec3(0.6, 0.35, 0.18), vec3(0.9, 0.75, 0.55), smoothstep(0.12, 0.05, p.y) * step(-0.15, p.x)) * fluff;
  vec3 col = fur * k_fill(d, 0.01) * (0.6 + 0.4 * smoothstep(-0.1, 0.3, p.y));
  col = mix(col, vec3(0.02), k_fill(length(p - vec2(0.21, 0.22)) - 0.012, 0.005));
  col = mix(col, vec3(0.55, 0.35, 0.15), k_fill(k_oval(p - vec2(0.27, 0.15), vec2(0.03, 0.035)), 0.005));
  col = mix(col, vec3(0.3, 0.2, 0.1), k_fill(k_oval(p - vec2(0.27, 0.18), vec2(0.035, 0.015)), 0.005));
  return col;
}` },
];
