import type { RoomSummary } from '@wkb/shared';
import { prisma } from '../db.js';
import { activeSessions, getSession } from '../game/registry.js';

const roomInclude = {
  host: { select: { displayName: true } },
  category: { select: { name: true, slug: true } },
  settings: true,
} as const;

type RoomWithRelations = Awaited<
  ReturnType<typeof prisma.room.findFirstOrThrow<{ include: typeof roomInclude }>>
>;

//The lobby view of a room. 'playerCount' uses the live sessions when it exists
export async function buildRoomSummary(room: RoomWithRelations): Promise<RoomSummary> {
  const session = getSession(room.id);
  let categories: { slug: string; name: string }[] = [];
  const settingsCategories = room.settings?.categoryIds ?? [];
  if (settingsCategories.length > 0) 
  {
    categories = await prisma.category.findMany({
      where: { id: { in: settingsCategories } },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
  else if (room.category)
  {
    categories = [{ slug: room.category.slug, name: room.category.name }];
  }
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    mode: room.mode,
    visibility: room.visibility,
    difficulty: room.difficulty,
    status: room.status,
    categories,
    /* Nobody is in a room whose humans have all gone, even while its match waits for them to come back (the abandon grace period);
    0 here is what takes it off the lobby list */
    playerCount: session && !session.isEmpty ? session.participantCount() : 0,
    maxPlayers: room.maxPlayers,
    hostDisplayName: room.host.displayName,
  };
}

export async function roomSummaryById(roomId: number): Promise<RoomSummary | null> {
  const room = await prisma.room.findUnique({ where: { id: roomId }, include: roomInclude });
  if (!room) 
    return null;
  return buildRoomSummary(room);
}

/* It starts from the rooms the engine has occupants for, then loads those from the database,
because querying the newest rooms first could miss a busy older one  */
export async function listPublicRooms(): Promise<RoomSummary[]> {
  // A human has to be in it; bots alone, waiting out the grace period for players who left, are not worth listing
  const occupied = activeSessions()
    .filter((session) => !session.isEmpty)
    .map((session) => session.roomId);
  if (occupied.length === 0) 
    return [];
  const rows = await prisma.room.findMany({
    where: { id: { in: occupied }, visibility: 'public', status: { in: ['lobby', 'playing'] } },
    include: roomInclude,
    orderBy: { createdAt: 'desc' },
    take: 60,
  });
  return Promise.all(rows.map(buildRoomSummary));
}

export { roomInclude };
