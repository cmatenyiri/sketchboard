import type {
  Bounds,
  ElementStyle,
  ElementType,
  FreedrawElement,
  ImageElement,
  LinearElement,
  Point,
  SceneElement,
  ShapeElement,
  TextElement,
} from '../types';
import { DEFAULT_STROKE, TRANSPARENT } from './colors';
import { boundsFromPoints, catmullRom, randomId, randomSeed, rotatePoint } from './math';
import { LINE_HEIGHT, measureText, wrapText } from './text';

export const DEFAULT_STYLE: ElementStyle = {
  strokeColor: DEFAULT_STROKE,
  backgroundColor: TRANSPARENT,
  fillStyle: 'hachure',
  strokeWidth: 2,
  strokeStyle: 'solid',
  roughness: 1,
  opacity: 100,
  roundness: 'round',
  fontFamily: 'hand',
  fontSize: 20,
  textAlign: 'center',
  startArrowhead: 'none',
  endArrowhead: 'arrow',
};

export const STYLE_KEYS = Object.keys(DEFAULT_STYLE) as (keyof ElementStyle)[];

export const isShape = (el: SceneElement): el is ShapeElement =>
  el.type === 'rectangle' || el.type === 'diamond' || el.type === 'ellipse';
export const isLinear = (el: SceneElement): el is LinearElement =>
  el.type === 'arrow' || el.type === 'line';
export const isFreedraw = (el: SceneElement): el is FreedrawElement => el.type === 'freedraw';
export const isText = (el: SceneElement): el is TextElement => el.type === 'text';
export const isImage = (el: SceneElement): el is ImageElement => el.type === 'image';
/** Elements an arrow can attach to. */
export const isBindable = (el: SceneElement) => isShape(el) || isText(el) || isImage(el);
/** Elements that can carry a text label. */
export const canHaveLabel = (el: SceneElement) => isShape(el) || isLinear(el);

export const createElement = (
  type: ElementType,
  x: number,
  y: number,
  style: ElementStyle,
  extra: Partial<SceneElement> = {},
): SceneElement => {
  const base = {
    ...style,
    id: randomId(),
    type,
    x,
    y,
    width: 0,
    height: 0,
    angle: 0,
    seed: randomSeed(),
    version: 1,
    groupIds: [],
    locked: false,
  };
  // Lines and arrows default to sharp corners unless the user explicitly picks curved.
  switch (type) {
    case 'arrow':
    case 'line':
      return {
        ...base,
        type,
        points: [[0, 0]],
        startBinding: null,
        endBinding: null,
        startArrowhead: type === 'arrow' ? style.startArrowhead : 'none',
        endArrowhead: type === 'arrow' ? style.endArrowhead : 'none',
        ...extra,
      } as LinearElement;
    case 'freedraw':
      return {
        ...base,
        type,
        points: [[0, 0, 0.5]],
        simulatePressure: true,
        backgroundColor: TRANSPARENT,
        ...extra,
      } as FreedrawElement;
    case 'text':
      return { ...base, type, text: '', ...extra } as TextElement;
    case 'image':
      return { ...base, type, fileId: '', ...extra } as ImageElement;
    default:
      return { ...base, type, ...extra } as ShapeElement;
  }
};

export const getCenter = (el: SceneElement): Point => [el.x + el.width / 2, el.y + el.height / 2];

/** Corner points of the element's box, rotated into scene space. */
export const getCorners = (el: SceneElement): Point[] => {
  const c = getCenter(el);
  const pts: Point[] = [
    [el.x, el.y],
    [el.x + el.width, el.y],
    [el.x + el.width, el.y + el.height],
    [el.x, el.y + el.height],
  ];
  return pts.map((p) => rotatePoint(p, c, el.angle));
};

export const getElementBounds = (el: SceneElement): Bounds => {
  if (isLinear(el) || isFreedraw(el)) {
    const pts =
      isLinear(el) && el.roundness === 'round' && el.points.length > 2
        ? catmullRom(el.points as Point[], 8)
        : (el.points.map((p) => [p[0], p[1]]) as Point[]);
    const b = boundsFromPoints(pts);
    return { minX: el.x + b.minX, minY: el.y + b.minY, maxX: el.x + b.maxX, maxY: el.y + b.maxY };
  }
  if (isShape(el) && el.type === 'ellipse' && el.angle) {
    // Exact AABB of a rotated ellipse.
    const a = el.width / 2;
    const b = el.height / 2;
    const cos = Math.cos(el.angle);
    const sin = Math.sin(el.angle);
    const hw = Math.sqrt(a * a * cos * cos + b * b * sin * sin);
    const hh = Math.sqrt(a * a * sin * sin + b * b * cos * cos);
    const [cx, cy] = getCenter(el);
    return { minX: cx - hw, minY: cy - hh, maxX: cx + hw, maxY: cy + hh };
  }
  return boundsFromPoints(getCorners(el));
};

