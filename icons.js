// Interface icons, drawn rather than borrowed.
//
// These were emoji until now, and emoji are the giveaway that nobody drew anything:
// they render as a different picture on every phone, they sit on their own baseline,
// they carry colours that fight the palette, and half of them only vaguely mean what
// they are being used for. These are solid shapes on a 24-unit grid, inheriting the
// colour of whatever they sit in, built with the same chunky vocabulary as the cards
// and the arenas.
//
// Player avatars and reactions stay emoji on purpose -- those are the player talking,
// not the interface.

const ICONS = {
  // two cards, fanned, because that is the game
  cards: '<rect x="2.4" y="5.6" width="10.4" height="14.4" rx="2.2" transform="rotate(-9 7.6 12.8)"/>' +
         '<rect x="11.2" y="4" width="10.4" height="14.4" rx="2.2" transform="rotate(9 16.4 11.2)"/>',

  // a shop bag with a proper handle
  shop: '<path d="M4.6 7.8h14.8l-1.3 11.6a2.4 2.4 0 0 1-2.4 2.1H8.3a2.4 2.4 0 0 1-2.4-2.1Z"/>' +
        '<path d="M8.7 7.8V6.2a3.3 3.3 0 0 1 6.6 0v1.6" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/>',

  // head and shoulders
  profile: '<circle cx="12" cy="7.6" r="4.2"/><path d="M3.4 21.4a8.6 8.6 0 0 1 17.2 0Z"/>',

  // a pennant on a pole -- an arena you fight your way up
  arenas: '<rect x="3.6" y="2.6" width="2.8" height="18.8" rx="1.4"/>' +
          '<path d="M7.6 3.8h12.2l-3.3 4.4 3.3 4.4H7.6Z"/>',

  // podium bars, tallest in the middle
  ranks: '<rect x="2.6" y="13" width="5.2" height="8.4" rx="1.5"/>' +
         '<rect x="9.4" y="7.4" width="5.2" height="14" rx="1.5"/>' +
         '<rect x="16.2" y="10.6" width="5.2" height="10.8" rx="1.5"/>',

  // medal on a ribbon
  awards: '<path d="M7.4 2h4l-1.6 5.2a7 7 0 0 0-2.6 1.2Z"/><path d="M16.6 2h-4l1.6 5.2a7 7 0 0 1 2.6 1.2Z"/>' +
          '<path fill-rule="evenodd" d="M12 8a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm0 3.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z"/>',

  // two people, one behind
  friends: '<circle cx="9" cy="7.8" r="3.6"/><path d="M1.8 20.6a7.2 7.2 0 0 1 14.4 0Z"/>' +
           '<circle cx="17.8" cy="9" r="2.9"/><path d="M13.4 20.6a5.4 5.4 0 0 1 8.8-4.2 5.4 5.4 0 0 1 2 4.2Z"/>',

  // a target -- something to hit today
  daily: '<path fill-rule="evenodd" d="M12 2.6a9.4 9.4 0 1 1 0 18.8 9.4 9.4 0 0 1 0-18.8Zm0 3.6a5.8 5.8 0 1 0 0 11.6 5.8 5.8 0 0 0 0-11.6Z"/>' +
         '<circle cx="12" cy="12" r="2.7"/>',

  // the prize itself
  trophy: '<path d="M6.4 2.6h11.2v5.2c0 3.6-2.5 6.4-5.6 6.4S6.4 11.4 6.4 7.8Z"/>' +
          '<path d="M6.4 4.2H3.2v1.9a3.6 3.6 0 0 0 3.2 3.6Z"/><path d="M17.6 4.2h3.2v1.9a3.6 3.6 0 0 1-3.2 3.6Z"/>' +
          '<rect x="10.6" y="13.6" width="2.8" height="4.2" rx="1"/><rect x="6.6" y="18.2" width="10.8" height="3.2" rx="1.5"/>',

  // a coin, seen face on
  coin: '<path fill-rule="evenodd" d="M12 2.8a9.2 9.2 0 1 1 0 18.4 9.2 9.2 0 0 1 0-18.4Zm0 2.9a6.3 6.3 0 1 0 0 12.6 6.3 6.3 0 0 0 0-12.6Z"/>' +
        '<path d="M12 7.6 13.3 11h3.5l-2.8 2.1 1 3.4-3-2.1-3 2.1 1-3.4L7.2 11h3.5Z"/>',

  // an eye, for peeking
  eye: '<path fill-rule="evenodd" d="M12 4.6c5.7 0 9.8 4.8 11 7.4-1.2 2.6-5.3 7.4-11 7.4S2.2 14.6 1 12c1.2-2.6 5.3-7.4 11-7.4Zm0 3.4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/>',

  // a level badge
  level: '<path d="M12 1.8 15 8l6.8 1-4.9 4.8 1.2 6.8L12 17.4 5.9 20.6l1.2-6.8L2.2 9 9 8Z"/>',
};

// Returns an <svg> string. Everything inherits currentColor, so an icon takes the
// colour of the button it sits in without a second definition anywhere.
function icon(name, extraClass) {
  const body = ICONS[name];
  if (!body) return '';
  return '<svg class="ico-svg' + (extraClass ? ' ' + extraClass : '') +
         '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + body + '</svg>';
}

// Swaps every element carrying data-icon for its drawing. Called once at startup and
// again whenever markup with icons in it is built.
function paintIcons(root) {
  (root || document).querySelectorAll('[data-icon]').forEach(node => {
    const name = node.getAttribute('data-icon');
    if (!ICONS[name] || node.dataset.painted === name) return;
    node.innerHTML = icon(name);
    node.dataset.painted = name;
  });
}

