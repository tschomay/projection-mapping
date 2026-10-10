// ISF (roadmap #10) and the composition canvas (roadmap #7), in the app.
// - Every built-in effect, exported as ISF, compiles and draws in a minimal ISF host: WebGL1 (GLSL ES 1.00, the
//   strictest dialect hosts use), with the uniforms an ISF host declares.
// - Export from the Content pane downloads the file; importing a generator (and that file again) adds an effect
//   that draws on a surface; a filter with an image input is refused.
// - Arranging: a surface shows the composition rectangle it's given, moved and resized by dragging.
import { readFile } from 'node:fs/promises';
import { serveApp, loadPlaywright, BROWSER_ARGS, reporter } from './serve.mjs';

export default async function run() {
  const t = reporter('isf');
  const { chromium } = await loadPlaywright();
  const server = await serveApp();
  const browser = await chromium.launch({ args: BROWSER_ARGS });
  const errors = [];
  const fixture = new URL('./fixtures/rings.fs', import.meta.url).pathname;
  try {
    const page = await (await browser.newContext({ viewport: { width: 960, height: 540 }, acceptDownloads: true })).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url);
    await page.waitForFunction(() => window.app && window.app.editor);

    // ---- every built-in effect in an ISF host ----
    const host = await page.evaluate(async () => {
      const { toISF } = await import('./src/isf.js');
      const { EFFECTS } = await import('./src/effects.js');
      const c = document.createElement('canvas'); c.width = 64; c.height = 36;
      const gl = c.getContext('webgl');
      const vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs, 'attribute vec2 p; varying vec2 isf_FragNormCoord; void main() { isf_FragNormCoord = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }');
      gl.compileShader(vs);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const out = {};
      for (const e of EFFECTS) {
        const file = toISF(e), header = JSON.parse(file.match(/^\/\*([\s\S]*?)\*\//)[1]);
        // what an ISF host puts before the file's code: its built-ins and one uniform per input
        const decl = header.INPUTS.map((i) => `uniform ${i.TYPE === 'bool' ? 'bool' : 'float'} ${i.NAME};`).join('\n');
        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, `precision highp float;\nuniform float TIME;\nuniform vec2 RENDERSIZE;\nvarying vec2 isf_FragNormCoord;\n${decl}\n${file.slice(file.indexOf('*/') + 2)}`);
        gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) { out[e.id] = gl.getShaderInfoLog(fs); continue; }
        const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.bindAttribLocation(prog, 0, 'p'); gl.linkProgram(prog);
        gl.useProgram(prog); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.uniform1f(gl.getUniformLocation(prog, 'TIME'), 1.7); gl.uniform2f(gl.getUniformLocation(prog, 'RENDERSIZE'), 64, 36);
        gl.uniform1f(gl.getUniformLocation(prog, 'surfaceCount'), 1);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        const px = new Uint8Array(64 * 36 * 4); gl.readPixels(0, 0, 64, 36, gl.RGBA, gl.UNSIGNED_BYTE, px);
        let lit = 0; for (let i = 0; i < px.length; i += 4) lit = Math.max(lit, px[i] + px[i + 1] + px[i + 2]);
        out[e.id] = lit;
      }
      return out;
    });
    const failed = Object.entries(host).filter(([, v]) => typeof v === 'string');
    t.ok(!failed.length, `every built-in effect exported as ISF compiles as GLSL ES 1.00 (${Object.keys(host).length} effects)` + (failed.length ? ': ' + failed.map(([k, v]) => `${k}: ${v.split('\n')[0]}`).join(' | ') : ''));
    t.ok(['plasma', 'outline', 'white', 'bats', 'candle'].every((k) => host[k] > 30) && host.off === 0, `and draws in the host (plasma ${host.plasma}, bats ${host.bats}, off ${host.off})`);

    // ---- export and import from the Content pane ----
    await page.evaluate(() => {
      document.getElementById('connectSheet').close();
      const app = window.app;
      app.project.effects = [{ id: 'scrtest', name: 'screen', code: 'vec3 fx_custom(Surf2 s, float t) { return vec3(s.screen, 1.0); }' }];
      app.editor.addSurface({ id: 'a', pins: [[0.1, 0.8], [0.4, 0.8], [0.4, 0.3], [0.1, 0.3]], parts: [{ op: 1, pts: [[0, 0], [1, 0], [1, 1], [0, 1]] }], content: { kind: 'effect', effect: 'plasma' } });
      app.editor.addSurface({ id: 'b', pins: [[0.6, 0.8], [0.9, 0.8], [0.9, 0.3], [0.6, 0.3]], parts: [{ op: 1, pts: [[0, 0], [1, 0], [1, 1], [0, 1]] }], content: { kind: 'effect', effect: 'plasma' } });
      app.editor.select(0);
      document.getElementById('toolsBtn').click(); app.selectTab('content');
    });
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#exportISF')]);
    const exported = await readFile(await download.path(), 'utf8');
    t.ok(download.suggestedFilename() === 'Plasma.fs' && /fx_plasma\(s, TIME\)/.test(exported), `Export this effect as ISF downloads ${download.suggestedFilename()}`);

    const read = (pts) => page.evaluate((pts) => {
      const app = window.app; app.sync(); app.renderer.render(0, app.audio.state, null);
      const gl = app.renderer.gl, c = app.renderer.canvas, [W, H] = app.frame, px = new Uint8Array(4);
      return pts.map(([x, y]) => { gl.readPixels(Math.round(x * c.width), Math.round(c.height - 1 - y * c.height), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return [...px]; });
    }, pts);
    await page.setInputFiles('#importISF', fixture);
    await page.waitForFunction(() => window.app.project.effects.length === 2, null, { timeout: 5000 }).catch(() => {});
    const imp = await page.evaluate(() => ({ eff: window.app.project.effects[1], content: window.app.project.surfaces[0].content, chip: !!document.querySelector('#effectList .chip.own[data-effect="' + (window.app.project.effects[1] || {}).id + '"]') }));
    t.ok(imp.eff && imp.eff.name === 'Rings' && imp.eff.source === 'isf' && imp.chip, 'an ISF generator imports into the effect list');
    t.ok(imp.eff && imp.content.effect === imp.eff.id, 'and goes onto the selected surface');
    // its colour input's default (0.2, 0.8, 0.4), full on the right half of the surface, half on the left
    const [right, left] = await read([[0.33, 0.55], [0.17, 0.55]]);
    t.ok(Math.abs(right[0] - 51) < 6 && Math.abs(right[1] - 204) < 6 && Math.abs(right[2] - 102) < 6 && Math.abs(left[1] - 102) < 6,
      `it draws on the surface with its inputs at their defaults (right ${right.slice(0, 3)}, left ${left.slice(0, 3)})`);

    // the exported Plasma imports back and draws like the built-in
    await page.setInputFiles('#importISF', { name: 'Plasma.fs', mimeType: 'text/plain', buffer: Buffer.from(exported) });
    await page.waitForFunction(() => window.app.project.effects.length === 3, null, { timeout: 5000 }).catch(() => {});
    const [round] = await read([[0.25, 0.55]]);
    t.ok(await page.evaluate(() => window.app.project.effects.length === 3) && round[0] + round[1] + round[2] > 30, `an exported effect imports back and draws (${round.slice(0, 3)})`);

    await page.setInputFiles('#importISF', { name: 'Blur.fs', mimeType: 'text/plain', buffer: Buffer.from('/*{ "INPUTS": [{ "NAME": "inputImage", "TYPE": "image" }] }*/\nvoid main() { gl_FragColor = IMG_THIS_PIXEL(inputImage); }') });
    await page.waitForTimeout(200);
    const refused = await page.evaluate(() => ({ n: window.app.project.effects.length, toast: document.getElementById('toast').textContent }));
    t.ok(refused.n === 3 && /image/.test(refused.toast), `a filter with an image input is refused in plain words ("${refused.toast}")`);

    // ---- the composition canvas ----
    await page.evaluate(() => { for (const s of window.app.project.surfaces) s.content = { kind: 'effect', effect: 'scrtest' }; window.app.changed(); });
    // by default a surface shows the part of the composition it covers: screen = where it sits
    const [a0, b0] = await read([[0.25, 0.55], [0.75, 0.55]]);
    t.ok(Math.abs(a0[0] - 64) < 8 && Math.abs(b0[0] - 191) < 8 && Math.abs(a0[1] - 115) < 8, `by default each surface shows what's under it (red ${a0[0]}, ${b0[0]})`);

    await page.evaluate(() => { window.app.toggleDrawer(true); window.app.selectTab('content'); });
    await page.click('#composeBtn');
    const on = await page.evaluate(() => ({ compose: window.app.editor.compose, bar: !document.getElementById('composeBar').hidden, drawer: document.getElementById('drawer').hidden, nudge: document.getElementById('nudgeLabel').textContent }));
    t.ok(on.compose && on.bar && on.drawer, 'Arrange content shows the composition with a Done bar, and the drawer gets out of the way');
    t.ok(/content rectangle/.test(on.nudge), 'the nudge pad moves the content rectangle');

    // drag surface 2's rectangle (it sits at x 0.6..0.9) left by 0.4 of the frame: it now shows what's left of centre
    const box = await page.locator('#overlay').boundingBox();
    const at = (x, y) => [box.x + x * box.width, box.y + y * box.height];
    await page.mouse.move(...at(0.75, 0.55)); await page.mouse.down();
    await page.mouse.move(...at(0.55, 0.55), { steps: 4 }); await page.mouse.move(...at(0.35, 0.55), { steps: 4 }); await page.mouse.up();
    const moved = await page.evaluate(() => window.app.project.surfaces.map((s) => s.input || null));
    t.ok(!moved[0] && moved[1] && Math.abs(moved[1].x - 0.2) < 0.01 && Math.abs(moved[1].w - 0.3) < 0.01, `dragging a rectangle moves what that surface shows (x ${moved[1] && moved[1].x.toFixed(3)})`);
    const [a1, b1] = await read([[0.25, 0.55], [0.75, 0.55]]);
    t.ok(Math.abs(b1[0] - 89) < 8 && Math.abs(a1[0] - a0[0]) < 3, `surface 2 now shows the composition's left part (red ${b0[0]} -> ${b1[0]}); surface 1 is unchanged`);

    // resize from its top-right corner (0.5, 0.3) to (0.9, 0.1): the rectangle grows, the surface stays put
    await page.mouse.move(...at(0.5, 0.3)); await page.mouse.down();
    await page.mouse.move(...at(0.7, 0.2), { steps: 4 }); await page.mouse.move(...at(0.9, 0.1), { steps: 4 }); await page.mouse.up();
    const r = await page.evaluate(() => window.app.project.surfaces[1].input);
    t.ok(Math.abs(r.x - 0.2) < 0.01 && Math.abs(r.w - 0.7) < 0.01 && Math.abs(r.h - 0.7) < 0.01 && Math.abs(r.y - 0.2) < 0.01, `dragging a corner resizes it (${r.w.toFixed(2)} x ${r.h.toFixed(2)})`);
    const pins = await page.evaluate(() => window.app.project.surfaces[1].pins[0]);
    t.ok(Math.abs(pins[0] - 0.6) < 1e-9 && Math.abs(pins[1] - 0.8) < 1e-9, 'arranging never moves the surface itself');
    const [b2] = await read([[0.75, 0.55]]);
    t.ok(Math.abs(b2[0] - 140) < 8 && Math.abs(b2[1] - 140) < 8, `the surface's centre shows the new rectangle's centre (${b2.slice(0, 2)})`);

    // media laid "across all" follows the rectangle too: it's the same composition
    const media = await page.evaluate(async () => {
      const app = window.app, c = document.createElement('canvas'); c.width = 200; c.height = 100;
      const g = c.getContext('2d'); g.fillStyle = '#f00'; g.fillRect(0, 0, 100, 100); g.fillStyle = '#00f'; g.fillRect(100, 0, 100, 100);
      const blob = await new Promise((r) => c.toBlob(r));
      const m = await app.media.add(new File([blob], 'halves.png', { type: 'image/png' }));
      await new Promise((r) => { const el = m.el; if (el.complete && el.naturalWidth) r(); else el.onload = r; });
      for (const s of app.project.surfaces) s.content = { kind: 'media', mediaId: m.id, fit: 'stretch', space: 'frame' };
      app.project.surfaces[1].input = { x: 0, y: 0, w: 0.5, h: 1 };   // surface 2 shows the left (red) half
      app.changed();
      return !!app.composeSource();
    });
    await page.waitForTimeout(100);
    const [ma, mb] = await read([[0.25, 0.55], [0.75, 0.55]]);
    t.ok(ma[0] > 200 && ma[2] < 40 && mb[0] > 200 && mb[2] < 40, `"one image across all" follows the rectangles: both surfaces show the red half (${ma.slice(0, 3)} / ${mb.slice(0, 3)})`);
    t.ok(media, 'and the arrange view draws that image under the rectangles');

    // back to where it sits, Done, and Show mode ends arranging
    await page.evaluate(() => { window.app.editor.select(1); document.getElementById('composeReset').click(); });
    t.ok(await page.evaluate(() => !window.app.project.surfaces[1].input), '"Back to where it sits" clears the rectangle');
    await page.click('#composeDone');
    t.ok(await page.evaluate(() => !window.app.editor.compose && document.getElementById('composeBar').hidden), 'Done ends arranging');
    await page.evaluate(() => { window.app.setCompose(true); window.app.setShow(true); });
    t.ok(await page.evaluate(() => !window.app.editor.compose && document.getElementById('composeBar').hidden), 'Show mode ends arranging too');
    t.ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  } finally {
    await browser.close(); server.close();
  }
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
