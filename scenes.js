// Arena backdrops. Every arena gets its own scene so the menu looks like the place
// you're actually fighting in, and you can tell at a glance that you moved up.
//
// Two rules from the rest of the art carry over: solid fills with thick dark
// outlines, and nothing that fakes depth -- no gradients as shading, no blurs, no
// glows. Shapes only.
//
// Scenes are built from separately positioned props rather than one big SVG,
// because a single image cropped to fit would lose the horizon on a phone in
// portrait and lose the landmark on a wide window. Positioning each piece by
// viewport percentage keeps the composition readable at any shape.

const OUT = '#0f1320';

// Points for a spiky disc -- suns, sparkles, stars.
function starPts(cx, cy, ro, ri, n, rot = -90) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    const r = i % 2 ? ri : ro;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return pts.join(' ');
}

// A prop is drawn twice: once as a fat dark silhouette, then the colours on top.
// Doing it that way means overlapping shapes (a cloud built from four circles)
// get one clean outline around the whole thing instead of seams through it.
// A layer with `o` also gets its own outline, for details like windows.
function buildSVG(a) {
  const sil = a.layers.map(l => l.s).join('');
  const fills = a.layers
    .map(l => `<g fill="${l.f}"${l.o ? ` stroke="${OUT}" stroke-width="${l.o}" stroke-linejoin="round" stroke-linecap="round"` : ''}>${l.s}</g>`)
    .join('');
  const par = a.band ? 'none' : 'xMidYMid meet';
  return `<svg viewBox="${a.vb}" preserveAspectRatio="${par}" aria-hidden="true">` +
         `<g class="sil">${sil}</g>${fills}</svg>`;
}

/* ================= art library ================= */
// vb: viewBox.  w: base width in vmin (scaled per placement).  band: full-width strip.

