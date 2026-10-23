import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ClientRoomEvent,
  MatchAward,
  MatchPhase,
  PublicUser,
  RevealedPlayerResult,
  RoomSettingsPayload,
  RoomSummary,
  ScoreboardEntry,
  ServedCard,
  ServerRoomEvent,
  Vote,
} from '@wkb/shared';
import { backoffDelay, openChannel, parseEvent } from './socket.js';
import { onLocaleChange } from '../i18n/localeBus.js';
import { currentLocale } from '../i18n/index.js';
import type { ChannelStatus } from './useLobbyChannel.js';

export interface RevealState {
  matchCardId: number;
  isTrue: boolean;
  sourceRef: string | null;
  //The fact stated correctly in the viewer's language
  correction: string;
  results: RevealedPlayerResult[];
  nextInMs: number;
  isLast: boolean;
}

export interface EndState {
  matchId: number;
  scoreboard: ScoreboardEntry[];
  awards: MatchAward[];
  tournament: { id: number; advancedUserId: number | null } | null;
}

export interface RoomChannelState {
  status: ChannelStatus;
  error: string | null;
  room: RoomSummary | null;
  settings: RoomSettingsPayload | null;
  hostUserId: number | null;
  // Set when the host left and the room was handed to this player.
  becameHost: boolean;
  players: PublicUser[];
  youId: number | null;
  phase: MatchPhase | null;
  card: ServedCard | null;
  reveal: RevealState | null;
  scoreboard: ScoreboardEntry[];
  ended: EndState | null;
  myVote: Vote | null;
  //When the card was painted, used to measure reaction time locally
  renderedAt: number | null;
}

const EMPTY: RoomChannelState = {
  status: 'connecting',
  error: null,
  room: null,
  settings: null,
  hostUserId: null,
  becameHost: false,
  players: [],
  youId: null,
  phase: null,
  card: null,
  reveal: null,
  scoreboard: [],
  ended: null,
  myVote: null,
  renderedAt: null,
};

export interface RoomChannel extends RoomChannelState {
  vote: (choice: Vote) => void;
  start: () => void;
  addBot: (profileId: number) => void;
  removePlayer: (userId: number) => void;
  updateSettings: (settings: RoomSettingsPayload) => void;
  leave: () => void;
  dismissError: () => void;
  dismissEnd: () => void;
  dismissHostNotice: () => void;
}

/*Everything here is driven by the server. The hook never decides that time is up, never computes a score, and never advances a card, ie,
 it renders what the server has already decided. The one number it produces is the local reaction time, measured from the moment the card was painted. 
 Even that is only a claim: the server checks it against its own clock and the connection's round trip time, and scores its own measurement.*/
