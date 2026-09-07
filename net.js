// Server connection: live presence, friends, invites and online 1v1 matches.
// Loads last so it can call into game.js. The server is authoritative for online
// matches -- this file only renders what it is told.

let FRIENDS = { friends: [], incoming: [], outgoing: [] };
let POLLING = 0;   // generation counter, so an old loop stops when a new one starts

// Long-polling instead of EventSource: CDNs and tunnels buffer event streams until
// enough bytes pile up, which stalls an idle stream forever. A held request/response
// looks ordinary to every proxy and delivers just as promptly.
function connectEvents() {
  if (!AUTH_TOKEN) return;
  const gen = ++POLLING;

  // Ask where we actually stand before listening for changes.
  api('sync').then(s => {
    if (gen !== POLLING || !s || !s.ok) return;
    if (s.friends) handleServerEvent({ type: 'friends', ...s.friends });
    if (s.match) handleServerEvent({ type: 'match-start', ...s.match });
  });

  (async () => {
    while (gen === POLLING && AUTH_TOKEN) {
      const res = await api('poll');
      if (gen !== POLLING) return;
      if (!res || !res.ok) {
        if (res && res.unauthorized) return;             // signed out elsewhere
        await new Promise(r => setTimeout(r, 1500));      // server hiccup, back off
        continue;
      }
      (res.events || []).forEach(ev => {
        try { handleServerEvent(ev); } catch (e) { /* one bad event mustn't kill the loop */ }
      });
    }
  })();
}

function disconnectEvents() { POLLING++; }

// Browsers throttle background tabs hard; check in the moment we're visible again.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && AUTH_TOKEN) api('ping');
});

function handleServerEvent(d) {
  switch (d.type) {
    case 'friends':
      FRIENDS = { friends: d.friends || [], incoming: d.incoming || [], outgoing: d.outgoing || [] };
      $('friendDot').classList.toggle('hidden', !FRIENDS.incoming.length);
      if (currentPanel && currentPanel.title === 'Friends') refreshPanel();
      break;
    case 'invite':        showInvite(d); break;
    case 'invite-cancelled': dismissInvite(d.inviteId); break;
    case 'invite-declined':  toast(`${d.by} declined`); SFX.error(); break;
    case 'queue':         renderQueue(d); break;
    case 'match-start':   startOnlineMatch(d); break;
    case 'round':         onlineRound(d); break;
    case 'picked':        onlineOpponentPicked(d); break;
    case 'peeked':        onlineOpponentPeeked(d); break;
    case 'countdown':     onlineCountdown(); break;
    case 'reveal':        onlineReveal(d); break;
    case 'sudden-death':  onlineSuddenDeath(d); break;
    case 'match-end':     onlineMatchEnd(d); break;
  }
}

/* ---------------- friends panel ---------------- */

