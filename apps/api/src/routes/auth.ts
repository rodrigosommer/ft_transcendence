import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  changePasswordSchema,
  DEFAULT_LOCALE,
  loginSchema,
  localeSchema,
  signupSchema,
} from '@wkb/shared';
import { prisma } from '../db.js';
import { cookieSecure, env, oauthProviders } from '../env.js';
import { badRequest, conflict, forbidden,  unauthorized } from '../lib/httpError.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { displayNameTaken, isDisplayNameClash } from '../lib/displayNames.js';
import { sessionUser } from '../lib/serialize.js';
import { isDemoAccount } from '../seed/data.js';
import {
  issueRefreshToken,
  revokeAllForUser,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  wasJustRotated,
} from '../lib/tokens.js';
import { currentUser, requireAuth } from '../plugins/auth.js';
import { issueTicket } from '../ws/ticket.js';

export const REFRESH_COOKIE = 'wkb_rt';

/* The refresh cookie is limited to /api/auth, so it isn't sent with every API call, and uses SameSite=Strict, so it's never sent on
cross site requests. The access token stays in browser memory and goes in a bearer header, so it never sits in a cookie.*/
export function setRefreshCookie(reply: FastifyReply, value: string): void {
  reply.setCookie(REFRESH_COOKIE, value, {
    httpOnly: true,
    sameSite: 'strict',
    secure: cookieSecure,
    path: '/api/auth',
    maxAge: env.REFRESH_TOKEN_TTL,
  });
}

