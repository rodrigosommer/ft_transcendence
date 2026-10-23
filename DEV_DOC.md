# Developer map

Where everything is, and which file to open when you want to change something. 
The README explains what the project is and why it works the way it does. This file is just the index.

## Before going forward read these 5 files first

1. **'apps/api/src/server.ts'**: registers every plugin and route. If you can't find something on the server, start here.
2. **'apps/api/src/game/engine.ts'**: the heart of the game and the biggest file in the project.
3. **'packages/shared/src/'**: the contract between browser and server.
4. **'apps/web/src/App.tsx'**: every frontend route.
5. **'Makefile'**: every task you'll need.

## Layout at a glance

```
ft_transcendence/
├── apps/
│   ├── api/          Fastify server, Prisma schema, the seed
│   └── web/          React single page app
├── packages/
│   └── shared/       Types, Zod schemas and scoring, used by both sides
├── infra/nginx/      The TLS edge config, and the generated certificate
├── tools/
│   ├── cardgen/      Offline pipeline that builds card sets from OpenTDB
│   └── scripts/      Setup and test scripts the Makefile calls
├── docker-compose.yml
├── Makefile          Every task you will need
└── .env.example      Every configuration key, documented
```

Roughly: 4,800 lines of backend, 6,800 of frontend, 520 shared, 1,000 in the card pipeline.

## Common tasks
 
Details for each area follow further down.
 
| I want to… | Do this |
|---|---|
| **Add or edit a card** | Edit the right file in 'apps/api/prisma/seed/facts/', then 'make seed', then 'make check. |
| **Add a category** | Create a new file in that same folder with a new 'slug'. Add the translated name under 'categories.<slug>' in all three locale files. Optionally add a suit in 'theme/suits.tsx'. Then 'make seed'. |
| **Change the scoring** | Formula in 'packages/shared/src/scoring.ts', numbers in 'packages/shared/src/constants.ts'. Run 'make typecheck' so both sides pick it up. |
| **Add an achievement** | Add an entry to 'ACHIEVEMENTS' in 'apps/api/src/seed/data.ts'. Add its name and description under 'achievements.<slug>' in all three locale files. If the unlock rule is new, add a case to 'unlockedSlugs' in 'apps/api/src/services/rewards.ts'. Then 'make seed'. |
| **Add a bot** | Add an entry to 'BOTS' in 'apps/api/src/seed/data.ts' and a one line description under 'bot.<name>' in all three locale files. Then 'make seed'. |
| **Add a WebSocket message** | Add it to the right union in 'packages/shared/src/events.ts', handle it in 'apps/api/src/ws/room.ts', and handle it in 'apps/web/src/ws/useRoomChannel.ts'. |
| **Add a screen** | Add the page under 'apps/web/src/pages/', add a route in 'App.tsx', add its strings to all three locale files, and add it to the list in 'tools/scripts/console-check.mjs'. |
| **Add a language** | Add it to 'LOCALES' in 'packages/shared/src/constants.ts', add a locale file, register it in 'i18n/index.ts', and add the new wording to every card in the eight source files. |
| **Change the look** | Colours, fonts and radii: 'apps/web/tailwind.config.js'. Shared component classes: 'index.css'. |
| **Start over from nothing** | 'make fclean' removes the containers, images and database. 'make' rebuilds everything. |

## The shared package is the contract

'packages/shared/src/' is imported by the browser and the server, anything that both sides have to agree on goes in here, and nowhere else.

| File | Holds |
|---|---|
| 'constants.ts' | Locales, difficulties and their presets, scoring constants, room limits, the XP curve |
| 'events.ts' | Every WebSocket message, in both directions |
| 'scoring.ts' | 'computeScore', 'validateReaction', 'applyDelta' |
| 'validation.ts' | Every Zod schema used by a form or a route |
| 'index.ts' | Reexports the four above |

If you change a type here, run 'npm run build -w @wkb/shared' (or just 'make typecheck') before the other two workspaces will see it.

## Cards: from JSON to a match
 
A card passes through three places, in this order.
 
### 1. Source files (committed, and the only place to edit by hand)
 
`apps/api/prisma/seed/facts/*.json`: one file per category, eight files, 360 facts in total.
 