export function useRoomChannel(code: string | null): RoomChannel {
  const [state, setState] = useState<RoomChannelState>(EMPTY);
  // The latest rendered state, for callbacks that must read it without going through a state updater
  const stateRef = useRef(state);
  stateRef.current = state;
  const socketRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const retryRef = useRef<number | null>(null);
  const closedRef = useRef(false);
  const codeRef = useRef<string | null>(code);
  codeRef.current = code;
  const send = useCallback((event: ClientRoomEvent) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) 
      socket.send(JSON.stringify(event));
  }, []);
  const connect = useCallback(async () => {
    if (closedRef.current || !codeRef.current) 
      return;
    setState((current) => ({ ...current, status: 'connecting' }));
    let socket: WebSocket;
    try {
      socket = await openChannel('/ws/room');
    } catch {
      scheduleRetry();
      return;
    }
    if (closedRef.current) 
    {
      socket.close();
      return;
    }
    socketRef.current = socket;
    socket.onopen = () => {
      attemptRef.current = 0;
      setState((current) => ({ ...current, status: 'open' }));
      socket.send(JSON.stringify({ type: 'locale:set', locale: currentLocale() }));
      if (codeRef.current) 
        socket.send(JSON.stringify({ type: 'room:join', code: codeRef.current }));
    };
    socket.onmessage = (event) => {
      const parsed = parseEvent(event.data) as ServerRoomEvent | null;
      if (!parsed) 
        return;
      switch (parsed.type) {
        case 'ping':
          socket.send(JSON.stringify({ type: 'pong', t: parsed.t }));
          break;
        case 'room:state':
          setState((current) => ({
            ...current,
            error: null,
            room: parsed.room,
            settings: parsed.settings,
            hostUserId: parsed.hostUserId,           
            becameHost:
              current.hostUserId !== null &&
              current.hostUserId !== parsed.hostUserId &&
              parsed.hostUserId === parsed.you.userId
                ? true
                : current.becameHost,
            players: parsed.players,
            youId: parsed.you.userId,
            phase: parsed.match?.phase ?? null,
            card: parsed.match?.card ?? null,
            scoreboard: parsed.match?.scoreboard ?? [],
            myVote: parsed.match?.myVote ?? null,
            renderedAt:
              parsed.match?.card && parsed.match.phase === 'collecting'
                ? Date.now() - (parsed.match.card.windowMs - parsed.match.remainingMs)
                : null,
            reveal: parsed.match?.phase === 'revealing' ? current.reveal : null,
            ended: current.ended,
          }));
          break;
        case 'match:started':
          setState((current) => ({
            ...current,
            phase: 'countdown',
            ended: null,
            reveal: null,
            card: null,
            myVote: null,
          }));
          break;
        case 'card:served':
          setState((current) => ({
            ...current,
            phase: 'collecting',
            card: parsed.card,
            reveal: null,
            myVote: null,
            renderedAt: Date.now(),
          }));
          break;
        case 'vote:ack':
          setState((current) => ({ ...current, myVote: parsed.choice }));
          break;
        case 'card:revealed':
          setState((current) => ({
            ...current,
            phase: 'revealing',
            scoreboard: parsed.scoreboard,
            reveal: {
              matchCardId: parsed.matchCardId,
              isTrue: parsed.isTrue,
              sourceRef: parsed.sourceRef,
              correction: parsed.correction,
              results: parsed.results,
              nextInMs: parsed.nextInMs,
              isLast: parsed.isLast,
            },
          }));
          break;
        case 'scoreboard:update':
          setState((current) => ({ ...current, scoreboard: parsed.scoreboard }));
          break;
        case 'match:ended':
          setState((current) => ({
            ...current,
            phase: 'scoreboard',
            card: null,
            reveal: null,
            scoreboard: parsed.scoreboard,
            ended: {
              matchId: parsed.matchId,
              scoreboard: parsed.scoreboard,
              awards: parsed.awards,
              tournament: parsed.tournament,
            },
          }));
          break;
        case 'error':
          setState((current) => ({
            ...current,
            error: parsed.code,
            // The server could not save the vote and withdrew it, so the buttons unlock and the player can answer again
            myVote: parsed.code === 'error.match.voteFailed' ? null : current.myVote,
          }));
          break;
        default:
          break;
      }
    };
    socket.onclose = () => {
      socketRef.current = null;
      setState((current) => ({ ...current, status: 'closed' }));
      scheduleRetry();
    };
    socket.onerror = () => {};
    function scheduleRetry() {
      if (closedRef.current) 
        return;
      const delay = backoffDelay(attemptRef.current);
      attemptRef.current += 1;
      retryRef.current = window.setTimeout(() => void connect(), delay);
    }
  }, []);
  useEffect(() => {
    if (!code) 
      return undefined;
    closedRef.current = false;
    setState({ ...EMPTY });
    void connect();
    return () => {
      closedRef.current = true;
      if (retryRef.current !== null) 
        window.clearTimeout(retryRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [code, connect]);
  // Tell the server when the player switches language so the cards follow.
  useEffect(() => onLocaleChange((locale) => send({ type: 'locale:set', locale })), [send]);
  /* The vote is sent from here, not from inside a state updater: React may run an updater twice (StrictMode does on purpose),
  and an updater that sends would send the vote twice. The ref is moved on at once, so a second click before the next render is ignored too */
  const vote = useCallback(
    (choice: Vote) => {
      const current = stateRef.current;
      const card = current.card;
      if (!card || current.myVote || current.phase !== 'collecting')
        return;
      const reactionMs = current.renderedAt ? Date.now() - current.renderedAt : card.windowMs;
      send({ type: 'card:vote', matchCardId: card.matchCardId, choice, reactionMs });
      stateRef.current = { ...current, myVote: choice };
      // Shown straight away; 'vote:ack' confirms it, and 'error.match.voteFailed' takes it back
      setState((latest) => (latest.card?.matchCardId === card.matchCardId ? { ...latest, myVote: choice } : latest));
    },
    [send],
  );
  return {
    ...state,
    vote,
    start: useCallback(() => send({ type: 'match:start' }), [send]),
    addBot: useCallback((profileId: number) => send({ type: 'room:add_bot', profileId }), [send]),
    removePlayer: useCallback((userId: number) => send({ type: 'room:remove_player', userId }), [send]),
    updateSettings: useCallback(
      (settings: RoomSettingsPayload) => send({ type: 'room:settings', settings }),
      [send],
    ),
    leave: useCallback(() => {
      closedRef.current = true;
      send({ type: 'room:leave' });
      socketRef.current?.close();
    }, [send]),
    dismissError: useCallback(() => setState((current) => ({ ...current, error: null })), []),
    dismissEnd: useCallback(
      () => setState((current) => ({ ...current, ended: null, phase: null, scoreboard: [] })),
      [],
    ),
    dismissHostNotice: useCallback(
      () => setState((current) => ({ ...current, becameHost: false })),
      [],
    ),
  };
}
