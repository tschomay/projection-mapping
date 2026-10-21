// ISF export and import (roadmap #10), in Node: the file an effect exports to, and how an ISF generator is turned
// into an effect (names made safe, inputs fixed at their defaults, what's refused). The browser suite isf.e2e
// compiles and renders the results.
import { readFile } from 'node:fs/promises';
import { reporter } from './serve.mjs';
import { toISF, fromISF, isfFilename } from '../app/src/isf.js';
import { parseParams } from '../app/src/params.js';
import { EFFECTS } from '../app/src/effects.js';

export default async function run() {
  const t = reporter('isf');
  const fixture = await readFile(new URL('./fixtures/rings.fs', import.meta.url), 'utf8');

  // export
  const plasma = EFFECTS.find((e) => e.id === 'plasma');
  const fs = toISF(plasma);
  const header = JSON.parse(fs.match(/^\/\*([\s\S]*?)\*\//)[1]);
  t.ok(header.ISFVSN === '2' && header.CATEGORIES.includes('Generator'), 'an exported effect has an ISF 2 generator header');
  const names = header.INPUTS.map((i) => i.NAME);
  t.ok(['audioBass', 'audioMid', 'audioTreble', 'audioLevel', 'audioBeat', 'hasAudio'].every((n) => names.includes(n)), 'the music levels become ISF inputs');
  t.ok(/void main\(\)/.test(fs) && /fx_plasma\(s, TIME\)/.test(fs) && /isf_FragNormCoord/.test(fs) && /gl_FragColor/.test(fs), 'main() calls the effect with ISF\'s TIME and coordinates');
  t.ok(!/uniform |#version|outColor/.test(fs), 'no app-only declarations (the host declares the uniforms)');
  const own = toISF({ id: 'u12ab', name: 'Blue / waves', prompt: 'slow blue waves', code: 'float c_wave(float x) { return sin(x); }\nvec3 fx_custom(Surf2 s, float t) { return vec3(0.0, 0.0, c_wave(t)); }' });
  t.ok(/fx_u12ab\(s, TIME\)/.test(own) && /cu12ab_wave/.test(own) && !/fx_custom/.test(own), "a project's own effect is exported with its names made unique");
  t.ok(JSON.parse(own.match(/^\/\*([\s\S]*?)\*\//)[1]).DESCRIPTION === 'slow blue waves', 'its description is what was asked for');
  t.ok(isfFilename('Blue / waves') === 'Blue-waves.fs', 'file names are safe');

  // import
  const imp = fromISF(fixture, 'rings.fs');
  t.ok(imp.name === 'Rings' && imp.inputs === 5, 'the header is read, trailing comma and all');
  const code = imp.code;
  t.ok(/vec3 fx_custom\(Surf2 s, float t\)/.test(code) && /c_main\(\);/.test(code), 'the generator is wrapped as an effect that runs its main()');
  t.ok(/vec4 c_in_solid = vec4\(0\.2, 0\.8, 0\.4, 1\.0\); \/\/ param: solid$/m.test(code) && /bool c_in_showSolid = true; \/\/ param: showSolid, toggle/.test(code) &&
    /int c_in_count = 3; \/\/ param: count, choice: one=1\|three=3\|five=5/.test(code) && /float c_in_speed = 0\.5; \/\/ param: speed, 0\.\.2/.test(code), 'inputs become settings (float, color, bool, long)');
  t.ok(/const vec2 c_in_center = vec2\(0\.5, 0\.5\);/.test(code), 'and a point2D stays fixed at its default');
  const ps = parseParams(code);
  t.ok(ps.map((p) => p.kind).join() === 'range,colour,toggle,choice' && ps[3].options.map((o) => o.value).join() === '1,3,5', `the settings read back as a range, a colour, a toggle and a choice of 1, 3, 5`);

  // settings round-trip: out as inputs with the surface's values, back as settings with those as defaults
  const look = { id: 'tst', name: 'Test', code: 'float tst_speed = 1.0; // param: Speed, 0.2..3\nvec3 tst_colour = vec3(1.0, 0.5, 0.0); // param: Colour\nbool tst_on = true; // param: On, toggle\nint tst_shape = 0; // param: Shape, choice: A|B|C\nvec3 fx_tst(Surf2 s, float t) { return tst_on && tst_shape > 0 ? tst_colour * tst_speed * uAudio.x : vec3(uBeat); }' };
  const out = toISF(look, { tst_speed: 2.5, tst_shape: 2 }), head = JSON.parse(out.match(/^\/\*([\s\S]*?)\*\//)[1]);
  const byName = Object.fromEntries(head.INPUTS.map((i) => [i.NAME, i]));
  t.ok(byName.tst_speed?.DEFAULT === 2.5 && byName.tst_speed.MIN === 0.2 && byName.tst_colour_rgba?.TYPE === 'color' && byName.tst_on?.TYPE === 'bool' && byName.tst_shape?.TYPE === 'long' && byName.tst_shape.DEFAULT === 2,
    'settings are exported as ISF inputs, with the surface\'s values as defaults');
  t.ok(!/float tst_speed = /.test(out) && /#define tst_colour tst_colour_rgba\.rgb/.test(out), 'the inputs stand in for the globals (a colour through a macro)');
  const again = parseParams(fromISF(out, 'Test.fs').code);
  t.ok(again.map((p) => `${p.kind}:${p.label}`).join() === 'range:Speed,colour:Colour,toggle:On,choice:Shape' && again[0].def === 2.5 && again[3].def === 2,
    `and come back as the same settings with those values (${again.map((p) => p.label).join(', ')})`);
  const backCode = fromISF(out, 'Test.fs').code;
  t.ok(/uAudio\.x/.test(backCode) && /uBeat/.test(backCode) && !/c_in_audio/.test(backCode), "the app's own music inputs are wired to the live music again, not made settings");
  t.ok(/float c_noise\(vec2 p\)/.test(code) && /c_ring\(/.test(code) && /#define c_TAU/.test(code) && /const float c_pi/.test(code), 'its functions, constants and macros are renamed so they can\'t collide');
  t.ok(!/distance \(vec2 a/.test(code) && !/GL_ES/.test(code), 'desktop-only code behind #ifndef GL_ES is left out');
  t.ok(/float c_kw_sample = /.test(code), 'a name GLSL ES 3.00 reserves is renamed');
  t.ok(!/\b(gl_FragColor|gl_FragCoord|isf_FragNormCoord|TIME|RENDERSIZE)\b/.test(code), "ISF's built-ins are all replaced");

  const refuse = (text, re, msg) => { try { fromISF(text, 'x.fs'); t.ok(false, msg + ' (not refused)'); } catch (e) { t.ok(re.test(e.message), `${msg}: "${e.message}"`); } };
  refuse('void main() { gl_FragColor = vec4(1.0); }', /JSON header/, 'a file without a header is refused');
  refuse('/*{ "INPUTS": [{ "NAME": "inputImage", "TYPE": "image" }] }*/ void main() { gl_FragColor = IMG_THIS_PIXEL(inputImage); }', /image input/, 'a filter with an image input is refused');
  refuse('/*{ "INPUTS": [], "PASSES": [{ "TARGET": "buf", "PERSISTENT": true }, {}] }*/ void main() { gl_FragColor = vec4(1.0); }', /several passes/, 'a multi-pass shader is refused');
  refuse('/*{ "INPUTS": [{ "NAME": "fft", "TYPE": "audioFFT" }] }*/ void main() { gl_FragColor = vec4(1.0); }', /audioFFT/, 'an audio input is refused');

  // round trip: an exported effect imports again (it's an ISF generator like any other)
  const back = fromISF(toISF(EFFECTS.find((e) => e.id === 'bats')), 'Bats.fs');
  t.ok(/c_Surf2/.test(back.code) && /cfx_bats|c_fx_bats/.test(back.code), 'an exported effect imports back, its Surf2 and helpers renamed');
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
