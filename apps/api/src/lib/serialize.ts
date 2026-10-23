import { levelFromXp, xpIntoLevel } from '@wkb/shared';

export interface SessionUser {
  id: number;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  locale: string;
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  createdAt: string;
  hasPassword: boolean;
  //False until the first-run setup screen has been completed or skipped.
  onboarded: boolean;
}

// Response shape for the signed in user's own data
export function sessionUser(user: {
  id: number;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  locale: string;
  xp: number;
  passwordHash: string | null;
  onboardedAt: Date | null;
  createdAt: Date;
}): SessionUser {
  const level = levelFromXp(user.xp);
  const { into, needed } = xpIntoLevel(user.xp);
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    locale: user.locale,
    xp: user.xp,
    level,
    xpIntoLevel: into,
    xpForNextLevel: needed,
    createdAt: user.createdAt.toISOString(),
    hasPassword: user.passwordHash !== null,
    onboarded: user.onboardedAt !== null,
  };
}

// The columns 'publicProfile' reads, for queries that only need those rather than the whole row
export const publicProfileSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
  xp: true,
  isBot: true,
  lastSeenAt: true,
  createdAt: true,
} as const;

//What other users see. Never include the email
export function publicProfile(user: {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  xp: number;
  isBot: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    level: levelFromXp(user.xp),
    xp: user.xp,
    isBot: user.isBot,
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
