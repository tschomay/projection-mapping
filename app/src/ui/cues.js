// Show pane: cues, running the show, and the soundtrack timeline.
// Methods mixed into App (see app.js), so `this` is the app.
import { newCue, fmtTime, parseTime } from '../show.js';
import { $ } from '../env.js';

export const cuesUI = {
  initCuesUI() {
    const list = $('cueList');
    $('cueAdd').onclick = () => {
      if (!this.project.surfaces.length) { this.toast('Add surfaces first: a cue remembers what each one shows.'); return; }
      const cues = this.show.cues;
      cues.push(newCue(this.project.surfaces, cues.length + 1));
      this.show.index = cues.length - 1;
      this.scheduleSave(); this.renderShowUI();
      this.toast('Cue saved. Change what the surfaces show, then add the next cue.');
    };
    $('cueGo').onclick = () => { if (this.show.index < 0) this.show.go(0); else this.show.next(); };
    $('cueFirst').onclick = () => { this.show.go(0, { transition: false }); if (this.soundtrackEl()) this.restart(); };
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const i = +b.closest('[data-i]').dataset.i, cues = this.show.cues, c = cues[i];
      const act = b.dataset.act;
      if (act === 'go') this.show.go(i);
      if (act === 'save') { Object.assign(c, { looks: newCue(this.project.surfaces, 0).looks }); this.toast(`${c.name} now has the current look.`); }
      if (act === 'up' && i > 0) [cues[i - 1], cues[i]] = [cues[i], cues[i - 1]];
      if (act === 'down' && i < cues.length - 1) [cues[i + 1], cues[i]] = [cues[i], cues[i + 1]];
      if (act === 'del') { cues.splice(i, 1); if (this.show.index >= cues.length) this.show.index = cues.length - 1; }
      if (act === 'now') { c.start.value = Math.round(this.currentTime() * 10) / 10; }
      this.scheduleSave(); this.renderShowUI();
    });
    list.addEventListener('change', (e) => {
      const el = e.target, i = +el.closest('[data-i]').dataset.i, c = this.show.cues[i];
      if (el.dataset.f === 'name') c.name = el.value.trim() || c.name;
      if (el.dataset.f === 'mode') { c.start.mode = el.value; c.start.value = el.value === 'after' ? 5 : el.value === 'beats' ? 8 : el.value === 'at' ? Math.round(this.currentTime() * 10) / 10 : 0; }
      if (el.dataset.f === 'value') {
        const v = c.start.mode === 'at' ? parseTime(el.value) : parseFloat(el.value);
        if (v != null && v >= 0) c.start.value = v;
      }
      if (el.dataset.f === 'type') c.transition.type = el.value;
      if (el.dataset.f === 'dur') { const v = parseFloat(el.value); if (v >= 0) c.transition.dur = v; }
      this.scheduleSave(); this.renderShowUI();
    });
    $('timeline').addEventListener('pointerdown', (e) => {
      const st = this.soundtrackEl(); if (!st || !st.duration) return;
      const r = e.currentTarget.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * st.duration;
      for (const el of this.playingEls()) el.currentTime = t;
      this.broadcast(true);
    });
    this.renderShowUI();
  },

  onCue() {
    this.changed();
    this.renderShowUI();
  },

  renderShowUI() {
    const cues = this.show.cues, list = $('cueList');
    const esc = (t) => String(t).replace(/[<&"]/g, '');
    const opt = (v, label, cur) => `<option value="${v}"${v === cur ? ' selected' : ''}>${label}</option>`;
    list.innerHTML = cues.map((c, i) => {
      const m = c.start.mode;
      const val = m === 'tap' ? '' : `<input type="text" inputmode="decimal" data-f="value" aria-label="${m === 'at' ? 'Time in the soundtrack' : m === 'after' ? 'Seconds' : 'Beats'}" value="${m === 'at' ? fmtTime(c.start.value) : c.start.value}">${m === 'at' ? '<button class="btn" data-act="now" title="Use the soundtrack\'s current time">Now</button>' : `<span class="note">${m === 'after' ? 's' : 'beats'}</span>`}`;
      return `<div class="cue${i === this.show.index ? ' live' : ''}" data-i="${i}">
        <div class="row"><input type="text" data-f="name" aria-label="Cue name" value="${esc(c.name)}"><button class="btn${i === this.show.index ? ' primary' : ''}" data-act="go">Go</button></div>
        <div class="row"><select data-f="mode" aria-label="How it starts">${opt('tap', 'On a tap', m)}${opt('after', 'After the previous, by', m)}${opt('beats', 'After the previous, beats', m)}${opt('at', 'At a time in the song', m)}</select>${val}</div>
        <div class="row"><select data-f="type" aria-label="Transition">${opt('fade', 'Crossfade', c.transition.type)}${opt('cut', 'Cut', c.transition.type)}${opt('wipe', 'Wipe across', c.transition.type)}</select>
          ${c.transition.type === 'cut' ? '' : `<input type="text" inputmode="decimal" data-f="dur" aria-label="Transition seconds" value="${c.transition.dur}"><span class="note">s</span>`}</div>
        <div class="row"><button class="btn" data-act="save">Save current look</button><button class="btn" data-act="up" aria-label="Move up"${i ? '' : ' disabled'}>↑</button><button class="btn" data-act="down" aria-label="Move down"${i < cues.length - 1 ? '' : ' disabled'}>↓</button><button class="btn" data-act="del">Delete</button></div>
      </div>`;
    }).join('') || '<p class="note">No cues yet. Set up a look on the surfaces, then add it as a cue.</p>';
    const cur = cues[this.show.index];
    $('cueState').textContent = cur ? `On stage: ${cur.name} (${this.show.index + 1} of ${cues.length})` : cues.length ? 'No cue running yet: tap Go.' : '';
    $('cueGo').textContent = this.show.index < 0 ? 'Go: first cue' : 'Go: next cue';
    $('cueGo').disabled = !cues.length || this.show.index >= cues.length - 1;
    $('cueFirst').disabled = !cues.length;
    $('timelineGroup').hidden = !cues.some((c) => c.start.mode === 'at');
    this.timelineKey = '';
  },

  // the soundtrack as a strip, with a marker per timed cue and the playhead
  drawTimeline() {
    const tl = $('timeline');
    if ($('drawer').hidden || $('timelineGroup').hidden || tl.offsetParent === null) return;
    const st = this.soundtrackEl(), dur = st && st.duration && isFinite(st.duration) ? st.duration : 0;
    const key = dur + '|' + this.show.cues.map((c) => c.start.mode + c.start.value).join() + '|' + this.show.index;
    if (key !== this.timelineKey) {
      this.timelineKey = key;
      tl.innerHTML = dur ? '<i class="playhead"></i>' + this.show.cues.map((c, i) => c.start.mode === 'at' ? `<b class="${i === this.show.index ? 'live' : ''}" style="left:${Math.min(100, c.start.value / dur * 100)}%"><span>${i + 1}</span></b>` : '').join('') : '<span class="note">Pick a soundtrack in Sound to place cues in time.</span>';
    }
    const ph = tl.querySelector('.playhead');
    if (ph) ph.style.left = dur ? (st.currentTime / dur * 100) + '%' : '0';
  },
};
