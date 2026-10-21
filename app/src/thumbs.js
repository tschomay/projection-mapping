// Live previews of effects for the content tray. One WebGL2 canvas sits behind the tiles and each effect is drawn
// straight into its tile's rectangle (viewport and scissor), so nothing is copied back from the GPU. Each effect is
// compiled on its own (a rectangle stands in for a surface: uv = screen), in the background where the browser can
// (KHR_parallel_shader_compile). With no sound playing, a pretend 120 bpm beat drives the audio uniforms so the
// music effects show that they move to music. The context and its shaders are made when the tray first draws and
// given back when it closes (release), since a hidden tray needn't hold graphics memory.
import { SURF_API } from './renderer.js';

const VERT = '#version 300 es\nin vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }';
const UNIFORMS = ['uTime', 'uId', 'uBeat', 'uBeats', 'uHasAudio', 'uRes', 'uView', 'uOrigin', 'uAudio'];
const NEW_PER_FRAME = 2;   // shaders started per frame, so opening the tray doesn't stall

export class Thumbs {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = null;
    this.programs = new Map();   // key -> { p, u, ready, failed }
  }

  // the context, made on first use
  init() {
    const gl = this.gl = this.canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: false });
    if (!gl) return false;
    this.par = gl.getExtension('KHR_parallel_shader_compile');
    gl.bindVertexArray(gl.createVertexArray());
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.vs = this.shader(gl.VERTEX_SHADER, VERT);
    return true;
  }

  // give the context and every compiled preview back. A lost context can't be used again, so the canvas is swapped
  // for a fresh one (same id and styles) that init() starts on next time.
  release() {
    const gl = this.gl;
    if (!gl) return;
    for (const key of [...this.programs.keys()]) this.forget(key);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const fresh = this.canvas.cloneNode(false);
    fresh.width = fresh.height = 1;
    this.canvas.replaceWith(fresh);
    this.canvas = fresh;
    this.gl = null;
  }

  shader(type, src) { const gl = this.gl, s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }

  // start compiling an effect ({ key, fn, code }); returns its entry, ready or not
  program(e, budget) {
    let pr = this.programs.get(e.key);
    if (pr || budget.n <= 0) return pr;
    budget.n--;
    const gl = this.gl;
    const fs = this.shader(gl.FRAGMENT_SHADER, `#version 300 es
precision highp float; precision highp int;
uniform float uTime, uId, uBeat, uBeats, uHasAudio; uniform vec2 uRes, uView, uOrigin; uniform vec4 uAudio;
out vec4 outColor;
${SURF_API}
${e.code}
void main() {
  vec2 uv = (gl_FragCoord.xy - uOrigin) / uView;
  Surf2 s; s.uv = uv; s.screen = uv; s.px = vec2(uv.x, 1.0 - uv.y) * uRes; s.id = uId; s.count = 3.0;
  s.edge = min(min(uv.x, 1.0 - uv.x) * uRes.x, min(uv.y, 1.0 - uv.y) * uRes.y); s.size = uRes;
  outColor = vec4(clamp(${e.fn}(s, uTime), 0.0, 1.0), 1.0);
}`);
    const p = gl.createProgram();
    gl.attachShader(p, this.vs); gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, 'position'); gl.linkProgram(p);
    pr = { p, fs, u: null, ready: false, failed: false };
    this.programs.set(e.key, pr);
    return pr;
  }

  // a program can be used once linked; with the extension, asking before it's done doesn't block
  usable(pr) {
    if (pr.ready || pr.failed) return pr.ready;
    const gl = this.gl;
    if (this.par && !gl.getProgramParameter(pr.p, this.par.COMPLETION_STATUS_KHR)) return false;
    if (!gl.getProgramParameter(pr.p, gl.LINK_STATUS)) { pr.failed = true; return false; }
    pr.u = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(pr.p, n)]));
    pr.ready = true;
    return true;
  }

  // tiles: [{ effect, rect }] with rects in CSS pixels relative to the canvas; clip: the visible part, likewise
  draw(tiles, clip, t, audio) {
    if (!this.gl && !this.init()) return;
    const gl = this.gl;
    // a long strip of tiles makes a wide canvas: lower its resolution rather than go past what the GPU can hold
    const c = this.canvas, max = Math.min(4096, this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE));
    const dpr = Math.min(devicePixelRatio || 1, 1.5, max / Math.max(c.clientWidth, c.clientHeight, 1));
    const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST);
    const budget = { n: NEW_PER_FRAME };
    for (const { effect, rect, idx } of tiles) {
      // to device pixels, y up
      const x = Math.round(rect.x * dpr), y = Math.round(h - (rect.y + rect.h) * dpr), rw = Math.round(rect.w * dpr), rh = Math.round(rect.h * dpr);
      const cx0 = Math.max(x, Math.round(clip.x * dpr)), cx1 = Math.min(x + rw, Math.round((clip.x + clip.w) * dpr));
      const cy0 = Math.max(y, Math.round(h - (clip.y + clip.h) * dpr)), cy1 = Math.min(y + rh, Math.round(h - clip.y * dpr));
      if (cx1 <= cx0 || cy1 <= cy0) continue;
      const pr = this.program(effect, budget);
      gl.scissor(cx0, cy0, cx1 - cx0, cy1 - cy0);
      if (!pr || !this.usable(pr)) { gl.clearColor(0.07, 0.08, 0.1, 1); gl.clear(gl.COLOR_BUFFER_BIT); continue; }
      const u = pr.u;
      gl.useProgram(pr.p);
      gl.viewport(x, y, rw, rh);
      gl.uniform1f(u.uTime, t); gl.uniform1f(u.uId, idx % 3);
      gl.uniform2f(u.uRes, 640, 400); gl.uniform2f(u.uView, rw, rh); gl.uniform2f(u.uOrigin, x, y);
      gl.uniform4f(u.uAudio, audio.bass, audio.mid, audio.treble, audio.level);
      gl.uniform1f(u.uBeat, audio.beat); gl.uniform1f(u.uBeats, audio.beats); gl.uniform1f(u.uHasAudio, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  forget(key) { const pr = this.programs.get(key); if (pr && this.gl) { this.gl.deleteProgram(pr.p); this.gl.deleteShader(pr.fs); } this.programs.delete(key); }
}

// real sound when it's playing, otherwise a pretend 120 bpm beat
export function previewAudio(state, t) {
  if (state && state.active) return state;
  const f = (t * 2) % 1, beat = Math.exp(-f * 5);
  return { bass: 0.25 + 0.75 * beat, mid: 0.5 + 0.3 * Math.sin(t * 1.3), treble: 0.4 + 0.4 * Math.sin(t * 7) ** 2, level: 0.6, beat, beats: Math.floor(t * 2) };
}
