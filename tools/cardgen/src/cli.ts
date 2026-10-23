import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  categories as fetchCategories,
  fetchQuestions,
  globalCounts,
  newSessionToken,
  questionId,
  type RawQuestion,
} from './opentdb.js';
import { convert } from './convert.js';
import { generateCards, translateCards, verifyCards } from './llm.js';
import { analyse, negationTell, sample } from './report.js';

/* This is a maintenance tool, not part of the application; it runs on a developer machine, its output is committed to the repository, and the
 running game never calls OpenTDB. That is what keeps 'make' working offline.
counts     1  how many questions actually exist
collect    2&3  pull them all, once, through a session token
convert    4  questions -> facts (one fact per question)
forms      6  write both wordings of each fact
verify     7  blind check: read a card without its label
translate  8  three languages, each verified the same way
sample     9  pull a random sample for manual review
check     10  balance, coverage and the negation tell
export    11  emit the seed files */

const ROOT = path.resolve(process.cwd());
const RAW_DIR = path.join(ROOT, 'data', 'raw');
const WORK_DIR = path.join(ROOT, 'work');
const SEED_DIR = path.resolve(ROOT, '..', '..', 'apps', 'api', 'prisma', 'seed', 'facts');

async function ensureDirs(): Promise<void> {
  await mkdir(RAW_DIR, { recursive: true });
  await mkdir(WORK_DIR, { recursive: true });
}

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

//1. counts
async function commandCounts(): Promise<void> {
  log('Querying OpenTDB counts (never plan on estimates)...\n');
  const [counts, categories] = await Promise.all([globalCounts(), fetchCategories()]);
  log(`Total questions:    ${counts.overall.total_num_of_questions}`);
  log(`Verified:           ${counts.overall.total_num_of_verified_questions}`);
  log(`Pending:            ${counts.overall.total_num_of_pending_questions}`);
  log(`Rejected:           ${counts.overall.total_num_of_rejected_questions}\n`);
  log('Verified per category:');
  const rows = categories.trivia_categories
    .map((category) => ({
      name: category.name,
      verified: counts.categories[String(category.id)]?.total_num_of_verified_questions ?? 0,
    }))
    .sort((a, b) => b.verified - a.verified);
  for (const row of rows) 
    log(`  ${row.name.padEnd(38)} ${String(row.verified).padStart(5)}`);
  const total = rows.reduce((sum, row) => sum + row.verified, 0);
  log(`\nReachable pool: ${total} verified questions.`);
  log(`At 50 per call and one call per 5s, a full collection takes about ${Math.ceil(total / 50)} calls (~${Math.ceil((total / 50) * 5.2 / 60)} minutes).`);
  await ensureDirs();
  await writeFile(
    path.join(RAW_DIR, 'counts.json'),
    `${JSON.stringify({ fetchedAt: new Date().toISOString(), counts, categories }, null, 2)}\n`,
  );
  log(`\nWritten to ${path.relative(ROOT, path.join(RAW_DIR, 'counts.json'))}`);
}

//2 & 3. collect
async function commandCollect(): Promise<void> {
  await ensureDirs();
  log('Collecting the full question set. This is rate limited to one call per 5 seconds.\n');
  const token = await newSessionToken();
  log(`Session token acquired. The API will not repeat a question within this run.\n`);
  const byId = new Map<string, RawQuestion>();
  let emptyResponses = 0;
  for (let call = 1; call <= 200; call += 1) 
  {
    const result = await fetchQuestions({ token, amount: 50 });
    // 4 = token exhausted, ie every question has already been returned
    if (result.responseCode === 4) 
    {
      log(`\nToken exhausted after ${call - 1} calls. The pool is fully collected.`);
      break;
    }
    if (result.questions.length === 0) 
    {
      emptyResponses += 1;
      if (emptyResponses >= 3) 
        break;
      continue;
    }
    for (const question of result.questions) 
      byId.set(questionId(question), question);
    process.stdout.write(`\r  call ${String(call).padStart(3)} · ${byId.size} unique questions`);
  }
  const questions = [...byId.entries()].map(([id, question]) => ({ id, ...question }));
  const target = path.join(RAW_DIR, 'questions.json');
  await writeFile(
    target,
    `${JSON.stringify({ collectedAt: new Date().toISOString(), count: questions.length, questions }, null, 2)}\n`,
  );
  const booleans = questions.filter((q) => q.type === 'boolean').length;
  log(`\n\nCollected ${questions.length} unique questions (${booleans} boolean, ${questions.length - booleans} multiple choice).`);
  log(`Raw dump written to ${path.relative(ROOT, target)}. Commit it: everything downstream comes from this file.`);
}

// 4/5. convert

interface RawFile {
  questions: (RawQuestion & { id: string })[];
}

async function loadRaw(): Promise<RawFile> {
  const target = path.join(RAW_DIR, 'questions.json');
  try {
    return JSON.parse(await readFile(target, 'utf8')) as RawFile;
  } catch {
    throw new Error(`No raw dump at ${target}. Run "cardgen collect" first.`);
  }
}

