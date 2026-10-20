// The built-in looks, in Node: the mistakes that are easy to make when adding one (docs/looks.md), caught before a
// browser compiles anything. Each look has an id, name, a group the tray knows and a description, and defines
// fx_<id>; no two looks (or a look and the kit) define the same helper, since the renderer compiles the looks in use
// into one shader; and nothing that GLSL ES 1.00 (the ISF export's dialect) rejects. The browser side (isf.e2e)
// compiles every look, alone as ISF and all together in the app.
import { EFFECTS, LOOK_GROUPS, movesToMusic, flowsAcross } from '../app/src/effects.js';
import { SURF_API } from '../app/src/renderer.js';
import { KIT, kitSummary } from '../app/src/effects/kit.js';
import { reporter } from './serve.mjs';

const FN = /^(?:float|int|bool|void|vec[234]|mat[234])\s+(\w+)\s*\(/gm;
// words GLSL ES 1.00 or 3.00 reserve, that read like ordinary variable names
const RESERVED = ['input', 'output', 'sample', 'half', 'fixed', 'filter', 'active', 'common', 'smooth', 'flat', 'patch', 'partition', 'long', 'short', 'double', 'cast', 'union', 'class', 'public', 'static', 'template', 'this', 'namespace', 'using', 'interface', 'external', 'superp', 'centroid', 'invariant', 'precise', 'packed', 'goto', 'inline', 'noinline', 'volatile', 'enum', 'typedef', 'sizeof', 'asm'];
// GLSL ES 3.00 only: an operator and built-ins an ISF host's ES 1.00 compiler doesn't have
const ES3_ONLY = /%|\bround\s*\(|\btrunc\s*\(|\btanh\s*\(|\bsinh\s*\(|\bcosh\s*\(|\bisnan\s*\(|\binverse\s*\(|\btexture\s*\(|\buint\b|\btexelFetch\b/;

export default function run() {
  const t = reporter('effects');
  const ids = EFFECTS.map((e) => e.id);
  t.ok(new Set(ids).size === ids.length, `${ids.length} looks, each with its own id`);
  const bad = EFFECTS.filter((e) => !/^[a-z][a-z0-9]*$/.test(e.id) || !e.name || !e.about || !LOOK_GROUPS.includes(e.group));
  t.ok(!bad.length, 'every look has a short lower-case id, a name, a description and one of the tray\'s groups' + (bad.length ? ': ' + bad.map((e) => e.id).join(', ') : ''));
  const noFx = EFFECTS.filter((e) => (e.code.match(new RegExp(`\\bvec3 fx_${e.id}\\(Surf2 s, float t\\)`, 'g')) || []).length !== 1);
  t.ok(!noFx.length, 'every look defines vec3 fx_<id>(Surf2 s, float t) once' + (noFx.length ? ': not ' + noFx.map((e) => e.id).join(', ') : ''));

  // helpers: every name defined once across the kit, SURF_API and all the looks
  const owner = new Map(), clashes = [];
  for (const n of SURF_API.matchAll(FN)) owner.set(n[1], 'SURF_API');
  for (const e of EFFECTS) for (const n of e.code.matchAll(FN)) {
    if (owner.has(n[1])) clashes.push(`${n[1]} (${e.id} and ${owner.get(n[1])})`); else owner.set(n[1], e.id);
  }
  t.ok(!clashes.length, 'no two looks, or a look and the kit, define the same function' + (clashes.length ? ': ' + clashes.join(', ') : ''));
  const kitNames = EFFECTS.filter((e) => [...e.code.matchAll(FN)].some((n) => n[1].startsWith('k_')));
  t.ok(!kitNames.length, 'k_ names are left to the kit' + (kitNames.length ? ': ' + kitNames.map((e) => e.id).join(', ') : ''));
  const prefixed = EFFECTS.filter((e) => [...e.code.matchAll(FN)].some((n) => n[1] !== 'fx_' + e.id && !n[1].startsWith(e.id + '_') && !['bat_shape'].includes(n[1])));
  t.ok(!prefixed.length, 'a look\'s helpers are named <id>_something' + (prefixed.length ? ': ' + prefixed.map((e) => e.id).join(', ') : ''));

  // GLSL ES 1.00
  const es3 = EFFECTS.filter((e) => ES3_ONLY.test(e.code)).map((e) => e.id).concat(ES3_ONLY.test(KIT) ? ['the kit'] : []);
  t.ok(!es3.length, 'no %, round(), uint or other GLSL ES 3.00-only code (ISF hosts compile ES 1.00)' + (es3.length ? ': ' + es3.join(', ') : ''));
  const reserved = [];
  for (const e of EFFECTS.concat([{ id: 'the kit', code: KIT }])) {
    const w = RESERVED.find((r) => new RegExp(`\\b${r}\\b`).test(e.code.replace(/\/\/.*$/gm, '')));
    if (w) reserved.push(`${e.id} (${w})`);
  }
  t.ok(!reserved.length, 'no reserved words as names' + (reserved.length ? ': ' + reserved.join(', ') : ''));

  // the kit documents itself for the AI prompt
  const kitFns = [...KIT.matchAll(FN)].map((n) => n[1]);
  t.ok(kitFns.every((n) => n.startsWith('k_')) && kitSummary().split('\n').length === kitFns.length, `every kit function is named k_ and has a comment for the AI prompt (${kitFns.length})`);

  // the tray's badges see through the kit
  t.ok(movesToMusic('return vec3(k_pulse(t, 90.0));') && flowsAcross('vec2 q = k_frame(s);') && !flowsAcross('vec2 q = k_square(s);'), 'the ♪ and ⇆ badges count k_pulse/k_level and k_frame');
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = run() ? 1 : 0;
