// AI-written effects (roadmap #9): describe a look, and an AI model writes a new effect for the mapped surfaces.
// Three ways to reach a model, tried in this order:
// - Running as a Claude artifact: the viewer's own Claude plan, through the artifact runtime's `sample`
//   capability. No key; Claude asks the viewer once before the first request.
// - A Gemini API key (AIza…): Google's Interactions API, called straight from the browser.
// - An Anthropic API key (sk-ant-…): the Claude API through the official SDK, loaded from a CDN when first needed.
// Keys stay on this device only (never in project files), and the rest of the app still works offline.
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.127.0/+esm';
const MODEL = 'claude-opus-5-5';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_MODEL = 'gemini-3.8-flash';
const KEY_STORES = { anthropic: 'pm.anthropicKey', gemini: 'pm.geminiKey' };

export const keyKind = (k) => /^sk-ant-/.test(k) ? 'anthropic' : /^AIza[\w-]{30,}$/.test(k) ? 'gemini' : null;
const load = (name) => { try { return localStorage.getItem(name) || ''; } catch { return ''; } };
export function getKey() { return load(KEY_STORES.gemini) || load(KEY_STORES.anthropic); }
// saving a key replaces any other; an empty key forgets both
export function setKey(k) {
  try {
    for (const name of Object.values(KEY_STORES)) localStorage.removeItem(name);
    if (k) localStorage.setItem(KEY_STORES[keyKind(k)], k);
    return true;
  } catch { return false; }
}

// the viewer's Claude plan when the app runs as a Claude artifact, else null (decided at once outside one)
let planPromise = null;
export function claudePlan() {
  if (!window.claude?.use) return Promise.resolve(null);
  return planPromise ||= Promise.resolve(window.claude.use('sample')).catch(() => null);
}

const SYSTEM = `You write visual effects for Surface Mapper, a projection mapping app. A projector lights real objects; the app maps flat "surfaces" onto them, and every surface runs an effect: a GLSL ES 3.00 function that returns the colour for one pixel.

Write exactly one function with this signature:

vec3 fx_custom(Surf2 s, float t)

t is time in seconds. Surf2 has:
  vec2 uv;      // 0..1 between the surface's four corner pins (u right, v up). Perspective-correct on the real flat surface.
  vec2 px;      // frame pixel, (0,0) top-left
  vec2 screen;  // 0..1 across the whole projector frame (x right, y up). Continuous across neighbouring surfaces, so use it for effects that should flow from one surface to the next.
  float id;     // surface number, 0..count-1
  float count;  // number of surfaces
  float edge;   // distance to the surface's outline in frame pixels (exact up to 64)
  vec2 size;    // rough surface size in frame pixels (width, height)

Available everywhere:
  uniform vec2 uRes;               // frame size in pixels (1280 wide)
  uniform vec4 uAudio;             // bass, mid, treble, overall level, each 0..1
  uniform float uBeat;             // jumps to 1 on each beat of the music, then decays
  uniform float uBeats;            // beats counted so far
  uniform float uHasAudio;         // 1 when music or the microphone is being analysed, else 0
  float hash1(vec3 p); float hash2(vec2 p);   // 0..1 hashes
  float noise(vec3 x); float fbm(vec3 p);    // value noise, 0..1
  vec3 hsv(float h, float s, float v);
  vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d);   // cosine palette

Rules:
- Projected light only adds: black is "off", so use black backgrounds and bright, saturated colours. Bright edges (exp(-s.edge / 3.0)) read well on real objects.
- When the look should react to music, also make it move without sound (check uHasAudio).
- Name any helper functions with a c_ prefix (c_ring, c_rotate). No uniforms, textures, #version or main().
- It runs on phones: keep loops short (under 32 iterations) and avoid raymarching.
- Reply with one short sentence describing the look, then the code in a single \`\`\`glsl block.`;

