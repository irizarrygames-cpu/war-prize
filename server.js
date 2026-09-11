// War Prize multiplayer server. Zero dependencies -- plain Node.
//
//   node server.js [port]
//
// Serves the game and runs accounts, friends, invites and live 1v1 matches.
// The server deals the cards and decides the winner; clients are never trusted
// with either, and a player is only ever sent their own two candidates.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { screenUsername } = require('./moderation');

const PORT = Number(process.argv[2] || process.env.PORT || 8421);
// Bumped whenever something worth verifying from outside ships. /api/health reports it.
const BUILD = 14;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.json');

const CARD_MIN = 1, CARD_MAX = 10;
const KNOWN_LOW_CHANCE = 0.65, KNOWN_LOW_MAX = 5;
const MATCH_SECONDS = 60;
const SELECT_MS = 3600, BEAT_MS = 420, REVEAL_MS = 620, RESOLVE_MS = 1300;
const PBKDF2_ITERATIONS = 150000;
const QUEUE_WAIT_MS = 30000;   // hunt for real players this long, then fill with bots
// Peek charges. Looking at your own blind card is worth more than looking at someone
// else's, so it costs more -- otherwise "always check your own" simply wins and
// there is no decision. Simulated over 40k matches with symmetric costs: self-only
// took 29.9% of matches against opponent-only on 27.3%. Charging 2 for self brings
// them to 26.2% and 27.3%, close enough that neither is the obvious play.
const PEEKS_PER_MATCH = 3;
const SELF_PEEK_COST = 2;
const OPP_PEEK_COST = 1;

const MODES = {
  duel:  { players: 2 },
  trio:  { players: 3 },
  party: { players: 4 },
};

const ARENA_THRESHOLDS = [0, 300, 700, 1200, 1800, 2500, 3300, 4200, 5200, 6500];
const BOT_WEAKNESS_ARENA_1 = 0.52, BOT_WEAKNESS_ARENA_10 = 0.04, BOT_WEAKNESS_SPREAD = 0.10;

// Bots must be indistinguishable from real players, so they get usernames built the
// same way people build theirs and avatars from the same set the game offers.
const BOT_NAME_A = ['ace', 'blitz', 'cyber', 'dark', 'echo', 'frost', 'ghost', 'hyper',
  'iron', 'jet', 'lunar', 'neon', 'onyx', 'pixel', 'rapid', 'storm', 'turbo', 'vortex',
  'wolf', 'zen', 'crimson', 'shadow', 'atomic', 'silver'];
const BOT_NAME_B = ['bolt', 'claw', 'dash', 'edge', 'fang', 'gale', 'hawk', 'jinx',
  'kite', 'lynx', 'mist', 'nova', 'pulse', 'rush', 'shade', 'spark', 'tide', 'viper',
  'wave', 'zap'];
const AVATARS = ['🐉', '🦊', '🐼', '👽', '👑', '🐸', '💀', '🌟', '🐻', '🐰', '🤖', '🦁', '🐺', '🦈'];

// The only emoji a player may send. Kept in step with REACTIONS in data.js.
const REACTION_EMOJI = new Set(['😂', '💀', '😭', '🔥', '😡', '😱']);

// Emoji are harmless but a held-down button shouldn't let anyone strobe the table.
const reactClock = new Map();
function spamming(id) {
  const now = Date.now();
  const last = reactClock.get(id) || 0;
  if (now - last < 700) return true;
  reactClock.set(id, now);
  return false;
}

const MOODS = {
  hype:  { win: '🔥', lose: '😭', upset: '😱', nobody: '😂' },
  cocky: { win: '😂', lose: '😡', upset: '😡', nobody: '😡' },
  chill: { win: '🔥', lose: '😂', upset: '😱', nobody: '😂' },
  salty: { win: '😂', lose: '💀', upset: '💀', nobody: '💀' },
};
const MOOD_KEYS = Object.keys(MOODS);

function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function makeBotIdentity(taken) {
  for (let i = 0; i < 50; i++) {
    let name = pickOne(BOT_NAME_A) + pickOne(BOT_NAME_B);
    if (Math.random() < 0.35) name += randInt(2, 99);
    name = name.slice(0, 14).toUpperCase();
    // never clash with a seat already taken, or with a real account's name
    if (!taken.has(name) && !getUser(name.toLowerCase())) {
      taken.add(name);
      return { name, avatar: pickOne(AVATARS), mood: pickOne(MOOD_KEYS) };
    }
  }
  return { name: 'PLAYER' + randInt(100, 999), avatar: pickOne(AVATARS), mood: pickOne(MOOD_KEYS) };
}

function arenaNumberFor(trophies) {
  let n = 1;
  ARENA_THRESHOLDS.forEach((t, i) => { if (trophies >= t) n = i + 1; });
  return n;
}

function botWeaknessFor(arenaN) {
  const t = (Math.min(Math.max(arenaN, 1), 10) - 1) / 9;
  return BOT_WEAKNESS_ARENA_1 + t * (BOT_WEAKNESS_ARENA_10 - BOT_WEAKNESS_ARENA_1);
}

/* ---------------- storage ----------------
   Accounts have to outlive the process. On a free host the server is restarted
   whenever it has been idle a while, and anything written next to the code goes
   with it -- which is exactly how every account on the live site got erased. So
   when DATABASE_URL is set, accounts live in Postgres. Without it we fall back to
   the JSON file, which keeps local development a zero-setup affair.

   DB.users stays in memory and every read goes through it exactly as before. The
   store only handles loading it at boot and writing back whatever changed. */

let DB = { users: {} };

const DATABASE_URL = process.env.DATABASE_URL || '';

// Set ADMIN_USER to your own username to get the moderation tools in-game. Left
// unset, nobody is an admin and the endpoints below simply refuse everyone.
const ADMIN_USER = String(process.env.ADMIN_USER || '').trim().toLowerCase();
const isAdmin = id => !!ADMIN_USER && id === ADMIN_USER;

function makeFileStore() {
  return {
    kind: 'file',
    async load() {
      try {
        const parsed = JSON.parse(await fs.promises.readFile(DATA_FILE, 'utf8'));
        return parsed.users || {};
      } catch (e) {
        if (e.code === 'ENOENT') return {};        // first run
        throw e;                                   // corrupt file -- don't start empty
      }
    },
    async write(users) {
      await fs.promises.writeFile(DATA_FILE + '.tmp', JSON.stringify({ users }));
      await fs.promises.rename(DATA_FILE + '.tmp', DATA_FILE);
    },
    async remove() { /* the whole map is rewritten, so it is already gone */ },
  };
}

