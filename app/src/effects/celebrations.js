// Celebrations: fireworks, parties and the lights of other holidays through the year. See docs/looks.md.
import { candleLook, skull } from './families.js';

export const CELEBRATIONS = [
  { id: 'fireworks', name: 'Fireworks', group: 'Celebrations', about: 'Rockets climb and burst into showers of coloured sparks across the whole frame, flashing on the beat.', code: `
float fireworks_every = 1.2; // param: Seconds between rockets, 0.4..5
bool fireworks_gold = false; // param: All gold, toggle
vec3 fx_fireworks(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  vec3 col = mix(vec3(0.02, 0.02, 0.07), vec3(0.0, 0.0, 0.02), q.y);
  float last = floor(t / fireworks_every);
  for (int i = 0; i < 4; i++) {
    float k = last - float(i), age = t - k * fireworks_every;
    float h = hash1(vec3(k, 1.0, 2.0)), h2 = hash1(vec3(k, 3.0, 4.0)), h3 = hash1(vec3(k, 5.0, 6.0));
    vec2 c = vec2(aspect * (0.15 + 0.7 * h), 0.5 + 0.35 * h2);
    vec3 hue = fireworks_gold ? vec3(1.0, 0.75, 0.35) : hsv(h3, 0.7, 1.0);
    if (age < 0.9) {
      // the rocket climbing, with a trail of sparks below it
      vec2 pos = vec2(c.x, c.y * sqrt(age / 0.9));
      vec2 d = q - pos;
      col += vec3(1.0, 0.8, 0.5) * (exp(-length(d) * 200.0) + 0.5 * exp(-abs(d.x) * 500.0) * step(d.y, 0.0) * exp(d.y * 15.0));
    } else {
      // the burst: sparks fly out along rays, slow down, fall and fade; an inner shell of another colour
      float a = age - 0.9, fade = exp(-a * 1.1) * step(a, 3.0);
      vec2 cg = c - vec2(0.0, 0.05 * a * a);
      vec2 d = q - cg;
      float ang = atan(d.y, d.x), n = 44.0;
      float j = floor(ang / 6.2832 * n + 0.5);
      vec2 dir = vec2(cos(j / n * 6.2832), sin(j / n * 6.2832));
      for (int sh = 0; sh < 2; sh++) {
        float R = (0.25 - 0.1 * float(sh)) * (0.6 + 0.6 * h2) * (1.0 - exp(-a * 3.0));
        vec2 sp = dir * R;
        float tail = k_seg(d, dir * R * 0.3, sp);
        float along = clamp(dot(d, dir) / max(R, 0.001), 0.0, 1.0);
        float tw = a > 1.2 ? step(0.4, hash1(vec3(j, k, floor(t * 15.0)))) : 1.0;
        vec3 sc = sh == 0 ? hue : mix(hue.gbr, vec3(1.0), 0.3);
        col += sc * (1.6 * exp(-length(d - sp) * 140.0) + 0.8 * exp(-tail * 350.0) * along * along) * fade * tw;
      }
      col += hue * 0.4 * exp(-a * 4.0) * exp(-length(d) * 4.0);
    }
  }
  return col * (0.85 + 0.3 * uBeat);
}` },
  { id: 'flag', name: 'Waving flag', group: 'Celebrations', about: 'A flag fills the surface, rippling in the wind: the Stars and Stripes or a rainbow.', code: `
int flag_kind = 0; // param: Flag, choice: Stars and Stripes=0|Rainbow=1
float flag_wind = 1.0; // param: Wind, 0..3
vec3 fx_flag(Surf2 s, float t) {
  vec2 uv = s.uv;
  // ripples run along from the pole; the cloth shades as it folds
  float ph = uv.x * 9.0 - t * 3.0 * flag_wind + uv.y * 2.0;
  uv.y += 0.02 * sin(ph) * uv.x * flag_wind;
  float shade = 0.82 + 0.22 * cos(ph) * min(flag_wind, 1.0) * uv.x;
  vec3 c;
  if (flag_kind == 1) {
    float k = floor((1.0 - uv.y) * 6.0);
    c = k < 1.0 ? vec3(0.9, 0.05, 0.05) : k < 2.0 ? vec3(1.0, 0.5, 0.0) : k < 3.0 ? vec3(1.0, 0.9, 0.0) : k < 4.0 ? vec3(0.0, 0.6, 0.15) : k < 5.0 ? vec3(0.1, 0.3, 0.9) : vec3(0.5, 0.1, 0.6);
  } else {
    float k = floor((1.0 - uv.y) * 13.0);
    c = mod(k, 2.0) < 0.5 ? vec3(0.75, 0.05, 0.1) : vec3(0.95);
    float top = 1.0 - 7.0 / 13.0;
    if (uv.x < 0.4 && uv.y > top) {
      // the canton: rows of six and five stars, staggered
      vec2 cv = vec2(uv.x / 0.4, (uv.y - top) / (1.0 - top));
      float row = floor(cv.y * 9.0), odd = mod(row, 2.0);
      float cx = cv.x * 6.0 - 0.5 * odd;
      float i = floor(cx);
      vec2 f = vec2((fract(cx) - 0.5) * 0.4 / 6.0 * s.size.x / max(s.size.y, 1.0), (fract(cv.y * 9.0) - 0.5) * (1.0 - top) / 9.0);
      float star = k_star(f, 0.018, 0.4) + step(5.0 - odd, i) * 1.0 + step(i, -0.5);
      c = mix(vec3(0.1, 0.15, 0.45), vec3(0.95), k_fill(star, 0.002));
    }
  }
  return c * shade;
}` },
  { id: 'sparklers', name: 'Sparklers', group: 'Celebrations', about: 'Sparklers fizz and spit bright sparks in every direction, slowly burning down their sticks.', code: `
float sparklers_count = 3.0; // param: How many, 1..6, whole
vec3 sparklers_colour = vec3(1.0, 0.85, 0.55); // param: Colour
vec3 fx_sparklers(Surf2 s, float t) {
  vec2 q = k_square(s);
  float w = s.size.x / max(s.size.y, 1.0);
  vec3 col = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    if (fi >= sparklers_count) break;
    float h = hash1(vec3(fi, s.id, 3.0));
    float burn = fract(t / 40.0 + h);
    vec2 base = vec2((fi + 0.5) / sparklers_count * w + 0.03 * sin(t * 0.7 + fi), 0.05);
    vec2 head = base + vec2(0.0, 0.75 - 0.4 * burn) + 0.01 * vec2(sin(t * 3.0 + fi), cos(t * 2.3 + fi));
    col += vec3(0.25) * (1.0 - smoothstep(0.002, 0.004, k_seg(q, base, head)));
    vec2 d = q - head;
    float r = length(d), a = atan(d.y, d.x), n = 70.0;
    float j = floor(a / 6.2832 * n + 0.5);
    float flick = floor(t * 24.0);
    float len = 0.04 + 0.16 * hash1(vec3(j, flick, fi)) * hash1(vec3(j, flick + 0.5, fi + 9.0));
    float across = abs(sin(a - j / n * 6.2832)) * r;
    float ray = exp(-across * 1200.0) * step(r, len) * (1.0 - r / len) * step(0.35, hash1(vec3(j, flick, fi + 4.0)));
    // a little fork at the end of some rays
    vec2 tip = vec2(cos(j / n * 6.2832), sin(j / n * 6.2832)) * len;
    float fork = exp(-length(d - tip) * 300.0) * step(0.7, hash1(vec3(j, flick, fi + 2.0)));
    col += sparklers_colour * (ray + fork) + vec3(1.0) * exp(-r * 120.0) + sparklers_colour * 0.25 * exp(-r * 12.0);
  }
  return col;
}` },
  { id: 'confetti', name: 'Confetti', group: 'Celebrations', about: 'Bright confetti flutters down across the whole frame, twisting and flashing as it turns.', code: `
float confetti_amount = 0.6; // param: How much, 0.1..1
vec3 fx_confetti(Surf2 s, float t) {
  vec2 q = k_frame(s);
  vec3 col = vec3(0.0);
  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    vec2 m = q + vec2(0.03 * sin(t * 1.3 + q.y * 5.0 + fl * 2.0), 0.0);
    vec3 d = k_drift(m, vec2(0.0, -0.09 - 0.04 * fl), 0.05 + 0.02 * fl, t, 3.0 + fl * 11.0);
    if (d.z < 1.0 - confetti_amount) continue;
    vec2 p = d.xy * k_rot(t * (2.0 + 3.0 * d.z) + d.z * 20.0);
    float flip = sin(t * 4.0 * (0.5 + d.z) + d.z * 30.0);
    p.y /= 0.15 + 0.85 * abs(flip);
    float piece = fract(d.z * 13.0) < 0.3 ? length(p) - 0.12 : k_box(p, vec2(0.16, 0.07));
    vec3 c = hsv(fract(d.z * 7.0), 0.85, 1.0) * (0.55 + 0.45 * abs(flip));
    col = mix(col, c, k_fill(piece, 0.02));
  }
  return col;
}` },
  { id: 'balloons', name: 'Balloons', group: 'Celebrations', about: 'Shiny balloons on strings float up and away across the whole frame.', code: `
float balloons_count = 0.5; // param: How many, 0.1..1
vec3 fx_balloons(Surf2 s, float t) {
  vec2 q = k_frame(s);
  vec3 col = vec3(0.0);
  for (int l = 0; l < 2; l++) {
    float fl = float(l);
    vec2 m = q + vec2(0.02 * sin(t * 0.7 + q.y * 3.0 + fl), 0.0);
    vec3 d = k_drift(m, vec2(0.005, 0.05 + 0.03 * fl), 0.22 + 0.1 * fl, t, 6.0 + fl * 3.0);
    if (d.z < 1.0 - balloons_count) continue;
    vec2 p = d.xy - vec2(0.0, 0.05);
    float b = k_oval(p, vec2(0.12, 0.15));
    float knot = k_tri(p, vec2(-0.02, -0.17), vec2(0.02, -0.17), vec2(0.0, -0.14));
    vec3 c = hsv(fract(d.z * 5.0), 0.8, 1.0);
    float shine = smoothstep(0.06, 0.0, length(p - vec2(-0.045, 0.06)));
    float string = exp(-abs(p.x - 0.015 * sin(p.y * 40.0 + t * 2.0)) * 600.0) * step(p.y, -0.17) * step(-0.45, p.y);
    col += c * k_fill(min(b, knot), 0.008) * (0.55 + 0.45 * smoothstep(0.12, -0.08, p.x + p.y * 0.5)) * (0.6 + 0.4 * fl);
    col += vec3(1.0) * shine * 0.7 + vec3(0.6) * string * 0.5;
  }
  return col;
}` },
  { id: 'hearts', name: 'Hearts', group: 'Celebrations', about: 'A big heart beats, lub-dub, or on the beat with music, as little hearts float up around it.', code: `
vec3 hearts_colour = vec3(1.0, 0.1, 0.35); // param: Colour
bool hearts_big = true; // param: Big heart, toggle
vec3 fx_hearts(Surf2 s, float t) {
  vec2 p = k_centred(s);
  float ph = fract(t * 70.0 / 60.0);
  float b = uHasAudio > 0.5 ? uBeat : exp(-ph * 12.0) + 0.6 * exp(-max(ph - 0.18, 0.0) * 12.0) * step(0.18, ph);
  vec3 col = vec3(0.0);
  // little hearts drifting up behind
  vec3 d = k_drift(p, vec2(0.01 * sin(t * 0.5), 0.06), 0.14, t, 2.0 + s.id);
  float sh = k_heart(d.xy * k_rot(0.3 * sin(t + d.z * 9.0)), 0.25);
  col += mix(hearts_colour, vec3(1.0, 0.6, 0.8), fract(d.z * 3.0)) * k_fill(sh, 0.02) * step(0.5, d.z) * 0.5;
  if (hearts_big) {
    float big = k_heart(p, 0.5 * (1.0 + 0.08 * b));
    vec3 c = hearts_colour * (0.65 + 0.45 * smoothstep(0.3, -0.2, p.x + p.y));
    col = mix(col, c, k_fill(big, 0.004));
    col += hearts_colour * 0.4 * k_glow(big, 0.03) * step(0.0, big) * (0.5 + b);
    col += vec3(1.0) * 0.6 * k_fill(k_oval((p - vec2(-0.11, 0.09)) * k_rot(-0.6), vec2(0.04, 0.018)), 0.01);
  }
  return col;
}` },
  { id: 'lanterns', name: 'Red lanterns', group: 'Celebrations', about: 'Round red paper lanterns with gold tassels hang and sway, glowing, for Lunar New Year.', code: `
float lanterns_count = 4.0; // param: How many, 1..6, whole
vec3 fx_lanterns(Surf2 s, float t) {
  vec2 q = k_square(s);
  float w = s.size.x / max(s.size.y, 1.0);
  vec3 col = vec3(0.0);
  float sc = min(1.4, 2.0 * w / lanterns_count);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    if (fi >= lanterns_count) break;
    float h = hash1(vec3(fi, s.id, 8.0));
    vec2 top = vec2((fi + 0.5) / lanterns_count * w, 1.0);
    float len = 0.1 + 0.25 * h;
    float a = 0.05 * sin(t * (0.8 + 0.3 * h) + fi * 2.0);
    vec2 p = (q - top) * k_rot(a) / sc + vec2(0.0, len + 0.17);
    col += vec3(0.6, 0.45, 0.2) * (1.0 - smoothstep(0.002, 0.005, abs(p.x) * sc)) * step(0.17, p.y) * step(p.y, len + 0.17);
    // the paper body: ribbed, glowing from inside, brightest in the middle
    float body = k_oval(p, vec2(0.17, 0.14));
    float rib = 0.75 + 0.25 * cos(p.x / sqrt(max(0.0196 - p.y * p.y * 0.75, 0.002)) * 6.0);
    float glow = smoothstep(0.17, 0.0, length(p * vec2(1.0, 1.2))) * k_flicker(t * 0.5, fi);
    col = mix(col, vec3(0.9, 0.08, 0.04) * rib * (0.45 + 0.75 * glow) + vec3(1.0, 0.6, 0.1) * 0.3 * glow, k_fill(body, 0.003));
    // gold caps and a tassel that swings
    float caps = min(k_box(p - vec2(0.0, 0.14), vec2(0.07, 0.015)), k_box(p - vec2(0.0, -0.14), vec2(0.07, 0.015)));
    col = mix(col, vec3(1.0, 0.75, 0.25), k_fill(caps, 0.003));
    vec2 tp = (p - vec2(0.0, -0.155)) * k_rot(-a * 3.0);
    float tassel = max(abs(tp.x) - 0.02 - 0.08 * max(-tp.y - 0.05, 0.0), max(tp.y, -0.2 - tp.y));
    col = mix(col, vec3(1.0, 0.7, 0.2) * (0.7 + 0.3 * sin(tp.x * 200.0)), k_fill(tassel, 0.003));
    col += vec3(1.0, 0.3, 0.05) * 0.15 * exp(-max(body, 0.0) * 12.0) * step(0.0, body);
  }
  return col;
}` },
  { id: 'diyas', name: 'Diyas', group: 'Celebrations', about: 'A row of little painted clay oil lamps, each with a flickering flame, for Diwali.', code: `
float diyas_count = 5.0; // param: How many, 1..9, whole
vec3 fx_diyas(Surf2 s, float t) {
  vec2 q = k_square(s);
  float w = s.size.x / max(s.size.y, 1.0);
  float sc = min(0.8, 1.33 * w / diyas_count);
  vec3 col = vec3(0.0);
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    if (fi >= diyas_count) break;
    vec2 p = (q - vec2((fi + 0.5) / diyas_count * w - 0.04 * sc, 0.05)) / sc;
    // the bowl: a shallow dish with a pinched spout on the right, painted with dots and a band
    float bowl = max(k_oval(p - vec2(0.0, 0.1), vec2(0.3, 0.16)), p.y - 0.12);
    bowl = min(bowl, max(k_oval(p - vec2(0.24, 0.12), vec2(0.12, 0.05)), p.y - 0.15));
    vec3 clay = vec3(0.7, 0.28, 0.1) * (0.6 + 0.4 * smoothstep(-0.05, 0.12, p.y));
    float band = step(abs(p.y - 0.03), 0.018);
    float dots = step(length(vec2(fract(p.x * 12.0) - 0.5, (p.y - 0.075) * 12.0)), 0.25);
    clay = mix(clay, vec3(1.0, 0.8, 0.1), band);
    clay = mix(clay, vec3(0.1, 0.7, 0.7), dots * step(abs(p.y - 0.075), 0.04));
    float fl = k_flicker(t, fi + s.id * 9.0);
    clay *= 0.65 + 0.35 * fl;
    col = mix(col, clay, k_fill(bowl, 0.006));
    // the flame at the spout
    vec2 f = p - vec2(0.3 + 0.01 * sin(t * 4.0 + fi), 0.24);
    float flame = k_oval(f, vec2(0.04 * (1.0 + 0.2 * (1.0 - fl)), 0.1 * fl));
    col = mix(col, mix(vec3(1.0, 0.55, 0.1), vec3(1.0, 0.95, 0.7), smoothstep(0.04, -0.05, f.y)) * fl, k_fill(flame, 0.006));
    col += vec3(1.0, 0.55, 0.15) * 0.35 * exp(-length(f) * 5.0) * fl;
  }
  return col;
}` },
  { id: 'rangoli', name: 'Rangoli', group: 'Celebrations', about: 'A rangoli pattern of petals and dots in bright powder colours for something round, its rings slowly turning.', code: `
float rangoli_speed = 0.2; // param: Speed, 0..1
vec3 fx_rangoli(Surf2 s, float t) {
  vec2 p = k_centred(s) * 1.05;
  float r = length(p), a = atan(p.y, p.x);
  vec3 col = vec3(0.0);
  // rings of petals, each ring turning the other way to the last
  for (int i = 0; i < 4; i++) {
    float fi = float(i), n = 6.0 + 4.0 * fi, R = 0.07 + 0.11 * fi;
    float sa = 6.2832 / n, aa = a + t * rangoli_speed * (mod(fi, 2.0) < 0.5 ? 1.0 : -1.0);
    float ka = mod(aa, sa) - sa * 0.5;
    vec2 lp = r * vec2(cos(ka), sin(ka)) - vec2(R, 0.0);
    float petal = k_oval(lp, vec2(0.05 + 0.012 * fi, 0.022 + 0.004 * fi * fi) * (1.0 + 0.4 * step(0.5, fi)));
    vec3 c = fi < 0.5 ? vec3(1.0, 0.85, 0.1) : fi < 1.5 ? vec3(1.0, 0.1, 0.5) : fi < 2.5 ? vec3(0.1, 0.75, 0.3) : vec3(1.0, 0.45, 0.05);
    col = mix(col, c, k_fill(petal, 0.004));
    col = mix(col, vec3(1.0), k_fill(abs(petal) - 0.003, 0.002));
    // a ring of dots between this ring and the next
    float da = mod(aa * 2.0, sa) - sa * 0.5;
    vec2 dp = r * vec2(cos(da), sin(da)) - vec2(R + 0.06, 0.0);
    col = mix(col, vec3(0.2, 0.5, 1.0), k_fill(length(dp) - 0.012, 0.003) * step(0.5, fi));
  }
  col = mix(col, vec3(1.0, 0.3, 0.1), k_fill(r - 0.035, 0.003));
  col += vec3(1.0) * step(0.985, hash2(floor(s.px / 2.0) + floor(t * 3.0))) * 0.5 * step(r, 0.48);
  return col;
}` },
  { id: 'eggs', name: 'Easter egg', group: 'Celebrations', about: 'A big painted Easter egg in pastel bands of zigzags, dots and stripes, slowly turning.', code: `
float eggs_speed = 0.4; // param: Speed, 0..2
vec3 fx_eggs(Surf2 s, float t) {
  vec2 p = k_centred(s) * 1.05;
  // the egg: narrower at the top
  float wx = 0.33 * (1.0 - 0.18 * p.y / 0.44);
  float d = (length(vec2(p.x / wx, p.y / 0.44)) - 1.0) * 0.3;
  if (d > 0.01) return vec3(0.0);
  // longitude round the egg, so the pattern seems to turn on a curved surface
  float u = asin(clamp(p.x / (wx * sqrt(max(1.0 - p.y * p.y / 0.1936, 0.001))), -1.0, 1.0)) + t * eggs_speed;
  float band = floor((p.y + 0.44) * 8.0), f = fract((p.y + 0.44) * 8.0);
  vec3 c = hsv(fract(band * 0.17 + 0.05), 0.35, 1.0);
  vec3 c2 = hsv(fract(band * 0.17 + 0.55), 0.6, 1.0);
  float kind = mod(band, 3.0), pat = 0.0;
  if (kind < 0.5) pat = step(abs(f - 0.5 - 0.3 * (abs(fract(u * 2.0) - 0.5) * 2.0 - 0.5)), 0.12);
  else if (kind < 1.5) pat = step(length(vec2(fract(u * 2.5) - 0.5, (f - 0.5) * 0.6)), 0.18);
  else pat = step(abs(f - 0.5), 0.15);
  vec3 col = mix(c, c2, pat);
  col = mix(col, vec3(1.0), step(f, 0.06));
  float lt = 0.55 + 0.45 * sqrt(max(1.0 - pow(p.x / wx, 2.0) - pow(p.y / 0.44, 2.0) * 0.3, 0.0));
  return col * lt * k_fill(d, 0.003) + vec3(1.0) * 0.4 * smoothstep(0.06, 0.0, length(p - vec2(-0.1, 0.18)));
}` },
  { id: 'shamrocks', name: 'Shamrocks', group: 'Celebrations', about: "Green shamrocks tumble down across the frame with flecks of gold, for St Patrick's Day.", code: `
float shamrocks_amount = 0.5; // param: How many, 0.1..1
float shamrocks_leaf(vec2 p) {
  // three heart-shaped leaves round a middle, and a stem
  float d = 1e3;
  for (int i = 0; i < 3; i++) {
    vec2 r = p * k_rot(float(i) * 2.0944);
    d = min(d, k_heart(r - vec2(0.0, 0.1), 0.2));
  }
  return min(d, k_seg(p, vec2(0.0), vec2(0.04, -0.2)) - 0.015);
}
vec3 fx_shamrocks(Surf2 s, float t) {
  vec2 q = k_frame(s);
  vec3 col = vec3(0.0);
  for (int l = 0; l < 2; l++) {
    float fl = float(l);
    vec2 m = q + vec2(0.03 * sin(t * 0.9 + q.y * 4.0 + fl), 0.0);
    vec3 d = k_drift(m, vec2(0.01, -0.05 - 0.03 * fl), 0.12 + 0.05 * fl, t, 4.0 + fl * 6.0);
    if (d.z < 1.0 - shamrocks_amount) continue;
    vec2 p = d.xy * k_rot(t * (0.6 + d.z) + d.z * 20.0) * 1.1;
    float sh = shamrocks_leaf(p);
    col = mix(col, vec3(0.1, 0.65, 0.2) * (0.6 + 0.4 * smoothstep(0.15, -0.1, p.x + p.y)) * (0.6 + 0.4 * fl), k_fill(sh, 0.012));
    vec3 g = k_drift(q, vec2(0.0, -0.03), 0.04, t, 9.0);
    col += vec3(1.0, 0.8, 0.3) * exp(-length(g.xy) * 40.0) * step(0.85, g.z) * (0.5 + 0.5 * sin(t * 6.0 + g.z * 40.0)) * 0.5;
  }
  return col;
}` },
  { id: 'countdown', name: 'Countdown', group: 'Celebrations', about: 'Big glowing digits count down a second at a time, then burst into colour, and start again. For New Year.', code: `
float countdown_from = 10.0; // param: Count from, 3..60, whole
vec3 countdown_colour = vec3(1.0, 0.8, 0.3); // param: Colour
float countdown_digit(vec2 p, float n) {
  // a seven-segment digit n, about 1 tall: each segment on or off from a code for the digit
  float code = n < 0.5 ? 63.0 : n < 1.5 ? 6.0 : n < 2.5 ? 91.0 : n < 3.5 ? 79.0 : n < 4.5 ? 102.0 : n < 5.5 ? 109.0 : n < 6.5 ? 125.0 : n < 7.5 ? 7.0 : n < 8.5 ? 127.0 : 111.0;
  float d = 1e3;
  for (int k = 0; k < 7; k++) {
    float fk = float(k);
    if (mod(floor(code / pow(2.0, fk)), 2.0) < 0.5) continue;
    vec2 a = fk < 0.5 ? vec2(-0.2, 0.45) : fk < 1.5 ? vec2(0.25, 0.4) : fk < 2.5 ? vec2(0.25, -0.05) : fk < 3.5 ? vec2(-0.2, -0.45) : fk < 4.5 ? vec2(-0.25, -0.05) : fk < 5.5 ? vec2(-0.25, 0.4) : vec2(-0.2, 0.0);
    vec2 b = fk < 0.5 ? vec2(0.2, 0.45) : fk < 1.5 ? vec2(0.25, 0.05) : fk < 2.5 ? vec2(0.25, -0.4) : fk < 3.5 ? vec2(0.2, -0.45) : fk < 4.5 ? vec2(-0.25, -0.4) : fk < 5.5 ? vec2(-0.25, 0.05) : vec2(0.2, 0.0);
    d = min(d, k_seg(p, a, b) - 0.05);
  }
  return d;
}
vec3 fx_countdown(Surf2 s, float t) {
  vec2 p = k_centred(s);
  float cycle = countdown_from + 6.0, ph = mod(t, cycle);
  float n = countdown_from - floor(ph), f = fract(ph);
  if (n > 0.5) {
    float sc = 0.55 * (1.0 + 0.12 * exp(-f * 6.0));
    vec2 q = p / sc;
    float tens = floor(n / 10.0), ones = n - tens * 10.0;
    float d = tens > 0.5 ? min(countdown_digit(q + vec2(0.36, 0.0), tens), countdown_digit(q - vec2(0.36, 0.0), ones)) : countdown_digit(q, ones);
    d *= sc;
    return countdown_colour * (k_fill(d, 0.004) * (0.75 + 0.25 * exp(-f * 4.0)) + 0.35 * k_glow(d, 0.02) * step(0.0, d));
  }
  // the burst: rings of colour rushing out, and sparkles
  float a = ph - countdown_from, r = length(p);
  vec3 col = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float fi = float(i), rr = (a - fi * 0.35) * 0.5;
    if (rr < 0.0) continue;
    col += hsv(fract(fi * 0.23 + 0.1), 0.8, 1.0) * exp(-abs(r - rr) * 40.0) * exp(-rr * 1.5);
  }
  vec3 sp = k_drift(p, vec2(0.0, -0.05), 0.06, t, 4.0);
  col += hsv(sp.z, 0.6, 1.0) * exp(-length(sp.xy) * 30.0) * step(0.6, sp.z) * smoothstep(6.0, 3.0, a);
  return col;
}` },
  candleLook({ id: 'menorah', name: 'Menorah', group: 'Celebrations', about: 'A golden menorah for Hanukkah: set the night, and the shamash and that many candles are lit, right to left.', lit: 8, max: 8, base: 0.42,
    candles: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ x: 0.1 + 0.1 * i, h: i === 4 ? 0.38 : 0.28, colour: 'vec3(0.75, 0.82, 1.0)', rank: i === 4 ? 0 : [7, 6, 5, 4, null, 3, 2, 1, 0][i] })),
    holder: `// the menorah: a foot, a stem, and a bar the candles stand on, with a cup under each
  float bar = k_box(q - vec2(0.5 * w, 0.405), vec2(0.42 * w, 0.012));
  float stem = k_box(q - vec2(0.5 * w, 0.22), vec2(0.015, 0.19));
  float foot = k_box(q - vec2(0.5 * w, 0.04), vec2(0.12, 0.02)) - 0.01;
  float cups = abs(fract((q.x / w - 0.05) * 10.0) - 0.5) * w * 0.1 - cw * 1.3;
  cups = max(cups, abs(q.y - 0.42) - 0.012);
  cups = max(cups, abs(q.x - 0.5 * w) - 0.41 * w);
  float m = min(min(bar, stem), min(foot, cups));
  col = gold * (0.55 + 0.45 * smoothstep(0.0, 0.42, q.y)) * k_fill(m, 0.002);` }),
  candleLook({ id: 'kinara', name: 'Kinara', group: 'Celebrations', about: 'A kinara for Kwanzaa: three red candles, a black one in the middle, three green. Set the day, and that many are lit.', lit: 7, max: 7, base: 0.2,
    candles: [0, 1, 2, 3, 4, 5, 6].map((i) => ({ x: 0.2 + 0.1 * i, h: i === 3 ? 0.44 : 0.38 - 0.03 * Math.abs(i - 3), colour: i < 3 ? 'vec3(0.85, 0.05, 0.05)' : i === 3 ? 'vec3(0.12, 0.12, 0.14)' : 'vec3(0.05, 0.6, 0.15)', rank: [5, 3, 1, 0, 2, 4, 6][i] })),
    holder: `// the wooden holder they stand in
  float wood = k_box(q - vec2(0.5 * w, 0.15), vec2(0.36 * w, 0.05)) - 0.01;
  col = vec3(0.4, 0.2, 0.08) * (0.7 + 0.3 * sin(q.x * 90.0 + 3.0 * noise(vec3(q * 20.0, 1.0)))) * k_fill(wood, 0.002);` }),
  { id: 'searchlights', name: 'Searchlights', group: 'Celebrations', about: 'Beams of light sweep the night sky from below, crossing and lighting up the clouds, like a premiere.', code: `
float searchlights_count = 4.0; // param: How many, 1..6, whole
vec3 searchlights_colour = vec3(0.85, 0.9, 1.0); // param: Colour
vec3 fx_searchlights(Surf2 s, float t) {
  vec2 q = k_frame(s);
  float aspect = uRes.x / uRes.y;
  vec3 col = mix(vec3(0.02, 0.03, 0.09), vec3(0.0, 0.0, 0.03), q.y);
  float clouds = 0.35 + 0.65 * smoothstep(0.35, 0.75, fbm(vec3(q * vec2(2.0, 4.0) - vec2(t * 0.02, 0.0), 1.0)));
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    if (fi >= searchlights_count) break;
    float h = hash1(vec3(fi, 4.0, 2.0));
    vec2 o = vec2(aspect * (fi + 0.5) / searchlights_count, -0.05);
    float a = 1.5708 + 0.55 * sin(t * 0.25 * (0.7 + 0.6 * h) + fi * 2.0);
    vec2 dir = vec2(cos(a), sin(a)), d = q - o;
    float along = dot(d, dir), across = abs(d.x * dir.y - d.y * dir.x);
    float width = 0.012 + along * 0.06;
    col += searchlights_colour * step(0.0, along) * exp(-pow(across / width, 2.0)) * exp(-along * 0.7) * clouds * 0.6;
  }
  return col;
}` },
  { id: 'crescent', name: 'Crescent and lanterns', group: 'Celebrations', about: 'A golden crescent moon and star in a night sky, with glowing lanterns of coloured glass hanging and swaying, for Ramadan and Eid.', code: `
float crescent_lanterns = 3.0; // param: Lanterns, 0..4, whole
vec3 fx_crescent(Surf2 s, float t) {
  vec2 q = k_square(s);
  float w = s.size.x / max(s.size.y, 1.0);
  vec3 col = mix(vec3(0.03, 0.05, 0.18), vec3(0.01, 0.01, 0.06), q.y);
  vec3 st = k_drift(q, vec2(0.0), 0.06, t, 5.0);
  col += vec3(0.9) * exp(-length(st.xy) * 40.0) * step(0.75, st.z) * (0.5 + 0.5 * sin(t * 2.0 + st.z * 40.0));
  vec3 gold = vec3(1.0, 0.8, 0.35);
  vec2 mc = vec2(w * 0.72, 0.68);
  float moon = max(k_circle(q - mc, 0.17), -k_circle(q - mc - vec2(0.07, 0.04), 0.15));
  col = mix(col, gold, k_fill(moon, 0.003)) + gold * 0.25 * k_glow(moon, 0.03) * step(0.0, moon);
  float star = k_star(q - mc - vec2(0.13, 0.03), 0.04, 0.45);
  col = mix(col, gold, k_fill(star, 0.003)) + gold * 0.3 * k_glow(star, 0.02) * step(0.0, star) * (0.7 + 0.3 * sin(t * 2.0));
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    if (fi >= crescent_lanterns) break;
    float h = hash1(vec3(fi, 2.0, s.id));
    vec2 top = vec2(w * (0.12 + 0.17 * fi), 1.0);
    float len = 0.12 + 0.25 * h, a = 0.06 * sin(t * (0.9 + 0.3 * h) + fi * 1.7);
    vec2 p = (q - top) * k_rot(a) + vec2(0.0, len + 0.12);
    col += gold * 0.5 * (1.0 - smoothstep(0.002, 0.004, abs(p.x))) * step(0.15, p.y) * step(p.y, len + 0.12);
    // a lantern: a dome, a body of coloured panes in a gold frame, a pointed foot
    float body = k_box(p, vec2(0.05, 0.07));
    float dome = k_tri(p, vec2(-0.06, 0.07), vec2(0.06, 0.07), vec2(0.0, 0.15));
    float foot = k_tri(p, vec2(-0.05, -0.07), vec2(0.05, -0.07), vec2(0.0, -0.12));
    vec3 glass = (p.x < 0.0 ? vec3(0.1, 0.6, 0.9) : vec3(0.95, 0.3, 0.6)) * mix(1.0, 0.5, step(abs(p.y), 0.008));
    float fl = k_flicker(t, fi);
    col = mix(col, glass * (0.5 + 0.6 * fl) + vec3(1.0, 0.8, 0.4) * 0.3 * fl * smoothstep(0.05, 0.0, abs(p.x)), k_fill(body, 0.002));
    col = mix(col, gold * 0.8, k_fill(min(dome, foot), 0.002));
    col = mix(col, gold, k_fill(abs(body) - 0.004, 0.002) + k_fill(abs(p.x) - 0.003, 0.001) * step(abs(p.y), 0.07));
    col += vec3(1.0, 0.7, 0.3) * 0.12 * exp(-max(body, 0.0) * 15.0) * fl * step(0.0, body);
  }
  return col;
}` },
  { id: 'papel', name: 'Papel picado', group: 'Celebrations', about: 'Strings of bright cut-paper flags across the top, fluttering, for a fiesta or Day of the Dead.', code: `
float papel_rows = 2.0; // param: Rows, 1..3, whole
vec3 fx_papel(Surf2 s, float t) {
  vec2 q = k_square(s);
  float w = s.size.x / max(s.size.y, 1.0);
  vec3 col = vec3(0.0);
  for (int r = 0; r < 3; r++) {
    float fr = float(r);
    if (fr >= papel_rows) break;
    float y = 0.97 - fr * 0.3 - 0.05 * sin(3.1416 * q.x / w);
    float fw = 0.18, k = floor(q.x / fw + fr * 0.5);
    float fx = fract(q.x / fw + fr * 0.5) * fw - fw * 0.5, fy = y - q.y;
    fx += 0.012 * sin(t * 3.0 + k * 1.3 + fr) * fy * 5.0;
    col += vec3(0.8) * exp(-abs(fy) * 600.0) * 0.4;
    float flag = max(abs(fx) - fw * 0.42, max(-fy, fy - 0.2 + 0.012 * abs(sin(fx * 70.0))));
    // what is cut out: a flower in the middle, diamonds along the top and bottom
    vec2 c = vec2(fx, fy - 0.1);
    float pa = atan(c.y, c.x);
    float flower = length(c) - 0.03 - 0.015 * cos(pa * 6.0);
    float diamonds = (abs(fract(fx * 30.0) - 0.5) / 30.0 + abs(fy - 0.03)) - 0.01;
    diamonds = min(diamonds, (abs(fract(fx * 30.0) - 0.5) / 30.0 + abs(fy - 0.17)) - 0.01);
    float ring = abs(length(c) - 0.055) - 0.004;
    float holes = min(min(flower, diamonds), ring);
    vec3 pc = hsv(fract(k * 0.21 + fr * 0.37), 0.85, 1.0) * (0.8 + 0.2 * sin(fx * 40.0 + t));
    col = mix(col, pc, k_fill(flag, 0.002) * (1.0 - k_fill(holes, 0.002)));
  }
  return col;
}` },
  { id: 'sugarskull', name: 'Sugar skull', group: 'Celebrations', about: 'A decorated sugar skull for something round, with flowers round its eyes, for Día de los Muertos. Its colours slowly shift.', code: `
${skull('sugarskull')}
vec3 fx_sugarskull(Surf2 s, float t) {
  vec2 p = k_centred(s) * 1.05;
  vec3 sk = sugarskull_skull(p / 1.05) * 1.05;
  float shift = t * 0.03;
  vec3 col = vec3(0.95, 0.93, 0.88) * k_fill(sk.x, 0.004);
  // flowers of petals round each eye, the eyes themselves dark with a coloured glint
  vec2 m = vec2(abs(p.x), p.y);
  vec2 e = m - vec2(0.147, 0.021);
  float er = length(e), ea = atan(e.y, e.x);
  float petals = er - 0.15 - 0.025 * cos(ea * 8.0);
  vec3 pc = hsv(fract(shift + (p.x < 0.0 ? 0.55 : 0.85)), 0.8, 1.0);
  col = mix(col, pc, k_fill(petals, 0.004) * k_fill(sk.x, 0.004));
  col = mix(col, vec3(0.03), k_fill(sk.z * 1.05 + 0.005, 0.004));
  col += hsv(fract(shift + 0.1), 0.6, 1.0) * k_fill(length(e - vec2(0.02, 0.02)) - 0.02, 0.004) * 0.8;
  // a flower on the forehead, a heart for a nose, dots on the cheeks, a stitched smile
  vec2 f = p - vec2(0.0, 0.33);
  float fa = atan(f.y, f.x);
  col = mix(col, hsv(fract(shift + 0.05), 0.85, 1.0), k_fill(length(f) - 0.07 - 0.025 * cos(fa * 6.0), 0.004));
  col = mix(col, vec3(1.0, 0.85, 0.1), k_fill(length(f) - 0.03, 0.003));
  col = mix(col, hsv(fract(shift + 0.95), 0.85, 0.9), k_fill(k_heart(vec2(p.x, -p.y - 0.12), 0.09), 0.003));
  vec2 ck = m - vec2(0.25, -0.13);
  col = mix(col, hsv(fract(shift + 0.35), 0.8, 1.0), k_fill(length(vec2(fract(atan(ck.y, ck.x) / 6.2832 * 8.0) - 0.5, (length(ck) - 0.05) * 20.0)) - 0.25, 0.05) * k_fill(sk.x, 0.004));
  col = mix(col, vec3(0.05), k_fill(sk.y * 1.05, 0.003) * step(p.y, -0.15) * k_fill(sk.x, 0.004));
  col = mix(col, vec3(0.05), k_fill(abs(p.y + 0.27) - 0.004, 0.002) * step(abs(p.x), 0.16));
  return col;
}` },
];
