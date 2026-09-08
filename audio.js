// Everything is synthesized at runtime -- keeps the game a drop-in folder with no assets.
//
// Three things do most of the work in making these sound like a game rather than a
// test tone: every sound is layered (a body plus a transient), pitches wobble a few
// cents on each play so repeats don't sound machine-stamped, and everything runs
// through a shared compressor so a slam and a chord can't stack into clipping.

const SFX = (() => {
  let ctx = null;
  let master = null;      // everything lands here
  let bus = null;         // pre-compressor mix
  let muted = false;
  let musicGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let musicRate = 1;

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();

      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);

      // Keeps a big moment (slam + chord + noise at once) from tearing.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 22;
      comp.ratio.value = 8;
      comp.attack.value = 0.004;
      comp.release.value = 0.18;
      comp.connect(master);

      bus = ctx.createGain();
      bus.gain.value = 1;
      bus.connect(comp);

      musicGain = ctx.createGain();
      musicGain.gain.value = 0.13;
      musicGain.connect(bus);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  const now = () => ctx.currentTime;
  const rnd = (a, b) => a + Math.random() * (b - a);
  // A few cents either way. Small enough to read as the same sound, big enough that
  // four card slams in a row don't sound like one sample repeated.
  const detune = (f, cents = 25) => f * Math.pow(2, rnd(-cents, cents) / 1200);

  function tone({
    freq = 440, type = 'sine', dur = 0.15, vol = 0.3, attack = 0.005,
    slideTo = null, slideCurve = 'exp', delay = 0, dest = null, wobble = 25, hold = 0,
  }) {
    if (muted) return;
    ensure();
    const t0 = now() + delay;
    const f = detune(freq, wobble);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t0);
    if (slideTo) {
      const target = Math.max(1, detune(slideTo, wobble));
      if (slideCurve === 'lin') osc.frequency.linearRampToValueAtTime(target, t0 + dur);
      else osc.frequency.exponentialRampToValueAtTime(target, t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    if (hold) g.gain.setValueAtTime(vol, t0 + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest || bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({
    dur = 0.2, vol = 0.3, delay = 0, filterFreq = 1200, type = 'lowpass',
    q = 1, sweepTo = null, curve = 1,
  }) {
    if (muted) return;
    ensure();
    const t0 = now() + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      // curve > 1 front-loads the energy, which is what makes a hit sound like a hit
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, curve);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.Q.value = q;
    filt.frequency.setValueAtTime(filterFreq, t0);
    if (sweepTo) filt.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt); filt.connect(g); g.connect(bus);
    src.start(t0);
  }

  // A short pitched thump. Every impact in the game is built on one of these.
  function thump({ freq = 150, drop = 45, dur = 0.18, vol = 0.4, delay = 0 }) {
    tone({ freq, type: 'sine', dur, vol, slideTo: drop, delay, attack: 0.002, wobble: 40 });
    tone({ freq: freq * 2, type: 'triangle', dur: dur * 0.5, vol: vol * 0.35, slideTo: drop * 2, delay, wobble: 40 });
  }

  // Plays a list of [semitoneOffset, timeOffset] against a root.
  function chord(root, offsets, { type = 'triangle', dur = 0.4, vol = 0.22, spread = 0, dest = null } = {}) {
    offsets.forEach(([semi, at], i) => {
      tone({
        freq: root * Math.pow(2, semi / 12), type, dur, vol,
        delay: at + (spread ? i * spread : 0), dest, wobble: 8,
      });
    });
  }

  const api = {
    unlock() { ensure(); },
    setMuted(v) { muted = v; if (muted) api.stopMusic(); },
    isMuted() { return muted; },

    /* ---------------- interface ---------------- */

    click() {
      tone({ freq: 760, type: 'square', dur: 0.045, vol: 0.1 });
      noise({ dur: 0.03, vol: 0.06, filterFreq: 5000, type: 'highpass' });
    },
    hover() { tone({ freq: 340, type: 'sine', dur: 0.045, vol: 0.06 }); },
    select() {
      tone({ freq: 540, type: 'triangle', dur: 0.09, vol: 0.22, slideTo: 700 });
      noise({ dur: 0.04, vol: 0.07, filterFreq: 4200, type: 'highpass' });
    },
    back() { tone({ freq: 380, type: 'square', dur: 0.07, vol: 0.11, slideTo: 260 }); },
    panelOpen() {
      tone({ freq: 300, type: 'triangle', dur: 0.16, vol: 0.14, slideTo: 620 });
      noise({ dur: 0.14, vol: 0.07, filterFreq: 900, sweepTo: 3600, type: 'bandpass', q: 2 });
    },
    panelClose() {
      tone({ freq: 560, type: 'triangle', dur: 0.14, vol: 0.12, slideTo: 260 });
    },
    whoosh() {
      noise({ dur: 0.22, vol: 0.15, filterFreq: 400, sweepTo: 2600, type: 'bandpass', q: 1.6 });
    },
    error() {
      tone({ freq: 210, type: 'square', dur: 0.14, vol: 0.18, slideTo: 130 });
      tone({ freq: 160, type: 'sawtooth', dur: 0.18, vol: 0.12, slideTo: 96, delay: 0.06 });
    },

    /* ---------------- the round ---------------- */

    // 3 - 2 - 1, rising and getting more urgent.
    count(n) {
      const f = [0, 500, 590, 700][n] || 500;
      tone({ freq: f, type: 'square', dur: 0.1, vol: 0.2 });
      tone({ freq: f / 2, type: 'triangle', dur: 0.14, vol: 0.14 });
      noise({ dur: 0.05, vol: 0.09, filterFreq: 3000, type: 'highpass' });
    },

    // The moment the cards go down. Low hit, metal ring, air.
    war() {
      thump({ freq: 210, drop: 58, dur: 0.34, vol: 0.42 });
      tone({ freq: 320, type: 'sawtooth', dur: 0.3, vol: 0.2, slideTo: 110 });
      noise({ dur: 0.34, vol: 0.3, filterFreq: 3400, sweepTo: 500, curve: 2.2 });
      noise({ dur: 0.5, vol: 0.1, filterFreq: 6000, type: 'highpass', delay: 0.03 });
    },

    flip(i = 0) {
      noise({ dur: 0.06, vol: 0.14, filterFreq: 4600, type: 'highpass', delay: i * 0.045, curve: 2 });
    },

    // Card leaving the hand.
    slam(i = 0) {
      const d = i * 0.05;
      noise({ dur: 0.09, vol: 0.22, filterFreq: 2400, type: 'bandpass', q: 1.2, delay: d, curve: 2.5 });
    },

    // Card hitting the table -- the weight of the round.
    cardLand(i = 0) {
      const d = i * 0.02;
      thump({ freq: rnd(120, 165), drop: 48, dur: 0.15, vol: 0.34, delay: d });
      noise({ dur: 0.07, vol: 0.18, filterFreq: 1400, delay: d, curve: 3 });
    },

    // Two players hit the same number.
    cancel() {
      tone({ freq: 240, type: 'sawtooth', dur: 0.26, vol: 0.2, slideTo: 150 });
      tone({ freq: 254, type: 'sawtooth', dur: 0.26, vol: 0.2, slideTo: 158 });   // deliberate beating
      noise({ dur: 0.2, vol: 0.14, filterFreq: 1800, type: 'bandpass', q: 3 });
    },

    prize() {
      chord(660, [[0, 0], [4, 0.06], [7, 0.12], [12, 0.18]], { dur: 0.22, vol: 0.2 });
      noise({ dur: 0.3, vol: 0.07, filterFreq: 7000, type: 'highpass', delay: 0.1 });
    },
    score() {
      tone({ freq: 940, type: 'sine', dur: 0.11, vol: 0.18, slideTo: 1420 });
      tone({ freq: 1410, type: 'triangle', dur: 0.09, vol: 0.1, delay: 0.06 });
    },

    // Pot climbing round after round -- pitch rises with the stack.
    potGrow(n) {
      const base = 400 + Math.min(n, 8) * 88;
      tone({ freq: base, type: 'triangle', dur: 0.16, vol: 0.22 });
      tone({ freq: base * 1.5, type: 'sine', dur: 0.2, vol: 0.14, delay: 0.07 });
      noise({ dur: 0.12, vol: 0.05, filterFreq: 5200, type: 'highpass', delay: 0.05 });
    },

    // Taking a stacked pot. Longer and brighter the bigger it is.
    bigWin(n) {
      const steps = Math.min(n, 6);
      for (let i = 0; i < steps; i++) {
        tone({ freq: 520 * Math.pow(2, i * 2 / 12), type: 'triangle', dur: 0.22, vol: 0.22, delay: i * 0.065 });
        tone({ freq: 260 * Math.pow(2, i * 2 / 12), type: 'sine', dur: 0.26, vol: 0.14, delay: i * 0.065 });
      }
      thump({ freq: 180, drop: 60, dur: 0.3, vol: 0.3 });
      noise({ dur: 0.5, vol: 0.12, filterFreq: 5200, type: 'highpass', delay: 0.05 });
    },

    nobody() {
      tone({ freq: 300, type: 'sine', dur: 0.4, vol: 0.18, slideTo: 120 });
      tone({ freq: 226, type: 'triangle', dur: 0.44, vol: 0.12, slideTo: 96, delay: 0.05 });
    },

    // A 1 or a 2 taking the round off everybody.
    upset() {
      [0, 4, 7, 12, 16].forEach((s, i) =>
        tone({ freq: 523 * Math.pow(2, s / 12), type: 'square', dur: 0.17, vol: 0.2, delay: i * 0.065 }));
      noise({ dur: 0.4, vol: 0.1, filterFreq: 6000, type: 'highpass', delay: 0.1 });
    },

    /* ---------------- peeking ---------------- */

    // Deliberately hushed -- you're sneaking a look.
    peek() {
      noise({ dur: 0.26, vol: 0.1, filterFreq: 700, sweepTo: 2800, type: 'bandpass', q: 2.4 });
      tone({ freq: 420, type: 'sine', dur: 0.14, vol: 0.08, slideTo: 760 });
    },
    // Pitch tracks the card, so a high gamble card sounds like good news.
    peekReveal(card) {
      const f = 420 + (card || 1) * 62;
      tone({ freq: f, type: 'triangle', dur: 0.18, vol: 0.18 });
      tone({ freq: f * 1.5, type: 'sine', dur: 0.14, vol: 0.1, delay: 0.05 });
    },

    /* ---------------- clock ---------------- */

    tick(n) {
      const high = n <= 5;
      tone({ freq: high ? 1150 : 840, type: 'square', dur: 0.07, vol: high ? 0.26 : 0.16 });
      if (high) noise({ dur: 0.04, vol: 0.08, filterFreq: 5200, type: 'highpass' });
    },
    heartbeat() {
      thump({ freq: 74, drop: 42, dur: 0.17, vol: 0.42 });
      thump({ freq: 68, drop: 40, dur: 0.19, vol: 0.32, delay: 0.2 });
    },
    swell() {
      tone({ freq: 180, type: 'sawtooth', dur: 0.8, vol: 0.18, slideTo: 900 });
      noise({ dur: 0.8, vol: 0.12, filterFreq: 300, sweepTo: 4000, type: 'bandpass', q: 1.4 });
    },
    suddenDeath() {
      tone({ freq: 130, type: 'sawtooth', dur: 1.3, vol: 0.3, slideTo: 58 });
      tone({ freq: 132, type: 'sawtooth', dur: 1.3, vol: 0.2, slideTo: 60 });
      noise({ dur: 1.1, vol: 0.16, filterFreq: 600, sweepTo: 160 });
      // a roll under it
      for (let i = 0; i < 14; i++) {
        noise({ dur: 0.05, vol: 0.09, filterFreq: 2400, type: 'bandpass', q: 2, delay: i * 0.06 });
      }
    },

    /* ---------------- results ---------------- */

    victory() {
      chord(523, [[0, 0], [4, 0.12], [7, 0.24], [12, 0.36]], { dur: 0.5, vol: 0.26 });
      chord(262, [[0, 0], [4, 0.12], [7, 0.24], [12, 0.36]], { type: 'sine', dur: 0.55, vol: 0.18 });
      chord(1046, [[0, 0.5], [7, 0.5], [12, 0.5]], { type: 'triangle', dur: 0.8, vol: 0.16 });
      noise({ dur: 0.6, vol: 0.1, filterFreq: 6000, type: 'highpass', delay: 0.4 });
    },
    defeat() {
      [392, 330, 262, 196].forEach((f, i) => {
        tone({ freq: f, type: 'triangle', dur: 0.36, vol: 0.22, delay: i * 0.15 });
        tone({ freq: f / 2, type: 'sine', dur: 0.4, vol: 0.12, delay: i * 0.15 });
      });
    },
    rewardChip(i) {
      const f = [700, 880, 1050][i] || 800;
      tone({ freq: f, type: 'triangle', dur: 0.13, vol: 0.2 });
      tone({ freq: f * 2, type: 'sine', dur: 0.1, vol: 0.1, delay: 0.04 });
    },
    trophy() {
      [700, 950, 1250].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.2, vol: 0.2, delay: i * 0.09 }));
    },
    levelUp() {
      [0, 4, 7, 12, 16, 19].forEach((s, i) =>
        tone({ freq: 523 * Math.pow(2, s / 12), type: 'triangle', dur: 0.28, vol: 0.24, delay: i * 0.085 }));
      noise({ dur: 0.7, vol: 0.1, filterFreq: 6500, type: 'highpass', delay: 0.3 });
    },
    arenaUp() {
      chord(392, [[0, 0], [7, 0.1], [12, 0.2], [16, 0.3], [19, 0.4]], { dur: 0.7, vol: 0.24 });
      thump({ freq: 160, drop: 70, dur: 0.5, vol: 0.3, delay: 0.4 });
    },
    arenaDown() {
      [330, 294, 247, 196, 165].forEach((f, i) =>
        tone({ freq: f, type: 'sawtooth', dur: 0.3, vol: 0.16, delay: i * 0.12 }));
    },
    unlockChime() {
      [440, 660, 880, 1320].forEach((f, i) => tone({ freq: f, type: 'square', dur: 0.2, vol: 0.18, delay: i * 0.09 }));
    },
    streak(n) {
      for (let i = 0; i < Math.min(n, 5); i++) {
        tone({ freq: 500 * Math.pow(2, i * 3 / 12), type: 'square', dur: 0.12, vol: 0.18, delay: i * 0.07 });
      }
    },
    coin() {
      tone({ freq: rnd(1150, 1320), type: 'square', dur: 0.06, vol: 0.14, slideTo: 1800 });
      tone({ freq: rnd(1700, 1900), type: 'triangle', dur: 0.09, vol: 0.09, delay: 0.05 });
    },

    // Match found -- a short fanfare so you look up from whatever else you're doing.
    matchFound() {
      chord(440, [[0, 0], [7, 0.08], [12, 0.16]], { dur: 0.3, vol: 0.22 });
      noise({ dur: 0.25, vol: 0.09, filterFreq: 900, sweepTo: 4000, type: 'bandpass' });
    },

    /* ---------------- bed ---------------- */

    // Simple bass pulse under the match, with a hat on the offbeat.
    startMusic() {
      if (muted) return;
      ensure();
      api.stopMusic();
      musicStep = 0;
      musicRate = 1;
      const notes = [98, 98, 131, 98, 116, 98, 131, 147];
      const beat = () => {
        const f = notes[musicStep % notes.length];
        tone({ freq: f, type: 'triangle', dur: 0.2 / musicRate, vol: 0.5, dest: musicGain, wobble: 4 });
        tone({ freq: f / 2, type: 'sine', dur: 0.24 / musicRate, vol: 0.3, dest: musicGain, wobble: 4 });
        if (musicStep % 4 === 0) noise({ dur: 0.04, vol: 0.045, filterFreq: 7000, type: 'highpass' });
        if (musicStep % 2 === 1) noise({ dur: 0.025, vol: 0.025, filterFreq: 9000, type: 'highpass' });
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
