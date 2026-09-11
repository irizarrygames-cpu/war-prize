// Static definitions for War Prize. No gameplay values here affect card odds --
// every cosmetic is appearance only, by design.

const CARD_MIN = 1;
const CARD_MAX = 10;

// Hidden tuning, never surfaced in the UI: the card you can SEE skews low, so the
// blind card stays tempting and the choice keeps its tension.
const KNOWN_LOW_CHANCE = 0.65;
const KNOWN_LOW_MAX = 5;

// Shown on the menu and arena list so you can see how tough the opposition gets.
const DIFFICULTY_LABELS = ['Easy', 'Easy', 'Normal', 'Normal', 'Tricky', 'Tricky', 'Hard', 'Hard', 'Brutal', 'Brutal'];
function difficultyFor(arenaN) { return DIFFICULTY_LABELS[arenaN - 1] || 'Normal'; }

const ARENAS = [
  { n: 1,  name: 'Backyard',         trophies: 0,    icon: '🏡', accent: '#5fa63f' },
  { n: 2,  name: 'School Cafeteria', trophies: 300,  icon: '🍎', accent: '#cf9a4e' },
  { n: 3,  name: 'Rooftop',          trophies: 700,  icon: '🌆', accent: '#ff9d6c' },
  { n: 4,  name: 'Pirate Ship',      trophies: 1200, icon: '🏴‍☠️', accent: '#2e97be' },
  { n: 5,  name: 'Volcano',          trophies: 1800, icon: '🌋', accent: '#ff6b2c' },
  { n: 6,  name: 'Space Station',    trophies: 2500, icon: '🚀', accent: '#6a5bd1' },
  { n: 7,  name: 'Royal Castle',     trophies: 3300, icon: '👑', accent: '#c7b8a0' },
  { n: 8,  name: 'Cyber Arena',      trophies: 4200, icon: '🤖', accent: '#31e0ff' },
  { n: 9,  name: 'The Void',         trophies: 5200, icon: '🌌', accent: '#8a4bff' },
  { n: 10, name: 'Champion Arena',   trophies: 6500, icon: '🏆', accent: '#ffc93c' },
];

const CARD_BACKS = [
  { id: 'classic',   name: 'Classic',   cost: 0    },
  { id: 'fire',      name: 'Fire',      cost: 300  },
  { id: 'ice',       name: 'Ice',       cost: 300  },
  { id: 'galaxy',    name: 'Galaxy',    cost: 500  },
  { id: 'lightning', name: 'Lightning', cost: 500  },
  { id: 'pixel',     name: 'Pixel',     cost: 400  },
  { id: 'golden',    name: 'Golden',    cost: 1200 },
  { id: 'cat',       name: 'Cat',       cost: 350  },
  { id: 'dog',       name: 'Dog',       cost: 350  },
  { id: 'alien',     name: 'Alien',     cost: 600  },
  { id: 'dragon',    name: 'Dragon',    cost: 900  },
  { id: 'pirate',    name: 'Pirate',    cost: 600  },
  { id: 'royal',     name: 'Royal',     cost: 1000 },
  { id: 'glitch',    name: 'Glitch',    cost: 800  },
  { id: 'void',      name: 'Void',      cost: 1500 },
  { id: 'rainbow',   name: 'Rainbow',   cost: 2000 },
];

const TABLES = [
  { id: 'wooden',  name: 'Wooden Table',  cost: 0    },
  { id: 'marble',  name: 'Marble Table',  cost: 400  },
  { id: 'glass',   name: 'Glass Table',   cost: 500  },
  { id: 'golden',  name: 'Golden Table',  cost: 1200 },
  { id: 'arcade',  name: 'Arcade Table',  cost: 700  },
  { id: 'ice',     name: 'Ice Table',     cost: 600  },
  { id: 'space',   name: 'Space Table',   cost: 900  },
  { id: 'lava',    name: 'Lava Table',    cost: 900  },
  { id: 'cyber',   name: 'Cyber Table',   cost: 1100 },
  { id: 'royal',   name: 'Royal Table',   cost: 1500 },
];

const TITLES = [
  { id: 'rookie',      name: 'Rookie',        cost: 0    },
  { id: 'lucky',       name: 'Lucky',         cost: 200  },
  { id: 'warrior',     name: 'Warrior',       cost: 300  },
  { id: 'prizehunter', name: 'Prize Hunter',  cost: 500  },
  { id: 'cardshark',   name: 'Card Shark',    cost: 700  },
  { id: 'collector',   name: 'The Collector', cost: 800  },
  { id: 'champion',    name: 'Champion',      cost: 1200 },
  { id: 'kingofwar',   name: 'King of War',   cost: 2000 },
  { id: 'menace',      name: 'The Menace',    cost: 900  },
  { id: 'unbeatable',  name: 'Unbeatable',    cost: 2500 },
  { id: 'luckyduck',   name: 'Lucky Duck',    cost: 450  },
];

const VICTORIES = [
  { id: 'confetti',  name: 'Confetti',     cost: 0    },
  { id: 'cardrain',  name: 'Card Rain',    cost: 600  },
  { id: 'crown',     name: 'Crown Drop',   cost: 800  },
  { id: 'fireworks', name: 'Fireworks',    cost: 1000 },
  { id: 'spotlight', name: 'Spotlight',    cost: 700  },
];

const REACTIONS = [
  { id: 'laugh', emoji: '😂', cost: 0   },
  { id: 'skull', emoji: '💀', cost: 0   },
  { id: 'cry',   emoji: '😭', cost: 0   },
  { id: 'fire',  emoji: '🔥', cost: 150 },
  { id: 'angry', emoji: '😡', cost: 150 },
  { id: 'shock', emoji: '😱', cost: 150 },
];

