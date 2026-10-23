import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import type { ClientLobbyEvent } from '@wkb/shared';
import { prisma } from '../db.js';
import { Channel } from './connection.js';
import { redeemTicket } from './ticket.js';
import { announcePresence, joinLobby, leaveLobby, onlineUserIds } from '../game/registry.js';
import { listPublicRooms } from '../services/rooms.js';

/* The lobby channel; public room list and presence, it's separate from the match channel so messages don't need a 
"is this socket in a room?" check. It also keeps 'last_seen_at' fresh, which the friends list uses for online status.*/
export async function registerLobbyChannel(app: FastifyInstance): Promise<void> {
  app.get('/ws/lobby', { websocket: true }, (socket: WebSocket, request: FastifyRequest) => {
    const query = request.query as { ticket?: string };
    const redeemed = redeemTicket(query.ticket);
    if (!redeemed) 
    {
      socket.send(
        JSON.stringify({ type: 'error', code: 'error.ws.badTicket', message: 'error.ws.badTicket' }),
      );
      socket.close(4401, 'unauthorized');
      return;
    }
    const channel = new Channel(socket, redeemed.userId, redeemed.locale, () => {
      request.log.debug({ userId: redeemed.userId }, 'lobby socket heartbeat timeout');
    });
    const wasOffline = !onlineUserIds().has(redeemed.userId);
    joinLobby(channel);
    channel.startHeartbeat();
    if (wasOffline) 
      announcePresence(redeemed.userId, true);
    // Not awaited by anyone, so it must not reject; an unhandled rejection would end the process
    void (async () => {
      channel.send({ type: 'lobby:rooms', rooms: await listPublicRooms() });
      await prisma.user.update({ where: { id: redeemed.userId }, data: { lastSeenAt: new Date() } });
    })().catch((error: unknown) => {
      request.log.warn({ err: error, userId: redeemed.userId }, 'lobby socket setup failed');
    });
    const presenceTimer = setInterval(() => {
      void prisma.user
        .update({ where: { id: redeemed.userId }, data: { lastSeenAt: new Date() } })
        .catch(() => undefined);
    }, 30_000);

    socket.on('message', (raw: Buffer) => {
      const admitted = channel.admit();
      if (admitted === 'close')
        return channel.close(1008, 'rate limited');
      if (admitted === 'drop')
        return;
      let event: ClientLobbyEvent;
      try {
        event = JSON.parse(raw.toString()) as ClientLobbyEvent;
      } catch {
        return;
      }
      if (event?.type === 'pong')
        channel.handlePong(Number(event.t));
    });

    socket.on('close', () => {
      clearInterval(presenceTimer);
      channel.markClosed();
      leaveLobby(channel);
      if (!onlineUserIds().has(redeemed.userId))
        announcePresence(redeemed.userId, false);
    });

    socket.on('error', () => {
      clearInterval(presenceTimer);
      channel.markClosed();
      leaveLobby(channel);
    });
  });
}
