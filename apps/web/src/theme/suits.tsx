import type { JSX } from 'react';

/* The deck's suits: Every category is a suit, each one has a colour, a crest for the middle of the card and a pip for the corners, 
and the three always appear together. The pip isn't just a smaller crest. Fine lines read at 48px but turn to mud at 11px, 
so the corner version uses a heavier stroke or a filled shape.
Deleting this file and the "The deck" block in index.css removes the decoration. The cards still work, they just look plain. */

export interface Suit {
  rgb: string;
  washRgb: string;
  crest: (size: number) => JSX.Element;
  pip: (size: number) => JSX.Element;
}

const svg = (size: number, children: JSX.Element, extra: Record<string, string> = {}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...extra}>
    {children}
  </svg>
);

export const SUITS: Record<string, Suit> = {
  // Sports & Games - a die
  sports: {
    rgb: '47 111 82',
    washRgb: '219 231 222',
    crest: (s) =>
      svg(
        s,
        <>
          <rect x="3" y="3" width="18" height="18" rx="3.8" fill="currentColor" />
          <g fill="rgb(var(--card))">
            <circle cx="8.2" cy="8.2" r="1.75" />
            <circle cx="15.8" cy="8.2" r="1.75" />
            <circle cx="12" cy="12" r="1.75" />
            <circle cx="8.2" cy="15.8" r="1.75" />
            <circle cx="15.8" cy="15.8" r="1.75" />
          </g>
        </>,
      ),
    pip: (s) =>
      svg(
        s,
        <>
          <rect x="2" y="2" width="20" height="20" rx="4.4" fill="currentColor" />
          <g fill="rgb(var(--card))">
            <circle cx="7.6" cy="7.6" r="2.5" />
            <circle cx="12" cy="12" r="2.5" />
            <circle cx="16.4" cy="16.4" r="2.5" />
          </g>
        </>,
      ),
  },
  // History - a rolled papyrus.
  history: {
    rgb: '138 90 43',
    washRgb: '238 226 209',
    crest: (s) =>
      svg(
        s,
        <>
          <path
            d="M6.5 4.5c0-1.4 1.1-2.5 2.5-2.5h9c-1.4 0-2.5 1.1-2.5 2.5v15c0 1.4-1.1 2.5-2.5 2.5H4c1.4 0 2.5-1.1 2.5-2.5z"
            fill="currentColor"
          />
          <path
            d="M18 2c1.4 0 2.5 1.1 2.5 2.5S19.4 7 18 7h-2.5V4.5C15.5 3.1 16.6 2 18 2ZM6 17H4c-1.4 0-2.5 1.1-2.5 2.5S2.6 22 4 22h2.5v-2.5C6.5 18.1 6 17 6 17Z"
            fill="currentColor"
          />
          <path d="M9 7.5h4.5M9 11h4.5M9 14.5h3" stroke="rgb(var(--card))" strokeWidth="1" />
        </>,
      ),
    pip: (s) =>
      svg(
        s,
        <g fill="currentColor">
          <path d="M6.5 4.5c0-1.4 1.1-2.5 2.5-2.5h9c-1.4 0-2.5 1.1-2.5 2.5v15c0 1.4-1.1 2.5-2.5 2.5H4c1.4 0 2.5-1.1 2.5-2.5z" />
          <path d="M18 2c1.4 0 2.5 1.1 2.5 2.5S19.4 7 18 7h-2.5V4.5C15.5 3.1 16.6 2 18 2ZM6 17H4c-1.4 0-2.5 1.1-2.5 2.5S2.6 22 4 22h2.5v-2.5C6.5 18.1 6 17 6 17Z" />
        </g>,
      ),
  },
  // Science & Nature - orbits
  science: {
    rgb: '58 107 68',
    washRgb: '222 232 224',
    crest: (s) =>
      svg(
        s,
        <g fill="none" stroke="currentColor" strokeWidth="1.1">
          <ellipse cx="12" cy="12" rx="10" ry="4.4" />
          <ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(60 12 12)" />
          <ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(120 12 12)" />
          <circle cx="12" cy="12" r="1.9" fill="currentColor" />
        </g>,
      ),
    pip: (s) =>
      svg(
        s,
        <g fill="none" stroke="currentColor" strokeWidth="2.4">
          <ellipse cx="12" cy="12" rx="10" ry="4.4" />
          <ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(60 12 12)" />
          <ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(120 12 12)" />
        </g>,
      ),
  },
  // Space & Astronomy - a ringed planet
  space: {
    rgb: '75 74 138',
    washRgb: '223 223 235',
    crest: (s) =>
      svg(
        s,
        <g fill="none" stroke="currentColor" strokeWidth="1.1">
          <circle cx="12" cy="11" r="6" />
          <ellipse cx="12" cy="11" rx="11" ry="3.6" transform="rotate(-22 12 11)" />
          <path
            d="M18.6 3.4l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"
            fill="currentColor"
            stroke="none"
          />
        </g>,
      ),
    pip: (s) =>
      svg(
        s,
        <g fill="none" stroke="currentColor" strokeWidth="2.4">
          <circle cx="12" cy="11" r="6" />
          <ellipse cx="12" cy="11" rx="11" ry="3.6" transform="rotate(-22 12 11)" />
        </g>,
      ),
  },
  // Technology & Computing - a chip
  technology: {
    rgb: '60 90 134',
    washRgb: '221 227 236',
    crest: (s) =>
      svg(
        s,
        <g fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="7" y="7" width="10" height="10" rx="1.4" />
          <rect x="10" y="10" width="4" height="4" fill="currentColor" stroke="none" />
          <path d="M10 7V4M14 7V4M10 20v-3M14 20v-3M7 10H4M7 14H4M20 10h-3M20 14h-3" />
        </g>,
      ),
    pip: (s) => svg(s, <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />),
  },
  // Arts & Literature - a quill
  arts: {
    rgb: '138 63 92',
    washRgb: '237 222 228',
    crest: (s) =>
      svg(
        s,
        <g fill="none" stroke="currentColor" strokeWidth="1.1">
          <path d="M18.5 2.4c1.6 4.4-1 9.6-5.6 12.6l-3.2 2.1" />
          <path d="M18.5 2.4c-4.8.6-9.2 3.6-10.6 7.6-.5 1.5-.4 3 .3 4.2" />
          <path d="M9.7 17.1 5 21.6" />
          <path d="M6.6 15.4c-.9 1-1 2.5-.2 3.6" />
        </g>,
      ),
    pip: (s) =>
      svg(
        s,
        <path
          d="M18.5 2.4c1.6 4.4-1 9.6-5.6 12.6L5 21.6l4-6.6c-1-1.6-1-3.6-.3-5.4 1.4-4 5.8-6.6 9.8-7.2z"
          fill="currentColor"
        />,
      ),
  },
  // Geography - a meridian globe
  geography: {
    rgb: '46 106 112',
    washRgb: '219 231 232',
    crest: (s) =>
      svg(
        s,
        <g fill="none" stroke="currentColor" strokeWidth="1.1">
          <circle cx="12" cy="12" r="10" />
          <ellipse cx="12" cy="12" rx="4.2" ry="10" />
          <path d="M2.4 9h19.2M2.4 15h19.2" />
        </g>,
      ),
    pip: (s) =>
      svg(
        s,
        <g fill="none" stroke="currentColor" strokeWidth="2.4">
          <circle cx="12" cy="12" r="10" />
          <ellipse cx="12" cy="12" rx="4.2" ry="10" />
        </g>,
      ),
  },
  // Society & Culture - a mask.
  culture: {
    rgb: '154 90 47',
    washRgb: '240 226 211',
    crest: (s) =>
      svg(
        s,
        <>
          <path
            d="M9 2h6l-1 3.2c2.6 1.3 4.4 4 4.4 7.1 0 2.9-1.6 5.4-4 6.7V22h-4.8v-3c-2.4-1.3-4-3.8-4-6.7 0-3.1 1.8-5.8 4.4-7.1z"
            fill="currentColor"
          />
          <g fill="rgb(var(--card))">
            <circle cx="9.4" cy="12" r="1.3" />
            <circle cx="14.6" cy="12" r="1.3" />
          </g>
        </>,
      ),
    pip: (s) =>
      svg(
        s,
        <path
          d="M9 2h6l-1 3.2c2.6 1.3 4.4 4 4.4 7.1 0 2.9-1.6 5.4-4 6.7V22h-4.8v-3c-2.4-1.3-4-3.8-4-6.7 0-3.1 1.8-5.8 4.4-7.1z"
          fill="currentColor"
        />,
      ),
  },
};

export const DEFAULT_SUIT: Suit = SUITS.sports as Suit;

export function suitFor(slug: string | undefined): Suit {
  return (slug && SUITS[slug]) || DEFAULT_SUIT;
}

/* The two custom properties every card sets. Everything that should follow the suit (the band, the keyline, the crest, the pips, the rules)
reads these rather than being passed a colour so a card only ever names its suit once. */
export function suitVars(slug: string | undefined): Record<string, string> {
  const suit = suitFor(slug);
  return { '--cat': suit.rgb, '--cat-wash': suit.washRgb };
}
