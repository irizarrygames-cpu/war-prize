// War Prize -- match loop, UI, and menus.

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

const SELECT_MS = 3600;
const BEAT_MS = 420;
const REVEAL_MS = 620;
const RESOLVE_MS = 1300;

let M = null;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/* ---------------- screens ---------------- */

function show(screenId) {
  ['authScreen', 'menuScreen', 'mmScreen', 'matchScreen', 'resultScreen'].forEach(id => {
    $(id).classList.toggle('hidden', id !== screenId);
  });
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 1900);
}

/* ---------------- menu ---------------- */

function renderMenu() {
  if (!SAVE) return;
  buildMenuBackdrop();
  renderModePicker();
  refreshChallenges();
  $('menuLevel').textContent = SAVE.level;
  $('menuLevelFill').style.width = Math.min(100, (SAVE.xp / xpForLevel(SAVE.level)) * 100) + '%';
  $('menuTrophies').textContent = SAVE.trophies.toLocaleString();
  $('menuCoins').textContent = SAVE.coins.toLocaleString();
  $('menuName').textContent = SAVE.name;
  $('menuAvatar').textContent = SAVE.avatar;
  const title = TITLES.find(t => t.id === SAVE.equipped.title);
  $('menuTitle').textContent = title ? title.name : '';
  const ar = arenaFor(SAVE.trophies);
  $('menuArenaName').textContent = `Arena ${ar.n} · ${ar.name}`;
  $('menuArenaIcon').textContent = ar.icon;
  $('menuDifficulty').textContent = difficultyFor(ar.n);
  $('menuDifficulty').className = 'diff-badge d-' + difficultyFor(ar.n).toLowerCase();

  const next = ARENAS.find(a => a.trophies > SAVE.trophies);
  if (next) {
    const span = next.trophies - ar.trophies;
    $('menuArenaFill').style.width = Math.min(100, ((SAVE.trophies - ar.trophies) / span) * 100) + '%';
    $('menuArenaNext').textContent =
      `${(next.trophies - SAVE.trophies).toLocaleString()} 🏆 to ${next.name}`;
  } else {
    $('menuArenaFill').style.width = '100%';
    $('menuArenaNext').textContent = 'Top arena reached';
  }

  const streakEl = $('menuStreak');
  if (SAVE.streak >= 2) {
    streakEl.textContent = `${SAVE.streak} WIN STREAK${SAVE.streak >= 3 ? ' 🔥' : ''}`;
    streakEl.classList.remove('hidden');
  } else {
    streakEl.classList.add('hidden');
  }

  $('challengeDot').classList.toggle('hidden', !hasClaimableChallenge());
  document.body.className = 'arena-' + ar.n;
}

function renderModePicker() {
  const wrap = $('modePicker');
  wrap.innerHTML = '';
  for (const key of MODE_ORDER) {
    const m = MODES[key];
    const btn = el('button', 'mode-btn' + (SAVE.mode === key ? ' active' : ''));
    btn.appendChild(el('strong', null, m.label));
    btn.appendChild(el('small', null, m.sub));
    btn.onclick = () => {
      SAVE.mode = key;
      persist();
      SFX.click();
      renderModePicker();
    };
    wrap.appendChild(btn);
  }
}

function buildMenuBackdrop() {
  const bg = $('menuBg');
  if (bg.children.length) return;          // decorative only, build once
  for (let i = 0; i < 9; i++) {
    const c = el('div', 'drift-card', String(randInt(CARD_MIN, CARD_MAX)));
    c.style.left = randInt(-2, 94) + '%';
    c.style.animationDuration = randInt(26, 52) + 's';
    c.style.animationDelay = '-' + randInt(0, 40) + 's';
    c.style.setProperty('--r0', randInt(-40, 40) + 'deg');
    c.style.setProperty('--r1', randInt(-40, 40) + 'deg');
    bg.appendChild(c);
  }
}

/* ---------------- panels ---------------- */

let currentPanel = null;