function panelFriends() {
  const wrap = el('div');

  const addRow = el('div', 'friend-add');
  const input = el('input', 'auth-input');
  input.placeholder = 'Add by username';
  input.maxLength = 14;
  const addBtn = el('button', 'ghost-btn', 'ADD');
  const send = async () => {
    const name = input.value.trim();
    if (!name) return;
    const res = await api('friends/request', { username: name });
    if (!res.ok) { SFX.error(); toast(res.msg || 'Could not send'); return; }
    input.value = '';
    SFX.click();
    toast('Request sent');
  };
  addBtn.onclick = send;
  input.onkeydown = e => { if (e.key === 'Enter') send(); };
  addRow.appendChild(input);
  addRow.appendChild(addBtn);
  wrap.appendChild(addRow);

  if (FRIENDS.incoming.length) {
    wrap.appendChild(el('div', 'panel-sub', 'Friend requests'));
    for (const f of FRIENDS.incoming) {
      const row = el('div', 'friend-row');
      row.appendChild(el('div', 'friend-name', f.name));
      const yes = el('button', 'mini-btn good', '✓');
      const no = el('button', 'mini-btn bad', '✕');
      yes.onclick = async () => { await api('friends/respond', { username: f.id, accept: true }); SFX.unlockChime(); };
      no.onclick = async () => { await api('friends/respond', { username: f.id, accept: false }); SFX.click(); };
      row.appendChild(yes);
      row.appendChild(no);
      wrap.appendChild(row);
    }
  }

  wrap.appendChild(el('div', 'panel-sub', `Friends (${FRIENDS.friends.length})`));
  if (!FRIENDS.friends.length) {
    wrap.appendChild(el('div', 'friend-empty', 'No friends yet. Add someone by their username above.'));
  }
  for (const f of FRIENDS.friends) {
    const row = el('div', 'friend-row');
    row.appendChild(el('span', 'dot-status' + (f.online ? ' on' : '')));
    const nameBox = el('div', 'friend-name', f.name);
    nameBox.appendChild(el('div', 'friend-status',
      f.busy ? 'In a match' : f.online ? 'Online' : 'Offline'));
    row.appendChild(nameBox);

    const invite = el('button', 'mini-btn invite', '1v1');
    invite.disabled = !f.online || f.busy;
    invite.onclick = async () => {
      const res = await api('invite/send', { username: f.id });
      if (!res.ok) { SFX.error(); toast(res.msg || 'Could not invite'); return; }
      SFX.click();
      toast(`Invite sent to ${f.name}`);
    };
    row.appendChild(invite);

    const rm = el('button', 'mini-btn bad', '✕');
    rm.title = 'Remove friend';
    rm.onclick = async () => { await api('friends/remove', { username: f.id }); SFX.click(); };
    row.appendChild(rm);
    wrap.appendChild(row);
  }

  if (FRIENDS.outgoing.length) {
    wrap.appendChild(el('div', 'panel-sub', 'Sent requests'));
    for (const f of FRIENDS.outgoing) {
      const row = el('div', 'friend-row muted');
      row.appendChild(el('div', 'friend-name', f.name));
      row.appendChild(el('div', 'friend-status', 'Pending'));
      wrap.appendChild(row);
    }
  }
  return wrap;
}

/* ---------------- invites ---------------- */

function showInvite(d) {
  dismissInvite();
  const box = el('div', 'invite-pop');
  box.id = 'invite-' + d.inviteId;
  box.appendChild(el('div', 'invite-title', `${d.from} wants to play 1v1`));
  const row = el('div', 'invite-actions');
  const yes = el('button', 'play-btn invite-yes', 'ACCEPT');
  const no = el('button', 'ghost-btn', 'Decline');
  yes.onclick = async () => {
    const res = await api('invite/respond', { inviteId: d.inviteId, accept: true });
    dismissInvite(d.inviteId);
    if (!res.ok) { SFX.error(); toast(res.msg || 'Invite expired'); }
  };
  no.onclick = async () => {
    await api('invite/respond', { inviteId: d.inviteId, accept: false });
    dismissInvite(d.inviteId);
  };
  row.appendChild(yes);
  row.appendChild(no);
  box.appendChild(row);
  document.body.appendChild(box);
  SFX.unlockChime();
}

function dismissInvite(inviteId) {
  document.querySelectorAll('.invite-pop').forEach(n => {
    if (!inviteId || n.id === 'invite-' + inviteId) n.remove();
  });
}

/* ---------------- online match ---------------- */

/* ---------------- queue ---------------- */

let queueTimer = null;

function joinQueue() {
  SFX.unlock();
  show('mmScreen');
  const m = modeOf(SAVE.mode);
  $('mmTitle').textContent = 'FINDING PLAYERS';
  renderQueue({ waiting: 1, need: m.players, msLeft: 30000 });
  api('queue/join', { mode: SAVE.mode }).then(r => {
    if (!r.ok) { toast(r.msg || 'Could not join queue'); show('menuScreen'); }
  });
}

