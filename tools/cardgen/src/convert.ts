import type { RawQuestion } from './opentdb.js';
import { questionId } from './opentdb.js';
import { checkStability, isConvertible, isSensitive } from './filters.js';

//Maps OpenTDB's 24 narrow categories onto the eight the game uses
export const MACRO_CATEGORIES: Record<string, string> = {
  'General Knowledge': 'culture',
  'Entertainment: Books': 'arts',
  'Entertainment: Film': 'arts',
  'Entertainment: Music': 'arts',
  'Entertainment: Musicals & Theatres': 'arts',
  'Entertainment: Television': 'arts',
  'Entertainment: Video Games': 'technology',
  'Entertainment: Board Games': 'sports',
  'Entertainment: Comics': 'arts',
  'Entertainment: Japanese Anime & Manga': 'arts',
  'Entertainment: Cartoon & Animations': 'arts',
  'Science & Nature': 'science',
  'Science: Computers': 'technology',
  'Science: Mathematics': 'science',
  'Science: Gadgets': 'technology',
  Mythology: 'culture',
  Sports: 'sports',
  Geography: 'geography',
  History: 'history',
  Politics: 'history',
  Art: 'arts',
  Celebrities: 'culture',
  Animals: 'science',
  Vehicles: 'technology',
};

export interface DraftFact {
  id: string;
  categorySlug: string;
  difficulty: 'easy' | 'medium' | 'hard';
  proposition: string;
  distractor: string | null;
  sourceRef: string;
  origin: 'boolean' | 'multiple';
  flags: string[];
}

export interface ConversionReport {
  seen: number;
  facts: DraftFact[];
  skipped: { reason: string; count: number }[];
}

export function convert(questions: RawQuestion[]): ConversionReport {
  const facts: DraftFact[] = [];
  const skipped = new Map<string, number>();
  const seenIds = new Set<string>();
  const skip = (reason: string) => skipped.set(reason, (skipped.get(reason) ?? 0) + 1);
  for (const question of questions) 
  {
    const id = questionId(question);
    if (seenIds.has(id)) 
    {
      skip('duplicate');
      continue;
    }
    seenIds.add(id);
    const categorySlug = MACRO_CATEGORIES[question.category];
    if (!categorySlug) 
    {
      skip('category not mapped');
      continue;
    }
    if (isSensitive(question.question) || isSensitive(question.correct_answer)) 
    {
      skip('sensitive wording');
      continue;
    }
    const flags: string[] = [];
    const stability = checkStability(`${question.question} ${question.correct_answer}`);
    if (!stability.stable) 
      flags.push(...stability.reasons);
    if (question.type === 'boolean') 
    {
      const isTrue = question.correct_answer.toLowerCase() === 'true';
      facts.push({
        id,
        categorySlug,
        difficulty: question.difficulty,
        proposition: isTrue ? question.question : `NOT: ${question.question}`,
        distractor: null,
        sourceRef: `opentdb:${id}`,
        origin: 'boolean',
        flags,
      });
      continue;
    }
    if (!isConvertible(question.question)) 
    {
      skip('question depends on its options');
      continue;
    }
    const distractor = question.incorrect_answers[0] ?? null;
    facts.push({
      id,
      categorySlug,
      difficulty: question.difficulty,
      proposition: `${question.question} -> ${question.correct_answer}`,
      distractor,
      sourceRef: `opentdb:${id}`,
      origin: 'multiple',
      flags,
    });
  }
  return {
    seen: questions.length,
    facts,
    skipped: [...skipped.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  };
}