const ART = {
  /* ---- sky ---- */
  sun: { vb: '0 0 120 120', w: 22, layers: [
    { s: `<polygon points="${starPts(60, 60, 58, 41, 12)}"/>`, f: '#ffd75e' },
    { s: `<circle cx="60" cy="60" r="35"/>`, f: '#ffc93c', o: 5 },
  ] },

  sunLow: { vb: '0 0 120 120', w: 30, layers: [
    { s: `<circle cx="60" cy="60" r="54"/>`, f: '#ffd75e' },
    { s: `<rect x="0" y="46" width="120" height="9" rx="4"/><rect x="0" y="66" width="120" height="9" rx="4"/><rect x="0" y="86" width="120" height="9" rx="4"/>`, f: '#ff9d3d' },
  ] },

  moon: { vb: '0 0 110 110', w: 14, layers: [
    { s: `<circle cx="55" cy="55" r="48"/>`, f: '#e8ecff' },
    { s: `<circle cx="38" cy="40" r="11"/><circle cx="70" cy="63" r="8"/><circle cx="46" cy="76" r="6"/>`, f: '#b8c2e0' },
  ] },

  cloud: { vb: '0 0 152 78', w: 30, layers: [
    { s: `<circle cx="44" cy="36" r="26"/><circle cx="82" cy="28" r="32"/><circle cx="118" cy="40" r="22"/><rect x="36" y="40" width="92" height="28" rx="12"/>`, f: '#ffffff' },
  ] },

  bird: { vb: '0 0 100 40', w: 8, layers: [
    { s: `<path d="M4 26 C 18 6, 32 6, 50 24 C 68 6, 82 6, 96 26 C 80 16, 66 18, 50 32 C 34 18, 20 16, 4 26 Z"/>`, f: '#2b3550' },
  ] },

  starDot: { vb: '0 0 40 40', w: 3, layers: [
    { s: `<polygon points="${starPts(20, 20, 18, 6, 4)}"/>`, f: '#ffffff' },
  ] },

  /* ---- arena 1, backyard ---- */
  hills: { vb: '0 0 400 110', band: true, layers: [
    { s: `<path d="M0 110 L0 62 C 44 24, 98 28, 134 62 C 172 22, 216 18, 254 58 C 296 20, 350 28, 400 66 L400 110 Z"/>`, f: '#3f7a32' },
  ] },

  house: { vb: '0 0 150 136', w: 27, layers: [
    { s: `<rect x="24" y="60" width="102" height="66" rx="5"/><polygon points="75,10 142,64 8,64"/><rect x="100" y="18" width="18" height="30" rx="4"/>`, f: '#e8564a' },
    { s: `<polygon points="75,10 142,64 8,64"/><rect x="100" y="18" width="18" height="30" rx="4"/>`, f: '#b8352c' },
    { s: `<rect x="60" y="86" width="30" height="40" rx="4"/>`, f: '#6b3a1e', o: 5 },
    { s: `<rect x="32" y="74" width="20" height="20" rx="4"/><rect x="98" y="74" width="20" height="20" rx="4"/>`, f: '#ffe27a', o: 5 },
  ] },

  tree: { vb: '0 0 120 150', w: 20, layers: [
    { s: `<rect x="52" y="78" width="18" height="66" rx="4"/><circle cx="61" cy="52" r="42"/><circle cx="30" cy="70" r="26"/><circle cx="92" cy="70" r="26"/>`, f: '#2f8f3a' },
    { s: `<rect x="52" y="78" width="18" height="66" rx="4"/>`, f: '#6b3a1e' },
  ] },

  bush: { vb: '0 0 120 70', w: 13, layers: [
    { s: `<circle cx="34" cy="40" r="26"/><circle cx="66" cy="30" r="30"/><circle cx="94" cy="44" r="22"/><rect x="26" y="42" width="76" height="24" rx="8"/>`, f: '#37a344' },
  ] },

  fence: { vb: '0 0 200 90', w: 26, layers: [
    { s: `<rect x="6" y="16" width="20" height="70" rx="5"/><rect x="46" y="16" width="20" height="70" rx="5"/><rect x="86" y="16" width="20" height="70" rx="5"/><rect x="126" y="16" width="20" height="70" rx="5"/><rect x="166" y="16" width="20" height="70" rx="5"/><rect x="0" y="34" width="196" height="13" rx="5"/><rect x="0" y="62" width="196" height="13" rx="5"/>`, f: '#c98f4f' },
  ] },

  /* ---- arena 2, school cafeteria ---- */
  bunting: { vb: '0 0 400 60', band: true, layers: [
    { s: `<rect x="0" y="8" width="400" height="7" rx="3"/>`, f: '#4a3320' },
    { s: `<polygon points="10,12 50,12 30,52"/><polygon points="90,12 130,12 110,52"/><polygon points="170,12 210,12 190,52"/><polygon points="250,12 290,12 270,52"/><polygon points="330,12 370,12 350,52"/>`, f: '#e8564a' },
    { s: `<polygon points="50,12 90,12 70,52"/><polygon points="130,12 170,12 150,52"/><polygon points="210,12 250,12 230,52"/><polygon points="290,12 330,12 310,52"/>`, f: '#3d7bff' },
  ] },

  lockers: { vb: '0 0 150 190', w: 26, layers: [
    { s: `<rect x="8" y="8" width="134" height="178" rx="7"/>`, f: '#3d7bff' },
    { s: `<rect x="18" y="18" width="52" height="158" rx="5"/><rect x="80" y="18" width="52" height="158" rx="5"/>`, f: '#2450c8', o: 5 },
    { s: `<rect x="28" y="30" width="32" height="7" rx="3"/><rect x="28" y="44" width="32" height="7" rx="3"/><rect x="90" y="30" width="32" height="7" rx="3"/><rect x="90" y="44" width="32" height="7" rx="3"/><circle cx="60" cy="96" r="6"/><circle cx="122" cy="96" r="6"/>`, f: '#1a2b5e' },
  ] },

  vending: { vb: '0 0 130 200', w: 24, layers: [
    { s: `<rect x="8" y="8" width="114" height="188" rx="8"/>`, f: '#e8564a' },
    { s: `<rect x="18" y="20" width="66" height="130" rx="5"/>`, f: '#8fd8f0', o: 5 },
    { s: `<circle cx="34" cy="46" r="9"/><circle cx="56" cy="46" r="9"/><circle cx="34" cy="82" r="9"/><circle cx="56" cy="82" r="9"/><circle cx="34" cy="118" r="9"/><circle cx="56" cy="118" r="9"/>`, f: '#ffc93c' },
    { s: `<rect x="94" y="24" width="18" height="52" rx="5"/><rect x="18" y="160" width="66" height="24" rx="5"/>`, f: '#7a1f18' },
  ] },

  lunchTable: { vb: '0 0 220 120', w: 32, layers: [
    { s: `<rect x="8" y="10" width="204" height="26" rx="9"/><rect x="48" y="36" width="22" height="66" rx="7"/><rect x="150" y="36" width="22" height="66" rx="7"/><rect x="0" y="62" width="58" height="22" rx="9"/><rect x="162" y="62" width="58" height="22" rx="9"/>`, f: '#c98f4f' },
    { s: `<rect x="8" y="10" width="204" height="10" rx="5"/>`, f: '#e0b071' },
  ] },

  tray: { vb: '0 0 140 90', w: 15, layers: [
    { s: `<rect x="6" y="10" width="128" height="70" rx="12"/>`, f: '#8fd8f0' },
    { s: `<rect x="18" y="22" width="46" height="46" rx="7"/><rect x="74" y="22" width="46" height="20" rx="6"/><rect x="74" y="48" width="46" height="20" rx="6"/>`, f: '#5aa8c4', o: 5 },
  ] },

  milk: { vb: '0 0 80 120', w: 8, layers: [
    { s: `<rect x="10" y="34" width="60" height="78" rx="5"/><polygon points="10,36 40,6 70,36"/>`, f: '#ffffff' },
    { s: `<rect x="22" y="54" width="36" height="34" rx="4"/>`, f: '#3d7bff' },
  ] },

  clock: { vb: '0 0 110 110', w: 12, layers: [
    { s: `<circle cx="55" cy="55" r="46"/>`, f: '#f0f2f8' },
    { s: `<circle cx="55" cy="55" r="36"/>`, f: '#ffffff', o: 5 },
    { s: `<rect x="51" y="28" width="8" height="30" rx="4"/><rect x="53" y="51" width="30" height="8" rx="4"/>`, f: '#0f1320' },
  ] },

  /* ---- arena 3, rooftop ---- */
  skyline: { vb: '0 0 400 130', band: true, layers: [
    { s: `<rect x="0" y="46" width="54" height="84"/><rect x="60" y="18" width="42" height="112"/><rect x="108" y="60" width="60" height="70"/><rect x="174" y="30" width="46" height="100"/><rect x="226" y="66" width="52" height="64"/><rect x="284" y="24" width="40" height="106"/><rect x="330" y="54" width="70" height="76"/>`, f: '#3a2e58' },
    { s: `<rect x="12" y="60" width="12" height="14"/><rect x="32" y="60" width="12" height="14"/><rect x="70" y="34" width="12" height="14"/><rect x="70" y="60" width="12" height="14"/><rect x="120" y="76" width="12" height="14"/><rect x="142" y="76" width="12" height="14"/><rect x="186" y="46" width="12" height="14"/><rect x="186" y="72" width="12" height="14"/><rect x="240" y="82" width="12" height="14"/><rect x="294" y="40" width="12" height="14"/><rect x="294" y="66" width="12" height="14"/><rect x="346" y="70" width="12" height="14"/><rect x="368" y="70" width="12" height="14"/>`, f: '#ffc93c' },
  ] },

  waterTower: { vb: '0 0 130 180', w: 22, layers: [
    { s: `<rect x="24" y="96" width="12" height="76" rx="5"/><rect x="94" y="96" width="12" height="76" rx="5"/><rect x="20" y="126" width="90" height="10" rx="4"/><rect x="18" y="40" width="94" height="66" rx="8"/><polygon points="65,4 116,44 14,44"/>`, f: '#8a5a3a' },
    { s: `<rect x="18" y="64" width="94" height="9" rx="4"/><rect x="18" y="86" width="94" height="9" rx="4"/>`, f: '#5e3a22' },
  ] },

  antennaMast: { vb: '0 0 110 190', w: 18, layers: [
    { s: `<polygon points="46,6 64,6 84,182 26,182"/>`, f: '#5a6480' },
    { s: `<rect x="20" y="70" width="70" height="9" rx="4"/><rect x="14" y="118" width="82" height="9" rx="4"/><rect x="46" y="6" width="18" height="176"/>`, f: '#3a4258' },
    { s: `<circle cx="55" cy="30" r="12"/>`, f: '#ff4d6d' },
  ] },

  acUnit: { vb: '0 0 140 100', w: 17, layers: [
    { s: `<rect x="8" y="18" width="124" height="74" rx="8"/>`, f: '#8a93ad' },
    { s: `<circle cx="70" cy="55" r="26"/>`, f: '#5a6480', o: 5 },
    { s: `<rect x="66" y="30" width="8" height="50" rx="4"/><rect x="45" y="51" width="50" height="8" rx="4"/>`, f: '#3a4258' },
  ] },

  /* ---- arena 4, pirate ship ---- */
  waves: { vb: '0 0 400 80', band: true, layers: [
    { s: `<path d="M0 80 L0 34 C 30 12, 62 12, 92 32 C 122 52, 152 52, 182 32 C 212 12, 244 12, 274 32 C 304 52, 336 52, 366 32 C 380 23, 392 22, 400 26 L400 80 Z"/>`, f: '#2c86b0' },
  ] },

  ship: { vb: '0 0 240 230', w: 46, layers: [
    { s: `<rect x="112" y="14" width="14" height="150" rx="5"/><path d="M20 158 L220 158 L188 216 L52 216 Z"/>`, f: '#8a5a3a' },
    { s: `<path d="M126 26 C 178 46, 186 84, 126 104 Z"/><path d="M112 34 C 62 52, 58 88, 112 108 Z"/><path d="M126 116 C 184 136, 190 166, 126 152 Z"/>`, f: '#f4f1e4', o: 5 },
    { s: `<rect x="20" y="150" width="200" height="18" rx="7"/>`, f: '#5e3a22' },
    { s: `<circle cx="72" cy="184" r="11"/><circle cx="110" cy="186" r="11"/><circle cx="148" cy="184" r="11"/>`, f: '#3a2416' },
    { s: `<polygon points="126,14 176,26 126,38"/>`, f: '#1b2333', o: 5 },
  ] },

  island: { vb: '0 0 190 130', w: 30, layers: [
    { s: `<path d="M6 124 C 20 92, 62 84, 95 86 C 132 84, 172 94, 184 124 Z"/>`, f: '#e0c477' },
    { s: `<rect x="88" y="42" width="13" height="52" rx="5"/><path d="M94 40 C 62 26, 44 40, 40 56 C 58 44, 78 46, 94 54 Z"/><path d="M94 40 C 126 26, 146 40, 150 56 C 132 44, 112 46, 94 54 Z"/><path d="M94 36 C 88 12, 100 4, 116 4 C 104 12, 100 22, 100 38 Z"/>`, f: '#2f8f3a' },
    { s: `<rect x="88" y="42" width="13" height="52" rx="5"/>`, f: '#8a5a3a' },
  ] },

  barrel: { vb: '0 0 110 130', w: 13, layers: [
    { s: `<path d="M14 14 L96 14 C 104 46, 104 84, 96 116 L14 116 C 6 84, 6 46, 14 14 Z"/>`, f: '#a9702f' },
    { s: `<rect x="6" y="36" width="98" height="12" rx="5"/><rect x="6" y="82" width="98" height="12" rx="5"/>`, f: '#5e3a22' },
  ] },

  chest: { vb: '0 0 140 110', w: 16, layers: [
    { s: `<rect x="10" y="48" width="120" height="54" rx="7"/><path d="M10 50 C 10 16, 130 16, 130 50 Z"/>`, f: '#a9702f' },
    { s: `<rect x="4" y="44" width="132" height="14" rx="6"/>`, f: '#5e3a22' },
    { s: `<rect x="58" y="52" width="24" height="26" rx="5"/>`, f: '#ffc93c', o: 5 },
  ] },

  /* ---- arena 5, volcano ---- */
  volcano: { vb: '0 0 260 190', w: 52, layers: [
    { s: `<polygon points="96,18 164,18 250,182 10,182"/>`, f: '#4a2320' },
    { s: `<path d="M96 18 L164 18 L176 40 L150 34 L128 48 L108 36 L84 42 Z"/><path d="M118 30 C 112 78, 96 120, 88 182 L136 182 C 132 118, 138 70, 142 30 Z"/>`, f: '#ff6b2c' },
    { s: `<path d="M104 22 L156 22 L164 36 L142 30 L124 42 L110 32 Z"/>`, f: '#ffc93c' },
  ] },

  lavaBand: { vb: '0 0 400 70', band: true, layers: [
    { s: `<path d="M0 70 L0 26 C 34 6, 70 6, 104 26 C 138 46, 172 46, 206 26 C 240 6, 276 6, 310 26 C 340 43, 372 43, 400 28 L400 70 Z"/>`, f: '#ff8a3d' },
  ] },

  spire: { vb: '0 0 110 170', w: 18, layers: [
    { s: `<polygon points="54,6 84,72 74,164 30,164 24,70"/>`, f: '#3a2020' },
    { s: `<polygon points="54,6 70,52 44,58"/>`, f: '#5a3430' },
  ] },

  deadTree: { vb: '0 0 140 170', w: 22, layers: [
    { s: `<rect x="58" y="60" width="20" height="104" rx="6"/><polygon points="66,74 20,32 30,60 58,90"/><polygon points="76,68 122,20 114,52 84,84"/><polygon points="70,110 26,90 40,112 66,124"/>`, f: '#2e1c18' },
  ] },

  boulder: { vb: '0 0 130 90', w: 15, layers: [
    { s: `<polygon points="10,84 26,30 62,10 106,26 122,66 110,84"/>`, f: '#4a2c28' },
    { s: `<polygon points="26,30 62,10 74,34 44,46"/>`, f: '#63403a' },
  ] },

  ember: { vb: '0 0 30 30', w: 2.4, layers: [
    { s: `<circle cx="15" cy="15" r="13"/>`, f: '#ffc93c' },
  ] },

  /* ---- arena 6, space station ---- */
  planet: { vb: '0 0 200 150', w: 34, layers: [
    { s: `<circle cx="100" cy="72" r="60"/>`, f: '#6a5bd1' },
    { s: `<circle cx="76" cy="52" r="16"/><circle cx="118" cy="88" r="12"/><circle cx="82" cy="98" r="9"/>`, f: '#4b3ba8' },
    { s: `<path d="M10 84 C 40 118, 160 118, 190 84 C 176 106, 150 122, 100 122 C 50 122, 24 106, 10 84 Z"/>`, f: '#ffc93c', o: 5 },
  ] },

  station: { vb: '0 0 210 140', w: 34, layers: [
    { s: `<rect x="76" y="46" width="60" height="48" rx="12"/><rect x="40" y="60" width="40" height="20" rx="8"/><rect x="132" y="60" width="40" height="20" rx="8"/><rect x="98" y="14" width="16" height="34" rx="6"/>`, f: '#c7cfe4' },
    { s: `<rect x="2" y="42" width="42" height="56" rx="6"/><rect x="168" y="42" width="42" height="56" rx="6"/>`, f: '#3d7bff', o: 5 },
    { s: `<circle cx="106" cy="70" r="14"/>`, f: '#8fd8f0', o: 5 },
    { s: `<circle cx="106" cy="10" r="10"/>`, f: '#ff4d6d' },
  ] },

  rocket: { vb: '0 0 110 180', w: 16, layers: [
    { s: `<path d="M55 6 C 84 44, 88 96, 84 130 L26 130 C 22 96, 26 44, 55 6 Z"/><polygon points="26,98 6,146 26,134"/><polygon points="84,98 104,146 84,134"/><rect x="34" y="128" width="42" height="18" rx="6"/>`, f: '#f0f2f8' },
    { s: `<polygon points="26,98 6,146 26,134"/><polygon points="84,98 104,146 84,134"/><path d="M55 6 C 68 22, 76 40, 80 56 L30 56 C 34 40, 42 22, 55 6 Z"/>`, f: '#e8564a' },
    { s: `<circle cx="55" cy="76" r="16"/>`, f: '#8fd8f0', o: 5 },
    { s: `<path d="M38 148 C 44 168, 66 168, 72 148 C 68 158, 42 158, 38 148 Z"/>`, f: '#ffc93c' },
  ] },

  satellite: { vb: '0 0 170 110', w: 17, layers: [
    { s: `<rect x="62" y="34" width="46" height="42" rx="8"/><rect x="80" y="10" width="10" height="26" rx="4"/>`, f: '#c7cfe4' },
    { s: `<rect x="6" y="38" width="50" height="34" rx="5"/><rect x="114" y="38" width="50" height="34" rx="5"/>`, f: '#3d7bff', o: 5 },
    { s: `<circle cx="85" cy="8" r="10"/>`, f: '#ffc93c' },
  ] },

  asteroid: { vb: '0 0 130 90', w: 13, layers: [
    { s: `<polygon points="8,58 20,22 58,6 100,16 124,48 108,80 46,86"/>`, f: '#5a6480' },
    { s: `<circle cx="52" cy="38" r="12"/><circle cx="88" cy="58" r="9"/>`, f: '#3a4258' },
  ] },

  /* ---- arena 7, royal castle ---- */
  castle: { vb: '0 0 300 220', w: 62, layers: [
    { s: `<rect x="70" y="86" width="160" height="126" rx="4"/><rect x="10" y="46" width="62" height="166" rx="4"/><rect x="228" y="46" width="62" height="166" rx="4"/><rect x="118" y="34" width="64" height="60" rx="4"/>` +
         `<rect x="10" y="30" width="16" height="20"/><rect x="34" y="30" width="16" height="20"/><rect x="58" y="30" width="14" height="20"/>` +
         `<rect x="228" y="30" width="16" height="20"/><rect x="252" y="30" width="16" height="20"/><rect x="276" y="30" width="14" height="20"/>` +
         `<rect x="118" y="18" width="16" height="20"/><rect x="142" y="18" width="16" height="20"/><rect x="166" y="18" width="16" height="20"/>` +
         `<rect x="76" y="72" width="16" height="18"/><rect x="104" y="72" width="16" height="18"/><rect x="188" y="72" width="16" height="18"/><rect x="212" y="72" width="16" height="18"/>`, f: '#c7b8a0' },
    { s: `<path d="M126 212 L126 158 C 126 132, 174 132, 174 158 L174 212 Z"/>`, f: '#5e3a22', o: 5 },
    { s: `<rect x="28" y="80" width="26" height="34" rx="10"/><rect x="246" y="80" width="26" height="34" rx="10"/><rect x="138" y="52" width="24" height="30" rx="10"/>`, f: '#3d2c58', o: 5 },
    { s: `<rect x="36" y="4" width="8" height="30" rx="3"/><rect x="254" y="4" width="8" height="30" rx="3"/><polygon points="44,6 78,16 44,26"/><polygon points="262,6 296,16 262,26"/>`, f: '#e8564a' },
  ] },

  banner: { vb: '0 0 100 190', w: 16, layers: [
    { s: `<rect x="44" y="6" width="12" height="178" rx="5"/><path d="M14 24 L86 24 L86 128 L50 108 L14 128 Z"/>`, f: '#8a5a3a' },
    { s: `<path d="M14 24 L86 24 L86 128 L50 108 L14 128 Z"/>`, f: '#3d7bff' },
    { s: `<polygon points="${starPts(50, 68, 24, 10, 5)}"/>`, f: '#ffc93c' },
  ] },

  torch: { vb: '0 0 80 170', w: 11, layers: [
    { s: `<rect x="30" y="52" width="20" height="112" rx="7"/><path d="M40 4 C 62 34, 66 60, 40 78 C 14 60, 18 34, 40 4 Z"/>`, f: '#5e3a22' },
    { s: `<path d="M40 8 C 60 36, 62 58, 40 74 C 18 58, 20 36, 40 8 Z"/>`, f: '#ff8a3d' },
    { s: `<path d="M40 26 C 51 44, 52 58, 40 68 C 28 58, 29 44, 40 26 Z"/>`, f: '#ffd75e' },
  ] },

  shield: { vb: '0 0 120 140', w: 14, layers: [
    { s: `<path d="M10 12 L110 12 L110 74 C 110 112, 82 130, 60 136 C 38 130, 10 112, 10 74 Z"/>`, f: '#c7cfe4' },
    { s: `<rect x="52" y="26" width="16" height="86" rx="5"/><rect x="22" y="50" width="76" height="16" rx="5"/>`, f: '#e8564a' },
  ] },

  /* ---- arena 8, cyber arena ---- */
  neonTower: { vb: '0 0 130 240', w: 22, layers: [
    { s: `<rect x="16" y="40" width="98" height="196" rx="6"/><rect x="56" y="4" width="14" height="40" rx="5"/>`, f: '#2a1b5e' },
    { s: `<rect x="28" y="56" width="30" height="12" rx="4"/><rect x="70" y="56" width="30" height="12" rx="4"/><rect x="28" y="82" width="30" height="12" rx="4"/><rect x="70" y="82" width="30" height="12" rx="4"/><rect x="28" y="108" width="30" height="12" rx="4"/><rect x="70" y="108" width="30" height="12" rx="4"/><rect x="28" y="134" width="30" height="12" rx="4"/><rect x="70" y="134" width="30" height="12" rx="4"/>`, f: '#31e0ff' },
    { s: `<rect x="34" y="166" width="62" height="52" rx="6"/>`, f: '#ff2fb0', o: 5 },
    { s: `<circle cx="63" cy="8" r="9"/>`, f: '#ff2fb0' },
  ] },

  holoScreen: { vb: '0 0 190 130', w: 26, layers: [
    { s: `<rect x="8" y="8" width="174" height="102" rx="10"/><rect x="84" y="110" width="22" height="18" rx="5"/>`, f: '#2a1b5e' },
    { s: `<rect x="22" y="22" width="146" height="74" rx="6"/>`, f: '#12094a', o: 5 },
    { s: `<rect x="34" y="72" width="20" height="16" rx="3"/><rect x="60" y="56" width="20" height="32" rx="3"/><rect x="86" y="40" width="20" height="48" rx="3"/><rect x="112" y="60" width="20" height="28" rx="3"/><rect x="138" y="48" width="20" height="40" rx="3"/>`, f: '#31e0ff' },
  ] },

  drone: { vb: '0 0 180 110', w: 20, layers: [
    { s: `<rect x="62" y="42" width="56" height="34" rx="12"/><rect x="24" y="34" width="132" height="10" rx="5"/><rect x="14" y="18" width="34" height="10" rx="5"/><rect x="132" y="18" width="34" height="10" rx="5"/><rect x="26" y="26" width="8" height="12"/><rect x="146" y="26" width="8" height="12"/>`, f: '#c7cfe4' },
    { s: `<rect x="74" y="52" width="32" height="16" rx="6"/>`, f: '#31e0ff', o: 5 },
  ] },

  gridStripes: { vb: '0 0 400 120', band: true, layers: [
    { s: `<rect x="0" y="8" width="400" height="6"/><rect x="0" y="34" width="400" height="7"/><rect x="0" y="66" width="400" height="8"/><rect x="0" y="104" width="400" height="10"/>`, f: '#ff2fb0' },
  ] },

  /* ---- arena 9, the void ---- */
  portal: { vb: '0 0 200 200', w: 44, layers: [
    { s: `<path fill-rule="evenodd" d="M100 6 A94 94 0 1 1 99.9 6 Z M100 46 A54 54 0 1 0 100.1 46 Z"/>`, f: '#8a4bff' },
    { s: `<path fill-rule="evenodd" d="M100 22 A78 78 0 1 1 99.9 22 Z M100 46 A54 54 0 1 0 100.1 46 Z"/>`, f: '#c98bff' },
  ] },

  floatRock: { vb: '0 0 170 130', w: 24, layers: [
    { s: `<polygon points="14,58 34,26 92,14 148,34 160,64 120,102 56,104 26,84"/><polygon points="56,104 120,102 96,126 70,126"/>`, f: '#3a2a5e' },
    { s: `<polygon points="34,26 92,14 148,34 156,56 96,66 30,50"/>`, f: '#54407e' },
    { s: `<circle cx="72" cy="42" r="9"/><circle cx="112" cy="48" r="7"/>`, f: '#8a4bff' },
  ] },

  crystal: { vb: '0 0 130 180', w: 17, layers: [
    { s: `<polygon points="42,174 22,86 54,10 74,86"/><polygon points="74,174 64,96 96,44 112,110 100,174"/>`, f: '#8a4bff' },
    { s: `<polygon points="54,10 74,86 58,86"/><polygon points="96,44 112,110 96,110"/>`, f: '#c98bff' },
  ] },

  comet: { vb: '0 0 200 90', w: 22, layers: [
    { s: `<circle cx="154" cy="46" r="30"/><polygon points="140,26 6,40 140,66"/>`, f: '#8fd8f0' },
    { s: `<circle cx="154" cy="46" r="18"/>`, f: '#ffffff' },
  ] },

  /* ---- arena 10, champion arena ---- */
  stands: { vb: '0 0 400 150', band: true, layers: [
    { s: `<rect x="0" y="30" width="400" height="120"/>`, f: '#7a2a20' },
    { s: `<rect x="0" y="30" width="400" height="16"/><rect x="0" y="72" width="400" height="16"/><rect x="0" y="114" width="400" height="16"/>`, f: '#5a1a14' },
    { s: `<circle cx="20" cy="22" r="11"/><circle cx="56" cy="20" r="11"/><circle cx="92" cy="24" r="11"/><circle cx="128" cy="19" r="11"/><circle cx="164" cy="23" r="11"/><circle cx="200" cy="20" r="11"/><circle cx="236" cy="24" r="11"/><circle cx="272" cy="19" r="11"/><circle cx="308" cy="23" r="11"/><circle cx="344" cy="20" r="11"/><circle cx="380" cy="24" r="11"/>`, f: '#ffc93c' },
  ] },

  spotlight: { vb: '0 0 120 200', w: 18, layers: [
    { s: `<rect x="50" y="60" width="18" height="134" rx="6"/><rect x="24" y="184" width="70" height="14" rx="6"/><path d="M18 14 L102 14 L86 62 L34 62 Z"/>`, f: '#5a6480' },
    { s: `<path d="M24 20 L96 20 L84 54 L36 54 Z"/>`, f: '#ffd75e', o: 5 },
  ] },

  trophyBig: { vb: '0 0 180 220', w: 34, layers: [
    { s: `<path d="M46 14 L134 14 L128 96 C 124 128, 56 128, 52 96 Z"/><rect x="78" y="126" width="24" height="34" rx="5"/><rect x="46" y="158" width="88" height="20" rx="7"/><rect x="34" y="178" width="112" height="26" rx="8"/>` +
         `<path d="M46 30 C 10 30, 8 88, 52 92 L52 74 C 32 70, 32 46, 46 46 Z"/><path d="M134 30 C 170 30, 172 88, 128 92 L128 74 C 148 70, 148 46, 134 46 Z"/>`, f: '#ffc93c' },
    { s: `<polygon points="${starPts(90, 62, 30, 13, 5)}"/>`, f: '#c98f00' },
  ] },

  confetti: { vb: '0 0 30 40', w: 2.6, layers: [
    { s: `<rect x="4" y="4" width="22" height="32" rx="4"/>`, f: '#ffffff' },
  ] },
};

