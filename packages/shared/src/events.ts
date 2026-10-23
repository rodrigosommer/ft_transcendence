import type { Difficulty, Locale } from './constants.js';

/* '/ws/lobby' for the public room list, '/ws/room' for one match. They're separate so messages never need routing by room id. 
Both authenticate with a single use ticket from 'POST /api/ws/ticket' */

export type RoomStatus = 'lobby' | 'playing' | 'finished';
export type MatchPhase = 'countdown' | 'serving' | 'collecting' | 'revealing' | 'scoreboard';
export type Vote = 'truth' | 'myth';

export interface PublicUser {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  isBot: boolean;
}

export interface ScoreboardEntry {
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  isBot: boolean;
  score: number;
  comboCurrent: number;
  comboMax: number;
  connected: boolean;
  rank: number;
  // Points gained or lost on the card that was just revealed
  lastDelta: number | null;
}

export interface RoomSummary {
  id: number;
  code: string;
  name: string;
  mode: 'general' | 'category';
  visibility: 'public' | 'private';
  difficulty: Difficulty;
  status: RoomStatus;
  categories: { slug: string; name: string }[];
  playerCount: number;
  maxPlayers: number;
  hostDisplayName: string;
}

export interface RoomSettingsPayload {
  cardCount: number;
  categoryIds: number[];
  answerWindowMs: number;
  comboEnabled: boolean;
  doubleCardEnabled: boolean;
}

export interface ServedCard {
  matchCardId: number;
  position: number;
  total: number;
  text: string;
  categorySlug: string;
  categoryName: string;
  difficulty: Difficulty;
  servedAt: number;
  deadlineAt: number;
  windowMs: number;
  isDouble: boolean;
  fallbackLocale?: Locale;
}

export interface RevealedPlayerResult {
  userId: number;
  choice: Vote | null;
  correct: boolean | null;
  points: number;
  reactionMs: number | null;
  //False when the reported reaction time failed RTT validation.
  reactionTrusted: boolean;
}

export interface MatchStateSnapshot {
  matchId: number;
  phase: MatchPhase;
  position: number;
  total: number;
  card: ServedCard | null;
  remainingMs: number;
  myVote: Vote | null;
  scoreboard: ScoreboardEntry[];
}

// Client -> server

export type ClientLobbyEvent = { type: 'pong'; t: number };

export type ClientRoomEvent =
  | { type: 'room:join'; code: string }
  | { type: 'room:leave' }
  // Switching language mid match means the next card comes in the new one
  | { type: 'locale:set'; locale: Locale }
  | { type: 'room:settings'; settings: RoomSettingsPayload }
  | { type: 'room:add_bot'; profileId: number }
  | { type: 'room:remove_player'; userId: number }
  | { type: 'match:start' }
  | { type: 'card:vote'; matchCardId: number; choice: Vote; reactionMs: number }
  | { type: 'pong'; t: number };

export type ClientEvent = ClientLobbyEvent | ClientRoomEvent;

// Server -> client

export type ServerLobbyEvent =
  | { type: 'lobby:rooms'; rooms: RoomSummary[] }
  | { type: 'lobby:room_upserted'; room: RoomSummary }
  | { type: 'lobby:room_removed'; roomId: number }
  | { type: 'presence:update'; userId: number; online: boolean }
  | { type: 'ping'; t: number }
  | { type: 'error'; code: string; message: string };

export type ServerRoomEvent =
  | {
      type: 'room:state';
      room: RoomSummary;
      settings: RoomSettingsPayload;
      hostUserId: number;
      players: PublicUser[];
      you: { userId: number };
      match: MatchStateSnapshot | null;
    }
  | { type: 'match:started'; matchId: number; total: number; startsInMs: number }
  | { type: 'card:served'; card: ServedCard }
  | {
      type: 'card:revealed';
      matchCardId: number;
      isTrue: boolean;
      sourceRef: string | null;
      correction: string;
      results: RevealedPlayerResult[];
      scoreboard: ScoreboardEntry[];
      nextInMs: number;
      isLast: boolean;
    }
  | { type: 'scoreboard:update'; scoreboard: ScoreboardEntry[] }
  | {
      type: 'match:ended';
      matchId: number;
      scoreboard: ScoreboardEntry[];
      awards: MatchAward[];
      tournament: { id: number; advancedUserId: number | null } | null;
    }
  | { type: 'vote:ack'; matchCardId: number; choice: Vote }
  | { type: 'ping'; t: number }
  | { type: 'error'; code: string; message: string };

export type ServerEvent = ServerLobbyEvent | ServerRoomEvent;

export interface MatchAward {
  userId: number;
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  achievements: { slug: string; name: string; description: string }[];
}

export function isServerEvent(value: unknown): value is ServerEvent {
  return (typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string');
}