// Takes a builder rather than a node so buying or equipping can rebuild the whole
// panel -- rebuilding just one grid would drop the panel's other sections.
function openPanel(title, build) {
  currentPanel = { title, build };
  $('panelTitle').textContent = title;
  const body = $('panelBody');
  const scroll = body.scrollTop;
  body.innerHTML = '';
  body.appendChild(build());
  body.scrollTop = scroll;
  $('panelWrap').classList.remove('hidden');
}

function refreshPanel() {
  if (currentPanel) openPanel(currentPanel.title, currentPanel.build);
}

function closePanel() {
  currentPanel = null;
  $('panelWrap').classList.add('hidden');
  renderMenu();
}

function cosmeticGrid(kind, slot, list, renderPreview, hideName) {
  const wrap = el('div', 'grid');
  for (const item of list) {
    const owned = isUnlocked(kind, item.id);
    const equipped = SAVE.equipped[slot] === item.id;
    const cell = el('div', 'grid-cell' + (equipped ? ' equipped' : '') + (owned ? '' : ' locked'));
    cell.appendChild(renderPreview(item));
    if (!hideName) cell.appendChild(el('div', 'cell-name', item.name));
    cell.appendChild(el('div', 'cell-cost', owned ? (equipped ? 'EQUIPPED' : 'Tap to equip') : `${item.cost} 🪙`));
    cell.onclick = () => {
      if (owned) {
        equip(slot, item.id);
        SFX.click();
      } else {
        const res = buy(kind, item.id, item.cost);
        if (res === 'poor') { SFX.error(); toast('Not enough coins'); return; }
        SFX.unlockChime();
        equip(slot, item.id);
        toast(`${item.name} unlocked!`);
      }
      refreshPanel();
      renderMenu();
    };
    wrap.appendChild(cell);
  }
  return wrap;
}

function panelCards() {
  const wrap = el('div');
  wrap.appendChild(el('div', 'panel-sub', 'Card Backs'));
  wrap.appendChild(cosmeticGrid('cardBacks', 'cardBack', CARD_BACKS, item => {
    const c = el('div', 'preview-card');
    c.appendChild(el('div', 'card-face card-back cb-' + item.id));
    return c;
  }));
  wrap.appendChild(el('div', 'panel-sub', 'Table Skins'));
  wrap.appendChild(cosmeticGrid('tables', 'table', TABLES, item =>
    el('div', 'preview-table tbl-' + item.id)));
  return wrap;
}

function panelShop() {
  const wrap = el('div');
  wrap.appendChild(el('div', 'panel-sub', 'Titles'));
  wrap.appendChild(cosmeticGrid('titles', 'title', TITLES, item =>
    el('div', 'preview-title', item.name), true));
  wrap.appendChild(el('div', 'panel-sub', 'Victory Animations'));
  wrap.appendChild(cosmeticGrid('victories', 'victory', VICTORIES, item =>
    el('div', 'preview-victory', '🎉')));

  wrap.appendChild(el('div', 'panel-sub', 'Reactions'));
  const rg = el('div', 'grid');
  for (const r of REACTIONS) {
    const owned = isUnlocked('reactions', r.id);
    const cell = el('div', 'grid-cell' + (owned ? ' equipped' : ' locked'));
    cell.appendChild(el('div', 'preview-victory', r.emoji));
    cell.appendChild(el('div', 'cell-cost', owned ? 'OWNED' : `${r.cost} 🪙`));
    cell.onclick = () => {
      if (owned) return;
      const res = buy('reactions', r.id, r.cost);
      if (res === 'poor') { SFX.error(); toast('Not enough coins'); return; }
      SFX.unlockChime();
      toast('Reaction unlocked!');
      refreshPanel();
      renderMenu();
    };
    rg.appendChild(cell);
  }
  wrap.appendChild(rg);
  return wrap;
}

