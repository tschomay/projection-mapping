// Effect settings (#42), in the app: the Looks tray shows the selected surface's look's settings, and moving one
// changes the projected frame at once. Every kind of setting (range, toggle, choice, colour) reaches the shader;
// settings are saved with the project, captured in cues, kept when the same look is tapped again, reset, and applied
// to every surface showing the look under All. Export as ISF writes them as inputs with the surface's values, and
// importing that file brings them back as settings.
import { readFile } from 'node:fs/promises';
import { serveApp, loadPlaywright, BROWSER_ARGS, reporter } from './serve.mjs';

// a look of the project's own with one setting of each kind, each driving one colour channel
const PROBE = `float c_r = 0.0; // param: Red, 0..1
bool c_g = false; // param: Green, toggle
int c_b = 0; // param: Blue, choice: Off=0|On=1
vec3 c_tint = vec3(1.0); // param: Tint
vec3 fx_custom(Surf2 s, float t) { return vec3(c_r, c_g ? 1.0 : 0.0, float(c_b)) * c_tint; }`;

export default async function run() {
  const t = reporter('settings');
  const { chromium } = await loadPlaywright();
  const server = await serveApp();
  const browser = await chromium.launch({ args: BROWSER_ARGS });
  const errors = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 960, height: 540 }, acceptDownloads: true })).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url);
    await page.waitForFunction(() => window.app && window.app.editor);
    await page.evaluate((code) => {
      document.getElementById('connectSheet').close();
      const app = window.app;
      app.project.effects = [{ id: 'probe', name: 'Probe', code }];
      const sq = (id, x) => ({ id, pins: [[x, 0.8], [x + 0.3, 0.8], [x + 0.3, 0.3], [x, 0.3]], parts: [{ op: 1, pts: [[0, 0], [1, 0], [1, 1], [0, 1]] }], content: { kind: 'effect', effect: 'probe' } });
      app.editor.addSurface(sq('a', 0.1)); app.editor.addSurface(sq('b', 0.6));
      app.editor.select(0); app.changed();
      app.setTray(true);
    }, PROBE);
    // the colour at the middle of surface 1 or 2, as the app draws it
    const px = (which = 0) => page.evaluate(async (which) => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const app = window.app; app.sync(); app.renderer.render(0, app.audio.state, null);
      const gl = app.renderer.gl, out = new Uint8Array(4);
      gl.readPixels(Math.round(gl.canvas.width * (which ? 0.75 : 0.25)), Math.round(gl.canvas.height * 0.45), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
      return [...out].slice(0, 3);
    }, which);
    const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 6);
    // move a control the way a finger does: set it, then the input event
    const set = (name, value) => page.evaluate(([name, value]) => {
      const el = document.querySelector(`#trayParamsBody [data-p="${name}"]`);
      if (el.type === 'checkbox') el.checked = value; else el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, [name, value]);

    const panel = await page.evaluate(() => ({ shown: !document.getElementById('trayParams').hidden, title: document.getElementById('trayParamsTitle').textContent, controls: [...document.querySelectorAll('#trayParamsBody [data-p]')].map((el) => el.type || el.tagName.toLowerCase()) }));
    t.ok(panel.shown && /Probe settings/.test(panel.title) && panel.controls.join() === 'range,checkbox,select-one,color', `the tray shows the look's settings, one control of each kind (${panel.controls})`);
    t.ok(near(await px(), [0, 0, 0]), 'at their defaults the probe is black');
    await set('c_r', '1'); await set('c_g', true); await set('c_b', '1');
    t.ok(near(await px(), [255, 255, 255]), 'a range, a toggle and a choice each reach the projected frame at once');
    await set('c_tint', '#ff8000');
    const tinted = await px();
    t.ok(near(tinted, [255, 128, 0]), `and a colour (${tinted})`);
    t.ok(near(await px(1), [0, 0, 0]), 'the other surface keeps its own settings');
    const kept = await page.evaluate(() => window.app.project.surfaces[0].content.params);
    t.ok(kept.c_r === 1 && kept.c_g === true && kept.c_b === 1 && Math.abs(kept.c_tint[1] - 128 / 255) < 0.01, 'the surface keeps them by name in content.params');

    // a cue captures them
    await page.evaluate(() => document.getElementById('cueAdd').click());
    await set('c_r', '0');
    const cue = await page.evaluate(() => { const app = window.app; return app.project.cues[0].looks[app.project.surfaces[0].id].params; });
    t.ok(cue && cue.c_r === 1 && cue.c_g === true, 'a cue added from the current look captures its settings');
    await page.evaluate(() => window.app.show.go(0));
    await page.waitForTimeout(1200);
    const fromCue = await px();
    t.ok(near(fromCue, [255, 128, 0]), `and running the cue brings them back (${fromCue})`);

    // tapping the same look again keeps them; Reset goes back to the look's own
    await page.evaluate(() => document.querySelector('#trayTiles .tile[data-key="fx:probe"]').click());
    t.ok(near(await px(), [255, 128, 0]), 'tapping the look a surface already shows keeps its settings');
    await page.click('#trayParamsReset');
    t.ok(near(await px(), [0, 0, 0]) && !(await page.evaluate(() => window.app.project.surfaces[0].content.params)), 'Reset puts the look\'s own settings back');

    // All: every surface showing the look
    await page.evaluate(() => document.querySelector('#trayScope [data-all="1"]').click());
    const allTitle = await page.evaluate(() => document.getElementById('trayParamsTitle').textContent);
    await set('c_g', true);
    t.ok(/2 surfaces/.test(allTitle) && near(await px(0), [0, 255, 0]) && near(await px(1), [0, 255, 0]), `with All, a setting changes every surface showing the look ("${allTitle}")`);
    await page.evaluate(() => document.querySelector('#trayScope [data-all="0"]').click());

    // saved with the project
    await page.evaluate(() => window.app.save());
    await page.waitForTimeout(300);
    await page.reload();
    await page.waitForFunction(() => window.app && window.app.project.surfaces.length === 2);
    await page.evaluate(() => document.getElementById('connectSheet').close());
    t.ok(near(await px(1), [0, 255, 0]), 'settings are saved with the project and come back after a reload');

    // built-in looks: White light's colour, out as ISF and back in
    await page.evaluate(() => { const app = window.app; app.editor.select(0); app.setContent({ kind: 'effect', effect: 'white', params: { white_colour: [1, 0, 0] } }); });
    t.ok(near(await px(), [255, 0, 0]), 'a built-in look\'s setting (White light\'s colour) works too');
    await page.evaluate(() => { window.app.toggleDrawer(true); window.app.selectTab('content'); });
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#exportISF')]);
    const file = await readFile(await download.path(), 'utf8');
    const input = JSON.parse(file.match(/^\/\*([\s\S]*?)\*\//)[1]).INPUTS.find((i) => i.NAME === 'white_colour_rgba');
    t.ok(input && input.TYPE === 'color' && input.DEFAULT.join() === '1,0,0,1', 'exported as ISF, the setting is an input with the surface\'s value as its default');
    await page.setInputFiles('#importISF', { name: 'Red.fs', mimeType: 'text/plain', buffer: Buffer.from(file) });
    await page.waitForFunction(() => window.app.project.effects.length === 2, null, { timeout: 5000 }).catch(() => {});
    const imported = await page.evaluate(() => {
      const app = window.app, e = app.project.effects[1];
      return e && { content: app.project.surfaces[0].content.effect === e.id, params: app.lookParams(e.id).map((p) => `${p.kind}:${p.label}`) };
    });
    t.ok(imported && imported.content && imported.params.join() === 'colour:Colour', `imported back, it has the setting again (${imported && imported.params})`);
    t.ok(near(await px(), [255, 0, 0]), 'and draws with that value');
    t.ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  } finally {
    await browser.close(); server.close();
  }
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
