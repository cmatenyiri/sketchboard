import { getAbsolutePoints, getCenter, isLinear } from '../scene/elements';
import { rotatePoint } from '../scene/math';
import type { SnapLine } from '../scene/snapping';
import { getTransformHandles, type SelectionFrame } from '../scene/transform';
import type { Tokens } from '../theme/tokens';
import type { Bounds, LinearElement, Point, SceneElement, Viewport } from '../types';

export interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

export interface InteractiveScene {
  selected: SceneElement[];
  frame: SelectionFrame | null;
  showHandles: boolean;
  hovered: SceneElement | null;
  selectionBox: Bounds | null;
  snapLines: SnapLine[];
  bindTarget: SceneElement | null;
  linearEditor: {
    element: LinearElement;
    hoveredPoint: number | null;
    hoveredMidpoint: number | null;
  } | null;
  laserTrails: TrailPoint[][];
  eraserTrail: TrailPoint[];
  groupBounds: Bounds[];
}

export const LASER_DECAY_MS = 1100;
export const ERASER_DECAY_MS = 220;

const outlineElement = (ctx: CanvasRenderingContext2D, el: SceneElement, pad: number) => {
  if (isLinear(el)) {
    const pts = getAbsolutePoints(el);
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    return;
  }
  const [cx, cy] = getCenter(el);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(el.angle);
  ctx.beginPath();
  const w = el.width / 2 + pad;
  const h = el.height / 2 + pad;
  if (el.type === 'ellipse') ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
  else if (el.type === 'diamond') {
    ctx.moveTo(0, -h);
    ctx.lineTo(w, 0);
    ctx.lineTo(0, h);
    ctx.lineTo(-w, 0);
    ctx.closePath();
  } else ctx.roundRect(-w, -h, w * 2, h * 2, 4 / Math.max(1, ctx.getTransform().a));
  ctx.stroke();
  ctx.restore();
};

/** Midpoints between consecutive points, where dragging inserts a new point. */
export const getLinearMidpoints = (el: LinearElement, zoom: number): (Point | null)[] => {
  const pts = getAbsolutePoints(el);
  const result: (Point | null)[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) * zoom;
    result.push(len > 44 ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : null);
  }
  return result;
};

