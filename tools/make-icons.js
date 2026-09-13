// Generates the app icons. Run: node tools/make-icons.js
//
// The game ships no image files -- every card, arena and effect is drawn from
// shapes at runtime. Home-screen icons are the one thing that has to be a real
// PNG, so they are drawn here with the same flat vocabulary (solid fills, thick
// dark outlines) and written out with Node's own zlib. No image library.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

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
const GOLD = hex('#ffc93c');
const WHITE = hex('#fdfdff');

function render(size, inset) {
  // inset leaves the safe area a maskable icon needs, so Android can crop it to a
  // circle or a squircle without slicing the cards in half.
  const S = size;
  const pad = S * inset;
  const box = S - pad * 2;
  const cx = S / 2, cy = S / 2;

  // One card carries the icon and the other is just depth behind it. The previous
  // version gave two cards equal weight, stacked a number on top and put a sunburst
  // behind the lot -- four things competing inside 48 pixels, which is why it read as
  // clutter. One subject, one supporting shape, nothing else.
  const cardW = box * 0.50, cardH = box * 0.70, radius = box * 0.08;
  const lip = box * 0.058;

  const backX = cx - box * 0.17, backY = cy - box * 0.01, backDeg = -16;
  const frontX = cx + box * 0.055, frontY = cy + box * 0.015, frontDeg = 8;

  const shapes = [];

  // the card behind: face down, blank, just enough of it showing to read as a second
  shapes.push({ test: (x, y) => inCard(x, y, backX, backY, cardW + lip * 2, cardH + lip * 2, radius + lip, backDeg), c: OUTLINE });
  shapes.push({ test: (x, y) => inCard(x, y, backX, backY, cardW, cardH, radius, backDeg), c: WHITE });

  // the prize card
  shapes.push({ test: (x, y) => inCard(x, y, frontX, frontY, cardW + lip * 2, cardH + lip * 2, radius + lip, frontDeg), c: OUTLINE });
  shapes.push({ test: (x, y) => inCard(x, y, frontX, frontY, cardW, cardH, radius, frontDeg), c: GOLD });

  // A crown on it, which is what the whole game is about: this is the card you win.
  // The same shape the royal card back uses, on the game's own 24-unit grid, drawn in
  // the card's frame so it leans with the card.
  const CROWN = [[2.4, 7.4], [7, 12], [12, 3.4], [17, 12], [21.6, 7.4], [21.6, 18.8], [2.4, 18.8]];
  const g = cardW * 0.78 / 24;                    // grid units to pixels
  shapes.push({
    c: INK,
    test: (x, y) => {
      const [lx, ly] = toLocal(x, y, frontX, frontY, frontDeg);
      // centre the 24x24 grid on the card, nudged up so the band below sits inside it
      const gx = lx / g + 12, gy = ly / g + 11.2;
      return inPoly(gx, gy, CROWN) || inBar(gx, gy, 12, 20.9, 19.2, 2.6, 0);
    },
  });

  const out = Buffer.alloc(S * S * 4);
  const SS = 3;                     // supersampling, so the edges are not jagged
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let r = 0, gg = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
          let col = NAVY;
          for (const sh of shapes) if (sh.test(px, py)) col = sh.c;
          r += col[0]; gg += col[1]; b += col[2];
        }
      }
      const n = SS * SS, i = (y * S + x) * 4;
      out[i] = Math.round(r / n);
      out[i + 1] = Math.round(gg / n);
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
for (const [name, size, inset] of jobs) {
  writePNG(path.join(here, name), size, render(size, inset));
  console.log('wrote ' + name + '  ' + size + 'x' + size);
}
