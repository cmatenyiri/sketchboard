import { cleanupBindings, updateBoundArrows } from '../scene/binding';
import { DEFAULT_CANVAS_BACKGROUND } from '../scene/colors';
import {
  createElement,
  duplicateElements,
  expandSelectionToGroups,
  fitContainerToLabel,
  getCommonBounds,
  getOutermostGroupId,
  isLinear,
  isText,
  refreshTextDimensions,
  STYLE_KEYS,
} from '../scene/elements';
import { randomId } from '../scene/math';
import { flipElements } from '../scene/transform';
import { fitBounds, nextZoomStep, screenToScene, zoomAt } from '../scene/viewport';
import {
  getSelectedElements,
  getState,
  resolveTheme,
  setElements,
  setState,
  toast,
  type ThemePreference,
} from '../store/store';
import type {
  BinaryFiles,
  Bounds,
  ElementStyle,
  ImageElement,
  Point,
  SceneElement,
  ToolType,
} from '../types';

// ---------------------------------------------------------------------------------------------
// Pointer position (kept here so paste/insert can target where the cursor is)
// ---------------------------------------------------------------------------------------------

let lastPointerScreen: Point | null = null;
export const setLastPointer = (p: Point) => {
  lastPointerScreen = p;
};

export const viewportSize = () => ({ width: window.innerWidth, height: window.innerHeight });

export const getViewportCenterScene = (): Point => {
  const { width, height } = viewportSize();
  return screenToScene([width / 2, height / 2], getState().viewport);
};

export const getPointerScene = (): Point =>
  lastPointerScreen
    ? screenToScene(lastPointerScreen, getState().viewport)
    : getViewportCenterScene();

// ---------------------------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------------------------

export const setTool = (tool: ToolType) => {
  const s = getState();
  if (s.viewMode && tool !== 'hand' && tool !== 'laser' && tool !== 'select') return;
  if (tool === 'image') {
    pickImageFile();
    return;
  }
  setState({
    tool,
    selectedIds: tool === 'select' || tool === 'hand' || tool === 'laser' ? s.selectedIds : [],
    editingGroupId: null,
  });
};

export const toggleToolLock = () => setState((s) => ({ toolLocked: !s.toolLocked }));

// ---------------------------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------------------------

export const selectAll = () => {
  const { elements } = getState();
  setState({
    tool: 'select',
    selectedIds: elements.filter((e) => !e.locked).map((e) => e.id),
    editingGroupId: null,
  });
};

export const deselect = () => setState({ selectedIds: [], editingGroupId: null });

export const deleteSelected = () => {
  const { elements, selectedIds } = getState();
  if (!selectedIds.length) return;
  const ids = new Set(selectedIds);
  setElements(cleanupBindings(elements.filter((e) => !ids.has(e.id))), { selectedIds: [] });
};

export const duplicateSelected = () => {
  const { elements } = getState();
  const selected = getSelectedElements();
  if (!selected.length) return;
  const copies = duplicateElements(selected);
  setElements([...elements, ...copies], { selectedIds: copies.map((c) => c.id) });
};

// ---------------------------------------------------------------------------------------------
// Style
// ---------------------------------------------------------------------------------------------

/** Applies a style change to the selection (and remembers it for the next element drawn). */
export const updateStyle = (patch: Partial<ElementStyle>) => {
  const { elements, selectedIds, currentStyle } = getState();
  setState({ currentStyle: { ...currentStyle, ...patch } });
  if (!selectedIds.length) return;
  const ids = new Set(selectedIds);
  let changed = false;
  let next = elements.map((el) => {
    if (!ids.has(el.id)) return el;
    changed = true;
    let updated = { ...el, ...patch, version: el.version + 1 } as SceneElement;
    // Arrowheads only make sense on arrows.
    if (!isLinear(updated) || updated.type === 'line') {
      updated = {
        ...updated,
        startArrowhead: el.startArrowhead,
        endArrowhead: el.endArrowhead,
      } as SceneElement;
    }
    if (isText(updated) && ('fontSize' in patch || 'fontFamily' in patch || 'textAlign' in patch))
      updated = refreshTextDimensions(updated);
    if (updated.text && ('fontSize' in patch || 'fontFamily' in patch))
      updated = fitContainerToLabel(updated);
    return updated;
  });
  if (!changed) return;
  next = updateBoundArrows(next, ids);
  setElements(next, {
    coalesceKey: `style:${selectedIds.join(',')}:${Object.keys(patch).join(',')}`,
  });
};

