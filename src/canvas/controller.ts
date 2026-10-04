import { deselect, getPointerScene, setLastPointer, viewportSize } from '../actions/sceneActions';
import {
  cleanupBindings,
  getBindableElementAt,
  getOutlinePoint,
  updateBoundArrows,
  updateLinearBindings,
} from '../scene/binding';
import {
  canHaveLabel,
  createElement,
  duplicateElements,
  expandSelectionToGroups,
  getAbsolutePoints,
  getCenter,
  getCommonBounds,
  getElementsInGroup,
  getOutermostGroupId,
  isBindable,
  isElementEmpty,
  isLinear,
  isText,
  normalizePoints,
} from '../scene/elements';
import {
  getElementAtPoint,
  getElementsCrossingSegment,
  getElementsInBox,
  hitTestElement,
} from '../scene/hitTest';
import { distance, rotatePoint, snapAngle } from '../scene/math';
import { visibleSceneBounds } from '../scene/renderer';
import { snapPointToGrid, snapToGrid, snapToObjects, type SnapLine } from '../scene/snapping';
import {
  cursorForHandle,
  getSelectionFrame,
  getTransformHandles,
  hitTestHandles,
  resizeElements,
  rotateElements,
  type SelectionFrame,
} from '../scene/transform';
import { screenToScene, zoomAt } from '../scene/viewport';
import {
  getSelectedElements,
  getState,
  pushHistory,
  setState,
  takeSnapshot,
  type Snapshot,
} from '../store/store';
import type {
  Bounds,
  FreedrawElement,
  LinearElement,
  Point,
  SceneElement,
  TransformHandle,
  Viewport,
} from '../types';
import {
  ERASER_DECAY_MS,
  getLinearMidpoints,
  LASER_DECAY_MS,
  type InteractiveScene,
  type TrailPoint,
} from './renderInteractive';
import { finishEditing, startEditing, startNewText } from './textEditing';

type Mode =
  | { kind: 'idle' }
  | { kind: 'panning'; startScreen: Point; startViewport: Viewport }
  | { kind: 'creatingBox'; id: string; origin: Point; before: Snapshot }
  | { kind: 'creatingLinear'; id: string; origin: Point; before: Snapshot; downScreen: Point }
  | { kind: 'linearMulti'; id: string; before: Snapshot }
  | { kind: 'freedraw'; id: string; before: Snapshot }
  | { kind: 'boxSelect'; origin: Point; additive: boolean; initial: string[] }
  | {
      kind: 'dragging';
      start: Point;
      startScreen: Point;
      originals: SceneElement[];
      before: Snapshot;
      moved: boolean;
      clickedId: string | null;
      wasSelected: boolean;
      altKey: boolean;
    }
  | {
      kind: 'resizing';
      handle: TransformHandle;
      originals: SceneElement[];
      before: Snapshot;
    }
  | {
      kind: 'rotating';
      frame: SelectionFrame;
      start: Point;
      originals: SceneElement[];
      before: Snapshot;
    }
  | { kind: 'pointDrag'; id: string; index: number; before: Snapshot }
  | { kind: 'erasing'; before: Snapshot; ids: Set<string>; last: Point }
  | { kind: 'laser'; trail: TrailPoint[] }
  | {
      kind: 'pinch';
      startDist: number;
      startCenter: Point;
      startViewport: Viewport;
    };

const DRAG_THRESHOLD = 3;

const ERASER_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="7" fill="white" stroke="black" stroke-width="1.5"/></svg>',
)}") 10 10, auto`;
const LASER_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="5" fill="#ff2d55" stroke="white" stroke-width="2"/></svg>',
)}") 10 10, auto`;
const PEN_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="2.5" fill="black" stroke="white" stroke-width="1.5"/></svg>',
)}") 8 8, crosshair`;

/**
 * Translates raw pointer/wheel input on the canvas into scene edits. Lives outside React so that
 * high-frequency pointer moves don't trigger component renders.
 */
export class InteractionController {
  private mode: Mode = { kind: 'idle' };
  private pointers = new Map<number, Point>();
  private spaceDown = false;
  private target: HTMLElement | null = null;

  // Transient visual state
  private selectionBox: Bounds | null = null;
  private snapLines: SnapLine[] = [];
  private bindTarget: SceneElement | null = null;
  private hoveredId: string | null = null;
  private hoveredPoint: number | null = null;
  private hoveredMidpoint: number | null = null;
  private laserTrails: TrailPoint[][] = [];
  private eraserTrail: TrailPoint[] = [];
  private animating = false;
  private suppressDoubleClickUntil = 0;

  private readonly requestInteractiveRender: () => void;

  constructor(requestInteractiveRender: () => void) {
    this.requestInteractiveRender = requestInteractiveRender;
  }

  attach(el: HTMLElement) {
    this.target = el;
    this.updateCursor();
  }

  // ------------------------------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------------------------------

  private get state() {
    return getState();
  }

  private toScene(e: { clientX: number; clientY: number }): Point {
    return screenToScene([e.clientX, e.clientY], this.state.viewport);
  }

  private maybeGrid(p: Point): Point {
    return this.state.gridEnabled ? snapPointToGrid(p) : p;
  }

  private threshold(pointerType = 'mouse') {
    return (pointerType === 'touch' ? 14 : 7) / this.state.viewport.zoom;
  }

  private setCursor(cursor: string) {
    if (this.target && this.target.style.cursor !== cursor) this.target.style.cursor = cursor;
  }

  isBusy() {
    return this.mode.kind !== 'idle';
  }

