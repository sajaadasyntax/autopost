import { PermanentError } from '../common/errors';

export type PostCopy = {
  headline: string;
  caption: string;
  hashtags: string[];
  cta: string;
};

const WHATSAPP_BODY_LIMIT = 1024;

export function readHashtags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string') {
    try {
      return readHashtags(JSON.parse(value) as unknown);
    } catch {
      return [];
    }
  }
  return [];
}

export function localCopy(input: { brief: string; revision?: string }): PostCopy {
  const subject = input.revision ? `${input.brief} (${input.revision})` : input.brief;
  return normalizeCopy({
    headline: subject,
    caption: `${subject}. العرض لفترة محدودة.`,
    hashtags: ['عرض', 'تجربة'],
    cta: 'احجز الآن',
  });
}

export function normalizeHashtag(tag: string): string {
  const trimmed = tag.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    return '';
  }
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return /^#[\p{L}\p{N}_]+$/u.test(withHash) ? withHash : '';
}

export function normalizeCopy(input: unknown): PostCopy {
  const record = asRecord(input);
  const headline = clip(stringField(record.headline), 60);
  const caption = clip(stringField(record.caption), 700);
  const cta = clip(stringField(record.cta), 40);
  const hashtags = Array.isArray(record.hashtags)
    ? record.hashtags
        .map((tag) => normalizeHashtag(typeof tag === 'string' ? tag : ''))
        .filter(Boolean)
        .slice(0, 10)
    : [];
  if (!headline || !caption || !cta) {
    throw new PermanentError('The model returned an empty headline, caption, or CTA.');
  }
  return { headline, caption, hashtags, cta };
}

export function formatPostText(copy: { caption: string; hashtags: unknown; cta: string }): string {
  const tags = readHashtags(copy.hashtags)
    .map((tag) => normalizeHashtag(tag))
    .filter(Boolean)
    .slice(0, 10)
    .join(' ');
  const text = [copy.caption.trim(), tags, copy.cta.trim()].filter(Boolean).join('\n\n');
  if (text.length <= WHATSAPP_BODY_LIMIT) {
    return text;
  }
  return `${text.slice(0, WHATSAPP_BODY_LIMIT - 3)}...`;
}

export function buildContentPrompt(input: {
  name: string;
  tone: string;
  audience: string;
  brief: string;
  revision?: string;
}): { system: string; user: string } {
  const system = [
    `You are a social media manager for ${input.name}.`,
    `Tone: ${input.tone}.`,
    `Audience: ${input.audience}.`,
    'Write one post that works for both Facebook and Instagram.',
    'Headline is short overlay text for a square image, under 60 characters.',
    'Caption is under 700 characters and does not contain hashtags.',
    'Return 8 to 10 hashtags.',
    'CTA is under 40 characters.',
    'Write the headline, caption, hashtags, and CTA in Arabic.',
  ].join('\n');
  const user = input.revision
    ? `Original brief:\n${input.brief}\n\nChange requested:\n${input.revision}`
    : input.brief;
  return { system, user };
}

function clip(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return trimmed.slice(0, max).trim();
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
