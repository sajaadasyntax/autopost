import { parseEncryptionKey } from '../crypto/token-cipher';
import { openOauthState, sealOauthState } from './oauth-state';

describe('oauth state', () => {
  const key = parseEncryptionKey('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');

  it('seals the PKCE verifier until it expires', () => {
    const sealed = sealOauthState({ verifier: 'verifier-value', exp: Date.now() + 1000 }, key);
    expect(openOauthState(sealed, key).verifier).toBe('verifier-value');
    const expired = sealOauthState({ verifier: 'old', exp: Date.now() - 1000 }, key);
    expect(() => openOauthState(expired, key)).toThrow(/expired/);
  });
});