let copiedStyle: Partial<ElementStyle> | null = null;

export const copyStyles = () => {
  const [first] = getSelectedElements();
  if (!first) return;
  copiedStyle = Object.fromEntries(STYLE_KEYS.map((k) => [k, first[k]])) as Partial<ElementStyle>;
  toast('Styles copied');
};

export const pasteStyles = () => {
  if (!copiedStyle) {
    toast('Copy styles from an element first', 'warning');
    return;
  }
  updateStyle(copiedStyle);
};

// ---------------------------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------------------------

const reorder = (mode: 'forward' | 'backward' | 'front' | 'back') => {
  const { elements, selectedIds } = getState();
  if (!selectedIds.length) return;
  const ids = expandSelectionToGroups(elements, selectedIds, getState().editingGroupId);
  const arr = [...elements];
  if (mode === 'front' || mode === 'back') {
    const sel = arr.filter((e) => ids.has(e.id));
    const rest = arr.filter((e) => !ids.has(e.id));
    setElements(mode === 'front' ? [...rest, ...sel] : [...sel, ...rest]);
    return;
  }
  if (mode === 'forward') {
    for (let i = arr.length - 2; i >= 0; i--) {
      if (ids.has(arr[i].id) && !ids.has(arr[i + 1].id)) {
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
      }
    }
  } else {
    for (let i = 1; i < arr.length; i++) {
      if (ids.has(arr[i].id) && !ids.has(arr[i - 1].id)) {
        [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
      }
    }
  }
  setElements(arr);
};

export const bringForward = () => reorder('forward');
export const sendBackward = () => reorder('backward');
export const bringToFront = () => reorder('front');
export const sendToBack = () => reorder('back');

// ---------------------------------------------------------------------------------------------
// Groups & locking
// ---------------------------------------------------------------------------------------------

export const groupSelected = () => {
  const { elements, selectedIds, editingGroupId } = getState();
  if (selectedIds.length < 2) return;
  const ids = new Set(selectedIds);
  const groupId = randomId();
  const next = elements.map((el) => {
    if (!ids.has(el.id)) return el;
    // Insert the new group just outside the group currently being edited.
    const idx = editingGroupId ? el.groupIds.indexOf(editingGroupId) : -1;
    const groupIds =
      idx >= 0
        ? [...el.groupIds.slice(0, idx), groupId, ...el.groupIds.slice(idx)]
        : [...el.groupIds, groupId];
    return { ...el, groupIds, version: el.version + 1 };
  });
  // Keep grouped elements contiguous in z-order, at the position of the topmost member.
  const members = next.filter((e) => ids.has(e.id));
  const lastIndex = Math.max(...next.map((e, i) => (ids.has(e.id) ? i : -1)));
  const reordered: SceneElement[] = [];
  next.forEach((e, i) => {
    if (ids.has(e.id)) {
      if (i === lastIndex) reordered.push(...members);
    } else reordered.push(e);
  });
  setElements(reordered);
};

export const ungroupSelected = () => {
  const { elements, selectedIds, editingGroupId } = getState();
  const selected = elements.filter((e) => selectedIds.includes(e.id));
  const groups = new Set(
    selected.map((e) => getOutermostGroupId(e, editingGroupId)).filter(Boolean) as string[],
  );
  if (!groups.size) return;
  setElements(
    elements.map((el) =>
      el.groupIds.some((g) => groups.has(g))
        ? { ...el, groupIds: el.groupIds.filter((g) => !groups.has(g)), version: el.version + 1 }
        : el,
    ),
  );
};

export const toggleLockSelected = () => {
  const { elements, selectedIds } = getState();
  if (!selectedIds.length) return;
  const ids = new Set(selectedIds);
  const lock = elements.some((e) => ids.has(e.id) && !e.locked);
  setElements(
    elements.map((el) => (ids.has(el.id) ? { ...el, locked: lock, version: el.version + 1 } : el)),
    { selectedIds: lock ? [] : selectedIds },
  );
  toast(lock ? 'Locked — right-click to unlock' : 'Unlocked');
};

export const unlockAll = () => {
  const { elements } = getState();
  const locked = elements.filter((e) => e.locked);
  if (!locked.length) return;
  setElements(
    elements.map((el) => (el.locked ? { ...el, locked: false, version: el.version + 1 } : el)),
    { selectedIds: locked.map((e) => e.id) },
  );
};

// ---------------------------------------------------------------------------------------------
// Align / distribute / flip
// ---------------------------------------------------------------------------------------------

interface Unit {
  ids: Set<string>;
  bounds: Bounds;
}

const selectionUnits = (): Unit[] => {
  const { editingGroupId } = getState();
  const selected = getSelectedElements();
  const byGroup = new Map<string, SceneElement[]>();
  for (const el of selected) {
    const key = getOutermostGroupId(el, editingGroupId) ?? el.id;
    byGroup.set(key, [...(byGroup.get(key) ?? []), el]);
  }
  return [...byGroup.values()].map((els) => ({
    ids: new Set(els.map((e) => e.id)),
    bounds: getCommonBounds(els)!,
  }));
};

const translateUnits = (offsets: Map<string, Point>) => {
  const { elements } = getState();
  const moved = new Set<string>();
  let next = elements.map((el) => {
    const o = offsets.get(el.id);
    if (!o || (!o[0] && !o[1])) return el;
    moved.add(el.id);
    return { ...el, x: el.x + o[0], y: el.y + o[1], version: el.version + 1 };
  });
  next = updateBoundArrows(next, moved);
  setElements(next);
};

export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom';

export const alignSelected = (mode: AlignMode) => {
  const units = selectionUnits();
  if (units.length < 2) return;
  const all = units.map((u) => u.bounds);
  const common = {
    minX: Math.min(...all.map((b) => b.minX)),
    minY: Math.min(...all.map((b) => b.minY)),
    maxX: Math.max(...all.map((b) => b.maxX)),
    maxY: Math.max(...all.map((b) => b.maxY)),
  };
  const offsets = new Map<string, Point>();
  for (const u of units) {
    const b = u.bounds;
    let dx = 0;
    let dy = 0;
    if (mode === 'left') dx = common.minX - b.minX;
    if (mode === 'right') dx = common.maxX - b.maxX;
    if (mode === 'centerX') dx = (common.minX + common.maxX) / 2 - (b.minX + b.maxX) / 2;
    if (mode === 'top') dy = common.minY - b.minY;
    if (mode === 'bottom') dy = common.maxY - b.maxY;
    if (mode === 'centerY') dy = (common.minY + common.maxY) / 2 - (b.minY + b.maxY) / 2;
    for (const id of u.ids) offsets.set(id, [dx, dy]);
  }
  translateUnits(offsets);
};

export const distributeSelected = (axis: 'x' | 'y') => {
  const units = selectionUnits();
  if (units.length < 3) return;
  const min = axis === 'x' ? 'minX' : 'minY';
  const max = axis === 'x' ? 'maxX' : 'maxY';
  const sorted = [...units].sort((a, b) => a.bounds[min] - b.bounds[min]);
  const start = sorted[0].bounds[min];
  const end = Math.max(...sorted.map((u) => u.bounds[max]));
  const total = sorted.reduce((acc, u) => acc + (u.bounds[max] - u.bounds[min]), 0);
  const gap = (end - start - total) / (sorted.length - 1);
  let cursor = start;
  const offsets = new Map<string, Point>();
  for (const u of sorted) {
    const d = cursor - u.bounds[min];
    for (const id of u.ids) offsets.set(id, axis === 'x' ? [d, 0] : [0, d]);
    cursor += u.bounds[max] - u.bounds[min] + gap;
  }
  translateUnits(offsets);
};

export const flipSelected = (axis: 'horizontal' | 'vertical') => {
  const { elements, selectedIds } = getState();
  if (!selectedIds.length) return;
  const ids = new Set(selectedIds);
  const flipped = new Map(
    flipElements(
      elements.filter((e) => ids.has(e.id)),
      axis,
    ).map((e) => [e.id, e]),
  );
  setElements(
    updateBoundArrows(
      elements.map((e) => flipped.get(e.id) ?? e),
      ids,
    ),
  );
};

export const nudgeSelected = (dx: number, dy: number) => {
  const { elements, selectedIds } = getState();
  if (!selectedIds.length) return;
  const ids = new Set(selectedIds);
  const next = elements.map((el) => {
    if (!ids.has(el.id)) return el;
    const moved = { ...el, x: el.x + dx, y: el.y + dy, version: el.version + 1 };
    // Moving an arrow on its own detaches it from shapes that stay put.
    if (isLinear(moved)) {
      if (moved.startBinding && !ids.has(moved.startBinding.elementId)) moved.startBinding = null;
      if (moved.endBinding && !ids.has(moved.endBinding.elementId)) moved.endBinding = null;
    }
    return moved;
  });
  setElements(updateBoundArrows(next, ids));
};

// ---------------------------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------------------------

const CLIPBOARD_TYPE = 'sketchboard/clipboard';

interface ClipboardPayload {
  type: typeof CLIPBOARD_TYPE;
  elements: SceneElement[];
  files: BinaryFiles;
}

let memoryClipboard: ClipboardPayload | null = null;

const buildPayload = (): ClipboardPayload | null => {
  const { files } = getState();
  const selected = getSelectedElements();
  if (!selected.length) return null;
  const usedFiles: BinaryFiles = {};
  for (const el of selected) {
    if (el.type === 'image' && files[(el as ImageElement).fileId])
      usedFiles[(el as ImageElement).fileId] = files[(el as ImageElement).fileId];
  }
  return { type: CLIPBOARD_TYPE, elements: selected, files: usedFiles };
};

/** Copies the selection; inside a native copy event pass its DataTransfer (most reliable). */
export const copySelected = async (target?: DataTransfer | null) => {
  const payload = buildPayload();
  if (!payload) return;
  memoryClipboard = payload;
  const text = JSON.stringify(payload);
  if (target) {
    target.setData('text/plain', text);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard permission denied — the in-memory copy still works within the app.
  }
};

export const cutSelected = async (target?: DataTransfer | null) => {
  await copySelected(target);
  deleteSelected();
};

export const parseClipboardPayload = (text: string): ClipboardPayload | null => {
  try {
    const data = JSON.parse(text);
    if (data?.type === CLIPBOARD_TYPE && Array.isArray(data.elements)) return data;
  } catch {
    // not ours
  }
  return null;
};

export const pastePayload = (payload: ClipboardPayload | null = memoryClipboard, at?: Point) => {
  if (!payload?.elements.length) return;
  const { elements, files } = getState();
  const b = getCommonBounds(payload.elements)!;
  const target = at ?? getPointerScene();
  const offset: Point = [target[0] - (b.minX + b.maxX) / 2, target[1] - (b.minY + b.maxY) / 2];
  const copies = duplicateElements(payload.elements, offset);
  setState({ files: { ...files, ...payload.files }, tool: 'select' });
  setElements([...elements, ...copies], { selectedIds: copies.map((c) => c.id) });
};

export const pasteText = (text: string, at?: Point) => {
  const { elements, currentStyle } = getState();
  const p = at ?? getPointerScene();
  const trimmed = text.replace(/\r\n/g, '\n').trim();
  if (!trimmed) return;
  const el = refreshTextDimensions(
    createElement(
      'text',
      p[0],
      p[1],
      { ...currentStyle, textAlign: 'left' },
      {
        text: trimmed.slice(0, 5000),
      },
    ) as never,
  );
  const placed = { ...el, x: p[0] - el.width / 2, y: p[1] - el.height / 2 };
  setElements([...elements, placed], { selectedIds: [placed.id] });
};

// ---------------------------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------------------------

const MAX_IMAGE_SIDE = 1800;

const readAsDataURL = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** Downscales big images so boards stay light enough for browser storage. */
const prepareImage = async (file: Blob) => {
  let dataURL = await readAsDataURL(file);
  let img = await loadImage(dataURL);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  if (
    (scale < 1 || file.size > 1.5e6) &&
    file.type !== 'image/svg+xml' &&
    file.type !== 'image/gif'
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    dataURL = canvas.toDataURL('image/webp', 0.88);
    img = await loadImage(dataURL);
  }
  return { dataURL, width: img.naturalWidth, height: img.naturalHeight };
};

export const insertImage = async (file: Blob, at?: Point) => {
  if (!file.type.startsWith('image/')) {
    toast('That file is not an image', 'error');
    return;
  }
  try {
    const { dataURL, width, height } = await prepareImage(file);
    const fileId = randomId();
    const { elements, files, currentStyle, viewport } = getState();
    const p = at ?? getViewportCenterScene();
    // Fit into roughly half the viewport.
    const { width: vw, height: vh } = viewportSize();
    const maxW = (vw * 0.5) / viewport.zoom;
    const maxH = (vh * 0.5) / viewport.zoom;
    const s = Math.min(1, maxW / width, maxH / height);
    const w = width * s;
    const h = height * s;
    const el = createElement(
      'image',
      p[0] - w / 2,
      p[1] - h / 2,
      {
        ...currentStyle,
        roundness: 'sharp',
      },
      { width: w, height: h, fileId } as Partial<SceneElement>,
    );
    setState({
      files: { ...files, [fileId]: { id: fileId, dataURL, mimeType: file.type } },
      tool: 'select',
    });
    setElements([...elements, el], { selectedIds: [el.id] });
  } catch {
    toast('Could not load that image', 'error');
  }
};

export const pickImageFile = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) void insertImage(file);
  };
  input.click();
};

