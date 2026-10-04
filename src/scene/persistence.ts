import { createStore, del, get, set } from 'idb-keyval';
import type { BinaryFiles, SceneElement } from '../types';
import { restoreElements, restoreFiles } from './serialize';

/**
 * Boards live in IndexedDB. Every GitHub Pages project of a user shares one origin
 * (<user>.github.io), so storage keys are namespaced by the deployment path to keep different
 * deployments of this app from overwriting each other.
 */
const NAMESPACE = `sketchboard:${window.location.pathname.replace(/[^/]*$/, '') || '/'}`;
const store = createStore(`${NAMESPACE}:db`, 'kv');

export interface BoardMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  elementCount: number;
  thumbnail?: string;
}

export interface StoredBoard {
  elements: SceneElement[];
  files: BinaryFiles;
  background: string;
}

const INDEX_KEY = 'boards';
const boardKey = (id: string) => `board:${id}`;

export const listBoards = async (): Promise<BoardMeta[]> => {
  try {
    const list = (await get<BoardMeta[]>(INDEX_KEY, store)) ?? [];
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
};

export const loadBoard = async (id: string): Promise<StoredBoard | null> => {
  try {
    const data = await get<StoredBoard>(boardKey(id), store);
    if (!data) return null;
    return {
      elements: restoreElements(data.elements),
      files: restoreFiles(data.files),
      background: data.background,
    };
  } catch {
    return null;
  }
};

let writeChain: Promise<unknown> = Promise.resolve();

/** Serialized writes so a fast sequence of saves can't interleave index updates. */
export const saveBoard = (meta: Omit<BoardMeta, 'createdAt'>, data: StoredBoard) => {
  writeChain = writeChain.then(async () => {
    await set(boardKey(meta.id), data, store);
    const list = (await get<BoardMeta[]>(INDEX_KEY, store)) ?? [];
    const existing = list.find((b) => b.id === meta.id);
    const next: BoardMeta = {
      createdAt: existing?.createdAt ?? Date.now(),
      ...existing,
      ...meta,
      thumbnail: meta.thumbnail ?? existing?.thumbnail,
    };
    await set(INDEX_KEY, [next, ...list.filter((b) => b.id !== meta.id)], store);
  });
  return writeChain;
};

export const renameBoard = (id: string, name: string) => {
  writeChain = writeChain.then(async () => {
    const list = (await get<BoardMeta[]>(INDEX_KEY, store)) ?? [];
    await set(
      INDEX_KEY,
      list.map((b) => (b.id === id ? { ...b, name } : b)),
      store,
    );
  });
  return writeChain;
};

export const deleteBoard = (id: string) => {
  writeChain = writeChain.then(async () => {
    await del(boardKey(id), store);
    const list = (await get<BoardMeta[]>(INDEX_KEY, store)) ?? [];
    await set(
      INDEX_KEY,
      list.filter((b) => b.id !== id),
      store,
    );
  });
  return writeChain;
};

// Small UI preferences go to localStorage (synchronous, so the first paint is already right).
const PREFS_KEY = `${NAMESPACE}:prefs`;
const LAST_BOARD_KEY = `${NAMESPACE}:lastBoard`;
const TUTORIAL_KEY = `${NAMESPACE}:tutorialDone`;

export const loadPrefs = <T>(): Partial<T> => {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
  } catch {
    return {};
  }
};

export const savePrefs = (prefs: object) => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or disabled — preferences just won't persist.
  }
};

export const getLastBoardId = () => {
  try {
    return localStorage.getItem(LAST_BOARD_KEY);
  } catch {
    return null;
  }
};

export const setLastBoardId = (id: string) => {
  try {
    localStorage.setItem(LAST_BOARD_KEY, id);
  } catch {
    // ignore
  }
};

export const isTutorialDone = () => {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === '1';
  } catch {
    return false;
  }
};

export const setTutorialDone = () => {
  try {
    localStorage.setItem(TUTORIAL_KEY, '1');
  } catch {
    // ignore
  }
};
