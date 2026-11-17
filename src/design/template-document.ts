import { PermanentError } from '../common/errors';

export type TextRole = 'headline' | 'caption' | 'cta' | 'static';

export type TemplateText = {
  type: 'text';
  role: TextRole;
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fill: string;
  fontWeight: '400' | '700';
  align: 'right' | 'center' | 'left';
};

export type TemplateRect = {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  radius: number;
};

export type TemplateImage = {
  type: 'image';
  role: 'logo';
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TemplateObject = TemplateText | TemplateRect | TemplateImage;

export type TemplateCopy = {
  headline: string;
  caption: string;
  cta: string;
  logoHref?: string;
};

export type TemplateDocument = {
  width: number;
  height: number;
  background: string;
  objects: TemplateObject[];
};

const ROLES = new Set<TextRole>(['headline', 'caption', 'cta', 'static']);

export function blankTemplate(): TemplateDocument {
  return {
    width: 1080,
    height: 1080,
    background: '#111827',
    objects: [
      { type: 'rect', x: 72, y: 72, width: 936, height: 936, fill: '#ffffff', radius: 36 },
      { type: 'image', role: 'logo', x: 780, y: 120, width: 180, height: 180 },
      {
        type: 'text',
        role: 'headline',
        text: 'العنوان',
        x: 120,
        y: 150,
        width: 620,
        fontSize: 64,
        fill: '#111827',
        fontWeight: '700',
        align: 'right',
      },
      {
        type: 'text',
        role: 'caption',
        text: 'نص المنشور يظهر هنا',
        x: 120,
        y: 400,
        width: 840,
        fontSize: 32,
        fill: '#374151',
        fontWeight: '400',
        align: 'right',
      },
      { type: 'rect', x: 120, y: 860, width: 340, height: 88, fill: '#ea580c', radius: 44 },
      {
        type: 'text',
        role: 'cta',
        text: 'اطلب الآن',
        x: 140,
        y: 884,
        width: 300,
        fontSize: 32,
        fill: '#ffffff',
        fontWeight: '700',
        align: 'center',
      },
    ],
  };
}

export function parseTemplateDocument(value: unknown): TemplateDocument {
  const record = asRecord(value);
  const width = numberField(record.width, 1080);
  const height = numberField(record.height, 1080);
  const objects = Array.isArray(record.objects) ? record.objects.map(parseObject) : [];
  const roles = new Set(objects.filter((item): item is TemplateText => item.type === 'text').map((item) => item.role));
  if (!roles.has('headline') || !roles.has('caption') || !roles.has('cta')) {
    throw new PermanentError('A template needs headline, caption, and CTA text.');
  }
  return {
    width: clamp(width, 320, 2000),
    height: clamp(height, 320, 2000),
    background: colorField(record.background, '#111827'),
    objects,
  };
}

export function renderTemplateSvg(document: TemplateDocument, copy: TemplateCopy): string {
  const parts = document.objects.map((object, index) => {
    if (object.type === 'rect') return rectSvg(object);
    if (object.type === 'image') return imageSvg(object, copy.logoHref, index);
    return textSvg(filled(object, copy), document);
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${document.width}" height="${document.height}" viewBox="0 0 ${document.width} ${document.height}">
  <rect width="100%" height="100%" fill="${escapeXml(document.background)}"/>
  ${parts.join('\n  ')}
</svg>`;
}

function filled(object: TemplateText, copy: { headline: string; caption: string; cta: string }): TemplateText {
  if (object.role === 'headline') return { ...object, text: copy.headline };
  if (object.role === 'caption') return { ...object, text: copy.caption };
  if (object.role === 'cta') return { ...object, text: copy.cta };
  return object;
}

function rectSvg(object: TemplateRect): string {
  return `<rect x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" rx="${object.radius}" fill="${escapeXml(object.fill)}"/>`;
}

function imageSvg(object: TemplateImage, href: string | undefined, index: number): string {
  const cx = object.x + object.width / 2;
  const cy = object.y + object.height / 2;
  const radius = Math.min(object.width, object.height) / 2;
  if (!href) {
    return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="#e5e7eb"/>`;
  }
  const id = `logo-${index}`;
  return `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${radius}"/></clipPath><image href="${escapeXml(href)}" x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`;
}

function textSvg(object: TemplateText, document: TemplateDocument): string {
  const fitted = fitText(object.text, object.fontSize, object.width, Math.max(object.fontSize * 1.2, nextBottom(document, object) - object.y));
  const anchor = object.align === 'center' ? 'middle' : object.align === 'left' ? 'start' : 'end';
  const x = object.align === 'center' ? object.x + object.width / 2 : object.align === 'left' ? object.x : object.x + object.width;
  const y = object.role === 'cta' ? ctaBaseline(object, document, fitted.fontSize, fitted.lines.length) : object.y + fitted.fontSize;
  const tspans = fitted.lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : fitted.fontSize * 1.35}">${escapeXml(line)}</tspan>`)
    .join('');
  return `<text x="${x}" y="${y}" fill="${escapeXml(object.fill)}" font-family="Cairo, Tahoma, sans-serif" font-size="${fitted.fontSize}" font-weight="${object.fontWeight}" text-anchor="${anchor}">${tspans}</text>`;
}

function nextBottom(document: TemplateDocument, object: TemplateText): number {
  const below = document.objects
    .filter((item) => item !== object && item.y >= object.y + 8 && overlaps(item, object))
    .map((item) => item.y);
  return below.length ? Math.min(...below) - 12 : document.height - 48;
}

function ctaBaseline(object: TemplateText, document: TemplateDocument, fontSize: number, lines: number): number {
  const button = document.objects.find(
    (item): item is TemplateRect =>
      item.type === 'rect' && item.y <= object.y && item.y + item.height >= object.y && overlaps(item, object),
  );
  const block = Math.max(fontSize, lines * fontSize * 1.2);
  if (!button) {
    return object.y + fontSize;
  }
  return button.y + (button.height - block) / 2 + fontSize * 0.8;
}

function overlaps(a: { x: number; width: number }, b: { x: number; width: number }): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width;
}

function fitText(text: string, fontSize: number, width: number, maxHeight: number): { fontSize: number; lines: string[] } {
  let size = fontSize;
  let lines = wrap(text, size, width);
  while (size > 18 && (blockHeight(lines, size) > maxHeight || lines.some((line) => estimateWidth(line, size) > width + 1))) {
    size -= 2;
    lines = wrap(text, size, width);
  }
  const maxLines = Math.max(1, Math.floor(maxHeight / (size * 1.35)));
  return { fontSize: size, lines: lines.slice(0, maxLines) };
}

function blockHeight(lines: string[], fontSize: number): number {
  return Math.max(fontSize, lines.length * fontSize * 1.35);
}

function wrap(text: string, fontSize: number, width: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words.length ? words : ['']) {
    const next = current ? `${current} ${word}` : word;
    if (estimateWidth(next, fontSize) > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function estimateWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const char of text) {
    if (char === ' ') {
      width += fontSize * 0.28;
    } else if (/[\u0600-\u06FF]/.test(char)) {
      width += fontSize * 0.55;
    } else {
      width += fontSize * 0.52;
    }
  }
  return width;
}

function parseObject(value: unknown): TemplateObject {
  const record = asRecord(value);
  if (record.type === 'image' || record.role === 'logo') {
    return {
      type: 'image',
      role: 'logo',
      x: numberField(record.x, 0),
      y: numberField(record.y, 0),
      width: clamp(numberField(record.width, 160), 16, 2000),
      height: clamp(numberField(record.height, 160), 16, 2000),
    };
  }
  if (record.type === 'rect') {
    return {
      type: 'rect',
      x: numberField(record.x, 0),
      y: numberField(record.y, 0),
      width: clamp(numberField(record.width, 100), 4, 2000),
      height: clamp(numberField(record.height, 100), 4, 2000),
      fill: colorField(record.fill, '#ffffff'),
      radius: clamp(numberField(record.radius, 0), 0, 1000),
    };
  }
  const role = ROLES.has(record.role as TextRole) ? (record.role as TextRole) : 'static';
  return {
    type: 'text',
    role,
    text: stringField(record.text).slice(0, 500),
    x: numberField(record.x, 0),
    y: numberField(record.y, 0),
    width: clamp(numberField(record.width, 400), 20, 2000),
    fontSize: clamp(numberField(record.fontSize, 32), 8, 320),
    fill: colorField(record.fill, '#111827'),
    fontWeight: record.fontWeight === '700' ? '700' : '400',
    align: record.align === 'center' || record.align === 'left' ? record.align : 'right',
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function numberField(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function colorField(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
