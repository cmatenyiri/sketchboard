import type { Bounds, Point, SceneElement } from '../types';
import { TRANSPARENT } from './colors';
import {
  getCenter,
  getElementBounds,
  getLinearPath,
  getTextLayout,
  isFreedraw,
  isImage,
  isLinear,
  isText,
} from './elements';
import {
  boundsContain,
  boundsIntersect,
  distanceToSegment,
  pointInPolygon,
  rotatePoint,
  segmentsIntersect,
} from './math';

const toLocal = (el: SceneElement, p: Point): Point => rotatePoint(p, getCenter(el), -el.angle);

const distanceToPolyline = (p: Point, pts: Point[]) => {
  let min = Infinity;
  for (let i = 1; i < pts.length; i++)
    min = Math.min(min, distanceToSegment(p, pts[i - 1], pts[i]));
  if (pts.length === 1) min = Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]);
  return min;
};

const diamondPoints = (el: SceneElement): Point[] => [
  [el.x + el.width / 2, el.y],
  [el.x + el.width, el.y + el.height / 2],
  [el.x + el.width / 2, el.y + el.height],
  [el.x, el.y + el.height / 2],
];

const isInsideLabel = (el: SceneElement, local: Point) => {
  if (!el.text) return false;
  const layout = getTextLayout(el);
  if (!layout) return false;
  return (
    local[0] >= layout.x &&
    local[0] <= layout.x + layout.width &&
    local[1] >= layout.y &&
    local[1] <= layout.y + layout.height
  );
};

/**
 * Whether a scene point hits the element. Shapes without a fill are only hit on their outline
 * (or label), so you can click "through" an empty frame onto what's inside it.
 */
export const hitTestElement = (el: SceneElement, p: Point, threshold: number): boolean => {
  const local = toLocal(el, p);
  const t = threshold + el.strokeWidth / 2;
  if (isLinear(el)) {
    const pts = getLinearPath(el).map(([x, y]) => [el.x + x, el.y + y] as Point);
    return distanceToPolyline(p, pts) <= t || isInsideLabel(el, p);
  }
  if (isFreedraw(el)) {
    const pts = el.points.map(([x, y]) => [el.x + x, el.y + y] as Point);
    return distanceToPolyline(p, pts) <= t + el.strokeWidth;
  }
  if (isText(el) || isImage(el)) {
    return (
      local[0] >= el.x - threshold &&
      local[0] <= el.x + el.width + threshold &&
      local[1] >= el.y - threshold &&
      local[1] <= el.y + el.height + threshold
    );
  }
  const filled = el.backgroundColor !== TRANSPARENT;
  if (isInsideLabel(el, local)) return true;
  if (el.type === 'rectangle') {
    const corners: Point[] = [
      [el.x, el.y],
      [el.x + el.width, el.y],
      [el.x + el.width, el.y + el.height],
      [el.x, el.y + el.height],
    ];
    if (filled && pointInPolygon(local, corners)) return true;
    return distanceToPolyline(local, [...corners, corners[0]]) <= t;
  }
  if (el.type === 'diamond') {
    const pts = diamondPoints(el);
    if (filled && pointInPolygon(local, pts)) return true;
    return distanceToPolyline(local, [...pts, pts[0]]) <= t;
  }
  if (el.type === 'ellipse') {
    const [cx, cy] = getCenter(el);
    const a = Math.abs(el.width / 2);
    const b = Math.abs(el.height / 2);
    if (a < 1 || b < 1) return Math.hypot(local[0] - cx, local[1] - cy) <= t;
    const dx = local[0] - cx;
    const dy = local[1] - cy;
    const norm = Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b));
    if (filled && norm <= 1) return true;
    // Approximate distance to the outline.
    const angle = Math.atan2(dy, dx);
    const ex = a * Math.cos(angle);
    const ey = b * Math.sin(angle);
    const r = Math.hypot(ex, ey);
    return Math.abs(Math.hypot(dx, dy) - r) <= t;
  }
  return false;
};

/** Point-in-shape test with padding that respects ellipse/diamond outlines (used for binding). */
export const isPointInsideElementShape = (el: SceneElement, p: Point, padding: number) => {
  const local = toLocal(el, p);
  const [cx, cy] = getCenter(el);
  const hw = Math.abs(el.width) / 2 + padding;
  const hh = Math.abs(el.height) / 2 + padding;
  const dx = local[0] - cx;
  const dy = local[1] - cy;
  if (el.type === 'ellipse') return (dx * dx) / (hw * hw) + (dy * dy) / (hh * hh) <= 1;
  if (el.type === 'diamond') return Math.abs(dx) / hw + Math.abs(dy) / hh <= 1;
  return Math.abs(dx) <= hw && Math.abs(dy) <= hh;
};

export const getElementAtPoint = (
  elements: readonly SceneElement[],
  p: Point,
  threshold: number,
  opts: { includeLocked?: boolean } = {},
): SceneElement | null => {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.locked && !opts.includeLocked) continue;
    const b = getElementBounds(el);
    if (
      p[0] < b.minX - threshold * 2 ||
      p[0] > b.maxX + threshold * 2 ||
      p[1] < b.minY - threshold * 2 ||
      p[1] > b.maxY + threshold * 2
    )
      continue;
    if (hitTestElement(el, p, threshold)) return el;
  }
  return null;
};

export const getElementsInBox = (elements: readonly SceneElement[], box: Bounds) =>
  elements.filter((el) => !el.locked && boundsContain(box, getElementBounds(el)));

/** Elements whose geometry crosses a segment — used by the eraser trail. */
export const getElementsCrossingSegment = (
  elements: readonly SceneElement[],
  a: Point,
  b: Point,
  threshold: number,
) => {
  const segBounds: Bounds = {
    minX: Math.min(a[0], b[0]) - threshold,
    minY: Math.min(a[1], b[1]) - threshold,
    maxX: Math.max(a[0], b[0]) + threshold,
    maxY: Math.max(a[1], b[1]) + threshold,
  };
  return elements.filter((el) => {
    if (el.locked) return false;
    if (!boundsIntersect(segBounds, getElementBounds(el))) return false;
    if (hitTestElement(el, b, threshold) || hitTestElement(el, a, threshold)) return true;
    if (isFreedraw(el) || isLinear(el)) {
      const pts = isLinear(el)
        ? getLinearPath(el).map(([x, y]) => [el.x + x, el.y + y] as Point)
        : el.points.map(([x, y]) => [el.x + x, el.y + y] as Point);
      for (let i = 1; i < pts.length; i++)
        if (segmentsIntersect(a, b, pts[i - 1], pts[i])) return true;
    }
    return false;
  });
};
