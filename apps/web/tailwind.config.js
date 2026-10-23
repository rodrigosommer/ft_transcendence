/* Design tokens for "Who knows best?".
The idea is a deck of cards on a table. The card is always warm paper; the room around it is what changes between themes. 
Dark is a lit table in a dark room, light is the almanac the project started as. 
Because the card keeps its own colours in both, a category's suit and colour never have to be rechecked for contrast twice.
Every token is RGB channels instead of a hex string so Tailwind's opacity modifiers ('border-correct/40') still work through the CSS variable.
Rules this palette keeps:
- solid colour, no alpha layers stacked to fake a shade
- no gradients on surfaces, no coloured glows, no backdrop blur
- truth and myth are muted, never neon
 - green and red are reserved for the outcome; the two answers are blue and plum, so no button is coloured by whether it is correct */
const token = (name) => `rgb(var(${name}) / <alpha-value>)`;

/*@type {import('tailwindcss').Config}*/
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: token('--paper'),
        surface: token('--surface'),
        'surface-2': token('--surface-2'),
        rule: token('--rule'),
        'rule-strong': token('--rule-strong'),
        ink: token('--ink'),
        'ink-soft': token('--ink-soft'),
        muted: token('--muted'),
        spot: token('--spot'),
        'spot-strong': token('--spot-strong'),
        'spot-wash': token('--spot-wash'),
        correct: token('--correct'),
        'correct-wash': token('--correct-wash'),
        wrong: token('--wrong'),
        'wrong-wash': token('--wrong-wash'),
        truth: token('--truth'),
        'truth-wash': token('--truth-wash'),
        myth: token('--myth'),
        'myth-wash': token('--myth-wash'),
        card: token('--card'),
        'card-rule': token('--card-rule'),
        'card-edge': token('--card-edge'),
        'card-ink': token('--card-ink'),
        'card-soft': token('--card-soft'),
        'card-dim': token('--card-dim'),
        'deck-near': token('--deck-near'),
        'deck-far': token('--deck-far'),
        cat: token('--cat'),
        'cat-wash': token('--cat-wash'),
      },
      fontFamily: {
        sans: ['Archivo', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
        serif: ['Iowan Old Style', 'Palatino Linotype', 'Palatino', 'Charter', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '6px',
        sm: '4px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        '2xl': '14px',
      },
      boxShadow: {
        raised: '0 1px 2px rgb(var(--shadow) / 0.16)',
        card: '0 18px 34px -18px rgb(var(--shadow) / 0.55)',
        none: 'none',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        reveal: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 180ms ease-out both',
        reveal: 'reveal 160ms ease-out both',
      },
    },
  },
  plugins: [],
};
