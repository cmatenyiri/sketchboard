import type { FontFamily } from '../types';

export const LINE_HEIGHT = 1.25;

export const FONT_STACKS: Record<FontFamily, string> = {
  hand: '"Kalam", "Comic Sans MS", cursive',
  sans: '"Plus Jakarta Sans Variable", "Plus Jakarta Sans", system-ui, sans-serif',
  mono: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace',
};

export const FONT_LABELS: Record<FontFamily, string> = {
  hand: 'Hand-drawn',
  sans: 'Normal',
  mono: 'Code',
};

export const FONT_SIZES = [
  { label: 'S', value: 16 },
  { label: 'M', value: 20 },
  { label: 'L', value: 28 },
  { label: 'XL', value: 40 },
];

export const fontString = (family: FontFamily, size: number) => `${size}px ${FONT_STACKS[family]}`;

let measureCtx: CanvasRenderingContext2D | null = null;
const getCtx = () => {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx!;
};

const widthCache = new Map<string, number>();

export const measureLineWidth = (line: string, font: string) => {
  const key = `${font}|${line}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  const ctx = getCtx();
  ctx.font = font;
  const w = ctx.measureText(line).width;
  if (widthCache.size > 5000) widthCache.clear();
  widthCache.set(key, w);
  return w;
};

/** Called once fonts finish loading, since measurements taken with fallback fonts are wrong. */
export const clearTextMeasureCache = () => {
  widthCache.clear();
  metricsCache.clear();
};

export const measureText = (text: string, family: FontFamily, size: number) => {
  const font = fontString(family, size);
  const lines = text.split('\n');
  const width = Math.max(...lines.map((l) => measureLineWidth(l, font)), size * 0.5);
  const height = lines.length * size * LINE_HEIGHT;
  return { width: Math.ceil(width), height: Math.ceil(height) };
};

const metricsCache = new Map<string, { ascent: number; descent: number }>();

/** Font ascent/descent so canvas text sits exactly where the DOM editor puts it. */
export const fontMetrics = (family: FontFamily, size: number) => {
  const key = `${family}|${size}`;
  const cached = metricsCache.get(key);
  if (cached) return cached;
  const ctx = getCtx();
  ctx.font = fontString(family, size);
  const m = ctx.measureText('Mg');
  const result = {
    ascent: m.fontBoundingBoxAscent ?? size * 0.8,
    descent: m.fontBoundingBoxDescent ?? size * 0.2,
  };
  metricsCache.set(key, result);
  return result;
};

/** Greedy word wrap that also breaks words longer than the available width. */
export const wrapText = (text: string, family: FontFamily, size: number, maxWidth: number) => {
  const font = fontString(family, size);
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph) {
      out.push('');
      continue;
    }
    const words = paragraph.split(/(\s+)/);
    let line = '';
    for (const word of words) {
      const candidate = line + word;
      if (measureLineWidth(candidate, font) <= maxWidth || !line.trim()) {
        if (measureLineWidth(candidate, font) > maxWidth && !line.trim()) {
          // A single word that does not fit: hard-break it character by character.
          let chunk = line;
          for (const ch of word) {
            if (measureLineWidth(chunk + ch, font) > maxWidth && chunk) {
              out.push(chunk);
              chunk = ch;
            } else chunk += ch;
          }
          line = chunk;
        } else line = candidate;
      } else {
        out.push(line.trimEnd());
        line = word.trimStart();
      }
    }
    out.push(line.trimEnd());
  }
  return out;
};

export const loadFonts = async () => {
  if (!('fonts' in document)) return;
  await Promise.allSettled(
    (['hand', 'sans', 'mono'] as FontFamily[]).flatMap((f) => [
      document.fonts.load(fontString(f, 20)),
      document.fonts.load(`bold ${fontString(f, 20)}`),
    ]),
  );
  clearTextMeasureCache();
};
