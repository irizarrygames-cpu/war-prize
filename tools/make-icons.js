// Generates the app icons. Run: node tools/make-icons.js
//
// The game ships no image files -- every card, arena and effect is drawn from
// shapes at runtime. Home-screen icons are the one thing that has to be a real
// PNG, so they are drawn here with the same flat vocabulary (solid fills, thick
// dark outlines) and written out with Node's own zlib. No image library.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

/* ---------------- PNG writing ---------------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function writePNG(file, size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;      // bit depth
  ihdr[9] = 6;      // truecolour with alpha
  // rows are filter-type 0 followed by the pixels
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

/* ---------------- drawing ---------------- */

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// Is (x, y) inside a rounded rectangle that has been rotated about its own centre?
function inCard(x, y, cx, cy, w, h, r, deg) {
  const a = -deg * Math.PI / 180;
  const dx = x - cx, dy = y - cy;
  const lx = dx * Math.cos(a) - dy * Math.sin(a);
  const ly = dx * Math.sin(a) + dy * Math.cos(a);
  const hw = w / 2, hh = h / 2;
  const ax = Math.abs(lx), ay = Math.abs(ly);
  if (ax > hw || ay > hh) return false;
  if (ax <= hw - r || ay <= hh - r) return true;
  const qx = ax - (hw - r), qy = ay - (hh - r);
  return qx * qx + qy * qy <= r * r;
}

// Puts a point into a card's own frame, so everything drawn on the card can be
// described in flat, upright coordinates and then tilts along with it.
function toLocal(x, y, cx, cy, deg) {
  const a = -deg * Math.PI / 180;
  const dx = x - cx, dy = y - cy;
  return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
}

// A rectangle inside that frame, optionally turned -- the two strokes of a 7.
function inBar(lx, ly, cx, cy, w, h, deg) {
  const a = -(deg || 0) * Math.PI / 180;
  const dx = lx - cx, dy = ly - cy;
  const px = dx * Math.cos(a) - dy * Math.sin(a);
  const py = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(px) <= w / 2 && Math.abs(py) <= h / 2;
}

const inEllipse = (x, y, cx, cy, rx, ry) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

// A rounded rectangle given by its corners rather than a centre -- the crest was laid
// out in SVG, where everything is x/y/width/height.
function inBox(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const ax = Math.min(x - x0, x1 - x), ay = Math.min(y - y0, y1 - y);
  if (ax >= r || ay >= r) return true;
  return (r - ax) ** 2 + (r - ay) ** 2 <= r * r;
}

