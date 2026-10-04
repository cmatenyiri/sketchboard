import type {
  Bounds,
  FreedrawElement,
  LinearElement,
  Point,
  SceneElement,
  TextElement,
  TransformHandle,
} from '../types';
import {
  getCenter,
  getCommonBounds,
  isFreedraw,
  isImage,
  isLinear,
  isText,
  normalizePoints,
} from './elements';
import { normalizeAngle, rotatePoint, snapAngle } from './math';
import { measureText } from './text';

/** The frame drawn around the selection; single elements keep their rotation. */
export interface SelectionFrame {
  cx: number;
  cy: number;
  width: number;
  height: number;
  angle: number;
  single: SceneElement | null;
}

export const getSelectionFrame = (selected: readonly SceneElement[]): SelectionFrame | null => {
  if (!selected.length) return null;
  if (selected.length === 1 && !isLinear(selected[0]) && !isFreedraw(selected[0])) {
    const el = selected[0];
    const [cx, cy] = getCenter(el);
    return { cx, cy, width: el.width, height: el.height, angle: el.angle, single: el };
  }
  const b = getCommonBounds(selected)!;
  return {
    cx: (b.minX + b.maxX) / 2,
    cy: (b.minY + b.maxY) / 2,
    width: b.maxX - b.minX,
    height: b.maxY - b.minY,
    angle: 0,
    single: selected.length === 1 ? selected[0] : null,
  };
};

export type HandleMap = Partial<Record<TransformHandle, Point>>;

/** Handle centers in scene coordinates. */
export const getTransformHandles = (frame: SelectionFrame, zoom: number): HandleMap => {
  const pad = 6 / zoom;
  const hw = frame.width / 2 + pad;
  const hh = frame.height / 2 + pad;
  const c: Point = [frame.cx, frame.cy];
  const local: Record<TransformHandle, Point> = {
    nw: [-hw, -hh],
    n: [0, -hh],
    ne: [hw, -hh],
    e: [hw, 0],
    se: [hw, hh],
    s: [0, hh],
    sw: [-hw, hh],
    w: [-hw, 0],
    rotation: [0, -hh - 22 / zoom],
  };
  const isTextOnly = frame.single && isText(frame.single);
  const screenW = frame.width * zoom;
  const screenH = frame.height * zoom;
  const result: HandleMap = {};
  for (const [key, [lx, ly]] of Object.entries(local) as [TransformHandle, Point][]) {
    // Hide side handles when they'd crowd small selections, and on text (which scales uniformly).
    if ((key === 'n' || key === 's') && (screenW < 40 || isTextOnly)) continue;
    if ((key === 'e' || key === 'w') && (screenH < 40 || isTextOnly)) continue;
    result[key] = rotatePoint([c[0] + lx, c[1] + ly], c, frame.angle);
  }
  return result;
};

export const hitTestHandles = (
  handles: HandleMap,
  p: Point,
  zoom: number,
): TransformHandle | null => {
  const r = 9 / zoom;
  // Rotation first so it wins when overlapping the top handle on tiny selections.
  const order: TransformHandle[] = ['rotation', 'nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'];
  for (const key of order) {
    const h = handles[key];
    if (h && Math.abs(p[0] - h[0]) <= r && Math.abs(p[1] - h[1]) <= r) return key;
  }
  return null;
};

const CURSORS = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'];
const HANDLE_ANGLE: Record<string, number> = { n: 0, ne: 1, e: 2, se: 3, s: 0, sw: 1, w: 2, nw: 3 };

export const cursorForHandle = (handle: TransformHandle, angle: number) => {
  if (handle === 'rotation') return 'grab';
  const steps = Math.round(normalizeAngle(angle) / (Math.PI / 4));
  return CURSORS[(HANDLE_ANGLE[handle] + steps) % 4];
};

// ---------------------------------------------------------------------------------------------
// Resizing
// ---------------------------------------------------------------------------------------------

interface ResizeModifiers {
  keepAspect: boolean;
  fromCenter: boolean;
}

const scalePoints = <T extends LinearElement | FreedrawElement>(
  el: T,
  origin: Point,
  sx: number,
  sy: number,
  translate: Point,
): T => {
  const points = el.points.map((p) => {
    const ax = el.x + p[0];
    const ay = el.y + p[1];
    const nx = translate[0] + origin[0] + (ax - origin[0]) * sx;
    const ny = translate[1] + origin[1] + (ay - origin[1]) * sy;
    return p.length === 3 ? [nx, ny, p[2]] : [nx, ny];
  }) as T['points'];
  return normalizePoints({ ...el, x: 0, y: 0, points, version: el.version + 1 });
};

