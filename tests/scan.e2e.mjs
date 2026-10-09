// "Find surfaces with the camera" end to end (roadmap #3). getUserMedia returns a synthetic camera: a canvas
// stream of the test room lit by whatever pattern the app shows, delayed like a mirrored projector, with ambient
// light and noise. Slow under software GL (a few minutes): the app measures the lag and waits for each frame.
import { serveApp, loadPlaywright, BROWSER_ARGS, reporter } from './serve.mjs';
import { buildRoom } from './scene.mjs';

const fakeCamera = (buildRoomSrc) => `
(() => {
  const buildRoom = ${buildRoomSrc};
  const LAG = 180;
  const history = [{ t: 0, f: null }];
  window.__patternShown = (f) => history.push({ t: performance.now(), f });
  let room = null;
  navigator.mediaDevices.getUserMedia = async () => {
    const camW = 640, camH = 480, c = document.createElement('canvas'); c.width = camW; c.height = camH;
    const ctx = c.getContext('2d'), img = ctx.createImageData(camW, camH);
    let seed = 3; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const draw = () => {
      const [W, H] = window.app.frame;
      if (!room || room.W !== W || room.H !== H) window.__room = room = buildRoom({ W, H, camW, camH });
      const now = performance.now() - LAG;
      let f = null; for (const h of history) if (h.t <= now) f = h.f;
      for (let i = 0; i < camW * camH; i++) {
        const px = room.lit[i * 2];
        const v = 30 + (px >= 0 ? 160 * room.patternValue(f, px, room.lit[i * 2 + 1]) : 0) + (rnd() - 0.5) * 8;
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    };
    draw(); setInterval(draw, 40);
    return c.captureStream(25);
  };
  navigator.mediaDevices.enumerateDevices = async () => [{ kind: 'videoinput', deviceId: 'fake', label: 'Synthetic camera' }];
})();`;

export default async function run() {
  const t = reporter('scan');
  const { chromium } = await loadPlaywright();
  const server = await serveApp();
  const browser = await chromium.launch({ args: BROWSER_ARGS });
  const errors = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(fakeCamera(buildRoom.toString()));
    await page.goto(server.url);
    await page.waitForFunction(() => window.app && window.app.editor);
    await page.evaluate(() => {
      document.getElementById('connectSheet').close();
      const orig = window.app.showPattern.bind(window.app);
      window.app.showPattern = (f) => { window.__patternShown(f); orig(f); };
      window.app.editor.addSurface({ id: 'old', pins: [[0.1, 0.9], [0.3, 0.9], [0.3, 0.6], [0.1, 0.6]], parts: [{ op: 1, pts: [[0, 0], [1, 0], [1, 1], [0, 1]] }], content: { kind: 'effect', effect: 'outline' } });
      document.getElementById('toolsBtn').click();
      document.getElementById('scanBtn').click();
    });
    await page.waitForFunction(() => !document.getElementById('scanStart').disabled, null, { timeout: 20000 });
    await page.click('#scanStart');
    await page.waitForFunction(() => !document.getElementById('pattern').hidden, null, { timeout: 10000 });
    t.ok(await page.evaluate(() => document.body.classList.contains('capturing') && !document.getElementById('scanSheet').open), 'only the pattern shows during capture');
    await page.waitForFunction(() => !window.app.scanning, null, { timeout: 400000 });
    const out = await page.evaluate(() => {
      const [W, H] = window.app.frame, room = window.__room, surfaces = window.app.project.surfaces;
      const err = (corners) => Math.min(...surfaces.map((s) => corners.reduce((a, c) => a + Math.min(...s.pins.map(([x, y]) => Math.hypot(x * W - c[0], y * H - c[1]))), 0) / 4));
      return { status: document.getElementById('scanStatus').textContent, n: surfaces.length, front: err(room.faceCorners.front), right: err(room.faceCorners.right), undo: !document.getElementById('scanUndo').hidden };
    });
    console.log('     ' + out.status.replace(/\n/g, '\n     '));
    t.ok(out.n === 3, `three surfaces found (got ${out.n})`);
    t.ok(out.front < 4 && out.right < 4, `front and right face corners within 4 px (${out.front.toFixed(1)}, ${out.right.toFixed(1)})`);
    t.ok(out.undo, 'Undo is offered');
    await page.click('#scanUndo');
    t.ok((await page.evaluate(() => window.app.project.surfaces.map((s) => s.id).join())) === 'old', 'Undo brings back the earlier surfaces');
    t.ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  } finally {
    await browser.close(); server.close();
  }
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
