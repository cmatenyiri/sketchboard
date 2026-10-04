import type { Bounds, Point, Viewport } from '../types';
import { clamp } from './math';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 30;

export const screenToScene = (p: Point, v: Viewport): Point => [
  p[0] / v.zoom - v.scrollX,
  p[1] / v.zoom - v.scrollY,
];

/** Zooms while keeping the scene point under `anchor` (screen coords) fixed. */
export const zoomAt = (v: Viewport, nextZoom: number, anchor: Point): Viewport => {
  const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  const [sx, sy] = screenToScene(anchor, v);
  return { zoom, scrollX: anchor[0] / zoom - sx, scrollY: anchor[1] / zoom - sy };
};

/** Viewport that fits `bounds` into a screen of the given size. */
export const fitBounds = (
  bounds: Bounds,
  width: number,
  height: number,
  opts: { padding?: number; maxZoom?: number } = {},
): Viewport => {
  const padding = opts.padding ?? 80;
  const bw = Math.max(1, bounds.maxX - bounds.minX);
  const bh = Math.max(1, bounds.maxY - bounds.minY);
  const zoom = clamp(
    Math.min((width - padding * 2) / bw, (height - padding * 2) / bh),
    MIN_ZOOM,
    opts.maxZoom ?? 1,
  );
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return { zoom, scrollX: width / 2 / zoom - cx, scrollY: height / 2 / zoom - cy };
};

/** Steps used by the zoom buttons / keyboard shortcuts. */
export const nextZoomStep = (zoom: number, dir: 1 | -1) => {
  const factor = dir > 0 ? 1.2 : 1 / 1.2;
  const z = zoom * factor;
  // Snap to 100% when crossing it so users can easily get back to actual size.
  if ((zoom < 1 && z > 1) || (zoom > 1 && z < 1)) return 1;
  return clamp(z, MIN_ZOOM, MAX_ZOOM);
};