```json
{
  "category": { "slug": "geography", "name": "Geography" },
  "license": "CC BY-SA 4.0",
  "facts": [
    {
      "ref": "geo-001",
      "difficulty": "easy",
      "en":    { "t": "The Nile flows northward.", "f": "The Nile flows southward." },
      "pt-BR": { "t": "O Nilo corre para o norte.", "f": "O Nilo corre para o sul." },
      "fr":    { "t": "Le Nil coule vers le nord.", "f": "Le Nil coule vers le sud." }
    }
  ]
}
```
 
- 't' is the affirmative wording. It is **always true**.
- 'f' is the counter wording. It is **always false**.
- Build 'f' by swapping the key value, not by adding "not". 'make check' measures how well the set sticks to that rule.

### 2. The database
 
The seed loads those files into four tables: 'categories', 'facts', 'cards' and 'card_translations'.
One fact becomes two rows in 'cards' (true and false). Each of those gets two rows in 'card_translations', one per non English locale.
The seed matches on 'source_ref', so running 'make seed' again **updates** existing cards rather than duplicating them.
 
### 3. A live match
 
'match_cards' holds the deck for a single match, it's drawn once, when the match starts.
 
## Translations: two separate systems
 
There are two kinds of text, and they're stored in different places.
**Interface text** (buttons, menus, pages) is in 'apps/web/src/i18n/locales/{en,pt-BR,fr}.json', 436 strings each. **The keys must match exactly across all three files.**
This includes the Privacy Policy and Terms of Service, they're stored as arrays of paragraphs under 'legal.privacy' and 'legal.terms', and rendered by 'pages/Legal.tsx'.
**Card text** lives in the database, in 'card_translations'. It comes from the 'pt-BR' and 'fr' blocks of the source JSON above.
**Category and achievement names** are a bit of both. They're stored in English in the database, then translated in the browser by slug under the 'categories.* ' and  'achievements.*' keys. If no translation exists, the stored English name is shown.
 
| File | Job |
|---|---|
| 'apps/web/src/i18n/index.ts' | i18next setup, language detection, 'setLocale' |
| 'apps/web/src/i18n/localeBus.ts' | Tells the open room socket that the language changed |
| 'apps/web/src/components/LanguageSwitcher.tsx' | The EN / PT / FR control |
 
## Game rules
 
| Rule | File |
|---|---|
| Points, speed bonus, combo, the zero floor | 'packages/shared/src/scoring.ts' |
| Is this reaction time humanly plausible? | 'validateReaction' in 'packages/shared/src/scoring.ts' |
| Difficulty presets (answer window, card count) | 'packages/shared/src/constants.ts' |
| Drawing a balanced deck | 'apps/api/src/game/draw.ts' |
| The match state machine | 'apps/api/src/game/engine.ts' |
| How bots play | 'apps/api/src/game/bot.ts' |
| Bot personalities | 'apps/api/src/seed/data.ts' |
| Live room and lobby state | 'apps/api/src/game/registry.ts' |
| Host handover, players walking out | 'handleDeparture' in 'apps/api/src/game/engine.ts' |
**Read 'engine.ts' first.** It decides when a card is served, when the answer window closes, and what each vote is worth.
 
## Backend ('apps/api/src/')
 
| Where | What's there |
|---|---|
| 'server.ts' | Registers every plugin and route. Start here to find anything. |
| 'env.ts' | Configuration, validated once at boot |
| 'db.ts' | The Prisma client |
| 'routes/' | One file per area: 'auth', 'oauth', 'users', 'friends', 'rooms', 'catalog', 'stats', 'tournaments', 'health' |
| 'ws/' | 'room.ts' and 'lobby.ts' are the two channels. 'connection.ts' wraps a socket and runs the heartbeat. 'ticket.ts' issues single use handshake tickets. |
| 'services/' | Logic shared by several routes: 'stats', 'rewards', 'tournament', 'rooms' |
| 'game/' | The engine, the deck draw, the bots, the registry |
| 'lib/' | Small helpers: 'tokens', 'password', 'random', 'images', 'serialize', 'httpError' |
| 'plugins/' | 'auth.ts' guards routes. 'errors.ts' turns every thrown error into one JSON shape. |
| 'seed/' | 'index.ts' loads everything. 'data.ts' holds bots, achievements and demo users. |
 
**About OAuth:** 'oauth.ts' handles Google, GitHub and 42 in one place. Endpoints are a table keyed by provider slug, and the slug is what appears in the callback URL. That's why 42's redirect URI ends in '/api/auth/oauth/42/callback'.
 
## Frontend ('apps/web/src/')
 
### Routing in one paragraph
 