async function commandConvert(): Promise<void> {
  await ensureDirs();
  const raw = await loadRaw();
  const report = convert(raw.questions);
  log(`Read ${report.seen} questions.`);
  log(`Produced ${report.facts.length} facts (one per question, never one per wrong option).\n`);
  if (report.skipped.length > 0) 
  {
    log('Skipped:');
    for (const row of report.skipped) 
      log(`  ${row.reason.padEnd(34)} ${row.count}`);
  }
  const flagged = report.facts.filter((fact) => fact.flags.length > 0);
  log(`\nFlagged for manual review by the temporal filter: ${flagged.length}`);
  const reasons = new Map<string, number>();
  for (const fact of flagged) 
  {
    for (const flag of fact.flags) 
      reasons.set(flag, (reasons.get(flag) ?? 0) + 1);
  }
  for (const [reason, count] of [...reasons].sort((a, b) => b[1] - a[1])) 
  {
    log(`  ${reason.padEnd(34)} ${count}`);
  }
  const byCategory = new Map<string, number>();
  for (const fact of report.facts) 
  {
    byCategory.set(fact.categorySlug, (byCategory.get(fact.categorySlug) ?? 0) + 1);
  }
  log('\nFacts per macro-category:');
  for (const [slug, count] of [...byCategory].sort((a, b) => b[1] - a[1])) 
  {
    log(`  ${slug.padEnd(34)} ${count}`);
  }
  const target = path.join(WORK_DIR, 'facts.json');
  await writeFile(target, `${JSON.stringify(report.facts, null, 2)}\n`);
  log(`\nDraft facts written to ${path.relative(ROOT, target)}`);
}

//6. forms
async function loadDraft<T>(name: string): Promise<T> {
  const target = path.join(WORK_DIR, name);
  try {
    return JSON.parse(await readFile(target, 'utf8')) as T;
  } catch {
    throw new Error(`Missing ${target}. Run the previous pipeline step first.`);
  }
}

async function commandForms(limit: number): Promise<void> {
  const facts = await loadDraft<{ id: string; proposition: string; distractor: string | null }[]>(
    'facts.json',
  );
  const slice = limit > 0 ? facts.slice(0, limit) : facts;
  log(`Generating both wordings for ${slice.length} facts, 20 per call...`);
  const cards = await generateCards(
    slice.map((fact) => ({ id: fact.id, knowledge: fact.proposition, distractor: fact.distractor })),
  );
  const target = path.join(WORK_DIR, 'cards.json');
  await writeFile(target, `${JSON.stringify(cards, null, 2)}\n`);
  log(`Wrote ${cards.length} card pairs to ${path.relative(ROOT, target)}`);
}

// 7. verify (blind)
async function commandVerify(): Promise<void> {
  const cards = await loadDraft<{ id: string; affirmative: string; negated: string }[]>('cards.json');
  const statements = cards.flatMap((card) => [
    { id: `${card.id}:t`, statement: card.affirmative, expected: true },
    { id: `${card.id}:f`, statement: card.negated, expected: false },
  ]);
  log(`Blind-verifying ${statements.length} wordings (the model is not told the stored label)...`);
  const results = await verifyCards(statements.map(({ id, statement }) => ({ id, statement })));
  const byId = new Map(results.map((result) => [result.id, result]));
  const disagreements = statements.filter((row) => {
    const verdict = byId.get(row.id);
    return verdict && verdict.believesTrue !== row.expected;
  });
  const accepted = cards.filter(
    (card) => !disagreements.some((row) => row.id.startsWith(`${card.id}:`)),
  );
  await writeFile(
    path.join(WORK_DIR, 'verified.json'),
    `${JSON.stringify(accepted, null, 2)}\n`,
  );
  await writeFile(
    path.join(WORK_DIR, 'review-queue.json'),
    `${JSON.stringify(disagreements, null, 2)}\n`,
  );
  const rate = statements.length === 0 ? 0 : (disagreements.length / statements.length) * 100;
  log(`\nDisagreements: ${disagreements.length} of ${statements.length} (${rate.toFixed(2)}%)`);
  log(`Accepted: ${accepted.length} card pairs -> work/verified.json`);
  log(`Held for manual review: ${disagreements.length} -> work/review-queue.json`);
  log('\nA disagreement is never auto-resolved. A card whose stored answer is');
  log('wrong is the worst outcome at evaluation, so it waits for a human.');
}

//8. translate

