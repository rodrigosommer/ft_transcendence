import { SCORING } from './constants.js';

export interface ScoreInput {
  correct: boolean | null;
  reactionMs: number;
  windowMs: number;
  comboBefore: number;
  comboEnabled: boolean;
  isDouble: boolean;
}

export interface ScoreResult {
  points: number;
  speedBonus: number;
  comboAfter: number;
  comboMultiplier: number;
}

export function computeScore(input: ScoreInput): ScoreResult {
  const { correct, reactionMs, windowMs, comboBefore, comboEnabled, isDouble } = input;
  if (correct === null) 
  {
    return { points: SCORING.NO_ANSWER, speedBonus: 0, comboAfter: 0, comboMultiplier: 1 };
  }
  if (!correct) 
  {
    const points = isDouble ? SCORING.WRONG_PENALTY * SCORING.DOUBLE_CARD_MULTIPLIER : SCORING.WRONG_PENALTY;
    return { points, speedBonus: 0, comboAfter: 0, comboMultiplier: 1 };
  }
  const ratio = Math.min(1, Math.max(0, reactionMs / windowMs));
  const speedBonus = Math.round(SCORING.MAX_SPEED_BONUS * (1 - ratio));
  const comboAfter = comboBefore + 1;
  const comboMultiplier = comboEnabled ? 1 + Math.min(SCORING.COMBO_MAX_BONUS, comboBefore * SCORING.COMBO_STEP) : 1;
  let points = Math.round((SCORING.BASE + speedBonus) * comboMultiplier);
  if (isDouble) 
    points *= SCORING.DOUBLE_CARD_MULTIPLIER;
  return { points, speedBonus, comboAfter, comboMultiplier };
}

const MAX_TRUSTED_RTT_MS = 1_000;

/* The most network delay a reaction is credited with. The round trip estimate comes from the client's own pongs, which a client can hold back
on purpose to look slower than it is, so the allowance is capped and holding pongs back can buy at most this much */
export const MAX_LATENCY_ALLOWANCE_MS = 250;

/* Decides the reaction time that is scored. 'serverElapsedMs' runs from the moment the server sent the card to the moment the vote arrived,
so it is the reaction plus one round trip; the round trip (capped) is taken off and the rest is what gets scored. The client's own claim
is never scored, it is only compared with the measurement: a claim that can't be true (outside the window the network allows) marks
the vote untrusted, and an untrusted vote gets the slowest time */
export function validateReaction(params: {
  claimedMs: number;
  serverElapsedMs: number;
  rttMs: number;
  windowMs: number;
  toleranceMs?: number;
}): { acceptedMs: number; trusted: boolean } {
  const { claimedMs, serverElapsedMs, windowMs } = params;
  const tolerance = params.toleranceMs ?? 250;
  const rttMs = Math.min(Math.max(0, params.rttMs), MAX_TRUSTED_RTT_MS);
  const lower = Math.max(0, serverElapsedMs - rttMs - tolerance);
  const upper = serverElapsedMs + tolerance;
  const trusted =
    Number.isFinite(claimedMs) && claimedMs >= 0 && claimedMs >= lower && claimedMs <= upper;
  const measuredMs = Math.max(0, Math.round(serverElapsedMs - Math.min(rttMs, MAX_LATENCY_ALLOWANCE_MS)));
  const acceptedMs = trusted ? Math.min(measuredMs, windowMs) : windowMs;
  return { acceptedMs, trusted };
}

export function applyDelta(
  currentScore: number,
  points: number,
): { score: number; delta: number } {
  const score = Math.max(0, currentScore + points);
  return { score, delta: score - currentScore };
}
