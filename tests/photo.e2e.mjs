// Designing on a photo of the set: the photo shows behind the frame with the content added on top as light, it is
// saved with the project, and it stays out of the media list. Also checks that media used only in a cue is kept.
// Then, with a fake camera filming the synthetic wall (scene.mjs) from beside the projector: taking the photo lines
// it up with the frame (issue #34), its corners can be dragged, and tapping a picture frame or a panel on it makes
// a surface, stepping out to the rectangle around it on a second tap (#35).
import { serveApp, loadPlaywright, BROWSER_ARGS, reporter } from './serve.mjs';
import { buildWall } from './scene.mjs';

// getUserMedia returns the wall as the camera sees it, lit by whatever the app projects (black or white), a little
// behind, like a mirrored projector
const fakeCamera = (buildWallSrc) => `
(() => {
  const buildWall = ${buildWallSrc};
  const LAG = 120, history = [{ t: 0, f: null }];
  window.__patternShown = (f) => history.push({ t: performance.now(), f });
  navigator.mediaDevices.getUserMedia = async () => {
    const camW = 640, camH = 480, c = document.createElement('canvas'); c.width = camW; c.height = camH;
    const ctx = c.getContext('2d');
    let imgs = null;
    const draw = () => {
      const [W, H] = window.app.frame;
      if (!imgs || imgs.W !== W || imgs.H !== H) {
        const wall = window.__wall = buildWall({ W, H, camW, camH });
        imgs = { W, H, black: new ImageData(wall.photo(0, 3), camW, camH), white: new ImageData(wall.photo(1, 4), camW, camH) };
      }
      const now = performance.now() - LAG;
      let f = null; for (const h of history) if (h.t <= now) f = h.f;
      ctx.putImageData(f && f.mode === 1 ? imgs.white : imgs.black, 0, 0);
    };
    draw(); setInterval(draw, 40);
    return c.captureStream(25);
  };
  navigator.mediaDevices.enumerateDevices = async () => [{ kind: 'videoinput', deviceId: 'fake', label: 'Synthetic camera' }];
})();`;

export default async function run() {
  const t = reporter('photo');
  const { chromium } = await loadPlaywright();
  const server = await serveApp();
  const browser = await chromium.launch({ args: BROWSER_ARGS });
  const errors = [];
  const icon = new URL('../app/icon-192.png', import.meta.url).pathname;
  try {
    const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url);
    await page.waitForFunction(() => window.app && window.app.editor);
    await page.evaluate(() => { document.getElementById('connectSheet').close(); document.getElementById('toolsBtn').click(); window.app.selectTab('project'); });
    await page.setInputFiles('#addBackdrop', icon);
    await page.waitForFunction(() => !document.getElementById('backdrop').hidden && document.getElementById('backdrop').complete);
    const st = await page.evaluate(() => ({
      blend: getComputedStyle(document.getElementById('gl')).mixBlendMode,
      chips: document.querySelectorAll('#mediaList .chip').length,
      saved: window.app.project.backdrop,
      align: document.getElementById('alignSheet').open,
    }));
    t.ok(st.align && !st.saved.quad, 'a chosen photo opens the line-up sheet, covering the frame until a corner is dragged');
    await page.evaluate(() => { document.getElementById('closeAlign').click(); document.getElementById('toolsBtn').click(); window.app.selectTab('project'); });
    t.ok(st.blend === 'screen', 'the content is blended onto the photo as light');
    t.ok(st.chips === 0, 'the photo stays out of the media list');
    await page.fill('#backdropDim', '0.3'); await page.dispatchEvent('#backdropDim', 'input');
    t.ok(await page.evaluate(() => /0\.3/.test(document.getElementById('backdrop').style.filter)), 'the brightness slider dims the photo');

    // media used only in a cue survives a save and reload, as does the photo
    await page.evaluate(() => { document.querySelector('[data-add="square"]').click(); window.app.editor.select(0); });
    await page.setInputFiles('#addMedia', icon);
    await page.waitForFunction(() => window.app.project.surfaces[0].content.kind === 'media');
    await page.evaluate(() => {
      const app = window.app;
      document.getElementById('cueAdd').click();                       // cue 1: the image
      app.setContent({ kind: 'effect', effect: 'plasma' });           // the stage now shows an effect
      app.save();
    });
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForFunction(() => window.app && window.app.editor && window.app.project.backdrop);
    await page.waitForFunction(() => !document.getElementById('backdrop').hidden, null, { timeout: 10000 }).catch(() => {});
    const after = await page.evaluate(() => {
      const app = window.app, look = app.project.cues[0].looks[app.project.surfaces[0].id];
      return { photo: !document.getElementById('backdrop').hidden, cueMedia: !!app.media.get(look.mediaId), missing: !document.getElementById('missingMedia').hidden };
    });
    t.ok(after.photo, 'the photo comes back after a reload');
    t.ok(after.cueMedia && !after.missing, 'an image used only in a cue is kept with the project');

    await page.evaluate(() => { document.getElementById('toolsBtn').click(); window.app.selectTab('project'); document.getElementById('backdropShow').click(); });
    t.ok(await page.evaluate(() => document.getElementById('backdrop').hidden && !document.body.classList.contains('photo')), 'the photo can be hidden');
    await page.click('#removeBackdrop');
    t.ok(await page.evaluate(() => !window.app.project.backdrop && document.getElementById('backdropOpts').hidden), 'and removed');
    t.ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await cameraPhoto(browser, server, t);
  } finally {
    await browser.close(); server.close();
  }
  return t.failed;
}