'/' is the public welcome page; '/play' is where you play. It used to be the other way round, but landing on the site should tell you what the site *is*, even if you already have an account. Play is one click away, in the nav and on the welcome page's button.
'RequireAuth' guards the signed in routes. If an account has no 'onboarded_at' yet, it's sent to '/setup' first.
 
### Where things are
 
| Where | What's there |
|---|---|
| 'App.tsx' | Every route |
| 'pages/' | One file per screen. 'Room.tsx' is the match screen and the largest. 'Welcome.tsx' is the front page at '/'. 'Setup.tsx' is the first run screen. |
| 'components/ui.tsx' | Basic UI building blocks |
| 'components/game.tsx' | The card, timer, vote buttons and scoreboard |
| 'components/Layout.tsx' | The app shell |
| 'components/DeadEnd.tsx' | Shown when a room or bracket isn't there, dealt as a card with a Myth verdict |
| 'components/ErrorBoundary.tsx' | The only class component in the codebase, because React has no hook for this |
| 'components/ConnectionLost.tsx' | The floating notice while the room socket is disconnected |
| 'components/AvatarPicker.tsx' | The sixteen stock avatars, grouped by suit |
| 'ws/' | 'useRoomChannel.ts' and 'useLobbyChannel.ts' are the two socket hooks. 'socket.ts' handles the ticket handshake. |
| 'api/client.ts' | The fetch wrapper, token refresh and error shape |
| 'auth/AuthContext.tsx' | Session state, silent refresh, proactive renewal |
| 'i18n/' | Translations (see above) |
| 'index.css' | Base styles and shared component classes |
 
**Theme files** ('theme/'):
 
| File | Job |
|---|---|
| 'suits.tsx' | The eight suits: colour, crest and corner pip for each category |
| 'cardStyle.ts' | Two on/off switches for suits and animation |
| 'avatars.tsx' | The sixteen avatar drawings: two per suit, one that isn't a person and one who is |
| 'useTheme.ts' | Theme basics: the three values, applying one, remembering it |
| 'ThemeContext.tsx' | The React state behind it, so every control changes the same value |
Design tokens (colours, fonts, radii) are in 'apps/web/tailwind.config.js'.
 
## Colour rule: green means right, and nothing else
 
Four colours have meaning during a match. They come in two pairs, and **the pairs must never be mixed up**.
 
| Pair | Tokens | Answers the question |
|---|---|---|
| Outcome | 'correct' (green), 'wrong' (red) | Were **you** right? |
| Answer | 'truth' (ink blue), 'myth' (plum) | Was the **statement** true? |
**Why is this important.** The reveal panel used to be coloured by the statement. So if you correctly spotted a myth, you got a big red panel with a small green "Correct" inside it, and the two were contradicting each other. Now the panel's frame uses the outcome pair, and the text inside uses the answer pair.

The same thinking explains other choices:
- **Vote buttons are blue and plum, not green and red.** A myth isn't a mistake, and a red button passes judgement before anyone has pressed it.
- **The answer timer goes ink -> ochre -> red** and never turns green.
Outside the match, anything that simply means *good* or *bad* (success alerts, form errors, an online dot, a positive score change) uses 'correct' and 'wrong'.
 
## The deck: suits, themes and animation
 
### Turning it on and off
 
'theme/suits.tsx' defines the eight suits. 'theme/cardStyle.ts' only decides whether they're used:
 
```ts
export const CARD_SUITS = true;
export const CARD_MOTION = true;
```
 
Set both to 'false' and you get a plain card, with nothing else changing.
To remove the feature completely: delete those two files, delete the block marked "The deck" at the bottom of 'index.css', and remove the imports in 'components/game.tsx'.
 
### How the colours work
 
Colours are stored as RGB channels inside CSS variables. 'tailwind.config.js' wraps each one in 'rgb(var(--x) / <alpha-value>)'. That's why the whole app can change theme without touching a single utility class, and why things like 'border-truth/40' still work.
Each card sets '--cat' and '--cat-wash' from its suit. Everything on the card (band, keyline, crest, pips, rules) reads those two variables instead of being given a colour directly.
The card's own colours ('--card', '--card-ink', '--card-edge') are declared **once, outside both themes**. That's deliberate: the card is paper, and only the room around it changes.
 
### The animations
 
All keyframes are in 'index.css':
 
