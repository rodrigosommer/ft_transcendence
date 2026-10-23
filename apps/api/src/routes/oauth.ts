import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { DEFAULT_LOCALE, displayNameSchema, toDisplayName } from '@wkb/shared';
import { prisma } from '../db.js';
import { displayNameTaken, isDisplayNameClash } from '../lib/displayNames.js';
import {
  cookieSecure,
  env,
  oauthProviders,
  publicOrigins,
  type OAuthProviderName,
} from '../env.js';
import { token } from '../lib/random.js';
import { safeEqual } from '../lib/tokens.js';
import { issueRefreshToken } from '../lib/tokens.js';
import { setRefreshCookie } from './auth.js';
import { HttpError, badRequest, notFound } from '../lib/httpError.js';

/* OAuth 2.0 authorization code flow (module 8)
The callback never puts a token in the redirect URL. It sets the refresh cookie and redirects to /auth/callback, where the SPA calls
'POST /api/auth/refresh' to get its access token, just like a returning visitor would.*/
const STATE_COOKIE = 'wkb_oauth_state';
const providerSchema = z.enum(['google', 'github', '42']);
/* Everything the authorization code flow needs that differs per provider. Only the profile call is left as a branch below, because each one returns a
different shape and there is nothing to table-drive.*/
const ENDPOINTS: Record<
  OAuthProviderName,
  { authorize: string; token: string; scope: string; extra?: Record<string, string> }
> = {
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    extra: { response_type: 'code', prompt: 'select_account' },
  },
  github: {
    authorize: 'https://github.com/login/oauth/authorize',
    token: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
  },
  '42': {
    authorize: 'https://api.intra.42.fr/oauth/authorize',
    token: 'https://api.intra.42.fr/oauth/token',
    /* 'public' is the whole thing,  an id, an email, a login and an avatar. The other scopes on the intra form would be asking for permissions 
    this application has no use for. */
    scope: 'public',
    extra: { response_type: 'code' },
  },
};

interface ProviderProfile {
  providerUserId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

/* Every call to a provider gets a time limit. Without one, a provider that never answers keeps the sign in request,
and the visitor's browser, waiting for good */
const PROVIDER_TIMEOUT_MS = 10_000;

function providerFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
}

/* Maps Host header values (with and without port) to configured origins. 'PUBLIC_ORIGIN' is first in 'publicOrigins', so it wins any collision */
const ORIGIN_BY_HOST = new Map<string, string>();
for (const origin of [...publicOrigins].reverse()) 
{
  const url = new URL(origin);
  ORIGIN_BY_HOST.set(url.host, origin);
  ORIGIN_BY_HOST.set(url.hostname, origin);
}

/* The origin to send this visitor back to so their cookies stay on the address they came from. The Host header only selects from the configured list,
it returns the configured string and never the header itself. A forged header cannot redirect the authorisation code*/
function originFor(request: FastifyRequest): string {
  const host = request.headers.host;
  if (!host) 
    return env.PUBLIC_ORIGIN;
  return ORIGIN_BY_HOST.get(host) ?? env.PUBLIC_ORIGIN;
}

function redirectUri(provider: OAuthProviderName, origin: string): string {
  return `${origin}/api/auth/oauth/${provider}/callback`;
}

function authorizeUrl(provider: OAuthProviderName, state: string, origin: string): string {
  const endpoints = ENDPOINTS[provider];
  const params = new URLSearchParams({
    client_id: oauthProviders[provider].clientId,
    redirect_uri: redirectUri(provider, origin),
    scope: endpoints.scope,
    state,
    ...endpoints.extra,
  });
  return `${endpoints.authorize}?${params.toString()}`;
}

async function exchangeCode(
  provider: OAuthProviderName,
  code: string,
  origin: string,
): Promise<string> {
  const config = oauthProviders[provider];
  const response = await providerFetch(ENDPOINTS[provider].token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      // Must be byte for byte the value sent to the authorize endpoint, which is why the origin is carried through rather than recomputed
      redirect_uri: redirectUri(provider, origin),
      grant_type: 'authorization_code',
    }),
  });
  if (!response.ok) 
    throw badRequest('error.oauth.exchangeFailed');
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) 
    throw badRequest('error.oauth.exchangeFailed');
  return payload.access_token;
}

async function fetchProfile(
  provider: OAuthProviderName,
  accessToken: string,
): Promise<ProviderProfile> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'User-Agent': 'wkb-ft-transcendence',
  };
  if (provider === 'google') 
  {
    const response = await providerFetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers });
    if (!response.ok) 
      throw badRequest('error.oauth.profileFailed');
    const profile = (await response.json()) as {
      sub: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };
    if (!profile.email || profile.email_verified !== true) 
    {
      throw badRequest('error.oauth.noEmail');
    }
    return {
      providerUserId: profile.sub,
      email: profile.email.toLowerCase(),
      displayName: profile.name ?? profile.email.split('@')[0] ?? 'player',
      avatarUrl: profile.picture ?? null,
    };
  }
  if (provider === '42') 
  {
    const response = await providerFetch('https://api.intra.42.fr/v2/me', { headers });
    if (!response.ok) 
      throw badRequest('error.oauth.profileFailed');
    const profile = (await response.json()) as {
      id: number;
      login: string;
      email?: string;
      image?: { link?: string | null; versions?: { medium?: string | null } };
    };
    if (!profile.email) 
      throw badRequest('error.oauth.noEmail');
    return {
      providerUserId: String(profile.id),
      email: profile.email.toLowerCase(),
      /* Use the login instead 'displayname', which is the student's real name. Display names are public here (leaderboard, every room) 
      and an intra login is already the handle 42 students are known by, so it is the one that belongs on a scoreboard */
      displayName: profile.login,
      // 'versions.medium' is 96px. The largest avatar this interface draws is 80px, and 'link' is the full size original, which can be a megabyte.
      avatarUrl: profile.image?.versions?.medium ?? profile.image?.link ?? null,
    };
  }
  const response = await providerFetch('https://api.github.com/user', { headers });
  if (!response.ok) 
    throw badRequest('error.oauth.profileFailed');
  const profile = (await response.json()) as {
    id: number;
    login: string;
    name?: string | null;
    avatar_url?: string;
    email?: string | null;
  };
  let email = profile.email ?? null;
  if (!email) 
  {
    // GitHub hides the address unless it is public; ask for the verified one.
    const emailResponse = await providerFetch('https://api.github.com/user/emails', { headers });
    if (emailResponse.ok) 
    {
      const emails = (await emailResponse.json()) as {
        email: string;
        primary: boolean;
        verified: boolean;
      }[];
      email = emails.find((e) => e.primary && e.verified)?.email ?? emails.find((e) => e.verified)?.email ?? null;
    }
  }
  if (!email) 
    throw badRequest('error.oauth.noEmail');
  return {
    providerUserId: String(profile.id),
    email: email.toLowerCase(),
    displayName: profile.name ?? profile.login,
    avatarUrl: profile.avatar_url ?? null,
  };
}