// ---------------------------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------------------------

export const zoomBy = (dir: 1 | -1) => {
  const { viewport } = getState();
  const { width, height } = viewportSize();
  setState({
    viewport: zoomAt(viewport, nextZoomStep(viewport.zoom, dir), [width / 2, height / 2]),
  });
};

export const resetZoom = () => {
  const { viewport } = getState();
  const { width, height } = viewportSize();
  setState({ viewport: zoomAt(viewport, 1, [width / 2, height / 2]) });
};

export const zoomToFit = (onlySelection = false) => {
  const { elements } = getState();
  const target = onlySelection ? getSelectedElements() : elements;
  const bounds = getCommonBounds(target);
  const { width, height } = viewportSize();
  if (!bounds) {
    setState({ viewport: { zoom: 1, scrollX: width / 2, scrollY: height / 2 } });
    return;
  }
  setState({ viewport: fitBounds(bounds, width, height, { maxZoom: onlySelection ? 3 : 1 }) });
};

export const toggleGrid = () => setState((s) => ({ gridEnabled: !s.gridEnabled }));
export const toggleSnapping = () => setState((s) => ({ objectSnapping: !s.objectSnapping }));
export const toggleZen = () => setState((s) => ({ zenMode: !s.zenMode }));
export const toggleViewMode = () =>
  setState((s) => ({
    viewMode: !s.viewMode,
    tool: s.viewMode ? 'select' : 'hand',
    selectedIds: [],
  }));
