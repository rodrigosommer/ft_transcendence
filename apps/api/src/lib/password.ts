import { hash, verify } from '@node-rs/argon2';

/* Password hashing with Argon2id, using the settings OWASP recommends for logins.
'@node-rs/argon2' adds a random salt (random value mixed into a password before it's hashed) to each hash and stores it in the hash string, 
so there's no salt column */
const OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    return await verify(stored, plain, OPTIONS);
  } catch {
    // A malformed hash must read as "wrong password", never as a crash.
    return false;
  }
}
