// Sound pane: soundtrack, playback controls, audio reactivity and its meter.
// Methods mixed into App (see app.js), so `this` is the app.
import { $ } from '../env.js';

export const soundUI = {
  initSoundUI() {
    $('addAudio').onchange = async (e) => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try { const m = await this.media.add(f); this.project.soundtrack = m.id; this.applyMute(); this.renderSoundUI(); this.scheduleSave(); } catch (err) { this.toast(err.message); }
    };
    $('soundtrack').onchange = (e) => {
      const was = this.playing; this.pause();
      this.project.soundtrack = e.target.value || null; this.applyMute(); this.scheduleSave();
      if (was) this.play();
    };
    $('loop').onchange = (e) => { this.project.settings.loop = e.target.checked; this.applyMute(); this.scheduleSave(); };
    $('sens').oninput = (e) => { this.audio.sensitivity = this.project.settings.sensitivity = parseFloat(e.target.value); this.scheduleSave(); };
    $('micToggle').onchange = async (e) => {
      try { await this.audio.useMic(e.target.checked); } catch (err) { e.target.checked = false; this.toast(err.message || 'The microphone is not available.'); }
    };
  },

  renderSoundUI() {
    const sel = $('soundtrack');
    sel.innerHTML = '<option value="">No soundtrack</option>' + this.media.list().filter((m) => m.kind !== 'image')
      .map((m) => `<option value="${m.id}">${m.kind === 'video' ? 'Sound of video: ' : ''}${m.name.replace(/[<&"]/g, '')}</option>`).join('');
    sel.value = this.project.soundtrack && this.media.get(this.project.soundtrack) ? this.project.soundtrack : '';
  },

  renderTransport() {
    for (const id of ['playBtn', 'playBtn2']) {
      const b = $(id), label = this.playing ? 'Pause' : 'Play';
      if (id === 'playBtn') {
        b.querySelector('span').textContent = label;
        b.querySelector('svg').innerHTML = this.playing ? '<path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/>' : '<path d="M4 2.5v11l9-5.5z"/>';
      } else b.textContent = label;
    }
  },

  drawMeter(a) {
    if ($('drawer').hidden) return;
    $('mBass').style.height = Math.round(a.bass * 100) + '%';
    $('mMid').style.height = Math.round(a.mid * 100) + '%';
    $('mTreble').style.height = Math.round(a.treble * 100) + '%';
    $('mBeat').style.background = a.beat > 0.3 ? 'var(--lamp)' : 'var(--raise)';
  },
};
