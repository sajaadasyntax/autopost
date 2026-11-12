import { rasterizeSvg } from './template-raster';
import { parseTemplateDocument, renderTemplateSvg } from './template-document';
import { blankTemplate } from './template-document';

describe('template document', () => {
  it('renders the post copy into the named text layers', () => {
    const svg = renderTemplateSvg(blankTemplate(), {
      headline: 'خصم الجمعة',
      caption: 'عرض محدود على التبييض',
      cta: 'احجز الآن',
    });
    expect(svg).toContain('خصم الجمعة');
    expect(svg).toContain('عرض محدود على التبييض');
    expect(svg).toContain('احجز الآن');
    expect(svg).not.toContain('العنوان');
  });

  it('rejects a template that has no caption layer', () => {
    const document = blankTemplate();
    document.objects = document.objects.filter((object) => object.type !== 'text' || object.role !== 'caption');
    expect(() => parseTemplateDocument(document)).toThrow(/headline, caption, and CTA/);
  });

  it('rasterizes the filled template to a PNG', () => {
    const svg = renderTemplateSvg(blankTemplate(), {
      headline: 'عيادة النور',
      caption: 'تبييض الأسنان بخصم ٢٠٪',
      cta: 'اطلب الآن',
    });
    const png = rasterizeSvg(svg);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.length).toBeGreaterThan(1000);
  });
});