/* ================= the scenes ================= */
// x: percent across the viewport (prop centre).
// y: percent down the viewport where the prop's BOTTOM sits, so anything placed on
//    the horizon stays on it whatever shape the window is. `mid` centres on y instead.
// s: size multiplier on the art's base width.

const ARENA_SCENES = {
  1: { props: [
    { art: 'sun', x: 86, y: 15, mid: true, fx: 'spin', dur: '90s' },
    { art: 'cloud', x: 20, y: 13, mid: true, fx: 'drift', dur: '34s' },
    { art: 'cloud', x: 58, y: 8, mid: true, s: 0.7, fx: 'drift', dur: '46s', delay: '-12s' },
    { art: 'bird', x: 30, y: 26, mid: true, fx: 'bob', dur: '3.4s' },
    { art: 'bird', x: 36, y: 22, mid: true, s: 0.7, fx: 'bob', dur: '2.8s', delay: '-1s' },
    { art: 'hills', y: 43, h: 11 },
    { art: 'house', x: 13, y: 52, s: 1.15 },
    { art: 'tree', x: 26, y: 49, s: 0.9 },
    { art: 'tree', x: 90, y: 57, s: 1.3, fx: 'sway', dur: '6s' },
    { art: 'bush', x: 74, y: 49, s: 0.8 },
    { art: 'fence', x: 8, y: 78, s: 1.2 },
    { art: 'bush', x: 92, y: 82, s: 1.1 },
  ] },

  2: { props: [
    { art: 'bunting', y: 11, h: 9 },
    { art: 'clock', x: 24, y: 22, mid: true, s: 0.9 },
    { art: 'lockers', x: 8, y: 48, s: 1.15 },
    { art: 'vending', x: 92, y: 48, s: 1.1 },
    { art: 'lunchTable', x: 14, y: 80, s: 1.2 },
    { art: 'lunchTable', x: 88, y: 94, s: 1.5 },
    // Trays and cartons were tried here and read as unidentifiable specks at this
    // size -- a lunch table is the shape that says "cafeteria" from across a room.
    { art: 'lunchTable', x: 78, y: 68, s: 0.85 },
  ] },

  3: { props: [
    { art: 'sunLow', x: 68, y: 24, mid: true },
    { art: 'cloud', x: 22, y: 12, mid: true, s: 0.9, fx: 'drift', dur: '40s' },
    { art: 'bird', x: 38, y: 17, mid: true, s: 0.8, fx: 'bob', dur: '3s' },
    { art: 'bird', x: 46, y: 13, mid: true, s: 0.5, fx: 'bob', dur: '3.6s', delay: '-1.4s' },
    { art: 'skyline', y: 44, h: 17 },
    { art: 'waterTower', x: 12, y: 45, s: 1.05 },
    { art: 'antennaMast', x: 89, y: 44 },
    { art: 'acUnit', x: 18, y: 82, s: 1.2 },
    { art: 'acUnit', x: 86, y: 90, s: 1.5 },
  ] },

  4: { props: [
    { art: 'sun', x: 82, y: 13, mid: true, s: 0.9, fx: 'spin', dur: '110s' },
    { art: 'cloud', x: 24, y: 12, mid: true, fx: 'drift', dur: '38s' },
    { art: 'bird', x: 44, y: 19, mid: true, s: 0.7, fx: 'bob', dur: '3.2s' },
    { art: 'island', x: 14, y: 48, s: 0.9 },
    { art: 'waves', y: 50, h: 9 },
    { art: 'ship', x: 81, y: 64, s: 1, fx: 'sway', dur: '7s' },
    { art: 'waves', y: 76, h: 12, s: 1.4 },
    { art: 'barrel', x: 9, y: 88 },
    { art: 'chest', x: 24, y: 95, s: 1.2 },
  ] },

  5: { props: [
    { art: 'moon', x: 22, y: 13, mid: true, s: 0.8 },
    { art: 'volcano', x: 70, y: 46, s: 1.1 },
    { art: 'spire', x: 14, y: 43 },
    { art: 'lavaBand', y: 52, h: 8 },
    { art: 'ember', repeat: 9, area: [8, 30, 92, 62], s: [0.5, 1.2], fx: 'rise', dur: [5, 11] },
    { art: 'deadTree', x: 9, y: 82, s: 1.2 },
    { art: 'boulder', x: 90, y: 86, s: 1.3 },
    { art: 'boulder', x: 30, y: 92, s: 0.9 },
  ] },

  6: { props: [
    { art: 'starDot', repeat: 22, area: [3, 4, 97, 62], s: [0.5, 1.3], fx: 'twinkle', dur: [2.4, 6] },
    { art: 'planet', x: 80, y: 22, mid: true, s: 1.1 },
    { art: 'moon', x: 17, y: 12, mid: true, s: 0.7 },
    { art: 'satellite', x: 45, y: 15, mid: true, s: 0.8, fx: 'bob', dur: '5s' },
    { art: 'station', x: 14, y: 48, fx: 'bob', dur: '6.5s' },
    { art: 'asteroid', x: 32, y: 84, s: 1.1 },
    { art: 'rocket', x: 89, y: 86, s: 1.2, fx: 'bob', dur: '4.2s' },
  ] },

  7: { props: [
    { art: 'sun', x: 50, y: 11, mid: true, s: 0.8, fx: 'spin', dur: '100s' },
    { art: 'cloud', x: 16, y: 15, mid: true, s: 0.9, fx: 'drift', dur: '42s' },
    { art: 'cloud', x: 84, y: 12, mid: true, s: 0.7, fx: 'drift', dur: '52s', delay: '-16s' },
    { art: 'hills', y: 43, h: 9 },
    { art: 'castle', x: 78, y: 50, s: 0.9 },
    { art: 'tree', x: 16, y: 50, s: 1.1, fx: 'sway', dur: '7s' },
    { art: 'banner', x: 9, y: 88, s: 1.2 },
    { art: 'banner', x: 92, y: 88, s: 1.2 },
    { art: 'torch', x: 24, y: 96 },
    { art: 'shield', x: 76, y: 98, s: 1.1 },
  ] },

  8: { props: [
    { art: 'starDot', repeat: 14, area: [4, 5, 96, 38], s: [0.4, 0.9], fx: 'twinkle', dur: [2, 5] },
    { art: 'holoScreen', x: 78, y: 24, mid: true, s: 0.85 },
    { art: 'drone', x: 26, y: 17, mid: true, s: 0.8, fx: 'bob', dur: '3.6s' },
    { art: 'neonTower', x: 10, y: 56, s: 1.2 },
    { art: 'neonTower', x: 26, y: 54, s: 0.85 },
    { art: 'neonTower', x: 90, y: 56, s: 1.1 },
    { art: 'neonTower', x: 76, y: 53, s: 0.75 },
    { art: 'gridStripes', y: 100, h: 26 },
  ] },

  9: { props: [
    { art: 'starDot', repeat: 26, area: [3, 4, 97, 92], s: [0.4, 1.2], fx: 'twinkle', dur: [2, 6] },
    { art: 'portal', x: 79, y: 27, mid: true, s: 0.8, fx: 'spin', dur: '60s' },
    { art: 'comet', x: 26, y: 13, mid: true, s: 0.8, fx: 'drift', dur: '26s' },
    { art: 'floatRock', x: 13, y: 46, s: 1.1, fx: 'bob', dur: '6s' },
    { art: 'floatRock', x: 90, y: 58, s: 0.85, fx: 'bob', dur: '7.5s', delay: '-2s' },
    { art: 'crystal', x: 9, y: 88, s: 1.2 },
    { art: 'crystal', x: 92, y: 92, s: 1.4 },
    { art: 'crystal', x: 30, y: 96, s: 0.8 },
  ] },

  10: { props: [
    { art: 'stands', y: 48, h: 18 },
    { art: 'spotlight', x: 7, y: 49, s: 1.1 },
    { art: 'spotlight', x: 93, y: 49, s: 1.1 },
    { art: 'trophyBig', x: 78, y: 58, s: 0.95 },
    { art: 'confetti', repeat: 20, area: [4, 0, 96, 30], s: [0.7, 1.5], fx: 'fall', dur: [6, 13] },
    { art: 'banner', x: 16, y: 90, s: 1.1 },
    { art: 'banner', x: 84, y: 90, s: 1.1 },
  ] },
};