  updateCursor() {
    const { tool, viewMode } = this.state;
    if (this.spaceDown || tool === 'hand' || (viewMode && tool !== 'laser')) {
      this.setCursor(this.mode.kind === 'panning' ? 'grabbing' : 'grab');
      return;
    }
    switch (tool) {
      case 'text':
        this.setCursor('text');
        break;
      case 'eraser':
        this.setCursor(ERASER_CURSOR);
        break;
      case 'laser':
        this.setCursor(LASER_CURSOR);
        break;
      case 'freedraw':
        this.setCursor(PEN_CURSOR);
        break;
      case 'select':
        this.setCursor('default');
        break;
      default:
        this.setCursor('crosshair');
    }
  }

  setSpace(down: boolean) {
    if (this.spaceDown === down) return;
    this.spaceDown = down;
    this.updateCursor();
  }

  private replaceElements(
    updated: SceneElement[],
    extra: Partial<ReturnType<typeof getState>> = {},
  ) {
    const map = new Map(updated.map((e) => [e.id, e]));
    const elements = this.state.elements.map((e) => map.get(e.id) ?? e);
    setState({ elements, ...extra });
  }

  private updateElement(id: string, fn: (el: SceneElement) => SceneElement) {
    const elements = this.state.elements.map((e) => (e.id === id ? fn(e) : e));
    setState({ elements });
  }

  private finishTool() {
    if (!this.state.toolLocked && this.state.tool !== 'freedraw') setState({ tool: 'select' });
    this.updateCursor();
  }

  // ------------------------------------------------------------------------------------------
  // Interactive scene for the overlay renderer
  // ------------------------------------------------------------------------------------------

  getInteractiveScene(): InteractiveScene {
    const s = this.state;
    const selected = getSelectedElements(s).filter((e) => e.id !== s.editing?.id || isText(e));
    const editingNew = s.editing?.isNew;
    const busy =
      this.mode.kind === 'dragging' ||
      this.mode.kind === 'creatingBox' ||
      this.mode.kind === 'creatingLinear' ||
      this.mode.kind === 'linearMulti' ||
      this.mode.kind === 'freedraw';
    const singleLinear =
      selected.length === 1 && isLinear(selected[0]) && !selected[0].locked ? selected[0] : null;
    const frame = editingNew || s.viewMode ? null : getSelectionFrame(selected);

    const groupBounds: Bounds[] = [];
    if (selected.length > 1) {
      const groups = new Set(
        selected.map((e) => getOutermostGroupId(e, s.editingGroupId)).filter(Boolean) as string[],
      );
      for (const g of groups) {
        const b = getCommonBounds(getElementsInGroup(s.elements, g));
        if (b) groupBounds.push(b);
      }
    }
    if (s.editingGroupId) {
      const b = getCommonBounds(getElementsInGroup(s.elements, s.editingGroupId));
      if (b) groupBounds.push(b);
    }

    const hovered =
      this.hoveredId && s.tool === 'select' && !s.viewMode
        ? (s.elements.find((e) => e.id === this.hoveredId) ?? null)
        : null;

    return {
      selected: s.viewMode ? [] : selected,
      frame: busy && this.mode.kind !== 'dragging' ? null : frame,
      showHandles:
        !busy &&
        !singleLinear &&
        !s.editing &&
        selected.length > 0 &&
        !selected.some((e) => e.locked),
      hovered,
      selectionBox: this.selectionBox,
      snapLines: this.snapLines,
      bindTarget: this.bindTarget,
      linearEditor:
        singleLinear &&
        this.mode.kind !== 'linearMulti' &&
        this.mode.kind !== 'creatingLinear' &&
        !s.editing
          ? {
              element: singleLinear,
              hoveredPoint: this.hoveredPoint,
              hoveredMidpoint: this.hoveredMidpoint,
            }
          : null,
      laserTrails: this.laserTrails,
      eraserTrail: this.eraserTrail,
      groupBounds,
    };
  }

  // ------------------------------------------------------------------------------------------
  // Animation for decaying trails
  // ------------------------------------------------------------------------------------------

