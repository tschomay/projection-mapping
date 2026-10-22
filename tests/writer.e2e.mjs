// The writer (app/writer.html, published as a Claude artifact) and the app's hand-off to it, without any real API.
// The app copies a request and opens the writer; the writer, with a stubbed window.claude sample(), writes the
// effect, shows it on the real surfaces, changes it on request and by hand, and makes the link back; the app opens
// that link, adds the effect where it was asked for, and another tab of the app takes the saved copy when shown.
import { serveApp, loadPlaywright, BROWSER_ARGS, reporter, setHidden } from './serve.mjs';

const solid = (rgb, note) => `${note}\n\`\`\`glsl\nvec3 fx_custom(Surf2 s, float t) {\n  return vec3(${rgb.join(', ')});\n}\n\`\`\``;
const BROKEN = 'Green.\n```glsl\nvec3 fx_custom(Surf2 s, float t) {\n  return vec3(0.0, 1.0, 0.0)\n}\n```';

export default async function run() {
  const t = reporter('writer');
  // settings written back as defaults: each kind keeps a valid GLSL literal and the rest of the line
  const { withDefaults, parseParams } = await import('../app/src/params.js');
  const src = 'vec3 c_col = vec3(1.0, 0.5, 0.0);   // param: Colour\nfloat c_n = 6.0;   // param: How many, 1..12, whole\nbool c_on = true; // param: Flash, toggle\nint c_shape = 0; // param: Shape, choice: A|B\nvec3 fx_custom(Surf2 s, float t) { return c_col; }';
  const out = withDefaults(src, { c_col: [0, 0.25, 1], c_n: 3, c_on: false, c_shape: 1 });
  t.ok(/vec3 c_col = vec3\(0\.0, 0\.25, 1\.0\);   \/\/ param: Colour/.test(out) && /float c_n = 3\.0;/.test(out) && /bool c_on = false;/.test(out) && /int c_shape = 1;/.test(out), 'withDefaults writes each kind of setting back as GLSL');
  t.ok(JSON.stringify(parseParams(out).map((p) => p.def)) === JSON.stringify([[0, 0.25, 1], 3, false, 1]), 'and reading it again gives those values');
  const { chromium } = await loadPlaywright();
  const server = await serveApp();
  const origin = new URL(server.url).origin;
  const browser = await chromium.launch({ args: BROWSER_ARGS });
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    await ctx.addInitScript(() => { window.__opened = []; window.open = (...a) => { window.__opened.push(a); return null; }; });

    // ---- the app: copy the request, open the writer ----
    const app = await ctx.newPage();
    app.on('pageerror', (e) => errors.push('app: ' + e.message));
    await app.goto(server.url);
    await app.waitForFunction(() => window.app && window.app.editor);
    await app.evaluate(() => { document.getElementById('connectSheet').close(); document.getElementById('toolsBtn').click(); window.app.selectTab('content'); });
    await app.evaluate(() => { window.app.addShape('square'); window.app.addShape('circle'); window.app.editor.select(0); });
    const ids = await app.evaluate(() => window.app.project.surfaces.map((s) => s.id));
    await app.fill('#aiPrompt', 'solid green');
    await app.click('#aiGo');
    await app.waitForFunction(() => /Copied/.test(document.getElementById('aiStatus').textContent), null, { timeout: 5000 }).catch(() => {});
    const handed = await app.evaluate(async () => ({ opened: window.__opened, clip: await navigator.clipboard.readText(), status: document.getElementById('aiStatus').textContent }));
    t.ok(handed.opened.length === 1 && /^https:\/\/claude\.ai\/artifact\//.test(handed.opened[0][0]), 'Write it with Claude opens the writer: ' + handed.opened[0]?.[0]);
    const packet = handed.clip.startsWith('SMW1 ') ? JSON.parse(handed.clip.slice(5)) : null;
    t.ok(packet && packet.v === 1 && packet.request === 'solid green' && packet.surfaces.length === 2 && /2 surfaces/.test(packet.context), 'and copies the request with the surfaces described');
    t.ok(packet && JSON.stringify(packet.target) === JSON.stringify([ids[0]]) && packet.back === origin + '/' && packet.frame.length === 2, 'for the selected surface, coming back to this page');
    t.ok(/long-press the box and Paste/.test(handed.status), 'the status says what to do in Claude: ' + handed.status);
    t.ok(await app.evaluate(() => !(window.app.project.effects || []).length), 'nothing is added yet');

    // ---- the writer, with Claude stubbed ----
    const wctx = await browser.newContext({ viewport: { width: 420, height: 860 } });
    await wctx.addInitScript(() => {
      window.__samples = []; window.__replies = [];
      const sample = async (input, opts) => {
        window.__samples.push(input); window.__tiers = (window.__tiers || []).concat([opts?.modelTier]);
        const r = window.__replies.shift();
        if (r && r.code) throw r;
        return { text: r, truncated: false };
      };
      window.claude = { use: async (name) => (name === 'sample' ? sample : null) };
    });
    const w = await wctx.newPage();
    w.on('pageerror', (e) => errors.push('writer: ' + e.message));
    await w.goto(server.url.replace('/?lowres', '/writer.html?lowres'));
    await w.waitForFunction(() => window.writer);
    t.ok(await w.evaluate(() => !document.getElementById('start').hidden && document.getElementById('again').hidden), 'the writer opens on the paste box, with nothing to repeat yet');

    // a point on the selected square that the circle (added second, so on top) doesn't cover, as drawn
    const centre = () => w.evaluate(async () => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const r = window.writer.renderer, gl = r.gl, px = new Uint8Array(4);
      r.render(0, { bass: 0, mid: 0, treble: 0, level: 0, beat: 0, beats: 0, active: false });
      gl.readPixels(Math.round(gl.canvas.width * 0.43), Math.round(gl.canvas.height * 0.6), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return [...px].slice(0, 3);
    });
    const versions = () => w.evaluate(() => window.writer.state().versions.length);

    await w.fill('#paste', 'hello');
    t.ok(/isn't a request/.test(await w.textContent('#pasteStatus')), 'pasting something else is explained');
    await w.evaluate(([a, b]) => { window.__replies.push(a, b); }, [BROKEN, solid([0, 1, 0], 'Solid green.')]);
    await w.fill('#paste', 'Copied from the app: ' + handed.clip);
    await w.waitForFunction(() => window.writer.state().versions.length === 1, null, { timeout: 30000 });
    const s1 = await w.evaluate(() => ({ samples: window.__samples, req: document.getElementById('reqText').textContent, note: document.getElementById('note').textContent, status: document.getElementById('status').textContent }));
    t.ok(/fx_custom/.test(s1.samples[0][0].content) && /2 surfaces/.test(s1.samples[0][0].content) && /solid green/.test(s1.samples[0][0].content), 'a paste starts writing: the instructions, the surfaces and the look in the first turn (sample has no system prompt)');
    t.ok(await w.evaluate(() => window.__tiers[0] === 'default'), 'on the default model tier');
    t.ok(s1.samples.length === 2 && s1.samples[1].length === 3 && /ERROR/i.test(s1.samples[1][2].content), 'a compile error gets one repair round');
    t.ok(/solid green/.test(s1.req) && /selected/.test(s1.req) && s1.note === 'Green.' && /Fixed a compile error/.test(s1.status), 'it shows the request, for which surface, and the note: ' + JSON.stringify([s1.req, s1.note, s1.status]));
    const green = await centre();
    t.ok(green[1] > 200 && green[0] < 40 && green[2] < 40, `the preview shows it on the real surface (${green})`);
    const link1 = await w.getAttribute('#send', 'href');
    t.ok(link1 && link1.startsWith(origin + '/#fx=') && (await w.getAttribute('#send', 'aria-disabled')) === 'false', 'Add to Surface Mapper links back to the app');

    // ask for a change
    await w.evaluate((a) => { window.__replies.push(a); }, 'Now red, with a setting.\n```glsl\nfloat c_red = 1.0;   // param: Red, 0..1\nvec3 fx_custom(Surf2 s, float t) {\n  return vec3(c_red, 0.0, 0.0);\n}\n```');
    await w.fill('#change', 'make it red');
    await w.click('#changeGo');
    await w.waitForFunction(() => window.writer.state().versions.length === 2, null, { timeout: 30000 });
    const ask = await w.evaluate(() => window.__samples[2][0].content);
    t.ok(/The current version/.test(ask) && /vec3\(0, 1, 0\)/.test(ask) && /Change it: make it red/.test(ask) && /solid green/.test(ask), 'a change sends the original request, the current code and what to change');
    const red = await centre();
    t.ok(red[0] > 200 && red[1] < 40, `the preview shows the new version, its setting at its default as in the app (${red})`);
    // its setting: dragging changes the preview, letting go makes it the default in the code that goes back
    t.ok(await w.evaluate(() => !document.getElementById('settings').hidden && document.querySelectorAll('#settingsBody input[type=range]').length === 1 && document.querySelector('#settingsBody span').textContent === 'Red'), 'the version\'s setting is offered under the preview');
    await w.evaluate(() => { const el = document.querySelector('#settingsBody input[type=range]'); el.value = '0.5'; el.dispatchEvent(new Event('input')); });
    const half = await centre();
    t.ok(half[0] > 100 && half[0] < 160, `dragging it changes the preview (${half})`);
    t.ok(!/c_red = 0\.5/.test(await w.inputValue('#code')), 'without changing the code yet');
    await w.evaluate(() => { document.querySelector('#settingsBody input[type=range]').dispatchEvent(new Event('change')); });
    await w.waitForFunction(() => /c_red = 0\.5;/.test(document.getElementById('code').value), null, { timeout: 5000 }).catch(() => {});
    t.ok(/float c_red = 0\.5;\s+\/\/ param: Red, 0\.\.1/.test(await w.inputValue('#code')), 'letting go makes it the default in the code, comment kept');
    t.ok((await centre())[0] < 160, 'and the preview keeps it');
    t.ok(await w.evaluate(() => document.querySelectorAll('#versions button').length === 2 && document.querySelector('#versions button[aria-pressed="true"]').textContent === '2' && document.getElementById('change').value === ''), 'it becomes version 2');

    // edit by hand: an error is shown and changes nothing; working code makes a version
    await w.click('#codeBox summary');
    await w.fill('#code', 'vec3 fx_custom(Surf2 s, float t) { return vec3(0.0, 0.0, 1.0) }');
    await w.waitForFunction(() => document.getElementById('codeStatus').classList.contains('bad'), null, { timeout: 5000 }).catch(() => {});
    t.ok(await w.evaluate(() => document.getElementById('codeStatus').classList.contains('bad') && window.writer.state().versions.length === 2), 'code that does not compile is reported and kept out');
    await w.fill('#code', 'vec3 fx_custom(Surf2 s, float t) { return vec3(0.0, 0.0, 1.0); }');
    await w.waitForFunction(() => window.writer.state().versions.length === 3, null, { timeout: 5000 }).catch(() => {});
    const blue = await centre();
    t.ok((await versions()) === 3 && blue[2] > 200 && blue[0] < 40, `a hand edit becomes version 3 and shows (${blue})`);
    await w.fill('#code', 'vec3 fx_custom(Surf2 s, float t) { return vec3(0.0, 1.0, 1.0); }');
    await w.waitForFunction(() => /0\.0, 1\.0, 1\.0/.test(window.writer.state().versions[2].code), null, { timeout: 5000 }).catch(() => {});
    t.ok((await versions()) === 3, 'more typing changes the same version');
    await w.waitForFunction(() => document.getElementById('send').getAttribute('href') && document.getElementById('send').getAttribute('href') !== window.__lastHref, null, { timeout: 5000 });
    await w.click('#versions button:first-child');
    t.ok((await centre())[1] > 200 && /vec3\(0, 1, 0\)/.test(await w.inputValue('#code')), 'tapping version 1 goes back to it');
    await w.click('#versions button:nth-child(3)');
    await w.waitForTimeout(200);
    const link = await w.getAttribute('#send', 'href');

    // the effect comes back to the app, in a new tab
    const back = await ctx.newPage();
    back.on('pageerror', (e) => errors.push('app tab 2: ' + e.message));
    await back.goto(link.replace(origin + '/', server.url));
    await back.waitForFunction(() => window.app && (window.app.project.effects || []).length === 1, null, { timeout: 10000 }).catch(() => {});
    const got = await back.evaluate(() => ({ fx: window.app.project.effects, surfaces: window.app.project.surfaces.map((s) => s.content.effect), hash: location.hash, saved: localStorage.getItem('pm.project.' + window.app.project.id) }));
    t.ok(got.fx?.length === 1 && /0\.0, 1\.0, 1\.0/.test(got.fx[0].code) && got.fx[0].name === 'solid green', 'the link adds the version that was showing');
    t.ok(/then: make it red; edited by hand/.test(got.fx?.[0]?.prompt), 'its prompt records the changes: ' + got.fx?.[0]?.prompt);
    t.ok(got.surfaces[0] === got.fx?.[0]?.id && got.surfaces[1] !== got.fx?.[0]?.id, 'it goes on the surface that was selected, not the other');
    t.ok(!got.hash && got.saved && JSON.parse(got.saved).effects.length === 1, 'it is saved at once and the link is cleared');

    // the first tab catches up when it's shown again, instead of saving over it later
    await setHidden(app, true); await setHidden(app, false);
    await app.waitForFunction(() => (window.app.project.effects || []).length === 1, null, { timeout: 5000 }).catch(() => {});
    t.ok(await app.evaluate(() => (window.app.project.effects || []).length === 1), 'the other tab takes the saved copy when it is shown again');

    // another look for the same surfaces, without pasting
    await w.click('#startOver');
    t.ok(await w.evaluate(() => !document.getElementById('again').hidden && /2 surfaces/.test(document.getElementById('againNote').textContent)), 'starting over offers another look for the same surfaces');
    await w.evaluate(() => { window.__replies.push({ code: 'rate_limited', message: 'slow down' }); });
    await w.fill('#againPrompt', 'purple fog');
    await w.click('#againGo');
    await w.waitForFunction(() => !document.getElementById('retry').hidden, null, { timeout: 10000 }).catch(() => {});
    const again = await w.evaluate(() => ({ last: window.__samples[window.__samples.length - 1][0].content, status: document.getElementById('status').textContent, retry: !document.getElementById('retry').hidden }));
    t.ok(/purple fog/.test(again.last) && /2 surfaces/.test(again.last), 'it writes for the remembered surfaces');
    t.ok(/Too many requests/.test(again.status) && again.retry, 'a failure is explained, with Try again: ' + again.status);
    await w.evaluate((a) => { window.__replies.push(a); }, solid([1, 0, 1], 'Purple.'));
    await w.click('#retry');
    await w.waitForFunction(() => window.writer.state().versions.length === 1, null, { timeout: 30000 }).then(() => t.ok(true, 'Try again writes it'), () => t.ok(false, 'Try again writes it'));

    t.ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  } finally {
    await browser.close(); server.close();
  }
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