| Animation | What it does |
|---|---|
| 'deal in' | A new card arrives |
| 'stamp' | The verdict lands |
| 'tick up' | A number counts up |
| 'urgency' | The timer is running out |
| 'press' (a class, on every button) | The button goes down instantly and comes back up over Tailwind's 150ms |
 
**Two details that cost real debugging time:**
 
- **'deal in' runs because the card remounts.** 'Room.tsx' puts a 'key' on '<CardFace>' using the card id, so every new card is a fresh component. The key sits at the call site on purpose, where it obviously remounts the whole component. A key buried inside the component would depend on how the surrounding nodes happen to be arranged.
- **'deal in' fills 'backwards', not 'both'.** An animation that fills forwards keeps applying its last frame, and an animation's opacity beats a class's opacity. That silently broke the 'opacity-70' dimming on the card during the reveal.

### Reduced motion
 
If the user has 'prefers reduced motion' on, a rule in the base layer turns off every animation and also sets 'animation delay' to zero. Without it, a staggered group still pops in one by one on a timer.
 
There are two exceptions:
- **The loading spinner keeps turning.** A frozen spinner looks like a broken arc rather than a calm one, and it's the only sign that something is happening.
- **The deal becomes 'deal quiet'**, a 140ms fade with no movement. Reduced motion means *less movement*, not *no feedback*, and a new card still needs to announce itself.
> **If the deal animation seems not to run at all, check this setting first.** On a machine with reduced motion on, every keyframe in the app collapses to nothing.
 
### Scoreboard reordering
 
This one isn't a keyframe. It's a FLIP animation in 'useRankFlip' (in 'components/game.tsx').
 
- It measures positions with 'offsetTop', so scrolling isn't mistaken for a row moving.
- It plays through the Web Animations API, so if a second reorder arrives mid slide, the row continues from where it actually is instead of jumping.

## When something goes wrong
 
Four things can fail, and each one is handled differently.
 
| What failed | What the player sees |
|---|---|
| A URL that matches no route | 'NotFound.tsx': the visitor in the space suit, adrift |
| A component crashed while rendering | 'ErrorBoundary.tsx', mounted in 'main.tsx' |
| A room or bracket that isn't there | 'DeadEnd.tsx', dealt as a card |
| The API or the whole app is unreachable | nginx answers on its own (see below) |
 
### Why 'DeadEnd' is a card
 
Every case it covers is the app telling a player that something they believed isn't true. That's exactly what the game does, so it's presented the same way,  the false belief as a statement on a card, with the verdict stamped underneath.
The verdict is always **Myth**, always plum, and never the red of a wrong answer, because nobody did anything wrong. One component covers a bad room code, a finished room, a full room, being removed by the host, and a missing bracket.
 
### When nginx has to answer
 
Nginx answers errors itself rather than showing its default page, which used to reveal the exact nginx version. It also answers differently depending on who's asking:
- **A browser** gets 'infra/nginx/50x.html'. Everything is inlined in that file, because the stylesheet and font may be among the things that are down.
- **'fetch'** gets JSON in the same shape 'api/client.ts' already understands.

### Two ways a session can end
 
These are easy to confuse:
1. **An API call gets a 401 and the silent refresh fails.** This triggers 'onSessionExpired'.
2. **The renewal timer finds the cookie is already dead.** This goes through 'restore()' instead.
Both set 'expired' on the auth context. A 'hadSession' ref separates them from "you were never signed in", which doesn't need any message. Originally only the first case was handled, even though it's the rarer of the two.
 
## Database
 
| What | Where |
|---|---|
| Schema | 'apps/api/prisma/schema.prisma', 21 models |
| Migrations | 'apps/api/prisma/migrations/', applied on every boot |
| Seed logic | 'apps/api/src/seed/index.ts' |
| Seed data (bots, achievements, demo users) | 'apps/api/src/seed/data.ts' |
| Card source | 'apps/api/prisma/seed/facts/*.json' |
 
After editing 'schema.prisma', create a migration:
 
```sh
docker compose up -d postgres
docker run --rm -v "$PWD":/w -w /w --network wkb_wkb \
  -e DATABASE_URL="$(sed -n 's/^DATABASE_URL=//p' .env)" \
  node:22-bookworm-slim \
  npx prisma migrate dev --schema apps/api/prisma/schema.prisma --name your_change
```
 
## Infrastructure
 
**Only nginx publishes a port.** Every other service talks over the internal Docker network.
 
