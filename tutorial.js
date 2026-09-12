// First-run tutorial. Runs once, then never again unless asked for from the profile.
//
// War Prize's rules are the sort you can't guess from watching -- "matching numbers
// cancel" and "highest UNIQUE number wins" are unlike any card game people already
// know. So this doesn't explain them in a wall of text; it deals the cards that make
// each rule happen and lets you watch it play out, then makes you do it yourself.
//
// Every round here is scripted. Real matches are dealt and judged by the server, so
// a lesson can't use one -- it needs a 7 to lose to a 6 exactly when the point is
// being made.

const TUTORIAL = (() => {
  const $ = id => document.getElementById(id);
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // Opponents are written like real players' names, because that's who you'll meet.
  const CAST = [
    { name: 'YOU',        avatar: null },      // avatar filled in from the save
    { name: 'FROSTLYNX',  avatar: '🦊' },
    { name: 'ZENHAWK',    avatar: '🦁' },
    { name: 'NOVASPARK',  avatar: '👽' },
  ];

  let running = false;
  let skipped = false;
  let waitingFor = null;        // resolve function for a step that needs a tap
  let typing = null;

  /* ---------------- little helpers ---------------- */

  function seatEl(i) { return $('tutSeat' + i); }

  function buildSeat(i) {
    const seat = seatEl(i);
    seat.innerHTML = '';
    seat.classList.remove('out', 'ready');

    const slot = document.createElement('div');
    slot.className = 'seat-card-slot';
    const info = document.createElement('div');
    info.className = 'seat-info';
    const av = document.createElement('div');
    av.className = 'avatar';
    av.textContent = CAST[i].avatar;
    const meta = document.createElement('div');
    meta.className = 'seat-meta';
    const nm = document.createElement('div');
    nm.className = 'seat-name';
    nm.textContent = CAST[i].name;
    const sc = document.createElement('div');
    sc.className = 'seat-score';
    sc.textContent = '0';
    meta.appendChild(nm); meta.appendChild(sc);
    info.appendChild(av); info.appendChild(meta);

    seat.appendChild(slot);
    seat.appendChild(info);
    if (i === 0) seat.classList.add('you');
    return seat;
  }

  function card(value, faceUp) {
    const c = document.createElement('div');
    c.className = 'card' + (faceUp ? ' flipped' : '');
    const inner = document.createElement('div');
    inner.className = 'card-inner';
    const back = document.createElement('div');
    back.className = 'card-face card-back cb-classic';
    paintCardBack(back, 'classic');
    const front = document.createElement('div');
    front.className = 'card-face card-front';
    const num = document.createElement('span');
    num.className = 'card-num';
    num.textContent = value == null ? '' : String(value);
    front.appendChild(num);
    inner.appendChild(back); inner.appendChild(front);
    c.appendChild(inner);
    return c;
  }

  function setScore(i, n) { seatEl(i).querySelector('.seat-score').textContent = String(n); }

  // Text arrives a character at a time -- it paces the lesson, and tapping skips it.
  function say(text) {
    return new Promise(resolve => {
      const box = $('tutText');
      clearInterval(typing);
      box.textContent = '';
      let i = 0;
      const finish = () => { clearInterval(typing); typing = null; box.textContent = text; resolve(); };
      typing = setInterval(() => {
        box.textContent = text.slice(0, ++i);
        if (i % 3 === 0) SFX.hover();
        if (i >= text.length) finish();
      }, 16);
      box._skip = finish;
    });
  }

  // Dim the screen except for one element, so there's never a question about what
  // is being talked about.
  function spotlight(el) {
    document.querySelectorAll('.tut-lit').forEach(n => n.classList.remove('tut-lit'));
    $('tutorialScreen').classList.toggle('tut-dim', !!el);
    if (el) el.classList.add('tut-lit');
  }

  function coach(show) { $('tutCoach').classList.toggle('tut-hidden', !show); }

  function nextButton(label) {
    const b = $('tutNext');
    b.textContent = label || 'NEXT';
    b.classList.remove('hidden');
    return new Promise(resolve => { waitingFor = resolve; });
  }

  function resolveWait(v) {
    if (!waitingFor) return;
    const fn = waitingFor;
    waitingFor = null;
    fn(v);
  }

  function centerText(text, cls) {
    const ct = $('tutCenterText');
    ct.textContent = text;
    ct.className = cls || '';
    if (text) { void ct.offsetWidth; ct.className = (cls || '') + ' show'; }
  }

  function step(n, total) { $('tutStep').textContent = n + ' / ' + total; }

  /* ---------------- the round machinery ---------------- */

  // Deals a scripted round: every seat's card is chosen in advance.
  async function playRound(cards, { potBefore = 1 } = {}) {
    // face-down cards slide in
    for (let i = 0; i < 4; i++) {
      const slot = seatEl(i).querySelector('.seat-card-slot');
      slot.innerHTML = '';
      slot.appendChild(card(null, false));
    }
    await wait(320);

    for (const n of ['3', '2', '1']) {
      centerText(n, 'beat');
      SFX.count(Number(n));
      await wait(360);
    }
    centerText('WAR!', 'war');
    SFX.war();
    const mid = FX.centreOf($('tutCenter'));
    FX.ring(mid.x, mid.y, { size: 300, color: '#ffffff', life: 440, thick: 8 });
    FX.burst(mid.x, mid.y, { n: 10, color: '#ff4d6d', dist: 130, size: 13 });
    await wait(420);
    centerText('');

    // reveal
    for (let i = 0; i < 4; i++) {
      const slot = seatEl(i).querySelector('.seat-card-slot');
      slot.innerHTML = '';
      const c = card(cards[i], false);
      slot.appendChild(c);
      requestAnimationFrame(() => c.classList.add('flipped', 'slam'));
      SFX.slam(i);
      setTimeout(() => {
        const cc = FX.centreOf(c);
        FX.dust(cc.x, cc.y + cc.h / 2, { n: 5 });
        c.classList.add('pop-num');
        SFX.cardLand(i);
      }, 170);
      await wait(150);
    }
    await wait(500);
  }

  // Marks every card that tied, exactly as a real round does.
  async function showCancels(cards) {
    const counts = {};
    cards.forEach(c => { counts[c] = (counts[c] || 0) + 1; });
    const doomed = cards.map((c, i) => (counts[c] > 1 ? i : -1)).filter(i => i >= 0);
    if (!doomed.length) return [];

    SFX.cancel();
    for (const i of doomed) {
      const c = seatEl(i).querySelector('.card');
      c.classList.add('cancelled');
      FX.stamp(c, '✕', 'bad');
    }
    await wait(900);
    return doomed;
  }

  // Highest number nobody else played.
  function winnerOf(cards) {
    const counts = {};
    cards.forEach(c => { counts[c] = (counts[c] || 0) + 1; });
    let best = -1, who = -1;
    cards.forEach((c, i) => { if (counts[c] === 1 && c > best) { best = c; who = i; } });
    return who;
  }

  async function celebrate(i, amount) {
    const c = seatEl(i).querySelector('.card');
    c.classList.add('winner');
    const wc = FX.centreOf(c);
    FX.ring(wc.x, wc.y, { size: 220, color: '#ffc93c', life: 520, thick: 8 });
    FX.burst(wc.x, wc.y, { n: 10, color: '#ffd75e', dist: 120 });
    FX.crown(seatEl(i).querySelector('.seat-info'));
    FX.floatText(wc.x, wc.y - 50, '+' + amount, 'gold');
    SFX.prize();
    await wait(1100);
  }

  /* ---------------- the lesson ---------------- */

  const TOTAL = 7;

  async function run() {
    // SAVE is a top-level `let`, which lives in the shared script scope and NOT on
    // window -- checking window.SAVE here silently skipped the whole tutorial.
    const me = typeof SAVE !== 'undefined' && SAVE;
    CAST[0].avatar = (me && me.avatar) || '🐉';
    CAST[0].name = (me && me.name) || 'YOU';
    $('tutFace').textContent = CAST[0].avatar;

    document.body.className = 'arena-1';
    paintScene($('tutBg'), 1);
    for (let i = 0; i < 4; i++) buildSeat(i);
    $('tutHandCards').innerHTML = '';
    $('tutHandLabel').textContent = '';
    $('tutPeek').classList.add('hidden');
    $('tutPrizeCount').classList.add('hidden');
    centerText('');
    spotlight(null);
    show('tutorialScreen');
    coach(true);

    /* --- 1. welcome --- */
    step(1, TOTAL);
    await say(`Hi ${CAST[0].name}. Four players, one Prize Card. Let me show you how to take it.`);
    await nextButton("LET'S GO");

    /* --- 2. the two cards --- */
    step(2, TOTAL);
    $('tutHandLabel').textContent = 'YOUR TWO CARDS';
    const hand = [[8, true], [null, false]];
    $('tutHandCards').innerHTML = '';
    hand.forEach(([v, up], i) => {
      const w = document.createElement('div');
      w.className = 'hand-card tut-deal';
      w.style.animationDelay = (i * 120) + 'ms';
      w.appendChild(card(v, up));
      const tag = document.createElement('div');
      tag.className = 'hand-tag' + (up ? ' known' : '');
      tag.textContent = up ? 'KNOWN' : 'GAMBLE';
      w.appendChild(tag);
      $('tutHandCards').appendChild(w);
    });
    SFX.whoosh();
    await wait(500);
    await say('Every round you get two. This one you can see — an 8.');
    spotlight($('tutHandCards').children[0]);
    await nextButton();
    await say("And this one is face down. Nobody knows what it is. Not even you.");
    spotlight($('tutHandCards').children[1]);
    await nextButton();
    spotlight(null);

    /* --- 3. pick one, for real --- */
    step(3, TOTAL);
    await say('You play one of them. Go on — tap the 8.');
    coach(false);
    const picked = await waitForPick(0);
    coach(true);
    SFX.select();

    /* --- 4. reveal, and the cancel rule --- */
    step(4, TOTAL);
    await say('Everyone reveals at the same time. Watch what happens to the two 5s.');
    await nextButton('REVEAL');
    coach(false);
    $('tutHandLabel').textContent = 'LOCKED IN';
    await playRound([8, 5, 5, 3]);
    coach(true);
    await say('FROSTLYNX and ZENHAWK both played a 5.');
    await nextButton();
    coach(false);
    await showCancels([8, 5, 5, 3]);
    coach(true);
    await say("Matching numbers cancel. Both 5s are out — they knocked each other over.");
    await nextButton();

    /* --- 5. highest unique wins --- */
    step(5, TOTAL);
    await say('Which leaves your 8 and a 3. Highest number left takes the Prize Card.');
    await nextButton('WHO WINS?');
    coach(false);
    await celebrate(0, 1);
    setScore(0, 1);
    coach(true);
    await say("That's yours. Highest number nobody else played — that's the whole game.");
    await nextButton();

    /* --- 6. why the big card isn't always right --- */
    step(6, TOTAL);
    await say("But here's the trap. A 10 looks unbeatable... until someone else plays a 10 too.");
    await nextButton('SHOW ME');
    coach(false);
    for (let i = 0; i < 4; i++) buildSeat(i);
    setScore(0, 1);
    await playRound([10, 10, 4, 4]);
    await showCancels([10, 10, 4, 4]);
    const pc = $('tutPrizeCount');
    pc.textContent = 'x2';
    pc.classList.remove('hidden', 'bump');
    void pc.offsetWidth;
    pc.classList.add('bump');
    const pr = FX.centreOf($('tutPrize'));
    FX.ring(pr.x, pr.y, { size: 190, color: '#ff4d6d', life: 460, thick: 7 });
    SFX.nobody();
    await wait(800);
    coach(true);
    await say('Everyone cancelled. Nobody wins — so the Prize Cards stack up for next round.');
    await nextButton();

    /* --- 7. peeks --- */
    step(7, TOTAL);
    $('tutPeek').classList.remove('hidden');
    spotlight($('tutPeek'));
    await say('Last thing. You get three peeks every round — look under your own face-down card, or at what someone else can see.');
    await nextButton();
    await say('Tap PEEK and see what you were sitting on.');
    coach(false);
    await waitForPeek();
    coach(true);
    spotlight(null);
    await say("That's it. Play the sure thing, or gamble. Highest unique number wins. Go win some.");
    await nextButton('PLAY');

    finish(true);
  }

  // Waits for a real tap on one of the hand cards.
  function waitForPick(index) {
    return new Promise(resolve => {
      const cards = $('tutHandCards').children;
      const target = cards[index];
      target.classList.add('tut-poke');
      const onClick = () => {
        target.classList.remove('tut-poke');
        target.classList.add('chosen');
        if (cards[1 - index]) cards[1 - index].classList.add('faded');
        for (const c of cards) c.onclick = null;
        resolve(index);
      };
      // only the card being taught is live, so there's no wrong move
      target.onclick = onClick;
    });
  }

  function waitForPeek() {
    return new Promise(resolve => {
      const btn = $('tutPeek');
      btn.classList.add('tut-poke');
      btn.onclick = async () => {
        btn.onclick = null;
        btn.classList.remove('tut-poke');
        $('tutPeekCount').textContent = '2';
        SFX.peek();
        const wrap = $('tutHandCards').children[1];
        const c = wrap.querySelector('.card');
        c.querySelector('.card-num').textContent = '2';
        c.classList.add('flipped');
        wrap.querySelector('.hand-tag').textContent = 'SEEN';
        wrap.querySelector('.hand-tag').classList.add('known');
        const cc = FX.centreOf(c);
        FX.ring(cc.x, cc.y, { size: 150, color: PEEK_COLOR, life: 460, thick: 6 });
        await wait(240);
        FX.floatText(cc.x, cc.y - 60, '2', 'cool');
        SFX.peekReveal(2);
        await wait(700);
        resolve();
      };
    });
  }

  function finish(completed) {
    running = false;
    spotlight(null);
    clearInterval(typing);
    document.querySelectorAll('.grab-hand, .prize-card.flying').forEach(n => n.remove());
    $('tutFx').innerHTML = '';
    if (typeof SAVE !== 'undefined' && SAVE) { SAVE.tutorialSeen = true; persist(); }
    if (completed) { SFX.unlockChime(); toast('Nice. Hit PLAY when you are ready.'); }
    show('menuScreen');
    renderMenu();
  }

  /* ---------------- wiring ---------------- */

  $('tutNext').onclick = () => {
    const box = $('tutText');
    if (typing && box._skip) { box._skip(); return; }     // first tap finishes the line
    SFX.click();
    $('tutNext').classList.add('hidden');
    resolveWait(true);
  };

  $('tutSkip').onclick = async () => {
    // window.confirm was being suppressed outright in some browsers, so this button
    // did nothing at all for those players.
    const sure = await askConfirm('Skip the tutorial?',
      'You can play it again any time from How to Play in your Profile.', 'Skip');
    if (!sure) return;
    skipped = true;
    SFX.back();
    finish(false);
  };

  return {
    isRunning() { return running; },

    start() {
      if (running) return;
      running = true;
      skipped = false;
      run().catch(e => { console.error('tutorial:', e); finish(false); });
    },

    // A match can arrive mid-lesson: reload during a match and the server hands it
    // straight back. Without this the tutorial carried on underneath, waiting on a
    // tap that could never come, and would then refuse to run again.
    abort() {
      if (!running) return;
      running = false;
      clearInterval(typing);
      typing = null;
      resolveWait(false);
      spotlight(null);
    },

    // Shown once, on the account's first visit -- and never over a live match.
    maybeStart() {
      if (typeof SAVE === 'undefined' || !SAVE || SAVE.tutorialSeen) return false;
      if (typeof M !== 'undefined' && M) return false;
      TUTORIAL.start();
      return true;
    },
  };
})();