function panelProfile() {
  const ar = arenaFor(SAVE.trophies);
  const wrap = el('div', 'profile');
  const head = el('div', 'profile-head');
  const av = el('div', 'avatar big', SAVE.avatar);
  av.title = 'Click to change avatar';
  av.onclick = () => {
    const opts = ['🐉', '🦊', '🐼', '👽', '👑', '🐸', '💀', '🌟', '🐻', '🐰', '🤖', '🦁', '🐺', '🦈'];
    SAVE.avatar = opts[(opts.indexOf(SAVE.avatar) + 1) % opts.length];
    persist();
    av.textContent = SAVE.avatar;
    SFX.click();
  };
  head.appendChild(av);
  const nameBox = el('div');
  nameBox.appendChild(el('div', 'menu-name', SAVE.name));
  const title = TITLES.find(t => t.id === SAVE.equipped.title);
  nameBox.appendChild(el('div', 'profile-title', title ? title.name : ''));
  nameBox.appendChild(el('div', 'profile-user', 'signed in as ' + CURRENT_USER));
  head.appendChild(nameBox);
  wrap.appendChild(head);

  const stats = [
    ['Level', SAVE.level],
    ['Trophies', SAVE.trophies.toLocaleString() + ' 🏆'],
    ['Current Arena', `${ar.n} · ${ar.name}`],
    ['Highest Arena', `${arenaFor(SAVE.highestTrophies).n} · ${arenaFor(SAVE.highestTrophies).name}`],
    ['Total Wins', SAVE.wins],
    ['Matches Played', SAVE.matches],
    ['Current Streak', SAVE.streak],
    ['Best Streak', SAVE.bestStreak],
    ['Prize Cards Won', SAVE.prizeCards.toLocaleString()],
  ];
  const list = el('div', 'stat-list');
  for (const [k, v] of stats) {
    const row = el('div', 'stat-row');
    row.appendChild(el('span', 'stat-k', k));
    row.appendChild(el('span', 'stat-v', String(v)));
    list.appendChild(row);
  }
  wrap.appendChild(list);

  const mute = el('button', 'ghost-btn', SFX.isMuted() ? '🔇 Sound Off' : '🔊 Sound On');
  mute.onclick = () => {
    SFX.setMuted(!SFX.isMuted());
    SAVE.muted = SFX.isMuted();
    persist();
    mute.textContent = SFX.isMuted() ? '🔇 Sound Off' : '🔊 Sound On';
  };
  wrap.appendChild(mute);

  const out = el('button', 'logout-btn', 'LOG OUT');
  out.onclick = async () => {
    SFX.click();
    closePanel();          // repaints the menu, so close it while SAVE still exists
    disconnectEvents();
    await logOut();
    $('authUser').value = '';
    $('authPass').value = '';
    setAuthMode('login');
    show('authScreen');
  };
  wrap.appendChild(out);
  return wrap;
}

function panelArenas() {
  const wrap = el('div');
  const cur = arenaFor(SAVE.trophies);
  const next = ARENAS.find(a => a.trophies > SAVE.trophies);

  for (const a of ARENAS) {
    const unlocked = SAVE.trophies >= a.trophies;
    const isCurrent = a.n === cur.n;
    const isNext = next && a.n === next.n;
    const row = el('div', 'arena-row' + (unlocked ? '' : ' locked') +
      (isCurrent ? ' current' : '') + (isNext ? ' next' : ''));

    const thumb = el('div', 'arena-thumb arena-bg-' + a.n);
    thumb.appendChild(el('span', 'arena-emblem', unlocked ? a.icon : '🔒'));
    row.appendChild(thumb);

    const info = el('div', 'arena-info');
    const head = el('div', 'arena-head');
    head.appendChild(el('span', 'arena-name', `Arena ${a.n} · ${a.name}`));
    const diff = el('span', 'diff-badge d-' + difficultyFor(a.n).toLowerCase(), difficultyFor(a.n));
    head.appendChild(diff);
    info.appendChild(head);

    if (isCurrent && next) {
      const span = next.trophies - a.trophies;
      const track = el('div', 'ap-track');
      const fill = el('div', 'ap-fill');
      fill.style.width = Math.min(100, ((SAVE.trophies - a.trophies) / span) * 100) + '%';
      track.appendChild(fill);
      info.appendChild(track);
      info.appendChild(el('div', 'arena-req',
        `${(next.trophies - SAVE.trophies).toLocaleString()} 🏆 to ${next.name}`));
    } else {
      info.appendChild(el('div', 'arena-req', unlocked
        ? (isCurrent ? 'Top arena — you made it' : 'Unlocked')
        : `${a.trophies.toLocaleString()} 🏆 needed`));
    }

    row.appendChild(info);
    wrap.appendChild(row);
  }
  return wrap;
}