// A line with round ends -- the emphasis dashes.
function inDash(x, y, ax, ay, bx, by, w) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = ((x - ax) * dx + (y - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = ax + t * dx, py = ay + t * dy;
  return (x - px) ** 2 + (y - py) ** 2 <= (w / 2) ** 2;
}

// Point in an arbitrary polygon, by ray casting. The crown is one.
function inPoly(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// One wedge of the sunburst behind the cards.
function inRay(x, y, cx, cy, fromDeg, widthDeg) {
  const a = Math.atan2(y - cy, x - cx) * 180 / Math.PI;
  return (((a - fromDeg) % 360) + 360) % 360 < widthDeg;
}

const OUTLINE = hex('#0f1320');
const NAVY = hex('#1b2333');
const NAVY_2 = hex('#232c41');
const INK = hex('#3a2400');      // the brown the game uses for text on gold
const ORANGE = hex('#ff6b2c');   // the streak colour -- the game's hot end
const EMBER  = hex('#272a35');   // burst rays: barely there, just enough to not be flat
const GREY = hex('#b9c4d4');
const GOLD_DK = hex('#c98f00');    // the question mark, so it reads as printed on the card
const GOLD = hex('#ffc93c');
const WHITE = hex('#fdfdff');

// The crown, on its own 24-unit grid so it can be dropped onto a card at any size.
const CROWN = [[2.4, 7.4], [7, 12], [12, 3.4], [17, 12], [21.6, 7.4], [21.6, 18.8], [2.4, 18.8]];

// A question mark, drawn rather than typed: there is no font rendering in here, and a
// glyph would be at the mercy of whichever face the build machine happens to have.
// Hook, stem, dot, on the same 24-unit grid.
function inQuestion(gx, gy) {
  const d2 = (ax, ay) => (gx - ax) * (gx - ax) + (gy - ay) * (gy - ay);
  const r2 = d2(12, 8.4);
  if (r2 <= 7.4 * 7.4 && r2 >= 3.9 * 3.9 && (gy <= 8.4 || gx >= 12)) return true;
  if (gx >= 10.2 && gx <= 13.8 && gy >= 12.5 && gy <= 17.4) return true;
  return d2(12, 20.6) <= 2.5 * 2.5;
}

/* The whole crest, in the same 240x176 space the in-game logo版 was laid out in:
   both cards, the trophy across their base, a coin either side, and the dashes. */
const CREST = { x0: 6, x1: 234, cy: 88 };

function crestShapes(push, S, box, cx, cy) {
  const k = box / (CREST.x1 - CREST.x0);          // crest units -> pixels
  const ox = cx - box / 2;
  const P = (u, v) => [ox + (u - CREST.x0) * k, cy + (v - CREST.cy) * k];
  // icon pixel -> crest units, which is what every test below works in
  const U = (x, y) => [CREST.x0 + (x - ox) / k, CREST.cy + (y - cy) / k];

  const ink = (test) => push(OUTLINE, test);
  const fill = (c, test) => push(c, test);

  // --- emphasis dashes ---
  const DASHES = [
    [18, 54, 44, 62], [12, 78, 40, 79], [18, 102, 44, 95],
    [222, 54, 196, 62], [228, 78, 200, 79], [222, 102, 196, 95],
  ];
  for (const [ax, ay, bx, by] of DASHES) {
    fill(GOLD, (x, y) => { const [u, v] = U(x, y); return inDash(u, v, ax, ay, bx, by, 13); });
  }

  // --- the card you cannot see ---
  const backDeg = -12, backCx = 95, backCy = 63;
  const backLocal = (x, y) => {
    const [u, v] = U(x, y);
    const a = backDeg * Math.PI / 180;
    const dx = u - backCx, dy = v - backCy;
    return [backCx + dx * Math.cos(a) + dy * Math.sin(a), backCy - dx * Math.sin(a) + dy * Math.cos(a)];
  };
  ink((x, y) => { const [u, v] = backLocal(x, y); return inBox(u, v, 61, 11, 129, 115, 14); });
  fill(WHITE, (x, y) => { const [u, v] = backLocal(x, y); return inBox(u, v, 66, 16, 124, 110, 9); });
  fill(GREY, (x, y) => {
    const [u, v] = backLocal(x, y);
    return inQuestion((u - 95) / 2.1 + 12, (v - 62) / 2.1 + 12);
  });

  // --- the prize card ---
  const frontDeg = 10, frontCx = 146, frontCy = 60;
  const frontLocal = (x, y) => {
    const [u, v] = U(x, y);
    const a = frontDeg * Math.PI / 180;
    const dx = u - frontCx, dy = v - frontCy;
    return [frontCx + dx * Math.cos(a) + dy * Math.sin(a), frontCy - dx * Math.sin(a) + dy * Math.cos(a)];
  };
  ink((x, y) => { const [u, v] = frontLocal(x, y); return inBox(u, v, 111, 7, 181, 113, 14); });
  fill(GOLD, (x, y) => { const [u, v] = frontLocal(x, y); return inBox(u, v, 116, 12, 176, 108, 9); });
  fill(INK, (x, y) => {
    const [u, v] = frontLocal(x, y);
    return inPoly(u, v, [[126, 44], [135, 54], [146, 30], [157, 54], [166, 44], [166, 66], [126, 66]])
        || inBox(u, v, 126, 71, 166, 80, 3);
  });

  // --- coins, out wide ---
  for (const coinX of [56, 184]) {
    ink((x, y) => { const [u, v] = U(x, y); return inEllipse(u, v, coinX, 138, 25, 25); });
    fill(GOLD, (x, y) => { const [u, v] = U(x, y); return inEllipse(u, v, coinX, 138, 20, 20); });
    fill(GOLD_DK, (x, y) => { const [u, v] = U(x, y); return inEllipse(u, v, coinX, 138, 9, 9); });
  }

  // --- the trophy, across the bottom of the cards ---
  // cup is a straight-sided box down to the shoulder, then a bowl; handles are ring
  // segments either side; then the stem and the foot.
  const cup = (u, v, g) => inBox(u, v, 94 - g, 91 - g, 146 + g, 110, 4)
                        || (v >= 110 && inEllipse(u, v, 120, 110, 26 + g, 24 + g));
  const handle = (u, v, hx, side, g) => {
    const d = Math.hypot(u - hx, v - 102);
    const inRing = d <= 16 + g && d >= 8 - g;
    return inRing && (side < 0 ? u <= hx : u >= hx);
  };
  const stem = (u, v, g) => inBox(u, v, 112 - g, 128 - g, 128 + g, 150 + g, 4);
  const foot = (u, v, g) => inBox(u, v, 94 - g, 147 - g, 146 + g, 163 + g, 7);

  ink((x, y) => { const [u, v] = U(x, y);
    return cup(u, v, 5) || handle(u, v, 94, -1, 5) || handle(u, v, 146, 1, 5) || stem(u, v, 5) || foot(u, v, 5); });
  fill(GOLD, (x, y) => { const [u, v] = U(x, y);
    return cup(u, v, 0) || handle(u, v, 94, -1, 0) || handle(u, v, 146, 1, 0) || stem(u, v, 0) || foot(u, v, 0); });
}

function render(size, inset) {
  // inset leaves the safe area a maskable icon needs, so Android can crop it to a
  // circle or a squircle without slicing anything important off.
  const S = size;
  const pad = S * inset;
  const box = S - pad * 2;
  const cx = S / 2, cy = S / 2;

  const shapes = [];
  const push = (c, test) => shapes.push({ c, test });

  // Faint burst, so the square is not flat behind the crest.
  for (let i = 0; i < 20; i += 2) {
    push(NAVY_2, (x, y) => inRay(x, y, cx, cy, i * 18, 18));
  }
  crestShapes(push, S, box, cx, cy);

  const out = Buffer.alloc(S * S * 4);
  const SS = 3;                     // supersampling, so the edges are not jagged
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
          let col = NAVY;
          for (const sh of shapes) if (sh.test(px, py)) col = sh.c;
          r += col[0]; g += col[1]; b += col[2];
        }
      }
      const n = SS * SS, i = (y * S + x) * 4;
      out[i] = Math.round(r / n);
      out[i + 1] = Math.round(g / n);
      out[i + 2] = Math.round(b / n);
      out[i + 3] = 255;
    }
  }
  return out;
}