  private ensureAnimation() {
    if (this.animating) return;
    this.animating = true;
    const tick = () => {
      const now = performance.now();
      this.laserTrails = this.laserTrails
        .map((t) => t.filter((p) => now - p.t < LASER_DECAY_MS))
        .filter(
          (t, i, arr) => t.length > 0 || (this.mode.kind === 'laser' && i === arr.length - 1),
        );
      if (this.mode.kind === 'laser') {
        // Keep the active trail object referenced by mode in sync.
        const active = this.mode.trail;
        if (!this.laserTrails.includes(active)) this.laserTrails.push(active);
        const fresh = active.filter((p) => now - p.t < LASER_DECAY_MS);
        active.splice(0, active.length, ...fresh);
      }
      this.eraserTrail = this.eraserTrail.filter((p) => now - p.t < ERASER_DECAY_MS);
      this.requestInteractiveRender();
      if (
        this.laserTrails.some((t) => t.length) ||
        this.eraserTrail.length ||
        this.mode.kind === 'laser' ||
        this.mode.kind === 'erasing'
      ) {
        requestAnimationFrame(tick);
      } else {
        this.animating = false;
      }
    };
    requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------------------------------------
  // Pointer events
  // ------------------------------------------------------------------------------------------

  onPointerDown = (e: PointerEvent) => {
    const screen: Point = [e.clientX, e.clientY];
    this.pointers.set(e.pointerId, screen);
    setLastPointer(screen);
    if (getState().contextMenu) setState({ contextMenu: null });
    // Mousedown focus changes are suppressed on the canvas (so a freshly opened text editor keeps
    // focus), so commit an in-progress edit and release other inputs explicitly.
    if (getState().editing) {
      finishEditing();
      return;
    }
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body) active.blur();

    // Two fingers → pinch/pan; abandon whatever the first finger started.
    if (this.pointers.size === 2) {
      this.cancelInProgress();
      const [a, b] = [...this.pointers.values()];
      this.mode = {
        kind: 'pinch',
        startDist: distance(a, b),
        startCenter: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        startViewport: this.state.viewport,
      };
      return;
    }
    if (this.pointers.size > 2) return;

    (e.target as Element).setPointerCapture?.(e.pointerId);
    const s = this.state;
    const p = this.toScene(e);

    if (
      e.button === 1 ||
      this.spaceDown ||
      s.tool === 'hand' ||
      (s.viewMode && s.tool !== 'laser')
    ) {
      this.mode = { kind: 'panning', startScreen: screen, startViewport: s.viewport };
      this.updateCursor();
      return;
    }
    if (e.button !== 0) return;

    if (this.mode.kind === 'linearMulti') {
      this.addMultiPoint(p, e);
      return;
    }

    switch (s.tool) {
      case 'select':
        this.selectPointerDown(e, p);
        break;
      case 'rectangle':
      case 'diamond':
      case 'ellipse':
        this.startBox(p);
        break;
      case 'arrow':
      case 'line':
        this.startLinear(p, screen);
        break;
      case 'freedraw':
        this.startFreedraw(p, e);
        break;
      case 'text':
        this.textPointerDown(p);
        break;
      case 'eraser':
        this.mode = { kind: 'erasing', before: takeSnapshot(), ids: new Set(), last: p };
        this.eraserTrail.push({ x: p[0], y: p[1], t: performance.now() });
        this.ensureAnimation();
        break;
      case 'laser': {
        const trail: TrailPoint[] = [{ x: p[0], y: p[1], t: performance.now() }];
        this.laserTrails.push(trail);
        this.mode = { kind: 'laser', trail };
        this.ensureAnimation();
        break;
      }
    }
  };

  onPointerMove = (e: PointerEvent) => {
    const screen: Point = [e.clientX, e.clientY];
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, screen);
    setLastPointer(screen);
    const p = this.toScene(e);
    const mode = this.mode;

