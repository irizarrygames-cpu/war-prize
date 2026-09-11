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
