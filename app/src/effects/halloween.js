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
  { id: 'claws', name: 'Claws round the edge', group: 'Halloween', about: 'Now and then a bony clawed hand creeps round the edge of a door and drums its fingers.', code: `
float claws_every = 9.0; // param: Seconds between visits, 4..30
int claws_side = 0; // param: Side, choice: Right=0|Left=1
vec3 fx_claws(Surf2 s, float t) {
  vec2 q = k_square(s);
  float w = s.size.x / max(s.size.y, 1.0);
  if (claws_side == 1) q.x = w - q.x;
  vec2 e = k_now_and_then(t, claws_every, 0.9, s.id);
  float reach = e.x < 0.0 ? 0.0 : smoothstep(0.0, 1.5, e.x) * smoothstep(6.5, 5.0, e.x);
  if (reach <= 0.0) return vec3(0.0);
  float bx = w + 0.03 - reach * 0.36;
  float d = k_box(q - vec2(bx + 0.16, 0.55), vec2(0.15, 0.1)) - 0.04;
  float nails = 1e3;
  // four long fingers, each in two bending joints with a nail, drumming one after another
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 b = vec2(bx, 0.44 + 0.075 * fi);
    float a0 = 3.1416 - 0.12 * (fi - 1.5);
    float curl = 0.5 + 0.45 * max(0.0, sin(t * 7.0 - fi * 0.9)) * step(1.5, e.x);
    vec2 j1 = b + 0.13 * vec2(cos(a0), sin(a0));
    float a1 = a0 + curl;
    vec2 j2 = j1 + 0.1 * vec2(cos(a1), sin(a1));
    float a2 = a1 + curl * 0.8;
    vec2 j3 = j2 + 0.07 * vec2(cos(a2), sin(a2));
    d = min(d, min(k_seg(q, b, j1) - 0.022, k_seg(q, j1, j2) - 0.018));
    d = min(d, k_circle(q - j1, 0.025));
    vec2 nrm = 0.013 * vec2(-sin(a2), cos(a2));
    nails = min(nails, k_tri(q, j2 + nrm, j2 - nrm, j3));
  }
  d = min(d, k_seg(q, vec2(bx + 0.06, 0.45), vec2(bx - 0.04, 0.36)) - 0.022);
  // grey-green skin lit from above, with wrinkles at the knuckles; yellowed nails
  vec3 skin = vec3(0.42, 0.5, 0.33) * (0.5 + 0.5 * smoothstep(-0.03, 0.03, sin(q.y * 84.0))) * (0.6 + 0.4 * noise(vec3(q * 60.0, 1.0)));
  vec3 col = skin * k_fill(d, 0.003);
  col = mix(col, vec3(0.85, 0.8, 0.55), k_fill(nails, 0.002));
  return col;
}` },
  { id: 'web', name: 'Spinning web', group: 'Halloween', about: 'A spider spins its web from nothing, spokes first and then the spiral, beaded with dew. It fades and starts again.', code: `
float web_seconds = 20.0; // param: Seconds to spin, 5..60
int web_place = 0; // param: Where, choice: Whole surface=0|Top left corner=1|Top right corner=2
vec3 fx_web(Surf2 s, float t) {
  vec2 q = k_square(s);
  float w = s.size.x / max(s.size.y, 1.0);
  vec2 c = web_place == 1 ? vec2(0.0, 1.0) : web_place == 2 ? vec2(w, 1.0) : vec2(w * 0.5, 0.5);
  float R = web_place == 0 ? 0.48 * max(w, 1.0) : 0.95;
  vec2 d = q - c;
  float r = length(d), a = atan(d.y, d.x);
  float ph = fract(t / (web_seconds * 1.3) + s.id * 0.37);
  float grow = clamp(ph / 0.77, 0.0, 1.0), fade = smoothstep(1.0, 0.92, ph);
  // spokes first, out to the edge
  float ns = 16.0, sa = 6.2832 / ns;
  float k = floor(a / sa + 0.5);
  float spoke = exp(-abs(sin(a - k * sa)) * r / 0.0018) * step(r, R * min(grow / 0.2, 1.0));
  // then the spiral, from the outside in, sagging a little between spokes
  float gap = 0.035, sp = clamp((grow - 0.2) / 0.8, 0.0, 1.0);
  float sag = 0.006 * sin(fract(a / sa + 0.5) * 3.1416);
  float rr = r + sag + a / 6.2832 * gap;
  float ring = exp(-abs(fract(rr / gap) - 0.5) * gap / 0.0016) * step(R * (1.0 - sp), r) * step(r, R) * step(0.03, r);
  // dew drops strung along the spiral, glinting
  float bead = step(0.9, hash1(vec3(floor(rr / gap), floor(a * 40.0), s.id))) * exp(-abs(fract(rr / gap) - 0.5) * gap / 0.004) * exp(-abs(fract(a * 40.0) - 0.5) * 6.0);
  vec3 col = vec3(0.75, 0.8, 0.85) * (spoke + ring) * 0.8 + vec3(0.9, 0.95, 1.0) * bead * ring * (0.6 + 0.4 * sin(t * 2.0 + a * 10.0));
  // the spider, where the spiral is being laid
  float sr = R * (1.0 - sp), sang = sp * 6.2832 * R / gap;
  vec2 sp2 = c + sr * vec2(cos(sang), sin(sang));
  float body = min(k_circle(q - sp2, 0.018), k_circle(q - sp2 - 0.02 * normalize(c - sp2 + 0.0001), 0.012));
  col = mix(col, vec3(0.25, 0.22, 0.2), k_fill(body, 0.003) * step(0.2, grow) * step(grow, 0.999));
  return col * fade;
}` },
  { id: 'graveyard', name: 'Graveyard', group: 'Halloween', about: 'Crooked tombstones and a dead tree on a hill under the moon, with fog creeping between them.', code: `
float graveyard_fog = 0.7; // param: Fog, 0..1
vec3 fx_graveyard(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  vec3 col = mix(vec3(0.16, 0.12, 0.28), vec3(0.02, 0.02, 0.07), q.y);
  vec2 mc = vec2(aspect * 0.78, 0.74);
  col += vec3(0.95, 0.92, 0.75) * k_fill(length(q - mc) - 0.11, 0.003) + vec3(0.2, 0.18, 0.15) * exp(-length(q - mc) * 4.0);
  float ground = 0.17 + 0.03 * sin(q.x * 2.5 + 1.0);
  float d = q.y - ground;
  // the dead tree
  float tx = aspect * 0.18;
  float tree = k_seg(q, vec2(tx, ground), vec2(tx + 0.02, 0.5)) - 0.018 * (1.2 - q.y);
  tree = min(tree, k_seg(q, vec2(tx + 0.015, 0.38), vec2(tx + 0.16, 0.55)) - 0.008);
  tree = min(tree, k_seg(q, vec2(tx + 0.01, 0.43), vec2(tx - 0.11, 0.6)) - 0.007);
  tree = min(tree, k_seg(q, vec2(tx + 0.1, 0.48), vec2(tx + 0.13, 0.63)) - 0.005);
  tree = min(tree, k_seg(q, vec2(tx - 0.06, 0.52), vec2(tx - 0.03, 0.66)) - 0.004);
  d = min(d, tree);
  // a tombstone in each cell: rounded, a cross or a slab, each leaning its own way
  float cell = 0.24, c = floor(q.x / cell), h = hash1(vec3(c, 7.0, 3.0));
  float cx = (c + 0.5) * cell + (fract(h * 9.0) - 0.5) * 0.08, gy = 0.17 + 0.03 * sin(cx * 2.5 + 1.0);
  float ht = 0.09 + 0.07 * fract(h * 5.0);
  vec2 p = (q - vec2(cx, gy - 0.01)) * k_rot((fract(h * 13.0) - 0.5) * 0.4);
  float stone = h < 0.45 ? min(k_box(p - vec2(0.0, ht * 0.4), vec2(0.04, ht * 0.4)), k_circle(p - vec2(0.0, ht * 0.8), 0.04))
              : h < 0.7 ? min(k_box(p - vec2(0.0, ht * 0.55), vec2(0.012, ht * 0.55)), k_box(p - vec2(0.0, ht * 0.8), vec2(0.04, 0.012)))
              : k_box(p - vec2(0.0, ht * 0.35), vec2(0.05, ht * 0.35));
  d = min(d, stone);
  col = mix(col, vec3(0.02, 0.02, 0.04) + vec3(0.12, 0.12, 0.15) * exp(-abs(stone) / 0.004) * step(0.0, -stone) * step(0.3, h), k_fill(d, 0.002));
  // fog rolling along the ground, in front of everything
  float fog = fbm(vec3(q * vec2(3.0, 8.0) - vec2(t * 0.05, 0.0), t * 0.03)) * smoothstep(0.38, 0.05, q.y) * graveyard_fog;
  return col + vec3(0.45, 0.55, 0.5) * fog * fog * 1.5;
}` },
  { id: 'skeleton', name: 'Dancing skeleton', group: 'Halloween', about: 'A skeleton dances, swinging its arms and kicking its legs, in time with the music.', code: `
${skull('skeleton')}
float skeleton_bone(vec2 p, vec2 a, vec2 b, float r) {
  // a bone from a to b: a shaft with a knob at each end
  return min(k_seg(p, a, b) - r, min(k_circle(p - a, r * 1.5), k_circle(p - b, r * 1.5)));
}
vec3 fx_skeleton(Surf2 s, float t) {
  vec2 p = k_centred(s) / 0.95;
  float ph = uHasAudio > 0.5 ? uBeats + clamp(1.0 - uBeat, 0.0, 1.0) : t * 2.0;
  float sw = sin(ph * 3.1416), bounce = abs(sw) * 0.03;
  vec2 hip = vec2(0.03 * sw, -0.08 + bounce), chest = vec2(0.015 * sw, 0.16 + bounce);
  float d = skeleton_bone(p, hip, chest, 0.01);
  // ribs round the chest, a pelvis
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 rc = p - chest + vec2(0.0, 0.035 + 0.035 * fi);
    d = min(d, max(abs(length(rc * vec2(1.0, 2.8)) - (0.1 - 0.01 * fi)) - 0.01, -rc.y - 0.02));
  }
  d = min(d, abs(k_oval(p - hip, vec2(0.075, 0.035))) - 0.012);
  // arms: one up as the other swings down, each beat the other way
  for (int i = 0; i < 2; i++) {
    float side = float(i) * 2.0 - 1.0;
    vec2 sh = chest + vec2(side * 0.1, 0.0);
    float a = -1.57 + side * (0.6 + 0.9 * max(side * sw, 0.0));
    vec2 el = sh + 0.15 * vec2(side * abs(cos(a)), sin(a));
    float a2 = a + side * 1.2 * (0.5 + 0.5 * sw * side);
    vec2 wr = el + 0.13 * vec2(side * abs(cos(a2)), sin(a2));
    d = min(d, min(skeleton_bone(p, sh, el, 0.008), skeleton_bone(p, el, wr, 0.007)));
    d = min(d, k_circle(p - wr - vec2(side * 0.012, 0.0), 0.02));
    // legs: a kick out to the side on alternate beats
    vec2 hp = hip + vec2(side * 0.05, -0.02);
    float kick = max(side * sw, 0.0);
    vec2 kn = hp + vec2(side * (0.03 + 0.1 * kick), -0.18 + 0.06 * kick);
    vec2 ft = kn + vec2(side * (0.0 + 0.06 * kick), -0.18 + 0.08 * kick);
    d = min(d, min(skeleton_bone(p, hp, kn, 0.01), skeleton_bone(p, kn, ft, 0.009)));
    d = min(d, k_box(p - ft - vec2(side * 0.03, -0.01), vec2(0.035, 0.01)) - 0.005);
  }
  d = min(d, k_seg(p, chest, chest + vec2(0.0, 0.06)) - 0.012);
  vec3 sk = skeleton_skull((p - chest - vec2(0.02 * sw, 0.19)) * k_rot(0.15 * sw) / 0.2);
  float skull = max(sk.x, -sk.y) * 0.2;
  d = min(d, skull);
  vec3 bone = vec3(0.92, 0.9, 0.82);
  return bone * k_fill(d, 0.003) + vec3(0.4, 0.6, 1.0) * 0.25 * k_glow(d, 0.02) * step(0.0, d) * (0.6 + 0.6 * k_pulse(t, 120.0));
}` },
  { id: 'ghostface', name: 'Face in the wall', group: 'Halloween', about: 'Now and then a face pushes out of the wall as if through stretched cloth, mouth open, then sinks back.', code: `
float ghostface_every = 10.0; // param: Seconds between, 4..30
vec3 ghostface_light = vec3(0.55, 0.6, 0.7); // param: Light
float ghostface_height(vec2 p) {
  // a face as a height field, about 0.6 tall: the head, the brow, eye sockets, a nose, an open mouth
  float h = exp(-pow(length(p * vec2(1.0, 0.75)) / 0.22, 2.0));
  h += 0.12 * exp(-pow((p.y - 0.07) / 0.03, 2.0)) * exp(-p.x * p.x / 0.02);
  h -= 0.25 * exp(-(pow(abs(p.x) - 0.075, 2.0) + pow(p.y - 0.03, 2.0)) / 0.0015);
  h += 0.25 * exp(-(p.x * p.x / 0.0006 + pow(p.y + 0.03, 2.0) / 0.004));
  h -= 0.3 * exp(-(p.x * p.x / 0.003 + pow(p.y + 0.14, 2.0) / 0.001));
  return h;
}
vec3 fx_ghostface(Surf2 s, float t) {
  vec2 p = k_centred(s);
  vec2 e = k_now_and_then(t, ghostface_every, 0.9, s.id);
  float push = e.x < 0.0 ? 0.0 : smoothstep(0.0, 2.0, e.x) * smoothstep(6.0, 4.0, e.x);
  // light the bulge from up and to the left; the cloth itself only dimly lit
  float eps = 0.004, h0 = ghostface_height(p);
  vec2 g = vec2(ghostface_height(p + vec2(eps, 0.0)) - h0, ghostface_height(p + vec2(0.0, eps)) - h0) / eps * push * 0.18;
  vec3 n = normalize(vec3(-g, 1.0));
  float lit = max(dot(n, normalize(vec3(-0.5, 0.6, 0.6))), 0.0);
  float cloth = 0.95 + 0.05 * sin(p.x * 500.0 + p.y * 60.0);
  return ghostface_light * cloth * (0.1 + 0.55 * lit * lit + 0.1 * h0 * push);
}` },
  { id: 'zombie', name: 'Zombie hands', group: 'Halloween', about: 'Rotting hands claw their way up out of the earth along the bottom, and sink back down.', code: `
${hand('zombie')}
float zombie_count = 4.0; // param: How many, 1..6, whole
vec3 fx_zombie(Surf2 s, float t) {
  vec2 q = k_square(s);
  float w = s.size.x / max(s.size.y, 1.0);
  float gy = 0.12 + 0.015 * sin(q.x * 11.0);
  vec3 col = vec3(0.05, 0.12, 0.06) * smoothstep(0.6, 0.0, q.y) * (0.6 + 0.4 * fbm(vec3(q * 4.0, t * 0.1)));
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    if (fi >= zombie_count) break;
    float h = hash1(vec3(fi, s.id, 4.0));
    float x = (fi + 0.5) / zombie_count * w + (h - 0.5) * 0.1;
    float ph = fract(t / (8.0 + 4.0 * h) + h);
    float rise = smoothstep(0.0, 0.35, ph) * smoothstep(1.0, 0.75, ph);
    float sway = 0.15 * sin(t * 1.3 + fi * 2.0);
    vec2 wrist = vec2(x + 0.04 * sway, gy - 0.25 + 0.55 * rise);
    float arm = k_seg(q, vec2(x - 0.03, -0.1), wrist) - 0.035;
    float hd = zombie_hand((q - wrist - vec2(0.0, 0.035)) * k_rot(sway) / 0.75) * 0.75;
    float d = min(arm, hd);
    // grey-green skin with dark rot, a torn sleeve
    vec3 skin = vec3(0.4, 0.5, 0.32) * (0.5 + 0.5 * noise(vec3(q * 40.0, fi))) * (0.7 + 0.3 * smoothstep(-0.02, 0.02, q.x - x));
    skin = mix(skin, vec3(0.12, 0.1, 0.08), step(q.y, wrist.y - 0.12) * step(0.4, noise(vec3(q * 25.0, fi + 3.0))));
    col = mix(col, skin, k_fill(d, 0.003) * step(gy, q.y));
  }
  // the earth along the bottom, in front, with clods
  float soil = gy - q.y + 0.01 * noise(vec3(q.x * 40.0, 1.0, 0.0));
  return mix(col, vec3(0.16, 0.1, 0.05) * (0.6 + 0.4 * noise(vec3(q * 50.0, 2.0))), k_fill(-soil, 0.003));
}` },
  { id: 'cauldron', name: 'Cauldron', group: 'Halloween', about: "A witch's cauldron on a fire, its green brew bubbling and steaming, bubbling harder on the beat.", code: `
vec3 cauldron_brew = vec3(0.3, 1.0, 0.2); // param: Brew colour
vec3 fx_cauldron(Surf2 s, float t) {
  vec2 p = k_centred(s);
  float kick = k_pulse(t, 110.0);
  vec3 col = vec3(0.0);
  // fire underneath
  vec2 fq = p - vec2(0.0, -0.5);
  float fl = fbm(vec3(fq.x * 8.0, fq.y * 5.0 - t * 2.0, t * 0.3));
  float heat = clamp(1.0 - fq.y / 0.22, 0.0, 1.0) * smoothstep(0.32, 0.15, abs(fq.x));
  col += k_fire(heat * heat * (0.3 + 1.2 * fl));
  // the pot: an iron belly, lit green from the brew above and orange from the fire below; legs; a rim
  float pot = max(k_oval(p - vec2(0.0, -0.13), vec2(0.33, 0.24)), p.y - 0.03);
  pot = min(pot, k_box(p - vec2(0.0, 0.03), vec2(0.31, 0.022)) - 0.012);
  pot = min(pot, min(k_seg(p, vec2(-0.2, -0.3), vec2(-0.24, -0.42)), k_seg(p, vec2(0.2, -0.3), vec2(0.24, -0.42))) - 0.02);
  vec3 iron = cauldron_brew * 0.25 * smoothstep(-0.25, 0.05, p.y) + vec3(1.0, 0.4, 0.1) * 0.25 * smoothstep(-0.15, -0.37, p.y);
  iron += vec3(0.25) * exp(-pow((p.x + 0.17) / 0.03, 2.0)) * smoothstep(-0.3, -0.05, p.y);
  col = mix(col, iron, k_fill(pot, 0.003));
  // the brew's surface, bubbling: bubbles swell and pop in cells
  float surf = k_oval(p - vec2(0.0, 0.05), vec2(0.28, 0.035));
  vec2 bq = (p - vec2(0.0, 0.05)) * vec2(12.0, 40.0);
  vec2 id = floor(bq), f = fract(bq) - 0.5;
  float bp = fract(t * (0.6 + hash2(id)) + hash2(id + 3.0));
  float bub = exp(-abs(length(f * vec2(1.0, 0.35)) - bp * 0.4) * 20.0) * (1.0 - bp);
  col = mix(col, cauldron_brew * (0.6 + 0.4 * noise(vec3(p * 30.0, t)) + bub * 0.8), k_fill(surf, 0.004));
  // bubbles leaping out, and steam rising
  vec3 b = k_drift(p + vec2(0.02 * sin(t * 4.0 + p.y * 20.0), 0.0), vec2(0.0, 0.15 + 0.2 * kick), 0.05, t, 3.0);
  float above = step(0.06, p.y) * smoothstep(0.5, 0.1, p.y) * step(abs(p.x), 0.25);
  col += cauldron_brew * exp(-abs(length(b.xy) - 0.1) * 50.0) * step(0.7 - 0.2 * kick, b.z) * above;
  float steam = smoothstep(0.45, 0.8, fbm(vec3(p * vec2(4.0, 3.0) - vec2(0.0, t * 0.3), t * 0.1))) * step(0.06, p.y) * exp(-abs(p.x) * 4.0);
  return col + cauldron_brew * 0.35 * steam;
}` },
  { id: 'crawlers', name: 'Creepy crawlies', group: 'Halloween', about: 'Spiders scuttle over a dimly lit wall, stopping and starting.', code: `
float crawlers_count = 8.0; // param: How many, 1..12, whole
vec3 crawlers_light = vec3(0.4, 0.33, 0.15); // param: Light on the wall
float crawlers_spider(vec2 p, float t) {
  // a spider facing right, about 1 across with its legs: abdomen, head, four legs a side that scuttle
  float d = min(k_oval(p + vec2(0.18, 0.0), vec2(0.2, 0.15)), k_circle(p - vec2(0.08, 0.0), 0.09));
  vec2 m = vec2(p.x, abs(p.y));
  for (int k = 0; k < 4; k++) {
    float fk = float(k), wig = 0.06 * sin(t * 30.0 + fk * 1.7 + step(0.0, p.y) * 3.14);
    vec2 a = vec2(0.06 - 0.06 * fk, 0.05);
    vec2 kn = a + vec2(0.12 - 0.1 * fk + wig, 0.22);
    vec2 ft = kn + vec2(0.1 - 0.08 * fk + wig, 0.18);
    d = min(d, min(k_seg(m, a, kn), k_seg(m, kn, ft)) - 0.018);
  }
  return d;
}
vec3 fx_crawlers(Surf2 s, float t) {
  vec2 q = k_square(s);
  float w = s.size.x / max(s.size.y, 1.0);
  vec3 col = crawlers_light * (0.6 + 0.4 * fbm(vec3(q * 3.0, s.id))) * (1.0 - 0.4 * length(s.uv - 0.5));
  float shade = 0.0;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    if (fi >= crawlers_count) break;
    float h = hash1(vec3(fi, s.id, 2.0)), h2 = hash1(vec3(fi, s.id, 6.0));
    // they run, pause, and run again
    float tt = t * 0.7 + 1.5 * sin(t * (0.6 + h) + fi);
    vec2 pos = vec2(w * (0.5 + 0.45 * sin(tt * 0.23 * (1.0 + h) + h * 6.0)), 0.5 + 0.45 * sin(tt * 0.31 * (1.0 + h2) + h2 * 6.0));
    vec2 nxt = vec2(w * (0.5 + 0.45 * sin((tt + 0.05) * 0.23 * (1.0 + h) + h * 6.0)), 0.5 + 0.45 * sin((tt + 0.05) * 0.31 * (1.0 + h2) + h2 * 6.0));
    vec2 dir = normalize(nxt - pos + 1e-5);
    float size = 0.06 + 0.03 * h;
    vec2 p = (q - pos) / size;
    if (dot(p, p) > 1.0) continue;
    p = vec2(dot(p, dir), dot(p, vec2(-dir.y, dir.x)));
    shade = max(shade, k_fill(crawlers_spider(p, tt), 0.04));
  }
  return col * (1.0 - 0.9 * shade);
}` },
  { id: 'shadow', name: 'Shadow walker', group: 'Halloween', about: 'A tall, thin shadow walks slowly across a firelit wall, from one surface to the next.', code: `
float shadow_every = 15.0; // param: Seconds between walkers, 8..60
vec3 shadow_light = vec3(0.9, 0.55, 0.25); // param: Light on the wall
vec3 fx_shadow(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  vec3 col = shadow_light * (0.28 + 0.12 * fbm(vec3(q * 2.0, t * 0.2))) * k_flicker(t * 0.5, 3.0);
  float n = floor(t / shadow_every), since = t - n * shadow_every;
  float walk = since / 12.0;
  if (walk > 1.0) return col;
  float dir = hash1(vec3(n, 1.0, 2.0)) < 0.5 ? 1.0 : -1.0;
  float x = mix(-0.3, aspect + 0.3, walk);
  if (dir < 0.0) x = aspect - x;
  vec2 p = (q - vec2(x, 0.0)) / 0.9;
  p.x *= dir;
  float ph = since * 2.6;
  // long and thin, as a shadow is: head, neck, body, swinging arms and striding legs
  float d = min(k_oval(p - vec2(0.0, 0.9), vec2(0.045, 0.06)), k_seg(p, vec2(0.0, 0.84), vec2(0.0, 0.78)) - 0.018);
  d = min(d, k_box(p - vec2(0.0, 0.62), vec2(0.045, 0.15)) - 0.025);
  for (int i = 0; i < 2; i++) {
    float side = float(i) * 2.0 - 1.0, sw = side * sin(ph);
    vec2 sh = vec2(0.0, 0.76), el = sh + 0.18 * vec2(sin(sw * 0.5), -cos(sw * 0.5));
    vec2 hd = el + 0.18 * vec2(sin(sw * 0.5 + 0.3), -cos(sw * 0.5 + 0.3));
    d = min(d, min(k_seg(p, sh, el), k_seg(p, el, hd)) - 0.014);
    d = min(d, k_seg(p, hd, hd + vec2(0.02, -0.06)) - 0.008);
    vec2 hp = vec2(0.0, 0.46), kn = hp + 0.22 * vec2(sin(-sw * 0.45), -cos(sw * 0.45));
    vec2 ft = kn + 0.24 * vec2(sin(-sw * 0.45 - 0.25 * max(-sw, 0.0)), -1.0);
    d = min(d, min(k_seg(p, hp, kn), k_seg(p, kn, ft)) - 0.02);
  }
  return col * (1.0 - 0.85 * k_fill(d, 0.012));
}` },
  { id: 'handprints', name: 'Bloody handprints', group: 'Halloween', about: 'Bloody handprints slap onto the glass one after another, smear and run, then slowly fade.', code: `
${hand('handprints')}
vec3 handprints_colour = vec3(0.6, 0.0, 0.02); // param: Colour
float handprints_every = 2.0; // param: Seconds between prints, 0.5..8
vec3 fx_handprints(Surf2 s, float t) {
  vec2 q = k_square(s);
  float w = s.size.x / max(s.size.y, 1.0);
  float last = floor(t / handprints_every);
  float ink = 0.0, flash = 0.0;
  for (int i = 0; i < 7; i++) {
    float k = last - float(i), age = t - k * handprints_every;
    float h = hash1(vec3(k, s.id, 1.0)), h2 = hash1(vec3(k, s.id, 2.0)), h3 = hash1(vec3(k, s.id, 3.0));
    vec2 p = (q - vec2(w * (0.15 + 0.7 * h), 0.25 + 0.55 * h2)) * k_rot((h3 - 0.5) * 0.8) / 0.75;
    p.x *= h3 < 0.5 ? 1.0 : -1.0;
    float d = handprints_hand(p);
    // drips run down from the palm
    for (int j = 0; j < 3; j++) {
      float x = -0.035 + 0.035 * float(j), len = min(age * 0.02, 0.1 + 0.08 * hash1(vec3(k, float(j), 5.0)));
      d = min(d, k_seg(p, vec2(x, -0.06), vec2(x, -0.06 - len)) - 0.008);
    }
    float fade = smoothstep(7.0 * handprints_every, 5.0 * handprints_every, age);
    float blot = 0.55 + 0.45 * noise(vec3(p * 70.0, k));
    ink = max(ink, k_fill(d, 0.006) * blot * fade);
    flash += exp(-age * 10.0) * step(0.0, age) * step(float(i), 0.5);
  }
  return handprints_colour * (ink + 0.25 * flash);
}` },
  { id: 'werewolf', name: 'Werewolf moon', group: 'Halloween', about: 'A wolf on a rocky hill throws back its head and howls at the full moon, as clouds drift past.', code: `
float werewolf_every = 9.0; // param: Seconds between howls, 4..30
float werewolf_shape(vec2 p, float lift) {
  // a wolf sitting, facing right, about 0.5 tall, its head raised by lift (0..1) to howl
  float d = min(k_circle(p - vec2(-0.06, 0.09), 0.1), k_oval((p - vec2(0.02, 0.18)) * k_rot(-0.35), vec2(0.07, 0.16)));
  d = min(d, k_seg(p, vec2(0.07, 0.0), vec2(0.06, 0.16)) - 0.025);
  d = min(d, k_seg(p, vec2(-0.12, 0.02), vec2(-0.27, 0.05)) - 0.025 + 0.01 * (p.x + 0.12) * 4.0 * step(p.x, -0.12));
  vec2 hp = vec2(0.06, 0.33);
  float a = 0.25 + 0.85 * lift;
  vec2 dir = vec2(cos(a), sin(a));
  d = k_smin(d, k_circle(p - hp, 0.06), 0.03);
  d = min(d, k_seg(p, hp, hp + dir * 0.11) - 0.028 + 0.012 * clamp(dot(p - hp, dir) / 0.11, 0.0, 1.0));
  vec2 ear = hp + vec2(-dir.y, dir.x) * 0.05 - dir * 0.02;
  d = min(d, k_tri(p, ear - dir * 0.03, ear + dir * 0.02, ear + vec2(-dir.y, dir.x) * 0.06));
  return d;
}
vec3 fx_werewolf(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  vec3 col = mix(vec3(0.05, 0.07, 0.18), vec3(0.01, 0.01, 0.05), q.y);
  vec2 mc = vec2(aspect * 0.6, 0.58);
  float dm = length(q - mc);
  col += vec3(0.2, 0.22, 0.3) * exp(-max(dm - 0.24, 0.0) * 4.0);
  col = mix(col, vec3(0.95, 0.93, 0.85) * (1.0 - 0.18 * smoothstep(0.45, 0.65, fbm(vec3((q - mc) * 6.0, 9.0)))), k_fill(dm - 0.24, 0.003));
  // clouds drifting across, lit at their edges
  float n = fbm(vec3(q * vec2(2.0, 5.0) - vec2(t * 0.03, 0.0), 2.0));
  float cl = smoothstep(0.55, 0.75, n) * smoothstep(0.3, 0.6, q.y);
  col = mix(col, vec3(0.08, 0.09, 0.15) + vec3(0.3) * exp(-dm * 3.0) * (0.75 - n), cl);
  // the hill and the rock it sits on, and the wolf
  float hill = q.y - (0.16 + 0.1 * smoothstep(aspect * 0.2, aspect * 0.6, q.x) + 0.02 * sin(q.x * 9.0));
  float rock = k_tri(q, vec2(mc.x - 0.2, 0.2), vec2(mc.x + 0.12, 0.2), vec2(mc.x - 0.08, 0.31)) - 0.01;
  vec2 e = k_now_and_then(t, werewolf_every, 0.9, 2.0);
  float lift = e.x < 0.0 ? 0.0 : smoothstep(0.0, 0.6, e.x) * smoothstep(3.5, 2.5, e.x);
  float wolf = werewolf_shape((q - vec2(mc.x - 0.09, 0.3)) / 0.75, lift) * 0.75;
  return col * (1.0 - k_fill(min(min(hill, rock), wolf), 0.002));
}` },
  { id: 'portrait', name: 'Haunted portrait', group: 'Halloween', about: 'A dark old portrait in a gold frame. Its eyes follow you, and now and then the face turns to a skull.', code: `
${skull('portrait')}
float portrait_every = 12.0; // param: Seconds between changes, 4..40
vec3 fx_portrait(Surf2 s, float t) {
  vec2 p = k_centred(s);
  // the gold frame along the outline, carved into ridges
  float fr = smoothstep(26.0, 22.0, s.edge);
  vec3 gold = vec3(0.8, 0.6, 0.25) * (0.45 + 0.55 * abs(sin(s.edge * 0.35))) * (0.8 + 0.2 * noise(vec3(s.px * 0.2, 1.0)));
  // the painting: dark brown, cracked varnish, a sitter with dark hair and shoulders
  vec3 col = vec3(0.09, 0.06, 0.035) * (0.7 + 0.3 * fbm(vec3(p * 4.0, 1.0)));
  float crack = smoothstep(0.03, 0.0, abs(noise(vec3(p * 25.0, 3.0)) - 0.5));
  col *= 1.0 - 0.3 * crack;
  float body = k_oval(p - vec2(0.0, -0.45), vec2(0.34, 0.25));
  col = mix(col, vec3(0.05, 0.04, 0.06), k_fill(body, 0.01));
  float hair = k_oval(p - vec2(0.0, 0.12), vec2(0.16, 0.21));
  col = mix(col, vec3(0.04, 0.025, 0.02), k_fill(hair, 0.01));
  float face = k_oval(p - vec2(0.0, 0.07), vec2(0.12, 0.16));
  vec3 skin = vec3(0.55, 0.42, 0.3) * (0.5 + 0.5 * smoothstep(0.1, -0.1, p.x));
  // eyes that follow: the pupils slide to wherever "you" are
  vec2 look = vec2(0.012 * sin(t * 0.5), 0.004 * sin(t * 0.31));
  vec2 ep = vec2(abs(p.x) - 0.048, p.y - 0.1);
  skin = mix(skin, vec3(0.75, 0.72, 0.65), k_fill(k_oval(ep, vec2(0.024, 0.011)), 0.003));
  skin = mix(skin, vec3(0.05), k_fill(length(vec2(p.x - sign(p.x) * 0.048, p.y - 0.1) - look) - 0.008, 0.002));
  skin = mix(skin, vec3(0.4, 0.15, 0.12), k_fill(k_oval(p - vec2(0.0, -0.03), vec2(0.035, 0.008)), 0.003));
  // now and then the face becomes a skull, eyes glowing red
  vec2 e = k_now_and_then(t, portrait_every, 0.8, s.id);
  float morph = e.x < 0.0 ? 0.0 : smoothstep(0.0, 0.4, e.x) * smoothstep(2.0, 1.4, e.x);
  vec3 sk = portrait_skull((p - vec2(0.0, 0.05)) / 0.34);
  vec3 skullc = vec3(0.75, 0.7, 0.6) * k_fill(sk.x, 0.01) * (1.0 - k_fill(sk.y, 0.02)) + vec3(1.0, 0.05, 0.0) * k_fill(sk.z + 0.03, 0.02);
  col = mix(col, mix(skin, skullc, morph), k_fill(face, 0.008) * (1.0 - morph) + k_fill(sk.x * 0.34, 0.004) * morph);
  return mix(col, gold, fr);
}` },
  { id: 'blackcat', name: 'Black cat', group: 'Halloween', about: 'A black cat sits on the sill against a warm-lit window, tail swishing, eyes glowing and blinking.', code: `
vec3 blackcat_light = vec3(1.0, 0.6, 0.22); // param: Window light
vec3 blackcat_eyes = vec3(0.7, 1.0, 0.2); // param: Eyes
vec3 fx_blackcat(Surf2 s, float t) {
  vec2 q = k_square(s);
  float w = s.size.x / max(s.size.y, 1.0);
  vec3 col = blackcat_light * (0.45 + 0.35 * smoothstep(1.0, 0.0, q.y)) * (0.92 + 0.08 * k_flicker(t * 0.3, 1.0));
  // the window bars
  col *= 1.0 - 0.85 * max(step(abs(q.x - w * 0.5), 0.012), step(abs(q.y - 0.62), 0.012));
  vec2 p = (q - vec2(w * 0.5 + 0.18, 0.02)) / 0.55;
  float d = min(k_oval(p - vec2(0.0, 0.22), vec2(0.16, 0.24)), k_circle(p - vec2(0.06, 0.12), 0.15));
  d = min(d, k_circle(p - vec2(0.0, 0.55), 0.12));
  vec2 m = vec2(abs(p.x), p.y);
  d = min(d, k_tri(m, vec2(0.04, 0.6), vec2(0.12, 0.58), vec2(0.11, 0.75)));
  // the tail: a chain of short pieces, each bent a little further as it swishes
  vec2 a = vec2(0.14, 0.04);
  float ang = 0.0;
  for (int k = 0; k < 6; k++) {
    float fk = float(k);
    ang += 0.35 + 0.25 * sin(t * 1.6 - fk * 0.6);
    vec2 b = a + 0.07 * vec2(cos(ang), sin(ang));
    d = min(d, k_seg(p, a, b) - (0.03 - 0.003 * fk));
    a = b;
  }
  col *= 1.0 - k_fill(d, 0.004);
  vec2 bl = k_now_and_then(t, 4.0, 0.7, s.id);
  float open = bl.x >= 0.0 && bl.x < 0.2 ? 0.1 : 1.0;
  float eye = k_oval(m - vec2(0.05, 0.56), vec2(0.03, 0.02 * open));
  col += blackcat_eyes * (k_fill(eye, 0.004) + 0.3 * exp(-max(eye, 0.0) / 0.01));
  col = mix(col, vec3(0.02), k_fill(k_oval(vec2(abs(p.x) - 0.05, p.y - 0.56), vec2(0.006, 0.018 * open)), 0.002));
  return col;
}` },
  { id: 'crows', name: 'Crows', group: 'Halloween', about: 'A flock of crows flaps across a grey dusk sky, from one surface to the next.', code: `
float crows_count = 8.0; // param: How many, 1..12, whole
float crows_shape(vec2 p, float flap) {
  // a crow flying right, about 1 across: body, head, beak, a fanned tail, and wings that beat
  float d = min(k_oval(p, vec2(0.22, 0.07)), k_circle(p - vec2(0.24, 0.03), 0.065));
  d = min(d, k_tri(p, vec2(0.28, 0.06), vec2(0.28, 0.0), vec2(0.4, 0.02)));
  d = min(d, k_tri(p, vec2(-0.15, 0.0), vec2(-0.38, 0.08), vec2(-0.38, -0.07)));
  d = min(d, k_seg(p, vec2(0.02, 0.02), vec2(-0.1, 0.48 * flap)) - 0.09 + 0.07 * clamp(length(p - vec2(0.02, 0.02)) / 0.5, 0.0, 1.0));
  return d;
}
vec3 fx_crows(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  vec3 col = mix(vec3(0.55, 0.45, 0.5), vec3(0.18, 0.18, 0.28), q.y) * (0.85 + 0.15 * fbm(vec3(q * 2.0, t * 0.05)));
  float shade = 0.0;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    if (fi >= crows_count) break;
    float h = hash1(vec3(fi, 2.0, 9.0)), size = 0.09 + 0.05 * hash1(vec3(fi, 4.0, 1.0));
    float x = fract(h * 5.0 + t * (0.05 + 0.04 * h)) * (aspect + 0.6) - 0.3;
    float y = 0.35 + 0.5 * hash1(vec3(fi, 7.0, 3.0)) + 0.03 * sin(t * 0.8 + fi);
    vec2 p = (q - vec2(x, y)) / size;
    if (dot(p, p) > 0.5) continue;
    shade = max(shade, k_fill(crows_shape(p, sin(t * 7.0 + fi * 1.9)), 0.03));
  }
  return col * (1.0 - 0.95 * shade);
}` },
  { id: 'mummy', name: 'Mummy door', group: 'Halloween', about: 'Wraps a door in old bandages, and through a gap two eyes peer out, looking about and blinking.', code: `
vec3 mummy_wrap = vec3(0.85, 0.8, 0.65); // param: Bandages
vec3 mummy_eyes = vec3(1.0, 0.85, 0.2); // param: Eyes
vec3 fx_mummy(Surf2 s, float t) {
  vec2 q = k_square(s);
  float w = s.size.x / max(s.size.y, 1.0);
  // two layers of strips at different slants; each strip is shaded at its edges and stained
  vec3 col = vec3(0.0);
  float covered = 0.0;
  for (int l = 0; l < 2; l++) {
    float fl = float(l), slant = fl < 0.5 ? 0.18 : -0.25, bw = 0.075 + 0.02 * fl;
    float v = (q.y + slant * q.x) / bw + fl * 0.37;
    float k = floor(v), f = fract(v);
    float h = hash1(vec3(k, fl, s.id));
    float on = step(0.12 + 0.2 * fl, h) * step(0.06, f) * step(f, 0.96);
    float edge = smoothstep(0.06, 0.25, f) * smoothstep(0.96, 0.75, f);
    float weave = 0.85 + 0.15 * sin(s.px.x * 1.3 + k) * sin(s.px.y * 1.1);
    vec3 c = mummy_wrap * (0.45 + 0.55 * edge) * weave * (1.0 - 0.35 * smoothstep(0.55, 0.75, fbm(vec3(q * 6.0, k))));
    col = mix(col, c, on * (fl > 0.5 ? step(0.5, hash1(vec3(k, 3.0, s.id))) : 1.0));
    covered = max(covered, on);
  }
  // a dark gap with eyes in it
  vec2 g = q - vec2(w * 0.5, 0.66);
  float slit = k_box(g, vec2(0.22, 0.04)) - 0.01;
  col = mix(col, vec3(0.0), k_fill(slit, 0.006));
  vec2 look = vec2(0.03 * sin(t * 0.7) + 0.02 * sin(t * 1.9), 0.0);
  vec2 bl = k_now_and_then(t, 3.5, 0.7, s.id);
  float open = bl.x >= 0.0 && bl.x < 0.18 ? 0.1 : 1.0;
  float eye = k_oval(vec2(abs(g.x - look.x) - 0.07, g.y), vec2(0.035, 0.022 * open));
  col += mummy_eyes * (k_fill(eye, 0.004) + 0.35 * exp(-max(eye, 0.0) / 0.012)) * step(slit, 0.02);
  col = mix(col, vec3(0.05, 0.0, 0.0), k_fill(length(vec2(abs(g.x - look.x) - 0.07, g.y)) - 0.009 * open, 0.002));
  return col;
}` },
  { id: 'wisps', name: "Will-o'-the-wisps", group: 'Halloween', about: 'Little blue flames float and bob through the dark, low over the ground, fading in and out.', code: `
float wisps_count = 5.0; // param: How many, 1..8, whole
vec3 wisps_colour = vec3(0.3, 0.7, 1.0); // param: Colour
vec3 fx_wisps(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  vec3 col = wisps_colour * 0.06 * fbm(vec3(q * vec2(3.0, 8.0) - vec2(t * 0.03, 0.0), 1.0)) * smoothstep(0.35, 0.0, q.y);
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    if (fi >= wisps_count) break;
    float h = hash1(vec3(fi, 1.0, 4.0)), h2 = hash1(vec3(fi, 3.0, 8.0));
    vec2 pos = vec2(aspect * (0.5 + 0.45 * sin(t * 0.07 * (1.0 + h) + h * 9.0)), 0.18 + 0.15 * sin(t * 0.13 * (1.0 + h2) + h * 4.0) + 0.02 * sin(t * 2.0 + fi));
    float life = smoothstep(0.0, 0.5, sin(t * (0.15 + 0.1 * h) + h * 20.0));
    vec2 d = q - pos;
    float fl = k_flicker(t, fi);
    float flame = k_oval(d - vec2(0.0, 0.025), vec2(0.025, 0.06 * fl));
    col += (mix(wisps_colour, vec3(1.0), k_fill(flame + 0.012, 0.008)) * k_fill(flame, 0.006) + wisps_colour * 0.4 * exp(-length(d) * 9.0)) * life * fl;
  }
  return col;
}` },
  { id: 'reaper', name: 'The Reaper', group: 'Halloween', about: 'A hooded figure with a scythe glides through green-lit fog across the frame, red eyes glinting under the hood.', code: `
float reaper_every = 16.0; // param: Seconds between passes, 8..60
vec3 reaper_fog = vec3(0.15, 0.4, 0.22); // param: Fog colour
float reaper_shape(vec2 p, float t) {
  // the Reaper facing right, about 1 tall: hood, robe with a ragged hem, an arm, and the scythe
  float robe = k_tri(p, vec2(-0.2, 0.0), vec2(0.22, 0.0), vec2(0.0, 0.78));
  robe = max(robe, -(p.y - 0.03 * (1.0 + sin(p.x * 60.0 + t * 3.0)) - 0.0));
  float d = min(robe, k_circle(p - vec2(0.02, 0.74), 0.085));
  d = min(d, k_tri(p, vec2(-0.06, 0.78), vec2(0.07, 0.8), vec2(-0.1, 0.93)));
  d = min(d, k_seg(p, vec2(0.04, 0.58), vec2(0.17, 0.48)) - 0.035);
  d = min(d, k_seg(p, vec2(0.2, 0.0), vec2(0.17, 0.9)) - 0.009);
  float blade = max(k_circle(p - vec2(0.02, 0.84), 0.17), -k_circle(p - vec2(-0.01, 0.78), 0.165));
  d = min(d, max(blade, max(p.x - 0.18, 0.72 - p.y)));
  return d;
}
vec3 fx_reaper(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  vec3 col = reaper_fog * (0.35 + 0.65 * fbm(vec3(q * 3.0 - vec2(t * 0.05, 0.0), t * 0.04))) * (0.5 + 0.5 * smoothstep(0.9, 0.0, q.y));
  float n = floor(t / reaper_every), since = t - n * reaper_every, ph = since / 12.0;
  if (ph < 1.0) {
    float dir = hash1(vec3(n, 3.0, 2.0)) < 0.5 ? 1.0 : -1.0;
    float x = mix(-0.4, aspect + 0.4, ph);
    if (dir < 0.0) x = aspect - x;
    vec2 p = (q - vec2(x, 0.05 + 0.02 * sin(t * 1.5))) / 0.75;
    p.x *= dir;
    float d = reaper_shape(p, t);
    col *= 1.0 - 0.95 * k_fill(d, 0.006);
    vec2 e = vec2(abs(p.x - 0.045) - 0.02, p.y - 0.735);
    col += vec3(1.0, 0.1, 0.0) * (k_fill(length(e) - 0.007, 0.003) + 0.3 * exp(-length(e) * 80.0)) * step(0.0, 0.1 - abs(p.x));
  }
  // fog in front, round its hem
  return col + reaper_fog * 0.6 * fbm(vec3(q * vec2(3.0, 9.0) + vec2(t * 0.06, 0.0), 5.0)) * smoothstep(0.25, 0.0, q.y);
}` },
  { id: 'pumpkins', name: 'Pumpkin patch', group: 'Halloween', about: "A row of jack-o'-lanterns along the bottom of the frame, big and small, each with its own face and flicker.", code: `
float pumpkins_size = 1.0; // param: Size, 0.5..2
float pumpkins_face(vec2 p, float h) {
  // carved holes in a pumpkin about 1 across: two eyes and a grin, different for each h
  vec2 e = vec2(abs(p.x), p.y);
  float eyes = h < 0.5 ? k_tri(e, vec2(0.06, 0.04), vec2(0.24, 0.04), vec2(0.15, 0.2)) : k_oval(e - vec2(0.15, 0.1), vec2(0.07, 0.08));
  float nose = k_tri(p, vec2(-0.04, -0.04), vec2(0.04, -0.04), vec2(0.0, 0.03));
  float mouth = max(k_oval(p + vec2(0.0, 0.16), vec2(0.28, 0.1)), -k_oval(p + vec2(0.0, 0.1), vec2(0.3, 0.08)));
  mouth = max(mouth, -k_box(vec2(abs(p.x) - 0.09, p.y + 0.12), vec2(0.025, 0.03)) * step(0.3, fract(h * 7.0)));
  return min(min(eyes, nose), mouth);
}
vec3 fx_pumpkins(Surf2 s, float t) {
  vec2 q = k_frame(s);
  vec3 col = mix(vec3(0.08, 0.03, 0.12), vec3(0.01, 0.01, 0.04), q.y);
  float cell = 0.26 * pumpkins_size, c = floor(q.x / cell), h = hash1(vec3(c, 5.0, 1.0));
  float r = cell * (0.25 + 0.15 * h);
  vec2 ctr = vec2((c + 0.5) * cell + (fract(h * 9.0) - 0.5) * cell * 0.2, 0.03 + r * 0.85);
  vec2 p = (q - ctr) / (2.0 * r);
  float body = k_oval(p, vec2(0.55, 0.45));
  float fl = k_flicker(t, c);
  float holes = pumpkins_face(p, fract(h * 3.3));
  float rib = 0.6 + 0.4 * cos(p.x / sqrt(max(0.3 - p.y * p.y, 0.03)) * 7.0);
  vec3 skin = vec3(1.0, 0.42, 0.05) * (0.12 * rib + 0.35 * k_glow(holes, 0.05)) * fl;
  vec3 lit = mix(vec3(1.0, 0.55, 0.1), vec3(1.0, 0.9, 0.5), k_fill(holes + 0.03, 0.03)) * fl;
  col = mix(col, mix(skin, lit, k_fill(holes, 0.008)), k_fill(body, 0.01));
  col = mix(col, vec3(0.15, 0.25, 0.05), k_fill(k_box(p - vec2(0.02, 0.48), vec2(0.04, 0.06)), 0.01));
  col += vec3(1.0, 0.45, 0.08) * 0.12 * exp(-max(body, 0.0) * 6.0) * fl * step(0.0, body);
  // vines along the ground
  col = mix(col, vec3(0.05, 0.2, 0.05), k_fill(abs(q.y - 0.02 - 0.008 * sin(q.x * 40.0)) - 0.003, 0.002));
  return col;
}` },
  { id: 'knock', name: 'Something wants out', group: 'Halloween', about: 'Something pounds on the other side of a door: with each blow, red light flares out round its edges. On the beat with music.', code: `
vec3 knock_colour = vec3(1.0, 0.15, 0.05); // param: Light behind
float knock_every = 6.0; // param: Seconds between knocks, 2..20
vec3 fx_knock(Surf2 s, float t) {
  float hit = 0.0;
  if (uHasAudio > 0.5) hit = uBeat;
  else {
    // three heavy blows, then quiet
    vec2 e = k_now_and_then(t, knock_every, 0.9, s.id);
    for (int j = 0; j < 3; j++) {
      float dt = e.x - float(j) * 0.45;
      if (e.x >= 0.0 && dt >= 0.0) hit = max(hit, exp(-dt * 7.0));
    }
  }
  // light leaks round the edges, most of all under the bottom, through uneven gaps
  float a = atan(s.uv.y - 0.5, s.uv.x - 0.5);
  float gaps = 0.4 + 0.6 * noise(vec3(a * 12.0, 1.0, s.id));
  float under = exp(-s.uv.y * s.size.y / (6.0 + 30.0 * hit));
  float rim = k_rim(s, 3.0 + 18.0 * hit) * gaps;
  float glow = (0.12 + 1.2 * hit) * (rim + under) + 0.06 * hit;
  return knock_colour * glow * (0.9 + 0.1 * noise(vec3(s.px * 0.1, t * 10.0)));
}` },
  { id: 'eyeball', name: 'Giant eyeball', group: 'Halloween', about: 'A bloodshot eyeball for something round: it looks about, its pupil widening and narrowing, and blinks.', code: `
vec3 eyeball_iris = vec3(0.2, 0.55, 0.9); // param: Iris colour
float eyeball_veins = 0.6; // param: Bloodshot, 0..1
vec3 fx_eyeball(Surf2 s, float t) {
  vec2 p = k_centred(s) * 1.05;
  float r = length(p), a = atan(p.y, p.x);
  // the white: a lit ball with red veins creeping in from its edge
  vec2 b = p * 2.0;
  float z = sqrt(max(1.0 - dot(b, b), 0.0));
  vec3 col = vec3(0.92, 0.88, 0.82) * (0.45 + 0.55 * max(dot(vec3(b, z), normalize(vec3(-0.3, 0.4, 0.85))), 0.0));
  float v = 1.0 - abs(2.0 * noise(vec3(a * 7.0, r * 10.0, s.id)) - 1.0);
  float v2 = 1.0 - abs(2.0 * noise(vec3(a * 15.0, r * 25.0, s.id + 4.0)) - 1.0);
  col = mix(col, vec3(0.7, 0.03, 0.03), (pow(v, 14.0) + 0.6 * pow(v2, 18.0)) * smoothstep(0.18, 0.47, r) * eyeball_veins);
  // the iris darts to a new spot now and then
  float k = floor(t / 2.3), f = smoothstep(0.0, 0.12, fract(t / 2.3));
  vec2 from = 0.13 * (vec2(hash1(vec3(k - 1.0, 1.0, s.id)), hash1(vec3(k - 1.0, 2.0, s.id))) - 0.5) * 2.0;
  vec2 to = 0.13 * (vec2(hash1(vec3(k, 1.0, s.id)), hash1(vec3(k, 2.0, s.id))) - 0.5) * 2.0;
  vec2 ip = p - mix(from, to, f);
  float ir = length(ip), ia = atan(ip.y, ip.x);
  vec3 iris = eyeball_iris * (0.5 + 0.5 * noise(vec3(ia * 12.0, ir * 40.0, 1.0))) * (0.6 + 0.4 * smoothstep(0.17, 0.08, ir));
  col = mix(col, iris, k_fill(ir - 0.17, 0.004));
  col = mix(col, vec3(0.0), k_fill(ir - 0.06 - 0.025 * sin(t * 0.6), 0.003));
  col += vec3(1.0) * 0.8 * k_fill(length(p - vec2(-0.07, 0.08)) - 0.025, 0.006);
  // eyelids close from top and bottom for a blink
  vec2 e = k_now_and_then(t, 5.0, 0.8, s.id + 1.0);
  float shut = e.x >= 0.0 && e.x < 0.3 ? sin(e.x / 0.3 * 3.1416) : 0.0;
  float lid = abs(p.y) - (0.5 - 0.5 * shut) * sqrt(max(1.0 - pow(p.x / 0.5, 2.0), 0.0));
  col = mix(col, vec3(0.45, 0.2, 0.15) * (0.5 + 0.5 * smoothstep(0.1, 0.0, abs(lid))), k_fill(-lid, 0.004) * step(0.01, shut));
  return col * k_fill(r - 0.49, 0.004);
}` },
];
