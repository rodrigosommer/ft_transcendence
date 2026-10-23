import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import type { ClientRoomEvent } from '@wkb/shared';
import { localeSchema, roomCodeSchema, roomSettingsSchema } from '@wkb/shared';
import { prisma } from '../db.js';
import { Channel } from './connection.js';
import { redeemTicket } from './ticket.js';
import { RoomSession } from '../game/engine.js';
import { getSession, setSession } from '../game/registry.js';
import { markMatchupPlaying } from '../services/tournament.js';
import { availableDeckSize } from '../game/draw.js';

// A real client joins once per connection. Guessing private room codes would take thousands, so a socket gets a few tries and is then closed
const MAX_FAILED_JOINS = 5;

/* This is the match channel; a socket has no room until it sends 'room:join', so a first join and a reconnection 
use the same handshake and get the same 'room:state' snapshot.*/
export async function registerRoomChannel(app: FastifyInstance): Promise<void> {
  app.get('/ws/room', { websocket: true }, (socket: WebSocket, request: FastifyRequest) => {
    const query = request.query as { ticket?: string };
    const redeemed = redeemTicket(query.ticket);
    if (!redeemed) 
    {
      socket.send(JSON.stringify({ type: 'error', code: 'error.ws.badTicket', message: 'error.ws.badTicket' }));
      socket.close(4401, 'unauthorized');
      return;
    }
    let session: RoomSession | null = null;
    const channel = new Channel(socket, redeemed.userId, redeemed.locale, () => {
      request.log.debug({ userId: redeemed.userId }, 'room socket heartbeat timeout');
    });
    channel.startHeartbeat();
    const fail = (code: string) => channel.send({ type: 'error', code, message: code });
    const refreshEveryone = async (target: RoomSession | null = session) => {
      if (!target) 
        return;
      for (const peer of target.channelList()) 
      {
        const snapshot = await target.snapshot(peer);
        if (snapshot) 
          peer.send(snapshot);
      }
    };

    /* One socket, one queue; a WebSocket delivers in order, so the handlers have to run in order too.
    Without this, a client that sends 'add_bot' and 'match:start' back to back can have the start read the room before
    the bot is in it, and be told it needs a second player.*/
    let inOrder: Promise<void> = Promise.resolve();
    let failedJoins = 0;
    const failJoin = (code: string) => {
      failedJoins += 1;
      fail(code);
      if (failedJoins >= MAX_FAILED_JOINS)
        channel.close(1008, 'too many failed joins');
    };
    socket.on('message', (raw: Buffer) => {
      // Checked before parsing, so a flood costs as little as possible
      const admitted = channel.admit();
      if (admitted === 'close')
        return channel.close(1008, 'rate limited');
      if (admitted === 'drop')
        return fail('error.rateLimited');
      let event: ClientRoomEvent;
      try {
        event = JSON.parse(raw.toString()) as ClientRoomEvent;
      } catch {
        return fail('error.ws.badPayload');
      }
      if (typeof event?.type !== 'string') 
        return fail('error.ws.badPayload');

      /* A pong is a clock reading. Time spent waiting for a database would otherwise be counted as round trip latency, 
      and a larger latency estimate is exactly what widens the window a claimed reaction time is allowed to fall in.*/
      if (event.type === 'pong') 
        return channel.handlePong(Number(event.t));
      inOrder = inOrder.then(async () => {
        switch (event.type) {
          case 'room:join': {
            if (session) 
              return fail('error.ws.alreadyJoined');
            const parsedCode = roomCodeSchema.safeParse(event.code);
            if (!parsedCode.success)
              return failJoin('error.room.notFound');
            const room = await prisma.room.findUnique({ where: { code: parsedCode.data } });
            if (!room)
              return failJoin('error.room.notFound');
            const matchup = await prisma.tournamentMatchup.findFirst({
              where: { roomId: room.id, status: { in: ['ready', 'playing'] } }
            });
            if (matchup && channel.userId !== matchup.playerAId && channel.userId !== matchup.playerBId)
              return failJoin('error.room.full');
            let existing = getSession(room.id);
            if (!existing) 
            {
              existing = new RoomSession(room.id, room.code);
              setSession(room.id, existing);
            }
            // A player already in the running match is reconnecting; anyone else is joining, and a full match has no seat for them.
            const rejoining = existing.isInMatch(channel.userId);
            if (!rejoining && existing.hasMatch)
              return failJoin('error.room.matchInProgress');
            if (!rejoining && !existing.hasMatch && existing.participantCount() >= room.maxPlayers)
              return failJoin('error.room.full');
            session = existing;
            existing.attach(channel);
            if (rejoining) 
              await existing.markReconnected(channel.userId);
            const snapshot = await existing.snapshot(channel);
            if (snapshot) 
              channel.send(snapshot);
            await refreshEveryone();
            await existing.publishRoom();
            return;
          }
          case 'locale:set': {
            const parsed = localeSchema.safeParse(event.locale);
            if (!parsed.success) 
              return fail('error.validation');
            if (!session) 
            {
              channel.locale = parsed.data;
              return;
            }
            await session.retranslate(channel, parsed.data);
            return;
          }
          case 'room:leave': {
            if (!session) 
              return;
            const leaving = session;
            leaving.detach(channel);
            await leaving.markDisconnected(channel.userId);
            // Hands the room on if this was the host, and stops the match if the room is now bots talking to themselves.
            await leaving.handleDeparture();
            session = null;
            if (leaving.isEmpty && !leaving.hasMatch) 
              await leaving.dispose();
            else 
            {
              await leaving.publishRoom();
              await refreshEveryone(leaving);
            }
            channel.close(1000, 'left');
            return;
          }
          case 'room:settings': {
            if (!session) 
              return fail('error.ws.notInRoom');
            if (session.hasMatch) 
              return fail('error.match.alreadyRunning');
            const room = await prisma.room.findUnique({ where: { id: session.roomId } });
            if (!room) 
              return fail('error.notFound');
            if (room.hostUserId !== channel.userId) 
              return fail('error.match.hostOnly');
            const parsed = roomSettingsSchema.safeParse(event.settings);
            if (!parsed.success) 
              return fail('error.validation');
            const matchup = await prisma.tournamentMatchup.findFirst({
              where: { roomId: room.id },
              select: { id: true },
            });
            if (matchup)
              return fail('error.tournament.alreadyStarted');
            if (room.mode === 'category' && parsed.data.categoryIds.length === 0)
              return fail('error.validation');
            const available = await availableDeckSize({
              categoryIds: parsed.data.categoryIds,
              difficulty: room.difficulty,
            });
            if (available < 4)
              return fail('error.room.notEnoughCards');
            await prisma.roomSettings.update({
              where: { roomId: session.roomId },
              data: {
                cardCount: Math.min(parsed.data.cardCount, available),
                categoryIds: parsed.data.categoryIds,
                answerWindowMs: parsed.data.answerWindowMs,
                comboEnabled: parsed.data.comboEnabled,
                doubleCardEnabled: parsed.data.doubleCardEnabled,
              },
            });
            await refreshEveryone();
            await session.publishRoom();
            return;
          }
          case 'room:add_bot': {
            if (!session) 
              return fail('error.ws.notInRoom');
            if (session.hasMatch) 
              return fail('error.match.alreadyRunning');
            const room = await prisma.room.findUnique({ where: { id: session.roomId } });
            if (!room) 
              return fail('error.notFound');
            if (room.hostUserId !== channel.userId) 
              return fail('error.match.hostOnly');
            if (session.participantCount() >= room.maxPlayers) 
              return fail('error.room.full');
            const profile = await prisma.botProfile.findUnique({
              where: { id: Number(event.profileId) },
            });
            if (!profile)
              return fail('error.notFound');
            if (session.botIds().includes(profile.userId)) 
              return fail('error.room.botAlreadyIn');
            session.addBot(profile.userId);
            await refreshEveryone();
            await session.publishRoom();
            return;
          }
          case 'room:remove_player': {
            if (!session) 
              return fail('error.ws.notInRoom');
            if (session.hasMatch) 
              return fail('error.match.alreadyRunning');
            const room = await prisma.room.findUnique({ where: { id: session.roomId } });
            if (!room) 
              return fail('error.notFound');
            if (room.hostUserId !== channel.userId) 
              return fail('error.match.hostOnly');
            const matchup = await prisma.tournamentMatchup.findFirst({
              where: { roomId: room.id },
              select: { id: true },
            });
            if (matchup)
              return fail('error.tournament.alreadyStarted');
            const targetId = Number(event.userId);
            if (targetId === channel.userId) 
              return fail('error.room.cannotRemoveHost');
            session.removeBot(targetId);
            session.kick(targetId);
            await refreshEveryone();
            await session.publishRoom();
            return;
          }
          case 'match:start': {
            if (!session) 
              return fail('error.ws.notInRoom');
            const error = await session.start(channel.userId);
            if (error) 
              return fail(error);
            await markMatchupPlaying(session.roomId).catch(() => undefined);
            return;
          }
          case 'card:vote': {
            if (!session) 
              return fail('error.ws.notInRoom');
            await session.handleVote({
              channel,
              matchCardId: Number(event.matchCardId),
              choice: event.choice === 'myth' ? 'myth' : 'truth',
              reactionMs: Number(event.reactionMs),
            });
            return;
          }
          default:
            return fail('error.ws.unknownEvent');
        }
      }).catch((error: unknown) => {
        request.log.error({ err: error }, 'room channel handler failed');
        fail('error.internal');
      });
    });
    /*The close goes on the same queue, behind whatever this socket already sent. 
    Off the queue, a tab closed right after 'match:start' could have
    the departure run first, find no match to stop, and let the start finish afterwards into a room nobody is in.*/
    socket.on('close', () => {
      channel.markClosed();
      inOrder = inOrder
        .then(async () => {
          if (!session) 
            return;
          const leaving = session;
          leaving.detach(channel);
          await leaving.markDisconnected(channel.userId);
          await leaving.handleDeparture();
          if (leaving.isEmpty && !leaving.hasMatch) 
            await leaving.dispose();
          else 
          {
            await leaving.publishRoom();
            await refreshEveryone(leaving);
          }
        })
        .catch((error: unknown) => {
          request.log.error({ err: error, userId: channel.userId }, 'room channel close handler failed');
        });
    });
    socket.on('error', () => channel.markClosed());
  });
}
