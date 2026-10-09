// AI-written effects (roadmap #9) without calling the real API: the SDK module the app loads from the CDN is
// replaced by a fake that records each request and answers from a script. Checks the request (model, fallbacks,
// the surfaces described), the one compile-repair round, applying the effect, refusals, and the key handling.
import { serveApp, loadPlaywright, BROWSER_ARGS, reporter } from './serve.mjs';

const FAKE_SDK = `
class APIError extends Error {}
class AuthenticationError extends APIError {}
class RateLimitError extends APIError {}
class APIConnectionError extends APIError {}
export default class Anthropic {
  static APIError = APIError; static AuthenticationError = AuthenticationError;
  static RateLimitError = RateLimitError; static APIConnectionError = APIConnectionError;
  constructor(opts) {
    window.__aiClient = opts;
    this.beta = { messages: { stream: (params) => {
      window.__aiRequests.push(JSON.parse(JSON.stringify(params)));
      const reply = window.__aiReplies.shift();
      return { finalMessage: async () => { if (reply instanceof Error) throw reply; return reply; } };
    } } };
  }
}`;

const msg = (text, stop = 'end_turn') => ({ role: 'assistant', stop_reason: stop, content: [{ type: 'thinking', thinking: '', signature: 'sig' }, { type: 'text', text }] });
const BROKEN = 'Rippling blue rings.\n```glsl\nvec3 fx_custom(Surf2 s, float t) {\n  float r = c_ring(s.uv)\n  return vec3(0.1, 0.4, 1.0) * r;\n}\n```';
const FIXED = 'Fixed.\n```glsl\nfloat c_ring(vec2 uv) { return 0.5 + 0.5 * sin(length(uv - 0.5) * 30.0); }\nvec3 fx_custom(Surf2 s, float t) {\n  float r = c_ring(s.uv + t * 0.1);\n  return vec3(0.1, 0.4, 1.0) * r * (0.6 + uBeat);\n}\n```';

export default async function run() {
  const t = reporter('ai');
  const { chromium } = await loadPlaywright();
  const server = await serveApp();
  const browser = await chromium.launch({ args: BROWSER_ARGS });
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
    await ctx.route(/cdn\.jsdelivr\.net\/npm\/@anthropic-ai\/sdk/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: FAKE_SDK }));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url);
    await page.waitForFunction(() => window.app && window.app.editor);
    await page.evaluate(() => { document.getElementById('connectSheet').close(); document.getElementById('toolsBtn').click(); window.app.selectTab('content'); window.__aiRequests = []; window.__aiReplies = []; });
    await page.evaluate(() => { document.querySelector('[data-add="square"]').click(); document.querySelector('[data-add="triangle"]').click(); window.app.editor.select(-1); });

    t.ok(await page.evaluate(() => document.getElementById('aiGo').disabled), 'Write it is off until there is a key');
    await page.fill('#aiKey', 'not-a-key'); await page.click('#aiKeySave');
    t.ok(/doesn't look like/.test(await page.textContent('#aiStatus')), 'a malformed key is refused');
    await page.fill('#aiKey', 'sk-ant-test-123'); await page.click('#aiKeySave');
    t.ok(await page.evaluate(() => !document.getElementById('aiGo').disabled && document.getElementById('aiKeyRow').hidden), 'a key is saved and the button turns on');

    // a broken first answer, then the repair
    await page.evaluate(([a, b]) => { window.__aiReplies.push(a, b); }, [msg(BROKEN), msg(FIXED)]);
    await page.fill('#aiPrompt', 'rippling blue rings that pulse on the beat');
    await page.click('#aiGo');
    await page.waitForFunction(() => !document.getElementById('aiCancel').hidden === false && window.__aiRequests.length >= 2 && document.getElementById('aiStatus').textContent && !/Writing|Fixing/.test(document.getElementById('aiStatus').textContent), null, { timeout: 30000 });
    const r = await page.evaluate(() => ({ reqs: window.__aiRequests, client: window.__aiClient, status: document.getElementById('aiStatus').textContent, effects: window.app.project.effects, contents: window.app.project.surfaces.map((s) => s.content.effect), compiled: window.app.renderer.effects.map((e) => e.id) }));
    const [q1, q2] = r.reqs;
    t.ok(q1.model === 'claude-opus-5-5' && q1.fallbacks === 'default' && q1.betas.includes('server-side-fallback-2026-07-01') && q1.output_config.effort === 'medium', 'the request names the model, effort and refusal fallback');
    t.ok(r.client.apiKey === 'sk-ant-test-123' && r.client.dangerouslyAllowBrowser === true, "the client uses the user's key, in the browser");
    t.ok(/2 surfaces/.test(q1.messages[0].content) && /triangle/.test(q1.messages[0].content) && /rippling blue rings/.test(q1.messages[0].content), 'the prompt describes the actual surfaces and the look');
    t.ok(q2 && q2.messages.length === 3 && q2.messages[1].role === 'assistant' && q2.messages[1].content[0].type === 'thinking' && /compile/.test(q2.messages[2].content) && /ERROR/i.test(q2.messages[2].content), 'a compile error is sent back once, with the reply unchanged and the log');
    t.ok(r.effects.length === 1 && r.compiled.includes(r.effects[0].id), 'the repaired effect is saved in the project and compiled');
    t.ok(r.contents.every((c) => c === r.effects[0].id), 'with no surface selected, every surface shows it');
    t.ok(/Fixed a compile error/.test(r.status), 'the status mentions the repair: ' + r.status);
    t.ok(await page.evaluate(() => document.querySelectorAll('#effectList .chip.own').length === 1), 'it appears in the effect list');

    // a refusal
    await page.evaluate((m) => { window.__aiReplies.push(m); }, msg('', 'refusal'));
    await page.fill('#aiPrompt', 'something else'); await page.click('#aiGo');
    await page.waitForFunction(() => /declined/.test(document.getElementById('aiStatus').textContent), null, { timeout: 10000 }).then(() => t.ok(true, 'a refusal is reported'), () => t.ok(false, 'a refusal is reported'));
    t.ok(await page.evaluate(() => window.app.project.effects.length === 1), 'nothing is added on a refusal');

    // the key never travels with the project
    const exported = await page.evaluate(() => JSON.stringify(window.app.project));
    t.ok(!exported.includes('sk-ant'), 'the project holds no key');
    // deleting the effect puts the surfaces back on the alignment grid
    await page.click('#effectList .chip.own [data-del]');
    t.ok(await page.evaluate(() => !window.app.project.effects.length && window.app.project.surfaces.every((s) => s.content.effect === 'outline')), 'deleting the effect resets the surfaces using it');
    await page.click('#aiKeyForget');
    t.ok(await page.evaluate(() => !localStorage.getItem('pm.anthropicKey') && document.getElementById('aiGo').disabled), 'Forget my key removes it');
    t.ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  } finally {
    await browser.close(); server.close();
  }
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
