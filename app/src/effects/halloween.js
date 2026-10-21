// Halloween looks. Dark backgrounds with things moving in them, made for a single cabinet door or a few, and looks
// shaped for one real object: a pumpkin, a window, a door. See docs/looks.md.
import { fireLook, dripLook, skull, hand } from './families.js';

export const HALLOWEEN = [
  { id: 'bats', name: 'Bats', group: 'Halloween', about: 'Bats fly across the frame, from one surface to the next, in front of a moonlit haze.', code: `
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
float bats_count = 14.0; // param: How many, 1..14, whole
float bats_speed = 1.0; // param: Speed, 0.3..3
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
    if (fi >= bats_count) break;
    float speed = (0.12 + 0.12 * h) * bats_speed;
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
  { id: 'eyes', name: 'Glowing eyes', group: 'Halloween', about: 'Pairs of eyes open in the dark, look around, blink and close.', code: `
int eyes_colour = 0; // param: Colour, choice: Yellow and red=0|All yellow=1|All red=2|All green=3
vec3 fx_eyes(Surf2 s, float t) {
  // pairs of eyes open in the dark, look around, blink and close again
  vec2 n = max(floor(s.size / vec2(160.0, 110.0)), 1.0);
  vec2 g = s.uv * n, id = floor(g), f = fract(g) - 0.5;
  float h = hash2(id + s.id * 13.0);
  float cycle = 6.0 + 5.0 * h, ph = fract(t / cycle + h * 3.7);
  float open = smoothstep(0.0, 0.08, ph) * smoothstep(0.7, 0.62, ph);
  open *= step(0.06, abs(fract(t * 0.37 + h * 5.0) - 0.5));   // a blink now and then
  vec2 look = 0.05 * vec2(sin(t * 0.7 + h * 9.0), 0.4 * sin(t * 0.5 + h * 4.0));
  vec3 col = eyes_colour == 1 || (eyes_colour == 0 && h > 0.5) ? vec3(1.0, 0.85, 0.1) : eyes_colour == 3 ? vec3(0.3, 1.0, 0.15) : vec3(0.95, 0.15, 0.05);
  float eyes = 0.0;
  for (int k = 0; k < 2; k++) {
    vec2 p = (f - vec2(k == 0 ? -0.16 : 0.16, 0.0)) / vec2(0.12, 0.12 * open + 0.001);
    float e = smoothstep(1.0, 0.8, length(p));
    float pupil = smoothstep(0.25, 0.4, abs(p.x - look.x * 8.0));
    eyes += e * pupil + 0.35 * exp(-length(p) * 1.2) * open;
  }
  return col * eyes * (0.8 + 0.4 * uBeat) * step(0.25, h);
}` },
  { id: 'fog', name: 'Ghostly fog', group: 'Halloween', about: 'Pale green fog rolling across the frame, thicker towards the bottom.', code: `
vec3 fog_colour = vec3(0.45, 0.95, 0.6); // param: Colour
float fog_thickness = 0.5; // param: Thickness, 0..1
vec3 fx_fog(Surf2 s, float t) {
  // pale green fog rolling across the frame, thicker towards the bottom
  vec2 q = s.screen * vec2(uRes.x / uRes.y, 1.0) * 2.5;
  float f = fbm(vec3(q.x - t * 0.15, q.y + 0.2 * sin(t * 0.2), t * 0.05));
  f = smoothstep(0.35, 0.8, f + 0.4 * (1.0 - s.screen.y) - 0.15 + (fog_thickness - 0.5) * 0.6);
  float wisp = fbm(vec3(q * 3.0 + vec2(t * 0.3, 0.0), t * 0.1));
  return fog_colour * f * (0.4 + 0.6 * wisp) * (0.8 + 0.4 * uAudio.w);
}` },
  { id: 'lightning', name: 'Lightning', group: 'Halloween', about: 'A dark storm with a double flash every few seconds, or on the beat.', code: `
float lightning_every = 2.5; // param: Seconds between flashes, 1..12
vec3 fx_lightning(Surf2 s, float t) {
  // a dark stormy purple; every few seconds (or on the beat) a double flash of cold light
  float slot = floor(t / lightning_every), h = hash1(vec3(slot, 4.0, 1.0));
  float at = slot * lightning_every + h * lightning_every * 0.6, dt = t - at;
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
  { id: 'candle', name: 'Candle glow', group: 'Halloween', about: 'Warm flickering candlelight from below.', code: `
vec3 candle_colour = vec3(1.0, 0.45, 0.08); // param: Colour
vec3 fx_candle(Surf2 s, float t) {
  // warm light from below that flickers like candles, brighter near the bottom edge
  float flick = 0.75 + 0.15 * noise(vec3(t * 6.0, s.id, 0.0)) + 0.1 * noise(vec3(t * 17.0, s.id, 3.0));
  float lift = mix(1.0, 0.25, s.uv.y) * (0.85 + 0.3 * fbm(vec3(s.uv * 3.0 + vec2(0.0, -t * 0.4), t * 0.2)));
  return candle_colour * lift * flick + vec3(1.0, 0.6, 0.2) * exp(-s.edge / 4.0) * 0.2;
}` },
  // Jack-o'-lantern, singing to the music: made for a circle traced over a real pumpkin
  { id: 'pumpkin', name: "Jack-o'-lantern", group: 'Halloween', about: 'A carved, candlelit face for a real pumpkin (trace a circle on it). With music, the mouth sings along.', code: `
float pumpkin_carve(vec2 p, float kind, float open) {
  // the carved holes, in units where the pumpkin is about 1 across: eyes (kind picks which), nose, a toothy grin
  vec2 e = vec2(abs(p.x), p.y);
  float eyes = kind < 0.33 ? k_tri(e, vec2(0.07, 0.06), vec2(0.29, 0.06), vec2(0.18, 0.25))
    : kind < 0.66 ? k_tri(e, vec2(0.07, 0.15), vec2(0.3, 0.05), vec2(0.27, 0.2))
    : k_oval(e - vec2(0.17, 0.13), vec2(0.085, 0.1));
  float nose = k_tri(p, vec2(-0.05, -0.03), vec2(0.05, -0.03), vec2(0.0, 0.06));
  // the grin opens downwards: its top stays put under the cut-away curve
  float ry = 0.12 + 0.09 * open;
  float mouth = max(k_oval(p + vec2(0.0, 0.04 + ry), vec2(0.34, ry)), -k_oval(p - vec2(0.0, 0.03), vec2(0.37, 0.12)));
  mouth = max(mouth, -k_box(vec2(abs(p.x) - 0.11, p.y + 0.105), vec2(0.035, 0.03)));
  mouth = max(mouth, -k_box(p + vec2(0.0, 0.01 + 2.0 * ry), vec2(0.035, 0.035)));
  return min(min(eyes, nose), mouth);
}
int pumpkin_face = 0; // param: Face, choice: Different on each=0|Triangle eyes=1|Angry=2|Round eyes=3
vec3 pumpkin_flame = vec3(1.0, 0.5, 0.06); // param: Candle colour
vec3 fx_pumpkin(Surf2 s, float t) {
  vec2 p = k_centred(s) * 1.05;
  float open = uHasAudio > 0.5 ? clamp(uAudio.w * 1.5 + 0.4 * uBeat - 0.1, 0.0, 1.0) : 0.2;
  float d = pumpkin_carve(p, pumpkin_face == 0 ? hash1(vec3(s.id, 2.0, 5.0)) : float(pumpkin_face) * 0.33 - 0.2, open);
  float fl = k_flicker(t, s.id);
  // the skin, dimly lit from inside, a little brighter between the ribs
  float rib = 0.6 + 0.4 * cos(p.x / sqrt(max(0.3 - p.y * p.y, 0.03)) * 7.0);
  vec3 orange = vec3(1.0, 0.42, 0.05);
  vec3 skin = orange * (0.1 * rib + 0.4 * k_glow(d, 0.05)) * fl;
  // the holes: candlelight, hotter deeper in
  vec3 flame = mix(pumpkin_flame, mix(pumpkin_flame, vec3(1.0), 0.55), k_fill(d + 0.03, 0.03)) * fl;
  return mix(skin, flame, k_fill(d, 0.006));
}` },
  { id: 'window', name: 'Haunted window', group: 'Halloween', about: 'A warm-lit window blind. Someone walks past behind it, a hand presses on the glass, the light goes out. Trace the window.', code: `
${hand('window')}
float window_figure(vec2 p) {
  // someone seen from the waist up, about 1 tall: head, neck, shoulders
  float head = k_oval(p - vec2(0.0, 0.74), vec2(0.1, 0.13));
  float neck = k_box(p - vec2(0.0, 0.58), vec2(0.045, 0.06));
  float body = k_box(p - vec2(0.0, 0.2), vec2(0.17, 0.26)) - 0.07;
  return k_smin(k_smin(head, neck, 0.03), body, 0.05);
}
vec3 window_light = vec3(1.0, 0.6, 0.24); // param: Room light
bool window_walker = true; // param: Someone walks past, toggle
bool window_touch = true; // param: A hand on the glass, toggle
bool window_dark = true; // param: The light goes out, toggle
vec3 fx_window(Surf2 s, float t) {
  vec2 q = k_square(s);
  float aspect = s.size.x / max(s.size.y, 1.0);
  // warm light from the room, brightest in the middle, flickering a little like a fire
  vec3 room = window_light * (0.45 + 0.55 * exp(-length((q - vec2(aspect * 0.5, 0.45)) / vec2(aspect, 1.0)) * 2.5)) * k_flicker(t * 0.4, s.id + 3.0);
  // someone walks past behind the blind
  vec2 walk = k_now_and_then(t, 9.0, 0.85, s.id + 5.0);
  if (window_walker && walk.x >= 0.0 && walk.x < 4.5) {
    float x = mix(-0.35, aspect + 0.35, walk.x / 4.5);
    if (walk.y < 0.5) x = aspect - x;
    vec2 p = (q - vec2(x, -0.08 + 0.015 * abs(sin(walk.x * 6.0)))) / 0.95;
    room *= 1.0 - 0.85 * k_fill(window_figure(p), 0.05);
  }
  // a hand presses on the glass
  vec2 touch = k_now_and_then(t, 13.0, 0.6, s.id + 9.0);
  if (window_touch && touch.x >= 0.0 && touch.x < 3.0) {
    vec2 at = vec2((0.2 + 0.6 * touch.y) * aspect, 0.35 + 0.35 * fract(touch.y * 7.0));
    float a = smoothstep(0.0, 0.1, touch.x) * smoothstep(3.0, 1.8, touch.x);
    room *= 1.0 - 0.9 * a * k_fill(window_hand((q - at) * k_rot(0.3 * (touch.y - 0.5)) / 1.1), 0.004);
  }
  // the light flickers and goes out for a moment
  vec2 dark = k_now_and_then(t, 11.0, 0.4, s.id + 1.0);
  if (window_dark && dark.x >= 0.0 && dark.x < 1.4) room *= dark.x < 0.5 ? step(0.5, fract(dark.x * 11.0)) : 0.06;
  return room;
}` },
  { id: 'ghosts', name: 'Drifting ghosts', group: 'Halloween', about: 'Sheet ghosts float through the frame, from one surface to the next, fading in and out.', code: `
float ghosts_sheet(vec2 p, float t) {
  // a sheet ghost about 1 tall: a round head and a body widening to a wavy hem
  float head = k_circle(p - vec2(0.0, 0.2), 0.28);
  float hw = 0.28 + 0.12 * clamp(0.2 - p.y, 0.0, 1.0);
  float hem = -0.5 + 0.05 * sin(p.x * 22.0 + t * 5.0);
  return k_smin(head, max(abs(p.x) - hw, max(hem - p.y, p.y - 0.2)), 0.05);
}
float ghosts_count = 5.0; // param: How many, 1..5, whole
vec3 ghosts_colour = vec3(0.78, 0.92, 1.0); // param: Colour
vec3 fx_ghosts(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    float fi = float(i), h = hash1(vec3(fi, 2.0, 9.0));
    if (fi >= ghosts_count) break;
    float size = 0.17 + 0.12 * hash1(vec3(fi, 4.0, 1.0));
    float x = mod(h * 5.0 + t * (0.03 + 0.04 * h) * (h > 0.5 ? 1.0 : -1.0), aspect + 0.6) - 0.3;
    float y = 0.28 + 0.45 * hash1(vec3(fi, 7.0, 3.0)) + 0.06 * sin(t * (0.6 + h) + fi * 2.0);
    vec2 p = (q - vec2(x, y)) / size;
    p.x += 0.08 * sin(p.y * 4.0 + t * 2.0);
    float d = ghosts_sheet(p, t + fi);
    float face = min(k_oval(vec2(abs(p.x) - 0.1, p.y - 0.24), vec2(0.05, 0.08)), k_oval(p - vec2(0.0, 0.06), vec2(0.045, 0.065)));
    float body = k_fill(d, 0.02) * (1.0 - k_fill(face, 0.015));
    float vis = smoothstep(-0.2, 0.4, sin(t * 0.25 + fi * 1.9));
    col += vis * (ghosts_colour * body * (0.5 + 0.4 * smoothstep(-0.4, 0.3, p.y)) + ghosts_colour * vec3(0.45, 0.7, 1.0) * k_glow(d, 0.12) * 0.25);
  }
  return col;
}` },
  { id: 'witch', name: 'Witch across the moon', group: 'Halloween', about: 'A big full moon in a starry sky, and now and then a witch on a broom flies past it.', code: `
float witch_shape(vec2 p) {
  // a witch on a broom flying right, about 1.3 long: broom, bristles, robe, cape, head, hat, a foot
  float broom = k_seg(p, vec2(-0.5, -0.05), vec2(0.55, 0.06)) - 0.014;
  float bristles = k_tri(p, vec2(-0.45, -0.04), vec2(-0.78, -0.17), vec2(-0.77, 0.07));
  float robe = k_tri(p, vec2(-0.08, -0.02), vec2(0.18, 0.0), vec2(0.02, 0.32));
  float cape = k_tri(p, vec2(0.02, 0.3), vec2(-0.36, 0.12), vec2(-0.06, 0.02));
  float head = k_circle(p - vec2(0.06, 0.37), 0.065);
  float hat = min(k_tri(p, vec2(-0.04, 0.41), vec2(0.15, 0.43), vec2(-0.12, 0.66)), k_box(p - vec2(0.05, 0.42), vec2(0.14, 0.012)));
  float foot = k_seg(p, vec2(0.1, 0.02), vec2(0.17, -0.11)) - 0.022;
  return min(min(min(broom, bristles), min(robe, cape)), min(min(head, hat), foot));
}
float witch_every = 11.0; // param: Seconds between flights, 6..40
vec3 fx_witch(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  vec2 mc = vec2(aspect * 0.62, 0.58);
  float mr = 0.25, dm = length(q - mc);
  // a deep blue-purple sky, glowing round the moon, with a few twinkling stars
  vec3 col = vec3(0.05, 0.03, 0.12) + vec3(0.3, 0.22, 0.12) * exp(-max(dm - mr, 0.0) * 4.0);
  vec3 st = k_drift(q, vec2(0.0), 0.06, t, 11.0);
  col += vec3(0.9) * exp(-length(st.xy) * 35.0) * step(0.7, st.z) * (0.55 + 0.45 * sin(t * 2.0 + st.z * 50.0));
  // the moon, with darker seas
  float seas = smoothstep(0.42, 0.62, fbm(vec3((q - mc) * 6.0, 2.0)));
  col = mix(col, vec3(1.0, 0.93, 0.72) * (1.0 - 0.25 * seas), k_fill(dm - mr, 0.003));
  // the witch: crosses in the first part of each cycle, dipping in front of the moon
  float cycle = witch_every, n = floor(t / cycle), ph = fract(t / cycle) * 1.7 * cycle / 11.0;   // the same speed, however long the wait
  float x = mix(-0.5, aspect + 0.5, ph);
  float dir = hash1(vec3(n, 1.0, 3.0)) < 0.5 ? 1.0 : -1.0;
  if (dir < 0.0) x = aspect - x;
  vec2 p = (q - vec2(x, mc.y - 0.05 + 0.05 * sin(ph * 6.0) + 0.12 * (hash1(vec3(n, 2.0, 5.0)) - 0.5))) / 0.24;
  p.x *= dir;
  p *= k_rot(0.06 * sin(t * 3.0));
  return col * (1.0 - k_fill(witch_shape(p), 0.012));
}` },
  { id: 'spider', name: 'Spider drop', group: 'Halloween', about: 'A spider lowers itself on a thread, bobs, and climbs back up, beside a web in the corner.', code: `
float spider_body(vec2 p, float t) {
  // a spider hanging head down, about 0.35 tall: abdomen on top, head below, eight legs
  float body = min(k_oval(p - vec2(0.0, 0.06), vec2(0.06, 0.075)), k_circle(p - vec2(0.0, -0.04), 0.04));
  vec2 m = vec2(abs(p.x), p.y);
  float legs = 1e3;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 hip = vec2(0.02, -0.06 + 0.025 * fi);
    vec2 foot = vec2(0.15 + 0.015 * fi, -0.15 + 0.1 * fi) + 0.012 * vec2(sin(t * 8.0 + fi * 1.7 + sign(p.x)), cos(t * 7.0 + fi));
    vec2 knee = mix(hip, foot, 0.45) + vec2(0.015, 0.06);
    legs = min(legs, min(k_seg(m, hip, knee), k_seg(m, knee, foot)) - 0.007);
  }
  return k_smin(body, legs, 0.01);
}
float spider_every = 12.0; // param: Seconds per drop, 6..40
bool spider_web = true; // param: Web in the corner, toggle
vec3 fx_spider(Surf2 s, float t) {
  vec2 q = k_square(s);
  float aspect = s.size.x / max(s.size.y, 1.0);
  // cool light from above, so the spider stands out against it
  vec3 col = vec3(0.32, 0.38, 0.55) * (0.12 + 0.3 * q.y);
  // a web in a top corner: spokes out from the corner and the threads between them
  vec2 wp = q - vec2(mod(s.id, 2.0) < 0.5 ? 0.0 : aspect, 1.0);
  wp.x = abs(wp.x);
  float r = length(wp), a = atan(-wp.y, wp.x);
  float spoke = abs(fract(a / 0.2618 + 0.5) - 0.5) * 0.2618 * r;
  float rr = r * (1.0 + 0.06 * abs(fract(a / 0.2618) - 0.5));
  float ring = abs(fract(rr / 0.045 + 0.5) - 0.5) * 0.045;
  float web = (exp(-spoke / 0.0018) + exp(-ring / 0.0018)) * smoothstep(min(0.45, 0.4 * aspect), min(0.4, 0.35 * aspect), r) * step(0.015, r);
  if (spider_web) col += vec3(0.75, 0.8, 0.9) * min(web, 1.0) * 0.7;
  // the spider: drops, settles with a bounce, hangs, and climbs back up
  float cycle = spider_every, ph = fract(t / cycle + s.id * 0.37), n = floor(t / cycle + s.id * 0.37);
  float x = (0.3 + 0.4 * hash1(vec3(n, s.id, 1.0))) * aspect, low = 0.3 + 0.15 * hash1(vec3(n, s.id, 2.0));
  float y = ph < 0.2 ? mix(1.25, low, smoothstep(0.0, 0.2, ph))
    : ph < 0.7 ? low + 0.04 * sin((ph - 0.2) * 45.0) * exp(-(ph - 0.2) * 15.0) + 0.01 * sin(t * 2.0)
    : mix(low, 1.25, smoothstep(0.7, 1.0, ph));
  float thread = exp(-abs(q.x - x) / 0.0015) * step(y + 0.1, q.y);
  float sp = spider_body((q - vec2(x, y)) / 1.1, t * (ph > 0.7 ? 2.5 : 1.0));
  col = col * (1.0 - k_fill(sp, 0.003)) + vec3(0.75, 0.8, 0.9) * thread * 0.7;
  // two tiny red eyes
  col += vec3(1.0, 0.1, 0.05) * k_fill(length(vec2(abs(q.x - x) - 0.014, q.y - y + 0.06)) - 0.007, 0.002);
  return col;
}` },
  { id: 'peek', name: 'Peeking skull', group: 'Halloween', about: 'A skull leans in from the side, eyes glowing, then ducks back out of sight.', code: `
${skull('peek')}
float peek_every = 8.0; // param: Seconds between peeks, 4..40
vec3 fx_peek(Surf2 s, float t) {
  vec2 q = k_centred(s);
  vec2 hs = 0.5 * s.size / max(min(s.size.x, s.size.y), 1.0);
  float cycle = peek_every, k = t / cycle + s.id * 0.3, n = floor(k), ph = fract(k);
  float side = hash1(vec3(n, s.id, 3.0)) < 0.5 ? -1.0 : 1.0;
  float lean = smoothstep(0.1, 0.28, ph) * smoothstep(0.78, 0.6, ph);
  vec2 c = vec2(side * (hs.x + 0.32 - 0.55 * lean), (hash1(vec3(n, s.id, 5.0)) - 0.5) * max(hs.y - 0.35, 0.0));
  vec2 p = (q - c) * k_rot(-side * 0.35 * lean) / 0.7;
  p += vec2(0.02 * sin(t * 1.3), 0.0) * lean;
  vec3 d = peek_skull(p);
  float bone = k_fill(d.x, 0.006) * (1.0 - k_fill(d.y, 0.006));
  vec3 col = vec3(0.85, 0.9, 0.78) * bone * (0.5 + 0.5 * smoothstep(0.0, -0.12, d.x)) * (0.8 + 0.2 * noise(vec3(p * 12.0, 1.0)));
  float eyes = smoothstep(0.35, 0.45, ph) * smoothstep(0.65, 0.55, ph) * k_flicker(t, 9.0);
  return col + vec3(1.0, 0.12, 0.04) * (k_fill(d.z, 0.01) * 0.9 + k_glow(d.z, 0.05) * 0.3) * eyes;
}` },
  dripLook({ id: 'blood', name: 'Dripping blood', group: 'Halloween', about: 'Blood runs down from the top edge in slow drips.', colour: 'vec3(0.6, 0.0, 0.02)', period: 7 }),
  dripLook({ id: 'slime', name: 'Oozing slime', group: 'Halloween', about: 'Glowing green slime oozes down from the top edge.', colour: 'vec3(0.3, 0.9, 0.05)', period: 10 }),
  { id: 'arcs', name: 'Electric arcs', group: 'Halloween', about: 'Sparks crawl and crackle round the outline, like a mad scientist’s lab. More of them on the beat.', code: `
vec3 arcs_colour = vec3(0.5, 0.6, 1.0); // param: Colour
vec3 fx_arcs(Surf2 s, float t) {
  // round the outline without a seam: noise sampled on a circle as big as the outline is long
  float a = atan(s.uv.y - 0.5, s.uv.x - 0.5);
  vec2 ring = vec2(cos(a), sin(a)) * (s.size.x + s.size.y) / 90.0;
  float tick = floor(t * 15.0);   // real sparks jump rather than glide
  vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float live = step(uHasAudio > 0.5 ? 0.4 - 0.35 * uBeat : 0.4, hash1(vec3(tick, fi, s.id + 1.0)));
    float where = step(0.5, noise(vec3(ring * 0.35 + fi * 5.0, tick * 0.4)));
    float y = 3.0 + 26.0 * fbm(vec3(ring * 0.9 + fi * 7.0, tick * 0.37 + fi)) + 9.0 * (noise(vec3(ring * 4.0, tick + fi * 3.0)) - 0.5);
    float line = exp(-abs(s.edge - y) / 1.3);
    col += live * where * line * mix(arcs_colour, vec3(1.0), line);
  }
  return col + arcs_colour * vec3(0.7, 0.5, 1.0) * k_rim(s, 5.0) * (0.25 + 0.5 * k_pulse(t, 120.0)) + vec3(0.02, 0.02, 0.06);
}` },
  { id: 'cracks', name: 'Breaking through', group: 'Halloween', about: 'Cracks spread across the surface with firelight behind them, jolting with every hit, as if something is breaking out.', code: `
float cracks_net(vec2 p) {
  // closeness to a crack: the edges between the cells of a jittered grid (F2 - F1)
  vec2 id = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    float d = length(g + vec2(hash2(id + g), hash2(id + g + 17.3)) - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return d2 - d1;
}
vec3 cracks_colour = vec3(1.0, 0.25, 0.02); // param: Light behind
vec3 fx_cracks(Surf2 s, float t) {
  vec2 q = k_square(s);
  float aspect = s.size.x / max(s.size.y, 1.0);
  float cycle = 14.0, n = floor(t / cycle), ph = fract(t / cycle);
  vec2 at = vec2((0.25 + 0.5 * hash1(vec3(n, s.id, 1.0))) * aspect, 0.25 + 0.5 * hash1(vec3(n, s.id, 2.0)));
  // the hits: on the beat with music, otherwise every second and a bit; each one jolts the surface
  float hit = k_pulse(t, 50.0);
  vec2 p = q + vec2(sin(t * 70.0), cos(t * 53.0)) * 0.006 * hit;
  float r = 0.1 + 1.1 * ph;
  float dist = length(p - at) + 0.2 * (fbm(vec3(p * 3.0, n)) - 0.5);
  float spread = smoothstep(r, r - 0.2, dist);
  vec2 w = p + 0.06 * vec2(fbm(vec3(p * 4.0, 1.0)), fbm(vec3(p * 4.0, 5.0)));
  float big = cracks_net(w * 4.0 + n * 3.1), fine = cracks_net(w * 11.0 + n * 1.7);
  float line = exp(-big * 25.0) + 0.5 * exp(-fine * 35.0) * smoothstep(r - 0.1, r - 0.5, dist);
  vec3 hot = mix(cracks_colour, mix(cracks_colour, vec3(1.0), 0.6), exp(-big * 60.0));
  float fade = smoothstep(1.0, 0.9, ph);
  return (hot * line * (0.6 + 0.7 * hit) + cracks_colour * 0.3 * exp(-dist * 4.0) * 0.4) * spread * fade;
}` },
  { id: 'flashlight', name: 'Flashlight search', group: 'Halloween', about: 'A torch beam searches the frame. Only where it lands do you see the bloody handprints and claw marks.', code: `
${hand('flashlight')}
float flashlight_size = 0.25; // param: Beam size, 0.1..0.6
vec3 fx_flashlight(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  // the beam: a slow wander with a little hand shake
  vec2 c = vec2(aspect * (0.5 + 0.4 * sin(t * 0.31) * cos(t * 0.17 + 1.0)), 0.5 + 0.32 * sin(t * 0.43 + 1.3));
  c += 0.01 * (vec2(noise(vec3(t * 6.0, 0.0, 0.0)), noise(vec3(0.0, t * 6.0, 4.0))) - 0.5);
  float r = length(q - c) * 0.25 / flashlight_size;
  float beam = smoothstep(0.3, 0.21, r) * (0.75 + 0.25 * smoothstep(0.21, 0.0, r)) + 0.12 * smoothstep(0.5, 0.25, r);
  // the torch dies for a moment now and then
  vec2 dies = k_now_and_then(t, 10.0, 0.5, 2.0);
  if (dies.x >= 0.0 && dies.x < 0.9) beam *= step(0.5, fract(dies.x * 8.0)) * 0.8;
  // what the walls hide: in each cell of the frame, a handprint, claw marks or nothing
  vec2 cell = floor(q / 0.3);
  float h = hash1(vec3(cell, 5.0));
  vec2 p = (fract(q / 0.3) - 0.5) * k_rot(h * 6.28);
  float mark = 0.0;
  if (h < 0.35) mark = k_fill(flashlight_hand(p / 1.1), 0.006) * (0.55 + 0.45 * noise(vec3(p * 40.0, h)));
  else if (h < 0.65) {
    for (int k = 0; k < 4; k++) {
      float fk = float(k), y = p.y + 0.02 * sin(p.x * 9.0);
      float claw = k_seg(vec2(p.x + 0.04 * y, y), vec2(-0.12 + 0.07 * fk, 0.28), vec2(-0.12 + 0.07 * fk, -0.28)) - 0.013 * (1.0 - abs(p.y) / 0.3);
      mark = max(mark, k_fill(claw, 0.004) * 0.85);
    }
  }
  return mix(vec3(1.0, 0.92, 0.75), vec3(0.5, 0.0, 0.0), mark) * beam;
}` },
  { id: 'static', name: 'Haunted TV', group: 'Halloween', about: 'TV snow with a rolling bar. Now and then a face shows through it for a moment.', code: `
bool static_face = true; // param: A face shows through, toggle
vec3 fx_static(Surf2 s, float t) {
  float frame = floor(t * 24.0);
  // the picture slips sideways in bands
  float slip = 0.03 * (hash1(vec3(floor(s.uv.y * 40.0), frame, 1.0)) - 0.5) * step(0.8, hash1(vec3(floor(s.uv.y * 6.0), frame, 2.0)));
  float snow = hash1(vec3(floor(s.px / 2.0) + vec2(slip * s.size.x, 0.0), mod(frame, 97.0) + 0.5));
  float roll = fract(s.uv.y + t * 0.2);
  float bar = smoothstep(0.0, 0.08, roll) * smoothstep(0.3, 0.1, roll);
  vec3 col = vec3(0.78, 0.82, 0.92) * (0.1 + 0.5 * snow) * (0.8 + 0.5 * bar);
  // the face
  vec2 face = k_now_and_then(t, 7.0, 0.7, s.id + 6.0);
  if (static_face && face.x >= 0.0 && face.x < 0.7) {
    vec2 p = k_centred(s) + vec2(slip, 0.0);
    float head = k_oval(p - vec2(0.0, 0.02), vec2(0.22, 0.3));
    float holes = min(k_oval(vec2(abs(p.x) - 0.085, p.y - 0.07), vec2(0.05, 0.06)), k_oval(p + vec2(0.0, 0.15), vec2(0.04, 0.07 + 0.03 * sin(t * 25.0))));
    vec3 f = vec3(0.95) * (0.6 + 0.4 * snow) * (1.0 - k_fill(holes, 0.02));
    col = mix(col, f, sin(face.x / 0.7 * 3.1416) * 0.9 * k_fill(head, 0.08));
  }
  return col * 0.85;
}` },
  { id: 'veins', name: 'Pulsing veins', group: 'Halloween', about: 'Dark red veins over the surface throb with a heartbeat, or with the beat of the music.', code: `
float veins_beat(float ph) { return exp(-ph * 14.0) + 0.6 * exp(-max(ph - 0.22, 0.0) * 14.0) * step(0.22, ph); }
vec3 veins_colour = vec3(0.9, 0.02, 0.05); // param: Colour
float veins_rate = 66.0; // param: Heartbeats a minute, 40..160, whole
vec3 fx_veins(Surf2 s, float t) {
  vec2 q = k_centred(s);
  vec2 w = q + 0.15 * vec2(fbm(vec3(q * 3.0, 1.0)), fbm(vec3(q * 3.0, 7.0)));
  float v1 = 1.0 - abs(2.0 * noise(vec3(w * 5.0, 2.0)) - 1.0);
  float v2 = 1.0 - abs(2.0 * noise(vec3(w * 11.0, 5.0)) - 1.0);
  float veins = pow(v1, 18.0) + 0.6 * pow(v2, 24.0);
  // a heartbeat (lub-dub) that runs outwards from the middle, or the music's beat
  float beat = uHasAudio > 0.5 ? uBeat : veins_beat(fract(t * veins_rate / 60.0 - length(q) * 0.6));
  return veins_colour * vec3(0.11, 0.0, 0.2) * (0.5 + fbm(vec3(q * 4.0, 3.0))) + veins_colour * veins * (0.3 + 0.9 * beat);
}` },
  fireLook({ id: 'hellfire', name: 'Hellfire', group: 'Halloween', about: 'Tall red flames roar up from the bottom edge, surging with the beat.', height: 1.0, speed: 1.6, tint: 'vec3(1.0, 0.75, 0.7)', embers: true, music: true }),
  { id: 'scare', name: 'Jump scare', group: 'Halloween', about: 'Almost dark, with a faint red breath, until a skull flashes up out of nowhere. Good as a cue.', code: `
${skull('scare')}
float scare_every = 9.0; // param: Seconds between scares, 4..40
vec3 fx_scare(Surf2 s, float t) {
  vec2 q = k_centred(s);
  vec3 col = vec3(0.6, 0.0, 0.0) * (0.04 + 0.03 * sin(t * 1.3)) * max(1.0 - length(q), 0.0);
  vec2 ev = k_now_and_then(t, scare_every, 0.85, s.id + 4.0);
  if (ev.x >= 0.0 && ev.x < 1.2) {
    float flash = ev.x < 0.08 ? 1.0 : exp(-(ev.x - 0.08) * 4.0);
    vec2 shake = vec2(hash1(vec3(floor(t * 30.0), 1.0, 2.0)), hash1(vec3(floor(t * 30.0), 3.0, 4.0))) - 0.5;
    vec2 p = (q + shake * 0.03 * flash) / (0.65 + 0.35 * smoothstep(0.0, 0.4, ev.x));
    vec3 d = scare_skull(p);
    float bone = k_fill(d.x, 0.01) * (1.0 - k_fill(d.y, 0.01));
    col += (vec3(0.95, 1.0, 0.9) * bone + vec3(1.0, 0.1, 0.0) * k_fill(d.z, 0.01)) * flash + vec3(0.6) * step(ev.x, 0.04);
  }
  return col;
}` },
];
