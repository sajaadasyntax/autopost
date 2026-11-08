import { createHmac } from 'crypto';
import { verifyWhatsappSignature } from './whatsapp-signature';

describe('verifyWhatsappSignature', () => {
  const body = Buffer.from('{"ok":true}');
  const secret = 'app-secret';

  it('accepts a matching hub signature', () => {
    const header = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    expect(verifyWhatsappSignature(body, header, secret)).toBe(true);
  });

  it('rejects a missing or swapped signature', () => {
    expect(verifyWhatsappSignature(body, undefined, secret)).toBe(false);
    expect(verifyWhatsappSignature(body, 'sha256=abcd', secret)).toBe(false);
  });
});
