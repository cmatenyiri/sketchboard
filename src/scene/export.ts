import kalamUrl from '@fontsource/kalam/files/kalam-latin-400-normal.woff2?url';
import monoUrl from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url';
import sansUrl from '@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2?url';
import type { BinaryFiles, Bounds, FontFamily, SceneElement, ThemeMode } from '../types';
import { themed, TRANSPARENT } from './colors';
import {
  getCenter,
  getCommonBounds,
  getTextLayout,
  isImage,
  isLinear,
  isShape,
  isText,
} from './elements';
import { preloadImages, renderElements } from './renderer';
import { cornerRadius, dashPattern, getElementPaths } from './shapeCache';
import { fontMetrics, FONT_STACKS } from './text';

export interface ExportOptions {
  background: boolean;
  canvasBackground: string;
  theme: ThemeMode;
  scale: number;
  padding: number;
}

const exportBounds = (elements: readonly SceneElement[]): Bounds => {
  const b = getCommonBounds(elements) ?? { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  // Arrow labels can stick out past the line's bounds.
  for (const el of elements) {
    if (isLinear(el) && el.text) {
      const l = getTextLayout(el);
      if (l) {
        b.minX = Math.min(b.minX, l.x - 4);
        b.minY = Math.min(b.minY, l.y - 2);
        b.maxX = Math.max(b.maxX, l.x + l.width + 4);
        b.maxY = Math.max(b.maxY, l.y + l.height + 2);
      }
    }
  }
  return b;
};

export const exportToCanvas = async (
  elements: readonly SceneElement[],
  files: BinaryFiles,
  opts: ExportOptions,
) => {
  await preloadImages(elements, files);
  const b = exportBounds(elements);
  const w = b.maxX - b.minX + opts.padding * 2;
  const h = b.maxY - b.minY + opts.padding * 2;
  // Browsers cap canvas area; scale down if needed rather than failing silently.
  const maxSide = 16000;
  const scale = Math.min(opts.scale, maxSide / w, maxSide / h);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w * scale));
  canvas.height = Math.max(1, Math.ceil(h * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  if (opts.background) {
    ctx.fillStyle = themed(opts.canvasBackground, opts.theme);
    ctx.fillRect(0, 0, w, h);
  }
  ctx.translate(-b.minX + opts.padding, -b.minY + opts.padding);
  renderElements(ctx, elements, {
    theme: opts.theme,
    files,
    canvasBackground: opts.canvasBackground,
  });
  return canvas;
};

export const exportToBlob = async (
  elements: readonly SceneElement[],
  files: BinaryFiles,
  opts: ExportOptions,
) => {
  const canvas = await exportToCanvas(elements, files, opts);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), 'image/png'),
  );
};

// ---------------------------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------------------------

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const FONT_URLS: Record<FontFamily, string> = { hand: kalamUrl, sans: sansUrl, mono: monoUrl };
const FONT_FACE_NAMES: Record<FontFamily, string> = {
  hand: 'Kalam',
  sans: 'Plus Jakarta Sans Variable',
  mono: 'JetBrains Mono Variable',
};

const fontDataCache = new Map<FontFamily, string>();
const embedFont = async (family: FontFamily) => {
  const cached = fontDataCache.get(family);
  if (cached) return cached;
  try {
    const res = await fetch(FONT_URLS[family]);
    const blob = await res.blob();
    const data = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.readAsDataURL(blob);
    });
    const css = `@font-face{font-family:"${FONT_FACE_NAMES[family]}";src:url(${data}) format("woff2");}`;
    fontDataCache.set(family, css);
    return css;
  } catch {
    return '';
  }
};

const svgText = (el: SceneElement, theme: ThemeMode, canvasBackground: string) => {
  const layout = getTextLayout(el);
  if (!layout || !layout.lines.length) return '';
  const { ascent, descent } = fontMetrics(el.fontFamily, el.fontSize);
  const halfLeading = (layout.lineHeight - (ascent + descent)) / 2;
  const align = isLinear(el) ? 'center' : el.textAlign;
  const anchor = align === 'left' ? 'start' : align === 'center' ? 'middle' : 'end';
  const x =
    align === 'left'
      ? layout.x
      : align === 'center'
        ? layout.x + layout.width / 2
        : layout.x + layout.width;
  let out = '';
  if (isLinear(el)) {
    out += `<rect x="${layout.x - 4}" y="${layout.y - 2}" width="${layout.width + 8}" height="${layout.height + 4}" rx="6" fill="${themed(canvasBackground, theme)}"/>`;
  }
  out += `<text font-family="${esc(FONT_STACKS[el.fontFamily])}" font-size="${el.fontSize}" fill="${themed(el.strokeColor, theme)}" text-anchor="${anchor}" style="white-space:pre">`;
  layout.lines.forEach((line, i) => {
    out += `<tspan x="${x}" y="${layout.y + i * layout.lineHeight + halfLeading + ascent}">${esc(line)}</tspan>`;
  });
  return out + '</text>';
};

