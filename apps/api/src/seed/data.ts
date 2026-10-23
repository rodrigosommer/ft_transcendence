import type { Difficulty } from '@wkb/shared';

// Format of the committed card set files in prisma/seed/facts/.
export interface FactFile {
  category: { slug: string; name: string };
  license: string;
  facts: {
    ref: string;
    difficulty: Difficulty;
    [locale: string]: unknown;
  }[];
}

export interface LocalisedPair {
  // The affirmative wording. Always the true one.
  t: string;
  // The counter wording. Always the false one.
  f: string;
}

export interface BotSeed {
  displayName: string;
  label: string;
  accuracyByCategory: Record<string, number>;
  reactionMsMean: number;
  reactionMsStddev: number;
}

/* Each bot is uneven on purpose, that way they feel more human than bots. 
'reactionMsMean' is set for the 10sec medium window and rescaled at runtime to match the room's window*/
export const BOTS: BotSeed[] = [
  {
    displayName: 'Byte',
    label: 'bot.byte',
    accuracyByCategory: { technology: 0.92, science: 0.74, space: 0.66, _default: 0.52 },
    reactionMsMean: 3200,
    reactionMsStddev: 1100,
  },
  {
    displayName: 'Atlas',
    label: 'bot.atlas',
    accuracyByCategory: { geography: 0.9, history: 0.84, culture: 0.7, _default: 0.53 },
    reactionMsMean: 4200,
    reactionMsStddev: 1300,
  },
  {
    displayName: 'Nova',
    label: 'bot.nova',
    accuracyByCategory: { space: 0.91, science: 0.83, technology: 0.64, _default: 0.5 },
    reactionMsMean: 3800,
    reactionMsStddev: 1200,
  },
  {
    displayName: 'Muse',
    label: 'bot.muse',
    accuracyByCategory: { arts: 0.9, culture: 0.83, history: 0.68, _default: 0.5 },
    reactionMsMean: 4600,
    reactionMsStddev: 1500,
  },
  {
    displayName: 'Pixel',
    label: 'bot.pixel',
    accuracyByCategory: { sports: 0.88, technology: 0.66, _default: 0.5 },
    reactionMsMean: 4000,
    reactionMsStddev: 1200,
  },
  {
    displayName: 'Sage',
    label: 'bot.sage',
    accuracyByCategory: { history: 0.78, culture: 0.76, arts: 0.72, geography: 0.7, _default: 0.62 },
    reactionMsMean: 5000,
    reactionMsStddev: 1600,
  },
  {
    displayName: 'Rookie',
    label: 'bot.rookie',
    accuracyByCategory: { _default: 0.55 },
    reactionMsMean: 6200,
    reactionMsStddev: 1800,
  },
  {
    displayName: 'Oracle',
    label: 'bot.oracle',
    accuracyByCategory: {
      geography: 0.84,
      history: 0.82,
      science: 0.85,
      technology: 0.8,
      arts: 0.78,
      sports: 0.76,
      culture: 0.8,
      space: 0.84,
      _default: 0.8,
    },
    reactionMsMean: 3000,
    reactionMsStddev: 900,
  },
];

export interface AchievementSeed {
  slug: string;
  name: string;
  description: string;
  criteria: Record<string, unknown>;
}

// Achievement rules are in the database as data. 'criteria.kind' is read by services/rewards.ts, so a new badge is a seed change, not a code change.
export const ACHIEVEMENTS: AchievementSeed[] = [
  { slug: 'first-match', name: 'Opening Hand', description: 'Finish your first match.', criteria: { kind: 'matches_played', threshold: 1 } },
  { slug: 'regular', name: 'Regular', description: 'Finish ten matches.', criteria: { kind: 'matches_played', threshold: 10 } },
  { slug: 'first-win', name: 'First Blood', description: 'Win a match.', criteria: { kind: 'matches_won', threshold: 1 } },
  { slug: 'champion', name: 'Champion', description: 'Win five matches.', criteria: { kind: 'matches_won', threshold: 5 } },
  { slug: 'century', name: 'Century', description: 'Answer 100 cards correctly.', criteria: { kind: 'correct_answers', threshold: 100 } },
  { slug: 'polymath', name: 'Polymath', description: 'Answer 300 cards correctly.', criteria: { kind: 'correct_answers', threshold: 300 } },
  { slug: 'combo-5', name: 'On a Roll', description: 'Reach a combo of five.', criteria: { kind: 'best_combo', threshold: 5 } },
  { slug: 'combo-10', name: 'Unstoppable', description: 'Reach a combo of ten.', criteria: { kind: 'best_combo', threshold: 10 } },
  { slug: 'sharpshooter', name: 'Sharpshooter', description: 'Hold 80% accuracy over at least 50 answers.', criteria: { kind: 'accuracy', threshold: 0.8, minAnswers: 50 } },
  { slug: 'flawless', name: 'Flawless', description: 'Finish a match of ten cards or more without a single mistake.', criteria: { kind: 'perfect_match', minAnswers: 10 } },
  { slug: 'quickdraw', name: 'Quickdraw', description: 'Answer correctly in under 1.5 seconds.', criteria: { kind: 'fast_correct', threshold: 1500 } },
  { slug: 'scholar', name: 'Scholar', description: 'Reach level 5.', criteria: { kind: 'level', threshold: 5 } },
  { slug: 'cartographer', name: 'Cartographer', description: 'Answer 25 geography cards correctly.', criteria: { kind: 'category_correct', categorySlug: 'geography', threshold: 25 } },
  { slug: 'stargazer', name: 'Stargazer', description: 'Answer 25 space cards correctly.', criteria: { kind: 'category_correct', categorySlug: 'space', threshold: 25 } },
];

//Accounts people can use and test before signing in. 
export const DEMO_USERS = [
  { email: 'ada@wkb.local', displayName: 'Ada', locale: 'en' },
  { email: 'grace@wkb.local', displayName: 'Grace', locale: 'pt-BR' },
  { email: 'alan@wkb.local', displayName: 'Alan', locale: 'fr' },
];

export const DEMO_PASSWORD = 'Password1!';

//Demo accounts are shared by everyone trying the app, so the settings that would break them for the next person stay fixed.
export function isDemoAccount(email: string): boolean {
  return DEMO_USERS.some((demo) => demo.email === email);
}
