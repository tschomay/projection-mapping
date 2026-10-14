// The design photo lined up with the projector frame (issue #34), and surfaces picked on it with a tap (#35):
// taking the photo from beside the projector's lens, dragging the frame's corners on it, and turning a tapped
// picture frame, panel or door into a surface. Methods mixed into App (see app.js), so `this` is the app.
import { Camera, CaptureError, listCameras, runFramePhoto } from '../camera.js';
import { coverQuad, cssMatrix, frameQuad, photoToFrame, framePointToPhoto, photoPointToFrame } from '../photo.js';
import { analysePhoto, quadsAt } from '../regions.js';
import { newSurface } from '../geometry.js';
import { $ } from '../env.js';

const ANALYSIS_W = 1024;   // the photo is searched for rectangles at most this wide

export const photoUI = {
  initPhotoUI() {
    $('backdrop').addEventListener('load', () => this.placeBackdrop());
    this.initPhotoSheet();
    this.initAlign();
    $('pickBtn').onclick = () => this.setPick(!this.editor.pick);
    $('pickDone').onclick = () => this.setPick(false);
  },

  // the design photo's frame quad: stored, or what simply covering the frame shows
  backdropQuad() {
    const b = this.project.backdrop, img = $('backdrop');
    if (b?.quad) return b.quad;
    const [W, H] = this.frame;
    return coverQuad(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : W / H, W / H);
  },

  // warp the photo so the frame's corners in it land on the frame's corners
  placeBackdrop() {
    const img = $('backdrop');
    if (img.hidden || !img.naturalWidth) return;
    const bw = this.box.clientWidth, bh = this.box.clientHeight;
    img.style.width = bw + 'px'; img.style.height = bh + 'px';
    img.style.transform = cssMatrix(photoToFrame(this.backdropQuad()), [bw, bh], [bw, bh]);
  },

  // put a design photo in place of the current one
  async setBackdropFile(file, quad) {
    const m = await this.media.add(file);
    if (m.kind !== 'image') { this.media.remove(m.id); throw new Error('Pick a photo (an image file).'); }
    const old = this.project.backdrop;
    this.project.backdrop = { mediaId: m.id, show: true, dim: old?.dim ?? 0.6 };
    if (quad) this.project.backdrop.quad = quad;
    if (old && old.mediaId !== m.id && !this.isUsed(old.mediaId)) this.media.remove(old.mediaId);
    this.photoAnalysis = null;
    this.scheduleSave(); this.renderBackdrop(); this.renderMediaUI(); this.renderSurfaceUI();
  },

  // ---------- taking the photo from beside the projector's lens ----------
  initPhotoSheet() {
    const sheet = $('photoSheet');
    this.photoCamera = new Camera($('photoVideo'));
    $('photoTake').onclick = () => { sheet.showModal(); this.openPhotoCamera($('photoCam').value); };
    $('closePhoto').onclick = () => sheet.close();
    sheet.addEventListener('close', () => { if (!this.photographing) this.photoCamera.close(); });
    $('photoCam').onchange = (e) => this.openPhotoCamera(e.target.value);
    $('photoStart').onclick = () => this.takeFramePhoto();
    $('stage').addEventListener('pointerdown', () => { if (this.photographing) this.photoAbort?.abort(); });
  },

  async openPhotoCamera(deviceId) {
    const status = $('photoStatus');
    $('photoStart').disabled = true;
    status.textContent = 'Opening the camera…';
    try {
      const used = await this.photoCamera.open(deviceId || undefined);
      const cams = await listCameras(), sel = $('photoCam');
      if (cams.length > 1) {
        sel.innerHTML = cams.map((c, i) => `<option value="${c.deviceId}">${(c.label || 'Camera ' + (i + 1)).replace(/[<&"]/g, '')}</option>`).join('');
        sel.value = used || deviceId || cams[0].deviceId;
      }
      sel.hidden = cams.length < 2;
      $('photoStart').disabled = false;
      status.textContent = 'Hold the phone beside the projector\'s lens, then tap Take the photo.';
    } catch (err) {
      status.textContent = err.message;
    }
  },

  async takeFramePhoto() {
    const sheet = $('photoSheet'), status = $('photoStatus');
    this.photographing = true;
    this.photoAbort = new AbortController();
    $('photoStart').disabled = true;
    const show = this.beginPatterns(sheet);
    let message = null, done = false;
    try {
      const cap = await runFramePhoto(this.photoCamera, { show, signal: this.photoAbort.signal });
      show(null);
      const found = cap.share > 0.03 ? frameQuad(cap.black, cap.white, cap.camW, cap.camH) : null;
      await this.setBackdropFile(new File([cap.photo], 'Projector view.jpg', { type: 'image/jpeg' }), found?.quad);
      done = true;
      this.openAlign(found
        ? 'Found the projector\'s picture in the photo. If a corner is off, drag it onto the corner of the lit area.'
        : 'The projector\'s picture didn\'t show clearly in the photo, so it covers the frame for now. Drag the corners onto where the projector lit the room, or take the photo again in dimmer light.');
    } catch (err) {
      message = err instanceof CaptureError ? err.message : 'The photo failed: ' + (err.message || err);
    } finally {
      this.endPatterns(show);
      this.photographing = false;
      $('photoStart').disabled = false;
      if (done) { sheet.close(); } else { if (!sheet.open) sheet.showModal(); status.textContent = message; }
    }
  },

  // ---------- lining up: the frame's corners dragged on the photo ----------
  initAlign() {
    const sheet = $('alignSheet'), c = $('alignView');
    $('alignBtn').onclick = () => this.openAlign();
    $('closeAlign').onclick = () => sheet.close();
    $('alignReset').onclick = () => {
      const b = this.project.backdrop; if (!b) return;
      b.quad = [[0, 0], [1, 0], [1, 1], [0, 1]];
      this.alignChanged();
    };
    let drag = -1;
    const at = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    c.addEventListener('pointerdown', (e) => {
      const b = this.project.backdrop; if (!b) return;
      const p = at(e), r = c.getBoundingClientRect(), q = this.backdropQuad();
      let best = -1, bd = 32;   // CSS pixels
      q.forEach(([x, y], k) => { const d = Math.hypot((x - p[0]) * r.width, (y - p[1]) * r.height); if (d < bd) { bd = d; best = k; } });
      if (best < 0) return;
      drag = best; c.setPointerCapture(e.pointerId);
      if (!b.quad) b.quad = q.map((v) => [...v]);
    });
    c.addEventListener('pointermove', (e) => {
      const b = this.project.backdrop; if (drag < 0 || !b) return;
      const p = at(e);
      b.quad[drag] = [Math.max(0, Math.min(1, p[0])), Math.max(0, Math.min(1, p[1]))];
      this.alignChanged();
    });
    for (const ev of ['pointerup', 'pointercancel']) c.addEventListener(ev, () => { drag = -1; });
  },

  openAlign(note) {
    const b = this.project.backdrop, m = b && this.media.get(b.mediaId);
    if (!m) return;
    this.toggleDrawer(false);
    $('alignNote').textContent = note || 'Drag the four corners onto the corners of the projector\'s picture in the photo. Everything outside them is cut off.';
    $('alignSheet').showModal();
    const draw = () => this.drawAlign();
    if (m.el.complete && m.el.naturalWidth) draw(); else m.el.addEventListener('load', draw, { once: true });
  },

  alignChanged() {
    this.photoAnalysis = null;   // the photo's pixels are the same, but taps now map through a different quad
    this.placeBackdrop(); this.drawAlign(); this.scheduleSave();
  },

  drawAlign() {
    const b = this.project.backdrop, m = b && this.media.get(b.mediaId), c = $('alignView');
    if (!m || !m.el.naturalWidth || !$('alignSheet').open) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), cssW = c.parentElement.clientWidth || 480;
    const aspect = m.el.naturalWidth / m.el.naturalHeight, cssH = Math.min(cssW / aspect, innerHeight * 0.55);
    const w = Math.round(cssH * aspect);
    c.style.width = w + 'px'; c.style.height = Math.round(cssH) + 'px'; c.style.margin = '6px auto 8px';
    c.width = Math.round(w * dpr); c.height = Math.round(cssH * dpr);
    const ctx = c.getContext('2d'), q = this.backdropQuad().map(([x, y]) => [x * c.width, y * c.height]);
    ctx.drawImage(m.el, 0, 0, c.width, c.height);
    // dim what's cut off
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, c.width, c.height);
    q.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill('evenodd');
    ctx.restore();
    ctx.strokeStyle = '#ffb547'; ctx.lineWidth = 2 * dpr;
    ctx.beginPath(); q.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
    q.forEach(([x, y], k) => {
      ctx.beginPath(); ctx.arc(x, y, 9 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,181,71,0.9)'; ctx.fill(); ctx.strokeStyle = '#0d1016'; ctx.lineWidth = 2 * dpr; ctx.stroke();
      ctx.fillStyle = '#0d1016'; ctx.font = `600 ${10 * dpr}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(['↖', '↗', '↘', '↙'][k], x, y);
    });
  },

  // ---------- tapping things on the photo ----------
  setPick(on) {
    const b = this.project.backdrop, m = b && this.media.get(b.mediaId);
    if (on && !(m && b.show)) { this.toast('Add a photo from the projector first: Project → Design on a photo.', 4000); on = false; }
    if (on && this.editor.compose) this.setCompose(false);
    this.editor.pick = on;
    this.pickLast = null;
    $('pickBar').hidden = !on;
    if (on) this.toggleDrawer(false);
    this.renderSurfaceUI();
  },

  // the photo's edges and lines, worked out once per photo
  photoPixels() {
    const b = this.project.backdrop, m = b && this.media.get(b.mediaId);
    if (!m || !m.el.naturalWidth) return null;
    if (this.photoAnalysis?.mediaId === m.id) return this.photoAnalysis;
    const k = Math.min(1, ANALYSIS_W / m.el.naturalWidth), w = Math.round(m.el.naturalWidth * k), h = Math.round(m.el.naturalHeight * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(m.el, 0, 0, w, h);
    this.photoAnalysis = { mediaId: m.id, w, h, A: analysePhoto(ctx.getImageData(0, 0, w, h).data, w, h) };
    return this.photoAnalysis;
  },

  // a tap at frame pixel p: the rectangle around it on the photo becomes a surface; tapping the same spot again
  // swaps it for the next one out
  pickAt(p) {
    const P = this.photoPixels();
    if (!P) { this.toast('The photo isn\'t loaded yet.'); return; }
    const [W, H] = this.frame, quad = this.backdropQuad();
    const [u, v] = framePointToPhoto(quad, p[0] / W, p[1] / H);
    if (u < 0 || v < 0 || u > 1 || v > 1) { this.toast('That spot is outside the photo.'); return; }
    const last = this.pickLast, again = last && Math.hypot(p[0] - last.p[0], p[1] - last.p[1]) < W * 0.015;
    const found = again ? last.found : quadsAt(P.A, u * P.w, v * P.h);
    const idx = again ? last.idx + 1 : 0;
    if (!found.length) { this.toast('No rectangle found there. Tap nearer the middle of a frame or panel, or add a surface by hand.', 4000); this.pickLast = null; return; }
    if (idx >= found.length) { this.toast('Nothing bigger around this spot. Tap somewhere else.'); return; }
    // corners on the photo -> the frame; pins run bottom-left, bottom-right, top-right, top-left
    const corners = found[idx].quad.map(([x, y]) => photoPointToFrame(quad, x / P.w, y / P.h));
    const pins = [corners[3], corners[2], corners[1], corners[0]];
    const surfaces = this.project.surfaces, prev = again ? surfaces.findIndex((s) => s.id === last.id) : -1;
    let id;
    if (prev >= 0) {
      surfaces[prev].pins = pins; id = last.id;
      this.editor.select(prev); this.changed();
    } else {
      const s = newSurface('square', surfaces.length);
      s.pins = pins; id = s.id;
      if (!this.editor.addSurface(s)) return;
    }
    this.pickLast = { p, found, idx, id };
    const n = surfaces.findIndex((s) => s.id === id) + 1;
    this.toast(idx + 1 < found.length ? `Surface ${n}. Tap the same spot again for the one around it.` : `Surface ${n}.`);
  },
};
