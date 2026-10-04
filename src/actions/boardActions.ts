import { DEFAULT_CANVAS_BACKGROUND } from '../scene/colors';
import { DEFAULT_STYLE } from '../scene/elements';
import { downloadBlob, exportToCanvas, pickFile, safeFilename } from '../scene/export';
import { randomId } from '../scene/math';
import {
  deleteBoard as removeBoard,
  getLastBoardId,
  listBoards,
  loadBoard,
  loadPrefs,
  renameBoard as persistRename,
  saveBoard,
  savePrefs,
  setLastBoardId,
  type BoardMeta,
} from '../scene/persistence';
import { parseBoardFile, serializeBoard } from '../scene/serialize';
import { clearShareHash, readSharedBoardFromHash, type SharedBoard } from '../scene/share';
import { getState, resolveTheme, setState, toast, useStore, type AppState } from '../store/store';
import type { BinaryFiles, SceneElement } from '../types';
import { insertImage, zoomToFit } from './sceneActions';

// ---------------------------------------------------------------------------------------------
// Board switching
// ---------------------------------------------------------------------------------------------

const resetView = {
  selectedIds: [],
  editingGroupId: null,
  editing: null,
  past: [],
  future: [],
  tool: 'select' as const,
};

const applyBoard = (
  id: string,
  name: string,
  data: { elements: SceneElement[]; files: BinaryFiles; background: string },
) => {
  setState({
    boardId: id,
    boardName: name,
    elements: data.elements,
    files: data.files,
    background: data.background || DEFAULT_CANVAS_BACKGROUND,
    ...resetView,
  });
  setLastBoardId(id);
  zoomToFit();
};

export const flushSave = async () => {
  if (saveTimer || thumbTimer) {
    clearTimeout(saveTimer);
    clearTimeout(thumbTimer);
    saveTimer = 0;
    thumbTimer = 0;
    await persistNow(thumbDirty);
  }
};

export const createBoard = async (
  name = 'Untitled board',
  data: { elements: SceneElement[]; files?: BinaryFiles; background?: string } = { elements: [] },
) => {
  await flushSave();
  const id = randomId();
  applyBoard(id, name, {
    elements: data.elements,
    files: data.files ?? {},
    background: data.background ?? DEFAULT_CANVAS_BACKGROUND,
  });
  await persistNow(true);
  return id;
};

export const switchBoard = async (id: string) => {
  if (id === getState().boardId) return;
  await flushSave();
  const data = await loadBoard(id);
  const meta = (await listBoards()).find((b) => b.id === id);
  if (!data || !meta) {
    toast('That board could not be opened', 'error');
    return;
  }
  applyBoard(id, meta.name, data);
};

export const renameCurrentBoard = (name: string) => {
  const trimmed = name.trim().slice(0, 120) || 'Untitled board';
  setState({ boardName: trimmed });
  void persistRename(getState().boardId, trimmed);
};

export const deleteBoardById = async (id: string) => {
  await removeBoard(id);
  if (id === getState().boardId) {
    const rest = await listBoards();
    if (rest.length) await switchBoard(rest[0].id);
    else await createBoard();
  }
  boardsChanged();
};

export const duplicateBoard = async (id: string) => {
  const data = await loadBoard(id);
  const meta = (await listBoards()).find((b) => b.id === id);
  if (!data || !meta) return;
  await createBoard(`${meta.name} (copy)`, data);
  boardsChanged();
};

// ---------------------------------------------------------------------------------------------
// Autosave
// ---------------------------------------------------------------------------------------------

let saveTimer = 0;
let thumbTimer = 0;
let thumbDirty = false;
let lastThumbAt = 0;
const boardListeners = new Set<() => void>();
export const onBoardsChanged = (fn: () => void) => {
  boardListeners.add(fn);
  return () => {
    boardListeners.delete(fn);
  };
};
const boardsChanged = () => boardListeners.forEach((fn) => fn());

const makeThumbnail = async (s: AppState) => {
  if (!s.elements.length) return '';
  try {
    const canvas = await exportToCanvas(s.elements, s.files, {
      background: true,
      canvasBackground: s.background,
      theme: 'light',
      scale: 1,
      padding: 24,
    });
    const target = document.createElement('canvas');
    target.width = 320;
    target.height = 200;
    const ctx = target.getContext('2d')!;
    ctx.fillStyle = s.background;
    ctx.fillRect(0, 0, 320, 200);
    const scale = Math.min(320 / canvas.width, 200 / canvas.height, 1.5);
    const w = canvas.width * scale;
    const h = canvas.height * scale;
    ctx.drawImage(canvas, (320 - w) / 2, (200 - h) / 2, w, h);
    return target.toDataURL('image/webp', 0.7);
  } catch {
    return undefined;
  }
};

const persistNow = async (forceThumb = false) => {
  const s = getState();
  if (!s.boardId) return;
  // Thumbnails are throttled, with a trailing refresh so the final state is always captured.
  let thumbnail: string | undefined;
  if (forceThumb || (thumbDirty && Date.now() - lastThumbAt > 2000)) {
    clearTimeout(thumbTimer);
    thumbTimer = 0;
    thumbDirty = false;
    lastThumbAt = Date.now();
    thumbnail = await makeThumbnail(s);
  } else if (thumbDirty && !thumbTimer) {
    thumbTimer = window.setTimeout(() => {
      thumbTimer = 0;
      void persistNow(true);
    }, 2200);
  }
  try {
    await saveBoard(
      {
        id: s.boardId,
        name: s.boardName,
        updatedAt: Date.now(),
        elementCount: s.elements.length,
        thumbnail,
      },
      { elements: s.elements, files: s.files, background: s.background },
    );
    boardsChanged();
  } catch {
    toast('Could not save — browser storage may be full', 'error');
  }
};

