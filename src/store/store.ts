import { create } from 'zustand';
import { DEFAULT_CANVAS_BACKGROUND } from '../scene/colors';
import { DEFAULT_STYLE } from '../scene/elements';
import type {
  BinaryFiles,
  ElementStyle,
  SceneElement,
  ThemeMode,
  ToolType,
  Viewport,
} from '../types';

export type DialogId =
  | 'export'
  | 'share'
  | 'shortcuts'
  | 'tutorial'
  | 'commands'
  | 'boards'
  | 'templates'
  | 'importShared'
  | null;

export type ThemePreference = ThemeMode | 'system';

export interface Toast {
  id: number;
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error';
}

export interface ContextMenuState {
  x: number;
  y: number;
  sceneX: number;
  sceneY: number;
  /** Whether it was opened over an element (vs. the empty canvas). */
  onElement: boolean;
}

export interface Snapshot {
  elements: SceneElement[];
  selectedIds: string[];
}

export interface EditingState {
  id: string;
  isNew: boolean;
  /** Scene before editing started — pushed to history when editing ends. */
  before: Snapshot;
}

export interface AppState {
  // Scene
  elements: SceneElement[];
  files: BinaryFiles;
  background: string;
  boardId: string;
  boardName: string;

  // View
  viewport: Viewport;
  theme: ThemeMode;
  themePreference: ThemePreference;
  gridEnabled: boolean;
  objectSnapping: boolean;
  zenMode: boolean;
  viewMode: boolean;
  minimapOpen: boolean;

  // Tools & selection
  tool: ToolType;
  toolLocked: boolean;
  currentStyle: ElementStyle;
  selectedIds: string[];
  editingGroupId: string | null;
  editing: EditingState | null;

  // UI
  dialog: DialogId;
  contextMenu: ContextMenuState | null;
  toasts: Toast[];
  ready: boolean;

  // History
  past: Snapshot[];
  future: Snapshot[];
}

const HISTORY_LIMIT = 200;

const prefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export const resolveTheme = (pref: ThemePreference): ThemeMode =>
  pref === 'system' ? (prefersDark() ? 'dark' : 'light') : pref;

export const initialState: AppState = {
  elements: [],
  files: {},
  background: DEFAULT_CANVAS_BACKGROUND,
  boardId: '',
  boardName: 'Untitled board',

  viewport: { scrollX: 0, scrollY: 0, zoom: 1 },
  theme: resolveTheme('system'),
  themePreference: 'system',
  gridEnabled: false,
  objectSnapping: true,
  zenMode: false,
  viewMode: false,
  minimapOpen: false,

  tool: 'select',
  toolLocked: false,
  currentStyle: DEFAULT_STYLE,
  selectedIds: [],
  editingGroupId: null,
  editing: null,

  dialog: null,
  contextMenu: null,
  toasts: [],
  ready: false,

  past: [],
  future: [],
};

export const useStore = create<AppState>()(() => initialState);

export const getState = useStore.getState;
export const setState = useStore.setState;

// ---------------------------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------------------------

const snapshot = (): Snapshot => {
  const { elements, selectedIds } = getState();
  return { elements, selectedIds };
};

/** Records `before` as an undo step if the scene has changed since. */
export const pushHistory = (before: Snapshot) => {
  const { elements, past } = getState();
  if (before.elements === elements) return;
  const nextPast = [...past, before];
  if (nextPast.length > HISTORY_LIMIT) nextPast.shift();
  setState({ past: nextPast, future: [] });
};

/**
 * Replaces the scene. With `history: true` (default) the previous state becomes an undo step;
 * transient updates during a drag pass `history: false` and call `pushHistory` once at the end.
 */
let lastCoalesce: { key: string; at: number } | null = null;

export const setElements = (
  elements: SceneElement[],
  opts: { history?: boolean; selectedIds?: string[]; coalesceKey?: string } = {},
) => {
  const before = snapshot();
  setState({
    elements,
    ...(opts.selectedIds ? { selectedIds: opts.selectedIds } : {}),
  });
  if (opts.history === false) return;
  // Rapid repeats of the same edit (dragging a slider or color picker) become one undo step.
  const now = Date.now();
  if (opts.coalesceKey && lastCoalesce?.key === opts.coalesceKey && now - lastCoalesce.at < 800) {
    lastCoalesce.at = now;
    return;
  }
  lastCoalesce = opts.coalesceKey ? { key: opts.coalesceKey, at: now } : null;
  pushHistory(before);
};

export const undo = () => {
  const { past, future, editing } = getState();
  if (editing || !past.length) return;
  const prev = past[past.length - 1];
  const current = snapshot();
  const ids = new Set(prev.elements.map((e) => e.id));
  setState({
    elements: prev.elements,
    selectedIds: prev.selectedIds.filter((id) => ids.has(id)),
    past: past.slice(0, -1),
    future: [current, ...future],
  });
};

export const redo = () => {
  const { past, future, editing } = getState();
  if (editing || !future.length) return;
  const next = future[0];
  const current = snapshot();
  const ids = new Set(next.elements.map((e) => e.id));
  setState({
    elements: next.elements,
    selectedIds: next.selectedIds.filter((id) => ids.has(id)),
    past: [...past, current],
    future: future.slice(1),
  });
};

export const takeSnapshot = snapshot;

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------

let toastId = 0;
export const toast = (message: string, severity: Toast['severity'] = 'info') => {
  const id = ++toastId;
  setState((s) => ({ toasts: [...s.toasts, { id, message, severity }] }));
  window.setTimeout(() => {
    setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  }, 3600);
};

export const openDialog = (dialog: DialogId) => setState({ dialog, contextMenu: null });
export const closeDialog = () => setState({ dialog: null });

export const getSelectedElements = (state: AppState = getState()) => {
  const ids = new Set(state.selectedIds);
  return state.elements.filter((e) => ids.has(e.id));
};
