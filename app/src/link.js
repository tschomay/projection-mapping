// Links from the editor to an output display.
// - An output window on this device (laptop + projector as a second display) talks over a BroadcastChannel and
//   shares the editor's object URLs directly.
// - A second screen started through the Presentation API (Chrome on Android to a Cast device or a wired or
//   wireless display) talks over a PresentationConnection. The receiver may be another device, where the
//   editor's object URLs mean nothing, so it asks for any file it can't open and the editor sends the bytes.
// Both carry the same JSON messages: 'hello' (output -> editor, with the output's aspect ratio) and 'state'.

const CHUNK = 64 * 1024;

export const presentationSupported = () => 'PresentationRequest' in window && window.isSecureContext;
export const presentationReceiver = () => (navigator.presentation && navigator.presentation.receiver) || null;

// Wrap a PresentationConnection (or anything with send() and message events) as a port: post(msg) sends JSON,
// sendFile() streams a blob as a header message plus binary chunks, and onmessage/onfile receive.
export class ConnectionPort {
  constructor(conn) {
    this.conn = conn;
    this.onmessage = () => {};
    this.onfile = () => {};
    this.onclose = () => {};
    this.queue = Promise.resolve();
    this.incoming = null;
    if ('binaryType' in conn) conn.binaryType = 'arraybuffer';
    conn.addEventListener('message', (e) => this.receive(e.data));
    for (const ev of ['close', 'terminate']) conn.addEventListener(ev, () => this.onclose());
  }

  get open() { return !('state' in this.conn) || this.conn.state === 'connected'; }

  post(msg) { if (this.open) this.conn.send(JSON.stringify(msg)); }

  // files go one at a time, so binary chunks always follow their own header
  sendFile(id, rec) {
    this.queue = this.queue.then(async () => {
      if (!this.open) return;
      const buf = await rec.blob.arrayBuffer();
      const chunks = Math.ceil(buf.byteLength / CHUNK);
      this.post({ type: 'file', id, name: rec.name, mime: rec.type, size: buf.byteLength, chunks });
      for (let i = 0; i < chunks && this.open; i++) {
        this.conn.send(buf.slice(i * CHUNK, (i + 1) * CHUNK));
        if (i % 16 === 15) await new Promise((r) => setTimeout(r, 0));   // let the UI breathe on big files
      }
    }).catch(() => {});
    return this.queue;
  }

  receive(data) {
    if (typeof data === 'string') {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      if (msg.type === 'file') {
        this.incoming = { ...msg, parts: [], got: 0 };
        if (!msg.chunks) this.finishFile();
        return;
      }
      this.onmessage(msg);
      return;
    }
    const f = this.incoming;
    if (!f) return;
    f.parts.push(data);
    f.got++;
    if (f.got >= f.chunks) this.finishFile();
  }

  finishFile() {
    const f = this.incoming;
    this.incoming = null;
    this.onfile({ id: f.id, file: new File(f.parts, f.name, { type: f.mime }) });
  }
}
