/* This whole file is optional decoration. To remove the feature entirely:
   1. set both flags below to false (nothing else has to change), or
   2. delete this file, theme/suits.tsx, the "The deck" block in index.css,
      and the imports in components/game.tsx.*/

//Off means a plain card.
export const CARD_SUITS = true;

// Deal, stamp and tick animations. Off means the card just appears.
export const CARD_MOTION = true;

/* How far each sheet of the remaining deck sits behind the card in play.*/
export const DECK_OFFSETS = [
  { dx: 11, dy: 9 },
  { dx: 21, dy: 17 },
] as const;
