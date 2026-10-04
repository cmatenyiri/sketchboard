import type { ThemeMode } from '../types';

export const TRANSPARENT = 'transparent';

export interface ColorFamily {
  name: string;
  shades: [string, string, string, string, string]; // lightest -> darkest
}

/** Curated palette — each family goes from a soft tint (for fills) to a deep ink (for strokes). */
export const COLOR_FAMILIES: ColorFamily[] = [
  { name: 'Ink', shades: ['#f4f1ea', '#cfcac0', '#8a857c', '#45413b', '#1d1b18'] },
  { name: 'Tomato', shades: ['#ffe4de', '#ffb3a3', '#ff7a5c', '#e8492b', '#b02a12'] },
  { name: 'Amber', shades: ['#fff1cc', '#ffd978', '#f7b52c', '#d98b06', '#9a5c00'] },
  { name: 'Lime', shades: ['#ecf8d4', '#c6eb8a', '#8fcf3c', '#5a9e16', '#386b0b'] },
  { name: 'Mint', shades: ['#d8f6ea', '#9be6c8', '#3fc79a', '#14966c', '#0b6247'] },
  { name: 'Ocean', shades: ['#dbeeff', '#a5d2ff', '#5aa8f6', '#2271d6', '#123f8c'] },
  { name: 'Grape', shades: ['#ece6ff', '#c9b8ff', '#9a7dfa', '#6c47e0', '#43269e'] },
  { name: 'Rose', shades: ['#ffe0ef', '#ffadd3', '#f56aa8', '#d32e7b', '#8f1650'] },
];

export const QUICK_STROKES = ['#1d1b18', '#e8492b', '#2271d6', '#14966c', '#d98b06'];
export const QUICK_BACKGROUNDS = [TRANSPARENT, '#ffb3a3', '#a5d2ff', '#9be6c8', '#ffd978'];

export const CANVAS_BACKGROUNDS = [
  '#fbf8f2',
  '#ffffff',
  '#f3f4f6',
  '#fdf6e3',
  '#eef6ff',
  '#f5f0ff',
];

export const DEFAULT_STROKE = '#1d1b18';
export const DEFAULT_CANVAS_BACKGROUND = '#fbf8f2';

const hexToRgb = (hex: string): [number, number, number] | null => {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
};

const hslToHex = (h: number, s: number, l: number) => {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

const darkCache = new Map<string, string>();

/**
 * Maps a scene color to its dark-theme counterpart by inverting lightness while keeping hue,
 * so black ink becomes chalk-white and pastel fills become deep tints.
 */
export const toDarkColor = (color: string) => {
  if (color === TRANSPARENT) return color;
  const cached = darkCache.get(color);
  if (cached) return cached;
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const [h, s, l] = rgbToHsl(...rgb);
  // Compress the inverted range a touch so pure white/black don't glare.
  const inverted = 0.08 + (1 - l) * 0.84;
  // Near-white tints (paper, pastel fills) would turn into muddy browns; keep them close to neutral.
  const saturation = l > 0.9 ? s * 0.18 : l > 0.8 ? s * 0.55 : s * 0.92;
  const result = hslToHex(h, Math.min(1, saturation), inverted);
  darkCache.set(color, result);
  return result;
};

export const themed = (color: string, theme: ThemeMode) =>
  theme === 'dark' ? toDarkColor(color) : color;

export const isValidHex = (color: string) => hexToRgb(color) !== null;

export const normalizeHex = (color: string) => {
  const rgb = hexToRgb(color);
  if (!rgb) return null;
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
};