const drawTrail = (
  ctx: CanvasRenderingContext2D,
  trail: TrailPoint[],
  now: number,
  decay: number,
  color: string,
  width: number,
  zoom: number,
) => {
  if (trail.length < 2) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 1; i < trail.length; i++) {
    const age = now - trail[i].t;
    const life = 1 - age / decay;
    if (life <= 0) continue;
    const progress = i / trail.length;
    ctx.globalAlpha = Math.min(1, life * 1.4) * (0.35 + progress * 0.65);
    ctx.strokeStyle = color;
    ctx.lineWidth = (width * (0.35 + 0.65 * progress) * Math.max(0.2, life)) / zoom;
    ctx.beginPath();
    ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
    ctx.lineTo(trail[i].x, trail[i].y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
};

export const renderInteractive = (
  ctx: CanvasRenderingContext2D,
  scene: InteractiveScene,
  viewport: Viewport,
  t: Tokens,
  now: number,
) => {
  const { zoom } = viewport;
  const lw = 1.25 / zoom;

  // Hover outline
  if (scene.hovered && !scene.selected.some((s) => s.id === scene.hovered!.id)) {
    ctx.strokeStyle = t.selection;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = lw;
    outlineElement(ctx, scene.hovered, 3 / zoom);
    ctx.globalAlpha = 1;
  }

  // Arrow binding target
  if (scene.bindTarget) {
    ctx.save();
    ctx.strokeStyle = t.selection;
    ctx.shadowColor = t.selection;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 3 / zoom;
    ctx.globalAlpha = 0.85;
    outlineElement(ctx, scene.bindTarget, 6 / zoom);
    ctx.restore();
  }

  // Outlines of each selected element in a multi-selection
  if (scene.selected.length > 1) {
    ctx.strokeStyle = t.selection;
    ctx.lineWidth = lw;
    ctx.globalAlpha = 0.6;
    for (const el of scene.selected) {
      if (isLinear(el)) continue;
      outlineElement(ctx, el, 2 / zoom);
    }
    ctx.globalAlpha = 1;
  }

  // Group bounds
  if (scene.groupBounds.length) {
    ctx.save();
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.strokeStyle = t.selection;
    ctx.lineWidth = lw;
    for (const b of scene.groupBounds) {
      const pad = 4 / zoom;
      ctx.strokeRect(
        b.minX - pad,
        b.minY - pad,
        b.maxX - b.minX + pad * 2,
        b.maxY - b.minY + pad * 2,
      );
    }
    ctx.restore();
  }

  // Selection frame + handles
  const frame = scene.frame;
  if (frame && !scene.linearEditor) {
    const pad = 6 / zoom;
    ctx.save();
    ctx.translate(frame.cx, frame.cy);
    ctx.rotate(frame.angle);
    ctx.strokeStyle = t.selection;
    ctx.lineWidth = lw;
    if (scene.selected.length > 1) ctx.setLineDash([5 / zoom, 4 / zoom]);
    ctx.strokeRect(
      -frame.width / 2 - pad,
      -frame.height / 2 - pad,
      frame.width + pad * 2,
      frame.height + pad * 2,
    );
    ctx.restore();

    if (scene.showHandles) {
      const handles = getTransformHandles(frame, zoom);
      const size = 9 / zoom;
      const c: Point = [frame.cx, frame.cy];
      for (const [key, pos] of Object.entries(handles)) {
        if (!pos) continue;
        ctx.save();
        ctx.translate(pos[0], pos[1]);
        ctx.rotate(frame.angle);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = t.selection;
        ctx.lineWidth = 1.5 / zoom;
        ctx.beginPath();
        if (key === 'rotation') {
          ctx.arc(0, 0, size / 1.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.roundRect(-size / 2, -size / 2, size, size, 2.5 / zoom);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }
      // Connector from top edge to rotation handle
      const rot = handles.rotation;
      if (rot) {
        const top = rotatePoint([c[0], c[1] - frame.height / 2 - pad], c, frame.angle);
        const toward = rotatePoint(
          [c[0], c[1] - frame.height / 2 - pad - 22 / zoom + size / 1.6],
          c,
          frame.angle,
        );
        ctx.strokeStyle = t.selection;
        ctx.lineWidth = lw;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(top[0], top[1]);
        ctx.lineTo(toward[0], toward[1]);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  // Line/arrow point editor
  if (scene.linearEditor) {
    const { element, hoveredPoint, hoveredMidpoint } = scene.linearEditor;
    const pts = getAbsolutePoints(element);
    const r = 5.5 / zoom;
    // Faint guide through points
    ctx.strokeStyle = t.selection;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = lw;
    ctx.setLineDash([3 / zoom, 3 / zoom]);
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    getLinearMidpoints(element, zoom).forEach((m, i) => {
      if (!m) return;
      ctx.beginPath();
      ctx.arc(m[0], m[1], r * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = hoveredMidpoint === i ? t.selection : t.selectionFill;
      ctx.strokeStyle = t.selection;
      ctx.globalAlpha = hoveredMidpoint === i ? 0.9 : 0.6;
      ctx.lineWidth = 1 / zoom;
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    pts.forEach(([x, y], i) => {
      const bound =
        (i === 0 && element.startBinding) || (i === pts.length - 1 && element.endBinding);
      ctx.beginPath();
      ctx.arc(x, y, hoveredPoint === i ? r * 1.25 : r, 0, Math.PI * 2);
      ctx.fillStyle = bound ? t.selection : '#ffffff';
      ctx.strokeStyle = t.selection;
      ctx.lineWidth = 1.75 / zoom;
      ctx.fill();
      ctx.stroke();
    });
  }

  // Box selection
  if (scene.selectionBox) {
    const b = scene.selectionBox;
    ctx.fillStyle = t.selectionFill;
    ctx.strokeStyle = t.selection;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.roundRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY, 3 / zoom);
    ctx.fill();
    ctx.stroke();
  }

  // Smart guides
  if (scene.snapLines.length) {
    ctx.strokeStyle = t.snap;
    ctx.lineWidth = 1 / zoom;
    const cross = 3.5 / zoom;
    for (const line of scene.snapLines) {
      ctx.beginPath();
      if (line.axis === 'x') {
        ctx.moveTo(line.value, line.from);
        ctx.lineTo(line.value, line.to);
        for (const y of [line.from, line.to]) {
          ctx.moveTo(line.value - cross, y - cross);
          ctx.lineTo(line.value + cross, y + cross);
          ctx.moveTo(line.value + cross, y - cross);
          ctx.lineTo(line.value - cross, y + cross);
        }
      } else {
        ctx.moveTo(line.from, line.value);
        ctx.lineTo(line.to, line.value);
        for (const x of [line.from, line.to]) {
          ctx.moveTo(x - cross, line.value - cross);
          ctx.lineTo(x + cross, line.value + cross);
          ctx.moveTo(x + cross, line.value - cross);
          ctx.lineTo(x - cross, line.value + cross);
        }
      }
      ctx.stroke();
    }
  }

  // Eraser trail
  drawTrail(ctx, scene.eraserTrail, now, ERASER_DECAY_MS, 'rgba(140,140,150,0.5)', 10, zoom);

  // Laser trails: glow + core
  for (const trail of scene.laserTrails) {
    ctx.save();
    ctx.shadowColor = t.laser;
    ctx.shadowBlur = 14;
    drawTrail(ctx, trail, now, LASER_DECAY_MS, t.laser, 6, zoom);
    ctx.restore();
    drawTrail(ctx, trail, now, LASER_DECAY_MS, '#fff4f6', 2, zoom);
  }
};
