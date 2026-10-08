// Project persistence. Projects (small JSON) live in localStorage; media blobs live in IndexedDB.
// Every access is guarded: storage can be unavailable (private windows, embedded previews).

const INDEX_KEY = 'pm.projects';
const projectKey = (id) => 'pm.project.' + id;

function read(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } }
function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }

export function listProjects() { return read(INDEX_KEY) || { current: null, list: [] }; }

export function loadProject(id) { return read(projectKey(id)); }

export function saveProject(project) {
  const idx = listProjects();
  const entry = idx.list.find((p) => p.id === project.id);
  if (entry) { entry.name = project.name; entry.updated = Date.now(); } else idx.list.push({ id: project.id, name: project.name, updated: Date.now() });
  idx.current = project.id;
  return write(projectKey(project.id), project) && write(INDEX_KEY, idx);
}

export function deleteProject(id) {
  const idx = listProjects();
  idx.list = idx.list.filter((p) => p.id !== id);
  if (idx.current === id) idx.current = idx.list[0]?.id || null;
  try { localStorage.removeItem(projectKey(id)); } catch { /* ignore */ }
  write(INDEX_KEY, idx);
}

export function newProject(name = 'Untitled mapping') {
  return { version: 1, id: 'p' + Math.random().toString(36).slice(2, 10), name, surfaces: [], media: [], soundtrack: null, settings: { snap: true, sensitivity: 1, loop: true } };
}

// validate an imported project and give it a fresh id so it never overwrites an existing one
export function parseProject(text) {
  const p = JSON.parse(text);
  if (!p || !Array.isArray(p.surfaces)) throw new Error("That file isn't a projection mapping project.");
  for (const s of p.surfaces) {
    if (!Array.isArray(s.pins) || s.pins.length !== 4 || !Array.isArray(s.parts) || !s.parts.length) throw new Error('A surface in that file is incomplete.');
  }
  return { ...newProject(p.name || 'Imported mapping'), ...p, id: 'p' + Math.random().toString(36).slice(2, 10) };
}

// ---- media blobs ----
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('no IndexedDB')); return; }
    const req = indexedDB.open('pm-media', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('blobs');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction('blobs', mode), r = fn(t.objectStore('blobs'));
    t.oncomplete = () => resolve(r && r.result); t.onerror = () => reject(t.error);
  });
}
export const putBlob = (id, rec) => tx('readwrite', (s) => s.put(rec, id));
export const getBlob = (id) => tx('readonly', (s) => s.get(id));
export const deleteBlob = (id) => tx('readwrite', (s) => s.delete(id));