export const toggleMinimap = () => setState((s) => ({ minimapOpen: !s.minimapOpen }));

export const setThemePreference = (pref: ThemePreference) =>
  setState({ themePreference: pref, theme: resolveTheme(pref) });

export const toggleTheme = () => setThemePreference(getState().theme === 'dark' ? 'light' : 'dark');

export const setCanvasBackground = (background: string) => setState({ background });

export const clearCanvas = () => {
  const { elements } = getState();
  if (!elements.length) return;
  setElements([], { selectedIds: [] });
  setState({ background: getState().background || DEFAULT_CANVAS_BACKGROUND });
  toast('Canvas cleared — press Ctrl+Z to undo');
};

/** Adds generated elements (templates, samples) centered in view and selects them. */
export const insertElements = (newElements: SceneElement[], files: BinaryFiles = {}) => {
  const { elements } = getState();
  const b = getCommonBounds(newElements);
  if (!b) return;
  const c = getViewportCenterScene();
  const offset: Point = [c[0] - (b.minX + b.maxX) / 2, c[1] - (b.minY + b.maxY) / 2];
  const copies = duplicateElements(newElements, offset);
  setState((s) => ({ files: { ...s.files, ...files }, tool: 'select' }));
  setElements([...elements, ...copies], { selectedIds: copies.map((e) => e.id) });
  const nb = getCommonBounds(copies)!;
  const { width, height } = viewportSize();
  const vb = getElementBoundsInView();
  if (nb.maxX - nb.minX > vb.maxX - vb.minX || nb.maxY - nb.minY > vb.maxY - vb.minY)
    setState({ viewport: fitBounds(nb, width, height) });
};

const getElementBoundsInView = (): Bounds => {
  const { viewport } = getState();
  const { width, height } = viewportSize();
  return {
    minX: -viewport.scrollX,
    minY: -viewport.scrollY,
    maxX: -viewport.scrollX + width / viewport.zoom,
    maxY: -viewport.scrollY + height / viewport.zoom,
  };
};