const scheduleSave = () => {
  thumbDirty = true;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = 0;
    void persistNow();
  }, 500);
};

interface Prefs {
  themePreference: AppState['themePreference'];
  gridEnabled: boolean;
  objectSnapping: boolean;
  currentStyle: AppState['currentStyle'];
  minimapOpen: boolean;
}

const startAutosave = () => {
  useStore.subscribe((s, prev) => {
    if (!s.ready) return;
    if (
      s.boardId === prev.boardId &&
      (s.elements !== prev.elements ||
        s.files !== prev.files ||
        s.background !== prev.background ||
        s.boardName !== prev.boardName) &&
      !s.editing
    ) {
      scheduleSave();
    }
    if (
      s.themePreference !== prev.themePreference ||
      s.gridEnabled !== prev.gridEnabled ||
      s.objectSnapping !== prev.objectSnapping ||
      s.currentStyle !== prev.currentStyle ||
      s.minimapOpen !== prev.minimapOpen
    ) {
      const prefs: Prefs = {
        themePreference: s.themePreference,
        gridEnabled: s.gridEnabled,
        objectSnapping: s.objectSnapping,
        currentStyle: s.currentStyle,
        minimapOpen: s.minimapOpen,
      };
      savePrefs(prefs);
    }
  });
  window.addEventListener('beforeunload', () => {
    if (saveTimer) void persistNow();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushSave();
  });
};

// ---------------------------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------------------------

let pendingShared: SharedBoard | null = null;
export const getPendingShared = () => pendingShared;

export const initApp = async () => {
  const prefs = loadPrefs<Prefs>();
  const themePreference = prefs.themePreference ?? 'system';
  setState({
    themePreference,
    theme: resolveTheme(themePreference),
    gridEnabled: prefs.gridEnabled ?? false,
    objectSnapping: prefs.objectSnapping ?? true,
    currentStyle: { ...DEFAULT_STYLE, ...prefs.currentStyle },
    minimapOpen: prefs.minimapOpen ?? false,
  });

  const lastId = getLastBoardId();
  const boards = await listBoards();
  const meta = boards.find((b) => b.id === lastId) ?? boards[0];
  const data = meta ? await loadBoard(meta.id) : null;
  if (meta && data) applyBoard(meta.id, meta.name, data);
  else {
    const id = randomId();
    applyBoard(id, 'Untitled board', {
      elements: [],
      files: {},
      background: DEFAULT_CANVAS_BACKGROUND,
    });
  }

  pendingShared = readSharedBoardFromHash();
  setState({ ready: true, dialog: pendingShared ? 'importShared' : null });
  startAutosave();
  if (!meta) void persistNow(true);

  window.addEventListener('hashchange', () => {
    const shared = readSharedBoardFromHash();
    if (shared) {
      pendingShared = shared;
      setState({ dialog: 'importShared' });
    }
  });
};

export const acceptSharedBoard = async () => {
  const shared = pendingShared;
  pendingShared = null;
  clearShareHash();
  if (!shared) return;
  await createBoard(shared.name, { elements: shared.elements, background: shared.background });
  setState({ dialog: null, viewMode: shared.viewOnly, tool: shared.viewOnly ? 'hand' : 'select' });
  toast(
    shared.viewOnly ? 'Opened in view-only mode' : 'Shared board saved to your boards',
    'success',
  );
};

export const dismissSharedBoard = () => {
  pendingShared = null;
  clearShareHash();
  setState({ dialog: null });
};

// ---------------------------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------------------------

export const saveToFile = () => {
  const s = getState();
  const data = serializeBoard(
    { elements: s.elements, files: s.files, background: s.background },
    s.boardName,
  );
  downloadBlob(
    new Blob([JSON.stringify(data)], { type: 'application/json' }),
    `${safeFilename(s.boardName)}.sketchboard`,
  );
  toast('Board saved to file', 'success');
};

export const loadBoardFromFile = async (file: File) => {
  try {
    const data = parseBoardFile(await file.text());
    const name = data.name || file.name.replace(/\.(sketchboard|json)$/i, '') || 'Imported board';
    await createBoard(name, data);
    toast(`Opened “${name}”`, 'success');
  } catch {
    toast('That file is not a valid board', 'error');
  }
};

export const openFromFile = async () => {
  const file = await pickFile('.sketchboard,.json,application/json');
  if (file) await loadBoardFromFile(file);
};

/** Handles files dropped onto the canvas: boards open, images get inserted. */
export const handleDroppedFile = async (file: File, at?: [number, number]) => {
  if (file.type.startsWith('image/')) {
    await insertImage(file, at);
  } else if (/\.(sketchboard|json)$/i.test(file.name) || file.type === 'application/json') {
    await loadBoardFromFile(file);
  } else {
    toast('Unsupported file type', 'warning');
  }
};

export type { BoardMeta };
export { listBoards };
