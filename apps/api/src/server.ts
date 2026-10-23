import { mkdir } from 'node:fs/promises';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { AVATAR_MAX_BYTES } from '@wkb/shared';
import './types.js';
import { prisma } from './db.js';
import { env } from './env.js';
import { setLogger } from './lib/logger.js';
import { registerErrorHandler } from './plugins/errors.js';
import { authRoutes } from './routes/auth.js';
import { catalogRoutes } from './routes/catalog.js';
import { friendRoutes } from './routes/friends.js';
import { healthRoutes } from './routes/health.js';
import { oauthRoutes } from './routes/oauth.js';
import { roomRoutes } from './routes/rooms.js';
import { statsRoutes } from './routes/stats.js';
import { tournamentRoutes } from './routes/tournaments.js';
import { UPLOAD_DIR, userRoutes } from './routes/users.js';
import { registerLobbyChannel } from './ws/lobby.js';
import { registerRoomChannel } from './ws/room.js';
import { startMaintenance } from './services/maintenance.js';

async function build() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      /*WebSocket tickets and OAuth codes travel after the '?', 
      so each request is logged by its path alone and those never reach a log file.*/
      serializers: {
        req: (request) => ({
          method: request.method,
          url: request.url?.split('?')[0],
        }),
      },
    },
    trustProxy: (_address, hop) => hop === 0,
    bodyLimit: 1_048_576,
  });
  registerErrorHandler(app);
  await app.register(cookie);
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
  });
  await app.register(multipart, {
    limits: { fileSize: AVATAR_MAX_BYTES, files: 1, fields: 4 },
  });
  await app.register(websocket, {
    options: { maxPayload: 64 * 1024 },
  });
  await mkdir(UPLOAD_DIR, { recursive: true });
  await app.register(fastifyStatic, {
    root: UPLOAD_DIR,
    prefix: '/api/uploads/',
    //User uploaded bytes ie the browser must not guess their type or run them in our origin.
    setHeaders(reply) {
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Content-Security-Policy', "default-src 'none'; sandbox");
      reply.header('Cache-Control', 'public, max-age=86400');
    },
  });
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(oauthRoutes);
  await app.register(userRoutes);
  await app.register(friendRoutes);
  await app.register(roomRoutes);
  await app.register(catalogRoutes);
  await app.register(statsRoutes);
  await app.register(tournamentRoutes);
  await app.register(registerLobbyChannel);
  await app.register(registerRoomChannel);
  return app;
}

async function main(): Promise<void> {
  const app = await build();
  setLogger(app.log);
  /* Safety net. Every promise in the match loop handles its own errors, but one that slips through would otherwise end the process
  (Node's default for an unhandled rejection), and every live match in every room with it. It's logged and the server carries on */
  process.on('unhandledRejection', (reason) => {
    app.log.error({ err: reason }, 'unhandled promise rejection');
  });
  let stopMaintenance: (() => void) | null = null;
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    stopMaintenance?.();
    let exitCode = 0;
    try {
      await app.close();
      await prisma.$disconnect();
    } catch (error) {
      // A shutdown that failed half way should not report success to Docker
      app.log.error({ err: error }, 'shutdown failed');
      exitCode = 1;
    }
    process.exit(exitCode);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  try {
    await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  } catch (error) {
    app.log.error({ err: error }, 'failed to start');
    process.exit(1);
  }
  stopMaintenance = startMaintenance();
}

void main();