function panelChallenges() {
  refreshChallenges();
  const wrap = el('div');
  wrap.appendChild(el('div', 'panel-sub', 'Resets daily'));
  for (const entry of SAVE.challenges.list) {
    const def = challengeDef(entry.id);
    if (!def) continue;
    const done = entry.progress >= def.target;
    const row = el('div', 'chal-row' + (entry.claimed ? ' claimed' : ''));
    const info = el('div', 'chal-info');
    info.appendChild(el('div', 'chal-text', def.text));
    const bar = el('div', 'chal-bar');
    bar.appendChild(el('div', 'chal-fill')).style.width =
      Math.min(100, (entry.progress / def.target) * 100) + '%';
    info.appendChild(bar);
    info.appendChild(el('div', 'chal-prog', `${Math.min(entry.progress, def.target)} / ${def.target}`));
    row.appendChild(info);

    const btn = el('button', 'chal-btn');
    if (entry.claimed) { btn.textContent = 'Claimed'; btn.disabled = true; }
    else if (done) {
      btn.textContent = `${def.coins} 🪙`;
      btn.classList.add('ready');
      btn.onclick = () => {
        entry.claimed = true;
        SAVE.coins += def.coins;
        const lv = addXp(def.xp);
        persist();
        SFX.coin();
        if (lv) SFX.levelUp();
        refreshPanel();
        renderMenu();
      };
    } else { btn.textContent = `${def.coins} 🪙`; btn.disabled = true; }
    row.appendChild(btn);
    wrap.appendChild(row);
  }
  return wrap;
}

/* ---------------- matchmaking ---------------- */

let mmTimer = null;

/* ---------------- match ---------------- */

function later(fn, ms) {
  const t = setTimeout(() => {
    if (M && M.running) fn();
  }, ms);
  if (M) M.timers.push(t);
  return t;
}

function clearMatchTimers() {
  if (!M) return;
  M.timers.forEach(clearTimeout);
  M.timers = [];
  clearInterval(M.tickTimer);
}

function buildSeats() {
  const slots = modeOf(M.mode).seats;
  [0, 1, 2, 3].forEach(i => {
    const s = $('seat' + i);
    s.innerHTML = '';
    s.classList.toggle('hidden', !slots.includes(i));
  });

  M.players.forEach((p, i) => {
    const seat = $('seat' + slots[i]);
    seat.classList.toggle('you', p.id === 0);

    const slot = el('div', 'seat-card-slot');
    slot.appendChild(makeCard(p.cardBack));
    seat.appendChild(slot);

    const info = el('div', 'seat-info');
    info.appendChild(el('div', 'avatar', p.avatar));
    const meta = el('div', 'seat-meta');
    meta.appendChild(el('div', 'seat-name', p.name));
    meta.appendChild(el('div', 'seat-score', '0'));
    info.appendChild(meta);
    seat.appendChild(info);

    seat.appendChild(el('div', 'seat-reaction'));
    p.seat = seat;
  });
}

function makeCard(backId, value) {
  const card = el('div', 'card');
  const inner = el('div', 'card-inner');
  inner.appendChild(el('div', 'card-face card-back cb-' + backId));
  const front = el('div', 'card-face card-front');
  front.appendChild(el('span', 'card-num', value == null ? '' : String(value)));
  inner.appendChild(front);
  card.appendChild(inner);
  return card;
}

