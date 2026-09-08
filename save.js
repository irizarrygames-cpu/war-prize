// Account + progression, backed by the server so your profile and friends follow
// you to any device. Requires server.js to be running.

const TOKEN_KEY = 'warprize.token.v2';

let SAVE = null;
let CURRENT_USER = null;
let AUTH_TOKEN = null;

const DEFAULT_SAVE = {
  name: 'PLAYER',
  avatar: '🐉',
  trophies: 0,
  highestTrophies: 0,
  level: 1,
  xp: 0,
  coins: 500,
  wins: 0,
  matches: 0,
  prizeCards: 0,
  streak: 0,
  bestStreak: 0,
  muted: false,
  mode: 'party',
  tutorialSeen: false,
  unlocked: {
    cardBacks: ['classic'],
    tables: ['wooden'],
    titles: ['rookie'],
    victories: ['confetti'],
    reactions: ['laugh', 'skull', 'cry'],
  },
  equipped: {
    cardBack: 'classic',
    table: 'wooden',
    title: 'rookie',
    victory: 'confetti',
  },
  challenges: { date: '', list: [] },
};

/* ---------------- transport ---------------- */

async function api(route, payload = {}) {
  try {
    const res = await fetch('/api/' + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: AUTH_TOKEN, ...payload }),
    });
    if (res.status === 401) return { ok: false, msg: 'Session expired — sign in again', unauthorized: true };
    return await res.json();
  } catch (e) {
    return { ok: false, msg: 'Cannot reach the server', offline: true };
  }
}

function deepMerge(base, patch) {
  for (const k of Object.keys(patch || {})) {
    const v = patch[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      deepMerge(base[k], v);
    } else if (v !== undefined) {
      base[k] = v;
    }
  }
  return base;
}

let pushTimer = null;
function persist() {
  if (!AUTH_TOKEN || !SAVE) return;
  clearTimeout(pushTimer);                    // progression changes in bursts; batch them
  pushTimer = setTimeout(() => api('save', { save: SAVE }), 400);
}

function storeToken(t) {
  AUTH_TOKEN = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (e) { /* private mode -- session just won't survive a reload */ }
}

function adoptSession(id, name, save) {
  CURRENT_USER = id;
  SAVE = deepMerge(structuredClone(DEFAULT_SAVE), save || {});
  SAVE.name = name;
}

/* ---------------- auth ---------------- */

// Mirrors the server's rules so mistakes are caught before a round trip. The server
// re-checks everything regardless -- this is convenience, not the actual gate.
function validateCredentials(username, password) {
  const id = String(username || '').trim().toLowerCase();
  if (id.length < 3 || id.length > 14) return 'Username must be 3-14 characters';
  if (!/^[a-z0-9_]+$/.test(id)) return 'Use letters, numbers and _ only';
  const pw = String(password);
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (pw.toLowerCase() === id) return "Password can't be your username";
  return null;
}

