// Project links: the whole mapping (surfaces, custom effects, cues) packed into a URL fragment, so one tap moves
// a project from one copy of the app to another, for example from the Claude artifact to the installed app.
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
    return new TextDecoder().decode(await pipe(unb64url(hash.slice(PREFIX.length)), new DecompressionStream('gzip')));
  } catch {
    throw new Error("That project link is damaged or cut short. Send it again.");
  }
}