function makePostgresStore(url) {
  let neon;
  try {
    ({ neon } = require('@neondatabase/serverless'));
  } catch (e) {
    // Almost always a host with no build step, so the dependency never got fetched.
    console.error('DATABASE_URL is set but the Postgres driver is missing.');
    console.error('Run "npm install", or set the host\'s build command to "npm install".');
    process.exit(1);
  }
  let sql;
  try {
    sql = neon(url);
  } catch (e) {
    console.error('DATABASE_URL is not a valid Postgres connection string.');
    console.error('It should look like: postgresql://user:password@host/dbname?sslmode=require');
    process.exit(1);
  }
  return {
    kind: 'postgres',
    async load() {
      await sql`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      const rows = await sql`SELECT id, data FROM users`;
      const users = {};
      for (const row of rows) users[row.id] = row.data;
      return users;
    },
    async write(users, changed) {
      for (const id of changed) {
        const rec = users[id];
        if (!rec) continue;
        await sql`INSERT INTO users (id, data) VALUES (${id}, ${JSON.stringify(rec)})
                  ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
      }
    },
    async remove(id) { await sql`DELETE FROM users WHERE id = ${id}`; },
  };
}

const store = DATABASE_URL ? makePostgresStore(DATABASE_URL) : makeFileStore();

// What we last wrote for each account, so a flush can send only what actually
// changed. Doing the comparison here means none of the callers have to say which
// account they touched.
const persisted = new Map();

function changedUserIds() {
  const changed = [];
  for (const id of Object.keys(DB.users)) {
    const json = JSON.stringify(DB.users[id]);
    if (persisted.get(id) !== json) changed.push(id);
  }
  return changed;
}

let saveTimer = null;
let saving = false;
let saveQueued = false;

function saveDB() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushDB, 250);
}

// A safety net under the debounce. The shutdown hook below covers a polite restart,
// but a free host can also just pull the plug, and then no handler runs at all --
// this bounds what a player can lose to a few seconds rather than a whole session.
setInterval(flushDB, 5000).unref();

async function flushDB() {
  if (saving) { saveQueued = true; return; }      // never two writes in flight
  const changed = changedUserIds();
  if (!changed.length) return;
  saving = true;
  try {
    await store.write(DB.users, changed);
    for (const id of changed) persisted.set(id, JSON.stringify(DB.users[id]));
  } catch (e) {
    // Leave them dirty; the next change retries them.
    console.error('Could not save accounts:', e.message);
  } finally {
    saving = false;
    if (saveQueued) { saveQueued = false; saveDB(); }
  }
}

// user record: { name, hash, salt, iterations, created, save, friends[], incoming[], outgoing[] }
function getUser(id) { return DB.users[id]; }

/* ---------------- leaderboard ---------------- */

const LEADERBOARD_SIZE = 100;
const LEADERBOARD_CACHE_MS = 15000;
let boardCache = null;

// Ranking everyone on every request is wasteful when a hundred people are looking
// at the same list, so the sorted table is rebuilt at most every few seconds. Your
// own rank is read out of it rather than recomputed.
function rankedUsers() {
  if (boardCache && Date.now() - boardCache.at < LEADERBOARD_CACHE_MS) return boardCache.rows;
  const rows = Object.entries(DB.users)
    .map(([id, u]) => ({
      id,
      name: u.name || id.toUpperCase(),
      avatar: (u.save && u.save.avatar) || '🎮',
      trophies: Math.max(0, (u.save && u.save.trophies) | 0),
      level: Math.max(1, (u.save && u.save.level) | 0),
    }))
    // A tie is broken by name so the order doesn't shuffle between refreshes.
    .sort((a, b) => b.trophies - a.trophies || a.name.localeCompare(b.name));
  boardCache = { at: Date.now(), rows };
  return rows;
}

// Everything that has to happen when an account goes: out of any live match, out of
// everyone else's friends list, sessions killed, row dropped. Shared by the player
// deleting their own account and the owner deleting someone else's, so the two can
// never drift apart and leave dangling references behind.
async function removeAccount(target) {
  const m = matchOf(target);
  if (m && !m.over) finishMatch(m, target);
  leaveQueue(target);

  for (const [id, u] of Object.entries(DB.users)) {
    if (id === target) continue;
    ensureLists(u);
    u.friends = u.friends.filter(x => x !== target);
    u.incoming = u.incoming.filter(x => x !== target);
    u.outgoing = u.outgoing.filter(x => x !== target);
  }
  for (const [tok, id] of tokens) if (id === target) tokens.delete(tok);
  pending.delete(target);
  lastSeen.delete(target);
  const w = waiters.get(target);
  if (w) {
    clearTimeout(w.timer);
    waiters.delete(target);
    try { sendJSON(w.res, 200, { ok: true, events: [] }); } catch (e) {}
  }

  delete DB.users[target];
  persisted.delete(target);
  boardCache = null;
  try { await store.remove(target); } catch (e) { console.error('delete failed:', e.message); }
  saveDB();
}

function leaderboard(meId) {
  const rows = rankedUsers();
  const myIndex = rows.findIndex(r => r.id === meId);
  return {
    top: rows.slice(0, LEADERBOARD_SIZE).map(({ id, ...rest }) => rest),
    players: rows.length,
    me: myIndex < 0 ? null : { rank: myIndex + 1, trophies: rows[myIndex].trophies },
  };
}

function ensureLists(u) {
  u.friends = u.friends || [];
  u.incoming = u.incoming || [];
  u.outgoing = u.outgoing || [];
  return u;
}

/* ---------------- auth ---------------- */

const tokens = new Map();    // token -> userId
const pending = new Map();   // userId -> queued events awaiting collection
const waiters = new Map();   // userId -> { res, timer } for a held long-poll
const lastSeen = new Map();  // userId -> ms of last contact

const POLL_HOLD_MS = 20000;  // how long to hold a poll open before answering empty
const ONLINE_MS = 45000;     // counted as present if seen this recently
// Generous, because browsers throttle background tabs to roughly one timer a minute.
// A tighter window would drop players for glancing at another app.
const STALE_MS = 150000;

