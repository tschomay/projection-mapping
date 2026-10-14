// A photo from beside the projector's lens (issue #33), in Node, on a synthetic wall with wainscoting and picture
// frames (scene.mjs): the projector frame found from a black and a white photo (#34), and rectangles found from a
// tap, innermost first and stepping out (#35), checked in projector pixels through the frame that was found.
import { frameQuad, photoPointToFrame, framePointToPhoto, coverQuad, cssMatrix } from '../app/src/photo.js';
import { analysePhoto, quadsAt } from '../app/src/regions.js';
import { buildWall } from './scene.mjs';
import { reporter } from './serve.mjs';

const lum = (img, n) => { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = 0.299 * img[i * 4] + 0.587 * img[i * 4 + 1] + 0.114 * img[i * 4 + 2]; return o; };
const maxErr = (a, b) => Math.max(...a.map((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1])));

export default async function run() {
  const t = reporter('photo');

  // the plain helpers
  const cq = coverQuad(4 / 3, 16 / 9);
  t.ok(Math.abs(cq[0][1] - 0.125) < 1e-9 && cq[0][0] === 0 && Math.abs(cq[2][1] - 0.875) < 1e-9, 'a 4:3 photo covering a 16:9 frame is cropped top and bottom');
  const m = cssMatrix([2, 0, 0.1, 0, 2, 0.2, 0, 0, 1], [100, 50], [100, 50]).slice(9, -1).split(',').map(Number);
  t.ok(m.length === 16 && m[0] === 2 && m[5] === 2 && m[12] === 10 && m[13] === 10, 'the CSS matrix scales a normalized homography to pixels');

  // tap -> the rectangles around it, as named things on the wall, innermost first
  const chains = { panel1: ['panel1', 'panel1Outer'], panel2: ['panel2'], panel3: ['panel3'], art1: ['art1', 'mat1', 'frame1'], art2: ['art2', 'frame2'] };
  for (const [W, H] of [[1280, 720], [1280, 591]]) {
    const wall = buildWall({ W, H }), { camW, camH } = wall, n = camW * camH;
    const black = wall.photo(0, 3), white = wall.photo(1, 4);
    const fq = frameQuad(lum(black, n), lum(white, n), camW, camH);
    t.ok(!!fq, `${W}x${H}: the projector frame is found in the photo`);
    if (!fq) continue;
    const e = maxErr(fq.quad.map(([x, y]) => [x * camW, y * camH]), wall.frameCam);
    t.ok(e < 0.5, `${W}x${H}: its corners within half a camera pixel (${e.toFixed(2)})`);
    const back = framePointToPhoto(fq.quad, ...photoPointToFrame(fq.quad, 0.3, 0.6));
    t.ok(Math.hypot(back[0] - 0.3, back[1] - 0.6) < 1e-9, `${W}x${H}: photo -> frame -> photo comes back`);

    const t0 = Date.now(), A = analysePhoto(black, camW, camH), ms = Date.now() - t0;
    const toFrame = ([x, y]) => { const [u, v] = photoPointToFrame(fq.quad, x / camW, y / camH); return [u * W, v * H]; };
    for (const [start, chain] of Object.entries(chains)) {
      const c = wall.rects[start].cam.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]);
      const found = quadsAt(A, c[0], c[1]);
      const errs = chain.map((name, i) => (found[i] ? maxErr(found[i].quad.map(toFrame), wall.rects[name].frame) : Infinity));
      t.ok(errs.every((x) => x < 4), `${W}x${H}: tapping ${start} gives ${chain.join(', then ')}, corners within 4 projector px (${errs.map((x) => x.toFixed(1)).join(', ')})`);
    }
    t.ok(quadsAt(A, 20, 20).length === 0, `${W}x${H}: a tap on bare wall finds nothing`);
    console.log(`     ${W}x${H}: edges and lines in ${ms} ms`);
  }
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
