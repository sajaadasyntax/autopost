import { createHash, randomBytes, randomInt } from 'crypto';

export function randomToken(): string {
  return randomBytes(24).toString('base64url');
}

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function loginCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}
