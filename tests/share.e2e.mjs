// One-tap project links (share.js): a project packed into #import= opens as a new project in a fresh browser,
// with its surfaces, own effects and cues; inside a Claude artifact the button opens the installed app instead.
import { serveApp, loadPlaywright, BROWSER_ARGS, reporter } from './serve.mjs';

export default async function run() {
  const t = reporter('share');
  const { chromium } = await loadPlaywright();
  const server = await serveApp();
  const browser = await chromium.launch({ args: BROWSER_ARGS });
  const errors = [];
  const ready = async (page) => {
    page.on('pageerror', (e) => errors.push(e.message));
    await page.waitForFunction(() => window.app && window.app.editor);
    await page.evaluate(() => document.getElementById('connectSheet').close());
  };
  try {
    // build a project: two surfaces, a Halloween effect, an own effect and a cue
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await ctx.newPage();
    await page.goto(server.url);
    await ready(page);
    await page.evaluate(() => {
      document.querySelector('[data-add="square"]').click(); document.querySelector('[data-add="circle"]').click();
      const app = window.app, p = app.project;
      p.name = 'Kitchen bats';
      p.effects = [{ id: 'u1', name: 'Mine', prompt: 'mine', code: 'vec3 fx_custom(Surf2 s, float t) { return vec3(s.uv, 0.0); }' }];
      p.surfaces[0].content = { kind: 'effect', effect: 'bats' };
      p.surfaces[1].content = { kind: 'effect', effect: 'u1' };
      p.cues = [{ id: 'c1', name: 'Cue 1', looks: {}, start: { mode: 'tap', value: 0 }, transition: { type: 'fade', dur: 1 } }];
      app.changed();
      document.getElementById('toolsBtn').click(); app.selectTab('project');
    });
    t.ok(await page.textContent('#sendLink') === 'Share a link', 'outside an artifact the button shares a link');
    await page.click('#sendLink');
    await page.waitForFunction(() => document.querySelector('#linkStatus a'));
    const url = await page.getAttribute('#linkStatus a', 'href');
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
    t.ok(url.startsWith(server.url.split('?')[0]) && url.includes('#import='), 'the link points at this app with the project in the fragment');
    t.ok(clip === url, 'the link is copied');
    t.ok(url.length < 4000, `the link is short enough to paste anywhere (${url.length} characters)`);
    const sent = await page.evaluate(() => JSON.stringify({ s: window.app.project.surfaces.map((s) => [s.pins, s.content]), e: window.app.project.effects, c: window.app.project.cues.length }));

    // open it in a fresh browser
    const ctx2 = await browser.newContext({ viewport: { width: 844, height: 390 } });
    const page2 = await ctx2.newPage();
    await page2.goto(url.replace('#', '?lowres#'));
    await ready(page2);
    await page2.waitForFunction(() => window.app.project.name === 'Kitchen bats', null, { timeout: 10000 }).catch(() => {});
    const got = await page2.evaluate(() => ({ name: window.app.project.name, data: JSON.stringify({ s: window.app.project.surfaces.map((s) => [s.pins, s.content]), e: window.app.project.effects, c: window.app.project.cues.length }), hash: location.hash, compiled: window.app.renderer.effects.map((e) => e.id), toast: document.getElementById('toast').textContent }));
    t.ok(got.name === 'Kitchen bats' && got.data === sent, 'the project arrives whole: surfaces, effects and cues');
    t.ok(got.hash === '', 'the fragment is cleared, so a reload does not import it again');
    t.ok(/from the link/.test(got.toast), 'a message says where it came from');
    t.ok(got.compiled.includes('bats') && got.compiled.includes('u1') && !got.compiled.includes('plasma'), 'only the effects in use are compiled: ' + got.compiled.join(','));
    await page2.reload(); await ready(page2);
    t.ok(await page2.evaluate(() => window.app.project.name === 'Kitchen bats'), 'and it was saved on this device');

    // a damaged link
    const page3 = await ctx2.newPage();
    await page3.goto(server.url + '#import=H4sIAAAA');
    await ready(page3);
    await page3.waitForFunction(() => /damaged/.test(document.getElementById('toast').textContent), null, { timeout: 5000 }).then(() => t.ok(true, 'a damaged link is reported'), () => t.ok(false, 'a damaged link is reported'));

    // inside a Claude artifact: the button opens the installed app with the project
    const ctx3 = await browser.newContext({ viewport: { width: 844, height: 390 } });
    await ctx3.addInitScript(() => { window.claude = { use: async () => null }; });
    await ctx3.route('https://surface-mapper-alpha.vercel.app/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }));
    const page4 = await ctx3.newPage();
    await page4.goto(server.url);
    await ready(page4);
    await page4.evaluate(() => { document.querySelector('[data-add="square"]').click(); document.getElementById('toolsBtn').click(); window.app.selectTab('project'); });
    t.ok(await page4.textContent('#sendLink') === 'Open in Surface Mapper', 'in an artifact the button opens Surface Mapper');
    await page4.waitForFunction(() => document.getElementById('sendLink').href.includes('#import='));
    const before = await page4.getAttribute('#sendLink', 'href');
    await page4.evaluate(() => { document.querySelector('[data-add="circle"]').click(); window.app.save(); });
    await page4.waitForFunction((b) => document.getElementById('sendLink').href !== b, before, { timeout: 15000 }).then(() => t.ok(true, 'the link follows edits'), () => t.ok(false, 'the link follows edits'));
    const [popup] = await Promise.all([ctx3.waitForEvent('page', { timeout: 30000 }).catch(() => null), page4.click('#sendLink')]);
    t.ok(popup && popup.url().startsWith('https://surface-mapper-alpha.vercel.app/#import='), 'one tap opens the app with the project (a plain link): ' + (popup && popup.url().slice(0, 60)));
    t.ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  } finally {
    await browser.close(); server.close();
  }
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