/* Display names are unique, ignoring case; a taken one gets a numeric suffix. The provider's name is cleaned with the same rules as the
profile form ('toDisplayName'), otherwise the account would be created with a name its owner then could not save when editing the profile.
At most 20 characters, which leaves room for the suffix within the 24 allowed */
async function uniqueDisplayName(preferred: string): Promise<string> {
  const base = toDisplayName(preferred, 20);
  const padded = base.length >= 3 ? base : base ? `${base}_player` : 'player';
  for (let attempt = 0; attempt < 50; attempt += 1)
  {
    const candidate = attempt === 0 ? padded : `${padded}${attempt}`;
    if (displayNameSchema.safeParse(candidate).success && !(await displayNameTaken(candidate)))
      return candidate;
  }
  return fallbackDisplayName();
}

const fallbackDisplayName = () => `player_${token(4)}`;

// Finds the account for a provider identity: existing link, then matching email, then a new account
async function resolveUser(provider: OAuthProviderName, profile: ProviderProfile): Promise<number> {
  const linked = await prisma.oAuthAccount.findUnique({
    where: { provider_providerUserId: { provider, providerUserId: profile.providerUserId } },
  });
  if (linked) 
    return linked.userId;
  const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
  if (byEmail) 
  {
    if (byEmail.passwordHash != null || byEmail.isBot)
      throw badRequest('error.oauth.accountExists');
    await prisma.oAuthAccount.create({
      data: { userId: byEmail.id, provider, providerUserId: profile.providerUserId },
    });
    return byEmail.id;
  }
  const create = (displayName: string) =>
    prisma.user.create({
      data: {
        email: profile.email,
        displayName,
        // No password; the account is provider only until the user sets one
        passwordHash: null,
        avatarUrl: profile.avatarUrl,
        locale: DEFAULT_LOCALE,
        lastSeenAt: new Date(),
        oauthAccounts: { create: { provider, providerUserId: profile.providerUserId } },
      },
    });
  try {
    return (await create(await uniqueDisplayName(profile.displayName))).id;
  } catch (error) {
    // Someone took the chosen name between the check and the insert; a random one can't clash in practice
    if (!isDisplayNameClash(error))
      throw error;
    return (await create(fallbackDisplayName())).id;
  }
}

export async function oauthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/auth/oauth/:provider', async (request, reply) => {
    const parsed = providerSchema.safeParse(
      (request.params as { provider?: string }).provider,
    );
    if (!parsed.success) 
      throw notFound();
    const provider = parsed.data;
    if (!oauthProviders[provider].enabled) 
      throw notFound('error.oauth.notConfigured');
    const state = token(24);
    reply.setCookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax', // The provider redirects back cross-site; strict would drop it.
      secure: cookieSecure,
      path: '/api/auth/oauth',
      maxAge: 600,
    });
    return reply.redirect(authorizeUrl(provider, state, originFor(request)));
  });
  app.get('/api/auth/oauth/:provider/callback', async (request, reply) => {
    const parsed = providerSchema.safeParse((request.params as { provider?: string }).provider);
    if (!parsed.success) 
      throw notFound();
    const provider = parsed.data;
    if (!oauthProviders[provider].enabled) 
      throw notFound('error.oauth.notConfigured');
    const query = request.query as { code?: string; state?: string; error?: string };
    reply.clearCookie(STATE_COOKIE, { path: '/api/auth/oauth' });
    const origin = originFor(request);
    const fail = (reason: string) =>
      reply.redirect(`${origin}/login?oauth_error=${encodeURIComponent(reason)}`);
    if (query.error) 
      return fail(query.error);
    const expected = request.cookies[STATE_COOKIE];
    if (!query.state || !expected || !safeEqual(query.state, expected)) 
      return fail('state');
    if (!query.code) 
      return fail('code');
    try {
      const accessToken = await exchangeCode(provider, query.code, origin);
      const profile = await fetchProfile(provider, accessToken);
      const userId = await resolveUser(provider, profile);
      await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
      setRefreshCookie(reply, await issueRefreshToken(userId));
      return reply.redirect(`${origin}/auth/callback`);
    } catch (error) {
      request.log.warn({ err: error, provider }, 'oauth callback failed');
      const exists = error instanceof HttpError && error.code === 'error.oauth.accountExists';
      return fail(exists ? 'accountExists' : 'exchange');
    }
  });
}