// describe the actual surfaces so the effect can suit them
export function describeSurfaces(surfaces, geoms, frame) {
  if (!surfaces.length) return 'There are no surfaces yet.';
  const lines = surfaces.map((s, i) => {
    const g = geoms[i];
    const shape = s.parts.length > 1 ? `${s.parts.length} combined shapes` : s.parts[0].pts.length > 12 ? 'a circle' : s.parts[0].pts.length === 3 ? 'a triangle' : 'a four-sided shape';
    const cx = s.pins.reduce((a, p) => a + p[0], 0) / 4, cy = s.pins.reduce((a, p) => a + p[1], 0) / 4;
    return `- surface ${i}: ${shape}, about ${Math.round(g.size[0])} x ${Math.round(g.size[1])} px, centred at screen (${cx.toFixed(2)}, ${(1 - cy).toFixed(2)})`;
  });
  return `The projector frame is ${frame[0]} x ${frame[1]} px. ${surfaces.length} surface${surfaces.length === 1 ? '' : 's'}:\n${lines.join('\n')}`;
}

export function extractCode(text) {
  const m = text.match(/```(?:glsl)?\s*\n([\s\S]*?)```/);
  const code = (m ? m[1] : text).trim();
  return /vec3\s+fx_custom\s*\(/.test(code) ? code : null;
}

// --- the three backends. ask(turns, signal) takes [{ role: 'user'|'assistant', content, raw? }] and returns
// { text, raw }; raw is the reply as the API gave it, handed back unchanged in a repair round.

let sdk = null;
async function anthropicBackend(apiKey) {
  if (!sdk) {
    try { sdk = (await import(SDK_URL)).default; } catch { throw new Error("Couldn't load the Claude SDK. Check the internet connection."); }
  }
  const c = new sdk({ apiKey, dangerouslyAllowBrowser: true });   // the user's own key, on their own device
  return {
    name: 'Claude',
    async ask(turns, signal) {
      const stream = c.beta.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        system: SYSTEM,
        output_config: { effort: 'medium' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        messages: turns.map((m) => ({ role: m.role, content: m.raw || m.content })),
      }, { signal });
      const msg = await stream.finalMessage();
      if (msg.stop_reason === 'refusal') throw new Error('Claude declined that request. Try describing the look differently.');
      return { text: msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n'), raw: msg.content };
    },
    explain(err) {
      if (err instanceof sdk.AuthenticationError) return 'That API key was refused. Check it in Content → Describe a look.';
      if (err instanceof sdk.RateLimitError) return 'Rate limited by the API. Wait a moment and try again.';
      if (err instanceof sdk.APIConnectionError) return "Couldn't reach the Claude API. Check the internet connection.";
      if (err instanceof sdk.APIError) return `The API returned an error${err.status ? ' (' + err.status + ')' : ''}: ${err.message}`;
      return null;
    },
  };
}

// The artifact runtime's sample(): no system prompt and no memory, so the instructions lead the first turn.
const PLAN_ERRORS = {
  not_granted: 'Claude needs your OK to write effects. Reload and allow it when asked.',
  rate_limited: 'Too many requests just now. Wait a minute and try again.',
  queue_overflow: 'Too many requests just now. Wait a minute and try again.',
  refused: 'Claude declined that request. Try describing the look differently.',
  sampling_disabled: "Writing with Claude is turned off for this account, so it can't write effects here.",
  capability_disabled: "Writing with Claude is turned off for this account, so it can't write effects here.",
  session_expired: 'Your Claude session expired. Reload the page and sign in again.',
  empty_completion: 'Claude sent back an empty answer. Try again.',
  upstream_error: "Couldn't reach Claude just now. Try again in a moment.",
};
function planBackend(sample) {
  return {
    name: 'Claude',
    async ask(turns, signal) {
      const input = turns.map((m, i) => ({ role: m.role, content: i === 0 ? `${SYSTEM}\n\n${m.content}` : m.content }));
      const { text } = await sample(input, { signal, modelTier: 'default' });
      return { text };
    },
    explain(err) { return err && typeof err.code === 'string' ? PLAN_ERRORS[err.code] || `Claude couldn't write it (${err.code}).` : null; },
  };
}

// Gemini through the Interactions API, one stateless request per round (store: false keeps nothing on
// Google's side); a repair round sends the earlier turns again as text.
class GeminiError extends Error {}
function geminiBackend(apiKey) {
  return {
    name: 'Gemini',
    async ask(turns, signal) {
      const input = turns.length === 1 ? turns[0].content
        : turns.map((m) => `${m.role === 'user' ? 'USER' : 'YOU'}:\n${m.content}`).join('\n\n');
      let res;
      try {
        res = await fetch(GEMINI_URL, {
          method: 'POST', signal,
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({ model: GEMINI_MODEL, input, system_instruction: SYSTEM, store: false, generation_config: { max_output_tokens: 16000, thinking_level: 'medium' } }),
        });
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        throw new GeminiError("Couldn't reach the Gemini API. Check the internet connection.");
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const e = (Array.isArray(body) ? body[0] : body)?.error || {};
        const reason = (e.details || []).map((d) => d.reason).find(Boolean);
        if (reason === 'API_KEY_INVALID' || res.status === 401 || res.status === 403) throw new GeminiError('That Gemini API key was refused. Check it in Content → Describe a look.');
        if (res.status === 429) throw new GeminiError('Gemini says the quota is used up for now. Wait a minute, or check your plan in Google AI Studio.');
        throw new GeminiError(`The Gemini API returned an error (${res.status}): ${e.message || res.statusText}`);
      }
      const text = geminiText(body);
      if (!text) {
        const why = body.errors?.[0]?.message || body.status;
        throw new GeminiError(`Gemini didn't write anything${why ? ' (' + why + ')' : ''}. Try describing the look differently.`);
      }
      return { text };
    },
    explain: (err) => err instanceof GeminiError ? err.message : null,
  };
}
// the model's text from an Interaction: model_output steps (thought steps are skipped)
export function geminiText(body) {
  const steps = body.steps || body.outputs || [];
  return steps.flatMap((s) => s.type === 'model_output' ? (s.content || []) : s.type === 'text' ? [s] : [])
    .filter((c) => c.type === 'text' && c.text).map((c) => c.text).join('\n');
}

// Ask for an effect; compile(code) returns null or the compiler log. One repair round on a compile error.
// Uses the Claude plan when given one (sample), else the saved key. Returns { code, note, repaired }.
export async function generateEffect({ sample = null, apiKey, request, context, compile, signal, progress = () => {} }) {
  const kind = sample ? 'plan' : keyKind(apiKey || '');
  if (!kind) throw new Error('Add a Gemini or Anthropic API key first.');
  let backend = null;
  try {
    backend = kind === 'plan' ? planBackend(sample) : kind === 'gemini' ? geminiBackend(apiKey) : await anthropicBackend(apiKey);
    const turns = [{ role: 'user', content: `${context}\n\nThe look I want: ${request}` }];
    progress('Writing the effect…');
    let reply = await backend.ask(turns, signal);
    let code = extractCode(reply.text);
    if (!code) throw new Error(`${backend.name}'s reply didn't contain an effect. Try again.`);
    const note = reply.text.split('```')[0].trim();
    const log = compile(code);
    if (!log) return { code, note, repaired: false };
    progress('Fixing a compile error…');
    turns.push({ role: 'assistant', content: reply.text, raw: reply.raw });   // append-only: the reply as it came back
    turns.push({ role: 'user', content: `That failed to compile with:\n${log}\nReturn the corrected function in one \`\`\`glsl block.` });
    reply = await backend.ask(turns, signal);
    code = extractCode(reply.text);
    const log2 = code ? compile(code) : 'no code in the reply';
    if (log2) throw new Error("The effect still didn't compile after one repair:\n" + log2.split('\n').slice(0, 3).join('\n'));
    return { code, note, repaired: true };
  } catch (err) {
    if (err.name === 'AbortError' || err.code === 'cancelled' || signal?.aborted) throw new Error('Cancelled.');
    const msg = backend?.explain(err);
    throw msg ? new Error(msg) : err;
  }
}

// a custom effect's code, made unique: fx_custom -> fx_<id>, c_helpers -> c<id>_helpers
export function namespaced(id, code) {
  return code.replace(/\bfx_custom\b/g, 'fx_' + id).replace(/\bc_(\w+)/g, `c${id}_$1`);
}
