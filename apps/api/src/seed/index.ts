import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Prisma } from '@prisma/client';
import { DEFAULT_LOCALE, LOCALES } from '@wkb/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { hashPassword } from '../lib/password.js';
import {
  ACHIEVEMENTS,
  BOTS,
  DEMO_PASSWORD,
  DEMO_USERS,
  type FactFile,
  type LocalisedPair,
} from './data.js';

// Loads the card set and reference data. Safe to run repeatedly and runs on every container boot.
const FACTS_DIR = path.resolve(process.cwd(), 'prisma', 'seed', 'facts');

function isPair(value: unknown): value is LocalisedPair {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as LocalisedPair).t === 'string' &&
    typeof (value as LocalisedPair).f === 'string'
  );
}

async function seedCardSet(): Promise<{ categories: number; facts: number; cards: number; translations: number }> {
  let files: string[];
  try {
    files = (await readdir(FACTS_DIR)).filter((f) => f.endsWith('.json')).sort();
  } catch {
    console.warn(`[seed] no card set found at ${FACTS_DIR}; skipping`);
    return { categories: 0, facts: 0, cards: 0, translations: 0 };
  }
  let facts = 0;
  let cards = 0;
  let translations = 0;
  for (const file of files) 
  {
    const raw = await readFile(path.join(FACTS_DIR, file), 'utf8');
    const parsed = JSON.parse(raw) as FactFile;
    const category = await prisma.category.upsert({
      where: { slug: parsed.category.slug },
      create: { slug: parsed.category.slug, name: parsed.category.name },
      update: { name: parsed.category.name },
    });
    for (const entry of parsed.facts) 
    {
      const sourceRef = `curated:${entry.ref}`;
      const base = entry[DEFAULT_LOCALE];
      if (!isPair(base)) 
      {
        console.warn(`[seed] ${file}: ${entry.ref} has no ${DEFAULT_LOCALE} wording; skipped`);
        continue;
      }
      const fact = await prisma.facts.upsert({
        where: { sourceRef },
        create: {
          categoryId: category.id,
          difficulty: entry.difficulty,
          sourceRef,
          license: parsed.license,
          verifiedAt: new Date(),
          active: true,
        },
        update: {
          categoryId: category.id,
          difficulty: entry.difficulty,
          license: parsed.license,
        },
      });
      facts += 1;
      for (const [form, text, isTrue] of [['affirmative', base.t, true], ['negated', base.f, false], ] as const) 
      {
        const card = await prisma.card.upsert({
          where: { factId_form: { factId: fact.id, form } },
          create: { factId: fact.id, text, isTrue, form },
          update: { text, isTrue },
        });
        cards += 1;
        for (const locale of LOCALES) 
        {
          if (locale === DEFAULT_LOCALE) 
            continue;
          const localised = entry[locale];
          if (!isPair(localised)) 
            continue;
          const localisedText = form === 'affirmative' ? localised.t : localised.f;

          await prisma.cardTranslation.upsert({
            where: { cardId_locale: { cardId: card.id, locale } },
            create: { cardId: card.id, locale, text: localisedText },
            update: { text: localisedText },
          });
          translations += 1;
        }
      }
    }
  }
  return { categories: files.length, facts, cards, translations };
}

async function seedAchievements(): Promise<number> {
  for (const achievement of ACHIEVEMENTS)
  {
    // The rule blob is opaque to Prisma; services/rewards.ts is what reads it.
    const criteria = achievement.criteria as Prisma.InputJsonObject;
    await prisma.achievement.upsert({
      where: { slug: achievement.slug },
      create: {
        slug: achievement.slug,
        name: achievement.name,
        description: achievement.description,
        criteria,
      },
      update: { name: achievement.name, description: achievement.description, criteria },
    });
  }
  return ACHIEVEMENTS.length;
}

async function seedBots(): Promise<number> {
  for (const bot of BOTS) 
  {
    const email = `${bot.displayName.toLowerCase()}@bots.wkb.local`;
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        displayName: bot.displayName,
        // A bot has no password hash, so the login route can never accept one.
        passwordHash: null,
        isBot: true,
        locale: DEFAULT_LOCALE,
        onboardedAt: new Date(),
      },
      update: { displayName: bot.displayName, isBot: true },
    });

    await prisma.botProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        label: bot.label,
        accuracyByCategory: bot.accuracyByCategory,
        reactionMsMean: bot.reactionMsMean,
        reactionMsStddev: bot.reactionMsStddev,
      },
      update: {
        label: bot.label,
        accuracyByCategory: bot.accuracyByCategory,
        reactionMsMean: bot.reactionMsMean,
        reactionMsStddev: bot.reactionMsStddev,
      },
    });
  }
  return BOTS.length;
}

async function seedDemoUsers(): Promise<number> {
  const emails = DEMO_USERS.map((demo) => demo.email);
  if (!env.SEED_DEMO_USERS)
  {
    /* Turned off. Accounts an earlier boot created are kept, with their history, but lose the public password so nobody can sign in to them.
    A demo account can't set a password of its own, so there is no real one to lose */
    const locked = await prisma.user.updateMany({
      where: { email: { in: emails }, passwordHash: { not: null } },
      data: { passwordHash: null },
    });
    if (locked.count > 0)
      console.log(`[seed] SEED_DEMO_USERS is off; locked ${locked.count} demo account(s)`);
    return 0;
  }
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  let seeded = 0;
  for (const demo of DEMO_USERS)
  {
    try {
      await prisma.user.upsert({
        where: { email: demo.email },
        create: {
          email: demo.email,
          displayName: demo.displayName,
          passwordHash,
          locale: demo.locale,
          onboardedAt: new Date(),
        },
        update: { displayName: demo.displayName },
      });
      // Unlocks an account a boot with demo users off had locked. One that has a password keeps it
      await prisma.user.updateMany({ where: { email: demo.email, passwordHash: null }, data: { passwordHash } });
      seeded += 1;
    } catch (error) {
      // A person already took the name (demo users were off when they signed up). That is no reason to stop the server from starting
      if ((error as { code?: string }).code !== 'P2002')
        throw error;
      console.warn(`[seed] demo account ${demo.email} skipped: the name ${demo.displayName} is taken`);
    }
  }
  return seeded;
}

async function main(): Promise<void> {
  const started = Date.now();
  const cardSet = await seedCardSet();
  const achievements = await seedAchievements();
  const bots = await seedBots();
  const demo = await seedDemoUsers();
  console.log(
    `[seed] ${cardSet.categories} categories · ${cardSet.facts} facts · ` +
      `${cardSet.cards} cards · ${cardSet.translations} translations · ` +
      `${achievements} achievements · ${bots} bots · ${demo} demo users ` +
      `(${Date.now() - started} ms)`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error('[seed] failed', error);
    await prisma.$disconnect();
    process.exit(1);
  });