function buildReactionBar() {
  const bar = $('reactionBar');
  bar.innerHTML = '';
  for (const r of REACTIONS) {
    if (!isUnlocked('reactions', r.id)) continue;
    const b = el('button', 'react-btn', r.emoji);
    b.onclick = () => { showReaction(M.players[0], r.emoji); SFX.click(); };
    bar.appendChild(b);
  }
}

function showReaction(player, emoji) {
  const node = player.seat.querySelector('.seat-reaction');
  node.textContent = emoji;
  node.classList.remove('pop');
  void node.offsetWidth;
  node.classList.add('pop');
  clearTimeout(node._t);
  node._t = setTimeout(() => { node.textContent = ''; node.classList.remove('pop'); }, 1500);
}

function activePlayers() {
  return M.sudden ? M.players.filter(p => M.suddenIds.includes(p.id)) : M.players;
}

/* ---- round ---- */

function renderHand() {
  const human = M.players[0];
  const area = $('handArea');
  const inRound = activePlayers().includes(human);
  area.classList.toggle('spectating', !inRound);

  const holder = $('handCards');
  holder.innerHTML = '';

  if (!inRound) {
    $('handLabel').textContent = 'WATCHING SUDDEN DEATH';
    $('selectBar').style.width = '0%';
    return;
  }

  $('handLabel').textContent = 'PLAY IT SAFE, OR GAMBLE?';

  // The top card is face-up and the one under it is hidden -- that asymmetry is the
  // whole decision: a known number, or a blind roll that might beat it.
  [0, 1].forEach(idx => {
    const known = idx === 0;
    const wrap = el('div', 'hand-card');
    const card = makeCard(human.cardBack, known ? human.candidates[0] : null);
    if (known) card.classList.add('flipped');
    wrap.appendChild(card);
    wrap.appendChild(el('div', 'hand-tag' + (known ? ' known' : ''), known ? 'KNOWN' : 'GAMBLE'));
    wrap.onclick = () => {
      if (M.phase !== 'choose' || human.pick !== null) return;
      commitPick(human, idx);
    };
    holder.appendChild(wrap);
  });
}

function startSelectBar() {
  const bar = $('selectBar');
  bar.style.transition = 'none';
  bar.style.width = '100%';
  void bar.offsetWidth;
  bar.style.transition = `width ${SELECT_MS}ms linear`;
  bar.style.width = '0%';
}

// Only ever called for you. The server owns every other seat and reveals your card.
function commitPick(player, index) {
  if (player.pick !== null || player.id !== 0) return;
  player.pick = index;
  player.card = null;
  netPick(index);

  SFX.whoosh();
  SFX.select();
  const cards = $('handCards').children;
  if (cards[index]) cards[index].classList.add('chosen');
  if (cards[1 - index]) cards[1 - index].classList.add('faded');
  $('selectBar').style.transition = 'none';
  $('selectBar').style.width = '0%';
  player.seat.classList.add('ready');
}

// Everything visible about a resolved round. Shared by local matches (which decide the
// winner here) and online ones (where the server already decided).
function paintResolution(players, winner, gained, potAfter) {
  const counts = {};
  players.forEach(p => { counts[p.card] = (counts[p.card] || 0) + 1; });

  players.forEach(p => {
    if (counts[p.card] > 1) {
      p.cancelled = true;
      p.seat.querySelector('.card').classList.add('cancelled');
    }
  });
  if (players.some(p => p.cancelled)) {
    SFX.cancel();
    flash('red');
    shake(false);
  }

  if (winner) {
    winner.won = true;
    winner.seat.querySelector('.card').classList.add('winner');
    $('prizeCount').classList.add('hidden');

    const wc = winner.seat.querySelector('.card').getBoundingClientRect();
    sparkBurst(wc.left + wc.width / 2, wc.top + wc.height / 2, gained > 1 ? 18 : 10, '#ffc93c');
    if (gained > 1) { flash('gold'); shake(true); SFX.bigWin(gained); }

    grabPrize(winner, gained);
    later(() => {                                   // lands as the hand pulls it home
      winner.seat.querySelector('.seat-score').textContent = winner.score;
      updateScoreboard();
      popScore(winner.seat, '+' + gained);
      SFX.score();
    }, REACH_MS + CLOSE_MS + CARRY_MS);

    if (winner.card <= 3) {
      showEvent(`A ${winner.card} JUST WON?!`);
      SFX.upset();
    } else if (gained > 1) {
      showEvent(`${gained} PRIZE CARDS!`);
    } else {
    }
  } else {
    const pc = $('prizeCount');
    pc.textContent = 'x' + potAfter;
    pc.classList.remove('hidden', 'bump');
    void pc.offsetWidth;
    pc.classList.add('bump');
    const pr = $('prizePile').getBoundingClientRect();
    sparkBurst(pr.left + pr.width / 2, pr.top + pr.height / 2, 10, '#ff4d6d');
    showEvent('NOBODY WINS — PRIZE CARRIES OVER');
    SFX.nobody();
    SFX.potGrow(potAfter);
  }
}

