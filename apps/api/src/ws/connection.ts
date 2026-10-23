import type { WebSocket } from 'ws';
import type { Locale, ServerEvent } from '@wkb/shared';
import { PING_INTERVAL_MS, PING_MAX_MISSED } from '@wkb/shared';

// Incoming message budget per socket: a burst of this many, refilled at the steady rate below
const MESSAGE_BURST = 30;
const MESSAGE_REFILL_PER_SECOND = 5;

/*One authenticated socket on either channel; it owns the heartbeat which does double duty, ie, 
it detects dead connections and it produces the round trip time estimate the vote validator needs (spec §11).*/
export class Channel {
  readonly socket: WebSocket;
  readonly userId: number;
  locale: Locale;
  // Moving average of round trip time, in milliseconds
  rttMs = 0;

  private pingTimer: NodeJS.Timeout | null = null;
  private pendingPings = new Map<number, number>();
  private missed = 0;
  private closed = false;
  private readonly onDead: () => void;
  private tokens = MESSAGE_BURST;
  private refilledAt = Date.now();
  private droppedInARow = 0;

  constructor(socket: WebSocket, userId: number, locale: Locale, onDead: () => void) {
    this.socket = socket;
    this.userId = userId;
    this.locale = locale;
    this.onDead = onDead;
  }

  get isOpen(): boolean {
    return !this.closed && this.socket.readyState === 1;
  }

  /* A token bucket. Every incoming message spends a token and tokens come back at a steady rate. Real play never gets close
  (a pong every few seconds, one vote per card), but a client spamming 'room:join' with random codes, each one a database query, runs dry.
  'drop' means ignore this message; 'close' means the client kept going with an empty bucket and the socket should go */
  admit(): 'ok' | 'drop' | 'close' {
    const now = Date.now();
    this.tokens = Math.min(MESSAGE_BURST, this.tokens + ((now - this.refilledAt) / 1000) * MESSAGE_REFILL_PER_SECOND);
    this.refilledAt = now;
    if (this.tokens >= 1)
    {
      this.tokens -= 1;
      this.droppedInARow = 0;
      return 'ok';
    }
    this.droppedInARow += 1;
    return this.droppedInARow > MESSAGE_BURST ? 'close' : 'drop';
  }

  send(event: ServerEvent): void {
    if (!this.isOpen) 
      return;
    try {
      this.socket.send(JSON.stringify(event));
    } catch {
      // A send that throws means the peer is gone. The close handler follows.
    }
  }

  startHeartbeat(): void {
    this.pingTimer = setInterval(() => {
      if (!this.isOpen) 
        return;
      // Every outstanding ping counts as missed until its pong arrives.
      if (this.pendingPings.size > 0) 
      {
        this.missed += 1;
        if (this.missed >= PING_MAX_MISSED) 
        {
          this.pendingPings.clear();
          this.onDead();
          this.close(1001, 'heartbeat timeout');
          return;
        }
      }
      const t = Date.now();
      this.pendingPings.set(t, t);
      this.send({ type: 'ping', t });
    }, PING_INTERVAL_MS);
  }

  /* Smoothed with an EWMA so one slow pong can't skew the next reaction check */
  handlePong(t: number): void {
    const sentAt = this.pendingPings.get(t);
    if (sentAt === undefined) 
      return;
    this.pendingPings.delete(t);
    this.missed = 0;
    const sample = Date.now() - sentAt;
    this.rttMs = this.rttMs === 0 ? sample : Math.round(this.rttMs * 0.7 + sample * 0.3);
  }

  close(code = 1000, reason = 'closed'): void {
    if (this.closed) 
      return;
    this.closed = true;
    if (this.pingTimer) 
    {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    try {
      this.socket.close(code, reason);
    } catch {
      // Already torn down.
    }
  }

  // Called from the socket's own close handler
  markClosed(): void {
    this.closed = true;
    if (this.pingTimer) 
    {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