function leaveQueueUi() {
  clearInterval(queueTimer);
  queueTimer = null;
  api('queue/leave');
  show('menuScreen');
  renderMenu();
}

// Counts down to the match starting. Never says how the empty seats get filled.
function renderQueue(d) {
  const need = d.need || modeOf(SAVE.mode).players;
  const waiting = d.waiting || 1;
  const slots = $('mmSlots');
  slots.innerHTML = '';
  for (let i = 0; i < need; i++) {
    const cell = el('div', 'mm-slot' + (i < waiting ? ' filled' : ''));
    cell.appendChild(el('div', 'avatar', i === 0 ? SAVE.avatar : (i < waiting ? '🎮' : '?')));
    cell.appendChild(el('div', 'mm-name', i === 0 ? SAVE.name : (i < waiting ? 'Player' : 'Searching…')));
    slots.appendChild(cell);
  }

  clearInterval(queueTimer);
  let msLeft = d.msLeft != null ? d.msLeft : 30000;
  const tick = () => {
    const secs = Math.max(0, Math.ceil(msLeft / 1000));
    $('mmStatus').textContent = waiting >= need
      ? 'Match found!'
      : `${waiting} of ${need} players · starting in ${secs}s`;
    msLeft -= 250;
    if (msLeft < -2000) clearInterval(queueTimer);
  };
  tick();
  queueTimer = setInterval(tick, 250);
}

/* ---------------- online match ---------------- */

function startOnlineMatch(info) {
  closePanel();
  dismissInvite();
  clearInterval(queueTimer);
  queueTimer = null;

  // rotate the seat list so you always sit at the bottom
  const order = [];
  for (let k = 0; k < info.seats.length; k++) order.push((info.you + k) % info.seats.length);

  M = {
    online: true,
    serverIndex: info.you,
    seatOrder: order,
    mode: info.mode,
    friendly: !!info.friendly,
    players: order.map((serverIdx, i) => {
      const s = info.seats[serverIdx];
      return {
        id: i, serverIdx,
        name: i === 0 ? SAVE.name : s.name,
        avatar: i === 0 ? SAVE.avatar : s.avatar,
        cardBack: i === 0 ? SAVE.equipped.cardBack : pick(CARD_BACKS).id,
        candidates: [], score: 0, pick: null, card: null, cancelled: false, won: false,
      };
    }),
    prizePot: 1,
    round: 0,
    phase: null,
    running: true,
    sudden: false,
    suddenIds: [],
    suddenWinner: null,
    pendingEnd: false,
    endsAt: performance.now() + info.seconds * 1000,
    lastShown: info.seconds,
    timers: [],
    stats: { prizeCards: 0, wonLowCard: false, reachedSudden: false },
  };

  show('matchScreen');
  const ar = arenaFor(SAVE.trophies);
  $('arenaBg').className = 'arena-bg-' + ar.n;
  $('table').className = 'tbl-' + SAVE.equipped.table;
  $('suddenDeath').classList.add('hidden');
  $('matchTimer').classList.remove('urgent');
  $('prizeCount').classList.add('hidden');

  buildSeats();
  buildReactionBar();
  updateScoreboard();
  // A resync carries the scores so far; a fresh match starts everyone at zero.
  if (info.scores) {
    info.scores.forEach((s, si) => {
      const p = M.players[localIndex(si)];
      if (p) p.score = s;
    });
    M.players.forEach(p => { p.seat.querySelector('.seat-score').textContent = p.score; });
  }
  updateScoreboard();

  SFX.startMusic();
  M.tickTimer = setInterval(tickClock, 150);
  if (info.resync) toast('Reconnected');
  else if (info.friendly) toast('Friendly match — no trophies');
}

// server seat -> local seat (you are always at the bottom)
function localIndex(serverIdx) { return M.seatOrder.indexOf(serverIdx); }

