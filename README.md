*This project has been created as part of the 42 curriculum by caida-si, alehenri, mlima-de, rsommer, hjuma.*

# Who knows best?

**A multiplayer quiz game you play in the browser.** A card with a statement appears and everyone in the room has a few seconds to decide: myth or truth? 
When time runs out, the answer is revealed with who got it right, who didn't, and the updated scoreboard. Then the next card is dealt.

```sh
make          # then open https://localhost:8443
```

## Description

Who Knows Best is our ft_transcendence project, consists in a web application with a frontend, a backend and a database, deployed with a single command.
The game itself takes one sentence to explain: one statement, two buttons, and a countdown. Most of the work went into the rules underneath.

### Rules

- **Faster answers score more.** A correct answer is worth 100 points, plus a speed bonus of up to 100 that shrinks evenly across the answer window.
- **Wrong answers cost 50 points.** With only two choices, a blind guess is right half the time. Without a penalty, the best strategy would be to guess as fast as possible, and the game would stop being about knowledge.
- **Your score never drops below zero.** The penalty can only take away points you already have. A bad start costs you the lead, not a hole you can't climb out of.
- **Streaks pay.** Each correct answer in a row adds 10%, up to +50%. Any miss resets it.
- **Every match is exactly half true, half false.** This is enforced when the deck is drawn, so it holds in every single match.
- **The server controls all timing.** The browser only displays what it's told.
- **You never see the same fact twice** in either of its two wordings.
- **A wrong answer teaches you something.** A false card leaves you believing something untrue, so the reveal always states the real fact.
- **Three languages** including the cards themselves.
- **Eight computer opponents** each with its own strengths, weaknesses and reaction speed.

### Key features

| | |
|---|---|
| **Live rooms** | Public listing, private invite codes, up to 8 players |
| **Real time match** | Server driven state machine over WebSockets |
| **Reconnection** | Drop out mid match, come back, keep your score and your place |
| **AI opponents** | Eight profiles with per category accuracy and sampled reaction times |
| **Tournaments** | Single elimination brackets of 4 or 8 |
| **Progression** | XP, levels, 14 achievements, leaderboard |
| **Statistics** | Win rate, accuracy per category, full match history |
| **Customisation** | Mode, difficulty, categories, match length, two modifiers |
| **Social** | Profiles, avatars, friends, live online status |
| **Accounts** | Email and password (Argon2id), optional Google, GitHub or 42 sign in |
| **Languages** | English, Portuguese (Brazil), French, for both the interface and the cards |


## Instructions

 **Here to change the code rather than run it?** Read ['DEV_DOC.md'](DEV_DOC.md). It maps every part of the project to the file that owns it.

### What you need

| Tool | Version | Notes |
|---|---|---|
| Docker Engine | 24+ | With the Compose v2 plugin |
| Docker Compose | v2 | Check with 'docker compose version' |
| GNU Make | 3.81+ | |
| OpenSSL | 1.1+ | Generates the certificate and the secrets |
| Google Chrome | latest stable | The supported browser |

You don't need Node.js, everything builds inside containers.

### Running it

```sh
git clone <this repository>
cd ft_transcendence
make
```

That's the whole setup. Behind the scenes, 'make':

1. **Creates '.env'** from '.env.example', generating a random database password and two random 48byte JWT secrets. An existing '.env' is left untouched.
2. **Issues a self signed TLS certificate** into 'infra/nginx/certs/'.
3. **Builds and starts** the four images.
4. **Applies the database migrations and loads the card set.** Both are safe to repeat, so restarting is never a problem.

Then open **<https://localhost:8443>**.

**Expect a certificate warning the first time.** The certificate is self signed. In Chrome, click *Advanced*, then *Proceed to localhost (unsafe)*. If you accidentally type 'http://' on that port, nginx redirects you.

### Demo accounts

Three accounts are ready to use straight away, the password for all of them is **'Password1!'**

| Email | Interface language |
|---|---|
| 'ada@wkb.local' | English |
| 'grace@wkb.local' | Português (Brasil) |
| 'alan@wkb.local' | Français |

They're also listed on the login screen; click one to fill in the form.

### Configuration

All settings are in '.env', which git ignores. The committed '.env.example' documents every key.

| Variable | Default | Purpose |
|---|---|---|
| 'WEB_PORT' | '8443' | Host port for the HTTPS edge |
| 'PUBLIC_ORIGIN' | 'https://localhost:8443' | OAuth redirect URIs and cookie scope |
| 'PUBLIC_ORIGIN_ALIASES' | empty | Other addresses the same deployment answers on |
| 'POSTGRES_*' | generated | Database credentials |
| 'DATABASE_URL' | generated | Read by Prisma |
| 'JWT_ACCESS_SECRET' | generated | Signs access tokens |
| 'JWT_REFRESH_SECRET' | generated | Keys the refresh token hashes |
| 'ACCESS_TOKEN_TTL' | '900' | Access token lifetime, in seconds |
| 'REFRESH_TOKEN_TTL' | '2592000' | Refresh token lifetime, in seconds |
| 'GOOGLE_CLIENT_ID' / '_SECRET' | empty | Optional. The button is hidden when unset |
| 'GITHUB_CLIENT_ID' / '_SECRET' | empty | Optional. The button is hidden when unset |
| 'FT_CLIENT_ID' / '_SECRET' | empty | 42's own sign in. Optional, like the others |
| 'ANTHROPIC_API_KEY' | empty | Not needed to run the game. Only used to rebuild the card set |

#### Turning on OAuth sign in (optional)

Without credentials, the provider buttons simply don't appear and everything else works. To enable one:

1. Register an app with the provider.
2. Set its callback URL to '${PUBLIC_ORIGIN}/api/auth/oauth/google/callback' (or '/github/callback', or '/42/callback').
3. Put the credentials in '.env'.
4. Run 'make up'.

**For 42:** register the app at <https://profile.intra.42.fr/oauth/applications/new> with the redirect URI above and the 'public' scope, the only one this app reads. Put its UID and secret in 'FT_CLIENT_ID' and 'FT_CLIENT_SECRET'. (They're prefixed 'FT_' because environment variable names can't start with a digit.)

### Playing from another machine

Set 'PUBLIC_ORIGIN' to the address other machines will use, keep the old address in 'PUBLIC_ORIGIN_ALIASES', and run 'make':

```sh
PUBLIC_ORIGIN=https://192.168.1.10:8443
PUBLIC_ORIGIN_ALIASES=https://localhost:8443
```

The browser builds every API and WebSocket URL from whatever address it was opened at, so both addresses work without a rebuild.
The certificate is issued for the names on those two lines and reissued whenever they change. That's why they're read at 'make' time rather than kept in sync by hand. It's still self signed, so each machine sees the warning once.
If OAuth is enabled, register a callback for each address you use. The provider sends visitors back to the address they started from, so both localhost and the LAN address work, but each one counts as a separate redirect URI for the provider.

### Commands

**Running the app**

```
make            build and start everything       make logs        follow the logs
make up         start without rebuilding         make ps          container status
make down       stop, keeping the data           make psql        a psql shell
make re         rebuild from scratch             make shell-api   a shell in the api
make fclean     stop and delete all data         make seed        run the seed again
```

**Checking it**

```
make test             typecheck, then e2e, then the console check
make e2e              play a full match through the API and the WebSocket
make console-check    load every screen in headless Chrome, fail on any console output
make a11y             contrast, target size and overflow across routes, themes and widths
make check            validate the card set: balance, coverage, negation tell
make cardgen ARGS="…" the card pipeline, see tools/cardgen/README.md
```

## Technical Stack

The first decision was TypeScript on both sides, and most of the others follow from it.
The WebSocket event types, the Zod validation schemas and the scoring function are written once in 'packages/shared' and imported by both the browser and the server. The two sides can't disagree about them, because there's only one copy.

### Frontend

