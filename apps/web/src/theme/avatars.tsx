import type { AvatarPreset } from '@wkb/shared';

/* The stock avatars, sixteen ink stamps, two for each card suit.
Rules for a new one:
- A solid shape with the details cut out. At 26px the small holes disappear first, so the silhouette has to do the work.
- Slightly off centre where possible. A perfectly symmetrical face looks like an icon.
- The suit's colour on card stock in both themes. On dark it only reaches 2.91:1 (fails WCAG 1.4.11); on paper it's 5.4:1.*/
const KNOCKOUT = 'rgb(var(--card))';

export interface AvatarArt {
  //Which suit's colour and pip this figure belongs to
  suit: string;
  //Paths, drawn in a 24x24 box
  draw: JSX.Element;
}

export const AVATAR_ART: Record<AvatarPreset, AvatarArt> = {
  'sports-trophy': {
    suit: 'sports',
    draw: (
      <>
        {/* A cup, the handles are what make it read as atrophy at 26px rather than as a plant pot */}
        <path d="M7.2 3h9.6v5.6c0 3-2.2 5.2-4.8 5.2S7.2 11.6 7.2 8.6z" fill="currentColor" />
        <path d="M7.2 4.4H5c-1.1 0-1.8.7-1.8 1.8 0 2.3 1.6 3.9 3.9 4.1" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" />
        <path d="M16.8 4.4H19c1.1 0 1.8.7 1.8 1.8 0 2.3-1.6 3.9-3.9 4.1" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" />
        <path d="M10.9 13.6h2.2v3.2h-2.2z" fill="currentColor" />
        <path d="M8.2 16.6h7.6v2h-7.6z" fill="currentColor" />
        <path d="M6.4 18.4h11.2v2.8H6.4z" fill="currentColor" />
        <path d="M12 5.2l.95 2.6 2.6.95-2.6.95-.95 2.6-.95-2.6-2.6-.95 2.6-.95z" fill={KNOCKOUT} />
      </>
    ),
  },
  'sports-player': {
    suit: 'sports',
    draw: (
      <>
        {}
        <path d="M12.4 7.2c2.7 0 4.5 1.9 4.5 4.5 0 3-2 5.4-4.5 5.4s-4.5-2.4-4.5-5.4c0-2.6 1.8-4.5 4.5-4.5z" fill="currentColor" />
        <path d="M5.3 22.7c0-3.5 3.2-5.7 7.1-5.7s7.1 2.2 7.1 5.7z" fill="currentColor" />
        <path d="M7.3 8.6c0-2.9 2.3-4.9 5.1-4.9s5.1 2 5.1 4.9z" fill="currentColor" />
        <path d="M7.4 7.6H3.1c-.8 0-1.2.4-1.2 1.1s.5 1.1 1.3 1.1h4.6z" fill="currentColor" />
        <circle cx="10.6" cy="11.9" r="0.85" fill={KNOCKOUT} />
        <circle cx="14.2" cy="11.9" r="0.85" fill={KNOCKOUT} />
      </>
    ),
  },
  'history-sphinx': {
    suit: 'history',
    draw: (
      <>
        <path d="M12 3.1c3.5 0 5.1 2.2 5.1 4.9v1.4l2.7 7.2-3 1.2v4.7H7.2v-4.7l-3-1.2 2.7-7.2V8c0-2.7 1.6-4.9 5.1-4.9z" fill="currentColor" />
        <path d="M8.6 9.9h2.3M13.1 9.9h2.3" stroke={KNOCKOUT} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M9.8 13.8h4.4" stroke={KNOCKOUT} strokeWidth="1.7" strokeLinecap="round" />
      </>
    ),
  },
  'history-centurion': {
    suit: 'history',
    draw: (
      <>
        <path d="M12 7.4c2.7 0 4.5 1.9 4.5 4.5 0 3-2 5.4-4.5 5.4s-4.5-2.4-4.5-5.4c0-2.6 1.8-4.5 4.5-4.5z" fill="currentColor" />
        <path d="M4.9 22.7c0-3.5 3.2-5.7 7.1-5.7s7.1 2.2 7.1 5.7z" fill="currentColor" />
        <path d="M6.8 11.4V9.1C6.8 6.3 9.1 4.4 12 4.4s5.2 1.9 5.2 4.7v2.3h-1.9V9.6h-6.6v1.8z" fill="currentColor" />
        <path d="M5.6 4.6c1.4-2.4 11.4-2.4 12.8 0 .5.9-.4 1.5-1.3 1.1-3.4-1.5-6.8-1.5-10.2 0-.9.4-1.8-.2-1.3-1.1z" fill="currentColor" />
        <circle cx="10.2" cy="12.4" r="0.85" fill={KNOCKOUT} />
        <circle cx="13.8" cy="12.4" r="0.85" fill={KNOCKOUT} />
      </>
    ),
  },
  'science-dna': {
    suit: 'science',
    draw: (
      <>
        <path d="M7.5 5.6c0 5 8.4 5 8.4 8.6s-8.4 4.4-8.4 9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M16.4 5.6c0 5-8.4 5-8.4 8.6s8.4 4.4 8.4 9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M9.2 9.3h5.4M8.4 13.7h7.2" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        <circle cx="10" cy="5.2" r="3" fill="currentColor" />
        <circle cx="9.1" cy="4.7" r="0.85" fill={KNOCKOUT} />
        <circle cx="11.3" cy="5" r="0.85" fill={KNOCKOUT} />
      </>
    ),
  },
  'science-goggles': {
    suit: 'science',
    draw: (
      <>
        <path d="M12 5.8c2.7 0 4.5 1.9 4.5 4.6 0 3-2 5.4-4.5 5.4s-4.5-2.4-4.5-5.4c0-2.7 1.8-4.6 4.5-4.6z" fill="currentColor" />
        <path d="M4.9 22.5c0-3.6 3.2-5.9 7.1-5.9s7.1 2.3 7.1 5.9z" fill="currentColor" />
        <path d="M6.6 8.2h10.8v3.1H6.6z" fill="currentColor" />
        <circle cx="9.5" cy="9.8" r="1.5" fill={KNOCKOUT} />
        <circle cx="14.5" cy="9.8" r="1.5" fill={KNOCKOUT} />
        <path d="M11 9.8h2" stroke={KNOCKOUT} strokeWidth="1" />
      </>
    ),
  },
  'space-visitor': {
    suit: 'space',
    draw: (
      <>
        <path d="M11.4 4.2c4.7 0 7.4 3.2 7.4 7 0 4.9-3.7 8.9-7.4 11.4C7.7 20.1 4 16.1 4 11.2c0-3.8 2.7-7 7.4-7z" fill="currentColor" />
        <path d="M8.1 9.4c1.5-.6 3.2.7 3.6 2.5.4 1.7-.5 3.1-2 2.8-1.7-.4-3.2-2.2-3.2-3.8 0-.8.6-1.2 1.6-1.5z" fill={KNOCKOUT} />
        <path d="M15.6 9.6c-1.2-.4-2.5.6-2.8 1.9-.3 1.4.4 2.5 1.5 2.2 1.4-.3 2.5-1.7 2.5-3 0-.6-.4-1-1.2-1.1z" fill={KNOCKOUT} />
        <path d="M18.4 6.6c1.7-1.6 3.4-2 4.3-1" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  'space-helmet': {
    suit: 'space',
    draw: (
      <>
        <circle cx="12" cy="11" r="8" fill="currentColor" />
        <path d="M6.6 10.4c0-3 2.4-4.8 5.4-4.8s5.4 1.8 5.4 4.8c0 2.6-2.4 4.2-5.4 4.2s-5.4-1.6-5.4-4.2z" fill={KNOCKOUT} />
        <path d="M8.4 9.2c.6-1.4 1.9-2.1 3.4-2.1" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <path d="M19.6 8.4h1.9v4.4h-1.9z" fill="currentColor" />
        <path d="M5.2 19.6c1.8-1.3 4.2-2 6.8-2s5 .7 6.8 2v2.9H5.2z" fill="currentColor" />
      </>
    ),
  },
  'technology-machine': {
    suit: 'technology',
    draw: (
      <>
        <path d="M16.8 4.2c1.6-.6 3 .2 3.2 1.7" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <circle cx="20.4" cy="6.8" r="1.7" fill="currentColor" />
        <rect x="3.4" y="7" width="14.4" height="13.2" rx="3.6" fill="currentColor" />
        <rect x="6.1" y="10.8" width="4.2" height="3.4" rx="1.3" fill={KNOCKOUT} />
        <rect x="11.7" y="11.2" width="3.4" height="2.8" rx="1.1" fill={KNOCKOUT} />
        <path d="M7.1 17h6.4" stroke={KNOCKOUT} strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
  },
  'technology-headset': {
    suit: 'technology',
    draw: (
      <>
        <path d="M12 5.6c2.7 0 4.6 2 4.6 4.7 0 3-2 5.5-4.6 5.5s-4.6-2.5-4.6-5.5c0-2.7 1.9-4.7 4.6-4.7z" fill="currentColor" />
        <path d="M4.9 22.5c0-3.6 3.2-5.9 7.1-5.9s7.1 2.3 7.1 5.9z" fill="currentColor" />
        <path d="M5.8 8.4h12.4v3.6H5.8z" fill="currentColor" />
        <path d="M7.4 10.2h9.2" stroke={KNOCKOUT} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M18.2 8.9c1.4.4 2.1 1.5 2 2.9" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  'arts-quill': {
    suit: 'arts',
    draw: (
      <>
        <path d="M5.8 14.6h8.4l-.9 6.6c-.1 1-.9 1.7-1.9 1.7H8.6c-1 0-1.8-.7-1.9-1.7z" fill="currentColor" />
        <path d="M5.2 12.8h9.6v2.2H5.2z" fill="currentColor" />
        <path d="M13.4 12.6c1.6-3.4 4-5.9 7.4-7.6-1 3.9-2.6 6.8-5 8.8z" fill="currentColor" />
        <path d="M13.9 13.4c1.6-2.6 3.4-4.6 5.5-6" stroke={KNOCKOUT} strokeWidth="1.1" fill="none" strokeLinecap="round" />
        <circle cx="8.2" cy="18.4" r="0.9" fill={KNOCKOUT} />
        <circle cx="11.6" cy="19.2" r="0.9" fill={KNOCKOUT} />
      </>
    ),
  },
  'arts-beret': {
    suit: 'arts',
    draw: (
      <>
        <path d="M12 6.6c2.7 0 4.5 1.9 4.5 4.6 0 3-2 5.4-4.5 5.4s-4.5-2.4-4.5-5.4c0-2.7 1.8-4.6 4.5-4.6z" fill="currentColor" />
        <path d="M4.9 22.6c0-3.5 3.2-5.8 7.1-5.8s7.1 2.3 7.1 5.8z" fill="currentColor" />
        <path d="M4.6 9.1c0-3 3.2-5.2 7.4-5.2 3.8 0 6.4 1.6 6.4 3.7 0 1.3-1.2 2.1-3.2 2.1H5.6c-.7 0-1-.2-1-.6z" fill="currentColor" />
        <circle cx="16.9" cy="3.9" r="1.35" fill="currentColor" />
        <circle cx="10.2" cy="11.6" r="0.85" fill={KNOCKOUT} />
        <circle cx="13.8" cy="11.6" r="0.85" fill={KNOCKOUT} />
      </>
    ),
  },
  'geography-compass': {
    suit: 'geography',
    draw: (
      <>
        {/* A compass rose rather than a face on a globe. The suit crest is already a meridian globe */}
        <path d="M12 2.4a9.6 9.6 0 1 0 0 19.2 9.6 9.6 0 0 0 0-19.2zm0 2.3a7.3 7.3 0 1 1 0 14.6 7.3 7.3 0 0 1 0-14.6z" fill="currentColor" />
        <path d="M12 5.1l1.75 5.15L18.9 12l-5.15 1.75L12 18.9l-1.75-5.15L5.1 12l5.15-1.75z" fill="currentColor" />
      </>
    ),
  },
  'geography-explorer': {
    suit: 'geography',
    draw: (
      <>
        <path d="M12 7.4c2.7 0 4.5 1.9 4.5 4.5 0 3-2 5.4-4.5 5.4s-4.5-2.4-4.5-5.4c0-2.6 1.8-4.5 4.5-4.5z" fill="currentColor" />
        <path d="M4.9 22.8c0-3.4 3.2-5.6 7.1-5.6s7.1 2.2 7.1 5.6z" fill="currentColor" />
        <path d="M2.6 9.2c0-1.1 1.4-1.7 3.4-2 .5-2.2 3-3.6 6-3.6s5.5 1.4 6 3.6c2 .3 3.4.9 3.4 2 0 .8-.9 1.3-2.2 1.3H4.8c-1.3 0-2.2-.5-2.2-1.3z" fill="currentColor" />
        <circle cx="10.2" cy="12.2" r="0.85" fill={KNOCKOUT} />
        <circle cx="13.8" cy="12.2" r="0.85" fill={KNOCKOUT} />
      </>
    ),
  },
  'culture-mask': {
    suit: 'culture',
    draw: (
      <>
        <path d="M12 3.2c4.6 0 7.6 1.6 7.6 4.6 0 6.6-3.4 15-7.6 15S4.4 14.4 4.4 7.8c0-3 3-4.6 7.6-4.6z" fill="currentColor" />
        <path d="M7.2 9.4c.6-1.3 1.9-2 3.1-1.5 1.2.5 1.6 1.9 1 3.2z" fill={KNOCKOUT} />
        <path d="M16.8 9.4c-.6-1.3-1.9-2-3.1-1.5-1.2.5-1.6 1.9-1 3.2z" fill={KNOCKOUT} />
        <path d="M8.6 15.4c1.9 1.8 4.9 1.8 6.8 0" stroke={KNOCKOUT} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  'culture-singer': {
    suit: 'culture',
    draw: (
      <>
        {/* Society and culture already has the theatre mask, so the personhere is not masked. 
        A note carries it instead, drawn solid and large enough to survive the scoreboard. */}
        <path d="M11.2 6.4c2.7 0 4.5 1.9 4.5 4.6 0 3-2 5.4-4.5 5.4s-4.5-2.4-4.5-5.4c0-2.7 1.8-4.6 4.5-4.6z" fill="currentColor" />
        <path d="M4.1 22.7c0-3.5 3.2-5.8 7.1-5.8s7.1 2.3 7.1 5.8z" fill="currentColor" />
        <ellipse cx="11.2" cy="13.1" rx="1.1" ry="1.5" fill={KNOCKOUT} />
        <circle cx="9.4" cy="9.9" r="0.85" fill={KNOCKOUT} />
        <circle cx="13" cy="9.9" r="0.85" fill={KNOCKOUT} />
        <circle cx="18.6" cy="8.9" r="2.4" fill="currentColor" />
        <path d="M20.4 8.9V2.6l3-1v2.2l-3 1z" fill="currentColor" />
      </>
    ),
  },
};
