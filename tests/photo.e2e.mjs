// Designing on a photo of the set: the photo shows behind the frame with the content added on top as light, it is
// saved with the project, and it stays out of the media list. Also checks that media used only in a cue is kept.
import { serveApp, loadPlaywright, BROWSER_ARGS, reporter } from './serve.mjs';

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
    }));
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
  } finally {
    await browser.close(); server.close();
  }
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
