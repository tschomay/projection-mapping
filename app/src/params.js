// Effect settings (roadmap #42). A look declares each setting in its own GLSL, as a global with its default and a
// "// param:" comment, so the code still runs as it is anywhere (the tray's previews, an ISF host) with the defaults:
//   vec3 blood_colour = vec3(0.6, 0.0, 0.02);   // param: Colour
//   float bats_speed = 1.0;                     // param: Speed, 0.2..3
//   float ghosts_count = 5.0;                   // param: How many, 1..5, whole
//   bool window_walker = true;                  // param: Someone walks past, toggle
//   int pumpkin_face = 0;                       // param: Face, choice: Each its own=0|Triangles=1|Angry=2|Round=3
// float and int ranges, bool toggles, int choices (Label=value, values 0, 1, 2… when left out) and vec3/vec4 colours.
// A surface keeps its values in content.params, by name; the renderer gets them as one row of texels per surface
// (paramRow) and sets the globals before calling the look (assignGLSL). The code never assigns them itself.
export const MAX_PARAMS = 8;

const LINE = /^[ \t]*(float|int|bool|vec3|vec4)\s+(\w+)\s*=\s*([^;]+);[ \t]*\/\/\s*param:\s*(.*)$/gm;
const num = (s) => Number(String(s).trim());

function literal(type, text) {
  text = text.trim();
  if (type === 'bool') return text === 'true';
  if (type === 'vec3' || type === 'vec4') {
    const n = type === 'vec3' ? 3 : 4, m = text.match(/^vec[34]\s*\(([^)]*)\)$/);
    const parts = m ? m[1].split(',').map(num) : [0];
    return Array.from({ length: n }, (_, i) => (parts.length === 1 ? parts[0] : parts[i] ?? (i === 3 ? 1 : 0)));
  }
  return num(text);
}

const cache = new Map();
// code -> [{ name, type, kind ('range' | 'toggle' | 'choice' | 'colour'), label, def, min, max, step, options }]
export function parseParams(code) {
  if (cache.has(code)) return cache.get(code);
  const out = [];
  for (const m of code.matchAll(LINE)) {
    const [, type, name, init, comment] = m;
    const [label, ...rest] = comment.split(',').map((x) => x.trim());
    const p = { name, type, label: label || name, def: literal(type, init) };
    const choice = comment.match(/choice:\s*(.*)$/);
    if (type === 'vec3' || type === 'vec4') p.kind = 'colour';
    else if (type === 'bool') p.kind = 'toggle';
    else if (choice) {
      p.kind = 'choice';
      p.options = choice[1].split('|').map((o, i) => { const [l, v] = o.split('='); return { label: l.trim(), value: v === undefined ? i : num(v) }; });
    } else {
      p.kind = 'range';
      const r = rest.map((x) => x.match(/^(-?[\d.]+)\s*\.\.\s*(-?[\d.]+)$/)).find(Boolean);
      p.min = r ? num(r[1]) : Math.min(0, p.def); p.max = r ? num(r[2]) : Math.max(1, p.def);
      p.step = type === 'int' || rest.includes('whole') ? 1 : (p.max - p.min) / 100;
    }
    out.push(p);
  }
  cache.set(code, out);
  return out;
}

// one surface's values as texels: four floats per setting, in declaration order (defaults where none are kept)
export function paramRow(params, values = {}) {
  const row = new Float32Array(MAX_PARAMS * 4);
  params.slice(0, MAX_PARAMS).forEach((p, i) => {
    const v = values[p.name] ?? p.def;
    if (p.kind === 'colour') row.set(v.length === 3 ? [...v, 1] : v, i * 4);
    else row[i * 4] = p.kind === 'toggle' ? (v ? 1 : 0) : v;
  });
  return row;
}

// GLSL that sets a look's globals from its row of the uParams texture (row: an int expression)
export function assignGLSL(params, row) {
  return params.slice(0, MAX_PARAMS).map((p, i) => {
    const t = `texelFetch(uParams, ivec2(${i}, ${row}), 0)`;
    const v = p.type === 'vec3' ? `${t}.rgb` : p.type === 'vec4' ? t : p.type === 'bool' ? `${t}.x > 0.5` : p.type === 'int' ? `int(floor(${t}.x + 0.5))` : `${t}.x`;
    return `${p.name} = ${v};`;
  }).join(' ');
}

// the code with these values as its settings' defaults (the writer's settings, kept with the look itself)
export function withDefaults(code, values) {
  return code.replace(LINE, (line, type, name) => (values[name] === undefined ? line : line.replace(/=\s*[^;]+;/, `= ${glslLiteral(type, values[name])};`)));
}
const float = (x) => { const s = String(Math.round(Number(x) * 1e4) / 1e4); return /[.e]/.test(s) ? s : s + '.0'; };
function glslLiteral(type, v) {
  if (type === 'bool') return v ? 'true' : 'false';
  if (type === 'int') return String(Math.round(v));
  if (type === 'vec3' || type === 'vec4') return `${type}(${v.slice(0, type === 'vec3' ? 3 : 4).map(float).join(', ')})`;
  return float(v);
}

// colours as the colour picker wants them, and back
export const toHex = (c) => '#' + c.slice(0, 3).map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('');
export const fromHex = (h, alpha) => { const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); return alpha === undefined ? v : [...v, alpha]; };
