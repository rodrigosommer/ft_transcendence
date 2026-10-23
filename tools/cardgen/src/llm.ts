/* The AI steps of the pipeline: 
generate the wordings, verify each card blind (without its label), and translate then verify again.
The check is blind because negation and translation are where true/false flips happen, and any disagreement goes to manual review, never the card set.*/
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-5';
const BATCH_SIZE = 20;

export interface GeneratedCard {
  id: string;
  affirmative: string;
  negated: string;
}

export interface VerificationResult {
  id: string;
  believesTrue: boolean;
  confidence: 'high' | 'medium' | 'low';
}

function apiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) 
  {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. The AI steps need it; the committed card set does not.',
    );
  }
  return key;
}

async function complete(system: string, user: string, maxTokens = 4096): Promise<string> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature: 0,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!response.ok) 
  {
    throw new Error(`Anthropic API ${response.status}: ${await response.text()}`);
  }
  const payload = (await response.json()) as { content: { type: string; text?: string }[] };
  return payload.content.map((block) => block.text ?? '').join('');
}

function extractJson<T>(text: string): T {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1) 
    throw new Error(`No JSON array in model output: ${text.slice(0, 200)}`);
  return JSON.parse(text.slice(start, end + 1)) as T;
}

const GENERATE_SYSTEM = `You rewrite trivia knowledge into pairs of statements for a myth-or-truth card game.

For each item you receive an id and a piece of knowledge. Produce exactly two statements:
- "affirmative": a natural, self-contained sentence that is TRUE.
- "negated": a natural, self-contained sentence about the same knowledge that is FALSE.

Rules that matter:
- Build the false statement by SUBSTITUTING the key value with a plausible wrong one, not by inserting "not". If every false card contained the word "not", players would win by scanning for it rather than by knowing anything.
- Both sentences must read as ordinary statements of fact. Neither may hint at which is which.
- Keep each under 22 words. No questions, no "which of the following", no references to options.
- Use no proper names of private individuals. Public figures in a historical or professional role are fine.
- If the knowledge is too vague or unstable to state as a durable fact, set both fields to the empty string.

Reply with a JSON array only: [{"id": "...", "affirmative": "...", "negated": "..."}]`;

export async function generateCards(
  items: { id: string; knowledge: string; distractor: string | null }[],
): Promise<GeneratedCard[]> {
  const out: GeneratedCard[] = [];
  for (let index = 0; index < items.length; index += BATCH_SIZE) 
  {
    const batch = items.slice(index, index + BATCH_SIZE);
    const prompt = batch
      .map(
        (item) =>
          `id: ${item.id}\nknowledge: ${item.knowledge}` +
          (item.distractor ? `\nplausible wrong value: ${item.distractor}` : ''),
      )
      .join('\n\n');
    const raw = await complete(GENERATE_SYSTEM, prompt);
    const parsed = extractJson<GeneratedCard[]>(raw);
    out.push(...parsed.filter((card) => card.affirmative && card.negated));
  }
  return out;
}

const VERIFY_SYSTEM = `You are fact-checking statements for a trivia game.

For each statement, decide whether it is true or false on its own terms, using only well-established general knowledge. You are NOT told what the game believes the answer to be. Judge independently.

Reply with a JSON array only: [{"id": "...", "believesTrue": true|false, "confidence": "high"|"medium"|"low"}]`;

export async function verifyCards(
  items: { id: string; statement: string }[],
): Promise<VerificationResult[]> {
  const out: VerificationResult[] = [];
  for (let index = 0; index < items.length; index += BATCH_SIZE) 
  {
    const batch = items.slice(index, index + BATCH_SIZE);
    const prompt = batch.map((item) => `id: ${item.id}\nstatement: ${item.statement}`).join('\n\n');
    const raw = await complete(VERIFY_SYSTEM, prompt);
    out.push(...extractJson<VerificationResult[]>(raw));
  }
  return out;
}

const TRANSLATE_SYSTEM = (locale: string) => `You translate trivia statements into ${locale}.

Rules:
- Preserve the truth value exactly. A translation that flips the meaning is the worst possible error.
- Keep the register plain and the sentence natural in the target language; do not translate word for word.
- Keep proper nouns in their usual form in the target language.
- A term of art keeps the term the field actually uses in the target language,
  which is often the English word left alone. Never fall back to the everyday
  sense of the word: a password "salt" is not table salt, a "cookie" is not a
  biscuit, a "bug" is not an insect, a "key" is not a door key.
- Use one rendering of a term throughout; a fact and its false twin must not
  word the same concept two different ways.
- Keep it under 25 words.

Reply with a JSON array only: [{"id": "...", "text": "..."}]`;

export async function translateCards(
  items: { id: string; text: string }[],
  locale: string,
): Promise<{ id: string; text: string }[]> {
  const out: { id: string; text: string }[] = [];
  for (let index = 0; index < items.length; index += BATCH_SIZE) 
  {
    const batch = items.slice(index, index + BATCH_SIZE);
    const prompt = batch.map((item) => `id: ${item.id}\ntext: ${item.text}`).join('\n\n');
    const raw = await complete(TRANSLATE_SYSTEM(locale), prompt);
    out.push(...extractJson<{ id: string; text: string }[]>(raw));
  }
  return out;
}
