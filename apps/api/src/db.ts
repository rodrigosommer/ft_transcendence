import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

export const prisma = new PrismaClient({
  log: env.LOG_LEVEL === 'debug' ? ['warn', 'error', 'query'] : ['warn', 'error'],
});

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
