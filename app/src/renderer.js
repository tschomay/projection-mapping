// WebGL2 renderer for 2D surfaces. One fragment shader covers the whole frame: for each pixel it finds the
// topmost surface containing it (point-in-polygon against each part, combined as a signed distance), maps the
// pixel into that surface's uv space through its inverse homography, and shades it with the surface's content.
import { EFFECTS } from './effects.js';

export const MAX_SURF = 16, MAX_PARTS = 48, MAX_PART_VERTS = 128, MAX_VERTS = 2048, MAX_MEDIA = 4, EDGE_MARGIN = 64;

const VERT = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const HEAD = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uniform float uTime;
uniform vec2 uRes;        // logical frame size in pixels
uniform vec2 uView;       // size of the buffer being drawn
uniform sampler2D uPoly;
uniform int uSurfCount;
uniform mat3 uHinv[${MAX_SURF}];
uniform vec4 uSurfInfo[${MAX_SURF}];   // first part, part count, width px, height px
uniform vec4 uSurfFx[${MAX_SURF}];     // effect index (-1 = media), media slot, space (0 surface, 1 frame), fit (0 fill, 1 fit, 2 stretch)
uniform vec4 uPart[${MAX_PARTS}];      // first vertex, vertex count, op (+1 add, -1 cut)
uniform vec4 uPartBox[${MAX_PARTS}];
uniform sampler2D uMedia0; uniform sampler2D uMedia1; uniform sampler2D uMedia2; uniform sampler2D uMedia3;
uniform vec4 uMediaInfo[${MAX_MEDIA}]; // aspect, ready
uniform vec4 uAudio;                   // bass, mid, treble, level (0..1)
uniform float uBeat, uBeats, uHasAudio;
out vec4 outColor;

