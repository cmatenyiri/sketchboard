import type { Bounds, Point, SceneElement } from '../types';
import { getElementBounds } from './elements';
import { boundsIntersect } from './math';
import { GRID_SIZE } from './renderer';

export interface SnapLine {
  axis: 'x' | 'y';
  /** The x (for vertical lines) or y (for horizontal lines) coordinate. */
  value: number;
  from: number;
  to: number;
}

const xs = (b: Bounds) => [b.minX, (b.minX + b.maxX) / 2, b.maxX];
const ys = (b: Bounds) => [b.minY, (b.minY + b.maxY) / 2, b.maxY];

/**
 * Finds the smallest offset that aligns the moving bounds' edges/centers with nearby elements,
 * and returns guide lines to visualize the alignment.
 */
export const snapToObjects = (
  moving: Bounds,
  others: readonly SceneElement[],
  visible: Bounds,
  threshold: number,
): { offset: Point; lines: SnapLine[] } => {
  const candidates = others.map(getElementBounds).filter((b) => boundsIntersect(b, visible));
  let bestX: { d: number; target: number; source: number } | null = null;
  let bestY: { d: number; target: number; source: number } | null = null;
  for (const b of candidates) {
    for (const source of xs(moving)) {
      for (const target of xs(b)) {
        const d = target - source;
        if (Math.abs(d) <= threshold && (!bestX || Math.abs(d) < Math.abs(bestX.d)))
          bestX = { d, target, source };
      }
    }
    for (const source of ys(moving)) {
      for (const target of ys(b)) {
        const d = target - source;
        if (Math.abs(d) <= threshold && (!bestY || Math.abs(d) < Math.abs(bestY.d)))
          bestY = { d, target, source };
      }
    }
  }
  const offset: Point = [bestX?.d ?? 0, bestY?.d ?? 0];
  const snapped: Bounds = {
    minX: moving.minX + offset[0],
    maxX: moving.maxX + offset[0],
    minY: moving.minY + offset[1],
    maxY: moving.maxY + offset[1],
  };
  const lines: SnapLine[] = [];
  const eps = 0.5;
  if (bestX) {
    const value = bestX.target;
    let from = snapped.minY;
    let to = snapped.maxY;
    for (const b of candidates) {
      if (xs(b).some((x) => Math.abs(x - value) < eps)) {
        from = Math.min(from, b.minY);
        to = Math.max(to, b.maxY);
      }
    }
    lines.push({ axis: 'x', value, from, to });
  }
  if (bestY) {
    const value = bestY.target;
    let from = snapped.minX;
    let to = snapped.maxX;
    for (const b of candidates) {
      if (ys(b).some((y) => Math.abs(y - value) < eps)) {
        from = Math.min(from, b.minX);
        to = Math.max(to, b.maxX);
      }
    }
    lines.push({ axis: 'y', value, from, to });
  }
  return { offset, lines };
};

export const snapToGrid = (v: number, size = GRID_SIZE) => Math.round(v / size) * size;
export const snapPointToGrid = (p: Point, size = GRID_SIZE): Point => [
  snapToGrid(p[0], size),
  snapToGrid(p[1], size),
];
