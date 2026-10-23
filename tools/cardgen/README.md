# cardgen: how the card set gets made

'cardgen' turns trivia questions from [OPENTDB](https://opentdb.com) into the true/false cards the game uses.
This is a maintenance tool, not part of the game. You run it in your own machine, commit what it produces, and the game simply reads those committed files.
The running game never talks to OpenTDB. 

That separation is deliberate, the project must run with a single command, on a fresh machine, with no network, and no API key; so the card set has to already 
 be in the repo by the time anyone types 'make'.

## Quick Start

You don't need Node installed because everything runs inside the pinned Node image.
```sh
make cardgen ARGS="check"
```
Swap 'check' for any command in the table below.

```
OpenTDB -> collect(network) -> convert(offline) -> forms(API key) -> verify(API key) -> translate(API key) -> check(offline) -> export
```

| Command | Step | Needs | What it does |
|---|---|---|---|
| 'counts' | 1 | 🌐 network | Asks OpenTDB exactly how many questions it has, overall and per category. Nothing is planned on a guess. |
| 'collect' | 2–3 | 🌐 network | Downloads the whole pool, a session token stops the API from repeating a question within one run. Saves the raw JSON to 'data/raw/questions.json', keyed by each question's SHA-256. |
| 'convert' | 4–5 | ✅ offline | Turns each question into a single fact and applies the filters. |
| 'forms' | 6 | 🔑 'ANTHROPIC_API_KEY' | Writes a true wording and a false wording for each fact, twenty facts per call. |
| 'verify' | 7 | 🔑 'ANTHROPIC_API_KEY' | Blind check; a model reads each wording without its stored answer and says whether it's true. |
| 'translate <locale>' | 8 | 🔑 'ANTHROPIC_API_KEY' | Translates the cards, then blind checks the translations the same way. |
| 'sample [n]' | 9 | ✅ offline | Pulls a random sample for a human to read through. |
| 'check' | 10 | ✅ offline | Checks category balance, coverage, and whether false cards give themselves away. |
| 'export' | 11 | ✅ offline | Tells you where the shipped card set are |


## Why it works the way it does

### One question becomes one fact, instead of four

A multiple choice question has one right answer and three wrong ones, it's tempting to turn that into four cards, but we don't do that.
All four options test the same piece of knowledge, for example, if you know the capital of Australia, you'll get every variant right without thinking. 
 Four cards would inflate the count and make the deck feel repetitive, which is the opposite of what a card set is for.
 
### False cards swap a value instead of adding "not"
 
Each fact produces two cards: one true, one false.
The lazy way to make a false card is to insert "not". The problem is that players learn fast, so if every false card contains "not", you can win by scanning for that word without ever reading the statement.
So instead, the false card replaces the key detail with a believable wrong one:
 > The Nile flows **northward**. → The Nile flows **southward**.
 
'cardgen check' keeps us honest by counting negation words on both sides. On the shipped set, negation words are actually about 1.67 percentage points *more* common in true cards than in false ones, so "not" gives nothing away.
 
### Verification is blind, and humans settle disagreements
 
The checking model never sees the stored answer, it has to decide for itself.
This matters because negation is where true and false most often get flipped by mistake, and translation is a close second. When the model disagrees with the stored answer, nothing is fixed automatically, and the card goes into 'work/review-queue.json' and waits for a person.
A card with the wrong answer is the worst bug this tool can ship, especially during an evaluation, so we'd rather be slow than wrong.
 
### Facts that might go stale get flagged
 
Some statements quietly stop being true. Anything containing words like "currently", "the most recent", "record", "the only", a superlative, or a recent year is flagged. Superlatives are the tricky ones, ie, "The largest ocean" will be true for a very long time; "the largest company" might not survive the year. So superlatives are flagged for a human to look at, never thrown out automatically.
 
### Eight categories instead of OpenTDB's 24
 
OpenTDB has narrow categories like board games, vehicles and anime, and they never have enough facts to keep a category room going, and a room that runs dry after two matches is worse than no room at all.
'convert.ts' folds the 24 OpenTDB categories into 8 broader ones.
 
## Why the raw download is committed
 
'data/raw/questions.json' is where everything downstream starts. Keeping it in the repo means:
- you can rerun and recheck every later step without downloading again;
- if OpenTDB is down, the offline steps and the evaluation still work.

## Licence
 The card set is licensed **CC BY-SA 4.0**, inherited from OpenTDB. See 'LICENSE-CARDS.md' at the repository root.
