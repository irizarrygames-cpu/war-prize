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
const GREY = hex('#b9c4d4');    // the question mark, so it reads as printed on the card
const GOLD = hex('#ffc93c');
const WHITE = hex('#fdfdff');

// The crown, on its own 24-unit grid so it can be dropped onto a card at any size.
const CROWN = [[2.4, 7.4], [7, 12], [12, 3.4], [17, 12], [21.6, 7.4], [21.6, 18.8], [2.4, 18.8]];

// A question mark, drawn rather than typed: no font rendering in here, and a glyph
// would be at the mercy of whatever face the machine building this happens to have.
// Hook, then the dot. Same 24-unit grid as the crown.
function inQuestion(gx, gy) {
  const d2 = (ax, ay) => (gx - ax) * (gx - ax) + (gy - ay) * (gy - ay);
  // the ring of the hook, upper half and right side only
  const ringOuter = 7.4, ringInner = 3.9;
  const r2 = d2(12, 8.4);
  const onRing = r2 <= ringOuter * ringOuter && r2 >= ringInner * ringInner;
  if (onRing && (gy <= 8.4 || gx >= 12)) return true;
  // the stem dropping from the ring down to the dot
  if (gx >= 10.2 && gx <= 13.8 && gy >= 12.5 && gy <= 17.4) return true;
  // the dot
  if (d2(12, 20.6) <= 2.5 * 2.5) return true;
  return false;
}

function render(size, inset) {
  // inset leaves the safe area a maskable icon needs, so Android can crop it to a
  // circle or a squircle without slicing anything important off.
  const S = size;
  const pad = S * inset;
  const box = S - pad * 2;
  const cx = S / 2, cy = S / 2;

  const shapes = [];

  // Faint burst, so the square is not flat behind the cards.
  for (let i = 0; i < 20; i += 2) {
    shapes.push({ test: (x, y) => inRay(x, y, cx, cy, i * 18, 18), c: NAVY_2 });
  }

  // The two cards of the actual decision, fanned the way the logo has them: the one
  // you cannot see, and the prize. The trophy and coins from the full lockup are left
  // out on purpose -- six objects inside 48 pixels is a smudge, and these two are the
  // ones that carry the game.
  const cardW = box * 0.38, cardH = box * 0.54, radius = box * 0.065;
  const lip = box * 0.046;

  const back  = { x: cx - box * 0.145, y: cy - box * 0.01, deg: -15 };
  const front = { x: cx + box * 0.125, y: cy + box * 0.015, deg: 12 };

  // emphasis dashes, out beyond the cards
  const dash = (ax, ay, bx, by) => ({
    c: GOLD,
    test: (x, y) => {
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy), deg = Math.atan2(dy, dx) * 180 / Math.PI;
      return inBar(x, y, mx, my, len, box * 0.046, deg);
    },
  });
  const dx0 = box * 0.485, dx1 = box * 0.39;
  shapes.push(dash(cx - dx0, cy - box * 0.20, cx - dx1, cy - box * 0.14));
  shapes.push(dash(cx - dx0 - box * 0.02, cy, cx - dx1, cy));
  shapes.push(dash(cx - dx0, cy + box * 0.20, cx - dx1, cy + box * 0.14));
  shapes.push(dash(cx + dx0, cy - box * 0.20, cx + dx1, cy - box * 0.14));
  shapes.push(dash(cx + dx0 + box * 0.02, cy, cx + dx1, cy));
  shapes.push(dash(cx + dx0, cy + box * 0.20, cx + dx1, cy + box * 0.14));

  // the blind card, with a question mark on it
  shapes.push({ test: (x, y) => inCard(x, y, back.x, back.y, cardW + lip * 2, cardH + lip * 2, radius + lip, back.deg), c: OUTLINE });
  shapes.push({ test: (x, y) => inCard(x, y, back.x, back.y, cardW, cardH, radius, back.deg), c: WHITE });
  const qg = cardW * 0.66 / 24;
  shapes.push({
    c: GREY,
    test: (x, y) => {
      const [lx, ly] = toLocal(x, y, back.x, back.y, back.deg);
      // sits left of centre on the card, since the prize card overlaps its right edge
      return inQuestion(lx / qg + 12 + 3.4, ly / qg + 12);
    },
  });

  // the prize card, with the crown
  shapes.push({ test: (x, y) => inCard(x, y, front.x, front.y, cardW + lip * 2, cardH + lip * 2, radius + lip, front.deg), c: OUTLINE });
  shapes.push({ test: (x, y) => inCard(x, y, front.x, front.y, cardW, cardH, radius, front.deg), c: GOLD });
  const cg = cardW * 0.70 / 24;
  shapes.push({
    c: INK,
    test: (x, y) => {
      const [lx, ly] = toLocal(x, y, front.x, front.y, front.deg);
      const gx = lx / cg + 12, gy = ly / cg + 11.2;
      return inPoly(gx, gy, CROWN) || inBar(gx, gy, 12, 20.9, 19.2, 2.6, 0);
    },
  });

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
