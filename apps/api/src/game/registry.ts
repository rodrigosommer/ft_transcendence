import type { RoomSummary, ServerLobbyEvent } from '@wkb/shared';
import type { Channel } from '../ws/connection.js';
import type { RoomSession } from './engine.js';

/* Live rooms and the lobby channel, kept in memory.  Each running match lives here and gets saved to Postgres as it changes. 
It only works because the API runs as one process. To run more than one the timers would need a shared lock. */
const rooms = new Map<number, RoomSession>();
export function getSession(roomId: number): RoomSession | undefined {
  return rooms.get(roomId);
}

export function setSession(roomId: number, session: RoomSession): void {
  rooms.set(roomId, session);
}

export function dropSession(roomId: number): void {
  rooms.delete(roomId);
}

export function activeSessions(): RoomSession[] {
  return [...rooms.values()];
}

//Lobby Channel
const lobbyChannels = new Set<Channel>();

export function joinLobby(channel: Channel): void {
  lobbyChannels.add(channel);
}

export function leaveLobby(channel: Channel): void {
  lobbyChannels.delete(channel);
}

export function lobbyBroadcast(event: ServerLobbyEvent): void {
  for (const channel of lobbyChannels) 
    channel.send(event);
}

export function announceRoom(room: RoomSummary): void {
  // Private rooms are reachable by code only and never appear in the listing
  if (room.visibility !== 'public') 
    return;
  /* A room nobody is standing in is not worth advertising. Rooms outlive their occupants by design, so their invite code stays valid and their matches
  stay linked. Leaving them in the listing would fill the lobby with dead entries that only show themselves as empty once somebody tries to join. */
  if (room.playerCount === 0) 
  {
    announceRoomRemoved(room.id);
    return;
  }
  lobbyBroadcast({ type: 'lobby:room_upserted', room });
}

export function announceRoomRemoved(roomId: number): void {
  lobbyBroadcast({ type: 'lobby:room_removed', roomId });
}

export function announcePresence(userId: number, online: boolean): void {
  lobbyBroadcast({ type: 'presence:update', userId, online });
}

//Distinct users currently holding at least one lobby socket
export function onlineUserIds(): Set<number> {
  const ids = new Set<number>();
  for (const channel of lobbyChannels)
    ids.add(channel.userId);
  return ids;
}

// A user counts as online while a lobby socket is open, or when seen very recently (the REST calls keep 'last_seen_at' fresh)
const ONLINE_WINDOW_MS = 90_000;

export function isOnline(userId: number, lastSeenAt: Date | null, live: Set<number>): boolean {
  if (live.has(userId))
    return true;
  if (!lastSeenAt)
    return false;
  return Date.now() - lastSeenAt.getTime() < ONLINE_WINDOW_MS;
}
