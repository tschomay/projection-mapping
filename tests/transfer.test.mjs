// Second-screen file transfer (app/src/link.js, #22) in Node with a fake connection whose messages arrive
// slowly: the sender never has more than its window in flight, and the file arrives intact.
import { ConnectionPort } from '../app/src/link.js';
import { reporter } from './serve.mjs';

function pair(delayMs) {
  const a = new EventTarget(), b = new EventTarget();
  for (const [me, other] of [[a, b], [b, a]]) {
    me.state = 'connected';
    me.sent = 0;
    me.send = (d) => { me.sent++; setTimeout(() => other.dispatchEvent(Object.assign(new Event('message'), { data: d })), delayMs); };
  }
  return [a, b];
}

export default async function run() {
  const t = reporter('transfer');
  const [ca, cb] = pair(2);
  const sender = new ConnectionPort(ca), receiver = new ConnectionPort(cb);
  const size = 5 * 1024 * 1024 + 123, bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = (i * 7 + (i >> 9)) & 255;
  let maxInFlight = 0, chunksIn = 0, progress = [];
  cb.addEventListener('message', (e) => { if (typeof e.data !== 'string') chunksIn++; });
  const origSend = ca.send;
  ca.send = (d) => { origSend(d); if (typeof d !== 'string') maxInFlight = Math.max(maxInFlight, ca.sent - 1 - sender.acked); };
  sender.onprogress = (p) => progress.push(p.sent / p.total);
  const done = new Promise((r) => { receiver.onfile = r; });
  await sender.sendFile('v1', { blob: new Blob([bytes]), name: 'v.mp4', type: 'video/mp4' });
  const { id, file } = await done;
  const back = new Uint8Array(await file.arrayBuffer());
  t.ok(id === 'v1' && file.name === 'v.mp4' && file.type === 'video/mp4', 'the file keeps its id, name and type');
  t.ok(back.length === size && back.every((v, i) => v === bytes[i]), `5 MB arrives intact (${back.length} bytes in ${chunksIn} chunks)`);
  t.ok(maxInFlight <= 33, `the sender waits for acknowledgements (at most ${maxInFlight} chunks in flight)`);
  t.ok(progress.length > 5 && progress[progress.length - 1] === 1, `progress is reported (${progress.length} updates, ending at 100%)`);
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
