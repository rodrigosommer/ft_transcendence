import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomSummary, ServerLobbyEvent } from '@wkb/shared';
import { backoffDelay, openChannel, parseEvent } from './socket.js';

export type ChannelStatus = 'connecting' | 'open' | 'closed';

interface LobbyState {
  status: ChannelStatus;
  rooms: RoomSummary[];
  onlineUserIds: Set<number>;
}

/* The lobby channel; the live public room list plus presence. Reconnects on its own, because a dropped lobby socket should never be
something the player has to notice or act on */
export function useLobbyChannel(enabled: boolean): LobbyState {
  const [status, setStatus] = useState<ChannelStatus>('connecting');
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [onlineUserIds, setOnline] = useState<Set<number>>(() => new Set());
  const socketRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const retryRef = useRef<number | null>(null);
  const closedRef = useRef(false);
  const connect = useCallback(async () => {
    if (closedRef.current) 
      return;
    setStatus('connecting');
    let socket: WebSocket;
    try {
      socket = await openChannel('/ws/lobby');
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
      setStatus('open');
    };
    socket.onmessage = (event) => {
      const parsed = parseEvent(event.data) as ServerLobbyEvent | null;
      if (!parsed) 
        return;
      switch (parsed.type) {
        case 'ping':
          socket.send(JSON.stringify({ type: 'pong', t: parsed.t }));
          break;
        case 'lobby:rooms':
          setRooms(parsed.rooms);
          break;
        case 'lobby:room_upserted':
          setRooms((current) => {
            const next = current.filter((room) => room.id !== parsed.room.id);
            if (parsed.room.status === 'finished') 
              return next;
            return [parsed.room, ...next];
          });
          break;
        case 'lobby:room_removed':
          setRooms((current) => current.filter((room) => room.id !== parsed.roomId));
          break;
        case 'presence:update':
          setOnline((current) => {
            const next = new Set(current);
            if (parsed.online) next.add(parsed.userId);
            else next.delete(parsed.userId);
            return next;
          });
          break;
        default:
          break;
      }
    };
    socket.onclose = () => {
      socketRef.current = null;
      setStatus('closed');
      scheduleRetry();
    };
    socket.onerror = () => {
    };
    function scheduleRetry() 
    {
      if (closedRef.current) 
        return;
      const delay = backoffDelay(attemptRef.current);
      attemptRef.current += 1;
      retryRef.current = window.setTimeout(() => void connect(), delay);
    }
  }, []);
  useEffect(() => {
    if (!enabled) 
      return undefined;
    closedRef.current = false;
    void connect();
    return () => {
      closedRef.current = true;
      if (retryRef.current !== null) 
        window.clearTimeout(retryRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [enabled, connect]);
  return { status, rooms, onlineUserIds };
}
