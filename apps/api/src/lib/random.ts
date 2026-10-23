import { randomBytes, randomInt } from 'node:crypto';

//Excludes I, O, 0 and 1: room codes get read aloud and typed by hand
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function roomCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i += 1) 
  {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

export function token(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

//Fair shuffle (Fisher-Yates) using secure random numbers
export function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) 
  {
    const j = randomInt(i + 1);
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

export function randomUnit(): number {
  return randomInt(2 ** 47) / 2 ** 47;
}

// Box-Muller transform. Gives bot reaction times a normal distribution instead of a uniform one so they look less like a bot
export function normalSample(mean: number, stddev: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = randomUnit();
  while (v === 0) v = randomUnit();
  return mean + stddev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
