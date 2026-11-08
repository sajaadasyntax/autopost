import { formatPostText, localCopy, normalizeCopy } from './format-copy';

describe('format copy', () => {
  it('clips fields and normalizes hashtags', () => {
    const copy = normalizeCopy({
      headline: '  Hello   there  ',
      caption: 'Book a cleaning this week.',
      hashtags: ['whitening', '#Smile', 'bad tag', ''],
      cta: 'Book now',
    });
    expect(copy.headline).toBe('Hello there');
    expect(copy.hashtags).toEqual(['#whitening', '#Smile']);
    expect(formatPostText(copy)).toBe('Book a cleaning this week.\n\n#whitening #Smile\n\nBook now');
  });

  it('keeps the WhatsApp button body inside 1024 characters', () => {
    const copy = normalizeCopy({
      headline: 'Offer',
      caption: 'A'.repeat(900),
      hashtags: ['one'],
      cta: 'Book',
    });
    expect(formatPostText(copy).length).toBeLessThanOrEqual(1024);
  });

  it('builds a local stand-in when Claude is not configured', () => {
    const copy = localCopy({ brief: '20% off whitening', revision: 'mention Friday' });
    expect(copy.headline).toContain('Friday');
    expect(copy.cta).toBe('Book now');
    expect(formatPostText(copy).length).toBeLessThanOrEqual(1024);
  });

  it('rejects an empty caption', () => {
    expect(() => normalizeCopy({ headline: 'Hi', caption: ' ', hashtags: [], cta: 'Go' })).toThrow(/empty/);
  });
});
