// ISF (Interactive Shader Format, https://isf.video), roadmap #10: GLSL with a JSON header, loaded by MadMapper,
// VDMX, Resolume (through Wire), Synesthesia and others.
// - Export: any effect as an ISF generator (.fs). The effect code goes in unchanged, behind a small adapter
//   that builds Surf2 from ISF's built-ins; the music levels become ISF inputs a host can drive.
// - Import: an ISF generator (no image or audio inputs, one pass) becomes an effect in the project. Its inputs
//   are fixed at their defaults, and the whole surface is its canvas.
import { SURF_API } from './renderer.js';
import { EFFECTS } from './effects.js';
import { namespaced } from './ai.js';

// the music levels an exported effect reads; a host can wire these to its own audio analysis
const AUDIO_INPUTS = [
  { NAME: 'audioBass', LABEL: 'Bass', TYPE: 'float', DEFAULT: 0, MIN: 0, MAX: 1 },
  { NAME: 'audioMid', LABEL: 'Mid', TYPE: 'float', DEFAULT: 0, MIN: 0, MAX: 1 },
  { NAME: 'audioTreble', LABEL: 'Treble', TYPE: 'float', DEFAULT: 0, MIN: 0, MAX: 1 },
  { NAME: 'audioLevel', LABEL: 'Level', TYPE: 'float', DEFAULT: 0, MIN: 0, MAX: 1 },
  { NAME: 'audioBeat', LABEL: 'Beat pulse', TYPE: 'float', DEFAULT: 0, MIN: 0, MAX: 1 },
  { NAME: 'audioBeatCount', LABEL: 'Beats so far', TYPE: 'float', DEFAULT: 0, MIN: 0, MAX: 10000 },
  { NAME: 'hasAudio', LABEL: 'Music is playing', TYPE: 'bool', DEFAULT: false },
  { NAME: 'surfaceId', LABEL: 'Surface number', TYPE: 'float', DEFAULT: 0, MIN: 0, MAX: 15 },
  { NAME: 'surfaceCount', LABEL: 'Surfaces', TYPE: 'float', DEFAULT: 1, MIN: 1, MAX: 16 },
];

// effect: a built-in ({ id, name, code } with fx_<id>) or one of the project's own ({ id, name, code, prompt }
// with fx_custom). Returns the .fs file's text.
export function toISF(effect) {
  const builtin = EFFECTS.some((e) => e.id === effect.id && e.code === effect.code);
  const code = builtin ? effect.code : namespaced(effect.id, effect.code);
  const header = {
    DESCRIPTION: effect.prompt || effect.name,
    CREDIT: 'Surface Mapper',
    ISFVSN: '2',
    CATEGORIES: ['Generator'],
    INPUTS: AUDIO_INPUTS,
  };
  return `/*${JSON.stringify(header, null, 2)}*/

// "${effect.name.replace(/[\r\n]/g, ' ')}", exported from Surface Mapper as an ISF generator.
// The output is the surface: uv and screen are both the normalised canvas (isf_FragNormCoord), edge is the
// distance to the canvas border, and the audio and surface inputs above stand in for the app's own values.

#define uRes RENDERSIZE
#define uAudio vec4(audioBass, audioMid, audioTreble, audioLevel)
#define uBeat audioBeat
#define uBeats audioBeatCount
#define uHasAudio (hasAudio ? 1.0 : 0.0)
${SURF_API}
${code.trim()}

void main() {
  Surf2 s;
  s.uv = isf_FragNormCoord.xy;
  s.screen = isf_FragNormCoord.xy;
  s.px = vec2(gl_FragCoord.x, RENDERSIZE.y - gl_FragCoord.y);
  s.id = surfaceId;
  s.count = surfaceCount;
  s.edge = min(min(gl_FragCoord.x, RENDERSIZE.x - gl_FragCoord.x), min(gl_FragCoord.y, RENDERSIZE.y - gl_FragCoord.y));
  s.size = RENDERSIZE;
  gl_FragColor = vec4(clamp(fx_${effect.id}(s, TIME), 0.0, 1.0), 1.0);
}
`;
}

export const isfFilename = (name) => (name || 'effect').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) + '.fs';

