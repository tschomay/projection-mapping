// A hidden tab gives back what it holds (so it can't run the browser out of graphics memory for other tabs), and
// everything comes back when it's shown again:
// - the tray's previews give back their context and tiles when the tray closes, and draw again when it opens;
// - hidden, the frame's WebGL context is given up, idle audio stops and an open camera closes;
// - shown again, the frame draws as before and the camera reopens;
// - a context the browser takes away by itself (a GPU reset, memory running out) comes back too.
// The shape model's release is checked in outline.e2e, with its fake model.
import { serveApp, loadPlaywright, BROWSER_ARGS, reporter, setHidden } from './serve.mjs';

export default async function run() {
  const t = reporter('hidden');
  const { chromium } = await loadPlaywright();
  const server = await serveApp();
  const browser = await chromium.launch({ args: [...BROWSER_ARGS, '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const errors = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url);
    await page.waitForFunction(() => window.app && window.app.editor);
    await page.evaluate(() => {
      document.getElementById('connectSheet').close();
      const app = window.app;
      app.editor.addSurface({ id: 'a', pins: [[0.3, 0.85], [0.7, 0.85], [0.7, 0.15], [0.3, 0.15]], parts: [{ op: 1, pts: [[0, 0], [1, 0], [1, 1], [0, 1]] }], content: { kind: 'effect', effect: 'white' } });
      app.editor.select(-1); app.changed();
    });
    // the frame's colour in the middle of the surface, as drawn by the app's own loop
    const centre = () => page.evaluate(async () => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const app = window.app, gl = app.renderer.gl, px = new Uint8Array(4);
      app.renderer.render(0, app.audio.state, null);
      gl.readPixels(Math.round(gl.canvas.width / 2), Math.round(gl.canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return [...px].slice(0, 3);
    });
    const before = await centre();
    t.ok(before.every((v) => v > 200), `the surface draws white to start with (${before})`);

    // ---- the tray ----
    await page.evaluate(() => window.app.setTray(true));
    const open = await page.waitForFunction(() => window.app.thumbs.gl && window.app.thumbs.programs.size > 0, null, { timeout: 10000 }).then(() => true, () => false);
    t.ok(open, 'the open tray has a preview context with shaders compiled');
    const closed = await page.evaluate(() => {
      const app = window.app, old = app.thumbs.canvas, oldGl = app.thumbs.gl;
      app.setTray(false);
      return { gl: app.thumbs.gl, programs: app.thumbs.programs.size, lost: oldGl.isContextLost(), swapped: old !== app.thumbs.canvas && app.thumbs.canvas.isConnected, tiles: document.getElementById('trayTiles').children.length };
    });
    t.ok(!closed.gl && !closed.programs && closed.lost && closed.swapped, 'closing it gives back the preview context and its shaders');
    t.ok(closed.tiles === 1, `and drops its tiles, keeping only the preview canvas (${closed.tiles} left)`);
    await page.evaluate(() => window.app.setTray(true));
    const again = await page.waitForFunction(() => window.app.thumbs.gl && !window.app.thumbs.gl.isContextLost() && window.app.thumbs.programs.size > 0, null, { timeout: 10000 }).then(() => true, () => false);
    t.ok(again, 'opening it again makes a new one and the previews draw');
    await page.evaluate(() => window.app.setTray(false));

    // ---- hidden ----
    await page.evaluate(async () => {
      const app = window.app;
      app.audio.ensure();
      app.openScan();
      for (let i = 0; i < 100 && !app.camera.stream; i++) await new Promise((r) => setTimeout(r, 50));
    });
    const cam = await page.evaluate(() => !!window.app.camera.stream);
    t.ok(cam, 'set-up: the camera sheet has the camera open');
    await setHidden(page, true);
    await page.waitForTimeout(300);
    const hidden = await page.evaluate(() => {
      const app = window.app;
      return { lost: app.renderer.gl.isContextLost(), audio: app.audio.ctx.state, cam: !!app.camera.stream, video: !!document.getElementById('scanVideo').srcObject };
    });
    t.ok(hidden.lost, 'hidden, the frame gives up its WebGL context');
    t.ok(hidden.audio === 'suspended', `idle audio is suspended (${hidden.audio})`);
    t.ok(!hidden.cam && !hidden.video, 'and the camera is closed');

    // ---- shown again ----
    await setHidden(page, false);
    const back = await page.waitForFunction(() => !window.app.renderer.lost && !window.app.renderer.gl.isContextLost(), null, { timeout: 10000 }).then(() => true, () => false);
    t.ok(back, 'shown again, the context comes back');
    const after = await centre();
    t.ok(after.every((v, i) => Math.abs(v - before[i]) < 3), `and the frame draws as before (${after})`);
    const reopened = await page.waitForFunction(() => !!window.app.camera.stream, null, { timeout: 10000 }).then(() => true, () => false);
    t.ok(reopened, 'the camera sheet, still open, has its camera again');
    await page.evaluate(() => document.getElementById('scanSheet').close());

    // a look chosen while hidden is compiled when the context comes back
    await setHidden(page, true);
    await page.evaluate(() => { const app = window.app; app.project.surfaces[0].content = { kind: 'effect', effect: 'plasma' }; app.changed(); app.sync(); });
    await setHidden(page, false);
    await page.waitForFunction(() => !window.app.renderer.lost, null, { timeout: 10000 });
    const look = await page.evaluate(() => window.app.renderer.effects.map((e) => e.id));
    t.ok(look.includes('plasma'), `a look picked while hidden is compiled on return (${look})`);

    // ---- the browser takes the context away by itself (a GPU reset), and gives it back ----
    await page.evaluate(() => { const app = window.app; app.project.surfaces[0].content = { kind: 'effect', effect: 'white' }; app.changed(); app.renderer.loseExt.loseContext(); });
    await page.waitForFunction(() => window.app.renderer.lost, null, { timeout: 5000 });
    await page.evaluate(() => window.app.renderer.loseExt.restoreContext());
    const reset = await page.waitForFunction(() => !window.app.renderer.lost, null, { timeout: 10000 }).then(() => true, () => false);
    const afterReset = await centre();
    t.ok(reset && afterReset.every((v) => v > 200), `after a context lost by the browser, the frame comes back by itself (${afterReset})`);
    t.ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  } finally {
    await browser.close(); server.close();
  }
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