export const getCommonBounds = (elements: readonly SceneElement[]): Bounds | null => {
  if (!elements.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    const b = getElementBounds(el);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  return { minX, minY, maxX, maxY };
};

/**
 * Shifts the element so its (x, y, width, height) tightly wraps its points, keeping the points
 * at the same absolute position. Linear/freedraw elements never carry a rotation angle.
 */
export const normalizePoints = <T extends LinearElement | FreedrawElement>(el: T): T => {
  const b = boundsFromPoints(el.points.map((p) => [p[0], p[1]] as Point));
  const points = el.points.map((p) =>
    p.length === 3 ? [p[0] - b.minX, p[1] - b.minY, p[2]] : [p[0] - b.minX, p[1] - b.minY],
  ) as T['points'];
  return {
    ...el,
    x: el.x + b.minX,
    y: el.y + b.minY,
    width: b.maxX - b.minX,
    height: b.maxY - b.minY,
    points,
  };
};

export const getAbsolutePoints = (el: LinearElement): Point[] =>
  el.points.map(([px, py]) => [el.x + px, el.y + py]);

/** The visible path of a line/arrow (curved arrows are sampled into a dense polyline). */
export const getLinearPath = (el: LinearElement): Point[] => {
  const pts = el.points as Point[];
  return el.roundness === 'round' && pts.length > 2 ? catmullRom(pts, 12) : pts;
};

// ---------------------------------------------------------------------------------------------
// Text & labels
// ---------------------------------------------------------------------------------------------

export const LABEL_PADDING = 10;

/** Width available for a label inside a container shape. */
export const getLabelMaxWidth = (el: SceneElement) => {
  const w = Math.abs(el.width);
  switch (el.type) {
    case 'ellipse':
      return Math.max(20, w / Math.SQRT2 - LABEL_PADDING);
    case 'diamond':
      return Math.max(20, w / 2 - LABEL_PADDING / 2);
    case 'rectangle':
      return Math.max(20, w - LABEL_PADDING * 2);
    default:
      return 320;
  }
};

export const getLabelMaxHeight = (el: SceneElement) => {
  const h = Math.abs(el.height);
  switch (el.type) {
    case 'ellipse':
      return h / Math.SQRT2 - LABEL_PADDING;
    case 'diamond':
      return h / 2 - LABEL_PADDING / 2;
    default:
      return h - LABEL_PADDING * 2;
  }
};

export interface TextLayout {
  lines: string[];
  /** Unrotated box of the text block in scene coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
  lineHeight: number;
}

export const getTextLayout = (el: SceneElement): TextLayout | null => {
  const text = el.text ?? '';
  if (!text && !isText(el)) return null;
  const lineHeight = el.fontSize * LINE_HEIGHT;
  if (isText(el)) {
    const lines = text.split('\n');
    return { lines, x: el.x, y: el.y, width: el.width, height: el.height, lineHeight };
  }
  if (isLinear(el)) {
    const lines = wrapText(text, el.fontFamily, el.fontSize, 280);
    const { width } = measureText(lines.join('\n'), el.fontFamily, el.fontSize);
    const height = lines.length * lineHeight;
    const mid = getLinearLabelAnchor(el);
    return { lines, x: mid[0] - width / 2, y: mid[1] - height / 2, width, height, lineHeight };
  }
  const maxWidth = getLabelMaxWidth(el);
  const lines = wrapText(text, el.fontFamily, el.fontSize, maxWidth);
  const height = lines.length * lineHeight;
  const [cx, cy] = getCenter(el);
  return { lines, x: cx - maxWidth / 2, y: cy - height / 2, width: maxWidth, height, lineHeight };
};

export const getLinearLabelAnchor = (el: LinearElement): Point => {
  const path = getLinearPath(el);
  // Midpoint along the path length.
  let total = 0;
  const segs: number[] = [];
  for (let i = 1; i < path.length; i++) {
    const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    segs.push(l);
    total += l;
  }
  let target = total / 2;
  for (let i = 1; i < path.length; i++) {
    if (target <= segs[i - 1]) {
      const t = segs[i - 1] ? target / segs[i - 1] : 0;
      return [
        el.x + path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t,
        el.y + path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t,
      ];
    }
    target -= segs[i - 1];
  }
  return [el.x + path[0][0], el.y + path[0][1]];
};

/** Re-measures a text element after its content or font changed. */
export const refreshTextDimensions = (el: TextElement): TextElement => {
  const { width, height } = measureText(el.text || ' ', el.fontFamily, el.fontSize);
  // Keep the anchor implied by alignment so text doesn't jump while typing.
  let x = el.x;
  if (el.textAlign === 'center') x = el.x + el.width / 2 - width / 2;
  else if (el.textAlign === 'right') x = el.x + el.width - width;
  return { ...el, x: el.width ? x : el.x, width, height };
};

/** Grows a container so its label fits. */
export const fitContainerToLabel = <T extends SceneElement>(el: T): T => {
  if (!isShape(el) || !el.text) return el;
  const lines = wrapText(el.text, el.fontFamily, el.fontSize, getLabelMaxWidth(el));
  const needed = lines.length * el.fontSize * LINE_HEIGHT;
  const available = getLabelMaxHeight(el);
  if (needed <= available) return el;
  const factor = el.type === 'rectangle' ? 1 : el.type === 'ellipse' ? Math.SQRT2 : 2;
  const newHeight = needed * factor + LABEL_PADDING * 2 * factor;
  return { ...el, y: el.y - (newHeight - el.height) / 2, height: newHeight };
};

export const isElementEmpty = (el: SceneElement) => {
  if (isText(el)) return !el.text.trim();
  if (isLinear(el)) return el.points.length < 2 || (el.width < 2 && el.height < 2);
  if (isFreedraw(el)) return el.points.length < 2 && el.width === 0;
  return Math.abs(el.width) < 3 || Math.abs(el.height) < 3;
};

/** Elements belonging to the same outermost group are selected together. */
export const getOutermostGroupId = (el: SceneElement, editingGroupId: string | null) => {
  if (!el.groupIds.length) return null;
  if (editingGroupId) {
    const idx = el.groupIds.indexOf(editingGroupId);
    if (idx <= 0) return idx === 0 ? null : el.groupIds[el.groupIds.length - 1];
    return el.groupIds[idx - 1];
  }
  return el.groupIds[el.groupIds.length - 1];
};

export const getElementsInGroup = (elements: readonly SceneElement[], groupId: string) =>
  elements.filter((e) => e.groupIds.includes(groupId));

/** Expands a set of ids to include every element sharing their outermost group. */
export const expandSelectionToGroups = (
  elements: readonly SceneElement[],
  ids: Iterable<string>,
  editingGroupId: string | null,
) => {
  const result = new Set(ids);
  const groups = new Set<string>();
  for (const el of elements) {
    if (result.has(el.id)) {
      const g = getOutermostGroupId(el, editingGroupId);
      if (g) groups.add(g);
    }
  }
  if (groups.size) {
    for (const el of elements) if (el.groupIds.some((g) => groups.has(g))) result.add(el.id);
  }
  return result;
};

export const duplicateElements = (
  elements: readonly SceneElement[],
  offset: Point = [16, 16],
): SceneElement[] => {
  const idMap = new Map<string, string>();
  const groupMap = new Map<string, string>();
  for (const el of elements) idMap.set(el.id, randomId());
  const copies = elements.map((el) => {
    const copy = {
      ...el,
      id: idMap.get(el.id)!,
      x: el.x + offset[0],
      y: el.y + offset[1],
      seed: randomSeed(),
      version: 1,
      groupIds: el.groupIds.map((g) => {
        if (!groupMap.has(g)) groupMap.set(g, randomId());
        return groupMap.get(g)!;
      }),
    } as SceneElement;
    if (isLinear(copy)) {
      // Keep bindings only between copied elements.
      const remap = (b: LinearElement['startBinding']) =>
        b && idMap.has(b.elementId) ? { elementId: idMap.get(b.elementId)! } : null;
      copy.startBinding = remap(copy.startBinding);
      copy.endBinding = remap(copy.endBinding);
    }
    return copy;
  });
  return copies;
};
