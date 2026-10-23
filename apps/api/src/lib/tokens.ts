import { createHmac, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { token } from './random.js';

const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const ISSUER = 'wkb';
const AUDIENCE = 'wkb-web';

export interface AccessClaims {
  sub: number;
  displayName: string;
}

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ displayName: claims.displayName })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(String(claims.sub))
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL}s`)
    .sign(accessKey);
}

export async function verifyAccessToken(jwt: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(jwt, accessKey, {
      // Only the algorithm this server signs with; a token naming any other is refused before its signature is looked at
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const sub = Number(payload.sub);
    if (!Number.isInteger(sub) || sub <= 0)
      return null;
    return { sub, displayName: String(payload.displayName ?? '') };
  } catch {
    return null;
  }
}

/*Refresh tokens are random strings, not JWTs, so a logout or a password change can revoke them on the server.
Only a keyed hash is stored, so a leaked database cannot be used to create a session */
function fingerprint(raw: string): string {
  return createHmac('sha256', env.JWT_REFRESH_SECRET).update(raw).digest('hex');
}

export async function issueRefreshToken(userId: number): Promise<string> {
  const raw = token(48);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: fingerprint(raw),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL * 1000),
    },
  });
  return raw;
}

/* Swaps a refreshed token for a new one. The old token is revoked, so each token works only once.
Return null if the token is unknown, expired or already taken.*/
export async function rotateRefreshToken(
  raw: string,
): Promise<{ userId: number; refreshToken: string } | null> {
  const hash = fingerprint(raw);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
  if (!record || record.revokedAt || record.expiresAt.getTime() < Date.now()) 
    return null;
  const rotated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    // Another refresh got there first, so don't create a second session
    if (claimed.count === 0) 
      return null;
    const next = token(48);
    await tx.refreshToken.create({
      data: {
        userId: record.userId,
        tokenHash: fingerprint(next),
        expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL * 1000),
      },
    });
    return next;
  });
  if (!rotated) 
    return null;
  return { userId: record.userId, refreshToken: rotated };
}

/* True when this token was revoked in the last few seconds. Every tab shares one refresh cookie, when two tabs renew at the same time
the second one presents the token the first has just rotated away. That's not a stolen token and deleting the cookie in answer would delete the 
fresh one the first tab has just received.*/
export async function wasJustRotated(raw: string): Promise<boolean> {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: fingerprint(raw) }
  });
  if (!record?.revokedAt)
    return false;
  return Date.now() - record.revokedAt.getTime() < 10_000;
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: fingerprint(raw), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllForUser(userId: number): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

//Compares the OAuth state parameter in constant time.
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length)
    return false;
  return timingSafeEqual(ab, bb);
}
