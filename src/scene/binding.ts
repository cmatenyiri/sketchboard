import type { LinearElement, Point, SceneElement } from '../types';
import { getAbsolutePoints, getCenter, isBindable, isLinear, normalizePoints } from './elements';
import { isPointInsideElementShape } from './hitTest';
import { rotatePoint } from './math';

export const BIND_GAP = 6;

/** Topmost element an arrow endpoint at `p` should attach to. */
export const getBindableElementAt = (
  elements: readonly SceneElement[],
  p: Point,
  zoom: number,
  excludeIds: ReadonlySet<string> = new Set(),
): SceneElement | null => {
  const padding = 14 / zoom;
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (!isBindable(el) || excludeIds.has(el.id)) continue;
    if (isPointInsideElementShape(el, p, padding)) return el;
  }
  return null;
};

/** Point on the element's outline (plus a small gap) in the direction of `toward`. */
export const getOutlinePoint = (el: SceneElement, toward: Point, gap = BIND_GAP): Point => {
  const center = getCenter(el);
  const local = rotatePoint(toward, center, -el.angle);
  let dx = local[0] - center[0];
  let dy = local[1] - center[1];
  if (Math.hypot(dx, dy) < 1e-6) {
    dx = 1;
    dy = 0;
  }
  const hw = Math.abs(el.width) / 2 + gap;
  const hh = Math.abs(el.height) / 2 + gap;
  let t: number;
  if (el.type === 'ellipse') {
    t = 1 / Math.sqrt((dx / hw) ** 2 + (dy / hh) ** 2);
  } else if (el.type === 'diamond') {
    t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
  } else {
    t = Math.min(
      Math.abs(dx) > 1e-9 ? hw / Math.abs(dx) : Infinity,
      Math.abs(dy) > 1e-9 ? hh / Math.abs(dy) : Infinity,
    );
  }
  return rotatePoint([center[0] + dx * t, center[1] + dy * t], center, el.angle);
};

/** Re-anchors the bound endpoints of a line/arrow to the outlines of the shapes they attach to. */
export const updateLinearBindings = (
  el: LinearElement,
  byId: ReadonlyMap<string, SceneElement>,
): LinearElement => {
  if (!el.startBinding && !el.endBinding) return el;
  const startEl = el.startBinding ? byId.get(el.startBinding.elementId) : undefined;
  const endEl = el.endBinding ? byId.get(el.endBinding.elementId) : undefined;
  if (!startEl && !endEl) return el;
  const abs = getAbsolutePoints(el);
  const n = abs.length;
  if (n < 2) return el;
  const straight = n === 2;
  const next = [...abs];
  if (startEl) {
    const toward = straight && endEl ? getCenter(endEl) : abs[1];
    next[0] = getOutlinePoint(startEl, toward);
  }
  if (endEl) {
    const toward = straight && startEl ? getCenter(startEl) : abs[n - 2];
    next[n - 1] = getOutlinePoint(endEl, toward);
  }
  // Degenerate case: both ends on overlapping shapes.
  if (startEl && endEl && startEl.id === endEl.id && straight) return el;
  return normalizePoints({
    ...el,
    x: 0,
    y: 0,
    points: next,
    version: el.version + 1,
  });
};

/** Updates every arrow attached to one of `changedIds`. Returns the same array if nothing moved. */
export const updateBoundArrows = (
  elements: SceneElement[],
  changedIds: ReadonlySet<string>,
): SceneElement[] => {
  if (!changedIds.size) return elements;
  let byId: Map<string, SceneElement> | null = null;
  let changed = false;
  const result = elements.map((el) => {
    if (!isLinear(el)) return el;
    const s = el.startBinding?.elementId;
    const e = el.endBinding?.elementId;
    if (!(s && changedIds.has(s)) && !(e && changedIds.has(e))) return el;
    byId ??= new Map(elements.map((x) => [x.id, x]));
    changed = true;
    return updateLinearBindings(el, byId);
  });
  return changed ? result : elements;
};

/** Drops bindings that point to elements which no longer exist. */
export const cleanupBindings = (elements: SceneElement[]): SceneElement[] => {
  const ids = new Set(elements.map((e) => e.id));
  let changed = false;
  const result = elements.map((el) => {
    if (!isLinear(el)) return el;
    const s = el.startBinding && !ids.has(el.startBinding.elementId);
    const e = el.endBinding && !ids.has(el.endBinding.elementId);
    if (!s && !e) return el;
    changed = true;
    return {
      ...el,
      startBinding: s ? null : el.startBinding,
      endBinding: e ? null : el.endBinding,
      version: el.version + 1,
    };
  });
  return changed ? result : elements;
};
