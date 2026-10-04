import { getStroke } from 'perfect-freehand';
import rough from 'roughjs';
import type { Options } from 'roughjs/bin/core';
import type {
  Arrowhead,
  FreedrawElement,
  LinearElement,
  Point,
  SceneElement,
  ShapeElement,
} from '../types';
import { TRANSPARENT } from './colors';
import { getLinearPath, isFreedraw, isLinear, isShape } from './elements';

/**
 * Which color a cached path is painted with. Geometry is cached independently of colors so that
 * theme switches and recolors don't regenerate the (randomized) hand-drawn strokes.
 */
export type PathRole = 'stroke' | 'fill' | 'fillSketch' | 'headFill' | 'freedraw';

export interface CachedPath {
  d: string;
  path: Path2D;
  role: PathRole;
  width: number;
  dashed: boolean;
}

const generator = rough.generator();

const ROUGHNESS_MAP = [0, 1, 2.2];

const roughOptions = (el: SceneElement, overrides: Options = {}): Options => {
  const minSide = Math.min(Math.abs(el.width), Math.abs(el.height)) || 1;
  // Very small shapes look chaotic at full roughness, so scale it down.
  const sizeFactor = minSide < 30 && !isLinear(el) ? Math.max(0.35, minSide / 30) : 1;
  const roughness = ROUGHNESS_MAP[el.roughness] * sizeFactor;
  const sw = el.strokeWidth;
  const opts: Options = {
    seed: el.seed,
    roughness,
    bowing: el.roughness === 0 ? 0 : 1,
    stroke: '#000',
    strokeWidth: sw,
    fillWeight: sw / 2,
    hachureGap: sw * 4,
    disableMultiStroke: el.strokeStyle !== 'solid' || el.roughness === 0,
    preserveVertices: el.roughness < 2,
    ...overrides,
  };
  if (el.strokeStyle === 'dashed') opts.strokeLineDash = [8, 8 + sw];
  if (el.strokeStyle === 'dotted') opts.strokeLineDash = [1.5, 6 + sw];
  if (el.backgroundColor !== TRANSPARENT && !isLinear(el)) {
    opts.fill = '#000';
    opts.fillStyle = el.fillStyle;
  }
  return opts;
};

const roundedRectPath = (w: number, h: number, r: number) =>
  `M ${r} 0 L ${w - r} 0 Q ${w} 0, ${w} ${r} L ${w} ${h - r} Q ${w} ${h}, ${w - r} ${h} ` +
  `L ${r} ${h} Q 0 ${h}, 0 ${h - r} L 0 ${r} Q 0 0, ${r} 0`;

const roundedDiamondPath = (w: number, h: number, r: number) => {
  const top: Point = [w / 2, 0];
  const right: Point = [w, h / 2];
  const bottom: Point = [w / 2, h];
  const left: Point = [0, h / 2];
  const pts = [top, right, bottom, left];
  const lerp = (a: Point, b: Point, t: number): Point => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ];
  const side = Math.hypot(w / 2, h / 2) || 1;
  const t = Math.min(0.3, r / side);
  let d = '';
  for (let i = 0; i < 4; i++) {
    const prev = pts[(i + 3) % 4];
    const cur = pts[i];
    const next = pts[(i + 1) % 4];
    const a = lerp(cur, prev, t);
    const b = lerp(cur, next, t);
    d += `${i === 0 ? 'M' : 'L'} ${a[0]} ${a[1]} Q ${cur[0]} ${cur[1]}, ${b[0]} ${b[1]} `;
  }
  return d + 'Z';
};

export const cornerRadius = (w: number, h: number) => Math.min(32, Math.min(w, h) * 0.22);

const generateShape = (el: ShapeElement) => {
  const w = Math.abs(el.width);
  const h = Math.abs(el.height);
  const opts = roughOptions(el);
  switch (el.type) {
    case 'rectangle':
      return el.roundness === 'round'
        ? [generator.path(roundedRectPath(w, h, cornerRadius(w, h)), opts)]
        : [generator.rectangle(0, 0, w, h, opts)];
    case 'diamond':
      return el.roundness === 'round'
        ? [generator.path(roundedDiamondPath(w, h, cornerRadius(w, h) * 1.4), opts)]
        : [
            generator.polygon(
              [
                [w / 2, 0],
                [w, h / 2],
                [w / 2, h],
                [0, h / 2],
              ],
              opts,
            ),
          ];
    case 'ellipse':
      return [generator.ellipse(w / 2, h / 2, w, h, { ...opts, curveFitting: 1 })];
  }
};