struct Surf2 {
  vec2 uv;      // 0..1 between the surface's corner pins (u right, v up), perspective-correct on a flat surface
  vec2 px;      // frame pixel, (0,0) top-left
  vec2 screen;  // 0..1 across the whole frame (x right, y up); continuous across neighbouring surfaces
  float id;     // surface number
  float count;  // number of surfaces
  float edge;   // distance to the outline in frame pixels (exact up to ${EDGE_MARGIN})
  vec2 size;    // rough surface size in frame pixels
};
float hash1(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash1(i), hash1(i + vec3(1,0,0)), f.x), mix(hash1(i + vec3(0,1,0)), hash1(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash1(i + vec3(0,0,1)), hash1(i + vec3(1,0,1)), f.x), mix(hash1(i + vec3(0,1,1)), hash1(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.02; a *= 0.5; } return s; }
vec3 hsv(float h, float s, float v) { vec3 k = clamp(abs(mod(h * 6.0 + vec3(0, 4, 2), 6.0) - 3.0) - 1.0, 0.0, 1.0); return v * mix(vec3(1), k, s); }
vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d) { return a + b * cos(6.28318 * (c * t + d)); }
`;

const MAIN = `
vec3 sampleMedia(int slot, vec2 uv) {
  if (slot == 0) return texture(uMedia0, uv).rgb;
  if (slot == 1) return texture(uMedia1, uv).rgb;
  if (slot == 2) return texture(uMedia2, uv).rgb;
  return texture(uMedia3, uv).rgb;
}
vec3 media(vec4 fx, Surf2 s) {
  int slot = int(fx.y);
  vec4 info = uMediaInfo[slot];
  if (info.y < 0.5) return vec3(0.0);
  vec2 uv = fx.z > 0.5 ? s.screen : s.uv;
  float target = fx.z > 0.5 ? uRes.x / uRes.y : s.size.x / max(s.size.y, 1.0);
  float r = info.x / target;            // > 1: media is wider than the surface
  vec2 tuv = uv;
  if (fx.w < 0.5) { if (r > 1.0) tuv.x = (uv.x - 0.5) / r + 0.5; else tuv.y = (uv.y - 0.5) * r + 0.5; }       // fill: crop
  else if (fx.w < 1.5) { if (r > 1.0) tuv.y = (uv.y - 0.5) * r + 0.5; else tuv.x = (uv.x - 0.5) / r + 0.5; } // fit: bars
  if (tuv.x < 0.0 || tuv.y < 0.0 || tuv.x > 1.0 || tuv.y > 1.0) return vec3(0.0);
  return sampleMedia(slot, tuv);
}
float segDist(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0); return length(pa - ba * h); }
void main() {
  vec2 px = vec2(gl_FragCoord.x, uView.y - gl_FragCoord.y) * uRes / uView;
  vec3 col = vec3(0.0);
  for (int si = ${MAX_SURF - 1}; si >= 0; si--) {   // topmost surface wins
    if (si >= uSurfCount) continue;
    vec4 info = uSurfInfo[si];
    int p0 = int(info.x), pc = int(info.y);
    float D = ${EDGE_MARGIN}.0;                     // signed distance to the combined outline, negative inside
    for (int j = 0; j < ${MAX_PARTS}; j++) {
      if (j >= pc) break;
      vec4 part = uPart[p0 + j]; vec4 bb = uPartBox[p0 + j];
      float sd = ${EDGE_MARGIN}.0;
      if (px.x >= bb.x && px.x <= bb.z && px.y >= bb.y && px.y <= bb.w) {
        int v0 = int(part.x), vc = int(part.y);
        bool pin = false; float md = 1e6;
        vec2 a = texelFetch(uPoly, ivec2(v0 + vc - 1, 0), 0).xy;
        for (int k = 0; k < ${MAX_PART_VERTS}; k++) {
          if (k >= vc) break;
          vec2 b = texelFetch(uPoly, ivec2(v0 + k, 0), 0).xy;
          if ((b.y > px.y) != (a.y > px.y) && px.x < (a.x - b.x) * (px.y - b.y) / (a.y - b.y) + b.x) pin = !pin;
          md = min(md, segDist(px, a, b));
          a = b;
        }
        sd = pin ? -md : min(md, ${EDGE_MARGIN}.0);
      }
      D = j == 0 ? sd : (part.z > 0.0 ? min(D, sd) : max(D, -sd));
    }
    if (D < 0.5) {
      Surf2 s;
      vec3 h = uHinv[si] * vec3(px, 1.0);
      s.uv = h.xy / h.z; s.px = px; s.screen = vec2(px.x / uRes.x, 1.0 - px.y / uRes.y);
      s.id = float(si); s.count = float(uSurfCount); s.edge = max(-D, 0.0); s.size = info.zw;
      col = clamp(content(uSurfFx[si], s, uTime), 0.0, 1.0) * clamp(0.5 - D, 0.0, 1.0);
      break;
    }
  }
  outColor = vec4(col, 1.0);
}`;

export function buildFragment(effects = EFFECTS) {
  const dispatch = effects.map((e, i) => `  if (k == ${i}) return fx_${e.id}(s, t);`).join('\n');
  return HEAD + effects.map((e) => e.code).join('\n') + `