const here = path.join(__dirname, '..');
const jobs = [
  ['icon-192.png', 192, 0.08],
  ['icon-512.png', 512, 0.08],
  ['icon-180.png', 180, 0.06],   // apple-touch-icon, which iOS rounds itself
  ['icon-maskable-512.png', 512, 0.18],
];
const written = [];
for (const [name, size, inset] of jobs) {
  const file = path.join(here, name);
  writePNG(file, size, render(size, inset));
  written.push(fs.readFileSync(file));
  console.log('wrote ' + name + '  ' + size + 'x' + size);
}

/* ---------------- cache busting ----------------
   Browsers cache favicons far harder than anything else -- Chrome keeps them in a
   separate store and will happily ignore Cache-Control on them -- and a phone holds
   onto an installed app's icon for as long as it likes. So a redraw shipped and
   nobody saw it: the server was serving the new bytes and every client kept drawing
   the old ones.

   The fix is to change the URL, not the headers. Every icon reference carries a short
   hash of the icon bytes themselves, stamped in here whenever they are regenerated,
   so a redraw is a different URL and a browser has no old copy of it. Redraw nothing
   and the hash does not move, so nothing is re-downloaded for no reason.

   The query string never reaches the filesystem: serveStatic resolves url.pathname,
   which does not include it. */
const stamp = crypto.createHash('sha1').update(Buffer.concat(written)).digest('hex').slice(0, 8);

for (const f of ['index.html', 'manifest.webmanifest']) {
  const p = path.join(here, f);
  const before = fs.readFileSync(p, 'utf8');
  let text = before;
  for (const [name] of jobs) {
    // drop whatever stamp is already on it, then put the current one on
    text = text.split(name + '?v=')
               .map((part, i) => (i === 0 ? part : part.replace(/^[a-f0-9]+/, '')))
               .join(name);
    text = text.split(name).join(name + '?v=' + stamp);
  }
  if (text !== before) {
    fs.writeFileSync(p, text);
    console.log('stamped ' + f + ' -> ?v=' + stamp);
  }
}
