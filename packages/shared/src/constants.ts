//Shared constants; the server decides and the client imports them only to display the same values
export const LOCALES = ['en', 'pt-BR', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  'pt-BR': 'Português (Brasil)',
  fr: 'Français',
};

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_PRESETS: Record<
  Difficulty,
  { answerWindowMs: number; cardCount: number }
> = {
  easy: { answerWindowMs: 15_000, cardCount: 10 },
  medium: { answerWindowMs: 10_000, cardCount: 20 },
  hard: { answerWindowMs: 6_000, cardCount: 30 },
};

//Scoring constants
export const SCORING = {
  BASE: 100,
  MAX_SPEED_BONUS: 100,
  WRONG_PENALTY: -50,
  NO_ANSWER: 0,
  COMBO_STEP: 0.1,
  COMBO_MAX_BONUS: 0.5,
  DOUBLE_CARD_MULTIPLIER: 2,
} as const;

export const REVEAL_HOLD_MS = 4_000;
export const MATCH_COUNTDOWN_MS = 3_000;
export const PING_INTERVAL_MS = 5_000;
export const PING_MAX_MISSED = 3;

export const ROOM_LIMITS = {
  MIN_PLAYERS: 1,
  MAX_PLAYERS: 8,
  MIN_CARDS: 5,
  MAX_CARDS: 40,
  CODE_LENGTH: 6,
} as const;

export const XP_PER_LEVEL = 500;
export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
}
export function xpIntoLevel(xp: number): { into: number; needed: number } {
  return { into: xp % XP_PER_LEVEL, needed: XP_PER_LEVEL };
}

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
