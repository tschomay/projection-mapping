// Cues and timeline (roadmap #8): a three-cue show in sync with a song, cues on a tap in Show mode, and cues
// that follow beats. The song is a generated 120 bpm kick drum.
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveApp, loadPlaywright, BROWSER_ARGS, reporter } from './serve.mjs';

function kickTrack(seconds = 10, bpm = 120, rate = 22050) {
  const n = seconds * rate, data = Buffer.alloc(44 + n * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 2, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(n * 2, 40);
  const period = 60 / bpm;
  for (let i = 0; i < n; i++) {
    const t = i / rate, k = t % period;
    const v = Math.sin(2 * Math.PI * 60 * k) * Math.exp(-k * 18) * 0.9 + Math.sin(2 * Math.PI * 440 * t) * 0.03;
    data.writeInt16LE(Math.round(v * 32000), 44 + i * 2);
  }
  return data;
}

export default async function run() {
  const t = reporter('show');
  const { chromium } = await loadPlaywright();
  const server = await serveApp();
  const browser = await chromium.launch({ args: BROWSER_ARGS });
  const errors = [];
  const dir = mkdtempSync(join(tmpdir(), 'pm-show-'));
  const song = join(dir, 'kick.wav');
  writeFileSync(song, kickTrack());
  try {
    const page = await (await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url);
    await page.waitForFunction(() => window.app && window.app.editor);
    await page.evaluate(() => { document.getElementById('connectSheet').close(); document.getElementById('toolsBtn').click(); });
    await page.click('[data-add="square"]');
    await page.click('[data-add="circle"]');

    // three looks, saved as cues
    const look = async (effect) => {
      await page.evaluate((fx) => { for (let i = 0; i < 2; i++) { window.app.editor.select(i); window.app.setContent({ kind: 'effect', effect: fx }); } }, effect);
      await page.click('#cueAdd');
    };
    await page.evaluate(() => window.app.selectTab('show'));
    await look('plasma'); await look('white'); await look('sequence');
    t.ok(await page.evaluate(() => window.app.project.cues.length === 3), 'three cues added');

    // place them on the soundtrack at 0, 2 and 4 seconds
    await page.setInputFiles('#addAudio', song);
    await page.waitForFunction(() => window.app.soundtrackEl() && window.app.soundtrackEl().duration > 0);
    await page.evaluate(() => {
      window.app.project.cues.forEach((c, i) => { c.start = { mode: 'at', value: i * 2 }; c.transition = { type: i === 2 ? 'wipe' : 'fade', dur: 0.5 }; });
      window.app.renderShowUI();
      window.__log = [];
      window.app.onCue = ((orig) => (i) => { window.__log.push({ i, at: window.app.currentTime() }); orig.call(window.app, i); })(window.app.onCue);
    });
    t.ok(await page.evaluate(() => !document.getElementById('timelineGroup').hidden && document.querySelectorAll('#timeline b').length === 3), 'the timeline shows three markers');
    await page.evaluate(() => window.app.play());
    await page.waitForFunction(() => window.app.currentTime() > 5, null, { timeout: 60000 });
    const log = await page.evaluate(() => window.__log);
    const seq = log.map((e) => e.i).join(',');
    t.ok(seq === '1,2' || seq === '0,1,2', `cues ran in order with the song (${seq})`);
    // cues are checked once per frame, so allow a frame or two (software GL in CI is slow)
    const late = Math.max(...log.filter((e) => e.i > 0).map((e) => Math.abs(e.at - e.i * 2)));
    const frame = await page.evaluate(() => 1 / window.app.fps);
    t.ok(late < 0.1 + 2 * frame, `each cue on time, within two frames (worst ${late.toFixed(2)} s, frame ${frame.toFixed(2)} s)`);
    t.ok(await page.evaluate(() => window.app.project.surfaces.every((s) => s.content.effect === 'sequence')), 'the surfaces show the last cue');
    // jumping back to the start brings back the first cue
    await page.evaluate(() => { for (const el of window.app.playingEls()) el.currentTime = 0.3; });
    await page.waitForFunction(() => window.app.show.index === 0, null, { timeout: 10000 }).then(() => t.ok(true, 'jumping back in the song goes back to cue 1'), () => t.ok(false, 'jumping back in the song goes back to cue 1'));
    await page.evaluate(() => window.app.pause());

    // on a tap: in Show mode one tap is the next cue, a double-tap still leaves Show mode
    await page.evaluate(() => { window.app.project.cues.forEach((c) => { c.start = { mode: 'tap', value: 0 }; }); window.app.show.go(0, { transition: false }); window.app.setShow(true); });
    await page.mouse.click(400, 200);
    await page.waitForFunction(() => window.app.show.index === 1, null, { timeout: 5000 }).then(() => t.ok(true, 'a tap in Show mode runs the next cue'), () => t.ok(false, 'a tap in Show mode runs the next cue'));
    t.ok(await page.evaluate(() => window.app.show.fade !== null), 'the crossfade is running');
    await page.waitForTimeout(600);
    await page.mouse.dblclick(400, 200);
    await page.waitForTimeout(600);
    const dbl = await page.evaluate(() => ({ show: document.body.classList.contains('show'), index: window.app.show.index }));
    t.ok(!dbl.show && dbl.index === 1, 'a double-tap leaves Show mode without running a cue ' + JSON.stringify(dbl));

    // after some beats: cue 2 follows cue 1 after 4 beats of the song
    await page.evaluate(() => {
      const c = window.app.project.cues;
      c[1].start = { mode: 'beats', value: 4 }; c[2].start = { mode: 'tap', value: 0 };
      window.app.show.go(0, { transition: false });
      for (const el of window.app.playingEls()) el.currentTime = 0;
      window.app.play();
      window.__t0 = performance.now();
    });
    const ok = await page.waitForFunction(() => window.app.show.index === 1, null, { timeout: 20000 }).then(() => true, () => false);
    const secs = await page.evaluate(() => (performance.now() - window.__t0) / 1000);
    t.ok(ok && secs > 1.2 && secs < 4, `four beats later the next cue runs (${secs.toFixed(1)} s at 120 bpm)`);
    t.ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  } finally {
    await browser.close(); server.close();
  }
  return t.failed;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = (await run()) ? 1 : 0;
