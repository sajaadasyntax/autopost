import { privacyPage } from './privacy.page';
import { termsPage } from './terms.page';

describe('policy pages', () => {
  it('describes the data Auto Post AI stores', () => {
    const html = privacyPage();
    expect(html).toContain('WhatsApp phone number');
    expect(html).toContain('delete my data');
    expect(html).toContain('/terms');
  });

  it('states that publishing follows the user approval', () => {
    const html = termsPage();
    expect(html).toContain('approve');
    expect(html).toContain('/privacy/whatsapp');
    expect(html).toContain('primalvrtech@gmail.com');
  });
});