async function cameraPhoto(browser, server, t) {
  const errors = [];
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (process.env.DEBUG_E2E) console.log('[page]', m.text()); });
  await page.addInitScript(fakeCamera(buildWall.toString()));
  await page.goto(server.url);
  await page.waitForFunction(() => window.app && window.app.editor);
  await page.evaluate(() => {
    document.getElementById('connectSheet').close();
    const orig = window.app.showPattern.bind(window.app);
    window.app.showPattern = (f) => { window.__patternShown(f); orig(f); };
    document.getElementById('toolsBtn').click(); window.app.selectTab('project');
  });
  t.ok(await page.evaluate(() => document.getElementById('pickBtn').disabled), 'picking on the photo waits for a photo');
  await page.click('#photoTake');
  await page.waitForFunction(() => !document.getElementById('photoStart').disabled, null, { timeout: 20000 });
  await page.click('#photoStart');
  await page.waitForFunction(() => window.app.project.backdrop?.quad && document.getElementById('alignSheet').open, null, { timeout: 30000 });
  await page.waitForFunction(() => document.getElementById('backdrop').complete && document.getElementById('backdrop').naturalWidth);
  const reg = await page.evaluate(() => {
    const q = window.app.project.backdrop.quad, wall = window.__wall, img = document.getElementById('backdrop'), box = document.getElementById('box');
    const err = Math.max(...q.map(([x, y], k) => Math.hypot(x * 640 - wall.frameCam[k][0], y * 480 - wall.frameCam[k][1])));
    // where the drawn photo puts the frame's corners: on the box's corners
    const m = new DOMMatrix(getComputedStyle(img).transform), bw = box.clientWidth, bh = box.clientHeight;
    const placed = q.map(([x, y]) => { const p = m.transformPoint(new DOMPoint(x * bw, y * bh)); return [p.x / p.w, p.y / p.w]; });
    const want = [[0, 0], [bw, 0], [bw, bh], [0, bh]];
    return { err, place: Math.max(...placed.map((p, k) => Math.hypot(p[0] - want[k][0], p[1] - want[k][1]))), note: document.getElementById('alignNote').textContent };
  });
  t.ok(reg.err < 1.5, `the photo's frame corners are found within 1.5 camera px (${reg.err.toFixed(2)})`);
  t.ok(reg.place < 0.5, `the photo is drawn with those corners on the frame's corners (${reg.place.toFixed(2)} px off)`);
  t.ok(/Found/.test(reg.note), 'the line-up sheet says the frame was found');
  await page.click('#closeAlign');

  // tap things on the photo: a picture frame's artwork, then again for its mat, then the frame; then a panel
  await page.evaluate(() => { document.getElementById('toolsBtn').click(); window.app.selectTab('surfaces'); });
  t.ok(await page.evaluate(() => !document.getElementById('pickBtn').disabled), 'picking is offered once there is a photo');
  await page.click('#pickBtn');
  t.ok(await page.evaluate(() => !document.getElementById('pickBar').hidden && document.getElementById('drawer').hidden), 'pick mode shows its bar and puts the tools away');
  const tapAt = async (name) => {
    const pt = await page.evaluate((n) => {
      const r = document.getElementById('overlay').getBoundingClientRect(), [W, H] = window.app.frame, f = window.__wall.rects[n].frame;
      const c = f.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]);
      return [r.left + c[0] / W * r.width, r.top + c[1] / H * r.height];
    }, name);
    await page.mouse.click(pt[0], pt[1]);
  };
  // the worst corner of a surface's pins against a named rectangle on the wall, in projector pixels
  const errTo = (i, name) => page.evaluate(([i, n]) => {
    const s = window.app.project.surfaces[i], [W, H] = window.app.frame, f = window.__wall.rects[n].frame;
    const tl = [s.pins[3], s.pins[2], s.pins[1], s.pins[0]];   // pins run bottom-left first
    return s ? Math.max(...tl.map(([x, y], k) => Math.hypot(x * W - f[k][0], y * H - f[k][1]))) : Infinity;
  }, [i, name]);
  await tapAt('art1');
  await page.waitForFunction(() => window.app.project.surfaces.length === 1, null, { timeout: 10000 }).catch(async (e) => { console.log(errors, await page.evaluate(() => ({ toast: document.getElementById('toast').textContent, pick: window.app.editor.pick, bar: document.getElementById('pickBar').getBoundingClientRect().toJSON() }))); throw e; });
  const e1 = await errTo(0, 'art1');
  t.ok(e1 < 6, `a tap on a picture makes a surface on it, corners within 6 px (${e1.toFixed(1)})`);
  await tapAt('art1');
  const e2 = await errTo(0, 'mat1');
  await tapAt('art1');
  const e3 = await errTo(0, 'frame1');
  const n = await page.evaluate(() => window.app.project.surfaces.length);
  t.ok(n === 1 && e2 < 6 && e3 < 6, `tapping again steps out to the mat, then the frame, on the same surface (${e2.toFixed(1)}, ${e3.toFixed(1)}; ${n} surface)`);
  await tapAt('panel2');
  await page.waitForFunction(() => window.app.project.surfaces.length === 2);
  const e4 = await errTo(1, 'panel2');
  t.ok(e4 < 6, `a tap on a wainscoting panel makes a second surface on it (${e4.toFixed(1)})`);
  await page.click('#pickDone');
  t.ok(await page.evaluate(() => document.getElementById('pickBar').hidden && !window.app.editor.pick), 'Done leaves pick mode');

  // dragging a corner on the line-up sheet moves the photo and is saved
  await page.evaluate(() => { document.getElementById('toolsBtn').click(); window.app.selectTab('project'); });
  await page.click('#alignBtn');
  const before = await page.evaluate(() => window.app.project.backdrop.quad.map((p) => [...p]));
  const c = await page.evaluate((q) => { const r = document.getElementById('alignView').getBoundingClientRect(); return [r.left + q[0][0] * r.width, r.top + q[0][1] * r.height]; }, before);
  await page.mouse.move(c[0], c[1]); await page.mouse.down(); await page.mouse.move(c[0] + 15, c[1] + 10, { steps: 3 }); await page.mouse.up();
  const after = await page.evaluate(() => window.app.project.backdrop.quad);
  t.ok(after[0][0] > before[0][0] && after[0][1] > before[0][1] && after[2][0] === before[2][0], 'dragging a corner moves just that corner');
  await page.click('#alignReset');
  t.ok(await page.evaluate(() => JSON.stringify(window.app.project.backdrop.quad) === '[[0,0],[1,0],[1,1],[0,1]]'), '"Use the whole photo" puts the corners on the photo\'s corners');
  t.ok(!errors.length, 'no page errors with the camera' + (errors.length ? ': ' + errors.join(' | ') : ''));
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
