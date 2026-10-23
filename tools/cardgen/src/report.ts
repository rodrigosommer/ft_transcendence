import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomInt } from 'node:crypto';

/* Validation of the committed card set which runs entirely offline against prisma/seed/facts, 
 so it can be part of an ordinary check rather than something that needs an API key and a network.*/

export interface FactEntry {
  ref: string;
  difficulty: 'easy' | 'medium' | 'hard';
  [locale: string]: unknown;
}

export interface CardFile {
  category: { slug: string; name: string };
  license: string;
  facts: FactEntry[];
}

export interface Problem {
  ref: string;
  issue: string;
}

export interface Balance {
  categories: number;
  facts: number;
  cards: number;
  byCategory: { slug: string; easy: number; medium: number; hard: number; total: number }[];
  byLocale: Record<string, number>;
  problems: Problem[];
}

const LOCALES = ['en', 'pt-BR', 'fr'] as const;

function pair(value: unknown): { t: string; f: string } | null {
  if (typeof value !== 'object' || value === null) 
    return null;
  const candidate = value as { t?: unknown; f?: unknown };
  if (typeof candidate.t !== 'string' || typeof candidate.f !== 'string') 
    return null;
  return { t: candidate.t, f: candidate.f };
}

export async function analyse(dir: string): Promise<Balance> {
  const files = (await readdir(dir)).filter((name) => name.endsWith('.json')).sort();
  const byCategory: Balance['byCategory'] = [];
  const byLocale: Record<string, number> = {};
  const problems: Problem[] = [];
  const seenRefs = new Set<string>();
  let facts = 0;
  for (const file of files) 
{
    const parsed = JSON.parse(await readFile(path.join(dir, file), 'utf8')) as CardFile;
    const counts = { easy: 0, medium: 0, hard: 0 };
    for (const entry of parsed.facts) 
    {
      facts += 1;
      counts[entry.difficulty] += 1;
      if (seenRefs.has(entry.ref)) 
        problems.push({ ref: entry.ref, issue: 'duplicate reference' });
      seenRefs.add(entry.ref);
      for (const locale of LOCALES) 
      {
        const wording = pair(entry[locale]);
        if (!wording) 
        {
          problems.push({ ref: entry.ref, issue: `missing ${locale} wording` });
          continue;
        }
        byLocale[locale] = (byLocale[locale] ?? 0) + 2;
        if (wording.t.trim() === wording.f.trim()) 
        {
          problems.push({ ref: entry.ref, issue: `${locale}: both wordings are identical` });
        }
        for (const [form, text] of [['true', wording.t], ['false', wording.f]] as const) 
        {
          if (text.trim().length < 10) 
          {
            problems.push({ ref: entry.ref, issue: `${locale} ${form} wording is too short` });
          }
          if (/\?\s*$/.test(text)) 
          {
            problems.push({ ref: entry.ref, issue: `${locale} ${form} wording is a question` });
          }
        }
      }
    }
    byCategory.push({ slug: parsed.category.slug, ...counts, total: parsed.facts.length });
  }

  return {
    categories: files.length,
    facts,
    cards: facts * 2,
    byCategory,
    byLocale,
    problems,
  };
}

/* 'negationTell()' tells us how much more often negation words appear in false cards than in true ones. Near zero means players can't win by spotting them*/
export async function negationTell(dir: string): Promise<{
  trueWithNegation: number;
  falseWithNegation: number;
  facts: number;
  skewPercentagePoints: number;
}> {
  const files = (await readdir(dir)).filter((name) => name.endsWith('.json'));
  const NEGATION = /\b(not|never|no|cannot|n't|nunca|não|jamais|aucun|ne\s)\b/i;
  let trueWithNegation = 0;
  let falseWithNegation = 0;
  let facts = 0;
  for (const file of files) 
  {
    const parsed = JSON.parse(await readFile(path.join(dir, file), 'utf8')) as CardFile;
    for (const entry of parsed.facts) 
    {
      const wording = pair(entry.en);
      if (!wording) 
        continue;
      facts += 1;
      if (NEGATION.test(wording.t)) 
        trueWithNegation += 1;
      if (NEGATION.test(wording.f)) 
        falseWithNegation += 1;
    }
  }
  const skew = facts === 0 ? 0 : ((falseWithNegation - trueWithNegation) / facts) * 100;
  return { trueWithNegation, falseWithNegation, facts, skewPercentagePoints: Number(skew.toFixed(2)) };
}

export async function sample(dir: string, size: number): Promise<{ ref: string; locale: string; text: string; label: string }[]> {
  const files = (await readdir(dir)).filter((name) => name.endsWith('.json'));
  const rows: { ref: string; locale: string; text: string; label: string }[] = [];
  for (const file of files)
  {
    const parsed = JSON.parse(await readFile(path.join(dir, file), 'utf8')) as CardFile;
    for (const entry of parsed.facts) 
    {
      for (const locale of LOCALES) 
      {
        const wording = pair(entry[locale]);
        if (!wording) 
          continue;
        rows.push({ ref: entry.ref, locale, text: wording.t, label: 'TRUE' });
        rows.push({ ref: entry.ref, locale, text: wording.f, label: 'FALSE' });
      }
    }
  }
  for (let i = rows.length - 1; i > 0; i -= 1) 
  {
    const j = randomInt(i + 1);
    const a = rows[i] as (typeof rows)[number];
    const b = rows[j] as (typeof rows)[number];
    rows[i] = b;
    rows[j] = a;
  }
  return rows.slice(0, size);
}
