import type { Difficulty, Vote } from '@wkb/shared';
import { normalSample, randomUnit } from '../lib/random.js';

export interface BotBrain 
{
  label: string;
  // { "<category slug>": 0..1 } plus a '_default' entry.
  accuracyByCategory: Record<string, number>;
  //Calibrated for the medium window (10s)
  reactionMsMean: number;
  reactionMsStddev: number;
}

export interface BotDecision 
{
  // null means the bot let the timer run out, which humans also do
  choice: Vote | null;
  delayMs: number;
}

const CALIBRATION_WINDOW_MS = 10_000;

// Harder cards are harder for the bot too
const DIFFICULTY_ACCURACY_SHIFT: Record<Difficulty, number> = {
  easy: 0.08,
  medium: 0,
  hard: -0.08,
};

export function accuracyFor(brain: BotBrain, categorySlug: string, difficulty: Difficulty): number 
{
  const base = brain.accuracyByCategory[categorySlug] ?? brain.accuracyByCategory['_default'] ?? 0.6;
  return Math.min(0.97, Math.max(0.2, base + DIFFICULTY_ACCURACY_SHIFT[difficulty]));
}

/* Bot's answer to one card; the bot is a fictional player, not an AI, it misses on its weak
categories and sometimes answers too late */
export function decideBotAnswer(params: {
  brain: BotBrain;
  categorySlug: string;
  difficulty: Difficulty;
  cardIsTrue: boolean;
  windowMs: number;
}): BotDecision {
  const { brain, categorySlug, difficulty, cardIsTrue, windowMs } = params;

  const accuracy = accuracyFor(brain, categorySlug, difficulty);
  const answersCorrectly = randomUnit() < accuracy;
  const votesTruth = answersCorrectly ? cardIsTrue : !cardIsTrue;
  const choice: Vote = votesTruth ? 'truth' : 'myth';

  const scale = windowMs / CALIBRATION_WINDOW_MS;
  const mean = brain.reactionMsMean * scale;
  const stddev = brain.reactionMsStddev * scale;

  let delayMs = Math.round(normalSample(mean, stddev));

  // No one reacts in under 400 ms, and a sample past the deadline is a bot that didn't answer in time
  const floor = Math.min(400, Math.round(windowMs * 0.1));
  if (delayMs < floor)
    delayMs = floor;
  if (delayMs >= windowMs)
    return { choice: null, delayMs: windowMs };

  return { choice, delayMs };
}
