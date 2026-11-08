import { HttpError, isFinalAttempt, isPermanent, publicError } from './errors';
import { PermanentError } from './errors';

describe('error helpers', () => {
  it('treats Claude and Meta client errors as permanent, except rate limits', () => {
    expect(isPermanent(new PermanentError('bad copy'))).toBe(true);
    expect(isPermanent(new HttpError('nope', 400))).toBe(true);
    expect(isPermanent(new HttpError('slow down', 429))).toBe(false);
    expect(isPermanent(new HttpError('down', 503))).toBe(false);
  });

  it('redacts access tokens from user-facing text', () => {
    expect(publicError(new Error('token EAAabcdefghijklmnop failed Bearer secret-value'))).toBe(
      'token [redacted] failed Bearer [redacted]',
    );
  });

  it('knows when BullMQ has used the last attempt', () => {
    expect(isFinalAttempt(2, 3)).toBe(false);
    expect(isFinalAttempt(3, 3)).toBe(true);
  });
});
