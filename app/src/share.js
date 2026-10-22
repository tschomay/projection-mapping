// Project links: the whole mapping (surfaces, custom effects, cues) packed into a URL fragment, so one tap moves
// a project from one copy of the app to another, for example from a laptop to the phone.
// Also what passes between the app and the writer (below).
// The JSON is gzipped and base64url-encoded after #import=. A fragment never reaches the server. Videos and
// images aren't in it (only their names), just as with an exported file.
export const APP_URL = 'https://surface-mapper-alpha.vercel.app/';
const PREFIX = '#import=';

const b64url = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = (text) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

export async function projectLink(project, base = APP_URL) {
  const json = new TextEncoder().encode(JSON.stringify(project));
  return base.split('#')[0] + PREFIX + b64url(await pipe(json, new CompressionStream('gzip')));
}

// the project JSON text in a link's fragment, or null when there isn't one
export async function readProjectLink(hash) {
  if (!hash.startsWith(PREFIX)) return null;
  try {
    return await unpack(hash.slice(PREFIX.length));
  } catch {
    throw new Error("That project link is damaged or cut short. Send it again.");
  }
}
const unpack = async (text) => new TextDecoder().decode(await pipe(unb64url(text), new DecompressionStream('gzip')));

// The writer: a small Claude artifact that writes effects on the viewer's own Claude plan. A claude.ai link
// can't carry anything to the page inside it, so the app copies the request as text for the viewer to paste
// there (writerPacket); the writer sends the finished effect back in a link, #fx= (effectLink).
export const WRITER_URL = 'https://claude.ai/artifact/SNkGsUMc1BAPdug3UZzL2K';
const PACKET = 'SMW1 ';
const FX_PREFIX = '#fx=';
const rounded = (k, v) => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v);

// req: { request, context, frame, surfaces, target, back }; plain text, so it can be copied in the same tap
export function writerPacket(req) {
  const surfaces = req.surfaces.map((s) => ({ id: s.id, pins: s.pins, parts: s.parts.map((p) => ({ op: p.op, pts: p.pts })), mesh: s.mesh, feather: s.feather, input: s.input }));
  return PACKET + JSON.stringify({ v: 1, ...req, surfaces }, rounded);
}

// the request in pasted text, or null when it isn't there; throws when it's there but unusable
export function readWriterPacket(text) {
  const at = text.indexOf(PACKET);
  if (at < 0) return null;
  let p;
  try { p = JSON.parse(text.slice(at + PACKET.length).trim()); } catch { throw new Error('That was cut short. Copy it again in Surface Mapper and paste all of it.'); }
  if (p.v > 1) throw new Error('Surface Mapper is newer than this writer. Ask for the writer to be updated.');
  if (typeof p.request !== 'string' || typeof p.context !== 'string' || !Array.isArray(p.surfaces) || !Array.isArray(p.frame)) throw new Error("That doesn't look like a request from Surface Mapper.");
  if (!/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(p.back || '')) p.back = APP_URL;
  return p;
}

// fx: { name, prompt, code, target }; target is the surface ids it's for, or null
export async function effectLink(fx, base = APP_URL) {
  const json = new TextEncoder().encode(JSON.stringify({ v: 1, ...fx }));
  return base.split('#')[0] + FX_PREFIX + b64url(await pipe(json, new CompressionStream('gzip')));
}

// the effect in a link's fragment, or null when there isn't one
export async function readEffectLink(hash) {
  if (!hash.startsWith(FX_PREFIX)) return null;
  let fx;
  try { fx = JSON.parse(await unpack(hash.slice(FX_PREFIX.length))); } catch { throw new Error('That effect link is damaged or cut short. Send it again from the writer.'); }
  if (typeof fx?.code !== 'string' || !/vec3\s+fx_custom\s*\(/.test(fx.code)) throw new Error("That link doesn't hold an effect.");
  const text = (v, fallback) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
  return { name: text(fx.name, 'From the writer').slice(0, 60), prompt: text(fx.prompt, ''), code: fx.code, target: Array.isArray(fx.target) ? fx.target.filter((t) => typeof t === 'string') : null };
}
