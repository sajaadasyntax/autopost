import { createHash } from 'crypto';
import { createPkcePair } from './pkce';

describe('pkce', () => {
  it('builds an S256 challenge from the verifier', () => {
    const pair = createPkcePair();
    expect(pair.verifier.length).toBeGreaterThan(40);
    expect(createHash('sha256').update(pair.verifier).digest('base64url')).toBe(pair.challenge);
  });
});
