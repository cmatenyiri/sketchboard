import type {
  BinaryFiles,
  Bounds,
  ImageElement,
  SceneElement,
  ThemeMode,
  Viewport,
} from '../types';
import { themed, TRANSPARENT } from './colors';
import {
  getCenter,
  getElementBounds,
  getTextLayout,
  isImage,
  isLinear,
  isShape,
  isText,
} from './elements';
import { boundsIntersect } from './math';
import { cornerRadius, dashPattern, getElementPaths } from './shapeCache';
import { fontMetrics, fontString } from './text';

// ---------------------------------------------------------------------------------------------
// Image cache
// ---------------------------------------------------------------------------------------------

const imageCache = new Map<string, HTMLImageElement>();
let onImageLoad: (() => void) | null = null;

export const setImageLoadListener = (fn: (() => void) | null) => {
  onImageLoad = fn;
};

export const getImage = (fileId: string, files: BinaryFiles) => {
  const file = files[fileId];
  if (!file) return null;
  let img = imageCache.get(fileId);
  if (!img) {
    img = new Image();
    img.onload = () => onImageLoad?.();
    img.src = file.dataURL;
    imageCache.set(fileId, img);
  }
  return img.complete && img.naturalWidth ? img : null;
};

/** Resolves once every image used by the elements is decoded (needed before exporting). */
export const preloadImages = async (elements: readonly SceneElement[], files: BinaryFiles) => {
  await Promise.all(
    elements.filter(isImage).map(
      (el) =>
        new Promise<void>((resolve) => {
          const file = files[el.fileId];
          if (!file) return resolve();
          let img = imageCache.get(el.fileId);
          if (!img) {
            img = new Image();
            img.src = file.dataURL;
            imageCache.set(el.fileId, img);
          }
          if (img.complete) return resolve();
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        }),
    ),
  );
};

// ---------------------------------------------------------------------------------------------
// Element rendering
// ---------------------------------------------------------------------------------------------

export interface RenderOptions {
  theme: ThemeMode;
  files: BinaryFiles;
  /** Background behind arrow labels (so the label "cuts" the line). */
  canvasBackground: string;
  hiddenIds?: ReadonlySet<string>;
  fadedIds?: ReadonlySet<string>;
  /** Hide only the label of this element (it's being edited in the DOM). */
  hiddenLabelId?: string | null;
}

const roundRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

const drawLabel = (
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  opts: RenderOptions,
  withBackdrop: boolean,
) => {
  const layout = getTextLayout(el);
  if (!layout || !layout.lines.length) return;
  const color = themed(el.strokeColor, opts.theme);
  const { ascent, descent } = fontMetrics(el.fontFamily, el.fontSize);
  const halfLeading = (layout.lineHeight - (ascent + descent)) / 2;
  if (withBackdrop) {
    ctx.fillStyle = themed(opts.canvasBackground, opts.theme);
    roundRectPath(ctx, layout.x - 4, layout.y - 2, layout.width + 8, layout.height + 4, 6);
    ctx.fill();
  }
  ctx.font = fontString(el.fontFamily, el.fontSize);
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  const align = isLinear(el) ? 'center' : el.textAlign;
  ctx.textAlign = align;
  const x =
    align === 'left'
      ? layout.x
      : align === 'center'
        ? layout.x + layout.width / 2
        : layout.x + layout.width;
  layout.lines.forEach((line, i) => {
    ctx.fillText(line, x, layout.y + i * layout.lineHeight + halfLeading + ascent);
  });
};

const drawPaths = (ctx: CanvasRenderingContext2D, el: SceneElement, opts: RenderOptions) => {
  const stroke = themed(el.strokeColor, opts.theme);
  const fill = themed(el.backgroundColor, opts.theme);
  const dash = dashPattern(el);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const p of getElementPaths(el)) {
    switch (p.role) {
      case 'fill':
        if (el.backgroundColor === TRANSPARENT) break;
        ctx.fillStyle = fill;
        ctx.fill(p.path);
        break;
      case 'fillSketch':
        if (el.backgroundColor === TRANSPARENT) break;
        ctx.setLineDash([]);
        ctx.strokeStyle = fill;
        ctx.lineWidth = p.width;
        ctx.stroke(p.path);
        break;
      case 'headFill':
      case 'freedraw':
        ctx.fillStyle = stroke;
        ctx.fill(p.path);
        break;
      case 'stroke':
        ctx.setLineDash(p.dashed ? dash : []);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = p.width;
        ctx.stroke(p.path);
        break;
    }
  }
  ctx.setLineDash([]);
};

