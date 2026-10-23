import { prisma } from '../db.js';
import { log } from '../lib/logger.js';
import { getSession } from '../game/registry.js';

/* Housekeeping for the tables that only ever grow. Runs shortly after boot and then every hour, in the API process itself;
there is one API process, so there is no second copy of this job to race with */

const HOUR_MS = 60 * 60 * 1000;
/* Revoked refresh tokens are kept a day. 'wasJustRotated' only looks back a few seconds, the rest of the day is a margin for
reading the logs after an incident. Expired ones are useless the moment they expire */
const REVOKED_TOKEN_KEEP_MS = 24 * HOUR_MS;
/* A room nobody ever played a match in is deleted after a day. Rooms with a match are kept, they hold match history and the statistics
read from it, and deleting the room would cascade into both */
const UNUSED_ROOM_KEEP_MS = 24 * HOUR_MS;
const ROOMS_PER_SWEEP = 500;

export async function sweep(): Promise<void> {
  const now = Date.now();
  const tokens = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date(now) } },
        { revokedAt: { lt: new Date(now - REVOKED_TOKEN_KEEP_MS) } },
      ],
    },
  });

  const candidates = await prisma.room.findMany({
    where: {
      status: 'lobby',
      createdAt: { lt: new Date(now - UNUSED_ROOM_KEEP_MS) },
      matches: { none: {} },
    },
    select: { id: true },
    take: ROOMS_PER_SWEEP,
  });
  // A tournament matchup points at its room by id without a foreign key, so those rooms are skipped, as is any room someone is standing in
  const linked = await prisma.tournamentMatchup.findMany({
    where: { roomId: { in: candidates.map((room) => room.id) } },
    select: { roomId: true },
  });
  const keep = new Set(linked.map((matchup) => matchup.roomId));
  const removable = candidates.map((room) => room.id).filter((id) => !keep.has(id) && !getSession(id));
  // 'matches: none' again, in case a match started in one of them since the read above
  const rooms = await prisma.room.deleteMany({
    where: { id: { in: removable }, matches: { none: {} } },
  });

  if (tokens.count > 0 || rooms.count > 0)
    log.info({ refreshTokens: tokens.count, rooms: rooms.count }, 'maintenance sweep');
}

// Starts the schedule and returns the function that stops it
export function startMaintenance(): () => void {
  const run = () => {
    sweep().catch((error: unknown) => log.error({ err: error }, 'maintenance sweep failed'));
  };
  // unref: a pending sweep never keeps the process alive on shutdown
  const first = setTimeout(run, 60_000);
  first.unref();
  const timer = setInterval(run, HOUR_MS);
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
