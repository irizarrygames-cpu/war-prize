// Generates the Play Store feature graphic. Run: node tools/make-store-art.js
//
// Google wants a 1024x500 banner for the listing. Same approach as make-icons.js --
// flat shapes, solid fills, thick dark outlines, written out with Node's own zlib,
// no image library. Deliberately no lettering: the store draws the app name and icon
// over this artwork itself, and anything written here would end up doubled up or
// covered. The cards carry it instead.

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

// Unlike the icon writer this one takes a width and a height -- a banner is not square.
function writePNG(file, w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;      // bit depth
  ihdr[9] = 6;      // truecolour with alpha
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;                                  // filter type 0
    rgba.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4);
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

const OUTLINE = hex('#0f1320');
const NAVY    = hex('#1b2333');
const NAVY_2  = hex('#232c41');
const GOLD    = hex('#ffc93c');
const GOLD_DK = hex('#c98f00');
const WHITE   = hex('#fdfdff');
const BLUE    = hex('#3d7bff');
const PURPLE  = hex('#b06bff');

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

const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

// A ray of the sunburst behind the cards: the wedge between two angles.
function inRay(x, y, cx, cy, fromDeg, widthDeg) {
  let a = Math.atan2(y - cy, x - cx) * 180 / Math.PI;
  let d = ((a - fromDeg) % 360 + 360) % 360;
  return d < widthDeg;
}

const W = 1024, H = 500;

function render() {
  const cx = W * 0.5, cy = H * 0.54;
  // Sized so the whole fan, tilt included, sits inside the frame with room to
  // breathe. The store crops the edges of this banner on some screens, so nothing
  // that matters goes near them.
  const cardW = H * 0.30, cardH = H * 0.44, radius = H * 0.035;
  const lip = H * 0.026;

  const shapes = [];

  // Sunburst, the same device the main menu uses behind the logo. Alternating wedges
  // one shade off the background -- a pattern, not a glow.
  for (let i = 0; i < 24; i += 2) {
    shapes.push({ test: (x, y) => inRay(x, y, cx, cy, i * 15, 15), c: NAVY_2 });
  }

  // A scatter of prize cards fanning out behind, to say "there is a pot to win".
  const fan = [
    { dx: -0.155, dy: 0.045, deg: -30, c: GOLD_DK, s: 0.84 },
    { dx:  0.155, dy: 0.045, deg:  30, c: GOLD_DK, s: 0.84 },
    { dx: -0.088, dy: 0.000, deg: -16, c: BLUE,    s: 0.92 },
    { dx:  0.088, dy: 0.000, deg:  16, c: PURPLE,  s: 0.92 },
  ];
  for (const f of fan) {
    const fx = cx + W * f.dx, fy = cy + H * f.dy;
    const w = cardW * f.s, h = cardH * f.s;
    shapes.push({ test: (x, y) => inCard(x, y, fx, fy, w + lip * 2, h + lip * 2, radius + lip, f.deg), c: OUTLINE });
    shapes.push({ test: (x, y) => inCard(x, y, fx, fy, w, h, radius, f.deg), c: f.c });
  }

  // The two cards from the icon, front and centre: the one you can see, and the one
  // you are gambling on.
  shapes.push({ test: (x, y) => inCard(x, y, cx - W * 0.030, cy - H * 0.015, cardW + lip * 2, cardH + lip * 2, radius + lip, -7), c: OUTLINE });
  shapes.push({ test: (x, y) => inCard(x, y, cx - W * 0.030, cy - H * 0.015, cardW, cardH, radius, -7), c: WHITE });
  shapes.push({ test: (x, y) => inCard(x, y, cx + W * 0.030, cy - H * 0.005, cardW + lip * 2, cardH + lip * 2, radius + lip, 7), c: OUTLINE });
  shapes.push({ test: (x, y) => inCard(x, y, cx + W * 0.030, cy - H * 0.005, cardW, cardH, radius, 7), c: GOLD });

  // A coin either side, well inside the safe area -- the store crops the edges of
  // this banner on some screens.
  for (const sx of [-1, 1]) {
    const px = cx + sx * W * 0.285, py = cy - H * 0.13, r = H * 0.072;
    shapes.push({ test: (x, y) => inCircle(x, y, px, py, r + lip * 0.8), c: OUTLINE });
    shapes.push({ test: (x, y) => inCircle(x, y, px, py, r), c: GOLD });
    shapes.push({ test: (x, y) => inCircle(x, y, px, py, r * 0.58), c: GOLD_DK });
  }

  const out = Buffer.alloc(W * H * 4);
  const SS = 3;                                    // supersample so edges stay clean
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
          let col = NAVY;
          for (const s of shapes) if (s.test(px, py)) col = s.c;
          r += col[0]; g += col[1]; b += col[2];
        }
      }
      const n = SS * SS, i = (y * W + x) * 4;
      out[i] = Math.round(r / n);
      out[i + 1] = Math.round(g / n);
      out[i + 2] = Math.round(b / n);
      out[i + 3] = 255;                            // the store wants it fully opaque
    }
  }
  return out;
}

const dir = path.join(__dirname, '..', 'store');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'feature-graphic-1024x500.png');
writePNG(file, W, H, render());
console.log('wrote ' + file + '  (' + W + 'x' + H + ', ' + fs.statSync(file).size + ' bytes)');