function hashPassword(password, salt, iterations) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, 32, 'sha256', (err, key) =>
      err ? reject(err) : resolve(key.toString('base64')));
  });
}

function normalizeId(name) { return String(name || '').trim().toLowerCase(); }

// Deliberately NOT checking whether a password is already in use by someone else.
// Telling a stranger "that password is taken" hands them a working password, and
// salted hashes can't be compared across accounts anyway without weakening them.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'passw0rd', '12345678', '123456789', '1234567890',
  'qwerty123', 'qwertyui', '1q2w3e4r', 'abc12345', 'iloveyou', 'letmein1',
  'welcome1', 'admin123', 'football', 'baseball', 'sunshine', 'princess',
  'dragon123', 'monkey123', 'superman', 'trustno1', 'starwars', 'whatever',
]);

function validateUsername(username) {
  const id = normalizeId(username);
  if (id.length < 3 || id.length > 14) return 'Username must be 3-14 characters';
  if (!/^[a-z0-9_]+$/.test(id)) return 'Use letters, numbers and _ only';
  return null;
}

// Signup only. Login must NEVER run this: password rules change over time, and an
// account made under the old rules has to keep working. Checking policy at login
// locked out every account created before the 8-character minimum existed.
function validateNewPassword(username, password) {
  const bad = validateUsername(username);
  if (bad) return bad;

  const pw = String(password);
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (pw.length > 200) return 'Password is too long';
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) return 'That password is too easy to guess';
  if (/^(.)\1+$/.test(pw)) return 'That password is too easy to guess';
  if (pw.toLowerCase() === normalizeId(username)) return "Password can't be your username";
  return null;
}

function userIdFromToken(token) { return tokens.get(String(token || '')); }

// Sessions used to live only in memory, so every restart signed everybody out --
// and on a free host that is every deploy and every wake from idle. Worse, the
// client said nothing about it: the poll came back unauthorised, the loop quietly
// stopped, and the player sat on "starting in 0s" for ever. Keeping them on the
// account record means a restart no longer throws anyone out.
const SESSIONS_PER_USER = 5;                       // a phone, a laptop, a spare
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000;  // 30 days

function rememberSession(id, token) {
  const u = getUser(id);
  if (!u) return;
  const now = Date.now();
  u.sessions = (u.sessions || []).filter(s => s && s.token && now - (s.at || 0) < SESSION_MAX_AGE);
  u.sessions.push({ token, at: now });
  while (u.sessions.length > SESSIONS_PER_USER) {
    const dropped = u.sessions.shift();
    tokens.delete(dropped.token);
  }
  saveDB();
}

function forgetSession(token) {
  const id = tokens.get(token);
  tokens.delete(token);
  const u = id && getUser(id);
  if (u && u.sessions) { u.sessions = u.sessions.filter(s => s.token !== token); saveDB(); }
}

// Rebuilds the in-memory index from what was saved.
function restoreSessions() {
  const now = Date.now();
  let live = 0;
  for (const [id, u] of Object.entries(DB.users)) {
    if (!u.sessions) continue;
    u.sessions = u.sessions.filter(s => s && s.token && now - (s.at || 0) < SESSION_MAX_AGE);
    for (const s of u.sessions) { tokens.set(s.token, id); live++; }
  }
  return live;
}

function issueToken(id) {
  const token = crypto.randomBytes(24).toString('hex');
  tokens.set(token, id);
  rememberSession(id, token);
  return token;
}

/* ---------------- presence + push ---------------- */

function currentMatch(id) { return matchOf(id); }

// Long-polling rather than SSE. CDNs and tunnels buffer event streams until enough
// bytes accumulate, which stalls an idle stream forever (Cloudflare does exactly
// this, and strips X-Accel-Buffering). A held request/response gets through anything.
function isOnline(id) {
  if (waiters.has(id)) return true;
  const seen = lastSeen.get(id);
  return !!seen && Date.now() - seen < ONLINE_MS;
}

function push(id, type, payload) {
  const q = pending.get(id) || [];
  q.push({ type, ...payload });
  if (q.length > 300) q.shift();          // a long-gone client can't grow forever
  pending.set(id, q);
  flushWaiter(id);
  return true;
}

function flushWaiter(id) {
  const w = waiters.get(id);
  const q = pending.get(id);
  if (!w || !q || !q.length) return;
  waiters.delete(id);
  clearTimeout(w.timer);
  pending.set(id, []);
  try { sendJSON(w.res, 200, { ok: true, events: q }); } catch (e) { /* client vanished */ }
}

function friendPayload(id) {
  const u = ensureLists(getUser(id));
  return {
    friends: u.friends.map(f => ({
      name: getUser(f) ? getUser(f).name : f.toUpperCase(),
      id: f,
      online: isOnline(f),
      busy: !!currentMatch(f),
    })),
    incoming: u.incoming.map(f => ({ id: f, name: getUser(f) ? getUser(f).name : f.toUpperCase() })),
    outgoing: u.outgoing.map(f => ({ id: f, name: getUser(f) ? getUser(f).name : f.toUpperCase() })),
  };
}

function pushFriends(id) {
  if (isOnline(id)) push(id, 'friends', friendPayload(id));
}

function notifyFriendsOfPresence(id) {
  const u = ensureLists(getUser(id));
  u.friends.forEach(f => pushFriends(f));
}

/* ---------------- invites ---------------- */

const invites = new Map();  // inviteId -> { from, to, at, timer }

function cancelInvite(inviteId, reason) {
  const inv = invites.get(inviteId);
  if (!inv) return;
  clearTimeout(inv.timer);
  invites.delete(inviteId);
  push(inv.to, 'invite-cancelled', { inviteId, reason });
  push(inv.from, 'invite-cancelled', { inviteId, reason });
}

/* ---------------- match ---------------- */

const matches = new Map();  // matchId -> match
const playerMatch = new Map();  // userId -> matchId

function matchOf(id) { return matches.get(playerMatch.get(id)); }

function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

function drawKnown() {
  return Math.random() < KNOWN_LOW_CHANCE
    ? randInt(CARD_MIN, KNOWN_LOW_MAX)
    : randInt(KNOWN_LOW_MAX + 1, CARD_MAX);
}

// Matching numbers cancel; the highest number left alone wins.
function findWinner(entries) {
  const counts = {};
  entries.forEach(e => { counts[e.card] = (counts[e.card] || 0) + 1; });
  const unique = entries.filter(e => counts[e.card] === 1);
  return unique.length ? unique.reduce((a, b) => (a.card > b.card ? a : b)) : null;
}

