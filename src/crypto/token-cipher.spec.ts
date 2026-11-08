import { decryptString, encryptString, parseEncryptionKey } from './token-cipher';

describe('token cipher', () => {
  const key = parseEncryptionKey('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');

  it('round-trips a page token', () => {
    const payload = encryptString('EAA-page-token', key);
    expect(decryptString(payload, key)).toBe('EAA-page-token');
  });

  it('rejects a short key', () => {
    expect(() => parseEncryptionKey('abcd')).toThrow(/APP_ENCRYPTION_KEY/);
  });

  it('rejects a truncated payload', () => {
    expect(() => decryptString('abc', key)).toThrow(/too short/);
  });
});
