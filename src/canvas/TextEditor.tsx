import { useEffect, useLayoutEffect, useRef } from 'react';
import { themed } from '../scene/colors';
import { getCenter, getTextLayout, isLinear, isText } from '../scene/elements';
import { FONT_STACKS, LINE_HEIGHT } from '../scene/text';
import { useStore } from '../store/store';
import { getTokens } from '../theme/tokens';
import { finishEditing, updateEditingText } from './textEditing';

/** A transparent textarea laid exactly over the text being edited on the canvas. */
export function TextEditor() {
  const editing = useStore((s) => s.editing);
  const element = useStore((s) =>
    s.editing ? s.elements.find((e) => e.id === s.editing!.id) : undefined,
  );
  const viewport = useStore((s) => s.viewport);
  const theme = useStore((s) => s.theme);
  const ref = useRef<HTMLTextAreaElement>(null);
  const editingId = editing?.id;
  const isNew = editing?.isNew;

  useLayoutEffect(() => {
    const ta = ref.current;
    if (!ta || !editingId) return;
    ta.focus({ preventScroll: true });
    if (!isNew) ta.select();
  }, [editingId, isNew]);

  // Commit if the element disappears underneath us (e.g. undo).
  useEffect(() => {
    if (editing && !element) finishEditing();
  }, [editing, element]);

  if (!editing || !element) return null;

  const { zoom, scrollX, scrollY } = viewport;
  const text = element.text ?? '';
  const color = themed(element.strokeColor, theme);
  const fontSize = element.fontSize * zoom;
  const common: React.CSSProperties = {
    position: 'fixed',
    margin: 0,
    padding: 0,
    border: 'none',
    outline: 'none',
    resize: 'none',
    overflow: 'hidden',
    background: 'transparent',
    color,
    caretColor: getTokens(theme).accent,
    fontFamily: FONT_STACKS[element.fontFamily],
    fontSize,
    lineHeight: LINE_HEIGHT,
    zIndex: 5,
    opacity: element.opacity / 100,
    whiteSpace: 'pre',
    wordBreak: 'normal',
  };

  let style: React.CSSProperties;
  if (isText(element)) {
    // The textarea is one em wider than the text so the caret never wraps; shift it so the
    // text stays anchored according to its alignment while it grows.
    const slack =
      element.textAlign === 'center'
        ? element.fontSize / 2
        : element.textAlign === 'right'
          ? element.fontSize
          : 0;
    const left = element.x - slack;
    style = {
      ...common,
      left: (left + scrollX) * zoom,
      top: (element.y + scrollY) * zoom,
      width: (element.width + element.fontSize) * zoom,
      height: element.height * zoom,
      textAlign: element.textAlign,
      transform: element.angle ? `rotate(${element.angle}rad)` : undefined,
      transformOrigin: `${(element.x + element.width / 2 - left) * zoom}px ${(element.height / 2) * zoom}px`,
    };
  } else {
    const layout = getTextLayout({ ...element, text: text || ' ' })!;
    const [cx, cy] = getCenter(element);
    const linear = isLinear(element);
    style = {
      ...common,
      left: (layout.x + scrollX) * zoom,
      top: (layout.y + scrollY) * zoom,
      width: (layout.width + (linear ? element.fontSize : 0)) * zoom,
      height: layout.height * zoom,
      whiteSpace: 'pre-wrap',
      overflowWrap: 'break-word',
      textAlign: linear ? 'center' : element.textAlign,
      transform: !linear && element.angle ? `rotate(${element.angle}rad)` : undefined,
      transformOrigin: `${(cx - layout.x) * zoom}px ${(cy - layout.y) * zoom}px`,
    };
    if (linear) style.left = (layout.x + scrollX - element.fontSize / 2) * zoom;
  }

  return (
    <textarea
      ref={ref}
      data-testid="text-editor"
      aria-label="Edit text"
      spellCheck={false}
      autoComplete="off"
      value={text}
      wrap={isText(element) ? 'off' : 'soft'}
      style={style}
      onChange={(e) => updateEditingText(e.target.value)}
      onBlur={() => finishEditing()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
          e.preventDefault();
          finishEditing();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          const ta = e.currentTarget;
          const { selectionStart: a, selectionEnd: b } = ta;
          const next = `${ta.value.slice(0, a)}  ${ta.value.slice(b)}`;
          updateEditingText(next);
          requestAnimationFrame(() => ta.setSelectionRange(a + 2, a + 2));
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
}