// ---- import ----
const TYPES = 'float|int|bool|vec[234]|ivec[234]|bvec[234]|mat[234](?:x[234])?|void';
const DECL = new RegExp(`^(?:(?:const|highp|mediump|lowp|uniform|in|out|varying|flat|smooth)\\s+)*(${TYPES}|\\w+)\\s+(.*)$`, 's');
const literal = (type, v) => {
  const f = (x) => { const n = Number(x) || 0; return Number.isInteger(n) ? n.toFixed(1) : String(n); };
  if (type === 'bool' || type === 'event') return v ? 'true' : 'false';
  if (type === 'long') return String(Math.round(Number(Array.isArray(v) ? v[0] : v) || 0));
  if (type === 'color') { const c = Array.isArray(v) ? v : [0, 0, 0, 1]; return `vec4(${[0, 1, 2, 3].map((i) => f(c[i] ?? (i === 3 ? 1 : 0))).join(', ')})`; }
  if (type === 'point2D') { const p = Array.isArray(v) ? v : [0, 0]; return `vec2(${f(p[0])}, ${f(p[1])})`; }
  return f(v);
};
const GLSL_TYPE = { float: 'float', bool: 'bool', event: 'bool', long: 'int', color: 'vec4', point2D: 'vec2' };

// the ISF header: the first /* */ comment, JSON (tolerating trailing commas, which some files have)
function readHeader(text) {
  const m = text.match(/^\s*\/\*([\s\S]*?)\*\//);
  if (!m) throw new Error("That isn't an ISF file: it doesn't start with the JSON header comment.");
  let json;
  try { json = JSON.parse(m[1].replace(/,(\s*[}\]])/g, '$1')); } catch { throw new Error("That ISF file's header isn't valid JSON."); }
  return { header: json, body: text.slice(m[0].length) };
}