const drawImage = (ctx: CanvasRenderingContext2D, el: ImageElement, opts: RenderOptions) => {
  const img = getImage(el.fileId, opts.files);
  ctx.save();
  if (el.roundness === 'round') {
    roundRectPath(ctx, el.x, el.y, el.width, el.height, cornerRadius(el.width, el.height) * 0.6);
    ctx.clip();
  }
  if (img) {
    ctx.drawImage(img, el.x, el.y, el.width, el.height);
  } else {
    // Placeholder while the image decodes (or if its data is missing).
    ctx.fillStyle = opts.theme === 'dark' ? '#2a2a30' : '#ece8df';
    ctx.fillRect(el.x, el.y, el.width, el.height);
    ctx.strokeStyle = opts.theme === 'dark' ? '#55555f' : '#bdb6a8';
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(el.x + 1, el.y + 1, el.width - 2, el.height - 2);
    ctx.setLineDash([]);
  }
  ctx.restore();
};

export const renderElement = (
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  opts: RenderOptions,
) => {
  ctx.save();
  ctx.globalAlpha = (el.opacity / 100) * (opts.fadedIds?.has(el.id) ? 0.25 : 1);
  const [cx, cy] = getCenter(el);
  if (el.angle) {
    ctx.translate(cx, cy);
    ctx.rotate(el.angle);
    ctx.translate(-cx, -cy);
  }
  if (isText(el)) {
    if (opts.hiddenLabelId !== el.id) drawLabel(ctx, el, opts, false);
  } else if (isImage(el)) {
    drawImage(ctx, el, opts);
  } else {
    ctx.save();
    ctx.translate(el.x, el.y);
    drawPaths(ctx, el, opts);
    ctx.restore();
    if (el.text && opts.hiddenLabelId !== el.id) {
      if (isShape(el)) drawLabel(ctx, el, opts, false);
    }
  }
  ctx.restore();
  // Arrow labels are drawn unrotated, with a backdrop that interrupts the line.
  if (isLinear(el) && el.text && opts.hiddenLabelId !== el.id) {
    ctx.save();
    ctx.globalAlpha = el.opacity / 100;
    drawLabel(ctx, el, opts, true);
    ctx.restore();
  }
};

export const renderElements = (
  ctx: CanvasRenderingContext2D,
  elements: readonly SceneElement[],
  opts: RenderOptions,
  visible?: Bounds,
) => {
  for (const el of elements) {
    if (opts.hiddenIds?.has(el.id)) continue;
    if (visible && !boundsIntersect(visible, inflate(getElementBounds(el), 40))) continue;
    renderElement(ctx, el, opts);
  }
};

const inflate = (b: Bounds, n: number): Bounds => ({
  minX: b.minX - n,
  minY: b.minY - n,
  maxX: b.maxX + n,
  maxY: b.maxY + n,
});

// ---------------------------------------------------------------------------------------------
// Background & grid
// ---------------------------------------------------------------------------------------------

export const GRID_SIZE = 20;

export const renderGrid = (
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  width: number,
  height: number,
  theme: ThemeMode,
) => {
  const { zoom, scrollX, scrollY } = viewport;
  let step = GRID_SIZE;
  while (step * zoom < 14) step *= 2;
  const major = step * 5;
  const startX = Math.floor(-scrollX / step) * step;
  const startY = Math.floor(-scrollY / step) * step;
  const endX = -scrollX + width / zoom;
  const endY = -scrollY + height / zoom;
  const minor = theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(40,30,20,0.13)';
  const majorColor = theme === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(40,30,20,0.26)';
  const r = Math.max(0.8, Math.min(1.4, zoom)) / zoom;
  for (let x = startX; x <= endX; x += step) {
    for (let y = startY; y <= endY; y += step) {
      const isMajor = x % major === 0 && y % major === 0;
      ctx.fillStyle = isMajor ? majorColor : minor;
      ctx.beginPath();
      ctx.arc(x, y, isMajor ? r * 1.6 : r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

export const visibleSceneBounds = (viewport: Viewport, width: number, height: number): Bounds => ({
  minX: -viewport.scrollX,
  minY: -viewport.scrollY,
  maxX: -viewport.scrollX + width / viewport.zoom,
  maxY: -viewport.scrollY + height / viewport.zoom,
});