function startMatch(humanIds, modeKey, friendly) {
  const mode = MODES[modeKey] || MODES.party;
  const id = crypto.randomBytes(8).toString('hex');

  // Bot skill tracks the arena the real players are climbing in.
  const trophies = humanIds.map(h => (getUser(h) && getUser(h).save && getUser(h).save.trophies) || 0);
  const avg = trophies.reduce((a, b) => a + b, 0) / Math.max(1, trophies.length);
  const baseWeak = botWeaknessFor(arenaNumberFor(avg));

  const players = humanIds.map(uid => ({
    id: uid, bot: false, name: getUser(uid).name,
    avatar: (getUser(uid).save && getUser(uid).save.avatar) || '🎮',
    score: 0, candidates: [], pick: null, peeks: PEEKS_PER_MATCH, peeked: false,
  }));

  const taken = new Set(players.map(p => p.name));
  while (players.length < mode.players) {
    const b = makeBotIdentity(taken);
    players.push({
      id: null, bot: true, name: b.name, avatar: b.avatar, mood: b.mood,
      score: 0, candidates: [], pick: null, peeks: PEEKS_PER_MATCH, peeked: false,
      weakness: Math.max(0, baseWeak + (Math.random() - 0.5) * BOT_WEAKNESS_SPREAD),
    });
  }

  const m = {
    id, mode: modeKey,
    friendly: !!friendly,
    players,
    pot: 1,
    round: 0,
    phase: 'idle',
    endsAt: Date.now() + MATCH_SECONDS * 1000,
    timers: [],
    over: false,
    sudden: false,
    suddenIdx: null,
    suddenWinner: null,
  };
  matches.set(id, m);
  humanIds.forEach(uid => playerMatch.set(uid, id));

  players.forEach((p, i) => {
    if (!p.id) return;
    push(p.id, 'match-start', {
      matchId: id,
      mode: modeKey,
      friendly: !!friendly,
      you: i,
      // no bot flag: the client can't reveal what it was never told
      seats: players.map(x => ({ name: x.name, avatar: x.avatar })),
      seconds: MATCH_SECONDS,
    });
  });
  humanIds.forEach(uid => { pushFriends(uid); notifyFriendsOfPresence(uid); });

  later(m, () => beginRound(m), 900);
  return m;
}

// Indices still playing -- everyone, or just those tied for the lead in sudden death.
function activeIdx(m) {
  return m.suddenIdx || m.players.map((_, i) => i);
}

function beginRound(m) {
  if (m.over) return;
  if (!m.sudden && Date.now() >= m.endsAt) return finishMatch(m);

  m.round++;
  m.phase = 'choose';
  const active = activeIdx(m);
  active.forEach(i => {
    const p = m.players[i];
    p.pick = null;
    p.peeked = false;
    p.seen = {};                 // fresh cards, so last round's peeks mean nothing
    p.candidates = [drawKnown(), randInt(CARD_MIN, CARD_MAX)];
  });

  m.players.forEach((p, i) => {
    if (!p.id) return;
    push(p.id, 'round', {
      round: m.round,
      known: active.includes(i) ? p.candidates[0] : null,
      spectating: !active.includes(i),
      active,
      pot: m.pot,
      peeks: p.peeks,
      peekCosts: { self: SELF_PEEK_COST, opponent: OPP_PEEK_COST },
      sudden: m.sudden,
      msLeft: Math.max(0, m.endsAt - Date.now()),
    });
  });

  // bots decide on their own clock so the table feels alive
  active.forEach(i => {
    const p = m.players[i];
    if (!p.bot) return;
    // Bots spend peeks too -- otherwise never seeing one would give them away.
    // Worth more when a stacked pot is on the line, so they lean on them then.
    const wantsPeek = p.peeks > 0 && Math.random() < (m.pot > 1 ? 0.45 : 0.18);
    if (wantsPeek) {
      later(m, () => {
        if (m.phase !== 'choose' || p.pick !== null || p.peeks < 1) return;
        p.peeks--;
        p.peeked = true;
        m.players.forEach(x => { if (x.id) push(x.id, 'peeked', { seat: i }); });
      }, randInt(300, 700));
    }
    later(m, () => {
      if (m.phase !== 'choose' || p.pick !== null) return;
      // Having looked, take the better card outright.
      submitPickIndex(m, i, p.peeked
        ? (p.candidates[0] >= p.candidates[1] ? 0 : 1)
        : botChoice(p));
    }, randInt(900, 1900));
  });

  later(m, () => {
    active.forEach(i => {
      const p = m.players[i];
      if (p.pick === null) p.pick = p.candidates[0] <= p.candidates[1] ? 0 : 1;
    });
    beginCountdown(m);
  }, SELECT_MS);
}

function botChoice(p) {
  if (Math.random() < p.weakness) return 0;      // sloppy: grab the visible card
  const top = p.candidates[0];
  if (top >= 8) return Math.random() < 0.75 ? 0 : 1;
  if (top <= 3) return Math.random() < 0.75 ? 1 : 0;
  return randInt(0, 1);
}

function submitPickIndex(m, playerIdx, index) {
  if (m.over || m.phase !== 'choose') return;
  const p = m.players[playerIdx];
  if (!p || p.pick !== null) return;
  if (!activeIdx(m).includes(playerIdx)) return;
  p.pick = index === 1 ? 1 : 0;

  m.players.forEach(x => { if (x.id) push(x.id, 'picked', { seat: playerIdx }); });
  if (activeIdx(m).every(i => m.players[i].pick !== null)) {
    clearMatchTimers(m);
    later(m, () => beginCountdown(m), 200);
  }
}

function submitPick(m, userId, index) {
  const idx = m.players.findIndex(p => p.id === userId);
  if (idx >= 0) submitPickIndex(m, idx, index);
}

function beginCountdown(m) {
  if (m.over || m.phase === 'count') return;
  m.phase = 'count';
  clearMatchTimers(m);
  m.players.forEach(p => { if (p.id) push(p.id, 'countdown', { beat: BEAT_MS }); });
  later(m, () => resolveRound(m), BEAT_MS * 3 + REVEAL_MS);
}