function shake(big) {
  const s = $('matchScreen');
  s.classList.remove('shake-sm', 'shake-lg');
  void s.offsetWidth;
  s.classList.add(big ? 'shake-lg' : 'shake-sm');
}

function flash(tint) {
  const f = $('flash');
  f.className = tint || '';
  void f.offsetWidth;
  f.classList.add('hit');
}

function sparkBurst(x, y, count, color) {
  const layer = $('fxLayer');
  for (let i = 0; i < count; i++) {
    const s = el('div', 'spark');
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = randInt(60, 180);
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    s.style.background = color;
    s.style.setProperty('--sx', Math.cos(angle) * dist + 'px');
    s.style.setProperty('--sy', Math.sin(angle) * dist + 'px');
    s.style.animationDelay = (Math.random() * 0.1) + 's';
    layer.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }
}

function popScore(seat, text) {
  const r = seat.getBoundingClientRect();
  const p = el('div', 'pop-score', text);
  p.style.left = (r.left + r.width / 2 - 20) + 'px';
  p.style.top = (r.top - 6) + 'px';
  $('fxLayer').appendChild(p);
  setTimeout(() => p.remove(), 1100);
}

function showEvent(text) {
  const b = $('eventBanner');
  b.textContent = text;
  b.classList.remove('hidden', 'show');
  void b.offsetWidth;
  b.classList.add('show');
  clearTimeout(b._t);
  b._t = setTimeout(() => b.classList.add('hidden'), 1500);
}

// The hand and prize live on <body>, so a match ending mid-grab has to sweep them up.
function clearGrabs() {
  document.querySelectorAll('.grab-hand, .prize-card.flying').forEach(n => n.remove());
}

const REACH_MS = 260;
const CLOSE_MS = 90;
const CARRY_MS = 340;

// The winner's hand reaches in from their edge of the table, closes around the prize
// and drags it home. Appended to <body> because #fxLayer clips and the screen-shake
// transform would break position:fixed.
function grabPrize(winner, amount) {
  const seat = winner.seat.getBoundingClientRect();
  const pile = $('prizePile').getBoundingClientRect();
  const sx = seat.left + seat.width / 2;
  const sy = seat.top + seat.height / 2;
  const px = pile.left + pile.width / 2;
  const py = pile.top + pile.height / 2;

  const angle = Math.atan2(py - sy, px - sx);
  const deg = angle * 180 / Math.PI + 90;      // the emoji points up by default
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);

  const startX = sx - ux * 80, startY = sy - uy * 80;   // just off the player's edge
  const grabX = px - ux * 44, grabY = py - uy * 44;     // stop short so the palm meets the card
  const pose = (dx, dy, s) =>
    `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(${deg}deg) scale(${s})`;

  const hand = el('div', 'grab-hand', '✋');
  hand.style.left = startX + 'px';
  hand.style.top = startY + 'px';
  hand.style.transform = pose(0, 0, 0.6);
  hand.style.opacity = '0';
  document.body.appendChild(hand);

  const ghost = el('div', 'prize-card flying', `<span>+${amount}</span>`);
  ghost.style.left = (px - pile.width / 2) + 'px';
  ghost.style.top = (py - pile.height / 2) + 'px';
  ghost.style.opacity = '0';
  document.body.appendChild(ghost);

  SFX.whoosh();
  requestAnimationFrame(() => {
    hand.style.opacity = '1';
    hand.style.transform = pose(grabX - startX, grabY - startY, 1);
  });

  setTimeout(() => {                                   // close around the card
    hand.textContent = '✊';
    hand.style.transform = pose(grabX - startX, grabY - startY, 1.15);
    ghost.style.opacity = '1';
    SFX.prize();
  }, REACH_MS);

  setTimeout(() => {                                   // drag it back to their side
    hand.style.transform = pose(0, 0, 0.75);
    ghost.style.transform = `translate(${startX - px}px, ${startY - py}px) scale(0.45)`;
  }, REACH_MS + CLOSE_MS);

  setTimeout(() => {
    hand.style.opacity = '0';
    ghost.style.opacity = '0';
  }, REACH_MS + CLOSE_MS + CARRY_MS - 60);

  setTimeout(() => { hand.remove(); ghost.remove(); }, REACH_MS + CLOSE_MS + CARRY_MS + 120);
}