const CHALLENGE_POOL = [
  { id: 'win2',    text: 'Win 2 matches',                     target: 2,  coins: 150, xp: 60, stat: 'wins' },
  { id: 'play5',   text: 'Play 5 matches',                    target: 5,  coins: 120, xp: 50, stat: 'matches' },
  { id: 'prize20', text: 'Collect 20 Prize Cards',            target: 20, coins: 100, xp: 40, stat: 'prizes' },
  { id: 'prize40', text: 'Collect 40 Prize Cards',            target: 40, coins: 200, xp: 80, stat: 'prizes' },
  { id: 'lowwin',  text: 'Win a Prize Card with a 3 or lower', target: 3, coins: 180, xp: 70, stat: 'lowWins' },
  { id: 'streak3', text: 'Get a 3-match win streak',          target: 1,  coins: 250, xp: 100, stat: 'streak3' },
  { id: 'sudden',  text: 'Reach Sudden Death',                target: 1,  coins: 150, xp: 60, stat: 'sudden' },
  { id: 'win1',    text: 'Win a match',                       target: 1,  coins: 80,  xp: 30, stat: 'wins' },
];

// Match sizes. `seats` maps each player index onto a seat slot in the table grid
// (0 bottom, 1 left, 2 top, 3 right) so smaller tables stay visually balanced.
const MODES = {
  duel:  { key: 'duel',  label: '1v1',   sub: 'Head to head', players: 2, seats: [0, 2],
           trophies: [30, -18],           coins: [45, 12] },
  trio:  { key: 'trio',  label: '1v1v1', sub: 'Three way',    players: 3, seats: [0, 1, 3],
           trophies: [30, -10, -18],      coins: [42, 18, 9] },
  party: { key: 'party', label: '4 PLAYER', sub: 'Full table', players: 4, seats: [0, 1, 2, 3],
           trophies: [30, -6, -12, -18],  coins: [40, 22, 14, 8] },
};
const MODE_ORDER = ['duel', 'trio', 'party'];
function modeOf(key) { return MODES[key] || MODES.party; }

function arenaFor(trophies) {
  let a = ARENAS[0];
  for (const ar of ARENAS) if (trophies >= ar.trophies) a = ar;
  return a;
}

function xpForLevel(level) {
  return 100 + (level - 1) * 45;
}

// Achievements. Daily challenges give you a reason to play today; these are the
// long game -- one-offs you earn once and keep. Each is a plain predicate over the
// save plus whatever just happened, so adding one never means touching the engine.
const ACHIEVEMENTS = [
  { id: 'first_win',   name: 'First Blood',     desc: 'Win your first match',              coins: 100, test: (s) => s.wins >= 1 },
  { id: 'win_10',      name: 'Regular',         desc: 'Win 10 matches',                    coins: 200, test: (s) => s.wins >= 10 },
  { id: 'win_50',      name: 'Veteran',         desc: 'Win 50 matches',                    coins: 600, test: (s) => s.wins >= 50 },
  { id: 'streak_3',    name: 'Hat Trick',       desc: 'Win 3 matches in a row',            coins: 150, test: (s) => s.bestStreak >= 3 },
  { id: 'streak_10',   name: 'Unstoppable',     desc: 'Win 10 matches in a row',           coins: 800, test: (s) => s.bestStreak >= 10 },
  { id: 'played_50',   name: 'Committed',       desc: 'Play 50 matches',                   coins: 250, test: (s) => s.matches >= 50 },
  { id: 'prizes_100',  name: 'Collector',       desc: 'Win 100 Prize Cards',               coins: 400, test: (s) => s.prizeCards >= 100 },
  { id: 'arena_3',     name: 'Rooftop Regular', desc: 'Reach Arena 3',                     coins: 200, test: (s) => arenaFor(s.highestTrophies).n >= 3 },
  { id: 'arena_6',     name: 'Sky High',        desc: 'Reach Arena 6',                     coins: 500, test: (s) => arenaFor(s.highestTrophies).n >= 6 },
  { id: 'arena_10',    name: 'Champion',        desc: 'Reach Arena 10',                    coins: 1500, test: (s) => arenaFor(s.highestTrophies).n >= 10 },
  { id: 'level_10',    name: 'Seasoned',        desc: 'Reach level 10',                    coins: 300, test: (s) => s.level >= 10 },
  { id: 'level_25',    name: 'Old Hand',        desc: 'Reach level 25',                    coins: 900, test: (s) => s.level >= 25 },
  { id: 'rich',        name: 'Loaded',          desc: 'Hold 5,000 coins at once',          coins: 300, test: (s) => s.coins >= 5000 },

  // These need to know what just happened, not only the totals.
  { id: 'low_win',     name: 'Cheeky',          desc: 'Win a round with a 1 or a 2',       coins: 250, test: (s, e) => e.lowCard },
  { id: 'big_pot',     name: 'Jackpot',         desc: 'Take a pot of 3 or more at once',   coins: 350, test: (s, e) => e.bigPot },
  { id: 'sudden',      name: 'Nerves of Steel', desc: 'Win in Sudden Death',               coins: 400, test: (s, e) => e.suddenWin },
  { id: 'spy',         name: 'Spy',             desc: 'Peek at an opponent and win that round', coins: 300, test: (s, e) => e.spyWin },
  { id: 'no_peeks',    name: 'Blind Faith',     desc: 'Win a match without peeking once',  coins: 350, test: (s, e) => e.wonWithoutPeeking },
];

function achievementById(id) { return ACHIEVEMENTS.find(a => a.id === id); }
