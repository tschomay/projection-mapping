// The user's media: videos, images and audio picked from the device. Files stay local (object URLs);
// projects keep only ids and names, and the blobs are kept in IndexedDB when the browser allows.
import { putBlob, getBlob, deleteBlob } from './store.js';

export class MediaLibrary {
  constructor() { this.items = new Map(); this.onchange = () => {}; }

  kindOf(file) {
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    return null;
  }

  async add(file, { persist = true, id } = {}) {
    const kind = this.kindOf(file);
    if (!kind) throw new Error(`${file.name} isn't a video, image or audio file.`);
    id = id || 'm' + Math.random().toString(36).slice(2, 10);
    const url = URL.createObjectURL(file);
    const item = { id, name: file.name, kind, url, el: this.makeElement(kind, url) };
    this.items.set(id, item);
    if (persist) putBlob(id, { name: file.name, type: file.type, blob: file }).catch(() => { item.unsaved = true; });
    this.onchange();
    return item;
  }

  // attach an existing object URL (used by the output window, which shares the editor's files)
  addUrl({ id, name, kind, url }) {
    if (this.items.has(id)) return this.items.get(id);
    const item = { id, name, kind, url, el: this.makeElement(kind, url) };
    this.items.set(id, item);
    return item;
  }

  makeElement(kind, url) {
    if (kind === 'image') { const img = new Image(); img.src = url; return img; }
    const el = document.createElement(kind === 'video' ? 'video' : 'audio');
    el.src = url; el.loop = true; el.playsInline = true; el.preload = 'auto'; el.crossOrigin = 'anonymous';
    if (kind === 'video') { el.muted = true; el.setAttribute('playsinline', ''); }
    return el;
  }

  // reconnect project media to blobs saved on this device; returns ids that are missing
  async restore(list) {
    const missing = [];
    for (const m of list) {
      if (this.items.has(m.id)) continue;
      const rec = await getBlob(m.id).catch(() => null);
      if (rec && rec.blob) await this.add(new File([rec.blob], rec.name, { type: rec.type }), { persist: false, id: m.id });
      else missing.push(m);
    }
    return missing;
  }

  remove(id) {
    const it = this.items.get(id);
    if (!it) return;
    if (it.el.pause) it.el.pause();
    URL.revokeObjectURL(it.url);
    this.items.delete(id);
    deleteBlob(id).catch(() => {});
    this.onchange();
  }

  get(id) { return this.items.get(id); }
  list(kind) { return [...this.items.values()].filter((m) => !kind || m.kind === kind); }
  meta() { return [...this.items.values()].map(({ id, name, kind }) => ({ id, name, kind })); }
}
