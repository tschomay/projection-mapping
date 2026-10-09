// Finding surfaces with the camera: the capture sheet, running a capture, showing what was found.
// Methods mixed into App (see app.js), so `this` is the app.
import { surfacesFromShots } from '../capture.js';
import { Camera, CaptureError, listCameras, runCapture } from '../camera.js';
import { $ } from '../env.js';

export const scanUI = {
  initScan() {
    const sheet = $('scanSheet');
    this.camera = new Camera($('scanVideo'));
    $('scanBtn').onclick = () => {
      this.toggleDrawer(false);
      $('scanView').hidden = true; $('scanUndo').hidden = true;
      sheet.showModal();
      this.openCamera($('scanCam').value);
    };
    $('closeScan').onclick = () => sheet.close();
    sheet.addEventListener('close', () => { if (!this.scanning) this.camera.close(); });
    $('scanCam').onchange = (e) => this.openCamera(e.target.value);
    $('scanStart').onclick = () => this.runScan();
    $('scanUndo').onclick = () => {
      if (!this.scanPrev) return;
      this.project.surfaces = this.scanPrev; this.scanPrev = null;
      this.editor.select(-1); this.changed();
      $('scanUndo').hidden = true;
      $('scanStatus').textContent = 'Your earlier surfaces are back.';
    };
    // cancel a capture: tap anywhere, or Escape
    $('stage').addEventListener('pointerdown', () => { if (this.scanning) this.scanAbort?.abort(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.scanning) this.scanAbort?.abort(); });
  },

  async openCamera(deviceId) {
    const status = $('scanStatus');
    $('scanStart').disabled = true;
    status.textContent = 'Opening the camera…';
    try {
      const used = await this.camera.open(deviceId || undefined);
      // camera names are only readable once permission is granted
      const cams = await listCameras(), sel = $('scanCam');
      if (cams.length > 1) {
        sel.innerHTML = cams.map((c, i) => `<option value="${c.deviceId}">${(c.label || 'Camera ' + (i + 1)).replace(/[<&"]/g, '')}</option>`).join('');
        sel.value = used || deviceId || cams[0].deviceId;
      }
      sel.hidden = cams.length < 2;
      $('scanStart').disabled = false;
      status.textContent = 'Aim the camera at the set, then tap Start. Use the main camera, not the ultra-wide one.';
    } catch (err) {
      status.textContent = err.message;
    }
  },

  async runScan() {
    const sheet = $('scanSheet'), status = $('scanStatus');
    const [W, H] = this.frame;
    // with an output window or second screen the patterns go there and this screen shows progress;
    // otherwise this screen is the projector, so everything but the pattern is hidden
    const remote = this.output.connected;
    const show = (f) => { if (remote) this.post({ type: 'pattern', f }); else this.showPattern(f); };
    this.scanning = true;
    this.scanAbort = new AbortController();
    $('scanStart').disabled = true; $('scanUndo').hidden = true; $('scanView').hidden = true;
    if (!remote) {
      sheet.close();
      document.body.classList.add('capturing');
      this.gesture();
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    }
    let message;
    try {
      const cap = await runCapture(this.camera, {
        W, H, show, signal: this.scanAbort.signal,
        progress: (i, n, text) => { status.textContent = text; },
      });
      show(null);
      status.textContent = 'Looking for flat surfaces…';
      await new Promise((r) => setTimeout(r, 30));
      const res = surfacesFromShots(cap.shots, { camW: cap.camW, camH: cap.camH, W, H, keepBackground: $('scanKeepBg').checked });
      this.drawScan(res);
      if (!res.surfaces.length) throw new CaptureError(res.planes ? 'Only wall and floor were found. Tick "Keep wall and floor" to use them, or bring objects closer to the projector.' : 'No flat surfaces were found. Check the camera sees the projection clearly, and dim the lights.');
      this.scanPrev = this.project.surfaces;
      this.project.surfaces = res.surfaces;
      this.editor.select(-1);
      this.changed();
      $('scanUndo').hidden = !this.scanPrev.length;
      message = `Found ${res.surfaces.length} surface${res.surfaces.length === 1 ? '' : 's'}` +
        (res.background && !$('scanKeepBg').checked ? `; ${res.background} wall or floor area${res.background === 1 ? '' : 's'} left out` : '') + '.\n' +
        `The camera decoded ${Math.round(res.coverage * 100)}% of the frame. Projection lag ${Math.round(cap.latency)} ms.` +
        (cap.locked.length ? ` Locked ${cap.locked.join(', ')}.` : '') +
        (res.degenerate ? '\nAlmost everything looked like one plane: move the camera further to the side of the projector.' : '') +
        '\nCheck each surface in Edit mode and drag any corner that is off.';
    } catch (err) {
      message = err instanceof CaptureError ? err.message : 'The capture failed: ' + (err.message || err);
    } finally {
      show(null);
      document.body.classList.remove('capturing');
      this.scanning = false;
      $('scanStart').disabled = false;
      if (!sheet.open) sheet.showModal();
      status.textContent = message;
      ($('scanView').hidden ? status : $('scanView')).scrollIntoView({ block: 'nearest' });
    }
  },

  // the flat areas found, one colour each, in the projector frame (grey: wall and floor)
  drawScan(res) {
    const { GW, GH, regions } = res.res, c = $('scanView');
    c.width = GW; c.height = GH;
    const ctx = c.getContext('2d'), img = ctx.createImageData(GW, GH);
    regions.forEach((r, i) => {
      const keep = !r.background || $('scanKeepBg').checked;
      const h = (i * 0.137) % 1, col = keep ? [0, 8, 4].map((n) => { const k = (n + h * 12) % 12; return 255 * (0.55 - 0.41 * Math.max(-1, Math.min(k - 3, 9 - k, 1))); }) : [45, 52, 64];
      for (const cell of r.cells) img.data.set([col[0], col[1], col[2], 255], cell * 4);
    });
    for (let k = 3; k < img.data.length; k += 4) if (!img.data[k]) img.data[k] = 255;
    ctx.putImageData(img, 0, 0);
    c.hidden = false;
  },
};
