import type { FastifyReply, FastifyRequest } from 'fastify';
import { unauthorized } from '../lib/httpError.js';
import { verifyAccessToken } from '../lib/tokens.js';
import { prisma } from '../db.js';

function bearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) 
    return null;
  const value = header.slice(7).trim();
  return value.length > 0 ? value : null;
}

// Throws 401 when the access token is missing or invalid
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const raw = bearer(request);
  if (!raw) 
    throw unauthorized();
  const claims = await verifyAccessToken(raw);
  if (!claims) 
    throw unauthorized('error.tokenInvalid');
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { lastSeenAt: true },
  });
  if (!user)
    throw unauthorized('error.tokenInvalid');
  request.authUser = { id: claims.sub, displayName: claims.displayName };
  if (!user.lastSeenAt || Date.now() - user.lastSeenAt.getTime() > 30_000) 
  {
    void prisma.user
      .update({ where: { id: claims.sub }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }
}

//Same as above, but leaves 'authUser' undefined instead of throwing
export async function optionalAuth(request: FastifyRequest): Promise<void> {
  const raw = bearer(request);
  if (!raw)
    return;
  const claims = await verifyAccessToken(raw);
  if (claims) 
    request.authUser = { id: claims.sub, displayName: claims.displayName };
}

export function currentUser(request: FastifyRequest): { id: number; displayName: string } {
  if (!request.authUser) 
    throw unauthorized();
  return request.authUser;
}
