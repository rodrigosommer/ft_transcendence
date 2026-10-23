import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { conflict } from './httpError.js';

/* Display names are unique without regard to case: "Ada" and "ada" would be two different people that look the same on the leaderboard.
The database enforces it with a unique index on lower(display_name) (migration 20261013120000). This check runs first so the usual case
gets a clean field error; it folds ASCII only, and the index, which folds accented letters too, catches the rest as a P2002 */
export async function displayNameTaken(name: string, exceptUserId = 0): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM users WHERE lower(display_name) = lower(${name}) AND id <> ${exceptUserId} LIMIT 1`;
  return rows.length > 0;
}

// The unique violation raised when a name is already taken, by either display name index, including two requests racing for the same name
export function isDisplayNameClash(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
    return false;
  const target = error.meta?.target;
  const fields = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return /display_?name/i.test(fields);
}

export const displayNameConflict = () => conflict('error.alreadyExists', { displayName: 'error.alreadyExists' });
