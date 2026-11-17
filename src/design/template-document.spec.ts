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
    expect(svg.indexOf('#ea580c')).toBeGreaterThan(svg.indexOf('عرض محدود على التبييض'));
  });

  it('rejects a template that has no caption layer', () => {
    const document = blankTemplate();
    document.objects = document.objects.filter((object) => object.type !== 'text' || object.role !== 'caption');
    expect(() => parseTemplateDocument(document)).toThrow(/headline, caption, and CTA/);
  });

  it('fits a long headline and places the logo inside its frame', () => {
    const svg = renderTemplateSvg(blankTemplate(), {
      headline: 'عرض كبير جداً على كل خدمات التبييض والتنظيف لهذا الأسبوع فقط',
      caption: 'تفاصيل المنتج تظهر داخل المساحة المخصصة دون أن تغطي زر الطلب.',
      cta: 'اطلب الآن',
      logoHref: 'data:image/png;base64,aaaa',
    });
    expect(svg).toContain('data:image/png;base64,aaaa');
    expect(svg).toContain('clipPath');
    expect(svg).not.toContain('font-size="64"');
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
