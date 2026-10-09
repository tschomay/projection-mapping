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

const WINDOW = 32;   // chunks in flight before waiting for the receiver (2 MB)
const ACK_EVERY = 8;

// Wrap a PresentationConnection (or anything with send() and message events) as a port: post(msg) sends JSON,
// sendFile() streams a blob as a header message plus binary chunks, and onmessage/onfile receive.
// Files are read a slice at a time and paced by the receiver's acknowledgements, so a large video never sits in
// memory whole on the sending side, and the receiver folds chunks into a Blob (which the browser may keep on disk).
export class ConnectionPort {
  constructor(conn) {
    this.conn = conn;
    this.onmessage = () => {};
    this.onfile = () => {};
    this.onprogress = () => {};   // ({ id, name, sent, total }) while sending
    this.onclose = () => {};
    this.queue = Promise.resolve();
    this.incoming = null;
    this.acked = 0;
    this.ackWaiter = null;
    if ('binaryType' in conn) conn.binaryType = 'arraybuffer';
    conn.addEventListener('message', (e) => this.receive(e.data));
    for (const ev of ['close', 'terminate']) conn.addEventListener(ev, () => { this.ackWaiter?.(); this.onclose(); });
  }

  get open() { return !('state' in this.conn) || this.conn.state === 'connected'; }

  post(msg) { if (this.open) this.conn.send(JSON.stringify(msg)); }

  // files go one at a time, so binary chunks always follow their own header
  sendFile(id, rec) {
    this.queue = this.queue.then(async () => {
      if (!this.open) return;
      const size = rec.blob.size, chunks = Math.ceil(size / CHUNK);
      this.acked = 0;
      this.post({ type: 'file', id, name: rec.name, mime: rec.type, size, chunks });
      for (let i = 0; i < chunks && this.open; i++) {
        // wait while too much is in flight
        while (i - this.acked >= WINDOW && this.open) await new Promise((r) => { this.ackWaiter = r; setTimeout(r, 5000); });
        this.conn.send(await rec.blob.slice(i * CHUNK, (i + 1) * CHUNK).arrayBuffer());
        if (i % ACK_EVERY === ACK_EVERY - 1 || i === chunks - 1) this.onprogress({ id, name: rec.name, sent: Math.min((i + 1) * CHUNK, size), total: size });
      }
    }).catch(() => {});
    return this.queue;
  }

  receive(data) {
    if (typeof data === 'string') {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      if (msg.type === 'file') {
        this.incoming = { ...msg, blob: new Blob([]), pending: [], got: 0 };
        if (!msg.chunks) this.finishFile();
        return;
      }
      if (msg.type === 'ack') { this.acked = msg.got; this.ackWaiter?.(); this.ackWaiter = null; return; }
      this.onmessage(msg);
      return;
    }
    const f = this.incoming;
    if (!f) return;
    f.pending.push(data);
    f.got++;
    if (f.pending.length >= ACK_EVERY) { f.blob = new Blob([f.blob, ...f.pending]); f.pending = []; }
    if (f.got % ACK_EVERY === 0 || f.got >= f.chunks) this.post({ type: 'ack', id: f.id, got: f.got });
    if (f.got >= f.chunks) this.finishFile();
  }

  finishFile() {
    const f = this.incoming;
    this.incoming = null;
    this.onfile({ id: f.id, file: new File([f.blob, ...f.pending], f.name, { type: f.mime }) });
  }
}