function updateScoreboard() {
  const sb = $('scoreboard');
  sb.innerHTML = '';
  [...M.players].sort((a, b) => b.score - a.score).forEach(p => {
    const row = el('div', 'sb-row' + (p.id === 0 ? ' you' : ''));   // only *you*, not every human
    row.appendChild(el('span', 'sb-av', p.avatar));
    row.appendChild(el('span', 'sb-name', p.name));
    row.appendChild(el('span', 'sb-score', String(p.score)));
    sb.appendChild(row);
  });
}

/* ---- clock ---- */

function tickClock() {
  if (!M || !M.running || M.sudden) return;
  const remain = Math.max(0, Math.ceil((M.endsAt - performance.now()) / 1000));
  const mm = Math.floor(remain / 60);
  const ss = String(remain % 60).padStart(2, '0');
  $('matchTimer').textContent = `${mm}:${ss}`;

  if (remain !== M.lastShown) {
    if (remain <= 10 && remain > 0) {
      $('matchTimer').classList.add('urgent');
      $('matchTimer').classList.remove('pulse');
      void $('matchTimer').offsetWidth;
      $('matchTimer').classList.add('pulse');
      $('dangerVignette').classList.add('on');
      SFX.tick(remain);
      if (remain <= 5) SFX.heartbeat();
    }
    M.lastShown = remain;
  }

  // Only stops the display -- the server decides when the match actually ends.
  if (remain <= 0) clearInterval(M.tickTimer);
}

/* ---- ending ---- */

// Leaving drops you to last place. We do NOT tear the match down here -- the server
// answers with match-end, which shows the standings and applies the trophy loss.
// Bailing out locally would let anyone dodge a defeat by quitting.
function quitMatch() {
  if (!M || M.leaving) return;
  M.leaving = true;
  api('match/leave');

  setTimeout(() => {                      // don't strand the player if the server never replies
    if (!M || !M.leaving) return;
    M = null;
    clearGrabs();
    SFX.stopMusic();
    $('matchScreen').classList.remove('sudden-mode');
    $('dangerVignette').classList.remove('on');
    $('fxLayer').innerHTML = '';
    show('menuScreen');
    renderMenu();
  }, 3000);
}

/* ---- victory effects ---- */