export const exportToSvg = async (
  elements: readonly SceneElement[],
  files: BinaryFiles,
  opts: Omit<ExportOptions, 'scale'>,
) => {
  const b = exportBounds(elements);
  const w = b.maxX - b.minX + opts.padding * 2;
  const h = b.maxY - b.minY + opts.padding * 2;
  const families = new Set<FontFamily>();
  for (const el of elements) if (isText(el) || el.text) families.add(el.fontFamily);
  const fontCss = (await Promise.all([...families].map(embedFont))).join('');

  let body = '';
  let clipId = 0;
  for (const el of elements) {
    const [cx, cy] = getCenter(el);
    const rotate = el.angle ? ` rotate(${(el.angle * 180) / Math.PI} ${cx} ${cy})` : '';
    let inner = '';
    if (isText(el)) {
      inner = svgText(el, opts.theme, opts.canvasBackground);
    } else if (isImage(el)) {
      const file = files[el.fileId];
      if (file) {
        let clip = '';
        if (el.roundness === 'round') {
          const id = `clip${clipId++}`;
          const r = cornerRadius(el.width, el.height) * 0.6;
          inner += `<clipPath id="${id}"><rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${r}"/></clipPath>`;
          clip = ` clip-path="url(#${id})"`;
        }
        inner += `<image href="${file.dataURL}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" preserveAspectRatio="none"${clip}/>`;
      }
    } else {
      const stroke = themed(el.strokeColor, opts.theme);
      const fill = themed(el.backgroundColor, opts.theme);
      const dash = dashPattern(el).join(' ');
      let paths = '';
      for (const p of getElementPaths(el)) {
        switch (p.role) {
          case 'fill':
            if (el.backgroundColor !== TRANSPARENT)
              paths += `<path d="${p.d}" fill="${fill}" stroke="none"/>`;
            break;
          case 'fillSketch':
            if (el.backgroundColor !== TRANSPARENT)
              paths += `<path d="${p.d}" fill="none" stroke="${fill}" stroke-width="${p.width}" stroke-linecap="round"/>`;
            break;
          case 'headFill':
          case 'freedraw':
            paths += `<path d="${p.d}" fill="${stroke}" stroke="none"/>`;
            break;
          case 'stroke':
            paths += `<path d="${p.d}" fill="none" stroke="${stroke}" stroke-width="${p.width}" stroke-linecap="round" stroke-linejoin="round"${p.dashed && dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
            break;
        }
      }
      inner = `<g transform="translate(${el.x} ${el.y})">${paths}</g>`;
      if (isShape(el) && el.text) inner += svgText(el, opts.theme, opts.canvasBackground);
    }
    const opacity = el.opacity < 100 ? ` opacity="${el.opacity / 100}"` : '';
    body += `<g${rotate ? ` transform="${rotate.trim()}"` : ''}${opacity}>${inner}</g>`;
    if (isLinear(el) && el.text)
      body += `<g${opacity}>${svgText(el, opts.theme, opts.canvasBackground)}</g>`;
  }
  const bg = opts.background
    ? `<rect x="${b.minX - opts.padding}" y="${b.minY - opts.padding}" width="${w}" height="${h}" fill="${themed(opts.canvasBackground, opts.theme)}"/>`
    : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" ` +
    `viewBox="${b.minX - opts.padding} ${b.minY - opts.padding} ${w} ${h}">` +
    (fontCss ? `<defs><style>${fontCss}</style></defs>` : '') +
    bg +
    body +
    '</svg>'
  );
};

// ---------------------------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------------------------

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export const safeFilename = (name: string) =>
  (name.trim() || 'board')
    .replace(/[^\w\- ]+/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase() || 'board';

export const pickFile = (accept: string) =>
  new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
