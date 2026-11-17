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

export type TemplateDocument = {
  width: number;
  height: number;
  background: string;
  objects: TemplateObject[];
};

export type Box = { x: number; y: number; width: number; height: number };
export type Guide = { axis: 'x' | 'y'; at: number };
export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export type ToolKind = 'text' | 'rect' | 'logo';

export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export const FORMATS = [
  { id: 'square', label: 'مربع', width: 1080, height: 1080 },
  { id: 'portrait', label: 'بورتريه', width: 1080, height: 1350 },
  { id: 'story', label: 'قصة', width: 1080, height: 1920 },
  { id: 'landscape', label: 'أفقي', width: 1080, height: 608 },
] as const;

const ROLE_LABEL: Record<TextRole, string> = {
  headline: 'العنوان',
  caption: 'النص',
  cta: 'الزر',
  static: 'نص ثابت',
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function objectLabel(object: TemplateObject): string {
  if (object.type === 'text') return ROLE_LABEL[object.role];
  if (object.type === 'image') return 'الشعار';
  return 'شكل';
}

export function objectBounds(object: TemplateObject, textHeight = 0): Box {
  if (object.type === 'text') {
    return {
      x: object.x,
      y: object.y,
      width: object.width,
      height: Math.max(textHeight, object.fontSize * 1.2),
    };
  }
  return { x: object.x, y: object.y, width: object.width, height: object.height };
}

export function canRemove(objects: TemplateObject[], index: number): boolean {
  const object = objects[index];
  if (!object || object.type !== 'text' || object.role === 'static') return Boolean(object);
  return objects.some((item, itemIndex) => itemIndex !== index && item.type === 'text' && item.role === object.role);
}

export function canChangeRole(objects: TemplateObject[], index: number, role: TextRole): boolean {
  const object = objects[index];
  if (!object || object.type !== 'text') return false;
  if (object.role === role || object.role === 'static') return true;
  return objects.some((item, itemIndex) => itemIndex !== index && item.type === 'text' && item.role === object.role);
}

export function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function createObject(kind: ToolKind, x: number, y: number): TemplateObject {
  if (kind === 'text') {
    const width = 420;
    const fontSize = 56;
    return {
      type: 'text',
      role: 'static',
      text: 'نص جديد',
      x: Math.round(x - width / 2),
      y: Math.round(y - fontSize / 2),
      width,
      fontSize,
      fill: '#111827',
      fontWeight: '700',
      align: 'right',
    };
  }
  if (kind === 'logo') {
    const size = 180;
    return {
      type: 'image',
      role: 'logo',
      x: Math.round(x - size / 2),
      y: Math.round(y - size / 2),
      width: size,
      height: size,
    };
  }
  const width = 320;
  const height = 140;
  return {
    type: 'rect',
    x: Math.round(x - width / 2),
    y: Math.round(y - height / 2),
    width,
    height,
    fill: '#ea580c',
    radius: 28,
  };
}

export function duplicateObject(object: TemplateObject): TemplateObject {
  const moved = { ...object, x: object.x + 24, y: object.y + 24 };
  if (moved.type === 'text') return { ...moved, role: 'static' };
  return moved;
}

export function normalizeColor(value: string, fallback: string): string {
  const raw = value.trim();
  const match = /^#?([0-9a-fA-F]{6})$/.exec(raw) ?? /^#?([0-9a-fA-F]{3})$/.exec(raw);
  if (!match) return fallback;
  const hex = match[1].length === 3 ? match[1].split('').map((char) => char + char).join('') : match[1];
  return `#${hex.toLowerCase()}`;
}

export function resizeBox(origin: Box, handle: Handle, dx: number, dy: number, lock: boolean, minWidth: number, minHeight: number): Box {
  let x1 = origin.x;
  let y1 = origin.y;
  let x2 = origin.x + origin.width;
  let y2 = origin.y + origin.height;
  if (handle.includes('e')) x2 += dx;
  if (handle.includes('w')) x1 += dx;
  if (handle.includes('s')) y2 += dy;
  if (handle.includes('n')) y1 += dy;

  if (lock && handle.length === 2 && origin.width > 0 && origin.height > 0) {
    const ratio = origin.width / origin.height;
    if (Math.abs(dx) >= Math.abs(dy)) {
      const height = (x2 - x1) / ratio;
      if (handle.includes('n')) y1 = y2 - height;
      else y2 = y1 + height;
    } else {
      const width = (y2 - y1) * ratio;
      if (handle.includes('w')) x1 = x2 - width;
      else x2 = x1 + width;
    }
  }

  if (x2 - x1 < minWidth) {
    if (handle.includes('w') && !handle.includes('e')) x1 = x2 - minWidth;
    else x2 = x1 + minWidth;
  }
  if (y2 - y1 < minHeight) {
    if (handle.includes('n') && !handle.includes('s')) y1 = y2 - minHeight;
    else y2 = y1 + minHeight;
  }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

export function collectTargets(boxes: Box[], canvas: { width: number; height: number }): { xs: number[]; ys: number[] } {
  const xs = [0, canvas.width / 2, canvas.width];
  const ys = [0, canvas.height / 2, canvas.height];
  for (const box of boxes) {
    xs.push(box.x, box.x + box.width / 2, box.x + box.width);
    ys.push(box.y, box.y + box.height / 2, box.y + box.height);
  }
  return { xs, ys };
}

export function snapMove(box: Box, xs: number[], ys: number[], threshold: number): { box: Box; guides: Guide[] } {
  const guides: Guide[] = [];
  const x = snapAxis(box.x, box.width, xs, threshold);
  const y = snapAxis(box.y, box.height, ys, threshold);
  if (x.guide != null) guides.push({ axis: 'x', at: x.guide });
  if (y.guide != null) guides.push({ axis: 'y', at: y.guide });
  return { box: { ...box, x: x.value, y: y.value }, guides };
}

export function snapResize(origin: Box, handle: Handle, box: Box, xs: number[], ys: number[], threshold: number, min: number): { box: Box; guides: Guide[] } {
  let { x, y, width, height } = box;
  const guides: Guide[] = [];
  if (handle.includes('e')) {
    const hit = nearest(x + width, xs, threshold);
    if (hit != null) {
      width = Math.max(min, hit - x);
      guides.push({ axis: 'x', at: x + width });
    }
  } else if (handle.includes('w')) {
    const hit = nearest(x, xs, threshold);
    if (hit != null) {
      const right = origin.x + origin.width;
      x = Math.min(hit, right - min);
      width = right - x;
      guides.push({ axis: 'x', at: x });
    }
  }
  if (handle.includes('s')) {
    const hit = nearest(y + height, ys, threshold);
    if (hit != null) {
      height = Math.max(min, hit - y);
      guides.push({ axis: 'y', at: y + height });
    }
  } else if (handle.includes('n')) {
    const hit = nearest(y, ys, threshold);
    if (hit != null) {
      const bottom = origin.y + origin.height;
      y = Math.min(hit, bottom - min);
      height = bottom - y;
      guides.push({ axis: 'y', at: y });
    }
  }
  return { box: { x, y, width, height }, guides };
}

function snapAxis(origin: number, size: number, targets: number[], threshold: number): { value: number; guide: number | null } {
  const edges = [0, size / 2, size];
  let best = threshold;
  let value = origin;
  let guide: number | null = null;
  let found = false;
  for (const edge of edges) {
    for (const target of targets) {
      const distance = Math.abs(origin + edge - target);
      if (distance <= best) {
        found = true;
        best = distance;
        value = target - edge;
        guide = target;
      }
    }
  }
  return found ? { value, guide } : { value: origin, guide: null };
}

function nearest(value: number, targets: number[], threshold: number): number | null {
  let best: number | null = null;
  let distance = threshold;
  for (const target of targets) {
    const delta = Math.abs(value - target);
    if (delta <= distance) {
      distance = delta;
      best = target;
    }
  }
  return best;
}
