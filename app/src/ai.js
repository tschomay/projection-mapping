// AI-written effects (roadmap #9): describe a look, and Claude writes a new effect for the mapped surfaces.
// The app calls the Claude API straight from the browser with the user's own API key, kept on this device only
// (never in project files). The SDK loads from a CDN the first time it's needed, so the rest of the app still
// works offline.
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.127.0/+esm';
const MODEL = 'claude-opus-5-5';
const KEY_STORE = 'pm.anthropicKey';

export function getKey() { try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; } }
export function setKey(k) { try { if (k) localStorage.setItem(KEY_STORE, k); else localStorage.removeItem(KEY_STORE); return true; } catch { return false; } }

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

let sdk = null;
async function client(apiKey) {
  if (!sdk) {
    try { sdk = (await import(SDK_URL)).default; } catch { throw new Error("Couldn't load the Claude SDK. Check the internet connection."); }
  }
  return new sdk({ apiKey, dangerouslyAllowBrowser: true });   // the user's own key, on their own device
}

async function ask(c, messages, signal) {
  const stream = c.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: 'medium' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages,
  }, { signal });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error("Claude declined that request. Try describing the look differently.");
  return msg;
}

const textOf = (msg) => msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');

// Ask for an effect; compile(code) returns null or the compiler log. One repair round on a compile error.
// Returns { code, note, repaired }.
export async function generateEffect({ apiKey, request, context, compile, signal, progress = () => {} }) {
  if (!apiKey) throw new Error('Add your Anthropic API key first.');
  const c = await client(apiKey);
  const messages = [{ role: 'user', content: `${context}\n\nThe look I want: ${request}` }];
  let msg;
  try {
    progress('Writing the effect…');
    msg = await ask(c, messages, signal);
    let code = extractCode(textOf(msg));
    if (!code) throw new Error("Claude's reply didn't contain an effect. Try again.");
    const log = compile(code);
    if (!log) return { code, note: textOf(msg).split('```')[0].trim(), repaired: false };
    const note = textOf(msg).split('```')[0].trim();
    progress('Fixing a compile error…');
    messages.push({ role: 'assistant', content: msg.content });   // append-only: the reply as it came back
    messages.push({ role: 'user', content: `That failed to compile with:\n${log}\nReturn the corrected function in one \`\`\`glsl block.` });
    msg = await ask(c, messages, signal);
    code = extractCode(textOf(msg));
    const log2 = code ? compile(code) : 'no code in the reply';
    if (log2) throw new Error("The effect still didn't compile after one repair:\n" + log2.split('\n').slice(0, 3).join('\n'));
    return { code, note, repaired: true };
  } catch (err) {
    if (err.name === 'AbortError' || signal?.aborted) throw new Error('Cancelled.');
    if (sdk && err instanceof sdk.AuthenticationError) throw new Error('That API key was refused. Check it in Content → Describe a look.');
    if (sdk && err instanceof sdk.RateLimitError) throw new Error('Rate limited by the API. Wait a moment and try again.');
    if (sdk && err instanceof sdk.APIConnectionError) throw new Error("Couldn't reach the Claude API. Check the internet connection.");
    if (sdk && err instanceof sdk.APIError) throw new Error(`The API returned an error${err.status ? ' (' + err.status + ')' : ''}: ${err.message}`);
    throw err;
  }
}

// a custom effect's code, made unique: fx_custom -> fx_<id>, c_helpers -> c<id>_helpers
export function namespaced(id, code) {
  return code.replace(/\bfx_custom\b/g, 'fx_' + id).replace(/\bc_(\w+)/g, `c${id}_$1`);
}