| Choice | Why |
|---|---|
| **React 18 + Vite** | The subject counts React as a framework. Vite builds fast and outputs content hashed assets. |
| **Tailwind CSS 3** | The required CSS framework. Utility classes keep responsive styling right next to the markup. |
| **React Router 6** | Client side routing with a shared layout. |
| **i18next + react-i18next** | Three complete languages, switchable without a reload. |
| **Zod** | The exact same schemas the server uses. |

The app has only two pieces of shared state, the session and the room channel, and each is a custom hook. Redux would have been ceremony.

### Backend

| Choice | Why |
|---|---|
| **Fastify 5** | A backend framework, as the subject requires. Faster than Express, good TypeScript support, and its plugin model keeps cookies, rate limiting, uploads, static files and WebSockets as separate, visible pieces. |
| **@fastify/websocket** | Plain WebSockets. We avoided Socket.IO: it adds a second protocol on top, ships a client bundle, and we'd have had to understand its reconnection behaviour anyway. The subject asks for WebSockets, so we used WebSockets. |
| **Prisma 6** | The ORM module. Typed queries, real migration files, and raw SQL where it matters. |
| **jose** | JWT signing and verification. Modern and ESM-native. |
| **@node-rs/argon2** | Argon2id with prebuilt native binaries. |

### Database: PostgreSQL 16

Every match runs this query twice, once for the true half of the deck and once for the false half:

```sql
SELECT c.* FROM cards c
JOIN facts f ON f.id = c.fact_id
WHERE f.active
  AND (cardinality($1::int[]) = 0 OR f.category_id = ANY($1::int[]))
  AND f.difficulty = $2::"Difficulty"
  AND c.is_true = $3
  AND NOT (f.id = ANY($4::int[]))
  AND NOT EXISTS (SELECT 1 FROM user_seen_facts s
                  WHERE s.fact_id = f.id AND s.user_id = ANY($5::int[]))
ORDER BY random()
LIMIT $6
```

In one statement, at match start, for every player in the room at once, it uses:
- array parameters ('int[]', '= ANY', 'cardinality'),
- native enum types,
- 'ORDER BY random()',
- a correlated 'NOT EXISTS' against a table with a composite key.

PostgreSQL does all of this natively, SQLite has no arrays and no enums, so the same draw would have needed several round trips or SQL built by string concatenation.
The rest of the schema benefits too, 'jsonb' for bot profiles and achievement rules, 'count(*) FILTER (WHERE …)' for statistics, and real transactions for concurrent voting.

### Design

The card in play is warm paper on a dark table, with the rest of the deck stacked behind it.

#### The card is paper, so it doesn't change with the theme

The card keeps its own colours in both light and dark mode. That's the central idea, not a detail, paper doesn't change colour when the lights go out, so only the room around it is rethemed. It also means each suit colour needs a contrast check only once, and the card looks like the same object in either theme.
- **Light** is a warm paper room with an ochre accent and thin rules, the almanac look the project started with.
- **Dark** is the same table in an unlit room.
- **Follow the system** is the default, so the app matches your machine until you choose otherwise.

#### Every category is a suit

Just as every card in a real deck belongs to a suit:

