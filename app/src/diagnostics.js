// Device check: what this phone or computer supports, for testing before a projector is at hand.
// Each row is { label, value, ok } with ok true (good), false (a problem) or null (just information).
import { presentationSupported } from './link.js';

const mb = (n) => (n / 1048576).toFixed(0) + ' MB';
const yes = (cond, good, bad) => ({ value: cond ? good : bad, ok: !!cond });

export async function deviceReport(app) {
  const rows = [];
  const add = (label, r) => rows.push({ label, ...r });
  const gl = app.renderer.gl;

  // display and rendering
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  add('Graphics', { value: 'WebGL2' + (ext ? ' · ' + gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''), ok: true });
  add('Frame rate', app.fps ? { value: Math.round(app.fps) + ' fps with this project', ok: app.fps >= 50 ? true : app.fps >= 28 ? null : false } : { value: 'measuring…', ok: null });
  const W = screen.width, H = screen.height, aspect = Math.max(W, H) / Math.min(W, H);
  add('Screen', { value: `${Math.max(W, H)} × ${Math.min(W, H)} at ${devicePixelRatio}x · ${aspect.toFixed(2)}:1` + (Math.abs(aspect - 16 / 9) > 0.05 ? ' (projector is 1.78:1, so expect side bars when mirroring)' : ''), ok: null });
  const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone;
  add('Installed to home screen', yes(standalone, 'yes: true full screen', 'no: install it for true full screen'));
  add('Full screen', yes(document.documentElement.requestFullscreen, 'available', 'not available (iPhone Safari: install to the home screen instead)'));
  add('Keep screen awake', yes('wakeLock' in navigator, 'available', 'not available: set auto-lock to Never during a show'));
  add('Landscape lock', yes(screen.orientation && screen.orientation.lock, 'available in full screen', 'not available: use the phone\'s rotation lock'));

  // outputs
  add('Second screen (Presentation API)', presentationSupported() ? { value: 'available (Chrome)', ok: true } : { value: 'not in this browser; mirroring still works', ok: null });
  if ('isExtended' in screen) add('Second display attached', { value: screen.isExtended ? 'yes' : 'no', ok: null });
  add('Video out over USB-C', { value: "a web page can't tell: look up your model and \"DisplayPort Alt Mode\"", ok: null });

  // media
  const v = document.createElement('video');
  const fmt = (t) => v.canPlayType(t) || 'no';
  add('Video formats', { value: `H.264 MP4 ${fmt('video/mp4; codecs="avc1.42E01E"')} · HEVC ${fmt('video/mp4; codecs="hvc1"')} · WebM VP9 ${fmt('video/webm; codecs="vp9"')}`, ok: v.canPlayType('video/mp4; codecs="avc1.42E01E"') ? true : null });
  add('Microphone', yes(navigator.mediaDevices?.getUserMedia && isSecureContext, 'available', 'needs HTTPS'));

  // storage: media lives in IndexedDB, which the browser may clear under pressure unless storage is persistent
  if (navigator.storage?.estimate) {
    const e = await navigator.storage.estimate();
    add('Storage for media', { value: `${mb(e.usage || 0)} used of ${mb(e.quota || 0)}`, ok: (e.quota || 0) > 500 * 1048576 ? true : null });
  }
  if (navigator.storage?.persisted) {
    const p = await navigator.storage.persisted();
    add('Storage kept', { value: p ? 'yes: the browser won\'t clear your videos' : 'not yet: tap "Keep my files" below', ok: p ? true : null, action: p ? null : 'persist' });
  }
  return rows;
}

// Open the camera briefly and report what it allows. Exposure lock matters most for surface capture.
export async function cameraReport(camera) {
  const rows = [];
  try {
    await camera.open();
    const caps = camera.track.getCapabilities?.() || {}, s = camera.track.getSettings?.() || {};
    rows.push({ label: 'Camera', value: `${s.width || camera.video.videoWidth} × ${s.height || camera.video.videoHeight}` + (camera.track.label ? ' · ' + camera.track.label : ''), ok: true });
    const can = (k) => (caps[k] || []).includes('manual');
    rows.push({ label: 'Exposure lock', value: can('exposureMode') ? 'yes' : 'no: capture still works, using the inverse patterns', ok: can('exposureMode') ? true : null });
    rows.push({ label: 'White balance and focus lock', value: [can('whiteBalanceMode') && 'white balance', can('focusMode') && 'focus'].filter(Boolean).join(', ') || 'no', ok: null });
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    rows.push({ label: 'Cameras', value: cams.length + (cams.length > 2 ? ': pick the main back camera, not the ultra-wide' : ''), ok: null });
  } catch (err) {
    rows.push({ label: 'Camera', value: err.message, ok: false });
  } finally {
    camera.close();
  }
  return rows;
}

export function reportText(rows) {
  return ['Surface Mapper device check', navigator.userAgent, ''].concat(rows.map((r) => `${r.ok === true ? '✓' : r.ok === false ? '✗' : '·'} ${r.label}: ${r.value}`)).join('\n');
}
