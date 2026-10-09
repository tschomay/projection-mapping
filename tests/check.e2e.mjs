// The device check screen: it lists what this browser supports and can test the camera (Chromium's fake one).
import { serveApp, loadPlaywright, BROWSER_ARGS, reporter } from './serve.mjs';

export default async function run() {
  const t = reporter('check');
  const { chromium } = await loadPlaywright();
  const server = await serveApp();
  const browser = await chromium.launch({ args: [...BROWSER_ARGS, '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, permissions: ['camera'] });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url);
    await page.waitForFunction(() => window.app && window.app.editor);
    await page.evaluate(() => { document.getElementById('connectSheet').close(); document.getElementById('checkBtn').click(); });
    await page.waitForFunction(() => document.querySelectorAll('#checkList li').length >= 8);
    const labels = await page.$$eval('#checkList li b', (els) => els.map((e) => e.textContent));
    t.ok(['Graphics', 'Frame rate', 'Keep screen awake', 'Video formats', 'Storage for media'].every((l) => labels.includes(l)), 'lists the key capabilities');
    await page.click('#checkCamera');
    await page.waitForFunction(() => [...document.querySelectorAll('#checkList li b')].some((b) => b.textContent === 'Exposure lock'), null, { timeout: 20000 });
    const cam = await page.$eval('#checkList', (el) => el.textContent);
    t.ok(/Camera\d+ × \d+/.test(cam), 'the camera test reports a resolution');
    t.ok(await page.evaluate(() => !window.app.camera.stream), 'the camera is closed again afterwards');
    await page.screenshot({ path: process.env.SHOTS ? process.env.SHOTS + '/check.png' : '/dev/null' }).catch(() => {});
    t.ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  } finally {
    await browser.close(); server.close();
  }
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
