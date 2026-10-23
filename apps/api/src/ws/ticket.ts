import { randomInt } from 'node:crypto';
import type { Locale } from '@wkb/shared';
import { token } from '../lib/random.js';

/* Single use tickets for WebSocket auth. The access token can't go in the URL otherwise it would leak into logs and history,
and browsers can't set headers on a WebSocket handshake), so the client swaps it over HTTPS for a ticket
that's valid for 30 seconds and works once.*/
const TTL_MS = 30_000;

interface Ticket {
  userId: number;
  locale: Locale;
  expiresAt: number;
}

const tickets = new Map<string, Ticket>();

export function issueTicket(userId: number, locale: Locale): string {
  const value = token(24);
  tickets.set(value, { userId, locale, expiresAt: Date.now() + TTL_MS });

  // Opportunistic sweep; the map only ever holds a handful of live entries.
  if (tickets.size > 64 && randomInt(8) === 0) 
    sweep();
  return value;
}

export function redeemTicket(value: string | undefined): Ticket | null {
  if (!value) 
    return null;
  const found = tickets.get(value);
  if (!found) 
    return null;
  tickets.delete(value);
  if (found.expiresAt < Date.now()) 
    return null;
  return found;
}

function sweep(): void {
  const now = Date.now();
  for (const [key, value] of tickets) 
  {
    if (value.expiresAt < now) 
      tickets.delete(key);
  }
}
