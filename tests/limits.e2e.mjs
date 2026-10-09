// Renderer limits (#23): they're reported instead of silently not drawing, and outline points past the old
// 2,048 budget (stored in later rows of the vertex texture) still draw.
import { serveApp, loadPlaywright, BROWSER_ARGS, reporter } from './serve.mjs';

export default async function run() {
  const t = reporter('limits');
  const { chromium } = await loadPlaywright();
  const server = await serveApp();
  const browser = await chromium.launch({ args: BROWSER_ARGS });
  const errors = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url);
    await page.waitForFunction(() => window.app && window.app.editor);
    await page.evaluate(() => { document.getElementById('connectSheet').close(); document.getElementById('toolsBtn').click(); });
    // sixteen bent surfaces, each a square with a square cut out: bending splits every edge, so about 4,000 outline points
    const n = await page.evaluate(() => {
      const app = window.app;
      for (let i = 0; i < 16; i++) {
        const x = 0.04 + (i % 8) * 0.12, y = i < 8 ? 0.1 : 0.55;
        const sq = (a, b) => [[a, a], [b, a], [b, b], [a, b]];
        app.editor.addSurface({ id: 's' + i, pins: [[x, y + 0.3], [x + 0.1, y + 0.3], [x + 0.1, y], [x, y]], parts: [{ op: 1, pts: sq(0, 1) }, { op: -1, pts: sq(0.8, 0.95) }], content: { kind: 'effect', effect: 'white' } });
        app.setMesh(app.project.surfaces[i], 8);
      }
      app.sync();
      return app.geoms.reduce((a, g) => a + g.parts.reduce((b, p) => b + p.outline.length, 0), 0);
    });
    t.ok(n > 2048, `the test scene uses more outline points than the old limit (${n})`);
    const lit = await page.evaluate(() => {
      const app = window.app; app.renderer.render(0, app.audio.state, null);
      const gl = app.renderer.gl, c = app.renderer.canvas, [W, H] = app.frame, px = new Uint8Array(4);
      return app.geoms.map((g) => {
        const cx = g.pins.reduce((a, p) => a + p[0], 0) / 4, cy = g.pins.reduce((a, p) => a + p[1], 0) / 4;
        gl.readPixels(Math.round(cx / W * c.width), Math.round(c.height - 1 - cy / H * c.height), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return px[0];
      });
    });
    t.ok(lit.every((v) => v > 200), `every surface draws, including the last ones (${lit.join(',')})`);
    t.ok(await page.evaluate(() => document.getElementById('limitNote').hidden), 'no warning while everything fits');

    // a seventeenth surface is refused, with a message
    await page.click('[data-add="square"]');
    t.ok(await page.evaluate(() => window.app.project.surfaces.length === 16 && /Up to 16 surfaces/.test(document.getElementById('toast').textContent)), 'a 17th surface is refused with a message');
    // ...but a project imported with more says which aren't projected
    await page.evaluate(() => { const app = window.app; app.project.surfaces.push(JSON.parse(JSON.stringify(app.project.surfaces[0]))); app.project.surfaces[16].id = 'extra'; app.changed(); app.sync(); });
    t.ok(await page.evaluate(() => !document.getElementById('limitNote').hidden && /first 16/.test(document.getElementById('limitNote').textContent)), 'too many surfaces are reported in the Surfaces pane');
    // too many shapes in all
    await page.evaluate(() => { const app = window.app; app.project.surfaces.pop(); for (const s of app.project.surfaces) { delete s.mesh; for (let k = 0; k < 2; k++) s.parts.push({ op: -1, pts: [[0.4, 0.4], [0.6, 0.4], [0.5, 0.6]] }); } app.changed(); app.sync(); });
    t.ok(await page.evaluate(() => /shapes aren't projected/.test(document.getElementById('limitNote').textContent)), 'too many shapes in all are reported too');
    t.ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  } finally {
    await browser.close(); server.close();
  }
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
