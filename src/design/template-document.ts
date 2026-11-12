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

export type TemplateObject = TemplateText | TemplateRect;

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
      {
        type: 'text',
        role: 'headline',
        text: 'العنوان',
        x: 120,
        y: 200,
        width: 840,
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
        y: 340,
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

export function renderTemplateSvg(
  document: TemplateDocument,
  copy: { headline: string; caption: string; cta: string },
): string {
  const parts = document.objects.map((object) => (object.type === 'rect' ? rectSvg(object) : textSvg(filled(object, copy))));
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

function textSvg(object: TemplateText): string {
  const lines = wrap(object.text, object.fontSize, object.width);
  const anchor = object.align === 'center' ? 'middle' : object.align === 'left' ? 'start' : 'end';
  const x = object.align === 'center' ? object.x + object.width / 2 : object.align === 'left' ? object.x : object.x + object.width;
  const tspans = lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : object.fontSize * 1.35}">${escapeXml(line)}</tspan>`)
    .join('');
  return `<text x="${x}" y="${object.y + object.fontSize}" fill="${escapeXml(object.fill)}" font-family="Cairo, Tahoma, sans-serif" font-size="${object.fontSize}" font-weight="${object.fontWeight}" text-anchor="${anchor}">${tspans}</text>`;
}

function wrap(text: string, fontSize: number, width: number): string[] {
  const size = Math.max(8, Math.floor(width / (fontSize * 0.55)));
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words.length ? words : ['']) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > size && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 8);
}

function parseObject(value: unknown): TemplateObject {
  const record = asRecord(value);
  if (record.type === 'rect') {
    return {
      type: 'rect',
      x: numberField(record.x, 0),
      y: numberField(record.y, 0),
      width: clamp(numberField(record.width, 100), 4, 2000),
      height: clamp(numberField(record.height, 100), 4, 2000),
      fill: colorField(record.fill, '#ffffff'),
      radius: clamp(numberField(record.radius, 0), 0, 400),
    };
  }
  const role = ROLES.has(record.role as TextRole) ? (record.role as TextRole) : 'static';
  return {
    type: 'text',
    role,
    text: stringField(record.text).slice(0, 500),
    x: numberField(record.x, 0),
    y: numberField(record.y, 0),
    width: clamp(numberField(record.width, 400), 40, 2000),
    fontSize: clamp(numberField(record.fontSize, 32), 12, 160),
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
