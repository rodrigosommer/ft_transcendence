import { z } from 'zod';

/*Configuration is validated once at boot. A missing secret should stop the process immediately
 rather than surface as a confusing 500 an hour later.*/
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PUBLIC_ORIGIN: z.string().url().default('https://localhost:8443'),
  // Other addresses the same deployment is reached by, comma separated.
  // Serving on a LAN address does not stop localhost from working.
  PUBLIC_ORIGIN_ALIASES: z.string().optional().default(''),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(2_592_000),

  /* The three demo accounts share a password that is printed by 'make' and shown on the login page. Fine for a local run or an evaluation,
  unsafe on anything reachable from the internet, so they only exist when this is set to true. Off, the seed also locks any demo account
  an earlier boot created */
  SEED_DEMO_USERS: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),

  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GITHUB_CLIENT_ID: z.string().optional().default(''),
  GITHUB_CLIENT_SECRET: z.string().optional().default(''),
  //'FT_' rather than '42_' because an environment variable name cannot start with a digit.
  FT_CLIENT_ID: z.string().optional().default(''),
  FT_CLIENT_SECRET: z.string().optional().default(''),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) 
{
  const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${details}`);
  process.exit(1);
}

export const env = parsed.data;

/*The slug appears in the callback URL, so '42' matches the redirect URI registered with 42's intra. 
The type is explicit because TypeScript would infer a number from the key '42', and this name is always used as a string.*/
export type OAuthProviderName = 'google' | 'github' | '42';

interface OAuthProviderConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
}

export const oauthProviders: Record<OAuthProviderName, OAuthProviderConfig> = {
  google: {
    enabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  },
  github: {
    enabled: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
  },
  '42': {
    enabled: Boolean(env.FT_CLIENT_ID && env.FT_CLIENT_SECRET),
    clientId: env.FT_CLIENT_ID,
    clientSecret: env.FT_CLIENT_SECRET,
  },
};

// Cookies are only marked Secure when the public origin actually is HTTPS
export const cookieSecure = env.PUBLIC_ORIGIN.startsWith('https://');

function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/')
    end -= 1;
  return value.slice(0, end);
}

/*Every origin this deployment answers on 'PUBLIC_ORIGIN' first. It's an allow list; building the OAuth redirect from the 
Host header would let anyone who sets it send the callback and authorisation code to their own host.*/
export const publicOrigins: string[] = [
  env.PUBLIC_ORIGIN,
  ...env.PUBLIC_ORIGIN_ALIASES.split(',')
    .map((origin) => stripTrailingSlashes(origin.trim()))
    .filter((origin) => origin.length > 0),
].filter((origin, index, all) => all.indexOf(origin) === index);