async function commandTranslate(locale: string): Promise<void> {
  const cards = await loadDraft<{ id: string; affirmative: string; negated: string }[]>(
    'verified.json',
  );
  log(`Translating ${cards.length * 2} wordings into ${locale}...`);
  const affirmatives = await translateCards(
    cards.map((card) => ({ id: `${card.id}:t`, text: card.affirmative })),
    locale,
  );
  const negations = await translateCards(
    cards.map((card) => ({ id: `${card.id}:f`, text: card.negated })),
    locale,
  );
  const translated = [...affirmatives, ...negations];
  log('Blind-verifying the translations...');
  const results = await verifyCards(translated.map(({ id, text }) => ({ id, statement: text })));
  const byId = new Map(results.map((result) => [result.id, result]));
  const kept = translated.filter((row) => {
    const verdict = byId.get(row.id);
    const expected = row.id.endsWith(':t');
    return verdict ? verdict.believesTrue === expected : false;
  });
  const target = path.join(WORK_DIR, `translations.${locale}.json`);
  await writeFile(target, `${JSON.stringify(kept, null, 2)}\n`);
  log(`Kept ${kept.length} of ${translated.length} translations -> ${path.relative(ROOT, target)}`);
}

// 9. sample
async function commandSample(size: number): Promise<void> {
  const rows = await sample(SEED_DIR, size);
  log(`Manual review sample of ${rows.length} cards.`);
  log('Read each statement, decide true or false yourself, then compare with the label.\n');
  rows.forEach((row, index) => {
    log(`${String(index + 1).padStart(3)}. [${row.locale}] ${row.text}`);
    log(`     stored label: ${row.label}   (ref ${row.ref})\n`);
  });
  log('Record the residual error rate you measure in the README.');
  log('The threshold to proceed is below 2%.');
}

//10. check

async function commandCheck(): Promise<void> {
  const balance = await analyse(SEED_DIR);
  const tell = await negationTell(SEED_DIR);
  log('Card set balance\n');
  log(`Categories: ${balance.categories}`);
  log(`Facts:      ${balance.facts}`);
  log(`Cards:      ${balance.cards} (${balance.cards / 2} true, ${balance.cards / 2} false by construction)\n`);
  log('Per category:');
  log(`  ${'slug'.padEnd(14)}${'easy'.padStart(6)}${'medium'.padStart(8)}${'hard'.padStart(6)}${'total'.padStart(7)}`);
  for (const row of balance.byCategory) 
  {
    log(
      `  ${row.slug.padEnd(14)}${String(row.easy).padStart(6)}${String(row.medium).padStart(8)}${String(row.hard).padStart(6)}${String(row.total).padStart(7)}`,
    );
  }
  log('\nLocalised wordings:');
  for (const [locale, count] of Object.entries(balance.byLocale)) 
  {
    const coverage = ((count / balance.cards) * 100).toFixed(1);
    log(`  ${locale.padEnd(8)} ${String(count).padStart(5)}  (${coverage}% of cards)`);
  }
  log('\nNegation tell:');
  log(`  true wordings containing a negation:  ${tell.trueWithNegation}`);
  log(`  false wordings containing a negation: ${tell.falseWithNegation}`);
  log(`  skew: ${tell.skewPercentagePoints} percentage points`);
  log('  A large positive skew would let players win by scanning for "not"');
  log('  instead of knowing the answer. False wordings substitute the key');
  log('  value rather than negating it, which is what keeps this near zero.');
  if (balance.problems.length === 0) 
  {
    log('\nNo structural problems found.');
    return;
  }
  log(`\n${balance.problems.length} problem(s):`);
  for (const problem of balance.problems.slice(0, 40)) 
  {
    log(`  ${problem.ref}: ${problem.issue}`);
  }
  process.exitCode = 1;
}

//11. export

async function commandExport(): Promise<void> {
  log('The committed card set already lives in:');
  log(`  ${path.relative(ROOT, SEED_DIR)}`);
  log('\nThe seed reads those files directly, so there is no separate dump to');
  log('build: the source of truth and the shipped artefact are the same files.');
  log('\nTo fold a freshly generated OpenTDB batch into them, merge');
  log('work/verified.json and work/translations.*.json into the per-category');
  log('files, then re-run "cardgen check" before committing.');
}

//entry point

const USAGE = `cardgen, the offline card-set pipeline

  counts                 query OpenTDB for exact counts        (network)
  collect                pull the full question set            (network, ~10 min)
  convert                questions -> facts, with filters      (offline)
  forms [limit]          write both wordings of each fact      (needs ANTHROPIC_API_KEY)
  verify                 blind truth check of every wording    (needs ANTHROPIC_API_KEY)
  translate <locale>     translate, then blind-verify again    (needs ANTHROPIC_API_KEY)
  sample [n]             random sample for manual review       (offline)
  check                  balance, coverage, negation tell      (offline)
  export                 where the shipped card set lives      (offline)
`;

async function main(): Promise<void> {
  const [command, argument] = process.argv.slice(2);
  switch (command) {
    case 'counts':
      return commandCounts();
    case 'collect':
      return commandCollect();
    case 'convert':
      return commandConvert();
    case 'forms':
      return commandForms(Number(argument ?? 0));
    case 'verify':
      return commandVerify();
    case 'translate':
      if (!argument) throw new Error('translate needs a locale, e.g. "translate pt-BR"');
      return commandTranslate(argument);
    case 'sample':
      return commandSample(Number(argument ?? 100));
    case 'check':
      return commandCheck();
    case 'export':
      return commandExport();
    default:
      process.stdout.write(USAGE);
      return;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