/* ================= painting ================= */

const rnd = (a, b) => a + Math.random() * (b - a);

function propNode(p) {
  const a = ART[p.art];
  if (!a) return null;

  const wrap = document.createElement('div');
  wrap.className = 'prop';

  if (a.band) {
    // Full-width strips (hills, waves, a city skyline) span the screen and stretch.
    const h = p.h || 10;
    const s = p.s || 1;
    wrap.style.left = '50%';
    wrap.style.width = (100 * s) + '%';
    wrap.style.top = (p.y - h) + '%';
    wrap.style.height = h + '%';
    wrap.style.transform = 'translateX(-50%)';
  } else {
    wrap.style.left = p.x + '%';
    wrap.style.top = p.y + '%';
    // --u is a capped vmin (see the stylesheet): scenery grows with a phone screen
    // but stops growing on a big desktop, where straight vmin made a house taller
    // than the PLAY button.
    wrap.style.width = `calc(var(--u) * ${(a.w * (p.s || 1)).toFixed(2)})`;
    wrap.style.transform = p.mid ? 'translate(-50%, -50%)' : 'translate(-50%, -100%)';
  }

  const inner = document.createElement('div');
  inner.className = 'prop-in' + (p.fx ? ' fx-' + p.fx : '');
  if (p.dur) inner.style.setProperty('--dur', p.dur);
  if (p.delay) inner.style.animationDelay = p.delay;
  inner.innerHTML = buildSVG(a);

  wrap.appendChild(inner);
  return wrap;
}

