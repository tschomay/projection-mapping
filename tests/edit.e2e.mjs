// Quick editing without the drawer: Undo for every change to the surfaces' shapes, the bar for the selected
// surface, the long-press menu, Undo in the toast after deleting or picking a bigger shape, and joining two
// snapped surfaces into one.
import { serveApp, loadPlaywright, BROWSER_ARGS, reporter } from './serve.mjs';

export default async function run() {
  const t = reporter('edit');
  const { chromium } = await loadPlaywright();
  const server = await serveApp();
  const browser = await chromium.launch({ args: BROWSER_ARGS });
  const errors = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url);
    await page.waitForFunction(() => window.app && window.app.editor);
    await page.evaluate(() => { document.getElementById('connectSheet').close(); localStorage.clear(); });
    const S = () => page.evaluate(() => window.app.project.surfaces);
    const visible = (id) => page.evaluate((id) => { const el = document.getElementById(id); return !el.hidden && getComputedStyle(el).display !== 'none'; }, id);
    // a frame point (pixels) as a point on the page
    const at = (x, y) => page.evaluate(([x, y]) => { const r = window.app.editor.canvas.getBoundingClientRect(), [W, H] = window.app.frame; return [r.left + x / W * r.width, r.top + y / H * r.height]; }, [x, y]);
    const centre = (i) => page.evaluate((i) => { const g = window.app.geoms[i]; return [g.pins.reduce((a, p) => a + p[0], 0) / 4, g.pins.reduce((a, p) => a + p[1], 0) / 4]; }, i);
    const menu = () => page.evaluate(() => { const m = document.getElementById('ctxMenu'); return m.hidden ? null : [...m.querySelectorAll('button')].map((b) => b.textContent); });
    const clickMenu = (label) => page.evaluate((label) => [...document.querySelectorAll('#ctxMenu button')].find((b) => b.textContent === label).click(), label);
    const press = async (x, y, ms = 750) => { const [cx, cy] = await at(x, y); await page.mouse.move(cx, cy); await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up(); };

    t.ok(await page.evaluate(() => document.getElementById('undoBtn').disabled), 'Undo starts disabled');
    // Add, from the toolbar
    await page.click('#addBtn');
    t.ok((await menu())?.includes('Square'), 'Add opens a menu of shapes');
    await clickMenu('Square');
    t.ok((await S()).length === 1 && await visible('quickBar'), 'a square is added and selected, and the bar for it shows');
    t.ok(!(await page.evaluate(() => document.getElementById('undoBtn').disabled)), 'Undo is enabled');
    await page.waitForTimeout(100);

    // a drag is one undo step
    const pins0 = (await S())[0].pins;
    const [x0, y0] = await centre(0), [cx, cy] = await at(x0, y0);
    await page.mouse.move(cx, cy); await page.mouse.down();
    for (let k = 1; k <= 5; k++) await page.mouse.move(cx + k * 20, cy + k * 6);
    await page.mouse.up();
    const pins1 = (await S())[0].pins;
    t.ok(Math.abs(pins1[0][0] - pins0[0][0]) > 0.05, 'dragging moves the surface');
    // what it shows isn't part of undo
    await page.evaluate(() => { window.app.project.surfaces[0].content = { kind: 'effect', effect: 'plasma' }; window.app.changed(); });
    await page.click('#undoBtn');
    let s = await S();
    t.ok(JSON.stringify(s[0].pins) === JSON.stringify(pins0), 'Undo puts the surface back where it was');
    t.ok(s[0].content.effect === 'plasma', 'and keeps the content chosen since');
    await page.click('#undoBtn');
    t.ok((await S()).length === 0 && !(await visible('quickBar')), 'Undo again takes the new surface away, and the bar with it');

    // nudges in a row are one step; Ctrl+Z undoes
    await page.click('#addBtn'); await clickMenu('Square');
    const before = (await S())[0].pins;
    for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowRight');
    t.ok(Math.abs((await S())[0].pins[0][0] - before[0][0] - 4 / 1280) < 1e-6, 'the arrow keys move it 4 px');
    await page.keyboard.press('Control+z');
    t.ok(JSON.stringify((await S())[0].pins) === JSON.stringify(before), 'Ctrl+Z undoes the four nudges at once');

    // the bar: handle modes and Copy
    await page.click('#quickMode [data-mode="points"]');
    t.ok(await page.evaluate(() => window.app.editor.mode === 'points' && document.querySelector('#quickMode [data-mode="points"]').getAttribute('aria-pressed') === 'true'), 'Points in the bar switches the handles');
    await page.click('#quickMode [data-mode="warp"]');
    const bar = await page.evaluate(() => document.getElementById('quickBar').getBoundingClientRect().width / innerWidth);
    t.ok(bar < 0.5, `the bar takes under half the width (${Math.round(bar * 100)}%)`);
    await page.click('#quickMore');
    t.ok((await menu())?.includes('Duplicate') && (await menu())?.includes('Soft edge…'), 'More opens the surface menu');
    await clickMenu('Duplicate');
    t.ok((await S()).length === 2, 'Duplicate copies it');

    // taps: on the selected surface, its bar goes and comes back; on empty space, deselect, then the top buttons
    const tapAt = async (x, y) => { const [cx, cy] = await at(x, y); await page.mouse.click(cx, cy); };
    const sel = await page.evaluate(() => window.app.editor.sel);
    const [sx, sy] = await centre(sel);
    await tapAt(sx, sy);
    t.ok(!(await visible('quickBar')) && await page.evaluate((i) => window.app.editor.sel === i, sel), 'a tap on the selected surface hides its bar and keeps it selected');
    await tapAt(sx, sy);
    t.ok(await visible('quickBar'), 'another tap brings the bar back');
    await tapAt(1200, 360);
    t.ok(await page.evaluate(() => window.app.editor.sel === -1) && await visible('toolbar'), 'a tap on empty space deselects, and the top buttons stay');
    await tapAt(1200, 360);
    t.ok(!(await visible('toolbar')), 'a second tap on empty space hides the top buttons');
    await tapAt(1200, 360);
    t.ok(await visible('toolbar'), 'and a third brings them back');
    await page.evaluate((i) => window.app.editor.select(i), sel);
    await page.click('#toolsBtn');
    t.ok(!(await visible('quickBar')), 'the bar hides while the drawer is open');
    await page.click('#closeDrawer');
    t.ok(!(await visible('drawer')) && await visible('quickBar'), 'closing the drawer brings the bar back');

    // long press on a surface: its menu; Delete there, then Undo in the toast
    const [x1, y1] = await centre(1), pinsBefore = (await S())[1].pins;
    await press(x1, y1);
    const items = await menu();
    t.ok(items && items.includes('Delete surface') && items.includes('Duplicate') && items.includes('Join with surface 1'), 'a long press opens the surface\'s menu, offering to join the one it overlaps: ' + items);
    t.ok(JSON.stringify(pinsBefore) === JSON.stringify((await S())[1].pins), 'holding still doesn\'t move it');
    await clickMenu('Delete surface');
    t.ok((await S()).length === 1, 'Delete surface deletes it');
    t.ok(await page.evaluate(() => /deleted/.test(document.getElementById('toast').textContent) && !!document.querySelector('#toast button')), 'a toast says so, with Undo');
    await page.click('#toast button');
    t.ok((await S()).length === 2 && await page.evaluate(() => window.app.editor.sel === 1), 'Undo in the toast brings it back, selected');
    // a tap elsewhere closes a menu without doing anything else
    await press(x1, y1);
    const [ex, ey] = await at(640, 80);
    await page.mouse.click(ex, ey);
    t.ok(!(await menu()) && await page.evaluate(() => window.app.editor.sel === 1), 'a tap outside closes the menu and keeps the selection');
    // a corner held still is a careful drag, not a menu
    const pin = await page.evaluate(() => window.app.geoms[1].pins[2]);
    await press(pin[0], pin[1], 800);
    t.ok(!(await menu()), 'a long press on a corner handle doesn\'t open the menu');
    // long press on nothing: add a shape there
    await press(1100, 120);
    t.ok((await menu())?.[0] === 'Add a square here', 'a long press on nothing offers to add a shape there');
    await clickMenu('Add a circle here');
    const [ax, ay] = await centre(2);
    t.ok(Math.abs(ax - 1100) < 2 && Math.abs(ay - 120) < 2, 'and the circle is centred where the finger was');
    await page.click('#undoBtn');

    // two squares snapped edge to edge: Join makes them one
    await page.evaluate(() => {
      const app = window.app, sq = [[0, 0], [1, 0], [1, 1], [0, 1]], px = (q) => q.map(([x, y]) => [x / 1280, y / 720]);
      app.project.surfaces = [
        { id: 'l', pins: px([[300, 500], [500, 500], [500, 250], [300, 250]]), parts: [{ op: 1, pts: sq }], content: { kind: 'effect', effect: 'plasma' } },
        { id: 'r', pins: px([[500, 500], [700, 500], [700, 250], [500, 250]]), parts: [{ op: 1, pts: sq }], content: { kind: 'effect', effect: 'white' } },
        { id: 'x', pins: px([[1000, 300], [1100, 300], [1100, 200], [1000, 200]]), parts: [{ op: 1, pts: sq }], content: { kind: 'effect', effect: 'white' } },
      ];
      app.editor.select(0); app.changed();
    });
    await page.click('#quickMore');
    t.ok((await menu())?.includes('Join with surface 2'), 'Join shows in the menu for a surface that touches another');
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.app.editor.select(2));
    await page.click('#quickMore');
    t.ok(!(await menu())?.some((l) => l.startsWith('Join')), 'and not for one that touches nothing');
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.app.editor.select(0));
    await page.click('#quickMore'); await clickMenu('Join with surface 2');
    s = await S();
    t.ok(s.length === 2 && s[0].id === 'l' && s[0].parts.length === 1 && s[0].parts[0].pts.length === 4, 'Join makes the two squares one surface with one outline');
    t.ok(s[0].content.effect === 'plasma' && Math.abs(s[0].pins[1][0] - 700 / 1280) < 1e-6, 'it keeps the first one\'s content, and its corners are the outer ones');
    const lit = await page.evaluate(() => {
      const app = window.app; app.sync(); app.renderer.render(1, app.audio.state, null);
      const gl = app.renderer.gl, c = app.renderer.canvas, [W, H] = app.frame, px = new Uint8Array(4);
      return [[400, 375], [500, 375], [600, 375]].map(([x, y]) => { gl.readPixels(Math.round(x / W * c.width), Math.round(c.height - 1 - y / H * c.height), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return px[0] + px[1] + px[2]; });
    });
    t.ok(lit.every((v) => v > 0), `the joined surface is lit on both halves and across the old seam (${lit})`);
    t.ok(await page.evaluate(() => /one surface/.test(document.getElementById('toast').textContent) && !!document.querySelector('#toast button')), 'a toast says so, with Undo');
    await page.click('#toast button');
    s = await S();
    t.ok(s.length === 3 && s.map((x) => x.id).join() === 'l,r,x' && s[1].content.effect === 'white', 'Undo splits them again, each with its own content');

    // tapping inside a picked shape for the one around it: Undo in the toast goes back to the smaller one
    const pick = await page.evaluate(async () => {
      const app = window.app, sq = [[0, 0], [1, 0], [1, 1], [0, 1]], px = (q) => q.map(([x, y]) => [x / 1280, y / 720]);
      const small = { pins: px([[300, 500], [500, 500], [500, 250], [300, 250]]), parts: [{ op: 1, pts: sq }] };
      const big = { pins: px([[250, 550], [550, 550], [550, 200], [250, 200]]), parts: [{ op: 1, pts: sq }] };
      app.photoPixels = () => ({}); app.backdropQuad = () => null;   // no photo needed: the candidates are given
      app.pickLast = { kind: app.pickKind, id: 'l', idx: 0, found: [small, big] };
      app.sync();
      await app.pickAt([400, 375]);
      const grown = app.project.surfaces[0].pins[0][0];
      const toast = document.getElementById('toast').textContent, hasUndo = !!document.querySelector('#toast button');
      document.querySelector('#toast button')?.click();
      return { grown, toast, hasUndo, back: app.project.surfaces[0].pins[0][0], idx: app.pickLast?.idx };
    });
    t.ok(Math.abs(pick.grown - 250 / 1280) < 1e-6 && /next one out/.test(pick.toast) && pick.hasUndo, 'a tap inside a picked shape takes the one around it, with Undo in the toast');
    t.ok(Math.abs(pick.back - 300 / 1280) < 1e-6 && pick.idx === 0, 'Undo goes back to the smaller shape, and picking carries on from it');

    // a new project starts with nothing to undo
    await page.evaluate(() => document.getElementById('newProj').click());
    t.ok(await page.evaluate(() => document.getElementById('undoBtn').disabled), 'a new project has nothing to undo');
    t.ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  } finally {
    await browser.close(); server.close();
  }
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
