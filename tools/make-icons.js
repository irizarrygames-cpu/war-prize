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

const OUTLINE = hex('#0f1320');
const NAVY = hex('#1b2333');
const GOLD = hex('#ffc93c');
const WHITE = hex('#fdfdff');

function render(size, inset) {
  // inset leaves the safe area a maskable icon needs, so Android can crop it to a
  // circle or a squircle without slicing the cards in half.
  const S = size;
  const pad = S * inset;
  const box = S - pad * 2;
  const cx = S / 2, cy = S / 2;

  const cardW = box * 0.46, cardH = box * 0.66, radius = box * 0.07;
  const lip = box * 0.055;          // thickness of the dark outline

  const shapes = [
    // back card, tilted left
    { test: (x, y) => inCard(x, y, cx - box * 0.13, cy, cardW + lip * 2, cardH + lip * 2, radius + lip, -14), c: OUTLINE },
    { test: (x, y) => inCard(x, y, cx - box * 0.13, cy, cardW, cardH, radius, -14), c: WHITE },
    // front card, tilted right
    { test: (x, y) => inCard(x, y, cx + box * 0.13, cy + box * 0.02, cardW + lip * 2, cardH + lip * 2, radius + lip, 12), c: OUTLINE },
    { test: (x, y) => inCard(x, y, cx + box * 0.13, cy + box * 0.02, cardW, cardH, radius, 12), c: GOLD },
  ];

  const out = Buffer.alloc(S * S * 4);
  const SS = 3;                     // supersampling, so the edges are not jagged
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
          let col = NAVY;
          for (const s of shapes) if (s.test(px, py)) col = s.c;
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
for (const [name, size, inset] of jobs) {
  writePNG(path.join(here, name), size, render(size, inset));
  console.log('wrote ' + name + '  ' + size + 'x' + size);
}
