// Ambient looks: skies, water, light and slow living things, for a mood rather than a moment. See docs/looks.md.

export const AMBIENT = [
  { id: 'starry', name: 'Starry night', group: 'Ambient', about: 'A deep sky of twinkling stars and the Milky Way across the frame, with now and then a shooting star.', code: `
float starry_every = 8.0; // param: Seconds between shooting stars, 3..30
bool starry_milky = true; // param: Milky Way, toggle
vec3 fx_starry(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  vec3 col = mix(vec3(0.02, 0.03, 0.09), vec3(0.0, 0.0, 0.02), q.y);
  if (starry_milky) {
    float band = exp(-pow((q.y - 0.25 - q.x * 0.3) / 0.16, 2.0));
    col += vec3(0.14, 0.12, 0.2) * band * fbm(vec3(q * 5.0, 1.0)) * 1.5;
  }
  for (int l = 0; l < 2; l++) {
    float fl = float(l);
    vec3 st = k_drift(q, vec2(0.0), 0.025 + 0.025 * fl, t, 3.0 + fl * 5.0);
    float tw = 0.55 + 0.45 * sin(t * (1.0 + st.z * 3.0) + st.z * 60.0);
    col += mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.9, 0.75), fract(st.z * 7.0)) * exp(-length(st.xy) * (70.0 - 25.0 * fl)) * step(0.55 + 0.15 * fl, st.z) * tw;
  }
  // a shooting star: streaks across part of the sky in under a second
  vec2 e = k_now_and_then(t, starry_every, 0.85, 1.0);
  if (e.x >= 0.0 && e.x < 0.9) {
    float dir = hash1(vec3(e.y, 2.0, 3.0)) < 0.5 ? 1.0 : -1.0;
    vec2 start = vec2(e.y * aspect, 0.75 + 0.2 * hash1(vec3(e.y, 5.0, 1.0)));
    vec2 v = normalize(vec2(dir, -0.45));
    vec2 head = start + v * e.x * 0.8, d = q - head;
    float behind = dot(d, -v), across = abs(d.x * v.y - d.y * v.x);
    col += vec3(1.0, 0.95, 0.85) * step(0.0, behind) * exp(-behind * 7.0) * exp(-across * 700.0) * (1.0 - e.x / 0.9);
  }
  return col;
}` },
  { id: 'caustics', name: 'Pool light', group: 'Ambient', about: 'The shifting web of light that sun through rippling water throws on the bottom of a pool.', code: `
vec3 caustics_colour = vec3(0.2, 0.75, 1.0); // param: Colour
float caustics_speed = 1.0; // param: Speed, 0.2..3
vec3 fx_caustics(Surf2 s, float t) {
  // a well-known trick: warp a point round a few times, and the light gathers into a moving web
  vec2 p = k_frame(s) * 5.0 - 250.0, i = p;
  float tt = t * 0.4 * caustics_speed + 23.0, c = 1.0;
  for (int n = 0; n < 5; n++) {
    float tn = tt * (1.0 - 3.5 / float(n + 1));
    i = p + vec2(cos(tn - i.x) + sin(tn + i.y), sin(tn - i.y) + cos(tn + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tn) / 0.005), p.y / (cos(i.y + tn) / 0.005)));
  }
  c = 1.17 - pow(c / 5.0, 1.4);
  float web = clamp(pow(abs(c), 8.0), 0.0, 1.0);
  return caustics_colour * 0.22 + mix(caustics_colour, vec3(1.0), 0.6) * web;
}` },
  { id: 'aquarium', name: 'Fish tank', group: 'Ambient', about: 'Bright tropical fish swim back and forth past swaying weed, with bubbles rising and light from above.', code: `
float aquarium_fish = 6.0; // param: How many fish, 1..10, whole
float aquarium_fishshape(vec2 p, float wag) {
  // a fish facing right, about 1.5 long: an oval body, a tail that wags, a fin on top
  float body = k_oval(p, vec2(0.5, 0.24));
  float tail = k_tri(p, vec2(-0.38, 0.0), vec2(-0.75, 0.26 + 0.12 * wag), vec2(-0.75, -0.26 + 0.12 * wag));
  float fin = k_tri(p, vec2(-0.15, 0.18), vec2(0.15, 0.18), vec2(-0.2, 0.38));
  return min(min(body, tail), fin);
}
vec3 fx_aquarium(Surf2 s, float t) {
  vec2 q = k_square(s);
  float w = s.size.x / max(s.size.y, 1.0);
  vec3 col = mix(vec3(0.0, 0.06, 0.16), vec3(0.02, 0.22, 0.38), q.y);
  // shafts of light from the surface, swaying
  col += vec3(0.2, 0.4, 0.45) * pow(0.5 + 0.5 * sin(q.x * 9.0 + q.y * 2.5 + 2.0 * sin(t * 0.4)), 6.0) * q.y * 0.4;
  // weed along the bottom, swaying more towards its tips
  float c = floor(q.x / 0.09), h = hash1(vec3(c, s.id, 2.0));
  float ht = 0.15 + 0.3 * h, sx = (c + 0.5) * 0.09 + 0.04 * sin(q.y * 6.0 + t * 1.1 + c) * q.y / ht;
  float weed = abs(q.x - sx) - 0.014 * (1.0 - q.y / ht);
  col = mix(col, vec3(0.05, 0.4, 0.15) * (0.6 + 0.4 * h), k_fill(weed, 0.003) * step(q.y, ht) * step(0.3, h));
  col = mix(col, vec3(0.55, 0.45, 0.3) * (0.7 + 0.3 * noise(vec3(q * 60.0, 1.0))), step(q.y, 0.04 + 0.01 * sin(q.x * 13.0)));
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    if (fi >= aquarium_fish) break;
    float h1 = hash1(vec3(fi, s.id, 5.0)), h2 = hash1(vec3(fi, s.id, 9.0));
    float dir = h1 < 0.5 ? 1.0 : -1.0, size = 0.06 + 0.06 * h2;
    float x = fract(t * (0.03 + 0.04 * h2) + h1 * 5.0) * (w + 0.5) - 0.25;
    if (dir < 0.0) x = w - x;
    vec2 p = (q - vec2(x, 0.2 + 0.65 * fract(h1 * 13.0) + 0.03 * sin(t * 0.7 + fi))) / size;
    p.x *= dir;
    float d = aquarium_fishshape(p, sin(t * 8.0 + fi));
    vec3 fc = h2 < 0.33 ? vec3(1.0, 0.45, 0.05) : h2 < 0.66 ? vec3(1.0, 0.85, 0.1) : vec3(0.15, 0.5, 1.0);
    fc = mix(fc, vec3(1.0), step(abs(p.x - 0.1), 0.06) * step(fract(h1 * 7.0), 0.5));
    col = mix(col, fc * (0.75 + 0.35 * smoothstep(-0.2, 0.2, p.y)), k_fill(d, 0.03));
    col = mix(col, vec3(0.02), k_fill(k_circle(p - vec2(0.3, 0.05), 0.05), 0.02));
  }
  // bubbles rising
  vec3 b = k_drift(q + vec2(0.01 * sin(t * 3.0 + q.y * 20.0), 0.0), vec2(0.0, 0.12), 0.06, t, 4.0);
  col += vec3(0.6, 0.85, 1.0) * exp(-abs(length(b.xy) - 0.12) * 60.0) * step(0.85, b.z) * 0.7;
  return col;
}` },
  { id: 'lavalamp', name: 'Lava lamp', group: 'Ambient', about: 'Blobs of warm wax rise, fall and melt into each other in glowing liquid.', code: `
vec3 lavalamp_wax = vec3(1.0, 0.3, 0.08); // param: Wax
vec3 lavalamp_liquid = vec3(0.35, 0.05, 0.3); // param: Liquid
float lavalamp_speed = 1.0; // param: Speed, 0.2..3
vec3 fx_lavalamp(Surf2 s, float t) {
  vec2 q = k_square(s);
  float w = s.size.x / max(s.size.y, 1.0);
  float tt = t * lavalamp_speed;
  // each blob rises and sinks at its own pace; where they meet they flow together
  float d = min(q.y - 0.06, 0.95 - q.y);
  for (int i = 0; i < 6; i++) {
    float fi = float(i), h = hash1(vec3(fi, s.id, 3.0));
    vec2 c = vec2(w * (0.2 + 0.6 * h) + 0.05 * sin(tt * 0.3 + fi), 0.5 + 0.42 * sin(tt * (0.08 + 0.07 * h) + h * 6.28));
    d = k_smin(d, k_circle(q - c, 0.07 + 0.07 * fract(h * 7.0)), 0.1);
  }
  float wax = k_fill(d, 0.005);
  // the wax is lit from below and glows at its edges; the liquid is brighter near the lamp at the bottom
  vec3 liquid = lavalamp_liquid * (0.35 + 0.65 * smoothstep(1.0, 0.0, q.y));
  vec3 body = lavalamp_wax * (0.65 + 0.35 * smoothstep(0.08, -0.04, d)) * (0.75 + 0.35 * smoothstep(1.0, 0.0, q.y));
  return mix(liquid + lavalamp_wax * 0.25 * k_glow(d, 0.03), body + vec3(1.0, 0.8, 0.5) * 0.25 * exp(-abs(d) / 0.008), wax);
}` },
  { id: 'clouds', name: 'Drifting clouds', group: 'Ambient', about: 'Clouds drift slowly across a day, sunset or night sky, from one surface to the next.', code: `
int clouds_sky = 0; // param: Sky, choice: Day=0|Sunset=1|Night=2
float clouds_speed = 1.0; // param: Speed, 0.2..4
float clouds_amount = 0.5; // param: How cloudy, 0..1
vec3 fx_clouds(Surf2 s, float t) {
  vec2 q = k_frame(s);
  vec3 sky = mix(vec3(0.45, 0.65, 0.95), vec3(0.12, 0.3, 0.8), q.y), lit = vec3(1.0), shade = vec3(0.6, 0.65, 0.75);
  if (clouds_sky == 1) { sky = mix(vec3(1.0, 0.55, 0.2), vec3(0.3, 0.1, 0.4), q.y); lit = vec3(1.0, 0.6, 0.45); shade = vec3(0.35, 0.15, 0.3); }
  if (clouds_sky == 2) { sky = mix(vec3(0.03, 0.05, 0.13), vec3(0.0, 0.0, 0.03), q.y); lit = vec3(0.35, 0.4, 0.5); shade = vec3(0.06, 0.07, 0.1); }
  vec2 m = q * vec2(1.5, 3.0) - vec2(t * 0.03 * clouds_speed, 0.0);
  float n = fbm(vec3(m, t * 0.01)), n2 = fbm(vec3(m + vec2(0.0, -0.08), t * 0.01));
  float cover = smoothstep(0.65 - 0.25 * clouds_amount, 0.85 - 0.2 * clouds_amount, n);
  // brighter where the cloud thins towards the light above
  vec3 c = mix(shade, lit, clamp(0.5 + (n - n2) * 6.0, 0.0, 1.0));
  return mix(sky, c, cover);
}` },
  { id: 'fireflies', name: 'Fireflies', group: 'Ambient', about: 'Fireflies wander and blink over dark grass on a summer night.', code: `
float fireflies_count = 0.5; // param: How many, 0.1..1
vec3 fx_fireflies(Surf2 s, float t) {
  vec2 q = k_frame(s);
  vec3 col = mix(vec3(0.02, 0.05, 0.07), vec3(0.0, 0.01, 0.04), q.y);
  // grass along the bottom, dark against the sky
  float blades = 0.07 + 0.05 * abs(sin(q.x * 90.0 + sin(q.x * 13.0) * 3.0)) * (0.5 + 0.5 * noise(vec3(q.x * 20.0, 1.0, 0.0)));
  col *= step(blades, q.y);
  for (int l = 0; l < 2; l++) {
    float fl = float(l);
    vec2 m = q + 0.04 * vec2(sin(t * 0.3 + q.y * 5.0 + fl), cos(t * 0.27 + q.x * 4.0));
    vec3 d = k_drift(m, vec2(0.01, 0.004) * (1.0 + fl), 0.14, t, 7.0 + fl * 3.0);
    vec2 p = d.xy + 0.12 * vec2(sin(t * (0.5 + d.z) + d.z * 9.0), cos(t * (0.4 + d.z) + d.z * 5.0));
    float blink = pow(max(0.0, sin(t * (0.6 + d.z) + d.z * 30.0)), 4.0);
    col += vec3(0.75, 1.0, 0.2) * (exp(-length(p) * 22.0) + 0.35 * exp(-length(p) * 7.0)) * blink * step(1.0 - fireflies_count, d.z) * (0.6 + 0.4 * fl);
  }
  return col;
}` },
  { id: 'puddle', name: 'Rain on a puddle', group: 'Ambient', about: 'Raindrops land on dark water, each sending out a ring of ripples.', code: `
float puddle_rain = 0.6; // param: How heavy, 0.1..1
vec3 puddle_light = vec3(0.5, 0.6, 0.8); // param: Light on the water
vec3 fx_puddle(Surf2 s, float t) {
  vec2 q = k_square(s) * 7.0;
  vec3 col = mix(vec3(0.0, 0.01, 0.03), puddle_light * 0.08, smoothstep(0.0, 7.0, q.y));
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 id = floor(q) + vec2(float(i), float(j));
      float h = hash2(id + s.id * 7.0), per = 1.2 + h;
      float k = floor(t / per + h), ph = fract(t / per + h);
      if (hash2(id + k * 1.7) > puddle_rain) continue;
      vec2 c = id + 0.5 + 0.6 * (vec2(hash2(id + k), hash2(id + k + 3.0)) - 0.5);
      float r = length(q - c), fade = (1.0 - ph) * (1.0 - ph);
      col += puddle_light * (exp(-abs(r - ph * 1.1) * 30.0) + 0.5 * exp(-abs(r - ph * 0.7) * 30.0)) * fade * 0.7;
    }
  }
  return col;
}` },
  { id: 'sunset', name: 'Sunset', group: 'Ambient', about: 'The sun sinks into the sea over a few minutes, the sky turning gold, then red, then dusk, and starts again.', code: `
float sunset_minutes = 2.0; // param: Minutes per sunset, 0.5..10
vec3 fx_sunset(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y, hz = 0.32;
  float ph = fract(t / (sunset_minutes * 60.0));
  float sy = 0.8 - 0.62 * ph;
  float dusk = smoothstep(0.75, 0.25, sy), night = smoothstep(0.32, 0.18, sy);
  vec3 top = mix(mix(vec3(0.25, 0.5, 0.9), vec3(0.15, 0.08, 0.3), dusk), vec3(0.02, 0.02, 0.08), night);
  vec3 low = mix(mix(vec3(1.0, 0.85, 0.55), vec3(1.0, 0.35, 0.12), dusk), vec3(0.25, 0.08, 0.15), night);
  float y = max(q.y, hz + (hz - q.y) * 0.6);
  vec3 sky = mix(low, top, smoothstep(hz, 1.0, y));
  vec2 sc = vec2(aspect * 0.5, sy);
  vec3 sun = mix(vec3(1.0, 0.95, 0.75), vec3(1.0, 0.4, 0.1), dusk);
  float ds = length(vec2(q.x, y) - sc) - 0.07;
  sky += sun * (k_fill(ds, 0.003) + 0.35 * exp(-max(ds, 0.0) * 9.0)) * (1.0 - night * 0.7);
  if (q.y < hz) {
    // the sea: the sky mirrored and darker, a glittering path under the sun
    float rip = noise(vec3(q.x * 40.0, q.y * 120.0 - t * 0.5, 1.0));
    float path = exp(-abs(q.x - sc.x) * (8.0 + 30.0 * (hz - q.y))) * smoothstep(0.4, 0.8, rip);
    sky = sky * (0.4 + 0.15 * rip) * mix(vec3(1.0), vec3(0.6, 0.75, 1.0), smoothstep(hz, 0.0, q.y)) + sun * path * (1.0 - night) * 0.8;
  }
  return sky;
}` },
  { id: 'nebula', name: 'Nebula', group: 'Ambient', about: 'Clouds of coloured gas churn slowly among the stars, across the whole frame.', code: `
vec3 nebula_colour = vec3(0.7, 0.1, 0.55); // param: Colour
vec3 nebula_second = vec3(0.1, 0.35, 0.9); // param: Second colour
vec3 fx_nebula(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float n1 = fbm(vec3(q * 2.0, t * 0.02)), n2 = fbm(vec3(q * 3.0 + 5.0, t * 0.03));
  float lanes = 0.5 + 0.5 * fbm(vec3(q * 5.0 - 3.0, t * 0.015));
  vec3 col = (nebula_colour * pow(n1, 3.0) * 2.5 + nebula_second * pow(n2, 3.0) * 2.5) * lanes;
  vec3 st = k_drift(q, vec2(0.0), 0.03, t, 8.0);
  col += vec3(1.0) * exp(-length(st.xy) * 60.0) * step(0.6, st.z) * (0.6 + 0.4 * sin(t * 2.0 + st.z * 50.0));
  return col;
}` },
  { id: 'breathe', name: 'Slow breath', group: 'Ambient', about: 'A soft glow that swells and fades like slow breathing, its colour drifting. Calming.', code: `
vec3 breathe_colour = vec3(0.3, 0.5, 1.0); // param: Colour
float breathe_rate = 6.0; // param: Breaths a minute, 3..15
bool breathe_drift = true; // param: Colour drifts, toggle
vec3 fx_breathe(Surf2 s, float t) {
  // in for two fifths of each breath, out for the rest
  float ph = fract(t * breathe_rate / 60.0);
  float b = ph < 0.4 ? smoothstep(0.0, 0.4, ph) : smoothstep(1.0, 0.4, ph);
  vec3 c = breathe_drift ? mix(breathe_colour, breathe_colour.gbr, 0.5 + 0.5 * sin(t * 0.05)) : breathe_colour;
  vec2 p = k_centred(s);
  return c * (0.08 + 0.75 * b) * (1.0 - 0.5 * smoothstep(0.0, 0.7, length(p)) * (1.0 - b));
}` },
  { id: 'bubbles', name: 'Bubbles', group: 'Ambient', about: 'Soap bubbles float up and drift across the frame, shimmering with rainbow colours.', code: `
float bubbles_count = 0.4; // param: How many, 0.1..1
vec3 fx_bubbles(Surf2 s, float t) {
  vec2 q = k_frame(s);
  vec3 col = vec3(0.0);
  for (int l = 0; l < 2; l++) {
    float fl = float(l);
    vec2 m = q + vec2(0.03 * sin(t * 0.6 + q.y * 3.0 + fl), 0.0);
    vec3 d = k_drift(m, vec2(0.015, 0.05 + 0.03 * fl), 0.16 + 0.08 * fl, t, 2.0 + fl * 7.0);
    if (d.z < 1.0 - bubbles_count) continue;
    float r = 0.12 + 0.07 * fract(d.z * 13.0), len = length(d.xy);
    float rim = exp(-abs(len - r) * 70.0) + 0.15 * smoothstep(r, r * 0.6, len) * smoothstep(0.0, r, len);
    vec3 film = hsv(fract(atan(d.y, d.x) / 6.2832 + t * 0.1 + d.z * 5.0 + len * 4.0), 0.55, 1.0);
    col += film * rim * (0.5 + 0.3 * fl);
    col += vec3(1.0) * exp(-length(d.xy - r * vec2(-0.45, 0.45)) * 90.0);
  }
  return col;
}` },
  { id: 'petals', name: 'Cherry blossom', group: 'Ambient', about: 'Pink blossom petals flutter down and drift across the frame on a breeze.', code: `
float petals_count = 0.5; // param: How many, 0.1..1
float petals_wind = 0.3; // param: Wind, -1..1
vec3 petals_colour = vec3(1.0, 0.6, 0.75); // param: Colour
vec3 fx_petals(Surf2 s, float t) {
  vec2 q = k_frame(s);
  vec3 col = vec3(0.0);
  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    vec2 m = q + vec2(0.04 * sin(t * 0.8 + q.y * 4.0 + fl * 2.0), 0.0);
    vec3 d = k_drift(m, vec2(petals_wind * 0.12, -0.05 - 0.02 * fl), 0.13 + 0.05 * fl, t, 5.0 + fl * 4.0);
    if (d.z < 1.0 - petals_count) continue;
    // a petal tumbling: turning, and squashed as it flips
    vec2 p = d.xy * k_rot(t * (1.0 + d.z) + d.z * 30.0);
    p.x /= 0.3 + 0.7 * abs(sin(t * (1.5 + d.z) + d.z * 10.0));
    float petal = max(k_oval(p, vec2(0.15, 0.1)), -k_circle(p - vec2(0.17, 0.0), 0.05));
    col = mix(col, petals_colour * (0.7 + 0.3 * smoothstep(-0.1, 0.1, p.x)) * (0.6 + 0.2 * fl), k_fill(petal, 0.015));
  }
  return col;
}` },
  { id: 'waves', name: 'Ocean waves', group: 'Ambient', about: 'Seen from above: waves roll in to a sandy beach, wash up it in foam and slide back.', code: `
float waves_speed = 1.0; // param: Speed, 0.3..3
vec3 fx_waves(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float tt = t * waves_speed;
  // the sea reaches up the beach and back with each wave
  float swash = 0.38 + 0.07 * sin(tt * 0.6) + 0.025 * sin(q.x * 3.0 + tt * 0.7);
  float wet = q.y - swash;
  vec3 sand = vec3(0.85, 0.72, 0.5) * (0.85 + 0.15 * noise(vec3(q * 80.0, 1.0)));
  sand *= 1.0 - 0.3 * smoothstep(0.12, 0.0, -wet);
  vec3 sea = mix(vec3(0.1, 0.65, 0.65), vec3(0.02, 0.2, 0.45), smoothstep(0.0, 0.5, wet));
  // waves: crests coming in, breaking into foam as they reach the shallows
  float crest = fract(q.y * 3.5 + tt * 0.18 + 0.15 * sin(q.x * 2.0 + tt * 0.2));
  float foam = smoothstep(0.85, 1.0, crest) * smoothstep(0.55, 0.0, wet) * fbm(vec3(q * 12.0, tt * 0.3));
  sea += vec3(0.9) * foam * 1.5 + vec3(1.0) * exp(-wet * 40.0) * step(0.0, wet) * smoothstep(0.3, 0.7, noise(vec3(q * 30.0, tt)));
  return mix(sand, sea, smoothstep(-0.003, 0.003, wet));
}` },
];
