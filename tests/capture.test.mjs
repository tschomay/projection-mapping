// The capture pipeline (app/src/capture.js) on the synthetic room: photos rendered by ray casting with ambient
// light, lens blur and sensor noise. Runs in Node in about two seconds.
import { patternFrames, surfacesFromShots, litShare } from '../app/src/capture.js';
import { buildRoom, cornerError } from './scene.mjs';
import { reporter } from './serve.mjs';

export default async function run() {
  const t = reporter('capture');
  for (const [W, H] of [[1280, 720], [1280, 591]]) {
    const room = buildRoom({ W, H });
    const { camW, camH, lit, patternValue } = room;
    let seed = 7; const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
    const photo = (f) => {
      const img = new Float32Array(camW * camH);
      for (let i = 0; i < img.length; i++) img[i] = 30 + (lit[i * 2] >= 0 ? 150 * patternValue(f, lit[i * 2], lit[i * 2 + 1]) : 0);
      const out = new Float32Array(img.length);
      for (let y = 0; y < camH; y++) for (let x = 0; x < camW; x++) {
        let s = 0, n = 0;
        for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) {
          const xx = x + j, yy = y + k, w = j || k ? 1 : 4;
          if (xx >= 0 && yy >= 0 && xx < camW && yy < camH) { s += img[yy * camW + xx] * w; n += w; }
        }
        out[y * camW + x] = s / n + gauss() * 3;
      }
      return out;
    };
    const shots = patternFrames(W, H).map(photo);
    const r = surfacesFromShots(shots, { camW, camH, W, H });
    t.ok(litShare(shots[0], shots[1]) > 0.5, `${W}x${H}: the camera sees the projection`);
    t.ok(r.surfaces.length === 3, `${W}x${H}: three box faces found, wall and floor left out (got ${r.surfaces.length})`);
    t.ok(!r.degenerate, `${W}x${H}: not flagged as one plane`);
    for (const face of ['front', 'right']) {
      const e = cornerError(room.faceCorners[face], r.surfaces, W, H);
      t.ok(e < 4, `${W}x${H}: ${face} face corners within 4 px (${e.toFixed(1)})`);
    }
    // the top face is only ~20 px tall in this frame; thin faces are a known weakness (issue #5)
    const top = cornerError(room.faceCorners.top, r.surfaces, W, H);
    t.ok(top < 15, `${W}x${H}: thin top face found, corners within 15 px (${top.toFixed(1)})`);
  }
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