function onlineRound(d) {
  if (!M || !M.online) return;
  M.round = d.round;
  M.phase = 'choose';
  M.prizePot = d.pot;
  M.peeks = d.peeks;
  M.peekedThisRound = false;
  M.endsAt = performance.now() + d.msLeft;

  const activeLocal = (d.active || []).map(localIndex);
  M.suddenIds = d.sudden ? activeLocal.map(i => M.players[i].id) : [];
  M.sudden = !!d.sudden;

  M.players.forEach((p, i) => {
    p.pick = null; p.card = null; p.cancelled = false; p.won = false;
    const slot = p.seat.querySelector('.seat-card-slot');
    slot.innerHTML = '';
    slot.appendChild(makeCard(p.cardBack));
    p.seat.classList.remove('ready');
    p.seat.classList.toggle('out', activeLocal.length > 0 && !activeLocal.includes(i));
  });

  // only your own visible card is ever sent; the blind one stays unknown client-side
  M.players[0].candidates = [d.known, null];
  $('centerText').textContent = '';
  renderHand();
  if (!d.spectating) startSelectBar();
}

function onlineOpponentPicked(d) {
  if (!M || !M.online) return;
  const p = M.players[localIndex(d.seat)];
  if (p) p.seat.classList.add('ready');
}

// Everyone sees who spent a peek -- knowing an opponent has looked is information.
function onlineOpponentPeeked(d) {
  if (!M || !M.online) return;
  const p = M.players[localIndex(d.seat)];
  if (p) showReaction(p, '👀');
}

function onlineSuddenDeath(d) {
  if (!M || !M.online) return;
  clearInterval(M.tickTimer);
  $('matchTimer').textContent = '0:00';
  $('matchTimer').classList.remove('urgent');
  $('dangerVignette').classList.remove('on');
  $('matchScreen').classList.add('sudden-mode');
  const sd = $('suddenDeath');
  sd.classList.remove('hidden');
  SFX.suddenDeath();
  SFX.swell();
  shake(true);
  flash('red');
  setTimeout(() => sd.classList.add('hidden'), 2200);
}

function onlineCountdown() {
  if (!M || !M.online) return;
  M.phase = 'count';
  $('handLabel').textContent = 'LOCKED IN';
  const ct = $('centerText');
  ['3', '2', '1'].forEach((n, i) => {
    later(() => {
      ct.textContent = n;
      ct.className = 'beat';
      void ct.offsetWidth;
      ct.className = 'beat show';
      SFX.count(3 - i);
    }, i * BEAT_MS);
  });
}

function onlineReveal(d) {
  if (!M || !M.online) return;
  M.phase = 'reveal';

  const ct = $('centerText');
  ct.textContent = 'WAR!';
  ct.className = 'war';
  void ct.offsetWidth;
  ct.className = 'war show';
  SFX.war();
  flash();
  shake(true);
  later(() => { ct.textContent = ''; ct.className = ''; }, 700);

  const revealed = [];
  d.cards.forEach((c, n) => {
    const p = M.players[localIndex(c.seat)];
    if (!p) return;
    p.card = c.card;
    revealed.push(p);
    const slot = p.seat.querySelector('.seat-card-slot');
    slot.innerHTML = '';
    const card = makeCard(p.cardBack, c.card);
    slot.appendChild(card);
    p.seat.classList.remove('ready');
    requestAnimationFrame(() => { card.classList.add('flipped', 'slam'); SFX.slam(n); });
  });

  later(() => {
    M.phase = 'resolve';
    d.scores.forEach((s, si) => {
      const p = M.players[localIndex(si)];
      if (p) p.score = s;
    });
    M.prizePot = d.pot;
    const winner = d.winner === null ? null : M.players[localIndex(d.winner)];
    if (winner && winner.id === 0) {
      M.stats.prizeCards += d.gained;
      if (winner.card <= 3) M.stats.wonLowCard = true;
    }
    (d.reactions || []).forEach(r => {
      const p = M.players[localIndex(r.seat)];
      if (p) setTimeout(() => showReaction(p, r.emoji), r.delay || 0);
    });

    if (d.sudden) {
      revealed.forEach(p => {
        const dup = revealed.filter(x => x.card === p.card).length > 1;
        if (dup) p.seat.querySelector('.card').classList.add('cancelled');
      });
      if (winner) {
        winner.seat.querySelector('.card').classList.add('winner');
        showEvent(`${winner.name} WINS!`);
        SFX.upset();
      } else {
        showEvent('EVERYONE CANCELLED — AGAIN!');
        SFX.cancel();
      }
      return;
    }
    paintResolution(revealed, winner, d.gained, d.pot);
  }, REVEAL_MS);
}