| What | Where |
|---|---|
| Service definitions | 'docker-compose.yml' |
| API image | 'apps/api/Dockerfile' |
| Web image | 'apps/web/Dockerfile' |
| Edge proxy and TLS | 'infra/nginx/nginx.conf' |
| Static host for the SPA | 'apps/web/nginx.conf' |
| Certificate generation | 'tools/scripts/gen-certs.sh' |
| Secret generation | 'tools/scripts/gen-env.sh' |
| Running openssl where it won't load as installed | 'tools/scripts/openssl.sh' |
| API startup sequence | 'apps/api/docker-entrypoint.sh' |
 
## Tests
 
| Command | Script | What it checks |
|---|---|---|
| 'make e2e' | 'tools/scripts/e2e.mjs' | 74 assertions, playing a real match through the real API |
| 'make console-check | 'tools/scripts/console-check.mjs' | 17 screens in headless Chrome. Fails on *any* console output. |
| 'make check' | 'tools/cardgen/src/report.ts' | Card set balance, coverage, the negation tell |
| 'make typecheck' | | Every workspace with 'tsc --noEmit' |
| 'make test' | | Everything above except 'check' |
 
'e2e.mjs' has no dependencies. It uses Node 22's built in WebSocket, so it runs against a fresh clone that has never had 'npm install'.
 
## How the pieces talk to each other
 
```
  browser                          server
  ───────                          ──────
  POST /api/auth/login ─────────▶  routes/auth.ts
       access token in memory  ◀─  + refresh cookie
 
  POST /api/ws/ticket ──────────▶  ws/ticket.ts
       single-use ticket       ◀─
 
  wss://…/ws/room?ticket=… ────▶  ws/room.ts
       room:join              ─▶  game/engine.ts  ──▶ Postgres
       room:state             ◀─
       card:served            ◀─  (per connection, in the player's language)
       card:vote              ─▶  engine.handleVote → validateReaction → applyVote
       vote:ack               ◀─
       card:revealed          ◀─  (per connection: the correction is localised)
       match:ended            ◀─  services/rewards.ts, services/tournament.ts
```
 
In words: log in to get a token, swap it for a one time ticket, open the socket with that ticket, then play.

 
## Things that will surprise you
 
**The server owns the clock.** The browser never decides that time is up. If you're chasing a timing bug, the answer is in 'engine.ts', not in the React code.
**Green and red mean one thing only:** whether the player was right. The two answers are 'truth' (blue) and 'myth' (plum). If you're reaching for 'text correct' to colour something that isn't an outcome, stop.
**The deck is drawn up front.** All of a match's cards go into 'match_cards' when it starts. That's why reconnecting is a simple lookup, not a replay.
**Player history is tracked by fact, not by card.** 'user_seen_facts' uses 'fact_id', so once a player has seen one wording of a fact, they'll never get the other.
**The socket carries a language.** It's set from the connection ticket when the socket opens, and changed by the 'locale:set' message. Cards, and the correction shown at the reveal, are rendered on the server in that language.
**The reveal always sends the true wording.** Every fact has a true and a false wording, and the reveal sends the true one as 'correction'. That's how a player learns what's actually the case after being shown something false. 'hydrate' in 'engine.ts' loads both wordings of every card in the deck for exactly this reason.
**Scores never go below zero.** The penalty is real, but 'applyDelta' floors the total at zero. The stored 'points_awarded' is the amount actually applied.
**The host is stored in the database, not in memory.** It's in 'rooms.host_user_id', because every host only check reads it from there.
- When the host's last socket disconnects, 'handleDeparture' passes the role to the human who's been in the room longest.
- Bots can never become host: candidates come from the open sockets, and bots don't have one.
- The same method ends the match when no sockets are left, which is exactly the case where only bots remain.
**Avatars share one column.** The choice lives in 'users.avatar_url'. A stock avatar is stored as 'preset:<id>', and an uploaded one is a file path. Both answer the same question ("how is this person drawn?"), so all eleven screens that show an avatar read one field. 'presetFromStored' returns 'null' for anything not on the shipped list, so a stale or tampered value never reaches the renderer.
**New accounts are sent to '/setup' from wherever they were heading.** The check lives in 'RequireAuth', not on the login screen, because an account can arrive signed in several ways: the login form, an OAuth callback, or a silent refresh in a returning tab. Only one of those passes through a screen that could redirect it. The demo accounts are seeded with 'onboarded_at' already set, so they skip it. 
**The seed runs on every boot.** It's safe to repeat: it matches facts on 'source_ref' and everything else on its natural key.
 