const arrowheadDrawables = (
  el: LinearElement,
  kind: Arrowhead,
  tip: Point,
  from: Point,
  opts: Options,
) => {
  if (kind === 'none') return [];
  const angle = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
  const segLen = Math.hypot(tip[0] - from[0], tip[1] - from[1]);
  const size = Math.min(Math.max(12, el.strokeWidth * 4.5), segLen * 0.6 || 12);
  const at = (len: number, rot: number): Point => [
    tip[0] - len * Math.cos(angle + rot),
    tip[1] - len * Math.sin(angle + rot),
  ];
  const headOpts: Options = {
    ...opts,
    strokeLineDash: undefined,
    disableMultiStroke: true,
    fill: undefined,
  };
  switch (kind) {
    case 'arrow': {
      const a = at(size, 0.45);
      const b = at(size, -0.45);
      return [{ drawable: generator.linearPath([a, tip, b], headOpts), filled: false }];
    }
    case 'triangle': {
      const a = at(size, 0.42);
      const b = at(size, -0.42);
      return [
        {
          drawable: generator.polygon([tip, a, b], {
            ...headOpts,
            fill: '#000',
            fillStyle: 'solid',
          }),
          filled: true,
        },
      ];
    }
    case 'diamond': {
      const back = at(size * 1.2, 0);
      const mid = at(size * 0.6, 0);
      const perp = angle + Math.PI / 2;
      const w = size * 0.35;
      const l: Point = [mid[0] + w * Math.cos(perp), mid[1] + w * Math.sin(perp)];
      const r: Point = [mid[0] - w * Math.cos(perp), mid[1] - w * Math.sin(perp)];
      return [
        {
          drawable: generator.polygon([tip, l, back, r], {
            ...headOpts,
            fill: '#000',
            fillStyle: 'solid',
          }),
          filled: true,
        },
      ];
    }
    case 'dot': {
      const r = Math.max(4, el.strokeWidth * 2.2);
      const c = at(r, 0);
      return [
        {
          drawable: generator.circle(c[0], c[1], r * 2, {
            ...headOpts,
            fill: '#000',
            fillStyle: 'solid',
          }),
          filled: true,
        },
      ];
    }
    case 'bar': {
      const perp = angle + Math.PI / 2;
      const h = size * 0.7;
      const a: Point = [tip[0] + h * Math.cos(perp), tip[1] + h * Math.sin(perp)];
      const b: Point = [tip[0] - h * Math.cos(perp), tip[1] - h * Math.sin(perp)];
      return [{ drawable: generator.line(a[0], a[1], b[0], b[1], headOpts), filled: false }];
    }
  }
};

const generateLinear = (el: LinearElement) => {
  const pts = el.points as Point[];
  const opts = roughOptions(el);
  const result: { drawable: ReturnType<typeof generator.path>; filled: boolean }[] = [];
  if (pts.length < 2) return result;
  const curved = el.roundness === 'round' && pts.length > 2;
  result.push({
    drawable: curved ? generator.curve(pts, opts) : generator.linearPath(pts, opts),
    filled: false,
  });
  const path = getLinearPath(el);
  // Use a point a little way back along the path to get a stable head direction on curves.
  const pickFrom = (fromEnd: boolean) => {
    const seq = fromEnd ? [...path].reverse() : path;
    const tip = seq[0];
    for (let i = 1; i < seq.length; i++) {
      if (Math.hypot(seq[i][0] - tip[0], seq[i][1] - tip[1]) > 8) return seq[i];
    }
    return seq[seq.length - 1];
  };
  result.push(...arrowheadDrawables(el, el.startArrowhead, path[0], pickFrom(false), opts));
  result.push(
    ...arrowheadDrawables(el, el.endArrowhead, path[path.length - 1], pickFrom(true), opts),
  );
  return result;
};

const freedrawOutline = (el: FreedrawElement) => {
  const stroke = getStroke(
    el.points.map(([x, y, p]) => ({ x, y, pressure: p })),
    {
      size: el.strokeWidth * 4,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.5,
      easing: (t) => Math.sin((t * Math.PI) / 2),
      simulatePressure: el.simulatePressure,
      last: true,
    },
  );
  if (!stroke.length) return '';
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q'] as (string | number)[],
  );
  d.push('Z');
  return d.map((v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)).join(' ');
};

interface CacheEntry {
  key: string;
  pointsRef: unknown;
  paths: CachedPath[];
}

const cache = new Map<string, CacheEntry>();

const geometryKey = (el: SceneElement) =>
  [
    el.type,
    Math.round(el.width * 100),
    Math.round(el.height * 100),
    el.strokeWidth,
    el.strokeStyle,
    el.roughness,
    el.fillStyle,
    el.backgroundColor === TRANSPARENT ? 0 : 1,
    el.roundness,
    el.seed,
    isLinear(el) ? `${el.startArrowhead}-${el.endArrowhead}` : '',
  ].join('|');

/** Hand-drawn geometry for an element in its local coordinate space (origin = element x/y). */
export const getElementPaths = (el: SceneElement): CachedPath[] => {
  if (!isShape(el) && !isLinear(el) && !isFreedraw(el)) return [];
  const key = geometryKey(el);
  const pointsRef = isLinear(el) || isFreedraw(el) ? el.points : null;
  const hit = cache.get(el.id);
  if (hit && hit.key === key && hit.pointsRef === pointsRef) return hit.paths;

  const paths: CachedPath[] = [];
  if (isFreedraw(el)) {
    const d = freedrawOutline(el);
    if (d) paths.push({ d, path: new Path2D(d), role: 'freedraw', width: 0, dashed: false });
  } else {
    const drawables = isShape(el)
      ? generateShape(el).map((drawable) => ({ drawable, filled: false }))
      : generateLinear(el);
    for (const { drawable, filled } of drawables) {
      for (const set of drawable.sets) {
        const d = generator.opsToPath(set, 2);
        let role: PathRole;
        if (set.type === 'fillPath') role = filled ? 'headFill' : 'fill';
        else if (set.type === 'fillSketch') role = 'fillSketch';
        else role = 'stroke';
        paths.push({
          d,
          path: new Path2D(d),
          role,
          width: set.type === 'fillSketch' ? drawable.options.fillWeight : el.strokeWidth,
          dashed: set.type === 'path' && !filled && !!drawable.options.strokeLineDash,
        });
      }
    }
  }
  cache.set(el.id, { key, pointsRef, paths });
  return paths;
};

export const pruneShapeCache = (liveIds: Set<string>) => {
  if (cache.size < liveIds.size + 200) return;
  for (const id of cache.keys()) if (!liveIds.has(id)) cache.delete(id);
};

export const dashPattern = (el: SceneElement) =>
  el.strokeStyle === 'dashed'
    ? [8, 8 + el.strokeWidth]
    : el.strokeStyle === 'dotted'
      ? [1.5, 6 + el.strokeWidth]
      : [];