function onlineMatchEnd(d) {
  if (!M || !M.online) return;
  M.running = false;
  clearMatchTimers();
  SFX.stopMusic();
  $('dangerVignette').classList.remove('on');
  $('fxLayer').innerHTML = '';
  clearGrabs();

  // Friendlies are for bragging rights only — nothing is staked and nothing is earned.
  const rewards = d.friendly ? null : applyMatchResult({
    place: d.place,
    prizeCards: M.stats.prizeCards,
    wonLowCard: M.stats.wonLowCard,
    reachedSudden: M.sudden,
    mode: d.mode,
  });

  $('resultTitle').textContent = d.place === 0
    ? 'VICTORY!'
    : ['', '2ND PLACE', '3RD PLACE', '4TH PLACE'][d.place];
  $('resultTitle').className = d.place === 0 ? 'win' : 'lose';

  const sc = $('resultScores');
  sc.innerHTML = '';
  d.standings.forEach((r, i) => {
    const mine = localIndex(r.seat) === 0;
    const row = el('div', 'res-row' + (mine ? ' you' : ''));
    row.appendChild(el('span', 'res-place', '#' + (i + 1)));
    row.appendChild(el('span', 'sb-av', mine ? SAVE.avatar : (r.avatar || '🎮')));
    row.appendChild(el('span', 'sb-name', r.name));
    row.appendChild(el('span', 'sb-score', String(r.score)));
    sc.appendChild(row);
  });

  $('resultRewards').classList.toggle('hidden', !rewards);
  if (rewards) {
    const t = rewards.trophyDelta;
    $('rewardTrophy').querySelector('.r-val').textContent = (t >= 0 ? '+' : '') + t;
    $('rewardTrophy').classList.toggle('neg', t < 0);
    $('rewardXp').querySelector('.r-val').textContent = '+' + rewards.xp;
    $('rewardCoins').querySelector('.r-val').textContent = '+' + rewards.coins;
  }

  const extras = $('resultExtras');
  extras.innerHTML = '';
  if (d.friendly) extras.appendChild(el('div', 'extra track', 'FRIENDLY — NOTHING STAKED'));
  if (d.forfeit) extras.appendChild(el('div', 'extra streak', 'OPPONENT LEFT'));
  if (rewards) {
    if (rewards.levelsGained) extras.appendChild(el('div', 'extra level', `LEVEL UP! → ${rewards.newLevel}`));
    if (rewards.arenaUp) extras.appendChild(el('div', 'extra arena', `NEW ARENA — ${rewards.arenaUp.name}!`));
    if (rewards.arenaDown) extras.appendChild(el('div', 'extra demote', `ARENA LOST — back to ${rewards.arenaDown.name}`));
  }

  show('resultScreen');
  $('matchScreen').classList.remove('sudden-mode');
  if (d.place === 0) { SFX.victory(); playVictoryFx(SAVE.equipped.victory); }
  else SFX.defeat();
  setTimeout(() => SFX.trophy(), 900);
  M = null;
}

function netPick(index) { api('match/pick', { index }); }

/* ---------------- boot ---------------- */

(async () => {
  if (await resumeSession()) {
    enterGame();
    connectEvents();
  } else {
    setAuthMode('login');
    show('authScreen');
  }
})();