| Category | Suit | Category | Suit |
|---|---|---|---|
| Sports & Games | a die (it's both) | Technology | a chip |
| History | a rolled papyrus | Arts | a quill |
| Science & Nature | orbits | Geography | a meridian globe |
| Space | a ringed planet | Society & Culture | a mask |

Each suit's colour drives the card's top band, inner keyline, crest and both corner pips.
The corner pip isn't just a shrunken crest. Fine line work reads well at 42px but turns to mud at 13px, so the detailed suits switch to a heavier stroke or a filled silhouette in the corner. That rule keeps four different drawing styles looking like one deck, and it's what real court cards do.

#### Green means *you* were right. Nothing else.

Four colours carry meaning during a match, in two pairs that must never be confused:

| Pair | Colours | Answers |
|---|---|---|
| Outcome | 'correct' (green), 'wrong' (red) | Were **you** right? |
| Answer | 'truth' (ink blue), 'myth' (plum) | Was the **statement** true? |

The reveal panel is framed in the outcome pair and names the statement in the answer pair.
At first the panel was coloured by the statement. So correctly spotting a myth produced a big red box with a small green "Correct" inside it, the two colours arguing. Two different facts were sharing one colour, and the player had to work out which one the red meant.

The same thinking explains the rest:
- **Vote buttons are blue and plum, not green and red.** A myth isn't a mistake, and a red button judges a press nobody has made yet.
- **The answer timer goes ink -> ochre -> red** and never green.

#### Type

The typeface is **Archivo**, a grotesque, self hosted as two woff2 files with its OFL licence. It replaced a book serif because the statements should read like a game, not a document.
Nothing is loaded from a font host that would be a dependency on evaluation day, a console error if it failed, and a third party to declare on the privacy page.

#### What we deliberately avoided

These were decisions, not defaults. AI generated interfaces tend to share one house style, and the list of things avoided says more than the list of things used:

| Avoided | Why |
|---|---|
| Lavender violet accent | The most recognisable sign of a generated interface. |
| Stacked transparency | Every shade is a flat, final colour. Layered alpha is a cheap way to fake depth, and it makes contrast impossible to verify. |
| Gradients on surfaces | Backgrounds, bars and avatars are solid. |
| Backdrop blur | Panels are opaque sheets with a 1px rule. |
| Coloured glows | The card has a single neutral shadow, because it genuinely sits above the table. |
| Inter | Archivo everywhere, except the legal pages, which keep the old serif for long form reading. |
| Pill shaped corners | Radii of 6 to 12px: somewhere between a printed rule and an app. |

#### Even errors come from the deck

- A page that doesn't exist shows the visitor from the space suit, adrift between two planets.
- A room or bracket that isn't there is dealt as a card, your false belief written as a statement, with "Myth" stamped underneath, in the same reveal panel you've seen twenty times a match. It's plum, never red, because nobody got anything wrong.
- An expired session is the one exception, a plain sentence above the login form. Someone whose game just ended wants the form and a reason, not a joke.

#### Two things that survived the redesign

- **The countdown is a bar under the card.** The card is what you're reading, so the timer belongs to it.
- **Keyboard shortcuts:** 'T' for truth, 'M' for myth. A timed game needed them anyway.

#### Contrast is measured, not assumed

Every visible piece of text on fourteen routes is checked against the background actually painted behind it, in both themes, against the WCAG AA threshold for its size and weight.
That check caught a real bug, avatar initials. The colours behind them are a fixed palette that doesn't follow the theme, but the text colour did. In dark mode it put dark text on a dark background at 2.65:1.

### Infrastructure

Four services on their own bridge network:

```
                         ┌──────────────────────────────────┐
   browser  ──HTTPS──▶   │ nginx     TLS 1.2/1.3 at the edge│
   (Chrome)  :8443       │           /api  /ws  →  api      │
                         │           everything else → web  │
                         └───────┬──────────────────┬───────┘
                         plain HTTP            plain HTTP
                                 │                  │
                    ┌────────────▼──────┐   ┌───────▼──────────┐
                    │ api   Fastify     │   │ web   nginx      │
                    │       node:22     │   │       static SPA │
                    └────────────┬──────┘   └──────────────────┘
                                 │ TCP
                    ┌────────────▼──────┐
                    │ postgres  16      │  named volume: pgdata
                    └───────────────────┘
```

TLS ends at the edge, traffic between containers is plain HTTP, which the subject allows. Only nginx publishes a port.


## Database Schema

21 tables, ten are enough to play a full match; the rest arrived with the modules that needed them.

```
CARD SET                              USERS
┌──────────────┐                      ┌────────────────┐
│ categories   │◀──┐                  │ users          │◀────┐
│  id, slug    │   │                  │  id, email     │     │
│  name        │   │                  │  password_hash │     │
└──────────────┘   │                  │  display_name  │     │
                   │ category_id      │  avatar_url    │     │
┌──────────────────┴───┐              │  locale, xp    │     │
│ facts                │              │  level, is_bot │     │
│  id, difficulty      │              │  totp_secret   │     │
│  source_ref (unique) │              │  last_seen_at  │     │
│  license, verified_at│              └────┬───────────┘     │
│  active              │                   │                 │
└───┬──────────────────┘                   │ user_id         │
    │ fact_id                              │                 │
┌───▼──────────────┐                  ┌────▼─────────────┐   │
│ cards            │                  │ oauth_accounts   │   │
│  id, text        │                  │ refresh_tokens   │   │
│  is_true         │                  │ friendships      │───┘
│  form(aff|neg)   │                  │ user_seen_facts  │
└───┬──────────────┘                  │ bot_profiles     │
    │ card_id                         │ user_achievements│
┌───▼──────────────┐                  └──────────────────┘
│ card_translations│
│  locale, text    │       ROOMS AND MATCHES
│  PK(card,locale) │       ┌───────────┐   ┌───────────────┐
└──────────────────┘       │ rooms     │──▶│ room_settings │
                           └─────┬─────┘   └───────────────┘
MODULES                          │ room_id
┌────────────────────────┐  ┌────▼──────┐
│ tournaments            │─▶│ matches   │
│ tournament_participants│  └──┬─────┬──┘
│ tournament_matchups    │     │     │
│ achievements           │  ┌──▼───┐ └──▶┌───────────────┐
└────────────────────────┘  │match_│     │ match_players │
                            │cards │     └───────┬───────┘
                            └──┬───┘             │
                               └────▶┌───────────▼─┐
                                     │ answers     │
                                     │ UNIQUE(card,│
                                     │        player)
                                     └─────────────┘
```

### Tables with a decision behind them

**'facts' and 'cards': knowledge vs. wording.** A *fact* is one piece of knowledge. A *card* is one way of wording it. Each fact has exactly two cards, an affirmative one (true) and a counter wording (false).
Variety is counted in facts, never in cards. Someone who knows a fact will answer both wordings without thinking, so showing a player both would be showing them the same card twice.

- 'facts.difficulty': enum 'easy | medium | hard'.
- 'facts.source_ref': unique text recording where each statement came from. It also lets the seed run twice without creating duplicates.
- 'cards.is_true' (boolean) and 'cards.form' (enum 'affirmative | negated').
- An index on '(category_id, difficulty, active)' and a unique constraint on '(fact_id, form)'.

**'user_seen_facts': what each player has already been shown.** Primary key '(user_id, fact_id)'. It's keyed by *fact*, never by card, which is how repetition is avoided. It also feeds the per-category accuracy in the statistics.

**'match_cards': the whole deck, written up front.** All of a match's cards are written when it starts, not one at a time. That's why reconnecting is a simple lookup rather than rebuilding state. 'served_at' and 'deadline_at' ('timestamptz') are written *after* the card goes out, because the deadline the server actually enforces is the one in memory.

**'match_players': nobody is removed mid-match.** A player who drops keeps their row, score and rank; only 'connected' changes. Nothing is deleted while a match is running.


**'answers': three timings per vote.**

| Column | Meaning |
|---|---|
| 'client_reaction_ms' | What the browser claimed |
| 'rtt_ms' | The server's moving average of round trip time for that connection |
| 'accepted_reaction_ms' | What was actually scored |

Plus a 'reaction_trusted' flag. Keeping all three makes it possible to audit how many answers fell outside the plausible window. The 'UNIQUE(match_card_id, match_player_id)' constraint is what really prevents double votes; the in memory check only saves a round trip.
**'bot_profiles.accuracy_by_category' is 'jsonb'.** A bot that's good at geography and bad at music is a data change, not a schema change.
**'achievements.criteria' is 'jsonb' too.** Adding a badge means editing the seed, not deploying code, 'services/rewards.ts' reads 'criteria.kind' and applies the rule.
**'tournament_matchups' stores every pairing explicitly.** Who plays whom, and in what order, is a query, not a formula the UI has to work out.
**Statistics are calculated on request** from 'answers' and 'match_players'. There are no stored counters, so nothing can drift out of sync with the matches that actually happened.

## Modules

**15 modules claimed, worth 21 points. The maximum score is 19**: the 14 required points plus the 5p bonus cap.

| # | Module | Type | Pts | Owner |
|---|---|---|---|---|
| 1 | Use a framework for both frontend and backend | Major | 2 | alehenri, hjuma |
| 2 | Implement a complete web-based game | Major | 2 | rsommer |
| 3 | Multiplayer game (more than two players) | Major | 2 | rsommer |
| 4 | Real time features using WebSockets | Major | 2 | rsommer |
| 5 | Standard user management and authentication | Major | 2 | caida-si |
| 6 | AI opponent | Major | 2 | mlima-de |
| 7 | Use an ORM for the database | Minor | 1 | caida-si |
| 8 | Remote authentication with OAuth 2.0 | Minor | 1 | caida-si |
| 9 | Tournament system | Minor | 1 | mlima-de |
| 10 | Gamification system | Minor | 1 | mlima-de |
| 11 | Game statistics and match history | Minor | 1 | mlima-de |
| 12 | Game customization options | Minor | 1 | hjuma |
| 13 | Multiple languages (at least 3) | Minor | 1 | hjuma |
| 14 | Custom made design system | Minor | 1 | hjuma |
| 15 | GDPR compliance features | Minor | 1 | caida-si |
| | 6 majors × 2 + 9 minors × 1 | | 21 | |
| | capped at 14 + 5 bonus | | 19 | |

Dependencies were respected; modules 3, 6, 9, 11 and 12 all need a working game, so module 2 was finished and playable before any of them started.

### 1. Framework for both frontend and backend (Major, 2 pts)

**Why:** the subject counts React as a frontend framework and Fastify as a backend one, and everything else is built on top.
**How:** React 18 with Vite for the single page app, Fastify 5 for the API, both in TypeScript and both importing 'packages/shared'. The WebSocket event types, Zod schemas and scoring function are compiled once and used by both sides.
**Code:** 'apps/web/src/', 'apps/api/src/server.ts', 'packages/shared/src/'

### 2. Complete web based game (Major, 2 pts)

**Why:** it's the product, everything else is built around it.
**How:** live matches over WebSockets, run by a state machine on the server. Clear rules (myth or truth within a time limit), clear scoring, and a clear winner (highest score after the last card). 2D, drawn in React.

Each card goes through this cycle in 'apps/api/src/game/engine.ts':

```
SERVING     stamp served_at and deadline_at, send the card to each
            player in their own language                        → COLLECTING
COLLECTING  take votes until deadline_at, or until everyone who
            can answer has                                      → REVEALING
REVEALING   score, save, broadcast the answer and the whole
            scoreboard, hold for about 4 seconds                → SERVING | SCOREBOARD
SCOREBOARD  final ranks, XP, achievements                       → back to the room lobby
```

**Code:** 'apps/api/src/game/engine.ts', 'apps/web/src/pages/Room.tsx'

### 3. Multiplayer, more than two players (Major, 2 pts)

**Why:** at three or more players, a quiz becomes a party game and the scoreboard starts to matter.
**How:** rooms hold up to 8 participants, each a row in 'match_players', every reveal broadcasts everyone's result plus the full scoreboard, not just the changes. Fairness between players on fast and slow connections is handled by the reaction time validation.

**To demonstrate:** open **three or more** browser windows. With only two, the module counts as not demonstrated.

### 4. Real time features using WebSockets (Major, 2 pts)

**Why:** a timed game where everyone answers at once can't be built on polling.
**How:** two separate channels from the very start:
- **'/ws/lobby'**: the public room list and who's online.
- **'/ws/room'**: one match (join, vote, reveal, scoreboard).

Keeping them apart means no message ever needs routing logic to figure out whether a socket happens to be in a room.
**Messages are handled in order.** Within one socket, handlers run one after another, chained on a promise. WebSockets deliver in order, so a client is entitled to expect the server to act in order. When handlers ran independently, a client that sent 'add_bot' then 'match:start' back to back could have the start check the room *before* the bot joined, and be told it needed a second player.
**Keeping clients in sync:** every reveal sends the full scoreboard, most events are serialised once per room. The two exceptions, 'card:served' and 'card:revealed', are built per connection, because each player reads the card and its correction in their own language.
**Authentication:** browsers can't set an 'Authorization' header on a WebSocket handshake, and a token in the URL ends up in proxy logs. So the client swaps its access token for a single use ticket, valid for 30 seconds, over HTTPS, and only the ticket goes in the URL. See 'apps/api/src/ws/ticket.ts'.
**If you disconnect:** you lose the current round but stay in the match with your score. Cards that pass while you're away count as no answer (zero points, streak reset). Your 'match_players' row is never deleted, only marked 'connected = false'.
**If you reconnect:** the client sends 'room:join'. The server finds your existing row and replies with a 'room:state' snapshot, current position, the card in play, time left and the scoreboard. There's no replay, because the whole deck was written to 'match_cards' at the start. The countdown resyncs to the time actually remaining, so a clock difference between browser and server can't make it end early.

**If someone leaves:**
- **The host leaves:** the room passes to whoever has been there longest, so it's never stuck without anyone who can change settings or press start. Only humans qualify; candidates are read from open sockets, and bots don't have one.
- **The last human leaves a match:** the match stops instead of letting bots play to an empty room, and nothing is recorded. 'ended_at' stays null, and every statistics query filters on 'ended_at IS NOT NULL', so the match never reaches history, XP or the leaderboard.
- **Tournament matches are the exception.** A bracket can't wait forever on a match that's never coming back, so it's settled as a forfeit, whoever stayed outranks whoever left.

**Code:** 'apps/api/src/ws/', 'apps/web/src/ws/'

### 5. Standard user management and authentication (Major, 2 pts)

**How:** sign up and login with email and password, hashed with Argon2id (19 MiB memory, 2 passes, 1 lane, a 16byte random salt per password). Profile editing, avatar upload with a generated default, and friends with live online status.
**Signing up doesn't log you in.** The server issues no token and sets no cookie at sign up. The new player goes to the sign in screen with the email prefilled and types the password they just chose, which is also the first chance to notice if it isn't the password they meant.

**Sessions:**
- A **short lived JWT access token**, kept only in memory and never in 'localStorage', where an injected script could read it.
- An **opaque refresh token** in an 'httpOnly', 'SameSite=Strict', 'Secure' cookie, scoped to '/api/auth'.
- Refresh tokens are **stored as keyed hashes**, so a copy of the database isn't enough to create a session. They rotate on every refresh, inside a transaction that prevents double use.

**Default avatar:** the subject requires one. Ours derives a fixed colour from the display name, so players stay easy to tell apart on a scoreboard.

**Code:** 'apps/api/src/routes/auth.ts', 'apps/api/src/lib/tokens.ts', 'apps/web/src/auth/'

### 6. AI opponent (Major, 2 pts)

**Why:** the game must be playable when nobody else is online, and the subject asks for an opponent that behaves like a person, not a solver.
**How:** a bot is a normal row in 'users' (with 'is_bot = true') plus a record in 'bot_profiles'. It joins 'match_players' like anyone else and answers through the same 'applyVote' function. The only difference is that its answer comes from an internal timer instead of a socket, so the AI needs no second copy of the game rules.

What makes it feel human:
- **Uneven knowledge.** 'accuracy_by_category' ('jsonb') gives each bot a hit rate per category. A bot that knows geography but misses music feels like a person; a uniformly mediocre one feels like a coin toss.
- **Realistic reaction times**, drawn from a truncated normal distribution. A sample that lands after the deadline is a bot that didn't answer in time, which humans do too.
- **It adapts to the room's settings.** Its average speed is calibrated against the 10sec medium window and rescaled to whatever window the room uses, which is how the bot uses the customisation options as the subject asks.
- **Difficulty matters.** Hard cards lower its accuracy by 8 points; easy cards raise it by 8.

**It's genuinely challenging and it does win.** 'Oracle' has 0.80–0.85 accuracy and a 3.0sec average reaction. 'Rookie' has 0.55 and 6.2sec. Six more sit in between.
**No language model plays the game.** It's a synthetic player with a set hit rate and sampled reaction times. That makes it explainable, reproducible, and able to run with no network.
**Code:** 'apps/api/src/game/bot.ts', 'apps/api/src/seed/data.ts'

### 7. ORM (Minor, 1 pt)

**Prisma 6**, with a versioned migration in 'apps/api/prisma/migrations/' that the container applies on every boot. Queries are typed throughout, it drops to '$queryRaw' with bound parameters only for the card draw and the statistics aggregates, where the SQL itself is the interesting part.

### 8. OAuth 2.0 (Minor, 1 pt)

**Authorization code flow for Google, GitHub and 42's intra.** The 'state' parameter is kept in a short lived 'httpOnly' cookie and compared in constant time.
**One code path for three providers.** They differ only in endpoints and in the shape of the profile they return, so the endpoints are a table and only the profile call branches. 42 is asked for the 'public' scope and nothing more, the app reads an id, an email, a login and an avatar, and has no use for the other permissions.
**No token ever appears in a redirect URL.** The callback sets the refresh cookie and redirects to '/auth/callback', where the app makes an ordinary session call, the same one a returning visitor makes.
**Visitors are sent back to the address they came from**, which lets one deployment serve both a LAN address and localhost. The address is chosen by looking the 'Host' header up in the configured list and returning the *configured* string. It's never rebuilt from the request, because a redirect built from an unchecked header is a way to get the authorization code delivered somewhere else.
**No duplicate accounts.** Accounts are matched by provider identity first, then by verified email, signing in with Google on an account that already has a password links the two, providers without credentials don't show a button.
**Code:** 'apps/api/src/routes/oauth.ts'

### 9. Tournament system (Minor, 1 pt)

**Single elimination brackets of 4 or 8 players.** Every pairing is a row in 'tournament_matchups' with the round, slot, both players, room, match and winner, so the full bracket order can be read straight from the database.
It handles registration, seeding, matchmaking, and automatic advancement when a round ends. Humans are spread across the bracket before bots fill the empty seats, so a solo player never ends up watching a bot vs bot game instead of playing.
**Bot vs bot matchups are simulated:** a real deck, real 'answers' rows, and the same 'decideBotAnswer' and 'computeScore' functions as live play. Only the waiting is skipped, since nobody's watching, and the interface says so.
**Code:** 'apps/api/src/services/tournament.ts', 'apps/web/src/pages/Tournaments.tsx'

### 10. Gamification (Minor, 1 pt)

The subject asks for at least three of: achievements, badges, leaderboards, XP, daily challenges or rewards, and explicitly says three done well beats six done badly. We built three:

1. **XP and levels.** 20 XP for playing, 10 per 100 points, and 50/25/10 for finishing 1st/2nd/3rd. 500 XP per level.

2. **14 achievements**, with rules stored as 'jsonb', so adding one is a seed change.

3. **A leaderboard** ranked by total score across finished matches. Bots are excluded, because a leaderboard the house can win isn't a leaderboard.

Everything is saved, the profile shows a level progress bar, and the end of match panel shows only newly unlocked achievements.
**Code:** 'apps/api/src/services/rewards.ts'

### 11. Game statistics and match history (Minor, 1 pt)

Wins, losses, ranking, level, win rate, accuracy, best streak, fastest correct answer, accuracy per category, a small chart of score over recent matches, and a full history with dates, results and opponents.
**Everything is calculated from 'answers' and 'match_players' when you ask for it.** There are no stored counters, so the numbers can't drift from the matches that produced them.
**Code:** 'apps/api/src/services/stats.ts', 'apps/web/src/pages/Stats.tsx'

### 12. Game customization (Minor, 1 pt)

Mode and difficulty alone would be thin, so a room offers much more:

| Option | Choices |
|---|---|
| **Mode** | General knowledge, or a single category room (its own room, not a filter inside the general one) |
| **Difficulty** | Easy (15s, 10 cards), medium (10s, 20 cards), hard (6s, 30 cards). Six seconds also makes looking answers up impractical. |
| **Categories** | Several at once in general mode |
| **Match length** | 5 to 40 cards, capped at what the card set can actually deal for those settings |
| **Answer window** | 3 to 30 seconds, independent of the difficulty preset |
| **Modifiers** | Switch the streak multiplier off; double value cards make every fifth card worth twice as much, for better or worse |
| **Player cap** | 2 to 8 |

Every option starts from a documented default, as the subject requires, and there's a "Reset to defaults" button. The host can change settings from inside the room without recreating it.
There are sixteen stock avatars, two per suit, chosen on the first run screen or later from the profile. The choice is stored in 'users.avatar_url' as 'preset:<id>', since that field already answers the one question of how a person is drawn.
A new account goes through a one time setup screen (display name, language, theme) instead of being dropped into a live lobby with whatever its browser guessed. It's tied to 'users.onboarded_at', so it follows the account to another machine. Every option on it is also available later in the header or on the profile page, so nothing there is a one time decision.
**Code:** 'apps/web/src/pages/CreateRoom.tsx', table 'room_settings'

### 13. Multiple languages (Minor, 1 pt)

**Three complete languages**: English, Português (Brasil) and Français. A switcher sits in the header on every screen, and the first run screen applies the choice as soon as it's picked.
**All 477 interface strings exist in all three languages**, and 'make e2e' checks that the key sets match exactly, with nothing missing and nothing extra. A key added to one language and forgotten in the others shows up as a raw key path, which is invisible to anyone testing in English.
**The cards are translated too.** All 360 facts exist in all three languages, and 'make check' confirms 100% coverage. In a room, each player sees the card in their own language, a deliberate and documented choice, since the answer is the same either way. A card missing a translation would fall back to English and say so, though on the shipped set that never happens.
**Switching language mid match changes the card on screen.** The socket's language is set when it opens, so a naive version would leave cards in the original language while every other label changed, which means the one thing you're actually reading would stay in the wrong language. A 'locale:set' event updates the socket's language, and the server replies with a room snapshot rather than a new card, the countdown resyncs to the time actually left, and a vote you've already cast is kept.
Category and achievement names travel as slugs and are translated in the browser, falling back to the stored English name. The interface language is saved on the account, so it follows the player between browsers.
**Code:** 'apps/web/src/i18n/', table 'card_translations'

### 14. Custom made design system (Minor, 1 pt)

**Why:** the subject asks for reusable components with a proper colour palette, typography and icons, at least ten. This module was claimed last because it wasn't built as a module, it's what the other fourteen are drawn with, and writing it down was the only extra work the claim needed.
**Nothing is borrowed.** 'apps/web/package.json' has no component library and no icon library, just React, the router, i18next, Zod, and Tailwind for utilities (which the subject requires). Every component, colour and drawing below was made in this repository.

**Eighteen reusable components**, each used by at least one file other than the one that defines it:

| Component | Used by |
|---|---|
| 'Button' 'Field' 'Alert' 'PageTitle' 'Avatar' 'EmptyState' 'Spinner' | 5 to 9 screens each |
| 'AvatarPicker' | Profile, first run setup |
| 'DeadEnd' | A missing room, a missing bracket |
| 'CardFace' 'TimerBar' 'VoteButtons' 'Scoreboard' | The match |
| 'ConnectionLost' | The match, when the socket drops |
| 'Layout' 'ThemeSwitcher' 'LanguageSwitcher' 'ThemeProvider' | The app shell |

**The palette:** 30 semantic tokens, each defined three times (light, explicit dark, and dark inherited from the system). They're named by meaning, not by colour, '--correct' and '--wrong' for whether you were right, '--truth' and '--myth' for what the statement was, and the two pairs are deliberately different colours. Every value is a flat, final colour with no transparency layering, which is what makes contrast measurable rather than a claim. 'make a11y' measures it.
**The typography:** Archivo, self hosted as two woff2 files with its OFL licence in 'apps/web/public/fonts/'. Nothing comes from a font host.
**The icons:** the eight suit marks (a die, a papyrus, orbits, a ringed planet, a chip, a quill, a meridian globe, a mask), each drawn twice: once as a 42px crest and once as a 13px corner pip, because fine detail turns to mud at pip size. Plus sixteen stock avatars, two per suit. Every one is an SVG path in 'apps/web/src/theme/'.
**Code:** 'apps/web/src/components/ui.tsx', 'apps/web/src/theme/', 'apps/web/src/index.css'.

### 15. GDPR compliance features (Minor, 1 pt)

**Why:** the Privacy Policy is a rejection level requirement, and it already promised that players could see their data and have it erased, before this module, those promises were kept by hand, by asking us. A policy describing a right the application can't actually exercise is exactly what the subject calls a placeholder.

#### Request your data

'GET /api/users/me/export' returns one JSON document with everything stored about the account:
- the account itself and linked sign ins;
- friendships, with direction and status;
- full statistics and every achievement with its unlock date;
- every match with every answer: the statement, whether it was true, your answer, the points, your reported reaction time, the accepted one, and the round trip time that separates them;
- every tournament entered, and the list of facts already shown.

It's built from the database tables directly, not from the views the interface uses, so it's what's actually stored rather than a tidied up version.
**The one field left out is 'password_hash'.** Giving someone their own Argon2id hash tells them nothing, and it hands anyone who has hijacked the session something to attack offline.

#### A readable format

Indented JSON, sent with a 'Content Disposition' header so the browser saves it as 'wkb-data-<name>.json'. Because the access token lives in memory and never in a URL, the download can't be a plain link. It goes through the same authenticated client as every other request and is turned into a file in the browser.

#### Deletion, with confirmation

'DELETE /api/users/me' requires you to type your display name, and to reenter your password if the account has one. Deletion is permanent, so the confirmation has to prove both intent and identity. An OAuth only account confirms with the name alone.

What gets removed:
- **Everything linked to the user cascades**: sessions, answers, friendships, achievements and match participation all go in one delete.
- **Tournament records are the exception.** 'tournament_matchups.player_a_id', 'player_b_id', 'winner_id' and 'tournaments.winner_id' hold a user id without a foreign key, so they're set to null in the same transaction. An id still pointing at a deleted person isn't erasure.
- **The uploaded avatar** is deleted from disk first, and the refresh cookie is cleared on the way out.

#### Confirmation emails: not implemented, and not claimed

The subject lists them as the fourth part of this module. This app has no mail server and sends no email at all, which is also why there's no password reset.
Adding email for one bullet point would mean a credential to store, a service to run, and a way for delivery to fail on evaluation day. Instead, confirmation happens immediately in the interface: name typed back, password re-entered, account gone before the response returns. **We'd rather say plainly which part is missing than claim it.**
**Code:** 'apps/api/src/routes/users.ts', 'apps/web/src/pages/Profile.tsx'

### Account and identity

| Feature | Description |
|---|---|
| Welcome page | A public front page, reached from the logo, what the game is, how a round works, and the eight suits, built from the same components as the game. |
| Sign up | Email, display name and password, validated by the same Zod schema on both sides. Creating an account doesn't log you in. |
| First run setup | A new account picks its name, language and theme once, before its first round. Tied to 'users.onboarded_at', so it follows the account, not the browser. |
| Login | Argon2id verification that takes about the same time whether or not the account exists, so the endpoint can't reveal which emails are registered. |
| OAuth sign in | Google, GitHub and 42 intra, authorization code flow with a CSRF protected 'state'. |
| Session | Access token in memory, rotating 'httpOnly' refresh cookie, renewed a minute before it expires. |
| Password change | Requires the current password and logs out every other session. |
| Profile | Display name, language, avatar, level and XP progress. |
| Avatar upload | File type checked from the actual bytes, 2 MB limit, old file removed. |
| Stock avatars | Sixteen ink stamps, two per suit, one of each pair isn't a person, the other is a person dressed for that suit. Chosen at setup or from the profile. |
| Default avatar | Generated from the display name with a fixed colour, for anyone who picks neither. |
| Friends | Request, accept, decline, remove, block. |
| Online status | Live over the lobby socket, backed by 'last_seen_at'. |

### Playing

| Feature | Description |
|---|---|
| Public lobby | Live list that updates as rooms appear, fill up and finish. |
| Private rooms | Joined only with a 6 character invite code. The letters I and O and digits 0 and 1 are left out, because codes get read aloud. |
| Room creation | Full customisation screen with documented defaults. |
| In room settings | The host can change them without recreating the room. |
| Computer opponents | Eight profiles, added by the host, described by strength and speed. |
| Live match | Server driven cycle with a countdown and two vote buttons, also on 'T' and 'M'. |
| Running scoreboard | Always visible, updated on every reveal. |
| Reveal | The answer, the correct fact, everyone's vote, each player's points, and the card's source reference. |
| Host handover | If the host leaves, the room passes to the next human, bots never qualify. |
| Walking out | A match whose last human leaves stops instead of playing on, and isn't recorded. |
| Reconnection | Rejoin mid match with score, position and remaining time intact. |
| Final scoreboard | Ranks, XP gained, level-ups and new achievements. |
| Tournaments | Create, register, fill with bots, start, and watch a live bracket. |

### Progression and data

| Feature | Description |
|---|---|
| XP and levels | With a progress bar on the profile. |
| Achievements | 14, with rules stored as data. |
| Leaderboard | Total score, matches, wins, accuracy, bots excluded. |
| Statistics | Win rate, accuracy, best streak, fastest answer, accuracy per category. |
| Match history | Dates, difficulty, rank, score and opponents. |
| Progress chart | Score over recent matches, drawn as inline SVG with no chart library. |

### Platform

| Feature | Description |
|---|---|
| One-command deploy | 'make' on a fresh clone, no network needed. |
| HTTPS everywhere | TLS 1.2/1.3 at nginx, certificate generated by the Makefile. |
| Three languages | Interface and cards. |
| Legal pages | Privacy Policy and Terms of Service with real content, linked in the footer, in all three languages. |
| Responsive | Mobile to desktop, using Tailwind breakpoints. |
| Accessibility | Keyboard navigation, visible focus rings, ARIA attributes on interactive controls, reduced motion support, WCAG AA contrast. |
| Error screens | A 404, a crash screen, a missing room or bracket, a dropped connection and an expired session, each handled where it happens rather than by one generic page. |
| Clean console | Checked in headless Chrome by 'make console-check'. |


## Team Information

We're a team of 5 people: caida-si, alehenri, mlima-de, rsommer, and hjuma.

| Member | Role(s) | Responsibilities |
|---|---|---|
| caida-si | Product Owner, Developer | Game rules and scope; auth, OAuth, database schema and ORM, GDPR |
| alehenri | Tech Lead, Developer | Stack and architecture; infrastructure, repo maintenance, card pipeline, test tooling |
| mlima-de | Project Manager, Developer | Phase plan and module dependencies; AI opponent, tournament, gamification, statistics |
| rsommer  | Developer | Match engine, multiplayer rooms, WebSockets, reconnection |
| hjuma | Developer | React frontend, design system, i18n, game customization |


### What each role meant in practice

- **Product Owner (caida-si):** decided what the game was, what the scoring rules should be, and what to leave out. For example, we dropped community submitted cards, ie they would have unlocked the AI content moderation minor, but they needed a submission screen, a review queue and a content policy, which is a lot of work for one point.
- **Project Manager (mlima-de):** ordered the work so every finished phase left something deliverable, tracked which modules depended on which, and kept the GitHub Issues board up to date.
- **Tech Lead (alehenri):** chose the stack and drove the three decisions the architecture rests on, ie, the server owns the clock, the deck is drawn up front, and the shared package is the only contract between the two sides. Also maintained the repo, branches, pull request reviews and merges.
- **Developers (all five):** we split the code by area:
  - **caida-si:** sign-up and login, OAuth, the database schema and Prisma, GDPR export and deletion.
  - **alehenri:** Docker Compose, the nginx edge and TLS, the Makefile and setup scripts, the card pipeline in 'tools/cardgen/', and the test tooling ('make e2e', 'make console-check', 'make a11y').
  - **mlima-de:** the AI opponents, the tournament system, gamification, and statistics and match history.
  - **rsommer:** the match engine and its state machine, multiplayer rooms, WebSockets, and reconnection.
  - **hjuma:** the React frontend, the design system, translations into three languages, and game customization.

## Individual Contributions

| Member | Built | Challenges they solved (see below) |
|---|---|---|
| caida-si | Auth, sessions, OAuth, Prisma schema, GDPR export and deletion | #6 Console errors on pages with nothing wrong |
| alehenri | Docker, nginx and TLS, Makefile, card pipeline, test tooling, repo maintenance | #2 The "not" giveaway, #10 Prisma vs. the container |
| mlima-de | AI opponents, tournaments, gamification, statistics | Simulating bot vs bot tournament matches (see module 9) |
| rsommer | Match engine, rooms, WebSockets, reconnection, scoring | #1 The 50/50 problem, #3 Connection speed, #4 Reconnecting, #7 Database write, #9 Message ordering |
| hjuma | React frontend, design system, i18n, customization | #5 The countdown that ended early, #8 Cards ignoring the language switcher |


## Project Management

### How the work was organised

**Phase by phase, and no phase started before the previous one met its own acceptance criteria.** The order meant every finished phase left something deliverable. Running out of time would have meant fewer modules, not a broken application.

```
0  Foundation   docker, HTTPS, .env, legal pages, skeleton
1  Card set     collect, convert, filter, both wordings, verify, translate, check
2  Database     Prisma schema, migration, repeatable seed
3  Users        auth, profile, avatar, friends, OAuth
4  Match        rooms, WebSockets, state machine, scoreboard, reconnection, 50/50
5  Scoring      formula, difficulties, RTT validation
6  AI           bot profiles, synthetic player
7  Modules      tournament, gamification, statistics, customization
8  i18n         interface and cards
9  Docs         README and evaluation rehearsal
```

Module dependencies were checked, not assumed. Modules 3, 6, 9, 11 and 12 all need a working game, so nothing in phase 7 started until phase 4 could be played end to end.

### Tools

| Tool | Use |
|---|---|
| Git | Small commits, each describing what changed. |
| The Makefile | In practice, the task list. 'make test' is our definition of "still working". |
| 'make e2e' | 74 assertions that play a real match through the real API. |
| 'make console-check' | Headless Chrome across 17 screens, failing on any console output. |
| 'make a11y' | Contrast, tap target size and overflow across 14 routes, both themes, 8 screen widths. |
| 'make check' | Card set balance, coverage and the negation tell. |
| TypeScript, strict mode | With 'noUncheckedIndexedAccess', so the compiler enforces what the tests don't. |


### Communication

- **Day to day:** a Discord and a WhatsApp group for quick questions, blockers and "I'm about to change X" warnings.
- **Meetings:** we met at 42 to review progress against the phase plan and decide what each person takes next and so on.
- **Code:** all changes went through pull requests on GitHub. alehenri, as the repo maintainer, reviewed and merged. Branches were named by feature and login, and 'main' was always kept in a state where 'make' worked.
- **Tasks:** GitHub Issues, one item per feature, assigned to whoever owned it.
- **Decisions:** anything non obvious was written down where it would be found later, as comments in the code explaining *why*, and in this README as the justification for each module and technical choice.


### Challenges, and how we dealt with them

#### 1. The 50/50 problem

**Problem:** with only two possible answers, the proportion of true cards is information players can exploit. If 60% of cards were true, the best strategy would be to answer "truth" instantly every time, and the streak multiplier would reward exactly that, therefore the game would be dead.
**Fix:** balance is a property of the *draw*, not the card set, which means each match takes half its cards from the true pool and half from the false pool, in two queries, then shuffles them. If there aren't enough cards for the requested length, the deck shrinks but the guarantee doesn't, the two halves never differ by more than one card. See 'apps/api/src/game/draw.ts'.


#### 2. The "not" giveaway, which the 50/50 fix creates

**Problem:** giving each fact a true and a false wording is the obvious way to guarantee balance, and the obvious way to write the false one is to add "not". That would hand players a free strategy; spot the negation, answer false, never read the statement.
**Fix:** the false wording swaps the key detail instead:
> The Nile flows **northward**. -> The Nile flows **southward**.

**And then we measured it.** 'make check' counts negation words on each side. The shipped set scores −1.67 percentage points, negation words are slightly *more* common in true cards, so they give nothing away. Some true cards naturally contain a negation, like "Switzerland has no coastline", which is what pushes the number below zero.

#### 3. Connection speed as an unfair advantage

**Problem:** scoring on speed punishes players for slow networks, and a modified client could claim an impossible reaction time.
**Fix:** limit what a client is allowed to claim.
- The server pings every 5 seconds and keeps a moving average of each connection's round trip time (RTT).
- A claimed reaction time is accepted only if it falls within '[serverElapsed − rtt − 250ms, serverElapsed + 250ms]'. Anything outside gets the worst time of the round.
- The RTT used is capped at one second, the client decides when to answer a ping, so without a cap, a client could delay its replies to widen the window as far as it liked.
- All three numbers (claimed, RTT, accepted) are stored separately, so the behaviour can be audited later.

It's about 40 lines, in 'packages/shared/src/scoring.ts'.

#### 4. Reconnecting without replaying the match

**Problem:** the obvious design sends one card at a time and rebuilds state when someone returns, that's fiddly and easy to get subtly wrong.
**Fix:** draw the whole deck when the match starts and write it to 'match_cards'. Reconnecting becomes a lookup, find the player's row, read the current position, send a snapshot. There's no replay because there's nothing to replay. 'make e2e' drops a player mid match and checks the snapshot is correct.

#### 5. The countdown that ended early

**Problem:** the first timer was based on the server's 'deadline_at', on any machine whose clock differed from the server's, the timer ran out before the real window did, and players thought they'd missed a card they could still answer.
**Fix:** the timer now starts from the moment the card appears in *that* browser, and re-syncs from 'remainingMs' on reconnect. The browser's timer is just a display; the server owns the real deadline.

#### 6. Console errors on pages with nothing wrong

**Problem:** the subject rejects any project with console errors, our session check returned 401 for logged out visitors, and Chrome logs every failed response, so every public page showed red errors twice before rendering perfectly.
**Fix:** split the endpoints. 'GET /api/auth/session' returns 200 with 'authenticated: false' for the page load check, and 'POST /api/auth/refresh' keeps its 401 for mid session use; the client also renews a minute before expiry, so a 401 never reaches the console.

#### 7. A database write eating into the answer window

**Problem:** 'serveNext' set 'served_at' and 'deadline_at', *waited for the database write*, then sent the card. With a slow database, every millisecond of that write came out of the players' time, because the deadline was already fixed.
**Fix:** send the card first, write the row after, measured across 18 cards afterwards, the window was exactly the configured 4.000 seconds every time.

#### 8. Cards ignoring the language switcher

**Problem:** the socket's language was fixed when it opened, so switching language mid-match changed every label except the card.
**Fix:** a 'locale:set' event.

#### 9. Two messages from one socket, running at once

**Problem:** the room channel started a handler for each message without waiting for the previous one, a client that sent 'add_bot' then 'match:start' back to back could have the start check the room *before* the bot joined, and be told it needed a second player.
**Fix:** handlers are now chained on a promise, so they run in order, just as WebSockets deliver in order. **One exception: 'pong' is answered immediately.** It's a timing measurement, and time spent waiting behind a database query would be counted as network latency, which is exactly the number that decides how much reaction time leeway a player gets.

This bug surfaced while writing the test for host handover, not from a bug report.

#### 10. Prisma vs. the container

**Problem:** the API crashed in a loop on first boot, for two reasons:
- The Prisma client was generated in a build stage without OpenSSL, so it targeted 'openssl-1.1.x' while the runtime image had 'openssl-3.0.x'.
- The CLI couldn't write its engine directory as the unprivileged 'node' user.

**Fix:** pinned 'binaryTargets' instead of relying on auto detection, installed OpenSSL in the build stage too, and gave the runtime user ownership of the app folder. Both fixes are commented where they live, so nobody has to rediscover them.

## Resources

### Documentation

- [Fastify](https://fastify.dev/docs/latest/): plugin model, hooks and error handling
- [@fastify/websocket](https://github.com/fastify/fastify-websocket): version 11 changed the handler signature to '(socket, request)'
- [Prisma](https://www.prisma.io/docs): schema reference, migrations and '$queryRaw' parameter binding
- [PostgreSQL 16](https://www.postgresql.org/docs/16/): array operators, 'FILTER' and 'jsonb'
- [React](https://react.dev/reference/react) and [React Router 6](https://reactrouter.com/en/main)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [i18next](https://www.i18next.com/), including 'returnObjects' for the legal pages
- [MDN on WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [MDN on Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie): 'SameSite' and 'HttpOnly'

### Security

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html): the source of the Argon2id parameters (19 MiB, t=2, p=1)
- [RFC 6749, OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc6749): the authorization code flow and the 'state' parameter
- [RFC 9106, Argon2](https://datatracker.ietf.org/doc/html/rfc9106)
- [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html): why the access token doesn't live in 'localStorage'

### Data

- [Open Trivia Database](https://opentdb.com/), CC BY-SA 4.0: the source pool for the card pipeline. Its [API documentation](https://opentdb.com/api_config.php) covers the session token mechanism.
- [Creative Commons BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

### Techniques

- **Box Muller transform**: draws bot reaction times from a normal distribution instead of a uniform one
- **Fisher Yates shuffle**, seeded from the cryptographic random number generator
- **The [rule of three](https://en.wikipedia.org/wiki/Rule_of_three_%28statistics%29)**: the confidence bound for a sample with zero errors (used [below](#how-accurate-is-the-card-set))

### Design

- [Wikipedia: Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), used to review the writing in this README
- [AI Design Slop and how to spot it](https://www.developersdigest.tech/blog/ai-design-slop-and-how-to-spot-it), used to review the interface

### How AI was used

The subject asks which tasks and which parts, so here's the detail.

#### In the card pipeline

'tools/cardgen/' implements an 11 step pipeline, described in 'tools/cardgen/README.md'. Three steps use a language model:

| Step | What the model does |
|---|---|
| 'forms' | Writes the true and false wording of each fact, twenty at a time. |
| 'verify' | A blind check, reads a wording *without* being told its stored answer, and says whether it's true. |
| 'translate' | Translates, then blind checks the translation the same way, because translation flips meaning about as often as negation does. |

The model is 'claude-sonnet-5' at 'temperature: 0', called through the Anthropic Messages API. When the blind check disagrees with a card, nothing is fixed automatically, the card goes to 'work/review-queue.json' and waits for a person.

**What was actually run:**

| Step | Status | Result |
|---|---|---|
| 'counts' | Run | 21,602 questions, 5,298 verified |
| 'collect' | Run | 5,248 unique questions in about 106 calls over 9 minutes, committed to 'tools/cardgen/data/raw/questions.json' (2.0 MB) |
| 'convert' | Run | 5,248 questions became 4,634 facts. 601 skipped because they depended on their answer options, 13 for sensitive wording, 173 flagged by the time sensitivity filter (105 superlatives, 37 uniqueness claims, 13 recent years, and others) |
| 'forms', 'verify', 'translate' | **Not run** | They need 'ANTHROPIC_API_KEY', which isn't part of this deliverable |

**So the cards you play are not AI generated.** All 360 facts were written by hand, in three languages and both wordings. The pipeline is real, and it's been tested against the live API for the steps that don't need a key. It's there to grow the set later. Claiming otherwise would be the easiest thing in this README to get caught on.

#### In development

We used AI as a pair programmer,  scaffolding boilerplate, reviewing the concurrency around voting, catching the Prisma binary target mismatch, and drafting prose for the legal pages and this README. **Every architectural decision recorded here was ours**, and each one is argued for above on its own merits.

#### Where we didn't use it

- **Scoring, timing and card selection** are plain, deterministic functions with no model involved. 'computeScore' and 'validateReaction' are about 40 lines each, in 'packages/shared/src/scoring.ts'.
- **The AI opponent contains no language model**, despite the module name. It's a synthetic player with per category hit rates and reaction times from a truncated normal distribution, which makes it explainable, reproducible and able to run offline.

### How accurate is the card set?

Step 9 of the pipeline calls for a manual sample after all the filters, with a target error rate **under 2%**.
**Method:** two independent random draws with 'cardgen sample', covering all three languages and both wordings. We read each statement, decided for ourselves whether it was true, and compared with the stored answer.
**Result:** 103 cards reviewed, **0 errors**, a measured error rate of 0.0%.
**The honest caveat:** zero errors in 103 samples only puts the 95% upper confidence bound at about **2.9%** (by the rule of three). The true rate is probably under 2%, but 103 samples can't prove it. Quoting 0.0% without that bound would claim more than the sample supports.
The structural checks cover every card, not a sample, and they all pass:

```
Categories: 8      Facts: 360      Cards: 720 (360 true, 360 false)
en 720 (100.0%)    pt-BR 720 (100.0%)    fr 720 (100.0%)
Negation tell skew: -1.67 percentage points
No structural problems found.
```

## Testing

```sh
make test
```

### 'make e2e': a real match, start to finish

**74 assertions** that play a real match through the real API and the real WebSocket. In one run:
1. Two accounts sign up and log in.
2. A room is created and a bot is added.
3. Six cards are played.
4. One player drops mid match and reconnects.
5. One player switches language mid card.
6. The host walks out of a second room, and the last human walks out of a match.
7. The saved results are checked.

Among other things, it verifies that:
- the deck was exactly half true and half false;
- a correct answer never scores below the base, and a wrong one costs exactly 50;
- every card carries a source reference;
- only the host can start;
- the reconnect snapshot has the right position and scoreboard;
- switching language changes the card without restarting the countdown;
- the host role passes to the player who stays;
- a match everyone walked out of isn't counted;
- bots stay off the leaderboard.

### 'make console-check': a clean console

Loads 17 screens in headless Chrome, signs in, switches language three times, and opens a room (which opens both WebSocket channels). It fails on any console error or warning, any page error, any failed request, and any non API HTTP status of 400 or above.

```
Checked 17 screens in headless Chrome.
Console is clean, no errors, no warnings, no failed requests.
```

### 'make check': the card set

Validates the card set offline: balance per category and difficulty, translation coverage, duplicate references, broken wordings, and the negation tell.

## Known limitations

Listed here because a reviewer will find them anyway.
**The match engine runs in a single process.** Live room state and phase timers are held in memory in the API and written through to Postgres, that works because exactly one API container runs. Scaling to several would need the timers behind a shared lock or moved into their own service. This was a deliberate trade off: at this scale the alternative adds a lot of complexity for no benefit.
**Bots in a room's lobby are held in memory.** If the API restarts while a room is waiting in its lobby, the bots must be added again. Bots in a running match are rows in 'match_players' and survive.
**The card set has 360 facts.** That's plenty for general knowledge rooms at any difficulty. But a single category room on hard has only 14 facts to draw from, so it deals a 14 card match instead of 30. The room creation screen shows the available count, and the draw shrinks the deck rather than breaking the 50/50 guarantee. 'tools/cardgen' exists to grow the set.
**The certificate is self-signed**, so Chrome warns once. A real deployment would use a real certificate and nothing else would change.
**There's no email**, so there's no password reset, the Privacy Policy says so.
**Statistics are calculated on request.** That's correct by design and fast at this scale. If it ever gets slow, the fix is a materialised view, and the schema is ready for one.
**Two copies on one machine collide.** 'docker-compose.yml' pins the project name to 'wkb', so a second clone reuses the same containers and the same 'pgdata' volume, and the database keeps whichever '.env' password created it first. That's fine for an evaluation, which uses one copy. Run 'make fclean' before switching between copies.

**Accessibility is good, but not formally audited.** In place:
- keyboard navigation, including 'T' and 'M' to vote, with visible focus rings;
- ARIA attributes on interactive controls;
- reduced motion support, and a 'lang' attribute that follows the chosen language;
- **contrast:** every text and background pair meets WCAG AA in light and dark mode, measured on every visible piece of text across fourteen routes in both themes, not sampled;
- **tap targets:** every interactive target on every route measures at least 24×24 (WCAG 2.2, SC 2.5.8). A control inside a padded label counts as the label, and links inside a sentence are excluded, as that criterion allows;
- **overflow:** fourteen routes checked for horizontal scrolling at eight widths, from 320px to 1440px.

**We didn't test with a screen reader**, so we're not claiming the WCAG 2.1 AA module.
**Reusing an old refresh token isn't treated as theft.** The textbook defence is to revoke every session of a user whose old token reappears. Here, that would log people out for ordinary reasons: two tabs renewing at the same moment, or another device renewing after a password change, both present a token that was just revoked. Telling those cases apart from a stolen token would require each token to record what replaced it, which the schema doesn't do. The cookie is 'httpOnly', 'Secure' and 'SameSite=Strict', so stealing it in the first place is already hard.


## Evaluation checklist

- [x] Boots from a fresh clone with one command, with no network
- [x] Frontend, backend and database, all in containers
- [x] HTTPS on every external connection
- [x] Chrome console clean on every screen, checked in headless Chrome
- [x] Privacy Policy and Terms of Service with real content, in the footer, in three languages
- [x] Multiple simultaneous users with no data corruption and no race conditions
- [x] Responsive frontend using a CSS framework
- [x] Credentials in '.env', git ignored, with a committed '.env.example'
- [x] Clear schema with well defined relations
- [x] Email and password auth, hashed and salted with Argon2id
- [x] Input validation on frontend and backend, from one shared schema
- [x] Git history with clear commit messages
- [x] Complete README in English

### During the demonstration

1. **Open three or more browser windows.** With two, the Multiplayer 3+ module counts as not demonstrated.
2. **Show disconnection and reconnection live.** Close a tab mid match, watch the scoreboard grey that player out, then reopen it and rejoin.
3. **Demonstrate every claimed module.** An incomplete one scores zero.
4. **Be ready for a small change on the spot.**

### Good questions to ask us

- Why does the server own the clock?
- Why is the deck drawn up front?
- Why does the false wording swap a detail instead of adding "not", and what does 'make check' measure about it?
- What are the three time columns in 'answers' for?
- Why isn't the AI opponent a language model?

## License and credits

- **Source code:** MIT. See ['LICENSE'](LICENSE).
- **Card set:** Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0). See ['LICENSE-CARDS.md'](LICENSE-CARDS.md).
- **Interface font:** [Archivo](https://github.com/Omnibus-Type/Archivo) by Omnibus Type, under the SIL Open Font License 1.1. It's committed to 'apps/web/public/fonts/', served from this site, and its licence travels with it in 'apps/web/public/fonts/OFL.txt'.

### Attribution

The suit drawings and the rest of the interface are original work under the project's MIT licence.
The [Open Trivia Database](https://opentdb.com/) (CC BY-SA 4.0) is the source pool for the card pipeline in 'tools/cardgen/', and its raw download is committed to 'tools/cardgen/data/raw/'. Share alike carries over to derived work, so the whole card set uses the same licence.
The attribution appears in three places, a footer link on every page, a section of the Terms of Service in all three languages, and 'LICENSE-CARDS.md'.
Every fact has a 'source_ref' and a 'license' column, so any card can be traced to its origin, 'curated:<ref>' for the hand-written set, 'opentdb:<sha256>' for anything derived from OpenTDB.

*Built at 42 Luxembourg. Run 'make', then open <https://localhost:8443>.*