    switch (mode.kind) {
      case 'idle':
        this.updateHover(p, e);
        return;
      case 'pinch': {
        if (this.pointers.size < 2) return;
        const [a, b] = [...this.pointers.values()];
        const dist = distance(a, b);
        const center: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const v = mode.startViewport;
        const zoomed = zoomAt(v, (v.zoom * dist) / (mode.startDist || 1), mode.startCenter);
        setState({
          viewport: {
            zoom: zoomed.zoom,
            scrollX: zoomed.scrollX + (center[0] - mode.startCenter[0]) / zoomed.zoom,
            scrollY: zoomed.scrollY + (center[1] - mode.startCenter[1]) / zoomed.zoom,
          },
        });
        return;
      }
      case 'panning': {
        const v = mode.startViewport;
        setState({
          viewport: {
            ...v,
            scrollX: v.scrollX + (screen[0] - mode.startScreen[0]) / v.zoom,
            scrollY: v.scrollY + (screen[1] - mode.startScreen[1]) / v.zoom,
          },
        });
        return;
      }
      case 'creatingBox':
        this.moveBox(mode, p, e);
        return;
      case 'creatingLinear':
      case 'linearMulti':
        this.moveLinearEnd(mode.id, p, e);
        return;
      case 'freedraw': {
        const events = e.getCoalescedEvents?.() ?? [e];
        this.updateElement(mode.id, (el) => {
          const fd = el as FreedrawElement;
          const pts = [...fd.points];
          for (const ce of events.length ? events : [e]) {
            const cp = this.toScene(ce);
            pts.push([cp[0] - fd.x, cp[1] - fd.y, ce.pressure || 0.5]);
          }
          return { ...fd, points: pts, version: fd.version + 1 };
        });
        return;
      }
      case 'boxSelect': {
        const box: Bounds = {
          minX: Math.min(mode.origin[0], p[0]),
          minY: Math.min(mode.origin[1], p[1]),
          maxX: Math.max(mode.origin[0], p[0]),
          maxY: Math.max(mode.origin[1], p[1]),
        };
        this.selectionBox = box;
        const s = this.state;
        const inside = getElementsInBox(s.elements, box).map((el) => el.id);
        const expanded = expandSelectionToGroups(s.elements, inside, s.editingGroupId);
        const ids = mode.additive ? new Set([...mode.initial, ...expanded]) : expanded;
        setState({ selectedIds: [...ids] });
        this.requestInteractiveRender();
        return;
      }
      case 'dragging':
        this.moveDrag(mode, p, screen, e);
        return;
      case 'resizing': {
        const pointer = this.maybeGrid(p);
        const resized = resizeElements(mode.originals, mode.handle, pointer, {
          keepAspect: e.shiftKey,
          fromCenter: e.altKey,
        });
        this.applyTransformed(resized);
        return;
      }
      case 'rotating': {
        const rotated = rotateElements(mode.originals, mode.frame, mode.start, p, e.shiftKey);
        this.applyTransformed(rotated);
        return;
      }
      case 'pointDrag':
        this.movePoint(mode, p, e);
        return;
      case 'erasing': {
        this.eraserTrail.push({ x: p[0], y: p[1], t: performance.now() });
        const s = this.state;
        const hits = getElementsCrossingSegment(
          s.elements,
          mode.last,
          p,
          this.threshold(e.pointerType),
        );
        mode.last = p;
        if (hits.length) {
          const expanded = expandSelectionToGroups(
            s.elements,
            hits.map((h) => h.id),
            null,
          );
          for (const id of expanded) mode.ids.add(id);
          setState({ elements: [...s.elements] }); // trigger re-render with faded ids
        }
        this.ensureAnimation();
        return;
      }
      case 'laser':
        mode.trail.push({ x: p[0], y: p[1], t: performance.now() });
        this.ensureAnimation();
        return;
    }
  };

  onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    const mode = this.mode;
    if (mode.kind === 'pinch') {
      if (this.pointers.size < 2) this.mode = { kind: 'idle' };
      return;
    }
    switch (mode.kind) {
      case 'panning':
        this.mode = { kind: 'idle' };
        this.updateCursor();
        return;
      case 'creatingBox':
        this.finishCreation(mode.id, mode.before);
        return;
      case 'creatingLinear': {
        const dragged = distance([e.clientX, e.clientY], mode.downScreen) > DRAG_THRESHOLD * 2;
        if (!dragged) {
          // Click (no drag) → keep adding points with each click until finished.
          this.mode = { kind: 'linearMulti', id: mode.id, before: mode.before };
          this.requestInteractiveRender();
          return;
        }
        this.finishLinear(mode.id, mode.before, false);
        return;
      }
      case 'linearMulti':
        return;
      case 'freedraw': {
        this.updateElement(mode.id, (el) => normalizePoints(el as FreedrawElement));
        this.finishCreation(mode.id, mode.before);
        return;
      }
      case 'boxSelect':
        this.selectionBox = null;
        this.mode = { kind: 'idle' };
        this.requestInteractiveRender();
        return;
      case 'dragging': {
        this.snapLines = [];
        this.mode = { kind: 'idle' };
        if (!mode.moved) {
          // Clicking an already-selected element in a multi-selection narrows to it.
          if (
            mode.clickedId &&
            mode.wasSelected &&
            !e.shiftKey &&
            this.state.selectedIds.length > 1
          ) {
            const s = this.state;
            const ids = expandSelectionToGroups(s.elements, [mode.clickedId], s.editingGroupId);
            setState({ selectedIds: [...ids] });
          }
        } else {
          pushHistory(mode.before);
        }
        this.requestInteractiveRender();
        return;
      }
      case 'resizing':
      case 'rotating':
        this.mode = { kind: 'idle' };
        pushHistory(mode.before);
        this.requestInteractiveRender();
        return;
      case 'pointDrag': {
        this.mode = { kind: 'idle' };
        this.bindTarget = null;
        const el = this.state.elements.find((x) => x.id === mode.id);
        if (el && isLinear(el)) {
          const byId = new Map(this.state.elements.map((x) => [x.id, x]));
          this.updateElement(el.id, () => updateLinearBindings(el, byId));
        }
        pushHistory(mode.before);
        this.requestInteractiveRender();
        return;
      }
      case 'erasing': {
        this.mode = { kind: 'idle' };
        if (mode.ids.size) {
          const remaining = this.state.elements.filter((x) => !mode.ids.has(x.id));
          setState({
            elements: cleanupBindings(remaining),
            selectedIds: this.state.selectedIds.filter((id) => !mode.ids.has(id)),
          });
          pushHistory(mode.before);
        }
        return;
      }
      case 'laser':
        this.mode = { kind: 'idle' };
        return;
    }
  };

  onPointerCancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.mode.kind === 'pinch' && this.pointers.size < 2) this.mode = { kind: 'idle' };
    else if (this.mode.kind !== 'linearMulti') this.cancelInProgress();
  };

  onPointerLeave = () => {
    if (this.hoveredId) {
      this.hoveredId = null;
      this.requestInteractiveRender();
    }
  };

  /** Aborts creation/transform gestures (e.g. when a second finger lands). */
  cancelInProgress() {
    const mode = this.mode;
    if (
      mode.kind === 'creatingBox' ||
      mode.kind === 'creatingLinear' ||
      mode.kind === 'linearMulti' ||
      mode.kind === 'freedraw'
    ) {
      setState({ elements: mode.before.elements, selectedIds: mode.before.selectedIds });
    } else if (
      mode.kind === 'dragging' ||
      mode.kind === 'resizing' ||
      mode.kind === 'rotating' ||
      mode.kind === 'pointDrag'
    ) {
      setState({ elements: mode.before.elements });
    }
    this.selectionBox = null;
    this.snapLines = [];
    this.bindTarget = null;
    this.mode = { kind: 'idle' };
    this.requestInteractiveRender();
  }

  // ------------------------------------------------------------------------------------------
  // Wheel / double click / context menu
  // ------------------------------------------------------------------------------------------

  onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const { viewport } = this.state;
    if (e.ctrlKey || e.metaKey) {
      // Trackpad pinches arrive as ctrl+wheel with small, continuous deltas; mouse wheels send
      // large discrete notches, which get a fixed step so one notch ≈ 10%.
      const raw = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const factor =
        Math.abs(raw) >= 50
          ? raw > 0
            ? 1 / 1.1
            : 1.1
          : Math.exp(-Math.max(-25, Math.min(25, raw)) * 0.01);
      setState({ viewport: zoomAt(viewport, viewport.zoom * factor, [e.clientX, e.clientY]) });
      return;
    }
    const scale = e.deltaMode === 1 ? 16 : 1;
    let dx = e.deltaX * scale;
    let dy = e.deltaY * scale;
    if (e.shiftKey && !dx) {
      dx = dy;
      dy = 0;
    }
    setState({
      viewport: {
        ...viewport,
        scrollX: viewport.scrollX - dx / viewport.zoom,
        scrollY: viewport.scrollY - dy / viewport.zoom,
      },
    });
  };

  onDoubleClick = (e: MouseEvent) => {
    const s = this.state;
    if (this.mode.kind === 'linearMulti') {
      this.finishLinear(this.mode.id, this.mode.before, true);
      return;
    }
    if (s.viewMode || s.editing || performance.now() < this.suppressDoubleClickUntil) return;
    if (s.tool !== 'select' && s.tool !== 'text') return;
    const p = this.toScene(e);
    const hit = getElementAtPoint(s.elements, p, this.threshold());
    if (hit) {
      // Double-click inside a group drills into it.
      const outer = getOutermostGroupId(hit, s.editingGroupId);
      if (outer && s.editingGroupId !== outer && !s.selectedIds.every((id) => id === hit.id)) {
        setState({ editingGroupId: outer, selectedIds: [hit.id] });
        return;
      }
      if (isText(hit) || canHaveLabel(hit)) {
        startEditing(hit.id);
        return;
      }
    }
    startNewText(this.maybeGrid(p));
  };

  onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const s = this.state;
    if (s.editing || s.viewMode) return;
    const p = this.toScene(e);
    const hit = getElementAtPoint(s.elements, p, this.threshold(), { includeLocked: true });
    if (hit && !s.selectedIds.includes(hit.id)) {
      const ids = expandSelectionToGroups(s.elements, [hit.id], s.editingGroupId);
      setState({ selectedIds: [...ids] });
    } else if (!hit) {
      setState({ selectedIds: [] });
    }
    setState({
      contextMenu: { x: e.clientX, y: e.clientY, sceneX: p[0], sceneY: p[1], onElement: !!hit },
    });
  };

  // ------------------------------------------------------------------------------------------
  // Select tool
  // ------------------------------------------------------------------------------------------

  private selectPointerDown(e: PointerEvent, p: Point) {
    const s = this.state;
    const selected = getSelectedElements(s);
    const zoom = s.viewport.zoom;

    // 1) Point handles of a selected line/arrow
    if (selected.length === 1 && isLinear(selected[0]) && !selected[0].locked) {
      const el = selected[0];
      const idx = this.hitLinearPoint(el, p);
      if (idx !== null) {
        this.mode = { kind: 'pointDrag', id: el.id, index: idx, before: takeSnapshot() };
        return;
      }
      const mid = this.hitLinearMidpoint(el, p);
      if (mid !== null) {
        const before = takeSnapshot();
        const pts = getAbsolutePoints(el);
        pts.splice(mid + 1, 0, p);
        const updated = normalizePoints({
          ...el,
          x: 0,
          y: 0,
          points: pts,
          version: el.version + 1,
        });
        this.replaceElements([updated]);
        this.mode = { kind: 'pointDrag', id: el.id, index: mid + 1, before };
        return;
      }
    }

    // 2) Transform handles
    const frame = getSelectionFrame(selected);
    const singleLinear = selected.length === 1 && isLinear(selected[0]);
    if (frame && !singleLinear && !selected.some((x) => x.locked)) {
      const handle = hitTestHandles(getTransformHandles(frame, zoom), p, zoom);
      if (handle) {
        const before = takeSnapshot();
        this.mode =
          handle === 'rotation'
            ? { kind: 'rotating', frame, start: p, originals: selected, before }
            : { kind: 'resizing', handle, originals: selected, before };
        return;
      }
    }

    // 3) Elements
    const hit = getElementAtPoint(s.elements, p, this.threshold(e.pointerType));
    const insideFrame = frame && this.isInsideFrame(frame, p);
    const hitSelected = hit && s.selectedIds.includes(hit.id);

    if (!hitSelected && insideFrame && !e.shiftKey && selected.length > 0) {
      this.startDrag(p, e, null, true);
      return;
    }

    if (hit) {
      // Leaving a group you were editing when clicking outside of it.
      let editingGroupId = s.editingGroupId;
      if (editingGroupId && !hit.groupIds.includes(editingGroupId)) editingGroupId = null;
      const unit = expandSelectionToGroups(s.elements, [hit.id], editingGroupId);
      if (e.shiftKey) {
        const current = new Set(s.selectedIds);
        if (hitSelected) {
          for (const id of unit) current.delete(id);
          setState({ selectedIds: [...current], editingGroupId });
          return;
        }
        for (const id of unit) current.add(id);
        setState({ selectedIds: [...current], editingGroupId });
      } else if (!hitSelected) {
        setState({ selectedIds: [...unit], editingGroupId });
      }
      this.startDrag(p, e, hit.id, !!hitSelected);
      return;
    }

    // 4) Empty canvas → rubber-band selection
    if (!e.shiftKey) setState({ selectedIds: [], editingGroupId: null });
    this.mode = {
      kind: 'boxSelect',
      origin: p,
      additive: e.shiftKey,
      initial: e.shiftKey ? s.selectedIds : [],
    };
  }

  private isInsideFrame(frame: SelectionFrame, p: Point) {
    const local = rotatePoint(p, [frame.cx, frame.cy], -frame.angle);
    const pad = 4 / this.state.viewport.zoom;
    return (
      Math.abs(local[0] - frame.cx) <= frame.width / 2 + pad &&
      Math.abs(local[1] - frame.cy) <= frame.height / 2 + pad
    );
  }

  private startDrag(p: Point, e: PointerEvent, clickedId: string | null, wasSelected: boolean) {
    const selected = getSelectedElements();
    if (selected.some((x) => x.locked)) return;
    this.mode = {
      kind: 'dragging',
      start: p,
      startScreen: [e.clientX, e.clientY],
      originals: selected,
      before: takeSnapshot(),
      moved: false,
      clickedId,
      wasSelected,
      altKey: e.altKey,
    };
  }

  private moveDrag(
    mode: Extract<Mode, { kind: 'dragging' }>,
    p: Point,
    screen: Point,
    e: PointerEvent,
  ) {
    if (!mode.moved) {
      if (distance(screen, mode.startScreen) < DRAG_THRESHOLD) return;
      mode.moved = true;
      if (mode.altKey || e.altKey) {
        // Alt-drag leaves copies behind and drags the originals... as copies on top.
        const copies = duplicateElements(mode.originals, [0, 0]);
        const s = this.state;
        setState({
          elements: [...s.elements, ...copies],
          selectedIds: copies.map((c) => c.id),
        });
        mode.originals = copies;
      }
    }
    const s = this.state;
    let dx = p[0] - mode.start[0];
    let dy = p[1] - mode.start[1];
    const bounds = getCommonBounds(mode.originals);
    this.snapLines = [];
    if (bounds) {
      if (s.gridEnabled) {
        dx = snapToGrid(bounds.minX + dx) - bounds.minX;
        dy = snapToGrid(bounds.minY + dy) - bounds.minY;
      } else if (s.objectSnapping && !(e.ctrlKey || e.metaKey)) {
        const ids = new Set(mode.originals.map((o) => o.id));
        const moving: Bounds = {
          minX: bounds.minX + dx,
          minY: bounds.minY + dy,
          maxX: bounds.maxX + dx,
          maxY: bounds.maxY + dy,
        };
        const others = s.elements.filter((x) => !ids.has(x.id) && !this.isAttachedArrow(x, ids));
        const { width, height } = viewportSize();
        const { offset, lines } = snapToObjects(
          moving,
          others,
          visibleSceneBounds(s.viewport, width, height),
          8 / s.viewport.zoom,
        );
        dx += offset[0];
        dy += offset[1];
        this.snapLines = lines;
      }
    }
    const ids = new Set(mode.originals.map((o) => o.id));
    const moved = mode.originals.map((o) => {
      const m = { ...o, x: o.x + dx, y: o.y + dy, version: o.version + 1 } as SceneElement;
      if (isLinear(m)) {
        if (m.startBinding && !ids.has(m.startBinding.elementId)) m.startBinding = null;
        if (m.endBinding && !ids.has(m.endBinding.elementId)) m.endBinding = null;
      }
      return m;
    });
    const map = new Map(moved.map((m) => [m.id, m]));
    const elements = updateBoundArrows(
      s.elements.map((x) => map.get(x.id) ?? x),
      ids,
    );
    setState({ elements });
  }

  private isAttachedArrow(el: SceneElement, ids: Set<string>) {
    return (
      isLinear(el) &&
      ((el.startBinding && ids.has(el.startBinding.elementId)) ||
        (el.endBinding && ids.has(el.endBinding.elementId)))
    );
  }

  private applyTransformed(updated: SceneElement[]) {
    const map = new Map(updated.map((m) => [m.id, m]));
    const elements = updateBoundArrows(
      this.state.elements.map((x) => map.get(x.id) ?? x),
      new Set(map.keys()),
    );
    setState({ elements });
  }

  private hitLinearPoint(el: LinearElement, p: Point) {
    const r = 10 / this.state.viewport.zoom;
    const pts = getAbsolutePoints(el);
    for (let i = pts.length - 1; i >= 0; i--) if (distance(pts[i], p) <= r) return i;
    return null;
  }

  private hitLinearMidpoint(el: LinearElement, p: Point) {
    const r = 9 / this.state.viewport.zoom;
    const mids = getLinearMidpoints(el, this.state.viewport.zoom);
    for (let i = 0; i < mids.length; i++) {
      const m = mids[i];
      if (m && distance(m, p) <= r) return i;
    }
    return null;
  }

  private movePoint(mode: Extract<Mode, { kind: 'pointDrag' }>, p: Point, e: PointerEvent) {
    const s = this.state;
    const el = s.elements.find((x) => x.id === mode.id);
    if (!el || !isLinear(el)) return;
    const pts = getAbsolutePoints(el);
    let target = this.maybeGrid(p);
    const isEnd = mode.index === 0 || mode.index === pts.length - 1;
    const neighbor = pts[mode.index === 0 ? 1 : mode.index - 1];
    if (e.shiftKey && neighbor) target = this.snapAngleFrom(neighbor, target);
    let startBinding = el.startBinding;
    let endBinding = el.endBinding;
    this.bindTarget = null;
    if (isEnd && el.type === 'arrow') {
      const bindable =
        e.ctrlKey || e.metaKey
          ? null
          : getBindableElementAt(s.elements, p, s.viewport.zoom, new Set([el.id]));
      this.bindTarget = bindable;
      const binding = bindable ? { elementId: bindable.id } : null;
      if (mode.index === 0) startBinding = binding;
      else endBinding = binding;
    }
    pts[mode.index] = target;
    const updated = normalizePoints({
      ...el,
      x: 0,
      y: 0,
      points: pts,
      startBinding,
      endBinding,
      version: el.version + 1,
    });
    // Keep the *other* bound end glued while dragging.
    const byId = new Map(s.elements.map((x) => [x.id, x]));
    const glued =
      (mode.index === 0 ? endBinding : startBinding) || this.bindTarget
        ? updateLinearBindings(updated, byId)
        : updated;
    this.replaceElements([glued]);
    this.requestInteractiveRender();
  }

  private updateHover(p: Point, e: PointerEvent) {
    const s = this.state;
    if (s.tool !== 'select' || s.viewMode || this.spaceDown || e.pointerType === 'touch') {
      if (this.hoveredId) {
        this.hoveredId = null;
        this.requestInteractiveRender();
      }
      return;
    }
    const zoom = s.viewport.zoom;
    const selected = getSelectedElements(s);
    let cursor = 'default';
    let hoveredPoint: number | null = null;
    let hoveredMidpoint: number | null = null;

    const single = selected.length === 1 ? selected[0] : null;
    if (single && isLinear(single) && !single.locked) {
      hoveredPoint = this.hitLinearPoint(single, p);
      hoveredMidpoint = hoveredPoint === null ? this.hitLinearMidpoint(single, p) : null;
      if (hoveredPoint !== null || hoveredMidpoint !== null) cursor = 'pointer';
    }
    const frame = getSelectionFrame(selected);
    if (
      cursor === 'default' &&
      frame &&
      !(single && isLinear(single)) &&
      !selected.some((x) => x.locked)
    ) {
      const handle = hitTestHandles(getTransformHandles(frame, zoom), p, zoom);
      if (handle) cursor = cursorForHandle(handle, frame.angle);
      else if (this.isInsideFrame(frame, p)) cursor = 'move';
    }
    const hit = getElementAtPoint(s.elements, p, this.threshold(e.pointerType));
    if (cursor === 'default' && hit) cursor = 'move';
    const hoveredId = hit?.id ?? null;
    if (
      hoveredId !== this.hoveredId ||
      hoveredPoint !== this.hoveredPoint ||
      hoveredMidpoint !== this.hoveredMidpoint
    ) {
      this.hoveredId = hoveredId;
      this.hoveredPoint = hoveredPoint;
      this.hoveredMidpoint = hoveredMidpoint;
      this.requestInteractiveRender();
    }
    this.setCursor(cursor);
  }

  // ------------------------------------------------------------------------------------------
  // Creation tools
  // ------------------------------------------------------------------------------------------

  private startBox(p: Point) {
    const s = this.state;
    const before = takeSnapshot();
    const origin = this.maybeGrid(p);
    const el = createElement(s.tool as 'rectangle', origin[0], origin[1], s.currentStyle);
    setState({ elements: [...s.elements, el], selectedIds: [el.id] });
    this.mode = { kind: 'creatingBox', id: el.id, origin, before };
  }

  private moveBox(mode: Extract<Mode, { kind: 'creatingBox' }>, raw: Point, e: PointerEvent) {
    const p = this.maybeGrid(raw);
    let w = p[0] - mode.origin[0];
    let h = p[1] - mode.origin[1];
    if (e.shiftKey) {
      const m = Math.max(Math.abs(w), Math.abs(h));
      w = m * Math.sign(w || 1);
      h = m * Math.sign(h || 1);
    }
    let x = mode.origin[0];
    let y = mode.origin[1];
    if (e.altKey) {
      x -= w;
      y -= h;
      w *= 2;
      h *= 2;
    }
    this.updateElement(mode.id, (el) => ({
      ...el,
      x: Math.min(x, x + w),
      y: Math.min(y, y + h),
      width: Math.abs(w),
      height: Math.abs(h),
      version: el.version + 1,
    }));
  }

  private startLinear(p: Point, screen: Point) {
    const s = this.state;
    const before = takeSnapshot();
    const origin = this.maybeGrid(p);
    const bindable =
      s.tool === 'arrow' ? getBindableElementAt(s.elements, p, s.viewport.zoom) : null;
    const el = createElement(s.tool as 'arrow', origin[0], origin[1], s.currentStyle, {
      points: [
        [0, 0],
        [0, 0],
      ],
      startBinding: bindable ? { elementId: bindable.id } : null,
      // Arrows default to straight; "round" edges on lines/arrows means curved through points.
    } as Partial<LinearElement>);
    setState({ elements: [...s.elements, el], selectedIds: [el.id] });
    this.mode = { kind: 'creatingLinear', id: el.id, origin, before, downScreen: screen };
  }

  private snapAngleFrom(from: Point, to: Point): Point {
    const len = distance(from, to);
    const angle = snapAngle(Math.atan2(to[1] - from[1], to[0] - from[0]));
    return [from[0] + len * Math.cos(angle), from[1] + len * Math.sin(angle)];
  }

  private moveLinearEnd(id: string, raw: Point, e: PointerEvent) {
    const s = this.state;
    const el = s.elements.find((x) => x.id === id);
    if (!el || !isLinear(el)) return;
    const pts = getAbsolutePoints(el);
    let p = this.maybeGrid(raw);
    if (e.shiftKey && pts.length >= 2) p = this.snapAngleFrom(pts[pts.length - 2], p);
    pts[pts.length - 1] = p;
    this.bindTarget = null;
    let endBinding = el.endBinding;
    if (el.type === 'arrow') {
      const bindable =
        e.ctrlKey || e.metaKey
          ? null
          : getBindableElementAt(s.elements, raw, s.viewport.zoom, new Set([el.id]));
      this.bindTarget = bindable;
      endBinding = bindable ? { elementId: bindable.id } : null;
    }
    // Keep the start glued to the outline of its shape, pointing toward the cursor.
    if (el.startBinding) {
      const startEl = s.elements.find((x) => x.id === el.startBinding!.elementId);
      if (startEl && !this.isInsideStart(startEl, p))
        pts[0] = getOutlinePoint(
          startEl,
          pts.length > 2 ? pts[1] : endBinding && this.bindTarget ? getCenter(this.bindTarget) : p,
        );
    }
    const updated = normalizePoints({
      ...el,
      x: 0,
      y: 0,
      points: pts,
      endBinding,
      version: el.version + 1,
    });
    this.replaceElements([updated]);
    this.requestInteractiveRender();
  }

  private isInsideStart(startEl: SceneElement, p: Point) {
    return hitTestElement({ ...startEl, backgroundColor: '#000' } as SceneElement, p, 0);
  }

  private addMultiPoint(p: Point, e: PointerEvent) {
    const mode = this.mode as Extract<Mode, { kind: 'linearMulti' }>;
    const el = this.state.elements.find((x) => x.id === mode.id);
    if (!el || !isLinear(el)) return;
    const pts = getAbsolutePoints(el);
    const lastFixed = pts[pts.length - 2];
    // Clicking on the last placed point (or on a bind target) finishes the line.
    if ((lastFixed && distance(lastFixed, p) < 10 / this.state.viewport.zoom) || this.bindTarget) {
      this.finishLinear(mode.id, mode.before, !this.bindTarget);
      return;
    }
    let np = this.maybeGrid(p);
    if (e.shiftKey && lastFixed) np = this.snapAngleFrom(lastFixed, np);
    pts[pts.length - 1] = np;
    pts.push(np);
    this.replaceElements([
      normalizePoints({ ...el, x: 0, y: 0, points: pts, version: el.version + 1 }),
    ]);
  }

  /** Completes a line/arrow. `dropFloating` removes the point that was following the cursor. */
  finishLinear(id: string, before: Snapshot, dropFloating: boolean) {
    const s = this.state;
    const el = s.elements.find((x) => x.id === id);
    this.bindTarget = null;
    this.mode = { kind: 'idle' };
    if (!el || !isLinear(el)) return;
    let pts = getAbsolutePoints(el);
    let endBinding = el.endBinding;
    this.suppressDoubleClickUntil = performance.now() + 400;
    if (dropFloating) {
      pts = pts.slice(0, -1);
      endBinding = null;
    }
    let updated: LinearElement = normalizePoints({
      ...el,
      x: 0,
      y: 0,
      points: pts,
      endBinding,
      version: el.version + 1,
    });
    const byId = new Map(s.elements.map((x) => [x.id, x]));
    updated = updateLinearBindings(updated, byId);
    if (isElementEmpty(updated)) {
      setState({ elements: before.elements, selectedIds: before.selectedIds });
      this.finishTool();
      this.requestInteractiveRender();
      return;
    }
    this.replaceElements([updated], { selectedIds: [updated.id] });
    pushHistory(before);
    this.finishTool();
    this.requestInteractiveRender();
  }

  /** Called from the keyboard handler (Enter/Escape) while placing points. */
  finishActiveLinear() {
    if (this.mode.kind === 'linearMulti') {
      this.finishLinear(this.mode.id, this.mode.before, true);
      return true;
    }
    return false;
  }

  private startFreedraw(p: Point, e: PointerEvent) {
    const s = this.state;
    const before = takeSnapshot();
    const el = createElement('freedraw', p[0], p[1], s.currentStyle, {
      points: [[0, 0, e.pressure || 0.5]],
      simulatePressure: e.pointerType !== 'pen',
    } as Partial<FreedrawElement>);
    setState({ elements: [...s.elements, el], selectedIds: [] });
    this.mode = { kind: 'freedraw', id: el.id, before };
  }

  private finishCreation(id: string, before: Snapshot) {
    this.mode = { kind: 'idle' };
    const s = this.state;
    const el = s.elements.find((x) => x.id === id);
    if (!el || isElementEmpty(el)) {
      setState({ elements: before.elements, selectedIds: before.selectedIds });
      this.finishTool();
      return;
    }
    setState({ selectedIds: s.tool === 'freedraw' ? [] : [id] });
    pushHistory(before);
    this.finishTool();
  }

  private textPointerDown(p: Point) {
    const s = this.state;
    const hit = getElementAtPoint(s.elements, p, this.threshold());
    if (hit && (isText(hit) || (canHaveLabel(hit) && isBindable(hit)))) {
      startEditing(hit.id);
      return;
    }
    startNewText(this.maybeGrid(p));
  }

  // ------------------------------------------------------------------------------------------
  // Misc
  // ------------------------------------------------------------------------------------------

  /** Escape: stop placing points or clear the selection. */
  escape() {
    if (this.finishActiveLinear()) return;
    if (this.mode.kind !== 'idle') {
      this.cancelInProgress();
      return;
    }
    const s = this.state;
    if (s.editingGroupId) {
      const ids = s.selectedIds.length
        ? expandSelectionToGroups(s.elements, s.selectedIds, null)
        : new Set<string>();
      setState({ editingGroupId: null, selectedIds: [...ids] });
      return;
    }
    if (s.tool !== 'select' && !s.toolLocked) setState({ tool: 'select' });
    deselect();
    this.updateCursor();
  }

  pointerScene() {
    return getPointerScene();
  }

  clearHover() {
    this.hoveredId = null;
    this.hoveredPoint = null;
    this.hoveredMidpoint = null;
  }

  getErasingIds(): ReadonlySet<string> | undefined {
    return this.mode.kind === 'erasing' ? this.mode.ids : undefined;
  }
}