// Scattered props -- stars, embers, confetti -- are placed at random inside a box
// rather than listed one by one, so a scene stays short to read and edit.
function scatterNodes(p) {
  const [x0, y0, x1, y1] = p.area;
  const out = [];
  for (let i = 0; i < p.repeat; i++) {
    const one = {
      art: p.art,
      x: +rnd(x0, x1).toFixed(1),
      y: +rnd(y0, y1).toFixed(1),
      mid: true,
      s: +rnd(p.s[0], p.s[1]).toFixed(2),
      fx: p.fx,
      dur: rnd(p.dur[0], p.dur[1]).toFixed(1) + 's',
      delay: '-' + rnd(0, p.dur[1]).toFixed(1) + 's',
    };
    const node = propNode(one);
    if (node) out.push(node);
  }
  return out;
}

// Repainting on every menu render would restart every animation, so a scene is
// rebuilt only when the arena actually changes.
function paintScene(host, arenaN) {
  if (!host) return;
  const key = String(arenaN);
  if (host.dataset.arena === key) return;
  host.dataset.arena = key;

  const scene = ARENA_SCENES[arenaN] || ARENA_SCENES[1];
  const frag = document.createDocumentFragment();
  for (const p of scene.props) {
    if (p.repeat) scatterNodes(p).forEach(n => frag.appendChild(n));
    else { const n = propNode(p); if (n) frag.appendChild(n); }
  }
  host.innerHTML = '';
  host.appendChild(frag);
}
