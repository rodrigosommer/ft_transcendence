/**
 * End-to-end smoke test: signs up, creates a room, plays a whole match against
 * a bot over the real WebSocket channel, drops a connection mid-match and
 * reconnects, then checks the persisted results.
 *
 * Run with `make e2e` while the stack is up.
 *
 * Deliberately dependency-free: it uses Node 22's built-in WebSocket rather
 * than the `ws` package, so it runs against a freshly cloned repository that
 * has never had `npm install` run in it.
 */

import { readFile } from 'node:fs/promises';
import { randomInt } from 'node:crypto';

const BASE = process.env.E2E_BASE ?? 'https://nginx';
const WS_BASE = BASE.replace(/^https/, 'wss');

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    const safeDetail = String(detail).replace(/[\r\n]/g, ' ');
    console.log(`  FAIL ${name}${safeDetail ? ` (${safeDetail})` : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

async function http(path, { method = 'GET', body, token, cookie } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, json, headers: response.headers };
}

function unique(prefix) {
  return `${prefix}${Date.now().toString(36)}${randomInt(1000)}`;
}

/** A test client wrapping one room WebSocket. */
class Player {
  constructor(name) {
    this.name = name;
    this.events = [];
    this.socket = null;
    this.token = null;
    this.userId = null;
  }

  async signup() {
    const handle = unique('t');
    this.email = `${handle}@e2e.local`;
    this.password = 'Password1!';

    const created = await http('/api/auth/signup', {
      method: 'POST',
      body: {
        email: this.email,
        password: this.password,
        displayName: `${this.name}${handle.slice(-4)}`,
        locale: 'en',
      },
    });
    if (created.status === 429) {
      throw new Error(
        'signup was rate limited. The suite creates two accounts per run; ' +
          'wait for the 10-minute window to roll over, or run `make re` to reset.',
      );
    }
    if (created.status !== 201) {
      throw new Error(`signup failed: ${created.status} ${JSON.stringify(created.json)}`);
    }
    this.userId = created.json.user.id;
    this.displayName = created.json.user.displayName;
    this.created = created;

    // Creating an account does not sign anyone in, so the token comes from a
    // real login with the password that was just chosen.
    const session = await http('/api/auth/login', {
      method: 'POST',
      body: { email: this.email, password: this.password },
    });
    if (session.status !== 200) {
      throw new Error(`login after signup failed: ${session.status} ${JSON.stringify(session.json)}`);
    }
    this.token = session.json.accessToken;
    this.session = session.json;
    return created;
  }

  async connect(code) {
    const ticket = await http('/api/ws/ticket', { method: 'POST', token: this.token });
    if (ticket.status !== 200) 
      throw new Error(`ticket failed: ${ticket.status}`);

    this.socket = new WebSocket(`${WS_BASE}/ws/room?ticket=${encodeURIComponent(ticket.json.ticket)}`);
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });

    this.socket.addEventListener('message', (message) => {
      const event = JSON.parse(String(message.data));
      this.events.push(event);
      // The heartbeat is what produces the server's RTT estimate.
      if (event.type === 'ping') this.send({ type: 'pong', t: event.t });
    });

    this.send({ type: 'room:join', code });
    await this.waitFor('room:state');
  }

  send(event) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(event));
  }

  // Generous by default: this runs on whatever machine an evaluator has, and
  // a test that fails because the database was cold is worse than no test.
  //
  // 45s was not generous enough. Running `make test` straight after `make` on
  // a loaded machine put the first match behind image builds and the seed of
  // 360 facts, and the first reveal missed that window on a clean clone while
  // passing every time on a warm one. An event that normally arrives inside
  // ten seconds still fails loudly at 90, so this buys tolerance without
  // hiding a genuine hang.
  waitFor(type, timeoutMs = 90000) {
    const existing = this.events.find((event) => event.type === type);
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
      const handler = (message) => {
        const event = JSON.parse(String(message.data));
        if (event.type === type) {
          clearTimeout(timer);
          this.socket.removeEventListener('message', handler);
          resolve(event);
        }
      };

      const timer = setTimeout(() => {
        this.socket?.removeEventListener('message', handler);
        reject(new Error(`timed out waiting for ${type} (${this.name})`));
      }, timeoutMs);

      this.socket.addEventListener('message', handler);
    });
  }

  find(type) {
    return this.events.filter((event) => event.type === type);
  }

  /**
   * Waits for a room snapshot that actually satisfies `predicate`.
   *
   * Every membership change makes the server re-snapshot every peer, so two
   * can be in flight at once and taking simply the next one makes the
   * assertion depend on which arrived first. Returns the last snapshot seen
   * when the deadline passes, so a failure reports what the room really said.
   */
  async settle(predicate, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const hit = this.find('room:state').filter((state) => predicate(state)).at(-1);
      if (hit) return hit;
      if (Date.now() > deadline) return this.find('room:state').at(-1) ?? null;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  close() {
    this.socket?.close();
  }
}

async function main() {
  console.log(`E2E against ${BASE}\n${'='.repeat(50)}`);

  // ---------------------------------------------------------------- auth ---
  section('Authentication');

  const host = new Player('Host');
  await host.signup();
  check(
    'signing up does not start a session',
    host.created.json.accessToken === undefined && !host.created.headers.get('set-cookie'),
    host.created.headers.get('set-cookie') ? 'a session cookie came back' : 'a token came back',
  );
  check('the new account can then log in', typeof host.token === 'string' && host.token.length > 20);

  const guest = new Player('Guest');
  await guest.signup();
  check('a second account can be created', guest.userId !== host.userId);

  const badLogin = await http('/api/auth/login', {
    method: 'POST',
    body: { email: 'ada@wkb.local', password: 'wrong-password-1' },
  });
  check('wrong password is rejected', badLogin.status === 401);

  const demoLogin = await http('/api/auth/login', {
    method: 'POST',
    body: { email: 'ada@wkb.local', password: 'Password1!' },
  });
  check('seeded demo account can log in', demoLogin.status === 200);

  // The first-run setup screen is gated on this flag, so it is the flag that
  // is checked rather than the redirect: a browser assertion would pass just
  // as well against a client-side guess that the server never agreed with.
  check(
    'a brand new account still owes the first-run setup',
    host.session.user.onboarded === false,
    JSON.stringify(host.session.user.onboarded),
  );
  check(
    'a seeded demo account does not',
    demoLogin.json.user.onboarded === true,
    JSON.stringify(demoLogin.json.user.onboarded),
  );

  const finished = await http('/api/users/me', {
    method: 'PATCH',
    token: host.token,
    body: { onboarded: true },
  });
  check(
    'finishing the setup is recorded on the account',
    finished.status === 200 && finished.json.user.onboarded === true,
    `${finished.status} ${JSON.stringify(finished.json.user?.onboarded)}`,
  );

  const unOnboard = await http('/api/users/me', {
    method: 'PATCH',
    token: host.token,
    body: { onboarded: false },
  });
  check(
    'nothing can un-onboard an account over the API',
    unOnboard.status === 400,
    String(unOnboard.status),
  );
  check(
    'refresh cookie is httpOnly and SameSite=Strict',
    /HttpOnly/i.test(demoLogin.headers.get('set-cookie') ?? '') &&
      /SameSite=Strict/i.test(demoLogin.headers.get('set-cookie') ?? ''),
  );

  const noAuth = await http('/api/rooms');
  check('protected route rejects an anonymous caller', noAuth.status === 401);

  // Only providers with credentials configured are offered, and each one has
  // to be a slug the callback route actually accepts.
  const providers = await http('/api/auth/providers');
  check(
    'the OAuth provider list only offers configured providers',
    Array.isArray(providers.json.providers) &&
      providers.json.providers.every((name) => ['google', 'github', '42'].includes(name)),
    JSON.stringify(providers.json.providers),
  );
  const unknownProvider = await http('/api/auth/oauth/myspace');
  check('an unknown OAuth provider is not a route', unknownProvider.status === 404);

  // The deployment can answer on several addresses, and a visitor has to come
  // back to the one they left from. The Host header picks which, but only out
  // of the configured list: a forged one must never choose where the
  // authorization code is delivered.
  //
  // Both branches assert, so the suite runs the same number of checks whether
  // or not this machine has OAuth credentials. A guard that silently skipped
  // here would make a clean clone quietly cover less than the machine it was
  // written on, which is exactly how coverage rots.
  const configured = providers.json.providers[0];
  if (configured === undefined) {
    const unconfigured = await http('/api/auth/oauth/google');
    check(
      'a forged Host cannot choose the OAuth redirect target (none configured: the route does not exist to be forged)',
      unconfigured.status === 404,
      `status=${unconfigured.status}`,
    );
  } else {
    const forged = await fetch(`${BASE}/api/auth/oauth/${configured}`, {
      redirect: 'manual',
      headers: { Host: 'attacker.example.com' },
    });
    const target = decodeURIComponent(forged.headers.get('location') ?? '');
    check(
      'a forged Host cannot choose the OAuth redirect target',
      target.length > 0 && !target.includes('attacker.example.com'),
      target.slice(0, 120),
    );
  }

  const weak = await http('/api/auth/signup', {
    method: 'POST',
    body: { email: 'x@e2e.local', password: 'short', displayName: 'Ok Name' },
  });
  check('server rejects a weak password even if the browser did not', weak.status === 400);

  // -------------------------------------------------------------- catalog ---
  section('Card set');

  const cards = await http('/api/catalog/cards', { token: host.token });
  check('card set is loaded', cards.json.facts >= 300, `facts=${cards.json?.facts}`);
  check('every fact has two cards', cards.json.cards === cards.json.facts * 2);
  check(
    'translations cover both extra locales',
    cards.json.translations['pt-BR'] === cards.json.cards &&
      cards.json.translations.fr === cards.json.cards,
  );

  const categories = await http('/api/catalog/categories', { token: host.token });
  check('categories are exposed', categories.json.categories.length === 8);

  // The interface strings are three hand-maintained JSON files, and the way
  // they rot is silent: a key added to one locale and forgotten in the others
  // renders as the raw key path, which looks like a bug in the wrong language
  // and is invisible to anyone testing in English. The repository is mounted
  // at /w for this run, so the files can be read directly.
  const leaves = (value, prefix = '') =>
    Object.entries(value).flatMap(([key, entry]) =>
      entry && typeof entry === 'object'
        ? leaves(entry, `${prefix}${key}.`)
        : [`${prefix}${key}`],
    );
  const localeKeys = {};
  for (const locale of ['en', 'pt-BR', 'fr']) {
    const file = new URL(`../../apps/web/src/i18n/locales/${locale}.json`, import.meta.url);
    localeKeys[locale] = new Set(leaves(JSON.parse(await readFile(file, 'utf8'))));
  }
  const reference = localeKeys.en;
  const drift = [];
  for (const locale of ['pt-BR', 'fr']) {
    for (const key of reference) if (!localeKeys[locale].has(key)) drift.push(`${locale} missing ${key}`);
    for (const key of localeKeys[locale]) if (!reference.has(key)) drift.push(`${locale} has extra ${key}`);
  }
  check(
    'the three locales hold exactly the same keys',
    drift.length === 0,
    drift.slice(0, 4).join(', '),
  );
  check('every locale is a full set, not a stub', reference.size > 400, String(reference.size));

  // ----------------------------------------------------------------- room ---
  section('Room and match');

  const created = await http('/api/rooms', {
    method: 'POST',
    token: host.token,
    body: {
      name: 'E2E match',
      visibility: 'public',
      mode: 'general',
      difficulty: 'easy',
      maxPlayers: 4,
      settings: {
        cardCount: 6,
        categoryIds: [],
        answerWindowMs: 4000,
        comboEnabled: true,
        doubleCardEnabled: false,
      },
    },
  });
  check('room is created', created.status === 201, JSON.stringify(created.json));
  const code = created.json.room.code;

  const listedBeforeAnyoneJoins = await http('/api/rooms', { token: host.token });
  check(
    'a room nobody has joined yet is not advertised',
    !listedBeforeAnyoneJoins.json.rooms.some((room) => room.code === code),
  );

  await host.connect(code);
  await guest.connect(code);
  check('both players joined the room channel', host.find('room:state').length >= 1);

  const listedNow = await http('/api/rooms', { token: host.token });
  const listedRoom = listedNow.json.rooms.find((room) => room.code === code);
  check('the room is advertised once someone is in it', listedRoom !== undefined);
  check('and it reports its occupancy', listedRoom?.playerCount === 2, `${listedRoom?.playerCount}`);

  const guestStart = guest.find('error').length;
  guest.send({ type: 'match:start' });
  await new Promise((resolve) => setTimeout(resolve, 400));
  check('only the host may start the match', guest.find('error').length > guestStart);

  const bots = await http('/api/catalog/bots', { token: host.token });
  check('bot profiles are available', bots.json.bots.length === 8);
  host.send({ type: 'room:add_bot', profileId: bots.json.bots[0].profileId });
  await new Promise((resolve) => setTimeout(resolve, 400));

  // Let the heartbeat produce an RTT sample before the first vote.
  await new Promise((resolve) => setTimeout(resolve, 300));

  host.send({ type: 'match:start' });
  const started = await host.waitFor('match:started');
  check('match started', started.total === 6, `total=${started.total}`);

  // The scoreboard is meant to be visible at all times, which means it has to
  // arrive before the first card rather than with the first reveal.
  const opening = await host.waitFor('scoreboard:update', 10000).catch(() => null);
  check('an opening scoreboard arrives before the first card', opening !== null);
  check(
    'it lists every player at zero',
    opening?.scoreboard.length === 3 && opening.scoreboard.every((row) => row.score === 0),
    `${opening?.scoreboard.length} entries`,
  );
  host.events = host.events.filter((event) => event.type !== 'scoreboard:update');

  // ------------------------------------------------------------ the match ---
  const revealsSeen = [];
  let reconnected = false;
  let relanguaged = false;

  const play = async (player, { answerAll = true } = {}) => {
    for (;;) {
      const ended = player.find('match:ended')[0];
      if (ended) return ended;

      let served;
      try {
        served = await player.waitFor('card:served', 90000);
      } catch {
        const late = player.find('match:ended')[0];
        if (late) return late;
        throw new Error(
          `${player.name}: no card and no match end after 90s ` +
            `(last events: ${player.events.map((e) => e.type).slice(-6).join(', ') || 'none'})`,
        );
      }
      const card = served.card;
      player.events = player.events.filter((event) => event.type !== 'card:served');

      // Switching language mid-card must re-language the card in place. The
      // socket's locale is fixed when it opens, so without the `locale:set`
      // round trip the cards keep arriving in the language the player joined
      // with, however many times they press the switcher.
      if (player === host && card.position >= 1 && !relanguaged) {
        relanguaged = true;
        const before = card.text;
        // Drop the join-time snapshot first: `waitFor` returns the first
        // matching event still in the buffer, and that one predates the match.
        player.events = player.events.filter((event) => event.type !== 'room:state');
        player.send({ type: 'locale:set', locale: 'pt-BR' });
        const snapshot = await player.waitFor('room:state', 10000).catch(() => null);
        player.events = player.events.filter((event) => event.type !== 'room:state');
        const after = snapshot?.match?.card;
        check('switching language mid-match re-languages the card in play', after != null);
        check(
          'and the text actually changed',
          typeof after?.text === 'string' && after.text !== before,
          `${before} -> ${after?.text}`,
        );
        check(
          'without restarting the countdown',
          (snapshot?.match?.remainingMs ?? 99999) < card.windowMs,
          `${snapshot?.match?.remainingMs}ms left of ${card.windowMs}ms`,
        );
        player.send({ type: 'locale:set', locale: 'en' });
        await player.waitFor('room:state', 10000).catch(() => null);
        player.events = player.events.filter((event) => event.type !== 'room:state');
      }

      if (answerAll) {
        // Answer after a realistic delay so the reaction time is plausible.
        await new Promise((resolve) => setTimeout(resolve, 600));
        player.send({
          type: 'card:vote',
          matchCardId: card.matchCardId,
          choice: randomInt(2) === 0 ? 'truth' : 'myth',
          reactionMs: 600,
        });
        const ack = await player.waitFor('vote:ack', 15000).catch(() => null);
        if (ack) player.acks = (player.acks ?? 0) + 1;
        player.events = player.events.filter((event) => event.type !== 'vote:ack');
      }

      const reveal = await player.waitFor('card:revealed', 90000);
      player.events = player.events.filter((event) => event.type !== 'card:revealed');
      if (player === host) revealsSeen.push({ ...reveal, shownText: card.text });

      // Drop the guest mid-match to exercise reconnection.
      if (player === guest && revealsSeen.length >= 2 && !reconnected) {
        reconnected = true;
        guest.socket.close();
        await new Promise((resolve) => setTimeout(resolve, 1200));
        guest.events = [];
        await guest.connect(code);
        const snapshot = guest.find('room:state').at(-1);
        check('reconnect returns a mid-match snapshot', snapshot?.match != null);
        check(
          'snapshot carries the current position and scoreboard',
          (snapshot?.match?.position ?? 0) > 0 && (snapshot?.match?.scoreboard?.length ?? 0) === 3,
          JSON.stringify(snapshot?.match?.position),
        );
      }

      if (reveal.isLast) return player.waitFor('match:ended', 90000);
    }
  };

  const [hostEnd] = await Promise.all([play(host), play(guest)]);

  check('the reconnection path was exercised', reconnected);
  check('the language switch was exercised', relanguaged);
  check('every card was revealed', revealsSeen.length === 6, `${revealsSeen.length}`);
  check('every vote was acknowledged', host.acks === 6 && guest.acks === 6, `host=${host.acks} guest=${guest.acks}`);
  check(
    'each reveal reported all three players',
    revealsSeen.every((reveal) => reveal.results.length === 3),
  );
  check(
    'the deck was balanced 50/50 true and false',
    revealsSeen.filter((reveal) => reveal.isTrue).length === 3,
    `${revealsSeen.filter((r) => r.isTrue).length}/6 true`,
  );
  check(
    'scores stay inside the documented range',
    revealsSeen.every((reveal) =>
      reveal.results.every((result) => result.points >= -50 && result.points <= 300),
    ),
  );
  check(
    'a correct answer never scores below the base',
    revealsSeen.every((reveal) =>
      reveal.results.every((result) => result.correct !== true || result.points >= 100),
    ),
  );
  check(
    'a wrong answer is penalised, but never below zero',
    revealsSeen.every((reveal) =>
      reveal.results.every(
        (result) => result.correct !== false || (result.points <= 0 && result.points >= -50),
      ),
    ),
  );
  check(
    'no score ever goes negative',
    revealsSeen.every((reveal) => reveal.scoreboard.every((row) => row.score >= 0)),
  );
  check('every card carries a source reference', revealsSeen.every((reveal) => reveal.sourceRef));
  check(
    'every reveal states the fact correctly',
    revealsSeen.every((reveal) => typeof reveal.correction === 'string' && reveal.correction.length > 8),
  );
  // On a card that was false the correction has to be different text: that is
  // the whole point, since the statement on screen was wrong.
  check(
    'a false card is corrected with different wording',
    revealsSeen
      .filter((reveal) => !reveal.isTrue)
      .every((reveal) => reveal.correction !== reveal.shownText),
    'correction matched the false statement',
  );

  check('match ended', hostEnd?.type === 'match:ended');
  check('final scoreboard ranks all three players', hostEnd.scoreboard.length === 3);
  check(
    'and no final score is negative',
    hostEnd.scoreboard.every((row) => row.score >= 0),
    JSON.stringify(hostEnd.scoreboard.map((r) => r.score)),
  );
  check(
    'ranks are assigned',
    hostEnd.scoreboard.every((entry) => entry.rank >= 1 && entry.rank <= 3),
  );
  check('XP was awarded to the humans', hostEnd.awards.length === 2, `${hostEnd.awards.length}`);
  check(
    'XP is positive',
    hostEnd.awards.every((award) => award.xpGained > 0),
  );

  // ---------------------------------------------------------- leaving ------
  section('Leaving a room');

  // A fresh room, so nothing here depends on how the first match finished.
  host.close();
  guest.close();
  await new Promise((resolve) => setTimeout(resolve, 800));

  const second = await http('/api/rooms', {
    method: 'POST',
    token: host.token,
    body: {
      name: 'E2E handover',
      visibility: 'public',
      mode: 'general',
      difficulty: 'easy',
      maxPlayers: 4,
      settings: {
        cardCount: 6,
        categoryIds: [],
        answerWindowMs: 4000,
        comboEnabled: true,
        doubleCardEnabled: false,
      },
    },
  });
  const secondCode = second.json.room.code;

  host.events = [];
  guest.events = [];
  await host.connect(secondCode);
  await guest.connect(secondCode);
  check(
    'a room opens under the player who created it',
    guest.find('room:state').at(-1)?.hostUserId === host.userId,
  );

  // The host walks out, leaving one human and nothing else.
  host.send({ type: 'room:leave' });
  const handed = await guest.settle((state) => !state.players.some((p) => p.id === host.userId));
  check(
    'the host badge passes to the player who is left',
    handed?.hostUserId === guest.userId,
    `host=${handed?.hostUserId} guest=${guest.userId} players=${handed?.players.map((p) => p.id).join(',')}`,
  );
  check(
    'and the room no longer lists the player who left',
    !handed?.players.some((player) => player.id === host.userId),
  );

  // The badge is not decoration: before the handover this was refused.
  const errorsBefore = guest.find('error').length;
  const botUserId = bots.json.bots[0].userId;
  guest.send({ type: 'room:add_bot', profileId: bots.json.bots[0].profileId });
  // Named, not counted: the room also held two players before the host left,
  // and a stale snapshot of that would satisfy a bare count.
  const withBot = await guest.settle((state) => state.players.some((p) => p.id === botUserId));
  check(
    'the new host can add an opponent',
    guest.find('error').length === errorsBefore,
    guest.find('error').at(-1)?.code ?? '',
  );
  check('and the opponent is in the room', withBot?.players.length === 2, `${withBot?.players.length}`);

  // One human, one bot, mid-match. The human closes the tab: the bot has
  // nobody left to play in front of, so the match has to stop.
  guest.send({ type: 'match:start' });
  const startedOrRefused = await Promise.race([
    guest.waitFor('match:started', 20000),
    guest.waitFor('error', 20000),
  ]).catch(() => null);
  check(
    'the new host can start the match',
    startedOrRefused?.type === 'match:started',
    startedOrRefused?.code ?? 'nothing came back',
  );
  await guest.waitFor('card:served', 30000);
  guest.socket.close();
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const listedAfterWalkout = await http('/api/rooms', { token: host.token });
  check(
    'a room left to the bots stops being advertised',
    !listedAfterWalkout.json.rooms.some((room) => room.code === secondCode),
  );

  // The match waits 30 seconds (ABANDON_GRACE_MS in the engine) for a human to come back, so a page reload doesn't end it.
  guest.events = [];
  await guest.connect(secondCode);
  check(
    'a player who comes back within the grace period finds the match still running',
    guest.find('room:state').at(-1)?.match != null,
  );

  // Gone for good this time: once the grace period runs out, the match stops.
  guest.socket.close();
  await new Promise((resolve) => setTimeout(resolve, 33000));
  guest.events = [];
  await guest.connect(secondCode);
  check(
    'the match stopped rather than playing on to an empty room',
    guest.find('room:state').at(-1)?.match == null,
  );

  const walkedOut = await http('/api/stats/me', { token: guest.token });
  check(
    'and a match nobody stayed for is not counted as played',
    walkedOut.json.stats.matchesPlayed === 1,
    `${walkedOut.json.stats.matchesPlayed}`,
  );
  guest.close();

  // ------------------------------------------------------------ stats ------
  section('Persistence');

  const stats = await http('/api/stats/me', { token: host.token });
  check('match history recorded', stats.json.history.length === 1);
  check('answers were counted', stats.json.stats.answers === 6, `${stats.json.stats.answers}`);
  check('the match counts as played', stats.json.stats.matchesPlayed === 1);

  const board = await http('/api/stats/leaderboard', { token: host.token });
  check('leaderboard includes the players', board.json.leaderboard.length >= 2);
  check(
    'bots are excluded from the leaderboard',
    !board.json.leaderboard.some((row) => row.displayName === bots.json.bots[0].displayName),
  );

  const profile = await http(`/api/users/${host.userId}`, { token: host.token });
  check('public profile hides the email', profile.json.user.email === undefined);

  // ---------------------------------------------------------- friends ------
  section('Friends');

  const request = await http('/api/friends', {
    method: 'POST',
    token: host.token,
    body: { userId: guest.userId },
  });
  check('friend request sent', request.json.status === 'pending');

  await http(`/api/friends/${host.userId}/accept`, { method: 'POST', token: guest.token });
  const friends = await http('/api/friends', { token: host.token });
  check('friendship is accepted on both sides', friends.json.accepted.length === 1);
  check('friend shows an online flag', typeof friends.json.accepted[0].online === 'boolean');

  const self = await http('/api/friends', {
    method: 'POST',
    token: host.token,
    body: { userId: host.userId },
  });
  check('cannot befriend yourself', self.status === 400);

  host.close();
  guest.close();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nE2E crashed:', error);
  process.exit(1);
});
