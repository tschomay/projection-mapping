// The phone camera side of surface capture: open the camera, lock exposure where the browser allows, and photograph
// each projected pattern once it has settled. The patterns go through the mirroring or casting path, so their
// latency is unknown: it's measured on the first white frame, and every photo waits for the image to stop changing.
import { patternFrames, litShare, meanDiff } from './capture.js';

export const CAM_W = 640;   // analysis width; enough for 4-pixel projector cells on a typical set

export async function listCameras() {
  try { return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'); } catch { return []; }
}

export class Camera {
  constructor(video) {
    this.video = video;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.stream = null;
  }

  async open(deviceId) {
    this.close();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no camera access here. It needs HTTPS.');
    // the main (not ultra-wide) back camera: the analysis assumes a lens without much distortion
    const video = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } };
    Object.assign(video, { width: { ideal: 1280 }, height: { ideal: 720 } });
    try { this.stream = await navigator.mediaDevices.getUserMedia({ video, audio: false }); } catch (err) {
      throw new Error(err.name === 'NotAllowedError' ? 'Camera permission was refused. Allow the camera for this site and try again.' : 'The camera could not be opened: ' + (err.message || err.name));
    }
    this.track = this.stream.getVideoTracks()[0];
    this.video.srcObject = this.stream;
    this.video.muted = true; this.video.playsInline = true; this.video.setAttribute('playsinline', '');
    await this.video.play().catch(() => {});
    if (!this.video.videoWidth) await new Promise((r) => this.video.addEventListener('loadedmetadata', r, { once: true }));
    this.camW = CAM_W;
    this.camH = Math.round(CAM_W * this.video.videoHeight / this.video.videoWidth);
    this.canvas.width = this.camW; this.canvas.height = this.camH;
    return this.track.getSettings?.().deviceId;
  }

  close() {
    if (this.stream) for (const t of this.stream.getTracks()) t.stop();
    this.stream = null; this.video.srcObject = null;
  }

  // freeze exposure, white balance and focus so the camera doesn't fight the changing patterns.
  // Returns what could be locked (often nothing on iOS; the inverse patterns cope with drift).
  async lock() {
    const caps = this.track.getCapabilities?.() || {};
    const locked = [];
    for (const [key, label] of [['exposureMode', 'exposure'], ['whiteBalanceMode', 'white balance'], ['focusMode', 'focus']]) {
      if (!(caps[key] || []).includes('manual')) continue;
      try { await this.track.applyConstraints({ advanced: [{ [key]: 'manual' }] }); locked.push(label); } catch { /* not this one */ }
    }
    return locked;
  }
  async unlock() {
    const caps = this.track?.getCapabilities?.() || {};
    for (const key of ['exposureMode', 'whiteBalanceMode', 'focusMode']) {
      if ((caps[key] || []).includes('continuous')) await this.track.applyConstraints({ advanced: [{ [key]: 'continuous' }] }).catch(() => {});
    }
  }

  // one luminance image, row 0 at the top
  grab() {
    this.ctx.drawImage(this.video, 0, 0, this.camW, this.camH);
    const d = this.ctx.getImageData(0, 0, this.camW, this.camH).data;
    const lum = new Float32Array(this.camW * this.camH);
    for (let i = 0; i < lum.length; i++) lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    return lum;
  }

  // wait for the camera's next frame (no faster than the camera delivers)
  nextFrame() {
    if (this.video.requestVideoFrameCallback) return new Promise((r) => this.video.requestVideoFrameCallback(() => r()));
    return new Promise((r) => setTimeout(r, 40));
  }
}

