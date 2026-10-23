/* 'message' is always an i18n key so the browser can render it in the user's language. 
 Never put a raw database or provider message in here.*/
export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(statusCode: number, code: string, fields?: Record<string, string>) {
    super(code);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    if (fields) 
      this.fields = fields;
  }
}

export const badRequest = (code: string, fields?: Record<string, string>) =>
  new HttpError(400, code, fields);
export const unauthorized = (code = 'error.unauthorized') => new HttpError(401, code);
export const forbidden = (code = 'error.forbidden') => new HttpError(403, code);
export const notFound = (code = 'error.notFound') => new HttpError(404, code);
export const conflict = (code: string, fields?: Record<string, string>) =>
  new HttpError(409, code, fields);
export const tooLarge = (code = 'error.payloadTooLarge') => new HttpError(413, code);
export const tooMany = (code = 'error.rateLimited') => new HttpError(429, code);
