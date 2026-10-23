import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/httpError.js';
import { fieldErrors } from '@wkb/shared';

/* Turns every error into the same JSON shape: { error: { code, fields? } }.
'code' is an i18n key, so the browser decides the wording.
Fastify types the handler's error as 'unknown', so read its fields carefully */
function statusCodeOf(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) 
  {
    const value = (error as { statusCode?: unknown }).statusCode;
    if (typeof value === 'number') 
      return value;
  }
  return 500;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) 
    {
      return reply
        .code(error.statusCode)
        .send({ error: { code: error.code, ...(error.fields ? { fields: error.fields } : {}) } });
    }
    if (error instanceof ZodError) 
    {
      return reply
        .code(400)
        .send({ error: { code: 'error.validation', fields: fieldErrors(error) } });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) 
    {
      if (error.code === 'P2002') 
      {
        const target = Array.isArray(error.meta?.target) ? String(error.meta.target[0]) : 'value';
        return reply.code(409).send({ error: { code: 'error.alreadyExists', fields: { [target]: 'error.alreadyExists' } } });
      }
      if (error.code === 'P2025') 
      {
        return reply.code(404).send({ error: { code: 'error.notFound' } });
      }
    }
    // Fastify's own validation / payload errors carry a statusCode.
    const status = statusCodeOf(error);
    if (status === 413) 
      return reply.code(413).send({ error: { code: 'error.payloadTooLarge' } });
    if (status === 429) 
      return reply.code(429).send({ error: { code: 'error.rateLimited' } });
    if (status >= 400 && status < 500) 
    {
      return reply.code(status).send({ error: { code: 'error.badRequest' } });
    }

    request.log.error({ err: error }, 'unhandled error');
    return reply.code(500).send({ error: { code: 'error.internal' } });
  });
  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: { code: 'error.notFound' } });
  });
}
