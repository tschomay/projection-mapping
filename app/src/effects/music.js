// Music and VJ looks: tunnels, mirrors, lasers, grids and patterns that move to the beat. See docs/looks.md.

export const MUSIC = [
  { id: 'tunnel', name: 'Tunnel', group: 'Music', about: 'Rings rush towards you down an endless tunnel, flashing on the beat.', code: `
float tunnel_speed = 1.0; // param: Speed, 0.2..3
int tunnel_shape = 0; // param: Shape, choice: Round=0|Square=1|Hexagon=2
vec3 fx_tunnel(Surf2 s, float t) {
  vec2 p = k_centred(s);
  vec2 ap = abs(p);
  float r = tunnel_shape == 1 ? max(ap.x, ap.y) : tunnel_shape == 2 ? max(ap.x * 0.866 + ap.y * 0.5, ap.y) : length(p);
  float a = atan(p.y, p.x) / 6.2832;
  // depth along the tunnel: rings far away crowd towards the middle
  float z = 0.25 / max(r, 0.01) + t * tunnel_speed * 1.5;
  float kick = k_pulse(t, 120.0);
  float ring = smoothstep(0.38, 0.48, abs(fract(z) - 0.5));
  float seg = smoothstep(0.42, 0.48, abs(fract(a * 16.0) - 0.5));
  vec3 c = hsv(fract(floor(z) * 0.07 + t * 0.02), 0.8, 1.0);
  return c * (ring * (0.6 + 0.9 * kick) + seg * 0.25 + 0.04) * smoothstep(0.02, 0.3, r);
}` },
  { id: 'kaleido', name: 'Kaleidoscope', group: 'Music', about: 'Flowing colours folded through mirrors into a turning kaleidoscope, brighter on the beat.', code: `
float kaleido_mirrors = 6.0; // param: Mirrors, 3..12, whole
float kaleido_speed = 1.0; // param: Speed, 0.1..3
vec3 fx_kaleido(Surf2 s, float t) {
  float tt = t * kaleido_speed;
  vec2 p = k_centred(s);
  float r = length(p), a = atan(p.y, p.x);
  float seg = 6.2832 / kaleido_mirrors;
  a = abs(mod(a + tt * 0.1, seg) - seg * 0.5);
  vec2 q = r * vec2(cos(a), sin(a)) * 3.0 + vec2(tt * 0.2, 0.0);
  // crossing waves and rings, reflected
  float v = sin(q.x * 3.0 + tt) * sin(q.y * 4.0 - tt * 0.7) + 0.5 * sin(length(q - vec2(1.0, 0.5)) * 6.0 - tt * 1.3);
  float lines = smoothstep(0.12, 0.0, abs(v));
  vec3 c = pal(v * 0.3 + r * 0.6 - tt * 0.05, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  return c * (0.3 + 0.7 * lines * (0.7 + 0.6 * k_pulse(t, 120.0)));
}` },
  { id: 'neon', name: 'Neon', group: 'Music', about: 'Two neon tubes follow the outline, humming, flickering now and then, glowing brighter on the beat.', code: `
vec3 neon_colour = vec3(1.0, 0.1, 0.6); // param: Colour
vec3 neon_inner = vec3(0.1, 0.8, 1.0); // param: Inner colour
bool neon_flicker = true; // param: Flicker, toggle
float neon_tube(float d, float on) {
  // a tube's light at distance d pixels: a white-hot core, the coloured glass and the glow round it
  return on * (exp(-d / 4.0) + 0.3 * exp(-d / 18.0));
}
vec3 fx_neon(Surf2 s, float t) {
  float d1 = abs(s.edge - 10.0), d2 = abs(s.edge - 30.0);
  float on1 = 1.0, on2 = 1.0;
  if (neon_flicker) {
    vec2 e = k_now_and_then(t, 7.0, 0.5, s.id);
    if (e.x >= 0.0 && e.x < 0.7) on1 = 0.15 + 0.85 * step(0.45, hash1(vec3(floor(e.x * 24.0), s.id, 1.0)));
    e = k_now_and_then(t, 9.0, 0.4, s.id + 5.0);
    if (e.x >= 0.0 && e.x < 0.5) on2 = 0.15 + 0.85 * step(0.45, hash1(vec3(floor(e.x * 24.0), s.id, 2.0)));
  }
  float buzz = 0.93 + 0.07 * sin(t * 120.0);
  float kick = 0.75 + 0.5 * k_pulse(t, 120.0);
  vec3 c = neon_colour * neon_tube(d1, on1) + neon_inner * neon_tube(d2, on2) * kick;
  c += vec3(1.0) * 0.7 * (exp(-d1 / 1.2) * on1 + exp(-d2 / 1.2) * on2);
  return c * buzz;
}` },
  { id: 'gradient', name: 'Colour wash', group: 'Music', about: 'Slow, smooth bands of colour drift across the whole frame, from one surface to the next.', code: `
int gradient_colours = 0; // param: Colours, choice: Sunset=0|Ocean=1|Neon=2|Rainbow=3
float gradient_speed = 1.0; // param: Speed, 0.1..3
vec3 fx_gradient(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float x = q.x * 0.4 + q.y * 0.3 + 0.15 * sin(q.y * 2.0 + t * 0.3 * gradient_speed) - t * 0.03 * gradient_speed;
  vec3 c = hsv(fract(x), 0.85, 1.0);
  if (gradient_colours == 0) c = pal(x, vec3(0.6, 0.3, 0.4), vec3(0.4, 0.3, 0.3), vec3(1.0), vec3(0.0, 0.15, 0.3));
  if (gradient_colours == 1) c = pal(x, vec3(0.1, 0.4, 0.6), vec3(0.1, 0.3, 0.35), vec3(1.0), vec3(0.3, 0.2, 0.1));
  if (gradient_colours == 2) c = pal(x, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.8, 0.9, 0.3));
  return c * (0.85 + 0.35 * uAudio.w * uHasAudio);
}` },
  { id: 'strobe', name: 'Strobe', group: 'Music', about: 'A short flash on every beat, or a few times a second without music. Kept to three flashes a second or fewer.', code: `
vec3 strobe_colour = vec3(1.0); // param: Colour
float strobe_rate = 2.0; // param: Flashes a second without music, 0.5..3
bool strobe_turns = false; // param: Surfaces take turns, toggle
vec3 fx_strobe(Surf2 s, float t) {
  float n = uHasAudio > 0.5 ? uBeats : floor(t * strobe_rate);
  float flash = uHasAudio > 0.5 ? step(0.75, uBeat) : step(fract(t * strobe_rate), 0.12);
  if (strobe_turns) flash *= step(abs(mod(n, max(s.count, 1.0)) - s.id), 0.5);
  return strobe_colour * flash;
}` },
  { id: 'bars', name: 'Equaliser', group: 'Music', about: 'LED bars jump with the music: bass on the left, treble on the right.', code: `
float bars_count = 16.0; // param: Bars, 4..32, whole
int bars_colours = 0; // param: Colours, choice: Green to red=0|Rainbow=1|One colour=2
vec3 bars_colour = vec3(0.2, 0.7, 1.0); // param: Colour for one colour
vec3 fx_bars(Surf2 s, float t) {
  vec2 q = s.uv;
  float i = floor(q.x * bars_count), f = fract(q.x * bars_count), x = (i + 0.5) / bars_count;
  // each bar follows its part of the sound, bass to treble, jittered so neighbours differ; made up when silent
  vec3 a = uHasAudio > 0.5 ? uAudio.xyz : vec3(0.55 + 0.35 * sin(t * 3.1), 0.45 + 0.3 * sin(t * 4.3 + 1.0), 0.35 + 0.3 * sin(t * 6.7 + 2.0)) * (0.6 + 0.4 * k_pulse(t, 120.0));
  float band = x < 0.5 ? mix(a.x, a.y, x * 2.0) : mix(a.y, a.z, x * 2.0 - 1.0);
  float h = clamp(band * (0.55 + 0.7 * noise(vec3(i * 1.7, t * 4.0, s.id))), 0.03, 1.0);
  float block = step(0.25, fract(q.y * 20.0)) * step(0.12, f) * step(f, 0.88);
  vec3 c = q.y < 0.6 ? vec3(0.1, 1.0, 0.2) : q.y < 0.85 ? vec3(1.0, 0.8, 0.05) : vec3(1.0, 0.1, 0.05);
  if (bars_colours == 1) c = hsv(x * 0.8, 0.85, 1.0);
  if (bars_colours == 2) c = bars_colour;
  return c * block * mix(0.06, 1.0, step(q.y, h));
}` },
  { id: 'rings', name: 'Ripples', group: 'Music', about: 'A ring of light leaves the middle on every beat and spreads out, fading.', code: `
vec3 rings_colour = vec3(0.3, 0.6, 1.0); // param: Colour
bool rings_rainbow = true; // param: A new colour each ring, toggle
vec3 fx_rings(Surf2 s, float t) {
  vec2 p = k_centred(s);
  float r = length(p);
  float n = uHasAudio > 0.5 ? uBeats : floor(t * 2.0);
  float ph = uHasAudio > 0.5 ? 1.0 - uBeat : fract(t * 2.0);
  vec3 col = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    float age = ph + float(i);
    float d = abs(r - age * 0.11) - 0.004 - 0.004 * age;
    vec3 c = rings_rainbow ? hsv(fract((n - float(i)) * 0.13), 0.75, 1.0) : rings_colour;
    col += c * k_glow(d, 0.006) * exp(-age * 0.45);
  }
  return col;
}` },
  { id: 'lasers', name: 'Lasers', group: 'Music', about: 'Laser beams fan out from the bottom corners and sweep across the frame through a haze.', code: `
vec3 lasers_colour = vec3(0.1, 1.0, 0.3); // param: Colour
bool lasers_rainbow = false; // param: Many colours, toggle
float lasers_count = 6.0; // param: Beams, 2..12, whole
float lasers_speed = 1.0; // param: Speed, 0.2..3
vec3 fx_lasers(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  float haze = 0.5 + 0.5 * fbm(vec3(q * 3.0, t * 0.2));
  float kick = k_pulse(t, 128.0);
  vec3 col = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    if (fi >= lasers_count) break;
    float side = mod(fi, 2.0), h = hash1(vec3(fi, 3.0, 9.0));
    vec2 o = vec2(side * aspect, 0.0);
    float a = (side < 0.5 ? 0.9 : 2.24) + 0.55 * sin(t * lasers_speed * (0.4 + 0.4 * h) + fi * 1.7);
    vec2 dir = vec2(cos(a), sin(a)), d = q - o;
    float across = abs(d.x * dir.y - d.y * dir.x);
    float beam = step(0.0, dot(d, dir)) * (exp(-across * 500.0) + 0.25 * haze * exp(-across * 50.0));
    vec3 c = lasers_rainbow ? hsv(fract(h + t * 0.05), 0.9, 1.0) : lasers_colour;
    col += c * beam * (0.6 + 0.6 * kick);
  }
  return col;
}` },
  { id: 'glitch', name: 'Glitch', group: 'Music', about: 'A test card breaks up: slices slide, the colours split apart and blocks flash, more on the beat.', code: `
float glitch_amount = 0.5; // param: How glitchy, 0..1
vec3 glitch_card(vec2 u) {
  // colour bars over a sliding gradient, like an old test card
  float i = floor(fract(u.x) * 7.0);
  vec3 bars = vec3(step(mod(i, 4.0), 1.5), step(i, 3.5), step(mod(i, 2.0), 0.5)) * 0.8;
  vec3 low = vec3(fract(u.x * 2.0)) * 0.6;
  return u.y > 0.3 ? bars : low;
}
vec3 fx_glitch(Surf2 s, float t) {
  vec2 uv = s.uv;
  float kick = k_pulse(t, 120.0);
  float slot = floor(t * 8.0), band = floor(uv.y * 24.0);
  float h = hash1(vec3(band, slot, s.id));
  float shift = step(1.0 - glitch_amount * (0.3 + 0.7 * kick), h) * (hash1(vec3(band, slot, 3.0)) - 0.5) * 0.3;
  vec2 u = vec2(uv.x + shift, uv.y);
  float sep = 0.005 + 0.03 * glitch_amount * kick;
  vec3 c = vec3(glitch_card(u + vec2(sep, 0.0)).r, glitch_card(u).g, glitch_card(u - vec2(sep, 0.0)).b);
  float blk = hash1(vec3(floor(uv * vec2(8.0, 12.0)), slot + 0.5));
  c = mix(c, hsv(fract(blk * 7.0), 0.8, 1.0), step(1.0 - glitch_amount * 0.08 * (1.0 + kick), blk));
  return c * (0.8 + 0.2 * step(0.5, fract(s.px.y / 3.0)));
}` },
  { id: 'hyperspace', name: 'Hyperspace', group: 'Music', about: 'Stars stream out from the middle as streaks, as if jumping to light speed. Brighter on the beat.', code: `
float hyperspace_speed = 1.0; // param: Speed, 0.2..3
vec3 hyperspace_colour = vec3(0.6, 0.8, 1.0); // param: Colour
vec3 fx_hyperspace(Surf2 s, float t) {
  vec2 p = k_centred(s);
  float r = length(p), a = atan(p.y, p.x) / 6.2832;
  vec3 col = vec3(0.0);
  // in each of many thin wedges a star rushes out from the middle, stretching as it speeds up
  for (int l = 0; l < 2; l++) {
    float n = 90.0 + 70.0 * float(l);
    float w = floor(a * n), h = hash1(vec3(w, float(l), 7.0));
    float z = fract(h * 13.0 + t * hyperspace_speed * (0.25 + 0.3 * h));
    float rad = z * z * 0.9, len = 0.01 + 0.35 * z * z;
    float along = r - rad;
    float streak = step(-len, along) * step(along, 0.0) * (1.0 + along / len);
    float across = abs(fract(a * n) - 0.5) / n * 6.2832 * r;
    col += mix(hyperspace_colour, vec3(1.0), z) * streak * exp(-across * 700.0) * z;
  }
  return col * (0.8 + 0.6 * k_pulse(t, 120.0)) + hyperspace_colour * 0.1 * exp(-r * 8.0);
}` },
  { id: 'moire', name: 'Moiré', group: 'Music', about: 'Two sets of fine rings drift over each other, and big slow shapes swim where they cross.', code: `
float moire_speed = 1.0; // param: Speed, 0.1..3
vec3 moire_colour = vec3(1.0); // param: Colour
vec3 fx_moire(Surf2 s, float t) {
  vec2 p = k_centred(s);
  float tt = t * moire_speed;
  vec2 c1 = 0.12 * vec2(cos(tt * 0.3), sin(tt * 0.4));
  float a = sin(length(p - c1) * 120.0), b = sin(length(p + c1) * 120.0);
  return moire_colour * smoothstep(-0.3, 0.3, a * b) * (0.8 + 0.3 * uBeat);
}` },
  { id: 'cells', name: 'Cells', group: 'Music', about: 'Wobbling cells with glowing walls across the whole frame; a few light up on every beat.', code: `
float cells_size = 0.15; // param: Cell size, 0.05..0.4
vec3 fx_cells(Surf2 s, float t) {
  vec2 q = k_frame(s) / cells_size;
  vec2 id = floor(q), f = fract(q);
  float d1 = 9.0, d2 = 9.0;
  vec2 best = vec2(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = 0.5 + 0.4 * sin(t * 0.6 + 6.2832 * vec2(hash2(id + g), hash2(id + g + 7.0)));
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; best = id + g; } else if (d < d2) d2 = d;
    }
  }
  float beat = uHasAudio > 0.5 ? uBeats : floor(t * 2.0);
  float lit = step(0.75, hash2(best + beat * 1.3)) * k_pulse(t, 120.0);
  vec3 c = hsv(fract(hash2(best) * 0.3 + t * 0.02 + 0.5), 0.75, 1.0);
  return c * (exp(-(d2 - d1) * 25.0) * 0.9 + 0.1 + 0.8 * lit);
}` },
  { id: 'scope', name: 'Oscilloscope', group: 'Music', about: 'A glowing green trace over a grid, its waves made from the bass, mids and treble.', code: `
vec3 scope_colour = vec3(0.2, 1.0, 0.4); // param: Colour
bool scope_grid = true; // param: Grid, toggle
vec3 fx_scope(Surf2 s, float t) {
  vec2 q = k_square(s);
  vec3 a = uHasAudio > 0.5 ? uAudio.xyz : vec3(0.5 + 0.3 * sin(t * 1.3), 0.35, 0.2 + 0.15 * sin(t * 2.1));
  // three waves: big and slow for the bass, quicker for the mids, a fizz for the treble
  float x = q.x;
  float y = 0.5 + 0.25 * a.x * sin(x * 6.0 - t * 3.0) + 0.12 * a.y * sin(x * 23.0 + t * 7.0) + 0.04 * a.z * sin(x * 90.0 - t * 19.0);
  float dy = 1.5 * a.x * cos(x * 6.0 - t * 3.0) + 2.76 * a.y * cos(x * 23.0 + t * 7.0) + 3.6 * a.z * cos(x * 90.0 - t * 19.0);
  float d = abs(q.y - y) / sqrt(1.0 + dy * dy);
  vec3 col = scope_colour * (exp(-d * 300.0) + 0.3 * exp(-d * 30.0)) * (0.85 + 0.4 * uBeat);
  if (scope_grid) {
    vec2 g = abs(fract(q * 8.0) - 0.5);
    col += scope_colour * 0.07 * step(0.47, max(g.x, g.y));
  }
  return col;
}` },
  { id: 'disco', name: 'Mirror ball', group: 'Music', about: "A mirror ball's spots of light wheel slowly across the whole frame, twinkling, flashing on the beat.", code: `
float disco_spots = 0.7; // param: Spots, 0.2..1
bool disco_colours = true; // param: Coloured spots, toggle
float disco_speed = 1.0; // param: Speed, 0.2..3
vec3 fx_disco(Surf2 s, float t) {
  vec2 q = k_frame(s);
  // the spots move together, curving a little, as the ball turns
  vec2 m = q + vec2(t * 0.05 * disco_speed, 0.04 * sin(q.x * 2.0));
  vec3 d = k_drift(m, vec2(0.0), 0.1, t, 4.0);
  float on = step(1.0 - disco_spots, d.z);
  float spot = smoothstep(0.18, 0.14, length(d.xy * vec2(1.0, 1.2))) + 0.4 * exp(-length(d.xy) * 10.0);
  float tw = 0.6 + 0.4 * sin(t * 5.0 + d.z * 40.0) + 0.8 * uBeat;
  vec3 c = disco_colours ? hsv(fract(d.z * 3.0), 0.55, 1.0) : vec3(1.0);
  return c * spot * on * tw + vec3(0.02, 0.01, 0.04);
}` },
  { id: 'tris', name: 'Triangles', group: 'Music', about: 'A grid of triangles across the frame, flipping on and off with the beat.', code: `
float tris_size = 0.12; // param: Size, 0.05..0.4
vec3 fx_tris(Surf2 s, float t) {
  vec2 q = k_frame(s) / tris_size;
  // a triangle grid: skew the square grid, then split each square along its diagonal
  vec2 g = vec2(q.x - q.y * 0.57735, q.y * 1.1547);
  vec2 id = floor(g), f = fract(g);
  float up = step(f.x + f.y, 1.0);
  float h = hash2(id * 2.0 + up);
  float n = uHasAudio > 0.5 ? uBeats : floor(t * 2.0);
  float on = step(0.5, hash2(id + up * 3.0 + n * 0.7));
  float e = min(min(f.x, f.y), abs(1.0 - f.x - f.y));
  vec3 c = hsv(fract(0.55 + 0.25 * h + n * 0.05), 0.8, 1.0) * (0.12 + 0.88 * on * (0.5 + 0.5 * k_pulse(t, 120.0)));
  return c * smoothstep(0.02, 0.06, e);
}` },
  { id: 'synthwave', name: 'Synthwave', group: 'Music', about: 'A striped sunset sun over a neon grid racing towards you, across the whole frame. The grid pulses on the beat.', code: `
float synthwave_speed = 1.0; // param: Speed, 0.2..3
vec3 synthwave_grid = vec3(1.0, 0.15, 0.8); // param: Grid colour
vec3 fx_synthwave(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y, hz = 0.42;
  vec3 col;
  if (q.y > hz) {
    // the sky, the sun striped across its lower half, and dark mountains on the horizon
    col = mix(vec3(0.85, 0.15, 0.45), vec3(0.06, 0.02, 0.18), sqrt((q.y - hz) / (1.0 - hz)));
    vec2 sc = vec2(aspect * 0.5, hz + 0.2);
    float d = length(q - sc) - 0.22;
    float gap = smoothstep(sc.y + 0.02, hz, q.y) * 0.6;
    float cut = step(fract(q.y * 28.0 - t * 0.4), gap);
    vec3 sun = mix(vec3(1.0, 0.85, 0.2), vec3(1.0, 0.15, 0.5), smoothstep(sc.y + 0.2, sc.y - 0.2, q.y));
    col = mix(col, sun, k_fill(d, 0.003) * (1.0 - cut)) + sun * 0.25 * exp(-max(d, 0.0) * 8.0);
    float mtn = hz + 0.07 * abs(sin(q.x * 5.0 + 1.0)) * (0.6 + 0.4 * sin(q.x * 13.0)) * smoothstep(0.1, 0.5, abs(q.x - sc.x));
    col = mix(col, vec3(0.08, 0.02, 0.15), step(q.y, mtn));
  } else {
    // the grid: lines running to the vanishing point, and cross lines rushing in
    float dy = max(hz - q.y, 0.001);
    float z = 0.1 / dy;
    float x = (q.x - aspect * 0.5) * z * 4.0;
    float lx = abs(fract(x) - 0.5) / (z * 4.0);
    float zz = z * 2.0 + t * synthwave_speed * 2.0;
    float lz = abs(fract(zz) - 0.5) / (0.2 / (dy * dy));
    float line = exp(-lx * 600.0) + exp(-lz * 600.0);
    col = vec3(0.06, 0.0, 0.1) + synthwave_grid * line * (0.7 + 0.6 * k_pulse(t, 110.0)) * smoothstep(0.0, 0.08, dy);
  }
  return col;
}` },
  { id: 'julia', name: 'Fractal', group: 'Music', about: 'A Julia set fractal slowly changes shape, its colours flowing.', code: `
float julia_speed = 1.0; // param: Speed, 0.1..3
vec3 fx_julia(Surf2 s, float t) {
  vec2 z = k_centred(s) * 2.6;
  float tt = t * 0.12 * julia_speed;
  // c circles near the edge of the Mandelbrot set, where the Julia sets are lacy but stay in one piece
  vec2 c = vec2(-0.76, 0.14) + vec2(0.08 * cos(tt), 0.1 * sin(tt * 1.3));
  float n = 0.0;
  for (int i = 0; i < 20; i++) {
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    if (dot(z, z) > 16.0) break;
    n += 1.0;
  }
  float v = (n - log2(max(log2(max(dot(z, z), 1.0001)), 0.0001)) + 1.0) / 20.0;
  vec3 col = pal(v * 1.5 + tt * 0.3, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.1, 0.2));
  // inside the set, a dim glow from where the point ended up
  vec3 inner = pal(dot(z, z) * 0.8 + tt, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.3, 0.2, 0.2)) * 0.25;
  return mix(col * sqrt(clamp(v, 0.0, 1.0)), inner, step(19.5, n)) * (0.85 + 0.3 * uBeat);
}` },
  { id: 'spiral', name: 'Spiral', group: 'Music', about: 'A hypnotic spiral turning in or out, pulsing on the beat.', code: `
float spiral_arms = 3.0; // param: Arms, 1..8, whole
float spiral_speed = 1.0; // param: Speed, -3..3
vec3 fx_spiral(Surf2 s, float t) {
  vec2 p = k_centred(s);
  float r = length(p), a = atan(p.y, p.x);
  float v = fract(a / 6.2832 * spiral_arms + log(max(r, 0.001)) * 1.5 - t * spiral_speed * 0.5);
  float band = smoothstep(0.45, 0.5, v) - smoothstep(0.95, 1.0, v);
  vec3 c = hsv(fract(r * 0.8 - t * 0.05), 0.7, 1.0);
  return c * band * smoothstep(0.0, 0.05, r) * (0.7 + 0.5 * k_pulse(t, 120.0));
}` },
  { id: 'hexes', name: 'Hexagons', group: 'Music', about: 'A honeycomb across the frame; a wave of light runs out through it from the middle on every beat.', code: `
float hexes_size = 0.08; // param: Size, 0.03..0.25
vec3 hexes_colour = vec3(0.1, 0.8, 1.0); // param: Colour
vec3 fx_hexes(Surf2 s, float t) {
  vec2 q = k_frame(s) / hexes_size;
  // the nearer of two offset lattices' centres gives the hexagon this point is in
  vec2 r = vec2(1.0, 1.732);
  vec2 a = mod(q, r) - r * 0.5, b = mod(q - r * 0.5, r) - r * 0.5;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 id = q - g;
  float edge = 0.5 - max(dot(abs(g), vec2(0.5, 0.866)), abs(g.x));
  float dist = length(id * hexes_size - vec2(uRes.x / uRes.y * 0.5, 0.5));
  float wave = uHasAudio > 0.5 ? exp(-pow((dist - (1.0 - uBeat) * 1.2) * 8.0, 2.0)) * uBeat
                               : exp(-pow((fract(dist * 1.2 - t * 0.6) - 0.5) * 5.0, 2.0));
  return hexes_colour * ((0.06 + wave) * smoothstep(0.02, 0.06, edge) + 0.25 * exp(-edge * 30.0));
}` },
  { id: 'halftone', name: 'Halftone', group: 'Music', about: 'A grid of dots across the frame that swell and shrink in slow waves, bigger on the beat.', code: `
float halftone_spacing = 24.0; // param: Dot spacing, 8..60, whole
vec3 halftone_colour = vec3(1.0, 0.3, 0.5); // param: Colour
vec3 fx_halftone(Surf2 s, float t) {
  vec2 px = s.screen * uRes;
  vec2 id = floor(px / halftone_spacing), f = fract(px / halftone_spacing) - 0.5;
  vec2 c = (id + 0.5) * halftone_spacing;
  float v = 0.5 + 0.5 * sin(c.x * 0.008 + t) * sin(c.y * 0.011 - t * 0.7);
  float r = v * 0.45 * (0.75 + 0.35 * k_pulse(t, 120.0));
  return halftone_colour * k_fill(length(f) - r, 0.04) * (0.4 + 0.6 * v);
}` },
  { id: 'sunburst', name: 'Sunburst', group: 'Music', about: 'Rays of two colours turning round the middle, pulsing on the beat.', code: `
float sunburst_rays = 12.0; // param: Rays, 4..32, whole
float sunburst_speed = 0.3; // param: Speed, -2..2
vec3 sunburst_colour = vec3(1.0, 0.6, 0.1); // param: Colour
vec3 sunburst_second = vec3(0.9, 0.1, 0.4); // param: Second colour
vec3 fx_sunburst(Surf2 s, float t) {
  vec2 p = k_centred(s);
  float a = atan(p.y, p.x) / 6.2832 * sunburst_rays - t * sunburst_speed;
  vec3 c = mix(sunburst_colour, sunburst_second, smoothstep(0.23, 0.27, abs(fract(a) - 0.5)));
  return c * (0.5 + 0.5 * smoothstep(0.8, 0.0, length(p))) * (0.7 + 0.4 * k_pulse(t, 120.0));
}` },
  { id: 'beatwave', name: 'Beat wave', group: 'Music', about: 'Each beat sends a band of light across the frame from left to right, through one surface after another.', code: `
vec3 beatwave_colour = vec3(0.4, 0.3, 1.0); // param: Colour
bool beatwave_rainbow = true; // param: A new colour each wave, toggle
vec3 fx_beatwave(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  float n = uHasAudio > 0.5 ? uBeats : floor(t);
  float ph = uHasAudio > 0.5 ? 1.0 - uBeat : fract(t);
  vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float age = ph + float(i);
    float x = age * (aspect + 0.6) / 1.5 - 0.3;
    float band = exp(-pow((q.x - x - 0.05 * sin(q.y * 4.0 + t)) / 0.07, 2.0));
    vec3 c = beatwave_rainbow ? hsv(fract((n - float(i)) * 0.17), 0.8, 1.0) : beatwave_colour;
    col += c * band * exp(-age * 0.8);
  }
  return col + vec3(0.5) * exp(-s.edge / 3.0) * 0.15;
}` },
  { id: 'matrix', name: 'Digital rain', group: 'Music', about: 'Columns of glowing green characters stream down, each with a bright head.', code: `
vec3 matrix_colour = vec3(0.2, 1.0, 0.35); // param: Colour
float matrix_speed = 1.0; // param: Speed, 0.2..3
vec3 fx_matrix(Surf2 s, float t) {
  vec2 px = s.uv * s.size;
  vec2 cs = vec2(14.0, 18.0);
  vec2 cell = floor(px / cs), f = fract(px / cs);
  float h = hash1(vec3(cell.x, s.id, 3.0));
  float rows = s.size.y / cs.y;
  // a streak falls down each column, its head bright, its tail fading behind it
  float head = fract(t * matrix_speed * (0.06 + 0.1 * h) + h * 5.0) * (rows + 24.0);
  float tail = head - (rows - cell.y);
  float bright = tail >= 0.0 && tail < 20.0 ? 1.0 - tail / 20.0 : 0.0;
  // a character: dots on a 3 by 5 grid, changing now and then
  vec2 g = floor(f * vec2(5.0, 7.0));
  float inside = step(1.0, g.x) * step(g.x, 3.0) * step(1.0, g.y) * step(g.y, 5.0);
  float dotOn = step(0.45, hash1(vec3(cell + g * 0.13, floor(t * 3.0 * (0.3 + h) + hash2(cell) * 10.0))));
  vec3 c = matrix_colour * bright + vec3(0.8, 1.0, 0.85) * step(0.0, tail) * step(tail, 1.0);
  return c * inside * dotOn * (0.85 + 0.3 * uBeat);
}` },
  { id: 'opart', name: 'Op art', group: 'Music', about: 'Black and white stripes bent by a slowly wandering bulge, so the surface seems to swell.', code: `
float opart_speed = 0.5; // param: Speed, 0..2
bool opart_colour = false; // param: Colour, toggle
vec3 fx_opart(Surf2 s, float t) {
  vec2 p = k_centred(s);
  vec2 c = 0.2 * vec2(sin(t * 0.37 * opart_speed), cos(t * 0.29 * opart_speed));
  float r = length(p - c);
  float bulge = exp(-r * r * 10.0);
  float v = sin(p.y * 70.0 * (1.0 - 0.6 * bulge) + t * opart_speed) * sign(sin(p.x * 18.0 * (1.0 - 0.5 * bulge)));
  float m = smoothstep(-0.2, 0.2, v);
  return opart_colour ? mix(vec3(0.05, 0.0, 0.12), vec3(1.0, 0.2, 0.6), m) : vec3(m);
}` },
];
