/* Code that runs outside a request (match timers, bot votes, housekeeping) has no 'request.log' to write to.
server.ts hands the Fastify logger over at boot, so those errors land in the same log as everything else. Until then, console is the fallback */
export interface Logger {
  error(details: object, message: string): void;
  warn(details: object, message: string): void;
  info(details: object, message: string): void;
}

let current: Logger = {
  error: (details, message) => console.error(message, details),
  warn: (details, message) => console.warn(message, details),
  info: (details, message) => console.log(message, details),
};

export function setLogger(logger: Logger): void {
  current = logger;
}

export const log: Logger = {
  error: (details, message) => current.error(details, message),
  warn: (details, message) => current.warn(details, message),
  info: (details, message) => current.info(details, message),
};