function resolveRound(m) {
  if (m.over) return;
  m.phase = 'resolve';

  const active = activeIdx(m);
  const entries = active.map(i => ({ i, card: m.players[i].candidates[m.players[i].pick] }));
  const winner = findWinner(entries);
  const gained = winner ? m.pot : 0;

  if (winner) {
    m.players[winner.i].score += gained;
    m.pot = 1;
  } else if (!m.sudden) {
    m.pot++;
  }

  // Bots emote through the same channel a person would, so their reactions read as
  // ordinary player behaviour rather than a tell.
  const reactions = [];
  active.forEach(i => {
    const p = m.players[i];
    if (!p.bot || Math.random() > 0.55) return;
    const set = MOODS[p.mood] || MOODS.hype;
    let key = winner ? (winner.i === i ? 'win' : 'lose') : 'nobody';
    if (winner && winner.card <= 3 && winner.i !== i) key = 'upset';
    reactions.push({ seat: i, emoji: set[key], delay: randInt(120, 520) });
  });

  const payload = {
    cards: entries.map(e => ({ seat: e.i, card: e.card })),
    winner: winner ? winner.i : null,
    gained,
    pot: m.pot,
    scores: m.players.map(p => p.score),
    sudden: m.sudden,
    reactions,
    msLeft: Math.max(0, m.endsAt - Date.now()),
  };
  m.players.forEach(p => { if (p.id) push(p.id, 'reveal', payload); });

  if (m.sudden && winner) {
    m.suddenWinner = winner.i;
    later(m, () => finishMatch(m), 1600);
    return;
  }

  later(m, () => {
    if (!m.sudden && Date.now() >= m.endsAt) finishMatch(m);
    else beginRound(m);
  }, RESOLVE_MS);
}

function enterSuddenDeath(m, tied) {
  clearMatchTimers(m);
  m.sudden = true;
  m.suddenIdx = tied;
  m.pot = 1;
  m.players.forEach(p => {
    if (p.id) push(p.id, 'sudden-death', { active: tied, names: tied.map(i => m.players[i].name) });
  });
  later(m, () => beginRound(m), 2300);
}

function finishMatch(m, forfeitBy) {
  if (m.over) return;

  if (!forfeitBy && !m.sudden) {
    const top = Math.max(...m.players.map(p => p.score));
    const tied = m.players.map((p, i) => (p.score === top ? i : -1)).filter(i => i >= 0);
    if (tied.length > 1) return enterSuddenDeath(m, tied);
  }

  m.over = true;
  clearMatchTimers(m);

  // Sudden-death winner takes first outright; everyone else falls in by score.
  const order = m.players.map((p, i) => ({ i, score: p.score }))
    .sort((a, b) => b.score - a.score);
  if (m.suddenWinner !== null && m.suddenWinner !== undefined) {
    const at = order.findIndex(o => o.i === m.suddenWinner);
    if (at > 0) order.unshift(order.splice(at, 1)[0]);
  }
  if (forfeitBy) {
    const quitter = m.players.findIndex(p => p.id === forfeitBy);
    const at = order.findIndex(o => o.i === quitter);
    if (at >= 0) order.push(order.splice(at, 1)[0]);   // leavers finish last
  }

  const standings = order.map(o => ({
    seat: o.i, name: m.players[o.i].name, avatar: m.players[o.i].avatar, score: o.score,
  }));

  m.players.forEach((p, i) => {
    if (!p.id) return;
    push(p.id, 'match-end', {
      place: order.findIndex(o => o.i === i),
      standings,
      forfeit: !!forfeitBy && p.id !== forfeitBy,
      friendly: m.friendly,
      mode: m.mode,
    });
    playerMatch.delete(p.id);
  });
  matches.delete(m.id);
  m.players.forEach(p => { if (p.id) { pushFriends(p.id); notifyFriendsOfPresence(p.id); } });
}

/* ---------------- matchmaking queue ---------------- */

const queues = { duel: [], trio: [], party: [] };

function queueOf(id) {
  for (const key of Object.keys(queues)) {
    const at = queues[key].findIndex(e => e.id === id);
    if (at >= 0) return { key, at };
  }
  return null;
}

function leaveQueue(id) {
  const found = queueOf(id);
  if (!found) return false;
  const [entry] = queues[found.key].splice(found.at, 1);
  clearTimeout(entry.timer);
  broadcastQueue(found.key);
  return true;
}

function broadcastQueue(key) {
  const need = MODES[key].players;
  queues[key].forEach(e => push(e.id, 'queue', {
    mode: key, waiting: queues[key].length, need,
    msLeft: Math.max(0, QUEUE_WAIT_MS - (Date.now() - e.at)),
  }));
}

function joinQueue(id, key) {
  if (!MODES[key]) return { ok: false, msg: 'Unknown mode' };
  if (matchOf(id)) return { ok: false, msg: 'You are already in a match' };
  leaveQueue(id);

  const entry = { id, at: Date.now() };
  entry.timer = setTimeout(() => launch(key, true), QUEUE_WAIT_MS);
  queues[key].push(entry);
  broadcastQueue(key);

  if (queues[key].length >= MODES[key].players) launch(key, false);
  return { ok: true };
}

// Pull players off the queue and start. With `fillBots`, go even if short-handed.
function launch(key, fillBots) {
  const need = MODES[key].players;
  const q = queues[key];
  if (!q.length) return;
  if (!fillBots && q.length < need) return;

  const taken = q.splice(0, Math.min(need, q.length));
  taken.forEach(e => clearTimeout(e.timer));
  const ids = taken.map(e => e.id).filter(uid => isOnline(uid) && !matchOf(uid));

  // Anyone dropped here has already been taken off the queue, so without a word to
  // their client they sit on "starting in 0s" for ever waiting for a match that is
  // never coming. That is exactly the freeze players were hitting.
  const dropped = taken.map(e => e.id).filter(uid => !ids.includes(uid));
  dropped.forEach(uid => push(uid, 'queue-dropped', {}));

  if (!ids.length) { broadcastQueue(key); return; }

  startMatch(ids, key);
  broadcastQueue(key);
}

function later(m, fn, ms) {
  const t = setTimeout(() => { if (!m.over) fn(); }, ms);
  m.timers.push(t);
  return t;
}

function clearMatchTimers(m) {
  m.timers.forEach(clearTimeout);
  m.timers = [];
}

