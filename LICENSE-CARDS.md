# Card set licence

## In short

The cards in *Who knows best?* are free to reuse, adapt and share, as long as you **give credit** and **share your version under the same licence**.
That licence is **Creative Commons Attribution ShareAlike 4.0 International (CC BY-SA 4.0)**:
<https://creativecommons.org/licenses/by-sa/4.0/>

## What this covers

This licence applies to the **card set**, which means that every file under 'apps/api/prisma/seed/facts/', and every raw dump under 'tools/cardgen/data/'.

## Why share alike?

Many of our cards are built from the [Open Trivia Database](https://opentdb.com/) (OpenTDB), using the pipeline in 'tools/cardgen/'. OpenTDB is published under CC BY-SA 4.0, and share alike is "contagious": anything derived from it has to carry the same licence.
Some cards weren't derived from OpenTDB at all; we wrote them by hand. We could have licensed those differently, but then the set would be under two licences, and every reuser would have to work out which card was which. That's easy to get wrong.
So we made it simple: **the whole set is CC BY-SA 4.0**, wherever each card came from.

## Credits

- **Open Trivia Database**, <https://opentdb.com/>, CC BY-SA 4.0. The source of the questions our pipeline turns into facts.
- **The Who knows best? card set**, curated and translated for this project, CC BY-SA 4.0.

### Where players see these credits

1. A link in the footer of every page of the app.
2. A dedicated section of the Terms of Service, *Content licence and attribution*, in all three supported languages.
3. This file.

## Reusing the cards

You're welcome to. If you share the cards, or anything you build from them, you need to:

- **Credit** both sources listed above.
- **Link** to the licence.
- **Say what you changed**, if you changed anything.
- **Use the same licence** (CC BY-SA 4.0) for your version.
- **Add no extra restrictions**, legal or technical, that would stop others doing the same.

## Tracing where a card came from

Every fact in the database has a `source_ref` and a `license` column, so you can trace any card back to its origin:

| 'source_ref' looks like | Meaning |
|---|---|
| 'curated:<ref>' | Written and checked by hand for this project |
| 'opentdb:<sha256>' | Derived from the OpenTDB question with that content hash. The original is stored word for word in 'tools/cardgen/data/raw/questions.json'. |