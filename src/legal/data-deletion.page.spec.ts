import { dataDeletionPage } from './data-deletion.page';

describe('dataDeletionPage', () => {
  it('tells the sender the exact WhatsApp phrase', () => {
    const html = dataDeletionPage();
    expect(html).toContain('delete my data');
    expect(html).toContain('WhatsApp phone number');
    expect(html).toContain('Facebook');
  });
});