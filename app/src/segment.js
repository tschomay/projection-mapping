// Segment Anything in the browser (issue #37): SlimSAM, a small (about 14 MB, quantized) version of Meta's Segment
// Anything model, through transformers.js. Both load the first time *Any shape* is used, from jsDelivr and Hugging
// Face, and the browser keeps the model afterwards. The photo is encoded once; each tap is then about half a second
// and gives up to three nested masks (a part, the object, a larger whole). No DOM here.
export const LIB_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/+esm';
export const MODEL_ID = 'Xenova/slimsam-77-uniform';

let loading = null;

// The model, loaded once. progress(share 0..1) reports the download. Rejects when it can't load (offline, or a
// page that can't reach the model's hosts, such as a Claude artifact); a later call tries again.
export function loadSegmenter(progress = () => {}) {
  return loading ||= (async () => {
    const T = await import(LIB_URL);
    const sizes = new Map();
    const progress_callback = (e) => {
      if (e.status !== 'progress' || !e.total) return;
      sizes.set(e.file, [e.loaded, e.total]);
      let got = 0, all = 0; for (const [l, t] of sizes.values()) { got += l; all += t; }
      progress(all ? got / all : 0);
    };
    // the graphics card where the browser offers one (encoding a photo takes a second or two), else the CPU (on a
    // phone, ten seconds or more)
    const load = (device) => T.SamModel.from_pretrained(MODEL_ID, { dtype: 'q8', device, progress_callback });
    const [model, processor] = await Promise.all([
      (navigator.gpu ? load('webgpu').catch(() => load('wasm')) : load('wasm')),
      T.AutoProcessor.from_pretrained(MODEL_ID, { progress_callback }),
    ]);
    return new Segmenter(T, model, processor);
  })().catch((err) => { loading = null; throw err; });
}

class Segmenter {
  constructor(T, model, processor) { this.T = T; this.model = model; this.processor = processor; this.key = null; }

  // encode a photo (RGBA, w x h) once; `key` names it, so asking again for the same photo waits for the same work
  embed(rgba, w, h, key) {
    if (this.key !== key) {
      this.key = key;
      this.ready = (async () => {
        const inputs = await this.processor(new this.T.RawImage(rgba, w, h, 4).rgb());
        const embeddings = await this.model.get_image_embeddings(inputs);
        return { inputs, embeddings };
      })();
      this.ready.catch(() => { if (this.key === key) this.key = null; });
    }
    return this.ready;
  }

  // masks around photo pixel (x, y), smallest first: each { mask (one byte per pixel), area, score }. Masks that
  // don't hold the tap, cover most of the photo or barely differ from a smaller one are left out. sense (0..1) moves
  // the line between in and out on the model's own scores: stricter keeps only what it is surer of, so a mask pulls
  // back inside weaker boundaries. The scores of the last tap are kept, so moving sense is quick.
  async masksAt(x, y, { sense = 0.5 } = {}) {
    const { inputs, embeddings } = await this.ready, T = this.T;
    if (!this.last || this.last.x !== x || this.last.y !== y || this.last.key !== this.key) {
      const [rh, rw] = inputs.reshaped_input_sizes[0], [oh, ow] = inputs.original_sizes[0];
      const input_points = new T.Tensor('float32', [x * rw / ow, y * rh / oh], [1, 1, 1, 2]);
      const input_labels = new T.Tensor('int64', [1n], [1, 1, 1]);
      const out = await this.model({ ...embeddings, input_points, input_labels });
      const [m] = await this.processor.post_process_masks(out.pred_masks, inputs.original_sizes, inputs.reshaped_input_sizes, { binarize: false });
      this.last = { x, y, key: this.key, m, scores: Array.from(out.iou_scores.data) };
    }
    const { m, scores } = this.last, [, k, H, W] = m.dims, n = H * W, cut = (sense - 0.5) * 6;
    const at = Math.floor(y) * W + Math.floor(x), found = [];
    for (let j = 0; j < k; j++) {
      const mask = new Uint8Array(n);
      let area = 0;
      for (let i = 0; i < n; i++) if (m.data[j * n + i] > cut) { mask[i] = 1; area++; }
      if (mask[at] && area < n * 0.5 && scores[j] > 0.5) found.push({ mask, area, score: scores[j] });
    }
    found.sort((a, b) => a.area - b.area);
    return found.filter((f, i) => !i || f.area > found[i - 1].area * 1.05);
  }
}
