import type { BinaryFiles, SavedBoardFile, SceneData, SceneElement } from '../types';
import { DEFAULT_CANVAS_BACKGROUND } from './colors';
import { DEFAULT_STYLE, isImage, isLinear, normalizePoints } from './elements';
import { randomId, randomSeed, round } from './math';

const VALID_TYPES = new Set([
  'rectangle',
  'diamond',
  'ellipse',
  'arrow',
  'line',
  'freedraw',
  'text',
  'image',
]);

/**
 * Defensive restore of untrusted element data (files, share links): fills defaults, drops
 * malformed entries and coerces numbers so a bad payload can never crash the renderer.
 */
export const restoreElements = (raw: unknown): SceneElement[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SceneElement[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (!VALID_TYPES.has(r.type as string)) continue;
    const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
    let id = typeof r.id === 'string' && r.id ? r.id : randomId();
    if (seen.has(id)) id = randomId();
    seen.add(id);
    const el = {
      ...DEFAULT_STYLE,
      ...r,
      id,
      x: num(r.x, 0),
      y: num(r.y, 0),
      width: Math.abs(num(r.width, 0)),
      height: Math.abs(num(r.height, 0)),
      angle: num(r.angle, 0),
      seed: num(r.seed, randomSeed()),
      version: num(r.version, 1),
      strokeWidth: num(r.strokeWidth, DEFAULT_STYLE.strokeWidth),
      fontSize: num(r.fontSize, DEFAULT_STYLE.fontSize),
      opacity: Math.max(0, Math.min(100, num(r.opacity, 100))),
      roughness: [0, 1, 2].includes(r.roughness as number) ? r.roughness : 1,
      groupIds: Array.isArray(r.groupIds) ? r.groupIds.filter((g) => typeof g === 'string') : [],
      locked: r.locked === true,
      text: typeof r.text === 'string' ? r.text : undefined,
    } as SceneElement;
    if (el.type === 'text' && typeof el.text !== 'string') (el as { text: string }).text = '';
    if (el.type === 'arrow' || el.type === 'line' || el.type === 'freedraw') {
      const pts = Array.isArray(r.points) ? r.points : [];
      const valid = pts.filter(
        (p): p is number[] =>
          Array.isArray(p) && p.length >= 2 && p.every((n) => typeof n === 'number' && isFinite(n)),
      );
      if (valid.length < 1) continue;
      const fixed = (
        el.type === 'freedraw'
          ? valid.map((p) => [p[0], p[1], p[2] ?? 0.5])
          : valid.map((p) => [p[0], p[1]])
      ) as never;
      const withPoints = { ...el, points: fixed } as SceneElement;
      if (isLinear(withPoints)) {
        withPoints.startBinding =
          r.startBinding &&
          typeof (r.startBinding as { elementId?: unknown }).elementId === 'string'
            ? { elementId: (r.startBinding as { elementId: string }).elementId }
            : null;
        withPoints.endBinding =
          r.endBinding && typeof (r.endBinding as { elementId?: unknown }).elementId === 'string'
            ? { elementId: (r.endBinding as { elementId: string }).elementId }
            : null;
      } else {
        (withPoints as { simulatePressure: boolean }).simulatePressure =
          r.simulatePressure !== false;
      }
      out.push(normalizePoints(withPoints as never));
      continue;
    }
    if (el.type === 'image' && typeof (r as { fileId?: unknown }).fileId !== 'string') continue;
    out.push(el);
  }
  return out;
};

export const restoreFiles = (raw: unknown): BinaryFiles => {
  if (!raw || typeof raw !== 'object') return {};
  const out: BinaryFiles = {};
  for (const [id, f] of Object.entries(raw as Record<string, unknown>)) {
    const file = f as { dataURL?: unknown; mimeType?: unknown };
    if (typeof file?.dataURL === 'string' && file.dataURL.startsWith('data:image/')) {
      out[id] = {
        id,
        dataURL: file.dataURL,
        mimeType: typeof file.mimeType === 'string' ? file.mimeType : 'image/png',
      };
    }
  }
  return out;
};

export const serializeBoard = (scene: SceneData, name?: string): SavedBoardFile => {
  const used = new Set(scene.elements.filter(isImage).map((e) => e.fileId));
  const files = Object.fromEntries(Object.entries(scene.files).filter(([id]) => used.has(id)));
  return {
    type: 'sketchboard',
    version: 1,
    name,
    elements: scene.elements,
    files,
    background: scene.background,
  };
};

export const parseBoardFile = (text: string): SavedBoardFile => {
  const data = JSON.parse(text);
  if (!data || data.type !== 'sketchboard') throw new Error('Not a Sketchboard file');
  return {
    type: 'sketchboard',
    version: 1,
    name: typeof data.name === 'string' ? data.name : undefined,
    elements: restoreElements(data.elements),
    files: restoreFiles(data.files),
    background: typeof data.background === 'string' ? data.background : DEFAULT_CANVAS_BACKGROUND,
  };
};

// ---------------------------------------------------------------------------------------------
// Compact form for share links: short keys, rounded numbers, defaults omitted.
// ---------------------------------------------------------------------------------------------

const KEY_MAP: Record<string, string> = {
  id: 'i',
  type: 't',
  x: 'x',
  y: 'y',
  width: 'w',
  height: 'h',
  angle: 'a',
  seed: 's',
  strokeColor: 'sc',
  backgroundColor: 'bc',
  fillStyle: 'fs',
  strokeWidth: 'sw',
  strokeStyle: 'ss',
  roughness: 'r',
  opacity: 'o',
  roundness: 'rn',
  fontFamily: 'ff',
  fontSize: 'fz',
  textAlign: 'ta',
  startArrowhead: 'sa',
  endArrowhead: 'ea',
  groupIds: 'g',
  locked: 'l',
  text: 'tx',
  points: 'p',
  startBinding: 'sb',
  endBinding: 'eb',
  simulatePressure: 'sp',
  fileId: 'fi',
  link: 'lk',
};
const REVERSE_KEY_MAP = Object.fromEntries(Object.entries(KEY_MAP).map(([k, v]) => [v, k]));

const DEFAULTS: Record<string, unknown> = {
  ...DEFAULT_STYLE,
  angle: 0,
  locked: false,
  simulatePressure: true,
};

export const compactElements = (elements: readonly SceneElement[]) =>
  elements.map((el) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(el)) {
      if (key === 'version') continue;
      if (DEFAULTS[key] === value) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (value === null || value === undefined) continue;
      const short = KEY_MAP[key] ?? key;
      if (key === 'points') {
        out[short] = (value as number[][]).map((p) =>
          p.map((n, i) => (i === 2 ? round(n, 2) : round(n, 1))),
        );
      } else if (key === 'startBinding' || key === 'endBinding') {
        out[short] = (value as { elementId: string }).elementId;
      } else if (typeof value === 'number') {
        out[short] = key === 'angle' ? round(value, 4) : round(value, 1);
      } else out[short] = value;
    }
    return out;
  });

export const expandElements = (compact: unknown): SceneElement[] => {
  if (!Array.isArray(compact)) return [];
  return restoreElements(
    compact.map((c: Record<string, unknown>) => {
      const out: Record<string, unknown> = { ...DEFAULTS };
      for (const [k, v] of Object.entries(c ?? {})) {
        const key = REVERSE_KEY_MAP[k] ?? k;
        out[key] = key === 'startBinding' || key === 'endBinding' ? { elementId: v } : v;
      }
      return out;
    }),
  );
};