// Accounts used to live in localStorage. If someone signs up with the same name they
// used before the server existed, bring their progress along instead of wiping it.
function legacySaveFor(id) {
  try {
    const raw = localStorage.getItem('warprize.save.' + id);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

async function signUp(username, password, confirm) {
  const problem = validateCredentials(username, password);
  if (problem) return { ok: false, msg: problem };
  if (password !== confirm) return { ok: false, msg: 'Passwords do not match' };

  const id = String(username).trim().toLowerCase();
  const legacy = legacySaveFor(id);
  const res = await api('auth/signup', { username, password, save: legacy });
  if (!res.ok) return res;
  storeToken(res.token);
  adoptSession(id, res.name, res.save);
  return { ok: true, inherited: !!legacy };
}

async function logIn(username, password) {
  const res = await api('auth/login', { username, password });
  if (!res.ok) return res;
  storeToken(res.token);
  adoptSession(String(username).trim().toLowerCase(), res.name, res.save);
  return { ok: true };
}

async function resumeSession() {
  let stored = null;
  try { stored = localStorage.getItem(TOKEN_KEY); } catch (e) { /* no storage */ }
  if (!stored) return false;
  AUTH_TOKEN = stored;
  const res = await api('me');
  if (!res.ok) { storeToken(null); AUTH_TOKEN = null; return false; }
  adoptSession(res.name.toLowerCase(), res.name, res.save);
  return true;
}

async function logOut() {
  await api('logout');
  storeToken(null);
  AUTH_TOKEN = null;
  CURRENT_USER = null;
  SAVE = null;
}

/* ---------------- challenges ---------------- */

// Local date, not UTC. toISOString() meant "daily" challenges reset at UTC midnight
// -- around 8pm for anyone in the eastern US -- so a day's challenges vanished in
// the middle of the evening.
function todayKey() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function refreshChallenges() {
  const key = todayKey();
  if (SAVE.challenges.date === key && SAVE.challenges.list.length) return;
  const pool = [...CHALLENGE_POOL];
  const picked = [];
  while (picked.length < 4 && pool.length) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  SAVE.challenges = { date: key, list: picked.map(c => ({ id: c.id, progress: 0, claimed: false })) };
  persist();
}

function challengeDef(id) { return CHALLENGE_POOL.find(c => c.id === id); }

function bumpChallenge(stat, amount = 1) {
  let changed = false;
  for (const entry of SAVE.challenges.list) {
    const def = challengeDef(entry.id);
    if (!def || def.stat !== stat || entry.claimed) continue;
    if (entry.progress >= def.target) continue;
    entry.progress = Math.min(def.target, entry.progress + amount);
    changed = true;
  }
  if (changed) persist();
  return changed;
}

function hasClaimableChallenge() {
  return SAVE.challenges.list.some(e => {
    const def = challengeDef(e.id);
    return def && !e.claimed && e.progress >= def.target;
  });
}

/* ---------------- progression ---------------- */

function addXp(amount) {
  SAVE.xp += amount;
  let levels = 0;
  while (SAVE.xp >= xpForLevel(SAVE.level)) {
    SAVE.xp -= xpForLevel(SAVE.level);
    SAVE.level++;
    levels++;
  }
  return levels;
}

function applyMatchResult({ place, prizeCards, wonLowCard, reachedSudden, mode }) {
  const before = { arena: arenaFor(SAVE.trophies).n, level: SAVE.level };

  const m = modeOf(mode);
  const trophyDelta = m.trophies[place] ?? m.trophies[m.trophies.length - 1];
  const won = place === 0;

  SAVE.trophies = Math.max(0, SAVE.trophies + trophyDelta);
  SAVE.highestTrophies = Math.max(SAVE.highestTrophies, SAVE.trophies);
  SAVE.matches++;
  SAVE.prizeCards += prizeCards;

  if (won) {
    SAVE.wins++;
    SAVE.streak++;
    SAVE.bestStreak = Math.max(SAVE.bestStreak, SAVE.streak);
  } else {
    SAVE.streak = 0;
  }

  const coins = (m.coins[place] ?? m.coins[m.coins.length - 1]) + prizeCards * 2;
  SAVE.coins += coins;

  let xp = 40 + prizeCards * 2 + (won ? 60 : 0);
  if (won && SAVE.streak >= 3) xp += 30;
  const levelsGained = addXp(xp);

  bumpChallenge('matches');
  bumpChallenge('prizes', prizeCards);
  if (won) bumpChallenge('wins');
  if (wonLowCard) bumpChallenge('lowWins');
  if (reachedSudden) bumpChallenge('sudden');
  if (won && SAVE.streak >= 3) bumpChallenge('streak3');

  const after = { arena: arenaFor(SAVE.trophies).n, level: SAVE.level };
  persist();

  return {
    trophyDelta, coins, xp, levelsGained,
    newLevel: SAVE.level,
    arenaUp: after.arena > before.arena ? arenaFor(SAVE.trophies) : null,
    arenaDown: after.arena < before.arena ? arenaFor(SAVE.trophies) : null,
    streak: SAVE.streak,
  };
}

function isUnlocked(kind, id) { return SAVE.unlocked[kind].includes(id); }

function buy(kind, id, cost) {
  if (isUnlocked(kind, id)) return 'owned';
  if (SAVE.coins < cost) return 'poor';
  SAVE.coins -= cost;
  SAVE.unlocked[kind].push(id);
  persist();
  return 'ok';
}

function equip(slot, id) {
  SAVE.equipped[slot] = id;
  persist();
}