/** Computes a new (unrotated) box for the frame being dragged by `handle`. */
const resizeBox = (
  box: Bounds,
  handle: TransformHandle,
  p: Point,
  mods: ResizeModifiers,
): { box: Bounds; flipX: boolean; flipY: boolean } => {
  let { minX: x1, minY: y1, maxX: x2, maxY: y2 } = box;
  const ow = x2 - x1 || 1;
  const oh = y2 - y1 || 1;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  if (handle.includes('n')) y1 = p[1];
  if (handle.includes('s')) y2 = p[1];
  if (handle.includes('w')) x1 = p[0];
  if (handle.includes('e')) x2 = p[0];
  if (mods.fromCenter) {
    if (handle.includes('n')) y2 = cy + (cy - y1);
    if (handle.includes('s')) y1 = cy - (y2 - cy);
    if (handle.includes('w')) x2 = cx + (cx - x1);
    if (handle.includes('e')) x1 = cx - (x2 - cx);
  }
  if (mods.keepAspect) {
    const ratio = ow / oh;
    const isCorner = handle.length === 2;
    if (isCorner) {
      const sw = (x2 - x1) / ow;
      const sh = (y2 - y1) / oh;
      const s = Math.max(Math.abs(sw), Math.abs(sh));
      const nw = ow * s * Math.sign(sw || 1);
      const nh = oh * s * Math.sign(sh || 1);
      if (mods.fromCenter) {
        x1 = cx - nw / 2;
        x2 = cx + nw / 2;
        y1 = cy - nh / 2;
        y2 = cy + nh / 2;
      } else {
        if (handle.includes('w')) x1 = x2 - nw;
        else x2 = x1 + nw;
        if (handle.includes('n')) y1 = y2 - nh;
        else y2 = y1 + nh;
      }
    } else if (handle === 'e' || handle === 'w') {
      const nh = Math.abs(x2 - x1) / ratio;
      y1 = cy - nh / 2;
      y2 = cy + nh / 2;
    } else {
      const nw = Math.abs(y2 - y1) * ratio;
      x1 = cx - nw / 2;
      x2 = cx + nw / 2;
    }
  }
  return {
    box: {
      minX: Math.min(x1, x2),
      minY: Math.min(y1, y2),
      maxX: Math.max(x1, x2),
      maxY: Math.max(y1, y2),
    },
    flipX: x2 < x1,
    flipY: y2 < y1,
  };
};

const resizeSingle = (
  el: SceneElement,
  handle: TransformHandle,
  pointer: Point,
  mods: ResizeModifiers,
): SceneElement => {
  const center = getCenter(el);
  const local = rotatePoint(pointer, center, -el.angle);
  // Text always scales uniformly; images do by default and Shift frees them (inverse of shapes).
  const keepAspect = isText(el) || (isImage(el) ? !mods.keepAspect : mods.keepAspect);
  const { box, flipX, flipY } = resizeBox(
    { minX: el.x, minY: el.y, maxX: el.x + el.width, maxY: el.y + el.height },
    handle,
    local,
    { ...mods, keepAspect },
  );
  let w = Math.max(1, box.maxX - box.minX);
  let h = Math.max(1, box.maxY - box.minY);
  if (isText(el)) {
    const scale = h / (el.height || 1);
    const fontSize = Math.max(4, Math.round(el.fontSize * scale * 10) / 10);
    const m = measureText(el.text, el.fontFamily, fontSize);
    w = m.width;
    h = m.height;
    // Keep the anchor corner fixed.
    if (handle.includes('w')) box.minX = box.maxX - w;
    if (handle.includes('n')) box.minY = box.maxY - h;
    box.maxX = box.minX + w;
    box.maxY = box.minY + h;
    const lc: Point = [box.minX + w / 2, box.minY + h / 2];
    const gc = rotatePoint(lc, center, el.angle);
    return {
      ...el,
      fontSize,
      x: gc[0] - w / 2,
      y: gc[1] - h / 2,
      width: w,
      height: h,
      version: el.version + 1,
    } as TextElement;
  }
  const lc: Point = [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2];
  const gc = rotatePoint(lc, center, el.angle);
  if (isFreedraw(el) || isLinear(el)) {
    const sx = (el.width ? w / el.width : 1) * (flipX ? -1 : 1);
    const sy = (el.height ? h / el.height : 1) * (flipY ? -1 : 1);
    const origin: Point = [el.x + el.width / 2, el.y + el.height / 2];
    return scalePoints(el, origin, sx, sy, [gc[0] - origin[0], gc[1] - origin[1]]);
  }
  return {
    ...el,
    x: gc[0] - w / 2,
    y: gc[1] - h / 2,
    width: w,
    height: h,
    version: el.version + 1,
  };
};