export function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/signup', {
    //Rate limits are keyed on the client IP (nginx forwards it)
    config: { rateLimit: { max: 30, timeWindow: '10 minutes' } },
    handler: async (request, reply) => {
      const input = signupSchema.parse(request.body);
      const emailTaken = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
      if (emailTaken)
        throw conflict('error.auth.accountExists', { email: 'error.alreadyExists' });
      // Ignoring case: "ada" is taken when "Ada" exists
      if (await displayNameTaken(input.displayName))
        throw conflict('error.auth.accountExists', { displayName: 'error.alreadyExists' });
      let user;
      try {
        user = await prisma.user.create({
          data: {
            email: input.email,
            displayName: input.displayName,
            passwordHash: await hashPassword(input.password),
            locale: input.locale ?? DEFAULT_LOCALE,
            lastSeenAt: new Date(),
          },
        });
      } catch (error) {
        // Two sign ups racing for the same name, or one that only differs in the case of an accented letter
        if (isDisplayNameClash(error))
          throw conflict('error.auth.accountExists', { displayName: 'error.alreadyExists' });
        throw error;
      }

      /* Creating an account does not start a session; no access token, no refresh cookie. The new account goes to the sign-in screen and types
      the password it just chose, which is the first time anyone finds out whether that password is really the one they meant.*/
      return reply.code(201).send({ user: sessionUser(user) });
    },
  });

  app.post('/api/auth/login', {
    // Same as sign-up; Argon2id's per attempt cost limits brute force long before this limit matters
    config: { rateLimit: { max: 30, timeWindow: '10 minutes' } },
    handler: async (request, reply) => {
      const input = loginSchema.parse(request.body);
      const user = await prisma.user.findUnique({ where: { email: input.email } });
      // Same error and roughly the same cost whether the account exists or the password is wrong
      if (!user || !user.passwordHash || user.isBot) 
      {
        await hashPassword(input.password);
        throw unauthorized('error.auth.invalidCredentials');
      }
      if (!(await verifyPassword(user.passwordHash, input.password))) 
      {
        throw unauthorized('error.auth.invalidCredentials');
      }
      await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
      const [accessToken, refreshToken] = await Promise.all([
        signAccessToken({ sub: user.id, displayName: user.displayName }),
        issueRefreshToken(user.id),
      ]);
      setRefreshCookie(reply, refreshToken);
      return { accessToken, expiresIn: env.ACCESS_TOKEN_TTL, user: sessionUser(user) };
    },
  });

  /* Returns 200 with 'authenticated: false' instead of 401. So anonymous page loads don't log an error in the browser console */
  app.get('/api/auth/session', async (request, reply) => {
    const presented = request.cookies[REFRESH_COOKIE];
    if (!presented) 
      return { authenticated: false };
    const rotated = await rotateRefreshToken(presented);
    if (!rotated)
    {
      /* Another tab renewed with this same cookie a moment ago. Its answer carries the fresh cookie, which the browser stores for every tab,
      so the session is fine: this tab is told to ask again shortly instead of being told its session is over */
      if (await wasJustRotated(presented))
        return { authenticated: false, retry: true };
      clearRefreshCookie(reply);
      return { authenticated: false };
    }
    const user = await prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user)
    {
      clearRefreshCookie(reply);
      return { authenticated: false };
    }
    setRefreshCookie(reply, rotated.refreshToken);
    return {
      authenticated: true,
      accessToken: await signAccessToken({ sub: user.id, displayName: user.displayName }),
      expiresIn: env.ACCESS_TOKEN_TTL,
      user: sessionUser(user),
    };
  });
  app.post('/api/auth/refresh', async (request, reply) => {
    const presented = request.cookies[REFRESH_COOKIE];
    if (!presented) 
      throw unauthorized('error.auth.noSession');
    const rotated = await rotateRefreshToken(presented);
    if (!rotated)
    {
      // Same race as above. 409 rather than 401: the session is not over, the client should simply ask again
      if (await wasJustRotated(presented))
        throw conflict('error.auth.refreshRace');
      clearRefreshCookie(reply);
      throw unauthorized('error.auth.sessionExpired');
    }
    const user = await prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user) 
    {
      clearRefreshCookie(reply);
      throw unauthorized('error.auth.sessionExpired');
    }
    setRefreshCookie(reply, rotated.refreshToken);
    const accessToken = await signAccessToken({ sub: user.id, displayName: user.displayName });
    return { accessToken, expiresIn: env.ACCESS_TOKEN_TTL, user: sessionUser(user) };
  });
  app.post('/api/auth/logout', async (request, reply) => {
    const presented = request.cookies[REFRESH_COOKIE];
    if (presented) 
      await revokeRefreshToken(presented);
    clearRefreshCookie(reply);
    return { ok: true };
  });
  app.get('/api/auth/me', { preHandler: requireAuth }, async (request) => {
    const me = currentUser(request);
    const user = await prisma.user.findUnique({ where: { id: me.id } });
    if (!user) 
      throw unauthorized();
    return { user: sessionUser(user) };
  });
  app.post('/api/auth/password', { 
    preHandler: requireAuth,
    config: { rateLimit: { max: 30, timeWindow: '10 minutes' } },
  }, async (request, reply) => {
    const me = currentUser(request);
    const input = changePasswordSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { id: me.id } });
    if (!user) 
      throw unauthorized();
    if (isDemoAccount(user.email))
      throw forbidden();
    if (!user.passwordHash) 
    {
      throw badRequest('error.auth.noPasswordSet', { currentPassword: 'error.auth.noPasswordSet' });
    }
    if (!(await verifyPassword(user.passwordHash, input.currentPassword))) 
    {
      throw badRequest('error.auth.wrongPassword', { currentPassword: 'error.auth.wrongPassword' });
    }
    await prisma.user.update({
      where: { id: me.id },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });
    // Changing a password invalidates every other session, then reestablishes this one so the user is not logged out of the tab they are looking at
    await revokeAllForUser(me.id);
    setRefreshCookie(reply, await issueRefreshToken(me.id));
    return { ok: true };
  });
  // Which OAuth buttons the sign-in screen should render, and whether it should list the demo accounts
  app.get('/api/auth/providers', async () => ({
    providers: Object.entries(oauthProviders)
      .filter(([, config]) => config.enabled)
      .map(([name]) => name),
    demoAccounts: env.SEED_DEMO_USERS,
  }));
  app.post('/api/ws/ticket', { preHandler: requireAuth }, async (request) => {
    const me = currentUser(request);
    const user = await prisma.user.findUnique({
      where: { id: me.id },
      select: { locale: true },
    });
    const parsed = localeSchema.safeParse(user?.locale ?? DEFAULT_LOCALE);
    return { ticket: issueTicket(me.id, parsed.success ? parsed.data : DEFAULT_LOCALE) };
  });
}
