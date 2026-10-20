// A contact sheet of the built-in looks: each one drawn at a few moments, one row per look, saved as a PNG, so a new
// look can be checked by eye without a projector (or a phone). Uses the tests' Playwright (run `npm install` in tests/).
//   node tools/looks.mjs                          every look, to looks.png
//   node tools/looks.mjs pumpkin,window           just these
//   node tools/looks.mjs --group Fall             one group
//   node tools/looks.mjs --times 1,4,8 --music    at these seconds, with a pretend 120 bpm song playing
//   node tools/looks.mjs --circle --out x.png     on a round surface instead of a 16:10 rectangle
import { writeFileSync } from 'node:fs';
import { serveApp, loadPlaywright, BROWSER_ARGS } from '../tests/serve.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i < 0 ? def : args.splice(i, 2)[1]; };
const flag = (name) => { const i = args.indexOf(name); if (i >= 0) args.splice(i, 1); return i >= 0; };
const out = opt('--out', 'looks.png'), group = opt('--group', null);
const times = opt('--times', '2,5,9').split(',').map(Number);
const music = flag('--music'), circle = flag('--circle');
const only = args[0] ? args[0].split(',') : null;

const { chromium } = await loadPlaywright();
const server = await serveApp();
const browser = await chromium.launch({ args: BROWSER_ARGS });
try {
  const page = await browser.newPage();
  await page.goto(server.url.replace(/\?.*/, '') + 'manifest.webmanifest');
  const result = await page.evaluate(async ({ only, group, times, music, circle }) => {
    const { EFFECTS } = await import('/src/effects.js');
    const { SURF_API } = await import('/src/renderer.js');
    const { previewAudio } = await import('/src/thumbs.js');
    const looks = EFFECTS.filter((e) => (!only || only.includes(e.id)) && (!group || e.group === group));
    const TW = 320, TH = 200, LABEL = 150;
    const gl = new OffscreenCanvas(TW, TH).getContext('webgl2', { preserveDrawingBuffer: true });
    const sheet = new OffscreenCanvas(LABEL + TW * times.length, TH * looks.length);
    const g = sheet.getContext('2d');
    g.fillStyle = '#16181d'; g.fillRect(0, 0, sheet.width, sheet.height);
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const vs = sh(gl.VERTEX_SHADER, '#version 300 es\nin vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }');
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const errors = {};
    looks.forEach((e, row) => {
      // the same stand-in surface as the tray's previews (thumbs.js), optionally round
      const fs = sh(gl.FRAGMENT_SHADER, `#version 300 es
precision highp float; precision highp int;
uniform float uTime, uBeat, uBeats, uHasAudio; uniform vec2 uRes; uniform vec4 uAudio, uBox;
out vec4 outColor;
${SURF_API}
${e.code}
void main() {
  vec2 uv = (gl_FragCoord.xy - uBox.xy) / uBox.zw;
  Surf2 s; s.uv = uv; s.screen = uv; s.px = vec2(uv.x, 1.0 - uv.y) * uRes; s.id = 0.0; s.count = 1.0; s.size = uRes;
  s.edge = min(min(uv.x, 1.0 - uv.x) * uRes.x, min(uv.y, 1.0 - uv.y) * uRes.y);
  float inside = 1.0;
  if (${circle}) { float r = length((uv - 0.5) * uRes) / uRes.y; s.edge = max(0.5 - r, 0.0) * uRes.y; inside = step(r, 0.5); }
  outColor = vec4(clamp(fx_${e.id}(s, uTime), 0.0, 1.0) * inside, 1.0);
}`);
      const p = gl.createProgram();
      gl.attachShader(p, vs); gl.attachShader(p, fs); gl.bindAttribLocation(p, 0, 'position'); gl.linkProgram(p);
      g.fillStyle = '#e8e8ea'; g.font = '15px sans-serif'; g.fillText(e.name, 10, row * TH + 24);
      g.fillStyle = '#8a8f99'; g.font = '12px sans-serif'; g.fillText(`${e.id} · ${e.group}`, 10, row * TH + 44);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { errors[e.id] = gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(p); g.fillStyle = '#f66'; g.fillText('does not compile', 10, row * TH + 66); return; }
      gl.useProgram(p); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const u = (n) => gl.getUniformLocation(p, n);
      gl.uniform2f(u('uRes'), circle ? 400 : 640, 400);
      times.forEach((t, col) => {
        const a = music ? previewAudio(null, t) : { bass: 0, mid: 0, treble: 0, level: 0, beat: 0, beats: 0 };
        gl.uniform1f(u('uTime'), t); gl.uniform1f(u('uHasAudio'), music ? 1 : 0);
        gl.uniform4f(u('uAudio'), a.bass, a.mid, a.treble, a.level); gl.uniform1f(u('uBeat'), a.beat); gl.uniform1f(u('uBeats'), a.beats);
        const box = circle ? [(TW - TH) / 2, 0, TH, TH] : [0, 0, TW, TH];
        gl.viewport(...box); gl.uniform4f(u('uBox'), ...box);
        gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        g.drawImage(gl.canvas, LABEL + col * TW, row * TH);
        g.strokeStyle = '#16181d'; g.strokeRect(LABEL + col * TW, row * TH, TW, TH);
      });
    });
    const blob = await sheet.convertToBlob({ type: 'image/png' });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { png: btoa(bin), count: looks.length, errors };
  }, { only, group, times, music, circle });
  writeFileSync(out, Buffer.from(result.png, 'base64'));
  console.log(`${out}: ${result.count} looks at ${times.join(', ')} s${music ? ' with music' : ''}.`);
  for (const [id, log] of Object.entries(result.errors)) console.log(`${id} does not compile:\n${log}`);
  process.exitCode = Object.keys(result.errors).length ? 1 : 0;
} finally {
  await browser.close(); server.close();
}