// split top-level code (outside any braces) into statements, and find each one's declared names
function topLevelNames(body) {
  const names = new Set();
  let depth = 0, paren = 0, stmt = '';
  const flush = () => {
    const st = stmt.trim(); stmt = '';
    if (!st || st.startsWith('#')) return;
    const struct = st.match(/^struct\s+(\w+)/);
    if (struct) { names.add(struct[1]); return; }
    const d = st.match(DECL);
    if (!d) return;
    // "float a = 1.0, b[2]" or "vec3 f(float x)": the leading name of each comma-separated part
    let level = 0, part = '';
    const parts = [];
    for (const ch of d[2]) {
      if (ch === '(' || ch === '[') level++;
      if (ch === ')' || ch === ']') level--;
      if (ch === ',' && level === 0) { parts.push(part); part = ''; } else part += ch;
    }
    parts.push(part);
    for (const p of parts) { const n = p.trim().match(/^(\w+)/); if (n) names.add(n[1]); }
  };
  for (const line of body.split('\n')) {
    if (depth === 0 && /^\s*#/.test(line)) continue;   // preprocessor lines are handled separately
    for (const ch of line + '\n') {
      if (ch === '{') { if (depth === 0 && paren === 0) flush(); depth++; continue; }
      if (ch === '}') { depth--; if (depth === 0) stmt = ''; continue; }
      if (depth > 0) continue;
      if (ch === '(') paren++;
      if (ch === ')') paren--;
      if (ch === ';' && paren === 0) { flush(); continue; }
      stmt += ch;
    }
  }
  return names;
}

const RESERVED = ['sample', 'input', 'output', 'filter', 'active', 'common', 'partition', 'half', 'fixed', 'long', 'short', 'double', 'union', 'enum', 'class', 'template', 'this', 'inline', 'interface', 'external', 'extern', 'public', 'static', 'resource', 'patch', 'cast', 'namespace', 'using', 'goto', 'asm', 'superp'];
// ISF files often keep desktop-only code behind #ifndef GL_ES; resolve those blocks here (GL_ES is defined in
// the app), so a name defined only for desktops isn't renamed as if it existed. Other directives stay as they are.
function resolveGLES(body) {
  const out = [], stack = [];   // per open #if: { gl: true when it tests GL_ES, keep, taken }
  const live = () => stack.every((f) => !f.gl || f.keep);
  for (const line of body.split('\n')) {
    const d = line.match(/^\s*#\s*(ifdef|ifndef|if|elif|else|endif)\b(.*)$/);
    if (!d) { if (live()) out.push(line); continue; }
    const [, kw, rest] = d, test = rest.trim();
    const gl = /^(GL_ES|defined\s*\(?\s*GL_ES\s*\)?)$/.test(test) ? true : /^!\s*defined\s*\(?\s*GL_ES\s*\)?$/.test(test) ? false : null;
    if (kw === 'ifdef' || kw === 'ifndef' || kw === 'if') {
      if (gl === null) { stack.push({ gl: false }); if (live()) out.push(line); continue; }
      const keep = kw === 'ifndef' ? !gl : gl;
      stack.push({ gl: true, keep, taken: keep });
    } else if (kw === 'else' || kw === 'elif') {
      const f = stack[stack.length - 1];
      if (!f || !f.gl) { if (live()) out.push(line); continue; }
      f.keep = !f.taken && (kw === 'else' || gl === true); f.taken ||= f.keep;
    } else {
      const f = stack.pop();
      if (f && !f.gl && live()) out.push(line);
    }
  }
  return out.join('\n');
}

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, '');

// text of an ISF .fs file -> { name, code } with code defining fx_custom (the same form as AI-written effects,
// so it's namespaced per effect when compiled). Throws with a plain-words reason when it can't be used.
export function fromISF(text, filename = 'ISF effect') {
  const { header, body: raw } = readHeader(text);
  const inputs = Array.isArray(header.INPUTS) ? header.INPUTS : [];
  const unsupported = inputs.filter((i) => !GLSL_TYPE[i.TYPE]);
  if (unsupported.length) throw new Error(`"${filename}" needs ${unsupported.map((i) => `${i.TYPE} input "${i.NAME}"`).join(', ')}. Only generators (no image or audio inputs) can be imported for now.`);
  if (Array.isArray(header.PASSES) && (header.PASSES.length > 1 || header.PASSES.some((p) => p.TARGET))) throw new Error(`"${filename}" renders in several passes, which can't be imported yet.`);
  if (header.IMPORTED && Object.keys(header.IMPORTED).length) throw new Error(`"${filename}" uses image files of its own, which can't be imported yet.`);
  let body = resolveGLES(stripComments(raw));
  if (/\b(IMG_PIXEL|IMG_NORM_PIXEL|IMG_THIS_PIXEL|IMG_THIS_NORM_PIXEL|IMG_SIZE|texture2D|texture)\s*\(/.test(body)) throw new Error(`"${filename}" reads images, which can't be imported yet.`);
  if (!/\bvoid\s+main\s*\(/.test(body)) throw new Error(`"${filename}" has no main() function.`);
  // lines that only make sense at the top of a whole shader
  body = body.replace(/^\s*#\s*(version|extension)\b[^\n]*$/gm, '').replace(/^\s*precision\s+\w+\s+\w+\s*;/gm, '');

  // everything the file declares at the top level, its macros, and ISF's built-ins get c_ names, which the app
  // makes unique per effect (namespaced in ai.js), so two imported effects never collide with each other or the app
  const rename = new Map();
  for (const n of topLevelNames(body)) rename.set(n, 'c_' + n);
  for (const m of body.matchAll(/^\s*#\s*define\s+(\w+)/gm)) rename.set(m[1], 'c_' + m[1]);
  for (const i of inputs) rename.set(i.NAME, 'c_in_' + i.NAME);
  // words GLSL ES 3.00 reserves that older ISF files use as names
  for (const w of RESERVED) if (!rename.has(w)) rename.set(w, 'c_kw_' + w);
  const builtins = { gl_FragColor: 'c_out', gl_FragCoord: 'c_coord', isf_FragNormCoord: 'c_norm', TIME: 'c_time', RENDERSIZE: 'c_size', TIMEDELTA: '(1.0 / 60.0)', FRAMEINDEX: 'int(c_time * 60.0)', PASSINDEX: '0', DATE: 'vec4(0.0, 0.0, 0.0, c_time)' };
  for (const [k, v] of Object.entries(builtins)) rename.set(k, v);
  if (rename.size) {
    const re = new RegExp(`(?<![.\\w])(${[...rename.keys()].join('|')})\\b`, 'g');
    body = body.replace(re, (n) => rename.get(n));
  }
  const consts = inputs.map((i) => `const ${GLSL_TYPE[i.TYPE]} c_in_${i.NAME} = ${literal(i.TYPE, i.DEFAULT ?? (i.TYPE === 'float' ? i.MIN ?? 0 : 0))};`).join('\n');
  const code = `// imported from the ISF file "${filename.replace(/[\r\n]/g, ' ')}"${header.CREDIT ? ', ' + (/^by\b/i.test(header.CREDIT) ? '' : 'by ') + String(header.CREDIT).replace(/[\r\n]/g, ' ') : ''}
vec2 c_norm; vec4 c_coord; vec2 c_size; float c_time; vec4 c_out;
${consts}
${body.trim()}

vec3 fx_custom(Surf2 s, float t) {
  // the surface is the ISF canvas: normalised coordinates from its corners, pixels from its size
  c_size = max(s.size, vec2(1.0));
  c_norm = s.uv;
  c_coord = vec4(s.uv * c_size, 0.0, 1.0);
  c_time = t;
  c_out = vec4(0.0);
  c_main();
  return c_out.rgb * clamp(c_out.a, 0.0, 1.0);
}`;
  const base = filename.replace(/\.(fs|frag|glsl|txt)$/i, '');
  const name = (typeof header.DESCRIPTION === 'string' && header.DESCRIPTION.length <= 28 && header.DESCRIPTION) || base;
  return { name, code, inputs: inputs.length };
}
