import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import type { SceneElement } from '../types';
import { DEFAULT_CANVAS_BACKGROUND } from './colors';
import { isImage } from './elements';
import { compactElements, expandElements } from './serialize';

const HASH_KEY = 'board';
const VIEW_FLAG = 'view';

const toBase64Url = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (s: string) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

export interface SharedBoard {
  elements: SceneElement[];
  background: string;
  name: string;
  viewOnly: boolean;
}

export interface ShareLinkResult {
  url: string;
  /** Number of image elements that were left out (images are too big for a URL). */
  skippedImages: number;
  bytes: number;
}

/** Encodes a board into a self-contained URL: JSON → deflate → base64url in the hash. */
export const createShareLink = (
  elements: readonly SceneElement[],
  background: string,
  name: string,
  viewOnly: boolean,
): ShareLinkResult => {
  const kept = elements.filter((e) => !isImage(e));
  const payload = { v: 1, n: name, b: background, e: compactElements(kept) };
  const compressed = deflateSync(strToU8(JSON.stringify(payload)), { level: 9 });
  const data = toBase64Url(compressed);
  const base = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  const url = `${base}#${HASH_KEY}=${data}${viewOnly ? `&${VIEW_FLAG}=1` : ''}`;
  return { url, skippedImages: elements.length - kept.length, bytes: compressed.length };
};

export const readSharedBoardFromHash = (hash = window.location.hash): SharedBoard | null => {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const data = params.get(HASH_KEY);
  if (!data) return null;
  try {
    const json = JSON.parse(strFromU8(inflateSync(fromBase64Url(data))));
    return {
      elements: expandElements(json.e),
      background: typeof json.b === 'string' ? json.b : DEFAULT_CANVAS_BACKGROUND,
      name: typeof json.n === 'string' && json.n.trim() ? json.n.slice(0, 120) : 'Shared board',
      viewOnly: params.get(VIEW_FLAG) === '1',
    };
  } catch {
    return null;
  }
};

export const clearShareHash = () => {
  const { pathname, search } = window.location;
  window.history.replaceState(null, '', `${pathname}${search}`);
};