/* ---------------- card back motifs ----------------
   These were an emoji sitting on a coloured rectangle -- the same "nobody drew it"
   problem as the nav, on the art people look at every single round. Bold shapes
   only: at 50 pixels across, detail turns to mush, and the back has to stay
   readable at a glance from across a table. */

const CARD_ART = {
  fire: '<path d="M12 1.6c2.6 4.2.9 6.2 2.9 8.1 2 1.9 4.3 1.1 4.3 5.1a7.2 7.2 0 0 1-14.4 0c0-3 1.8-4.1 2.9-6.1 1 1.9 2.2 1.9 3 .8 1-1.6-.9-4 1.3-7.9Z"/>',
  ice: '<path d="M12 1.4 14 6l4.8-1.4L17.4 9.4 22 11.4l-4.6 2 1.4 4.8L14 16.8 12 21.4 10 16.8l-4.8 1.4L6.6 13.4 2 11.4l4.6-2L5.2 4.6 10 6Z"/>',
  bolt: '<path d="M13.6 1.4 4.2 13.8h5.6L8.4 22.6l9.4-12.4h-5.6Z"/>',
  cat: '<path d="M3.6 8.4 5.4 1.8l4.4 3.2h4.4l4.4-3.2 1.8 6.6v4.6a8.4 8.4 0 0 1-16.8 0Z"/>' +
       '<circle cx="8.6" cy="11.4" r="1.5" fill="#1a1420"/><circle cx="15.4" cy="11.4" r="1.5" fill="#1a1420"/>' +
       '<path d="M12 14.2 10.4 16h3.2Z" fill="#1a1420"/>',
  dog: '<path d="M4.4 5.2c0-2.2 2.2-3.2 3.4-2l1.8 1.8h4.8l1.8-1.8c1.2-1.2 3.4-.2 3.4 2v7.2a7.6 7.6 0 0 1-15.2 0Z"/>' +
       '<circle cx="9" cy="10.6" r="1.4" fill="#1a1420"/><circle cx="15" cy="10.6" r="1.4" fill="#1a1420"/>' +
       '<ellipse cx="12" cy="14.4" rx="2.1" ry="1.5" fill="#1a1420"/>',
  alien: '<path d="M12 1.8c5.2 0 8.4 3.8 8.4 8.2 0 5.4-4.2 12.2-8.4 12.2S3.6 15.4 3.6 10C3.6 5.6 6.8 1.8 12 1.8Z"/>' +
         '<path d="M6.6 8.6c1.8-.6 3.6.6 4 2.4.4 1.8-1 2.8-2.6 2.2-1.6-.6-2.8-2-2.6-3.2Z" fill="#1a1420"/>' +
         '<path d="M17.4 8.6c-1.8-.6-3.6.6-4 2.4-.4 1.8 1 2.8 2.6 2.2 1.6-.6 2.8-2 2.6-3.2Z" fill="#1a1420"/>',
  // A horned head in profile. The first attempt was a spiky star and read as a
  // splat rather than a creature -- at 50 pixels a silhouette has to be a shape
  // you can name, not a texture.
  dragon: '<path d="M2.4 14.2c0-4.3 3.5-7.8 7.8-7.8h1.4L9 2l5.8 3.6c3.8.5 6.6 3.7 6.6 7.4 0 2.4-1.2 4.5-3 5.8l.9 3.6-4-2.4h-5.5c-4.1 0-7.4-2.6-7.4-5.8Z"/>' +
          '<circle cx="15.4" cy="11" r="1.7" fill="#1a1420"/>' +
          '<path d="M4.6 13.4h4.2v1.8H4.6Z" fill="#1a1420"/>',
  skull: '<path d="M12 1.8a8.4 8.4 0 0 1 8.4 8.4v3.2l-2 2v3.2h-2.8v-2.2h-1.8v2.2h-3.6v-2.2H8.4v2.2H5.6v-3.2l-2-2v-3.2A8.4 8.4 0 0 1 12 1.8Z"/>' +
           '<circle cx="8.6" cy="10.4" r="2.4" fill="#1a1420"/><circle cx="15.4" cy="10.4" r="2.4" fill="#1a1420"/>' +
           '<path d="M11 14.2h2v2.4h-2Z" fill="#1a1420"/>',
  crown: '<path d="M2.4 7.4 7 12l5-8.6 5 8.6 4.6-4.6v11.4H2.4Z"/><rect x="2.4" y="19.6" width="19.2" height="2.6" rx="1"/>',
  planet: '<circle cx="12" cy="10.6" r="6.6"/><path d="M1.6 13.4c3 3.4 17.8 3.4 20.8 0-2 4.4-6 5.4-10.4 5.4S3.6 17.8 1.6 13.4Z"/>' +
          '<circle cx="19.6" cy="3.4" r="1.6"/><circle cx="3.8" cy="5.4" r="1.2"/>',
};

// Paints a card back: its flat colour comes from the cb-* class, its motif from here.
function paintCardBack(node, backId) {
  const art = {
    fire: 'fire', ice: 'ice', lightning: 'bolt', cat: 'cat', dog: 'dog',
    alien: 'alien', dragon: 'dragon', pirate: 'skull', royal: 'crown', galaxy: 'planet',
  }[backId];
  if (!art || !CARD_ART[art]) return node;
  node.innerHTML = '<svg class="cb-art" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
                   CARD_ART[art] + '</svg>';
  return node;
}
