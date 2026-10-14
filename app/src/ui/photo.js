// The design photo lined up with the projector frame (issue #34), and surfaces picked on it with a tap (#35):
// taking the photo from beside the projector's lens, dragging the frame's corners on it, and turning a tapped
// picture frame, panel or door into a surface, or any shape (#37: a mirror, a wreath) through a segmentation model or
// a colour fill. Methods mixed into App (see app.js), so `this` is the app.
import { Camera, CaptureError, listCameras, runFramePhoto } from '../camera.js';
import { coverQuad, cssMatrix, frameQuad, photoToFrame, framePointToPhoto, photoPointToFrame } from '../photo.js';
import { analysePhoto, quadsAt } from '../regions.js';
import { colourFill, maskToSurface } from '../outline.js';
import { loadSegmenter } from '../segment.js';
import { newSurface, SHAPES } from '../geometry.js';
import { $ } from '../env.js';

const ANALYSIS_W = 1024;   // the photo is searched for rectangles at most this wide

export const photoUI = {
  initPhotoUI() {
    $('backdrop').addEventListener('load', () => this.placeBackdrop());
    this.initPhotoSheet();
    this.initAlign();
    $('pickBtn').onclick = () => this.setPick(!this.editor.pick);
    $('pickDone').onclick = () => this.setPick(false);
    this.pickKind = 'rect';
    document.querySelectorAll('#pickKind button').forEach((b) => { b.onclick = () => this.setPickKind(b.dataset.kind); });
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

  // Rectangles (edges and lines, instant) or any shape (the segmentation model, or the colour fill without it)
  setPickKind(kind) {
    this.pickKind = kind; this.pickLast = null;
    document.querySelectorAll('#pickKind button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kind === kind)));
    $('pickHint').textContent = kind === 'any' ? 'Tap a mirror, a wreath, anything. Tap it again for a bigger outline.' : 'Tap a frame, panel or door on the photo. Tap it again for the one around it.';
    // start the download, and then encoding the photo, now rather than on the first tap
    if (kind === 'any') this.segmenter().then((seg) => { const P = seg && this.photoPixels(); if (P) seg.embed(P.rgba, P.w, P.h, P.mediaId).catch(() => {}); });
  },

  // the segmentation model, loading it the first time (with progress shown); null where it can't load
  segmenter() {
    if (this.segFailed) return Promise.resolve(null);
    if (!this.segLoad) {
      let shown = -1;
      this.segLoad = loadSegmenter((share) => {
        const pc = Math.floor(share * 100);
        if (pc !== shown && this.pickKind === 'any') { shown = pc; this.toast(`Loading the outline model (about 14 MB, only once): ${pc}%`, 20000); }
      }).then((seg) => { if (this.pickKind === 'any') this.toast('Outline model ready. Tap something on the photo.'); return seg; }, () => {
        this.segFailed = true; this.segLoad = null;
        this.toast('The outline model can\'t load here (offline, or blocked), so a colour fill finds outlines instead. It works best on plainly coloured things.', 6000);
        return null;
      });
    }
    return this.segLoad;
  },

  // surface geometry for any shape around photo pixel (x, y): the model's masks, or the colour fill's
  async shapesAt(P, x, y, quad) {
    const [W, H] = this.frame;
    const toFrame = ([px, py]) => { const [u, v] = photoPointToFrame(quad, px / P.w, py / P.h); return [u * W, v * H]; };
    const seg = await this.segmenter();
    let masks = [];
    if (seg) {
      const t = setTimeout(() => this.toast('Looking at the photo: the first time takes a while on a phone…', 30000), 400);
      try { await seg.embed(P.rgba, P.w, P.h, P.mediaId); masks = await seg.masksAt(x, y); } catch { /* the model failed on this device: the colour fill below */ } finally { clearTimeout(t); }
    }
    if (!masks.length) masks = colourFill(P.rgba, P.w, P.h, x, y, P.A);
    return masks.map((m) => maskToSurface(m.mask, P.w, P.h, x, y, toFrame, W, H)).filter(Boolean);
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
    const rgba = ctx.getImageData(0, 0, w, h).data;
    this.photoAnalysis = { mediaId: m.id, w, h, rgba, A: analysePhoto(rgba, w, h) };
    return this.photoAnalysis;
  },

  // a tap at frame pixel p: the rectangle (or shape) around it on the photo becomes a surface; tapping the same spot
  // again swaps it for the next one out
  async pickAt(p) {
    if (this.picking) return;
    const P = this.photoPixels();
    if (!P) { this.toast('The photo isn\'t loaded yet.'); return; }
    const [W, H] = this.frame, quad = this.backdropQuad();
    const [u, v] = framePointToPhoto(quad, p[0] / W, p[1] / H);
    if (u < 0 || v < 0 || u > 1 || v > 1) { this.toast('That spot is outside the photo.'); return; }
    const last = this.pickLast, again = last && last.kind === this.pickKind && Math.hypot(p[0] - last.p[0], p[1] - last.p[1]) < W * 0.015;
    let found = again ? last.found : null;
    if (!found) {
      if (this.pickKind === 'any') {
        this.picking = true;
        try { found = await this.shapesAt(P, u * P.w, v * P.h, quad); } catch (err) { this.toast('Finding the outline failed: ' + (err.message || err)); return; } finally { this.picking = false; }
      } else {
        // corners on the photo -> the frame; pins run bottom-left, bottom-right, top-right, top-left
        found = quadsAt(P.A, u * P.w, v * P.h).map((f) => {
          const c = f.quad.map(([x, y]) => photoPointToFrame(quad, x / P.w, y / P.h));
          return { pins: [c[3], c[2], c[1], c[0]], parts: [{ op: 1, pts: SHAPES.square() }] };
        });
      }
    }
    const idx = again ? last.idx + 1 : 0;
    if (!found.length) {
      this.toast(this.pickKind === 'any' ? 'No outline found there. Try tapping nearer its middle.' : 'No rectangle found there. Tap nearer the middle of a frame or panel, or try Any shape.', 4000);
      this.pickLast = null; return;
    }
    if (idx >= found.length) { this.toast('Nothing bigger around this spot. Tap somewhere else.'); return; }
    const { pins, parts } = found[idx];
    const surfaces = this.project.surfaces, prev = again ? surfaces.findIndex((s) => s.id === last.id) : -1;
    let id;
    if (prev >= 0) {
      Object.assign(surfaces[prev], { pins, parts: structuredClone(parts) }); delete surfaces[prev].mesh; id = last.id;
      this.editor.select(prev); this.changed();
    } else {
      const s = newSurface('square', surfaces.length);
      Object.assign(s, { pins, parts: structuredClone(parts) }); id = s.id;
      if (!this.editor.addSurface(s)) return;
    }
    this.pickLast = { p, found, idx, id, kind: this.pickKind };
    const n = surfaces.findIndex((s) => s.id === id) + 1;
    this.toast(idx + 1 < found.length ? `Surface ${n}. Tap the same spot again for the one around it.` : `Surface ${n}.`);
  },
};