function playVictoryFx(kind) {
  const fx = $('victoryFx');
  fx.innerHTML = '';
  const colors = ['#ffd447', '#ff5d73', '#4fd1ff', '#8affc1', '#c78bff'];

  if (kind === 'confetti' || kind === 'fireworks') {
    const n = kind === 'fireworks' ? 90 : 70;
    for (let i = 0; i < n; i++) {
      const p = el('div', 'confetti');
      p.style.background = pick(colors);
      p.style.left = (kind === 'fireworks' ? randInt(20, 80) : randInt(0, 100)) + '%';
      p.style.animationDelay = (Math.random() * 0.8) + 's';
      p.style.setProperty('--dx', randInt(-160, 160) + 'px');
      fx.appendChild(p);
    }
  } else if (kind === 'cardrain') {
    for (let i = 0; i < 40; i++) {
      const c = el('div', 'fx-card', String(randInt(1, 10)));
      c.style.left = randInt(0, 96) + '%';
      c.style.animationDelay = (Math.random() * 1.2) + 's';
      fx.appendChild(c);
    }
  } else if (kind === 'crown') {
    fx.appendChild(el('div', 'fx-crown', '👑'));
  } else if (kind === 'spotlight') {
    fx.appendChild(el('div', 'fx-spotlight'));
  }
  setTimeout(() => { fx.innerHTML = ''; }, 4200);
}

/* ---------------- wiring ---------------- */

$('playBtn').onclick = () => { SFX.unlock(); SFX.click(); joinQueue(); };
$('playAgainBtn').onclick = () => { SFX.click(); joinQueue(); };
$('resultMenuBtn').onclick = () => { SFX.click(); show('menuScreen'); renderMenu(); };
$('mmCancel').onclick = () => { SFX.click(); leaveQueueUi(); };
$('quitBtn').onclick = quitMatch;
$('panelClose').onclick = () => { SFX.click(); closePanel(); };
$('panelWrap').onclick = e => { if (e.target === $('panelWrap')) closePanel(); };

$('navCards').onclick = () => { SFX.click(); openPanel('Cards', panelCards); };
$('navShop').onclick = () => { SFX.click(); openPanel('Shop', panelShop); };
$('navProfile').onclick = () => { SFX.click(); openPanel('Profile', panelProfile); };
$('navArenas').onclick = () => { SFX.click(); openPanel('Arenas', panelArenas); };
$('navChallenges').onclick = () => { SFX.click(); openPanel('Daily Challenges', panelChallenges); };
$('navFriends').onclick = () => { SFX.click(); api('friends').then(r => { if (r.ok) FRIENDS = r; refreshPanel(); }); openPanel('Friends', panelFriends); };

document.addEventListener('keydown', e => {
  if (!M || !M.running || M.phase !== 'choose') return;
  const human = M.players[0];
  if (!activePlayers().includes(human)) return;
  if (e.key === '1' || e.key === 'ArrowLeft') commitPick(human, 0);
  if (e.key === '2' || e.key === 'ArrowRight') commitPick(human, 1);
});

/* ---------------- auth screen ---------------- */

let authMode = 'login';

function setAuthMode(mode) {
  authMode = mode;
  $('tabLogin').classList.toggle('active', mode === 'login');
  $('tabSignup').classList.toggle('active', mode === 'signup');
  $('authPass2').classList.toggle('hidden', mode === 'login');
  $('authSubmit').textContent = mode === 'login' ? 'LOG IN' : 'CREATE ACCOUNT';
  authError('');
}

function authError(msg) {
  const box = $('authError');
  box.textContent = msg;
  box.classList.toggle('hidden', !msg);
  if (msg) SFX.error();
}

function enterGame() {
  SFX.setMuted(!!SAVE.muted);
  renderMenu();
  show('menuScreen');
}

$('tabLogin').onclick = () => { SFX.click(); setAuthMode('login'); };
$('tabSignup').onclick = () => { SFX.click(); setAuthMode('signup'); };

$('authForm').onsubmit = async e => {
  e.preventDefault();
  SFX.unlock();
  const user = $('authUser').value;
  const pass = $('authPass').value;
  const btn = $('authSubmit');
  btn.disabled = true;
  authError('');

  const res = authMode === 'login'
    ? await logIn(user, pass)
    : await signUp(user, pass, $('authPass2').value);

  btn.disabled = false;
  if (!res.ok) { authError(res.msg); return; }

  $('authPass').value = '';
  $('authPass2').value = '';
  SFX.unlockChime();
  enterGame();
  connectEvents();
  if (res.inherited) toast('Your old progress came with you');
};

// Boot lives in net.js, which loads last and owns the server connection.
