import { useEffect } from 'react';
import { ACTIONS, eventToCombo, runAction } from '../actions/registry';
import {
  insertImage,
  nudgeSelected,
  parseClipboardPayload,
  pastePayload,
  pasteText,
  copySelected,
  cutSelected,
} from '../actions/sceneActions';
import { controller } from '../canvas/instance';
import { GRID_SIZE } from '../scene/renderer';
import { getState, setState } from '../store/store';

const isTypingTarget = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  );
};

/** Actions that stay available in view-only mode. */
const VIEW_MODE_SAFE = new Set([
  'tool.hand',
  'tool.select',
  'tool.laser',
  'zoomIn',
  'zoomOut',
  'resetZoom',
  'zoomToFit',
  'toggleGrid',
  'toggleMinimap',
  'toggleZen',
  'toggleViewMode',
  'toggleTheme',
  'commandPalette',
  'shortcuts',
  'export',
  'share',
  'save',
  'boards',
  'newBoard',
  'open',
]);

// Clipboard combos are left to the native copy/cut/paste events below.
const NATIVE_COMBOS = new Set(['mod+c', 'mod+x', 'mod+v']);

const comboMap = new Map<string, string>();
for (const a of ACTIONS) for (const k of a.keys ?? []) if (!comboMap.has(k)) comboMap.set(k, a.id);

export function useKeyboard() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = getState();
      if (isTypingTarget(e.target) || s.editing) return;
      // While a dialog is open, MUI handles focus & Escape.
      if (s.dialog) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        controller.setSpace(true);
        return;
      }
      if (e.key === 'Escape') {
        if (s.contextMenu) setState({ contextMenu: null });
        else controller.escape();
        return;
      }
      if (e.key === 'Enter' && controller.finishActiveLinear()) return;

      if (
        e.key.startsWith('Arrow') &&
        s.selectedIds.length &&
        !s.viewMode &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        e.preventDefault();
        const step = e.shiftKey
          ? s.gridEnabled
            ? GRID_SIZE * 2
            : 10
          : s.gridEnabled
            ? GRID_SIZE
            : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        nudgeSelected(dx, dy);
        return;
      }

      const combo = eventToCombo(e);
      if (NATIVE_COMBOS.has(combo)) return;
      const id = comboMap.get(combo) ?? (e.key === '?' ? 'shortcuts' : undefined);
      if (!id) return;
      if (s.viewMode && !VIEW_MODE_SAFE.has(id)) return;
      // Don't hijack single-letter keys while the controller is mid-gesture.
      if (controller.isBusy() && !combo.includes('mod')) return;
      e.preventDefault();
      runAction(id);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') controller.setSpace(false);
    };

    const onBlur = () => controller.setSpace(false);

    const onCopy = (e: ClipboardEvent) => {
      if (isTypingTarget(e.target) || getState().editing || getState().dialog) return;
      if (!getState().selectedIds.length) return;
      e.preventDefault();
      void copySelected(e.clipboardData);
    };
    const onCut = (e: ClipboardEvent) => {
      if (isTypingTarget(e.target) || getState().editing || getState().dialog) return;
      if (!getState().selectedIds.length || getState().viewMode) return;
      e.preventDefault();
      void cutSelected(e.clipboardData);
    };
    const onPaste = (e: ClipboardEvent) => {
      const s = getState();
      if (isTypingTarget(e.target) || s.editing || s.dialog || s.viewMode) return;
      const data = e.clipboardData;
      if (!data) return;
      e.preventDefault();
      const image = [...data.files].find((f) => f.type.startsWith('image/'));
      if (image) {
        void insertImage(image, controller.pointerScene());
        return;
      }
      const text = data.getData('text/plain');
      const payload = parseClipboardPayload(text);
      if (payload) pastePayload(payload);
      else if (text.trim()) pasteText(text);
      else pastePayload();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('paste', onPaste);
    };
  }, []);
}
