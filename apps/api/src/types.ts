import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    // Populated by 'requireAuth / 'optionalAuth'
    authUser?: { id: number; displayName: string };
  }
}
