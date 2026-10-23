import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  // Used by the container healthcheck and by the compose dependency ordering.
  app.get('/api/health', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up', uptime: Math.round(process.uptime()) };
    } catch {
      return reply.code(503).send({ status: 'degraded', database: 'down' });
    }
  });
}
