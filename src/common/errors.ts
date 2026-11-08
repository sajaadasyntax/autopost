export class PermanentError extends Error {
  readonly permanent = true;

  constructor(message: string) {
    super(message);
    this.name = 'PermanentError';
  }
}

export class HttpError extends Error {
  readonly permanent: boolean;

  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'HttpError';
    this.permanent = status >= 400 && status < 500 && status !== 408 && status !== 429;
  }
}

export function isPermanent(error: unknown): boolean {
  return error instanceof PermanentError || (error instanceof HttpError && error.permanent);
}

export function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  return message
    .replace(/EAA[A-Za-z0-9]+/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .slice(0, 300);
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === 'P2002';
}

export function isFinalAttempt(attemptsMade: number, maxAttempts: number): boolean {
  return attemptsMade >= maxAttempts;
}