export const resizeElements = (
  originals: readonly SceneElement[],
  handle: TransformHandle,
  pointer: Point,
  mods: ResizeModifiers,
): SceneElement[] => {
  if (originals.length === 1 && !isLinear(originals[0])) {
    return [resizeSingle(originals[0], handle, pointer, mods)];
  }
  const common = getCommonBounds(originals)!;
  const hasUniform = originals.some((e) => isText(e) || isImage(e));
  const { box } = resizeBox(common, handle, pointer, {
    ...mods,
    keepAspect: mods.keepAspect || hasUniform,
  });
  const ow = common.maxX - common.minX || 1;
  const oh = common.maxY - common.minY || 1;
  const sx = (box.maxX - box.minX) / ow;
  const sy = (box.maxY - box.minY) / oh;
  const mapPoint = (p: Point): Point => [
    box.minX + (p[0] - common.minX) * sx,
    box.minY + (p[1] - common.minY) * sy,
  ];
  return originals.map((el) => {
    if (isLinear(el) || isFreedraw(el)) {
      const origin: Point = [common.minX, common.minY];
      return scalePoints(el, origin, sx, sy, [box.minX - common.minX, box.minY - common.minY]);
    }
    const [cx, cy] = mapPoint(getCenter(el));
    if (isText(el)) {
      const fontSize = Math.max(4, Math.round(el.fontSize * sx * 10) / 10);
      const m = measureText(el.text, el.fontFamily, fontSize);
      return {
        ...el,
        fontSize,
        x: cx - m.width / 2,
        y: cy - m.height / 2,
        width: m.width,
        height: m.height,
        version: el.version + 1,
      };
    }
    const w = Math.max(1, el.width * sx);
    const h = Math.max(1, el.height * sy);
    return { ...el, x: cx - w / 2, y: cy - h / 2, width: w, height: h, version: el.version + 1 };
  });
};

// ---------------------------------------------------------------------------------------------
// Rotation
// ---------------------------------------------------------------------------------------------

export const rotateElements = (
  originals: readonly SceneElement[],
  frame: SelectionFrame,
  start: Point,
  pointer: Point,
  snap: boolean,
): SceneElement[] => {
  const c: Point = [frame.cx, frame.cy];
  const startAngle = Math.atan2(start[1] - c[1], start[0] - c[0]);
  let delta = Math.atan2(pointer[1] - c[1], pointer[0] - c[0]) - startAngle;
  if (snap) delta = snapAngle(frame.angle + delta) - frame.angle;
  return originals.map((el) => {
    if (isLinear(el) || isFreedraw(el)) {
      const points = el.points.map((p) => {
        const [nx, ny] = rotatePoint([el.x + p[0], el.y + p[1]], c, delta);
        return p.length === 3 ? [nx, ny, p[2]] : [nx, ny];
      }) as typeof el.points;
      return normalizePoints({ ...el, x: 0, y: 0, points, version: el.version + 1 } as typeof el);
    }
    const [ex, ey] = rotatePoint(getCenter(el), c, delta);
    return {
      ...el,
      x: ex - el.width / 2,
      y: ey - el.height / 2,
      angle: normalizeAngle(el.angle + delta),
      version: el.version + 1,
    };
  });
};

// ---------------------------------------------------------------------------------------------
// Flipping
// ---------------------------------------------------------------------------------------------

export const flipElements = (
  elements: readonly SceneElement[],
  axis: 'horizontal' | 'vertical',
): SceneElement[] => {
  const b = getCommonBounds(elements);
  if (!b) return [...elements];
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const h = axis === 'horizontal';
  return elements.map((el) => {
    if (isLinear(el) || isFreedraw(el)) {
      const points = el.points.map((p) => {
        const ax = el.x + p[0];
        const ay = el.y + p[1];
        const nx = h ? 2 * cx - ax : ax;
        const ny = h ? ay : 2 * cy - ay;
        return p.length === 3 ? [nx, ny, p[2]] : [nx, ny];
      }) as typeof el.points;
      return normalizePoints({ ...el, x: 0, y: 0, points, version: el.version + 1 } as typeof el);
    }
    const [ex, ey] = getCenter(el);
    const ncx = h ? 2 * cx - ex : ex;
    const ncy = h ? ey : 2 * cy - ey;
    return {
      ...el,
      x: ncx - el.width / 2,
      y: ncy - el.height / 2,
      angle: normalizeAngle(-el.angle),
      version: el.version + 1,
    };
  });
};
