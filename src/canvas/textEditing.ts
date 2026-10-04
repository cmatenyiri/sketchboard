import { cleanupBindings, updateBoundArrows } from '../scene/binding';
import {
  canHaveLabel,
  createElement,
  fitContainerToLabel,
  isText,
  refreshTextDimensions,
} from '../scene/elements';
import { LINE_HEIGHT } from '../scene/text';
import { getState, pushHistory, setState, takeSnapshot } from '../store/store';
import type { Point, SceneElement, TextElement } from '../types';

/** Opens the inline editor for a text element or a shape/arrow label. */
export const startEditing = (id: string) => {
  const { elements, viewMode } = getState();
  if (viewMode) return;
  const el = elements.find((e) => e.id === id);
  if (!el || el.locked || (!isText(el) && !canHaveLabel(el))) return;
  setState({
    editing: { id, isNew: false, before: takeSnapshot() },
    selectedIds: [id],
    contextMenu: null,
  });
};

/** Creates an empty text element at a scene point and starts editing it. */
export const startNewText = (p: Point) => {
  const { elements, currentStyle, viewMode } = getState();
  if (viewMode) return;
  const before = takeSnapshot();
  const lineHeight = currentStyle.fontSize * LINE_HEIGHT;
  const el = refreshTextDimensions(
    createElement(
      'text',
      p[0],
      p[1] - lineHeight / 2,
      { ...currentStyle, textAlign: 'left' },
      { text: '' },
    ) as TextElement,
  );
  setState({
    elements: [...elements, el],
    selectedIds: [el.id],
    editing: { id: el.id, isNew: true, before },
    contextMenu: null,
  });
};

/** Live-updates the edited element while typing (no history entry). */
export const updateEditingText = (text: string) => {
  const { editing, elements } = getState();
  if (!editing) return;
  let changedId: string | null = null;
  const next = elements.map((el): SceneElement => {
    if (el.id !== editing.id) return el;
    changedId = el.id;
    if (isText(el)) return refreshTextDimensions({ ...el, text, version: el.version + 1 });
    return { ...el, text, version: el.version + 1 };
  });
  setState({ elements: changedId ? updateBoundArrows(next, new Set([editing.id])) : next });
};

export const finishEditing = () => {
  const { editing, elements, toolLocked, tool } = getState();
  if (!editing) return;
  const el = elements.find((e) => e.id === editing.id);
  // A new text box closed without typing anything leaves no trace (and no undo step).
  if (editing.isNew && (!el || (isText(el) && !el.text.trim()))) {
    setState({
      elements: editing.before.elements,
      editing: null,
      selectedIds: [],
      tool: toolLocked ? tool : 'select',
    });
    return;
  }
  let next = elements;
  let selectedIds = el ? [el.id] : [];
  if (el && isText(el) && !el.text.trim()) {
    next = cleanupBindings(elements.filter((e) => e.id !== el.id));
    selectedIds = [];
  } else if (el && !isText(el)) {
    const trimmed = (el.text ?? '').replace(/\s+$/, '');
    const fitted = fitContainerToLabel({ ...el, text: trimmed || undefined });
    next = updateBoundArrows(
      elements.map((e) => (e.id === el.id ? { ...fitted, version: el.version + 1 } : e)),
      new Set([el.id]),
    );
  }
  setState({
    elements: next,
    editing: null,
    selectedIds,
    tool: toolLocked ? tool : 'select',
  });
  pushHistory(editing.before);
};