vec3 media(vec4 fx, Surf2 s);
vec3 content(vec4 fx, Surf2 s, float t) {
  int k = int(fx.x);
  if (k < 0) return media(fx, s);
${dispatch}
  return vec3(0.0);
}
` + MAIN;
}

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('This device does not support WebGL2.');
    this.gl = gl;
    this.canvas = canvas;
    this.frame = [1280, 720];
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.poly = new Float32Array(MAX_VERTS * 4);
    this.polyTex = this.makeTexture(gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, MAX_VERTS, 1, 0, gl.RGBA, gl.FLOAT, this.poly);
    this.mediaTex = Array.from({ length: MAX_MEDIA }, () => {
      const t = this.makeTexture(gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      return t;
    });
    this.media = new Array(MAX_MEDIA).fill(null);   // { el, aspect, ready, isVideo, uploaded }
    this.surf = { count: 0, hinv: new Float32Array(MAX_SURF * 9), info: new Float32Array(MAX_SURF * 4), fx: new Float32Array(MAX_SURF * 4), part: new Float32Array(MAX_PARTS * 4), box: new Float32Array(MAX_PARTS * 4) };
    this.program = this.compile(buildFragment());
  }

  makeTexture(filter) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  compile(fragSrc) {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(log); }
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fragSrc));
    gl.bindAttribLocation(p, 0, 'position');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    for (const n of ['uTime', 'uRes', 'uView', 'uPoly', 'uSurfCount', 'uHinv', 'uSurfInfo', 'uSurfFx', 'uPart', 'uPartBox', 'uMediaInfo', 'uAudio', 'uBeat', 'uBeats', 'uHasAudio', 'uMedia0', 'uMedia1', 'uMedia2', 'uMedia3']) u[n] = gl.getUniformLocation(p, n);
    this.u = u;
    return p;
  }

  // geoms: output of surfaceGeom per surface (frame pixels); fx: [effectIndex, mediaSlot, space, fit] per surface
  setSurfaces(geoms, fx) {
    const S = this.surf;
    let vi = 0, pi = 0;
    const n = Math.min(geoms.length, MAX_SURF);
    for (let si = 0; si < n; si++) {
      const g = geoms[si], first = pi;
      for (const part of g.parts) {
        if (pi >= MAX_PARTS || vi + part.px.length > MAX_VERTS) break;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [x, y] of part.px) {
          this.poly[vi * 4] = x; this.poly[vi * 4 + 1] = y; vi++;
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
        S.part.set([vi - part.px.length, part.px.length, part.op, 0], pi * 4);
        S.box.set([x0 - EDGE_MARGIN, y0 - EDGE_MARGIN, x1 + EDGE_MARGIN, y1 + EDGE_MARGIN], pi * 4);
        pi++;
      }
      S.hinv.set(g.Hi, si * 9);
      S.info.set([first, pi - first, g.size[0], g.size[1]], si * 4);
      S.fx.set(fx[si], si * 4);
    }
    S.count = n;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.polyTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, MAX_VERTS, 1, gl.RGBA, gl.FLOAT, this.poly);
  }

  // el: HTMLVideoElement or HTMLImageElement (or null)
  setMedia(slot, el) {
    if (this.media[slot] && this.media[slot].el === el) return;
    this.media[slot] = el ? { el, isVideo: el instanceof HTMLVideoElement, uploaded: false } : null;
  }

  uploadMedia() {
    const gl = this.gl;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    this.media.forEach((m, i) => {
      if (!m) return;
      const w = m.isVideo ? m.el.videoWidth : m.el.naturalWidth, h = m.isVideo ? m.el.videoHeight : m.el.naturalHeight;
      const ready = w > 0 && (m.isVideo ? m.el.readyState >= 2 : m.el.complete);
      m.aspect = w && h ? w / h : 1; m.ready = ready;
      if (!ready || (!m.isVideo && m.uploaded)) return;
      gl.bindTexture(gl.TEXTURE_2D, this.mediaTex[i]);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, m.el); m.uploaded = true; } catch { m.ready = false; }
    });
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  render(time, audio) {
    const gl = this.gl, u = this.u, S = this.surf;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.uploadMedia();
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniform1f(u.uTime, time);
    gl.uniform2f(u.uRes, this.frame[0], this.frame[1]);
    gl.uniform2f(u.uView, this.canvas.width, this.canvas.height);
    gl.uniform1i(u.uSurfCount, S.count);
    gl.uniformMatrix3fv(u.uHinv, true, S.hinv);
    gl.uniform4fv(u.uSurfInfo, S.info);
    gl.uniform4fv(u.uSurfFx, S.fx);
    gl.uniform4fv(u.uPart, S.part);
    gl.uniform4fv(u.uPartBox, S.box);
    const mi = new Float32Array(MAX_MEDIA * 4);
    this.media.forEach((m, i) => { if (m) mi.set([m.aspect || 1, m.ready ? 1 : 0, 0, 0], i * 4); });
    gl.uniform4fv(u.uMediaInfo, mi);
    gl.uniform4f(u.uAudio, audio.bass, audio.mid, audio.treble, audio.level);
    gl.uniform1f(u.uBeat, audio.beat); gl.uniform1f(u.uBeats, audio.beats); gl.uniform1f(u.uHasAudio, audio.active ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.polyTex); gl.uniform1i(u.uPoly, 0);
    for (let i = 0; i < MAX_MEDIA; i++) { gl.activeTexture(gl.TEXTURE1 + i); gl.bindTexture(gl.TEXTURE_2D, this.mediaTex[i]); gl.uniform1i(u['uMedia' + i], 1 + i); }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
