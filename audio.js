// Everything is synthesized at runtime -- keeps the game a drop-in folder with no assets.

const SFX = (() => {
  let ctx = null;
  let master = null;
  let muted = false;
  let musicGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let musicRate = 1;

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone({ freq = 440, type = 'sine', dur = 0.15, vol = 0.3, attack = 0.005, slideTo = null, delay = 0, dest = null }) {
    if (muted) return;
    ensure();
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest || master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({ dur = 0.2, vol = 0.3, delay = 0, filterFreq = 1200, type = 'lowpass' }) {
    if (muted) return;
    ensure();
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(t0);
  }

  const api = {
    unlock() { ensure(); },
    setMuted(v) { muted = v; if (muted) api.stopMusic(); },
    isMuted() { return muted; },

    select()   { tone({ freq: 520, type: 'triangle', dur: 0.08, vol: 0.25 }); },
    hover()    { tone({ freq: 320, type: 'sine', dur: 0.05, vol: 0.08 }); },
    click()    { tone({ freq: 700, type: 'square', dur: 0.05, vol: 0.12 }); },
    whoosh()   { noise({ dur: 0.18, vol: 0.16, filterFreq: 1400, type: 'bandpass' }); },

    // pot climbing round after round -- pitch rises with the stack
    potGrow(n) {
      const base = 420 + Math.min(n, 8) * 90;
      tone({ freq: base, type: 'triangle', dur: 0.16, vol: 0.24 });
      tone({ freq: base * 1.5, type: 'sine', dur: 0.2, vol: 0.16, delay: 0.07 });
    },
    bigWin(n) {
      for (let i = 0; i < Math.min(n, 6); i++) {
        tone({ freq: 520 + i * 160, type: 'triangle', dur: 0.2, vol: 0.24, delay: i * 0.07 });
      }
      noise({ dur: 0.4, vol: 0.14, filterFreq: 5000, type: 'highpass' });
    },
    heartbeat() {
      tone({ freq: 70, type: 'sine', dur: 0.16, vol: 0.4, slideTo: 42 });
      tone({ freq: 66, type: 'sine', dur: 0.18, vol: 0.32, slideTo: 40, delay: 0.2 });
    },
    swell() {
      tone({ freq: 200, type: 'sawtooth', dur: 0.7, vol: 0.18, slideTo: 900 });
      noise({ dur: 0.7, vol: 0.12, filterFreq: 3000, type: 'bandpass' });
    },

    count(n) {
      const f = [0, 440, 520, 620][n] || 440;
      tone({ freq: f, type: 'square', dur: 0.12, vol: 0.22 });
    },
    war() {
      tone({ freq: 180, type: 'sawtooth', dur: 0.35, vol: 0.32, slideTo: 90 });
      noise({ dur: 0.3, vol: 0.3, filterFreq: 2600 });
    },
    flip(i = 0) {
      noise({ dur: 0.07, vol: 0.16, filterFreq: 4200, type: 'highpass', delay: i * 0.045 });
    },
    slam(i = 0) {
      const d = i * 0.05;
      noise({ dur: 0.16, vol: 0.42, filterFreq: 900, delay: d });
      tone({ freq: 150, type: 'sine', dur: 0.16, vol: 0.4, slideTo: 55, delay: d });
    },
    cancel() {
      tone({ freq: 220, type: 'sawtooth', dur: 0.22, vol: 0.2, slideTo: 150 });
      tone({ freq: 233, type: 'sawtooth', dur: 0.22, vol: 0.2, slideTo: 160 });
    },
    prize() {
      [660, 880, 1180].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.16, vol: 0.26, delay: i * 0.06 }));
    },
    score() { tone({ freq: 980, type: 'sine', dur: 0.1, vol: 0.2, slideTo: 1400 }); },
    upset() {
      [523, 659, 784, 1046, 1318].forEach((f, i) =>
        tone({ freq: f, type: 'square', dur: 0.18, vol: 0.22, delay: i * 0.07 }));
    },
    nobody() { tone({ freq: 300, type: 'sine', dur: 0.4, vol: 0.2, slideTo: 120 }); },
    finalMinute() {
      [880, 880, 1100].forEach((f, i) => tone({ freq: f, type: 'square', dur: 0.18, vol: 0.25, delay: i * 0.16 }));
    },
    tick(n) {
      tone({ freq: n <= 3 ? 1100 : 820, type: 'square', dur: 0.09, vol: 0.28 });
    },
    suddenDeath() {
      tone({ freq: 120, type: 'sawtooth', dur: 1.2, vol: 0.3, slideTo: 60 });
      noise({ dur: 1.0, vol: 0.18, filterFreq: 500 });
    },
    victory() {
      [523, 659, 784, 1046].forEach((f, i) =>
        tone({ freq: f, type: 'triangle', dur: 0.45, vol: 0.3, delay: i * 0.13 }));
      [261, 329, 392, 523].forEach((f, i) =>
        tone({ freq: f, type: 'sine', dur: 0.5, vol: 0.2, delay: i * 0.13 }));
    },
    defeat() {
      [392, 330, 262, 196].forEach((f, i) =>
        tone({ freq: f, type: 'triangle', dur: 0.35, vol: 0.24, delay: i * 0.15 }));
    },
    trophy()   { [700, 950, 1250].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.2, vol: 0.22, delay: i * 0.09 })); },
    levelUp()  { [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.3, vol: 0.26, delay: i * 0.1 })); },
    unlockChime() { [440, 660, 880, 1320].forEach((f, i) => tone({ freq: f, type: 'square', dur: 0.22, vol: 0.2, delay: i * 0.1 })); },
    streak(n)  { for (let i = 0; i < Math.min(n, 5); i++) tone({ freq: 500 + i * 140, type: 'square', dur: 0.12, vol: 0.2, delay: i * 0.07 }); },
    coin()     { tone({ freq: 1200, type: 'square', dur: 0.08, vol: 0.18, slideTo: 1700 }); },
    error()    { tone({ freq: 200, type: 'square', dur: 0.16, vol: 0.2, slideTo: 120 }); },

    // Simple bass pulse under the match; speeds up for the final minute.
    startMusic() {
      if (muted) return;
      ensure();
      api.stopMusic();
      musicStep = 0;
      musicRate = 1;
      const notes = [98, 98, 131, 98, 116, 98, 131, 147];
      const beat = () => {
        const f = notes[musicStep % notes.length];
        tone({ freq: f, type: 'triangle', dur: 0.18 / musicRate, vol: 0.5, dest: musicGain });
        if (musicStep % 4 === 0) noise({ dur: 0.05, vol: 0.05, filterFreq: 6000, type: 'highpass' });
        musicStep++;
        musicTimer = setTimeout(beat, 340 / musicRate);
      };
      beat();
    },
    setMusicRate(r) { musicRate = r; },
    stopMusic() { if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; } },
  };

  return api;
})();
