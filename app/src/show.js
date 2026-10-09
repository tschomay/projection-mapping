// Cues and timeline (roadmap #8). A show is a list of cues; a cue is a look: what each surface shows.
// Each cue says how it starts (on a tap, some seconds or beats after the previous cue, or at a time in the
// soundtrack) and how it arrives (crossfade, cut, or a wipe across the frame).
//
//   cue = { id, name, looks: { [surfaceId]: content }, start: { mode: 'tap'|'after'|'beats'|'at', value }, transition: { type: 'fade'|'cut'|'wipe', dur } }
//
// Going to a cue sets every surface's content to the cue's look at once (so the editor shows the target) and
// records the previous look; the renderer blends from that to the new one for the transition's duration.

export const TRANSITIONS = { fade: 0, cut: 1, wipe: 2 };
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = (o) => JSON.parse(JSON.stringify(o));

export function newCue(surfaces, n) {
  const looks = {};
  for (const s of surfaces) looks[s.id] = clone(s.content || { kind: 'effect', effect: 'outline' });
  return { id: uid(), name: 'Cue ' + n, looks, start: { mode: 'tap', value: 0 }, transition: { type: 'fade', dur: 1 } };
}

export const fmtTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
export function parseTime(text) {
  const m = String(text).trim().match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  return m ? (+(m[1] || 0)) * 60 + +m[2] : null;
}

export class ShowRunner {
  constructor(app) {
    this.app = app;
    this.index = -1;          // the cue on stage (-1: none yet)
    this.enteredAt = 0;       // when it started (performance.now)
    this.enteredBeats = 0;
    this.lastSong = null;     // soundtrack time at the previous tick
    this.fade = null;         // { from: { [surfaceId]: content }, type, dur, start }
  }

  get cues() { return this.app.project.cues || (this.app.project.cues = []); }

  // put a cue on stage
  go(index, { transition = true, now = performance.now() } = {}) {
    const cue = this.cues[index];
    if (!cue) return;
    const surfaces = this.app.project.surfaces;
    const from = {};
    for (const s of surfaces) from[s.id] = clone(s.content || {});
    let changed = false;
    for (const s of surfaces) {
      const look = cue.looks[s.id];
      if (look && JSON.stringify(look) !== JSON.stringify(s.content)) { s.content = clone(look); changed = true; }
    }
    const t = cue.transition || { type: 'fade', dur: 1 };
    this.fade = transition && changed && t.type !== 'cut' && t.dur > 0 ? { from, type: t.type, dur: t.dur, start: now } : null;
    this.index = index;
    this.enteredAt = now;
    this.enteredBeats = this.app.audio.state.beats;
    this.app.onCue(index);
  }

  next() { if (this.index + 1 < this.cues.length) this.go(this.index + 1); }

  // blend amount for the renderer: null when no transition is running
  mix(now) {
    const f = this.fade;
    if (!f) return null;
    const k = (now - f.start) / 1000 / f.dur;
    if (k >= 1) { this.fade = null; this.app.dirty = true; return null; }
    return { from: f.from, type: TRANSITIONS[f.type] ?? 0, amount: Math.max(0, k) };
  }

  // called every frame: fire cues that start by themselves
  tick(now, audio, songTime, playing) {
    const cues = this.cues;
    if (!cues.length) return;
    // timeline: cues placed at soundtrack times follow the playhead, including seeks and loops
    if (playing && songTime != null) {
      const last = this.lastSong;
      this.lastSong = songTime;
      if (last != null) {
        let target = -1;
        if (songTime < last - 0.25) {
          // jumped back (restart or loop): the latest timed cue at or before the playhead
          cues.forEach((c, i) => { if (c.start.mode === 'at' && c.start.value <= songTime) target = i; });
          if (target < 0) target = cues.findIndex((c) => c.start.mode === 'at');
        } else {
          cues.forEach((c, i) => { if (c.start.mode === 'at' && c.start.value > last && c.start.value <= songTime) target = i; });
        }
        if (target >= 0 && target !== this.index) { this.go(target, { now }); return; }
      }
    } else this.lastSong = null;
    // the next cue may follow this one by itself
    const nxt = cues[this.index + 1];
    if (!nxt || this.index < 0) return;
    const st = nxt.start;
    if (st.mode === 'after' && (now - this.enteredAt) / 1000 >= st.value) this.go(this.index + 1, { now });
    else if (st.mode === 'beats' && audio.active && audio.beats - this.enteredBeats >= Math.max(1, st.value)) this.go(this.index + 1, { now });
  }

  // state for an output display, so it can run the same transition
  snapshot(now) {
    return this.fade ? { from: this.fade.from, type: this.fade.type, dur: this.fade.dur, elapsed: (now - this.fade.start) / 1000 } : null;
  }
  restore(snap, now) {
    this.fade = snap ? { from: snap.from, type: snap.type, dur: snap.dur, start: now - snap.elapsed * 1000 } : null;
  }
}
