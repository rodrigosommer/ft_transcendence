import type { ServerEvent } from '@wkb/shared';
import { isServerEvent } from '@wkb/shared';
import { api } from '../api/client.js';

/*Opens an authenticated channel. The access token is first swapped for a single use over HTTPS. Abrowser cannot ser an Authorization header
on a WebSocket handshake, and ptting the token in the query string would leave it in proxy logs*/
export async function openChannel(path: '/ws/lobby' | '/ws/room'): Promise<WebSocket> {
  const { ticket } = await api.post<{ ticket: string }>('/api/ws/ticket');
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${window.location.host}${path}?ticket=${encodeURIComponent(ticket)}`;
  return new WebSocket(url);
}

export function parseEvent(raw: unknown): ServerEvent | null {
  if (typeof raw !== 'string') 
    return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isServerEvent(value) ? value : null;
  } catch {
    return null;
  }
}

// Backoff for reconnection is 1s, 2s, 4s, 8s, then every 10s
export function backoffDelay(attempt: number): number {
  return Math.min(10_000, 1_000 * 2 ** Math.min(attempt, 3));
}