/* ---------------- http helpers ---------------- */

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => {
      data += c;
      if (data.length > 256 * 1024) { reject(new Error('too large')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res, urlPath) {
  const rel = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);

  // Never serve dotfiles or dot-directories. Without this, running `git init` here
  // would publish .git/config to anyone who asked for it.
  if (rel.split('/').some(seg => seg.startsWith('.') && seg !== '')) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  // resolve then confirm it stayed inside ROOT -- blocks ../ traversal
  const full = path.resolve(ROOT, '.' + rel);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  const DENY = ['data.json', 'server.js', 'package.json', 'package-lock.json'];
  if (DENY.includes(path.basename(full).toLowerCase())) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(buf);
  });
}

/* ---------------- rate limiting ---------------- */

const hits = new Map();
function throttled(ip, key, limit, windowMs) {
  const k = ip + ':' + key;
  const now = Date.now();
  const rec = hits.get(k) || { n: 0, t: now };
  if (now - rec.t > windowMs) { rec.n = 0; rec.t = now; }
  rec.n++;
  hits.set(k, rec);
  return rec.n > limit;
}
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of hits) if (v.t < cutoff) hits.delete(k);
}, 60000).unref();

/* ---------------- routes ---------------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const route = url.pathname;
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

  if (!route.startsWith('/api/')) return serveStatic(req, res, route);

  if (req.method !== 'POST') return sendJSON(res, 405, { ok: false, msg: 'Use POST' });

  let body;
  try { body = await readBody(req); }
  catch (e) { return sendJSON(res, 400, { ok: false, msg: 'Bad request' }); }

  // Public, and deliberately side-effect free. Checking whether a deploy has landed
  // by trying to sign up a test name creates the account when the check fails, which
  // is how a pile of junk accounts ended up on the live leaderboard.
  if (route === '/api/health') {
    return sendJSON(res, 200, {
      ok: true,
      build: BUILD,
      storage: store.kind,
      moderated: true,
      admin: !!ADMIN_USER,
    });
  }

  // ---- auth ----
  if (route === '/api/auth/signup' || route === '/api/auth/login') {
    if (throttled(ip, 'auth', 20, 60000)) return sendJSON(res, 429, { ok: false, msg: 'Too many attempts, wait a minute' });
    const problem = route === '/api/auth/signup'
      ? validateNewPassword(body.username, body.password)
      : validateUsername(body.username);
    if (problem) return sendJSON(res, 200, { ok: false, msg: problem });
    const id = normalizeId(body.username);

    if (route === '/api/auth/signup') {
      // Screened before the taken-check on purpose: a refused name should not also
      // reveal whether somebody already holds it.
      // Only on the way in. Screening at login would lock out anyone who signed up
      // before the filter existed, which is the same mistake the password rules made.
      const rude = screenUsername(body.username);
      if (rude) return sendJSON(res, 200, { ok: false, msg: rude });
      if (getUser(id)) return sendJSON(res, 200, { ok: false, msg: 'That username is taken' });
      const salt = crypto.randomBytes(16).toString('base64');
      const hash = await hashPassword(body.password, salt, PBKDF2_ITERATIONS);
      DB.users[id] = {
        name: id.toUpperCase(), hash, salt, iterations: PBKDF2_ITERATIONS,
        created: Date.now(), save: body.save || null, friends: [], incoming: [], outgoing: [],
      };
      saveDB();
      const token = issueToken(id);
      return sendJSON(res, 200, { ok: true, token, name: DB.users[id].name, save: DB.users[id].save });
    }

    const u = getUser(id);
    if (!u) return sendJSON(res, 200, { ok: false, msg: 'No account with that username' });
    // Cheap guard so nobody can make us PBKDF2 a 200KB string 20 times a minute.
    if (String(body.password || '').length > 200) return sendJSON(res, 200, { ok: false, msg: 'Wrong password' });
    const attempt = await hashPassword(body.password, u.salt, u.iterations);
    if (attempt !== u.hash) return sendJSON(res, 200, { ok: false, msg: 'Wrong password' });
    return sendJSON(res, 200, { ok: true, token: issueToken(id), name: u.name, save: u.save });
  }

  // everything past here needs a token
  const me = userIdFromToken(body.token);
  if (!me) return sendJSON(res, 401, { ok: false, msg: 'Not signed in' });
  const meUser = ensureLists(getUser(me));

  if (route === '/api/ping') {
    lastSeen.set(me, Date.now());
    return sendJSON(res, 200, { ok: true });
  }

  // Asked once whenever the client starts up. Returns the truth about right now, so
  // a refresh mid-match puts you back at the table instead of stranding you in a
  // match the server thinks you're in and your screen knows nothing about.
  if (route === '/api/sync') {
    lastSeen.set(me, Date.now());
    notifyFriendsOfPresence(me);
    const live = matchOf(me);
    return sendJSON(res, 200, {
      ok: true,
      friends: friendPayload(me),
      match: live && !live.over ? {
        matchId: live.id,
        mode: live.mode,
        friendly: live.friendly,
        you: live.players.findIndex(p => p.id === me),
        seats: live.players.map(x => ({ name: x.name, avatar: x.avatar })),
        seconds: Math.max(1, Math.ceil((live.endsAt - Date.now()) / 1000)),
        scores: live.players.map(x => x.score),
        resync: true,
      } : null,
    });
  }

  // Held open until something happens, so events arrive as fast as a socket would
  // deliver them while still looking like an ordinary request to every proxy.
  if (route === '/api/poll') {
    const wasOffline = !isOnline(me);
    lastSeen.set(me, Date.now());
    if (wasOffline) notifyFriendsOfPresence(me);

    const queued = pending.get(me);
    if (queued && queued.length) {
      pending.set(me, []);
      return sendJSON(res, 200, { ok: true, events: queued });
    }

    const existing = waiters.get(me);            // only one poll may wait per player
    if (existing) {
      clearTimeout(existing.timer);
      waiters.delete(me);
      try { sendJSON(existing.res, 200, { ok: true, events: [] }); } catch (e) {}
    }
    const timer = setTimeout(() => {
      if (waiters.get(me)?.res !== res) return;
      waiters.delete(me);
      try { sendJSON(res, 200, { ok: true, events: [] }); } catch (e) {}
    }, POLL_HOLD_MS);
    waiters.set(me, { res, timer });
    req.on('close', () => {
      const w = waiters.get(me);
      if (w && w.res === res) { clearTimeout(w.timer); waiters.delete(me); }
    });
    return;
  }

  if (route === '/api/account/delete') {
    // Your own account, and only with the password, so a borrowed phone or a stray
    // tap can't wipe somebody's progress.
    const mine = getUser(me);
    if (!mine) return sendJSON(res, 200, { ok: false, msg: 'No such account' });
    const attempt = await hashPassword(String(body.password || ''), mine.salt, mine.iterations);
    if (attempt !== mine.hash) return sendJSON(res, 200, { ok: false, msg: 'Wrong password' });
    await removeAccount(me);
    return sendJSON(res, 200, { ok: true });
  }

  if (route === '/api/admin/users') {
    if (!isAdmin(me)) return sendJSON(res, 403, { ok: false, msg: 'Not allowed' });
    const rows = Object.entries(DB.users).map(([id, u]) => ({
      id,
      name: u.name || id.toUpperCase(),
      trophies: Math.max(0, (u.save && u.save.trophies) | 0),
      created: u.created || 0,
      online: isOnline(id),
      // Screening only runs at sign-up, so anyone who got in before the filter
      // existed is still here. Flag them rather than deleting anything
      // automatically -- a false positive would wipe a real player's progress.
      flagged: !!screenUsername(id),
    })).sort((a, b) => (b.flagged - a.flagged) || (b.created - a.created));
    return sendJSON(res, 200, { ok: true, users: rows });
  }

  // Deleting an account is not undoable, so it is deliberately narrow: only the
  // owner, never the owner's own account, and the player is dropped from any live
  // match and everyone else's friends list on the way out.
  if (route === '/api/admin/delete') {
    if (!isAdmin(me)) return sendJSON(res, 403, { ok: false, msg: 'Not allowed' });
    const target = normalizeId(body.username);
    if (!target || !getUser(target)) return sendJSON(res, 200, { ok: false, msg: 'No such account' });
    if (target === me) return sendJSON(res, 200, { ok: false, msg: "You can't delete your own account" });

    await removeAccount(target);
    return sendJSON(res, 200, { ok: true, deleted: target });
  }

  if (route === '/api/me') {
    return sendJSON(res, 200, { ok: true, name: meUser.name, save: meUser.save, admin: isAdmin(me) });
  }

  if (route === '/api/save') {
    meUser.save = body.save || null;
    saveDB();
    return sendJSON(res, 200, { ok: true });
  }

  if (route === '/api/logout') {
    forgetSession(String(body.token));
    return sendJSON(res, 200, { ok: true });
  }

  if (route === '/api/friends') {
    return sendJSON(res, 200, { ok: true, ...friendPayload(me) });
  }

  if (route === '/api/friends/request') {
    const other = normalizeId(body.username);
    if (other === me) return sendJSON(res, 200, { ok: false, msg: "You can't add yourself" });
    const ou = getUser(other);
    if (!ou) return sendJSON(res, 200, { ok: false, msg: 'No player with that username' });
    ensureLists(ou);
    if (meUser.friends.includes(other)) return sendJSON(res, 200, { ok: false, msg: 'Already friends' });
    if (meUser.outgoing.includes(other)) return sendJSON(res, 200, { ok: false, msg: 'Request already sent' });

    if (meUser.incoming.includes(other)) {          // they asked first -- accept instead
      meUser.incoming = meUser.incoming.filter(x => x !== other);
      ou.outgoing = ou.outgoing.filter(x => x !== me);
      meUser.friends.push(other);
      ou.friends.push(me);
    } else {
      meUser.outgoing.push(other);
      ou.incoming.push(me);
    }
    saveDB();
    pushFriends(me); pushFriends(other);
    return sendJSON(res, 200, { ok: true });
  }

  if (route === '/api/friends/respond') {
    const other = normalizeId(body.username);
    const ou = getUser(other);
    if (!ou) return sendJSON(res, 200, { ok: false, msg: 'No player with that username' });
    ensureLists(ou);
    if (!meUser.incoming.includes(other)) return sendJSON(res, 200, { ok: false, msg: 'No request from them' });
    meUser.incoming = meUser.incoming.filter(x => x !== other);
    ou.outgoing = ou.outgoing.filter(x => x !== me);
    if (body.accept) {
      if (!meUser.friends.includes(other)) meUser.friends.push(other);
      if (!ou.friends.includes(me)) ou.friends.push(me);
    }
    saveDB();
    pushFriends(me); pushFriends(other);
    return sendJSON(res, 200, { ok: true });
  }

  if (route === '/api/friends/remove') {
    const other = normalizeId(body.username);
    const ou = getUser(other);
    meUser.friends = meUser.friends.filter(x => x !== other);
    if (ou) { ensureLists(ou); ou.friends = ou.friends.filter(x => x !== me); }
    saveDB();
    pushFriends(me); if (ou) pushFriends(other);
    return sendJSON(res, 200, { ok: true });
  }

  // ---- leaderboard ----
  if (route === '/api/leaderboard') {
    return sendJSON(res, 200, { ok: true, ...leaderboard(me) });
  }

  // ---- invites ----
  if (route === '/api/invite/send') {
    const other = normalizeId(body.username);
    if (!meUser.friends.includes(other)) return sendJSON(res, 200, { ok: false, msg: 'You are not friends' });
    if (!isOnline(other)) return sendJSON(res, 200, { ok: false, msg: 'They are offline' });
    if (matchOf(me)) return sendJSON(res, 200, { ok: false, msg: 'You are already in a match' });
    if (matchOf(other)) return sendJSON(res, 200, { ok: false, msg: 'They are already in a match' });

    const inviteId = crypto.randomBytes(6).toString('hex');
    const inv = { from: me, to: other, at: Date.now() };
    inv.timer = setTimeout(() => cancelInvite(inviteId, 'expired'), 45000);
    invites.set(inviteId, inv);
    push(other, 'invite', { inviteId, from: meUser.name, fromId: me });
    return sendJSON(res, 200, { ok: true, inviteId });
  }

  if (route === '/api/invite/respond') {
    const inv = invites.get(String(body.inviteId));
    if (!inv || inv.to !== me) return sendJSON(res, 200, { ok: false, msg: 'That invite expired' });
    clearTimeout(inv.timer);
    invites.delete(String(body.inviteId));

    if (!body.accept) {
      push(inv.from, 'invite-declined', { by: meUser.name });
      return sendJSON(res, 200, { ok: true });
    }
    if (!isOnline(inv.from)) return sendJSON(res, 200, { ok: false, msg: 'They went offline' });
    if (matchOf(inv.from) || matchOf(me)) return sendJSON(res, 200, { ok: false, msg: 'Someone is already in a match' });
    leaveQueue(inv.from); leaveQueue(me);
    startMatch([inv.from, me], 'duel', true);   // friendly: no trophies, no XP
    return sendJSON(res, 200, { ok: true });
  }

  // ---- queue ----
  if (route === '/api/queue/join') {
    return sendJSON(res, 200, joinQueue(me, String(body.mode || 'party')));
  }

  if (route === '/api/queue/leave') {
    leaveQueue(me);
    return sendJSON(res, 200, { ok: true });
  }

  // ---- match ----
  // Spending a peek is a server decision -- the client is never told the gamble
  // card's value until it has actually paid a charge for it.
  // A peek now buys one of two different things: your own blind card, or the card an
  // opponent can see. That is the whole point of the change -- when the only option
  // was your own, spending one was always correct and there was no decision in it.
  if (route === '/api/match/peek') {
    const m = matchOf(me);
    if (!m) return sendJSON(res, 200, { ok: false, msg: 'No active match' });
    const idx = m.players.findIndex(p => p.id === me);
    const p = m.players[idx];
    if (!p || m.phase !== 'choose') return sendJSON(res, 200, { ok: false, msg: 'Not right now' });
    const active = activeIdx(m);
    if (!active.includes(idx)) return sendJSON(res, 200, { ok: false, msg: 'Not your round' });
    if (p.pick !== null) return sendJSON(res, 200, { ok: false, msg: 'Already locked in' });

    const raw = body.target;
    const target = (raw === undefined || raw === null || raw === 'self') ? idx : Number(raw);
    if (!Number.isInteger(target) || !m.players[target]) {
      return sendJSON(res, 200, { ok: false, msg: 'No such player' });
    }
    if (target !== idx && !active.includes(target)) {
      return sendJSON(res, 200, { ok: false, msg: 'They are out of this round' });
    }

    // Looking at the same thing twice in a round costs nothing extra -- it is the
    // same information, and charging for it would just punish a mis-tap.
    p.seen = p.seen || {};
    const cached = p.seen[target];
    if (cached !== undefined) {
      return sendJSON(res, 200, { ok: true, target, card: cached, peeks: p.peeks, free: true });
    }
    const cost = target === idx ? SELF_PEEK_COST : OPP_PEEK_COST;
    if (p.peeks < cost) {
      return sendJSON(res, 200, {
        ok: false,
        msg: cost > 1 ? 'Not enough peeks for that' : 'No peeks left',
      });
    }

    // Your own blind card, or the card they can see. Never their blind card: nobody
    // knows that one yet, so revealing it would tell you more than they know.
    const card = target === idx ? p.candidates[1] : m.players[target].candidates[0];

    p.peeks -= cost;
    p.seen[target] = card;
    p.peeked = true;
    // Everyone learns that a peek was spent, never what was looked at.
    m.players.forEach(x => { if (x.id && x.id !== me) push(x.id, 'peeked', { seat: idx }); });
    return sendJSON(res, 200, { ok: true, target, card, peeks: p.peeks });
  }

  if (route === '/api/match/pick') {
    const m = matchOf(me);
    if (!m) return sendJSON(res, 200, { ok: false, msg: 'No active match' });
    submitPick(m, me, Number(body.index));
    return sendJSON(res, 200, { ok: true });
  }

  // Reactions used to be drawn only on the sender's own screen, so nobody ever saw
  // the ones you sent -- including the ones bought in the shop. They go through the
  // server now, the same way a bot's do.
  if (route === '/api/match/react') {
    const m = matchOf(me);
    if (!m) return sendJSON(res, 200, { ok: false, msg: 'No active match' });
    const idx = m.players.findIndex(p => p.id === me);
    if (idx < 0) return sendJSON(res, 200, { ok: false, msg: 'Not in this match' });
    // Only the game's own emoji, so this can't be turned into a chat box.
    if (!REACTION_EMOJI.has(String(body.emoji))) {
      return sendJSON(res, 200, { ok: false, msg: 'Unknown reaction' });
    }
    if (spamming(me)) return sendJSON(res, 200, { ok: false, msg: 'Slow down' });
    m.players.forEach(x => {
      if (x.id && x.id !== me) push(x.id, 'reaction', { seat: idx, emoji: String(body.emoji) });
    });
    return sendJSON(res, 200, { ok: true });
  }

  if (route === '/api/match/leave') {
    const m = matchOf(me);
    if (m) finishMatch(m, me);
    return sendJSON(res, 200, { ok: true });
  }

  return sendJSON(res, 404, { ok: false, msg: 'Unknown endpoint' });
});

// Reap players who stopped polling, so their opponent isn't left playing a ghost.
setInterval(() => {
  const now = Date.now();
  for (const [id, seen] of [...lastSeen]) {
    if (now - seen <= STALE_MS) continue;
    lastSeen.delete(id);
    pending.delete(id);
    const w = waiters.get(id);
    if (w) {
      clearTimeout(w.timer);
      waiters.delete(id);
      try { sendJSON(w.res, 200, { ok: true, events: [] }); } catch (e) {}
    }
    leaveQueue(id);
    const m = matchOf(id);
    if (m && !m.over) finishMatch(m, id);
    notifyFriendsOfPresence(id);
  }
}, 10000).unref();

// A redeploy or an idle restart sends SIGTERM; write out anything still pending
// rather than losing the last quarter-second of play.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, async () => {
    clearTimeout(saveTimer);
    try { await flushDB(); } catch (e) { /* going down anyway */ }
    process.exit(0);
  });
}

(async () => {
  try {
    DB.users = await store.load();
  } catch (e) {
    // Starting with an empty set would tell every player their account doesn't
    // exist, and then overwrite the good rows on the first save. Refusing to start
    // is much safer -- the host restarts us and we try again.
    console.error(`Could not load accounts from ${store.kind}: ${e.message}`);
    process.exit(1);
  }
  for (const id of Object.keys(DB.users)) persisted.set(id, JSON.stringify(DB.users[id]));
  const restored = restoreSessions();

  server.listen(PORT, () => {
    console.log(`War Prize server on http://localhost:${PORT}`);
    console.log(`accounts: ${Object.keys(DB.users).length} (storage: ${store.kind}), sessions restored: ${restored}`);
  });
})();
