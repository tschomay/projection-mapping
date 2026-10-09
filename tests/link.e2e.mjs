// Browser checks for connecting a projector (roadmap #2): the connect guide, the Show-mode hint, and a second
// screen through the Presentation API on "another device". The receiver runs in a separate browser context, so
// the editor's object URLs don't open there; a fake PresentationConnection pair is relayed by this script.
import { serveApp, loadPlaywright, BROWSER_ARGS, reporter } from './serve.mjs';

const FAKE_CONNECTION = `
window.__mkConn = () => {
  const c = new EventTarget();
  c.state = 'connected'; c.id = 'fake'; c.binaryType = 'arraybuffer';
  c.send = (d) => {
    if (typeof d === 'string') window.__relay({ s: d });
    else { const u = new Uint8Array(d); let b = ''; for (let i = 0; i < u.length; i += 0x8000) b += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); window.__relay({ b: btoa(b) }); }
  };
  c.terminate = () => { c.state = 'terminated'; c.dispatchEvent(new Event('terminate')); };
  window.__deliver = (m) => {
    let data = m.s;
    if (m.b !== undefined) { const s = atob(m.b); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); data = u.buffer; }
    c.dispatchEvent(new MessageEvent('message', { data }));
  };
  return c;
};`;

export default async function run() {
  const t = reporter('link');
  const { chromium } = await loadPlaywright();
  const server = await serveApp();
  const browser = await chromium.launch({ args: BROWSER_ARGS });
  const errors = [];
  try {
    const ctxA = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
    const ed = await ctxA.newPage();
    ed.on('pageerror', (e) => errors.push('editor: ' + e.message));
    await ed.addInitScript(FAKE_CONNECTION);
    await ed.goto(server.url);
    await ed.waitForFunction(() => window.app && window.app.editor);
    t.ok(await ed.evaluate(() => document.getElementById('connectSheet').open), 'connect guide opens on first run');
    await ed.click('#closeConnect');
    await ed.reload(); await ed.waitForFunction(() => window.app && window.app.editor);
    t.ok(!(await ed.evaluate(() => document.getElementById('connectSheet').open)), 'connect guide stays closed afterwards');

    await ed.click('#showBtn');
    t.ok(await ed.evaluate(() => !document.getElementById('toast').hidden), 'Show-mode hint on first Show');
    await ed.keyboard.press('Escape');
    await ed.waitForFunction(() => !document.body.classList.contains('show'));
    await ed.click('#showBtn');
    t.ok(await ed.evaluate(() => document.getElementById('toast').hidden || !/Double-tap/.test(document.getElementById('toast').textContent)), 'no hint once Show mode has been left');
    await ed.keyboard.press('Escape');

    // a surface showing an image
    await ed.evaluate(() => document.getElementById('toolsBtn').click());
    await ed.click('[data-add="square"]');
    await ed.evaluate(() => window.app.editor.select(0));
    await ed.setInputFiles('#addMedia', new URL('../app/icon-192.png', import.meta.url).pathname);
    await ed.waitForFunction(() => window.app.project.surfaces[0].content.kind === 'media');
    const mediaId = await ed.evaluate(() => window.app.project.surfaces[0].content.mediaId);

    // the receiver: a separate context with a fake presentation receiver
    const ctxB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const rx = await ctxB.newPage();
    rx.on('pageerror', (e) => errors.push('receiver: ' + e.message));
    await rx.addInitScript(FAKE_CONNECTION + `
      const conn = window.__mkConn();
      Object.defineProperty(navigator, 'presentation', { value: { receiver: { connectionList: Promise.resolve({ connections: [conn] }) } } });`);
    let qA = Promise.resolve(), qB = Promise.resolve();   // keep message order, as a real connection does
    await rx.exposeFunction('__relay', (m) => { qA = qA.then(() => ed.evaluate((x) => window.__deliver && window.__deliver(x), m)).catch(() => {}); });
    await ed.exposeFunction('__relay', (m) => { qB = qB.then(() => rx.evaluate((x) => window.__deliver(x), m)).catch(() => {}); });
    await rx.goto(server.url + '#output');
    await rx.waitForFunction(() => !!window.app);
    t.ok(await rx.evaluate(() => document.getElementById('gate').hidden), 'a second screen starts without a tap');
    await ed.evaluate(() => window.app.addPresentation(window.__mkConn()));
    await ed.waitForFunction(() => window.app.output.connected, null, { timeout: 60000 });
    const st = await ed.evaluate(() => ({ state: document.getElementById('outputState').textContent, aspect: window.app.output.aspect }));
    t.ok(/second screen/.test(st.state) && Math.abs(st.aspect - 16 / 9) < 0.01, 'the editor sees the second screen and takes its shape');
    const got = await rx.waitForFunction((id) => { const m = window.app.media.get(id); return m && m.file && m.el.naturalWidth === 192; }, mediaId, { timeout: 60000 }).then(() => true, () => false);
    t.ok(got, 'the receiver asked for the image and got the file');
    t.ok(await rx.evaluate(() => window.app.project.surfaces.length === 1), 'the receiver has the project');
    await ed.evaluate(() => { window.app.editor.select(0); window.app.editor.nudge(40, 0); });
    const want = await ed.evaluate(() => window.app.project.surfaces[0].pins[0][0]);
    t.ok(await rx.waitForFunction((w) => Math.abs(window.app.project.surfaces[0].pins[0][0] - w) < 1e-9, want, { timeout: 60000 }).then(() => true, () => false), 'live edits reach the receiver');
    // a bigger file (3 MB, more chunks than the sender keeps in flight): paced by acknowledgements, arrives intact
    const big = Buffer.alloc(3 * 1024 * 1024);
    for (let i = 0; i < big.length; i++) big[i] = (i * 2654435761 >>> 24) & 255;
    const sum = (bytes) => { let h = 0; for (let i = 0; i < bytes.length; i += 97) h = (h * 31 + bytes[i]) >>> 0; return h; };
    await ed.setInputFiles('#addMedia', { name: 'big.png', mimeType: 'image/png', buffer: big });
    const bigId = await ed.waitForFunction(() => window.app.media.list().find((m) => m.name === 'big.png')?.id, null, { timeout: 30000 }).then((h) => h.jsonValue());
    const bigSize = await rx.waitForFunction((id) => { const m = window.app.media.get(id); return m && m.file ? m.file.size : 0; }, bigId, { timeout: 240000 }).then((h) => h.jsonValue(), () => 0);
    t.ok(bigSize === big.length, `a 3 MB file reaches the receiver (${bigSize} bytes)`);
    const rxSum = await rx.evaluate(async ([id, step]) => { const b = new Uint8Array(await window.app.media.get(id).file.arrayBuffer()); let h = 0; for (let i = 0; i < b.length; i += step) h = (h * 31 + b[i]) >>> 0; return h; }, [bigId, 97]);
    t.ok(rxSum === sum(big), 'and arrives byte for byte');
    t.ok(await ed.waitForFunction(() => /big\.png is on the screen/.test(document.getElementById('toast').textContent), null, { timeout: 30000 }).then(() => true, () => false), 'the editor shows the transfer finishing');
    await ed.evaluate(() => document.getElementById('presentBtn').click());
    t.ok(await ed.evaluate(() => !window.app.presenting && document.getElementById('presentBtn').textContent === 'Present to a screen'), 'stop presenting');
    t.ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  } finally {
    await browser.close(); server.close();
  }
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