// block averages (16 x 16 pixels): noise averages out, but a pattern change still moves many blocks a lot
function coarse(lum, w, h) {
  const bw = Math.floor(w / 16), bh = Math.floor(h / 16), out = new Float32Array(bw * bh);
  for (let y = 0; y < bh * 16; y++) for (let x = 0; x < bw * 16; x++) out[((y >> 4) * bw) + (x >> 4)] += lum[y * w + x];
  for (let i = 0; i < out.length; i++) out[i] /= 256;
  return out;
}
const mean = (a) => { let s = 0; for (let i = 0; i < a.length; i += 7) s += a[i]; return s / Math.ceil(a.length / 7); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export class CaptureError extends Error {}

// Run the whole capture. show(frame) puts a pattern on the projector; progress(i, n, text) reports.
// Returns { shots, camW, camH, latency, locked }.
export async function runCapture(camera, { W, H, show, progress = () => {}, signal }) {
  const frames = patternFrames(W, H);
  const check = () => { if (signal?.aborted) throw new CaptureError('Capture cancelled.'); };

  // Photograph whatever is on the projector once the camera image has stopped changing. With `unlike`, the photo
  // must also differ from that earlier one by more than sensor noise: fine stripes average out in the stability
  // check, so this is what catches a pattern that hasn't arrived yet.
  let latency = 150, noise = 0;
  const settle = async (minWait, unlike) => {
    await sleep(minWait); check();
    let prev = null, last = null;
    const t0 = performance.now();
    for (;;) {
      await camera.nextFrame(); check();
      const cur = camera.grab(), c = coarse(cur, camera.camW, camera.camH);
      const arrived = !unlike || meanDiff(cur, unlike) > noise * 1.25 + 0.5;
      if (prev && arrived && meanDiff(prev, c) < 1) { last = cur; break; }
      prev = c;
      if (performance.now() - t0 > 2500) { last = cur; break; }   // a flickering scene; take what we have
    }
    // average with one more frame to halve the sensor noise
    await camera.nextFrame();
    const extra = camera.grab();
    for (let i = 0; i < last.length; i++) last[i] = (last[i] + extra[i]) / 2;
    return last;
  };

  // let auto-exposure adapt to a typical stripe frame (half lit), then lock it
  progress(0, frames.length, 'Setting exposure…');
  show(frames[2 + 2 * 3]);
  await sleep(900); check();
  const locked = await camera.lock();

  // black, then white: measures the projection path's lag and checks the camera can see the projection
  show(frames[0]);
  const black = await settle(1000);   // generous: the lag isn't known yet
  await camera.nextFrame();
  const g1 = camera.grab(); await camera.nextFrame();
  noise = meanDiff(g1, camera.grab());            // frame-to-frame sensor noise on a still image
  const bMean = mean(black);
  show(frames[1]);
  const tWhite = performance.now();
  let first = null;
  for (;;) {
    await camera.nextFrame(); check();
    const m = mean(camera.grab());
    if (m > bMean + 6 && first === null) first = performance.now() - tWhite;
    if (first !== null || performance.now() - tWhite > 3000) break;
  }
  latency = Math.min(1500, first ?? 600);
  const wait = Math.round(latency * 1.25 + 80);
  const white = await settle(wait, black);
  const share = litShare(black, white);
  if (share < 0.05) throw new CaptureError('The camera hardly sees the projection. Turn off room lights, point the camera at the set, and make sure the projector shows this screen.');

  const shots = [black, white];
  for (let i = 2; i < frames.length; i++) {
    progress(i, frames.length, `Photo ${i + 1} of ${frames.length}`);
    show(frames[i]);
    shots.push(await settle(wait, shots[i - 1]));
  }

  // did anything move? photograph white again and compare
  progress(frames.length, frames.length, 'Checking nothing moved…');
  show(frames[1]);
  const white2 = await settle(wait, shots[shots.length - 1]);
  show(frames[0]);
  const moved = meanDiff(white, white2);
  if (moved > Math.max(6, (mean(white) - bMean) * 0.12)) throw new CaptureError('The camera or the set moved during the capture. Steady the phone on a stand and try again.');
  await camera.unlock();
  return { shots, camW: camera.camW, camH: camera.camH, latency, locked, share };
}
