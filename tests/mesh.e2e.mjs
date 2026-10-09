// Mesh warp and soft edges (roadmap #6): a surface bent by its grid points, read back from the rendered frame.
import { serveApp, loadPlaywright, BROWSER_ARGS, reporter } from './serve.mjs';

export default async function run() {
  const t = reporter('mesh');
  const { chromium } = await loadPlaywright();
  const server = await serveApp();
  const browser = await chromium.launch({ args: BROWSER_ARGS });
  const errors = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url);
    await page.waitForFunction(() => window.app && window.app.editor);
    await page.evaluate(() => {
      document.getElementById('connectSheet').close();
      const app = window.app;
      // a test effect that shows content uv as colour, so the mapping can be read back
      app.project.effects = [{ id: 'uvtest', name: 'uv', code: 'vec3 fx_custom(Surf2 s, float t) { return vec3(s.uv, 1.0); }' }];
      app.editor.addSurface({ id: 'a', pins: [[0.3, 0.8], [0.7, 0.8], [0.7, 0.2], [0.3, 0.2]], parts: [{ op: 1, pts: [[0, 0], [1, 0], [1, 1], [0, 1]] }], content: { kind: 'effect', effect: 'uvtest' } });
      document.getElementById('toolsBtn').click();
      document.querySelector('#modeSeg [data-mode="mesh"]').click();
    });
    // read frame pixels (frame coordinates) straight after a render
    const read = (pts) => page.evaluate((pts) => {
      const app = window.app; app.sync(); app.renderer.render(0, app.audio.state, null);
      const gl = app.renderer.gl, c = app.renderer.canvas, [W, H] = app.frame, px = new Uint8Array(4);
      return pts.map(([x, y]) => { gl.readPixels(Math.round(x / W * c.width), Math.round(c.height - 1 - y / H * c.height), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return [...px]; });
    }, pts);
    const st = await page.evaluate(() => ({ mesh: window.app.project.surfaces[0].mesh, size: document.getElementById('meshSize').value, frame: window.app.frame }));
    t.ok(st.mesh && st.mesh.n[0] === 3 && st.size === '3', 'Bend mode gives the surface a 3 x 3 grid');
    const [W, H] = st.frame;

    // flat grid: same as before (the middle shows uv 0.5, 0.5)
    const [mid] = await read([[0.5 * W, 0.5 * H]]);
    t.ok(Math.abs(mid[0] - 128) < 6 && Math.abs(mid[1] - 128) < 6, `a flat grid changes nothing (centre uv ${mid[0]}, ${mid[1]})`);

    // bow the bottom edge's two middle points outward (down) by 10% of the frame height, like a sagging banner
    const tm = await page.evaluate(() => {
      const app = window.app, s = app.project.surfaces[0], g = app.geoms[0], Hi = g.Hi;
      const toH = ([x, y]) => { const w = Hi[6] * x + Hi[7] * y + Hi[8]; return [(Hi[0] * x + Hi[1] * y + Hi[2]) / w, (Hi[3] * x + Hi[4] * y + Hi[5]) / w]; };
      const t0 = performance.now();
      for (const k of [1, 2]) { const [x, y] = g.meshPx[k]; s.mesh.pts[k] = toH([x, y + 0.1 * app.frame[1]]); }
      app.changed(); app.sync();
      return performance.now() - t0;
    });
    console.log(`     bend grid rebuilt in ${tm.toFixed(0)} ms`);
    // below the old bottom edge, in the middle: now inside the surface; at the corners: still outside
    const [below, corner] = await read([[0.5 * W, 0.85 * H], [0.31 * W, 0.85 * H]]);
    t.ok(below[2] > 200, 'the outline follows the bend: the bowed-out middle is lit');
    t.ok(corner[2] < 20, 'the corners stay where they were');
    // content follows: the bottom edge of the content (v = 0, green ~0) sits on the new curved edge
    const bottomGreen = (await read([[0.5 * W, 0.87 * H]]))[0][1];
    t.ok(bottomGreen < 30, `the content bends with it (v near the bowed edge: ${bottomGreen})`);
    // no seams: walk down the middle column; v changes smoothly, without jumps between grid cells
    const col = await read(Array.from({ length: 60 }, (_, i) => [0.5 * W, (0.22 + i * 0.011) * H]));
    const gs = col.filter((p) => p[2] > 200).map((p) => p[1]);
    const jumps = gs.slice(1).map((g, i) => Math.abs(g - gs[i]));
    t.ok(gs.length > 40 && Math.max(...jumps) <= 12, `no seams between grid cells (largest step ${Math.max(...jumps)} over ${gs.length} samples)`);

    // soft edge
    const edgePt = [[0.5 * W, 0.2 * H + 6], [0.5 * W, 0.4 * H]];
    const [crisp] = await read(edgePt);
    await page.evaluate(() => { const s = window.app.project.surfaces[0]; s.feather = 40; window.app.changed(); });
    const [soft, inner] = await read(edgePt);
    t.ok(crisp[2] > 200 && soft[2] < crisp[2] * 0.4 && inner[2] > 200, `the soft edge fades near the outline (${crisp[2]} -> ${soft[2]}) but not inside (${inner[2]})`);

    // points mode still edits through the bend: a dragged point lands where it's put
    const placed = await page.evaluate(() => {
      const app = window.app, ed = app.editor, s = app.project.surfaces[0], g = app.geoms[0];
      const target = [0.62 * app.frame[0], 0.75 * app.frame[1]];
      s.parts[0].pts[1] = g.toUV(...target); app.changed(); app.sync();
      const q = app.geoms[0].parts[0].px[1];
      return Math.hypot(q[0] - target[0], q[1] - target[1]);
    });
    t.ok(placed < 0.5, `a point placed through the bend lands within half a pixel (${placed.toFixed(3)})`);
    // grid off: flat again
    await page.selectOption('#meshSize', '0');
    t.ok(await page.evaluate(() => !window.app.project.surfaces[0].mesh), 'turning the grid off makes it flat again');
    t.ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  } finally {
    await browser.close(); server.close();
  }
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
