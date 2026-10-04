import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowDownToLine,
  ArrowUpToLine,
  BookOpen,
  BringToFront,
  ClipboardPaste,
  Command,
  Copy,
  CopyPlus,
  Diamond,
  Download,
  Eraser,
  Eye,
  FilePlus2,
  FlipHorizontal2,
  FlipVertical2,
  FolderOpen,
  Grid3x3,
  Group,
  Hand,
  Image,
  ImageDown,
  Keyboard,
  LayoutTemplate,
  Lock,
  LockOpen,
  Magnet,
  Map as MapIcon,
  Maximize,
  Minus,
  Moon,
  MousePointer2,
  MoveRight,
  Paintbrush,
  PaintBucket,
  Pencil,
  Redo2,
  Save,
  Scan,
  Scissors,
  SendToBack,
  Share2,
  Sparkles,
  Square,
  Circle,
  Trash2,
  Type,
  Undo2,
  Ungroup,
  Wand2,
  ZoomIn,
  ZoomOut,
  Layers,
  PanelsTopLeft,
  type LucideIcon,
} from 'lucide-react';
import { controller } from '../canvas/instance';
import { startEditing } from '../canvas/textEditing';
import { isText, canHaveLabel } from '../scene/elements';
import {
  getSelectedElements,
  getState,
  openDialog,
  redo,
  undo,
  type AppState,
} from '../store/store';
import type { ToolType } from '../types';
import { createBoard, openFromFile, saveToFile } from './boardActions';
import {
  alignSelected,
  bringForward,
  bringToFront,
  clearCanvas,
  copySelected,
  copyStyles,
  cutSelected,
  deleteSelected,
  distributeSelected,
  duplicateSelected,
  flipSelected,
  groupSelected,
  parseClipboardPayload,
  pastePayload,
  pasteStyles,
  pasteText,
  resetZoom,
  selectAll,
  sendBackward,
  sendToBack,
  setTool,
  toggleGrid,
  toggleLockSelected,
  toggleMinimap,
  toggleSnapping,
  toggleTheme,
  toggleToolLock,
  toggleViewMode,
  toggleZen,
  ungroupSelected,
  unlockAll,
  zoomBy,
  zoomToFit,
} from './sceneActions';

export type ActionGroup = 'Tools' | 'Edit' | 'Arrange' | 'View' | 'Board' | 'Help';

export interface Action {
  id: string;
  label: string;
  group: ActionGroup;
  icon?: LucideIcon;
  /** Shortcut combos like "mod+shift+z"; the first one is shown in menus. */
  keys?: string[];
  keywords?: string;
  perform: () => void;
  enabled?: (s: AppState) => boolean;
  checked?: (s: AppState) => boolean;
  /** Hidden from the command palette (e.g. duplicates of tool numbers). */
  hidden?: boolean;
}

const hasSelection = (s: AppState) => s.selectedIds.length > 0 && !s.viewMode;
const multi = (n: number) => (s: AppState) => s.selectedIds.length >= n && !s.viewMode;
const editable = (s: AppState) => !s.viewMode;

export interface ToolDef {
  tool: ToolType;
  label: string;
  icon: LucideIcon;
  keys: string[];
  hint: string;
}

export const TOOLS: ToolDef[] = [
  { tool: 'hand', label: 'Hand (pan)', icon: Hand, keys: ['h'], hint: 'H' },
  { tool: 'select', label: 'Select', icon: MousePointer2, keys: ['v', '1'], hint: '1' },
  { tool: 'rectangle', label: 'Rectangle', icon: Square, keys: ['r', '2'], hint: '2' },
  { tool: 'diamond', label: 'Diamond', icon: Diamond, keys: ['d', '3'], hint: '3' },
  { tool: 'ellipse', label: 'Ellipse', icon: Circle, keys: ['o', '4'], hint: '4' },
  { tool: 'arrow', label: 'Arrow', icon: MoveRight, keys: ['a', '5'], hint: '5' },
  { tool: 'line', label: 'Line', icon: Minus, keys: ['l', '6'], hint: '6' },
  { tool: 'freedraw', label: 'Pen', icon: Pencil, keys: ['p', '7'], hint: '7' },
  { tool: 'text', label: 'Text', icon: Type, keys: ['t', '8'], hint: '8' },
  { tool: 'image', label: 'Insert image', icon: Image, keys: ['9'], hint: '9' },
  { tool: 'eraser', label: 'Eraser', icon: Eraser, keys: ['e', '0'], hint: '0' },
  { tool: 'laser', label: 'Laser pointer', icon: Wand2, keys: ['k'], hint: 'K' },
];

const pasteFromSystem = async () => {
  try {
    const text = await navigator.clipboard.readText();
    const payload = parseClipboardPayload(text);
    if (payload) pastePayload(payload);
    else if (text) pasteText(text);
    else pastePayload();
  } catch {
    pastePayload();
  }
};

export const ACTIONS: Action[] = [
  // Tools
  ...TOOLS.map<Action>((t) => ({
    id: `tool.${t.tool}`,
    label: t.label,
    group: 'Tools',
    icon: t.icon,
    keys: t.keys,
    perform: () => setTool(t.tool),
    checked: (s) => s.tool === t.tool,
  })),
  {
    id: 'tool.lock',
    label: 'Keep tool active after drawing',
    group: 'Tools',
    icon: Lock,
    keys: ['q'],
    keywords: 'lock tool sticky',
    perform: toggleToolLock,
    checked: (s) => s.toolLocked,
  },

  // Edit
  {
    id: 'undo',
    label: 'Undo',
    group: 'Edit',
    icon: Undo2,
    keys: ['mod+z'],
    perform: undo,
    enabled: (s) => s.past.length > 0 && !s.viewMode,
  },
  {
    id: 'redo',
    label: 'Redo',
    group: 'Edit',
    icon: Redo2,
    keys: ['mod+shift+z', 'mod+y'],
    perform: redo,
    enabled: (s) => s.future.length > 0 && !s.viewMode,
  },
  {
    id: 'cut',
    label: 'Cut',
    group: 'Edit',
    icon: Scissors,
    keys: ['mod+x'],
    perform: () => void cutSelected(),
    enabled: hasSelection,
    hidden: false,
  },
  {
    id: 'copy',
    label: 'Copy',
    group: 'Edit',
    icon: Copy,
    keys: ['mod+c'],
    perform: () => void copySelected(),
    enabled: hasSelection,
  },
  {
    id: 'paste',
    label: 'Paste',
    group: 'Edit',
    icon: ClipboardPaste,
    keys: ['mod+v'],
    perform: () => void pasteFromSystem(),
    enabled: editable,
  },
  {
    id: 'duplicate',
    label: 'Duplicate',
    group: 'Edit',
    icon: CopyPlus,
    keys: ['mod+d'],
    perform: duplicateSelected,
    enabled: hasSelection,
  },
  {
    id: 'delete',
    label: 'Delete',
    group: 'Edit',
    icon: Trash2,
    keys: ['delete', 'backspace'],
    perform: deleteSelected,
    enabled: hasSelection,
  },
  {
    id: 'selectAll',
    label: 'Select all',
    group: 'Edit',
    icon: Scan,
    keys: ['mod+a'],
    perform: selectAll,
    enabled: editable,
  },
  {
    id: 'editText',
    label: 'Edit text / label',
    group: 'Edit',
    icon: Type,
    keys: ['enter'],
    perform: () => {
      const [el] = getSelectedElements();
      if (el && (isText(el) || canHaveLabel(el))) startEditing(el.id);
    },
    enabled: (s) => s.selectedIds.length === 1 && !s.viewMode,
  },
  {
    id: 'copyStyles',
    label: 'Copy styles',
    group: 'Edit',
    icon: Paintbrush,
    keys: ['mod+alt+c'],
    perform: copyStyles,
    enabled: hasSelection,
  },
  {
    id: 'pasteStyles',
    label: 'Paste styles',
    group: 'Edit',
    icon: PaintBucket,
    keys: ['mod+alt+v'],
    perform: pasteStyles,
    enabled: hasSelection,
  },

  // Arrange
  {
    id: 'group',
    label: 'Group selection',
    group: 'Arrange',
    icon: Group,
    keys: ['mod+g'],
    perform: groupSelected,
    enabled: multi(2),
  },
  {
    id: 'ungroup',
    label: 'Ungroup',
    group: 'Arrange',
    icon: Ungroup,
    keys: ['mod+shift+g'],
    perform: ungroupSelected,
    enabled: (s) => hasSelection(s) && getSelectedElements(s).some((e) => e.groupIds.length > 0),
  },
  {
    id: 'lock',
    label: 'Lock / unlock',
    group: 'Arrange',
    icon: Lock,
    keys: ['mod+shift+l'],
    perform: toggleLockSelected,
    enabled: hasSelection,
  },
  {
    id: 'unlockAll',
    label: 'Unlock all',
    group: 'Arrange',
    icon: LockOpen,
    perform: unlockAll,
    enabled: (s) => s.elements.some((e) => e.locked) && !s.viewMode,
  },
  {
    id: 'bringForward',
    label: 'Bring forward',
    group: 'Arrange',
    icon: ArrowUpToLine,
    keys: ['mod+]'],
    perform: bringForward,
    enabled: hasSelection,
  },
  {
    id: 'sendBackward',
    label: 'Send backward',
    group: 'Arrange',
    icon: ArrowDownToLine,
    keys: ['mod+['],
    perform: sendBackward,
    enabled: hasSelection,
  },
  {
    id: 'bringToFront',
    label: 'Bring to front',
    group: 'Arrange',
    icon: BringToFront,
    keys: ['mod+shift+]'],
    perform: bringToFront,
    enabled: hasSelection,
  },
  {
    id: 'sendToBack',
    label: 'Send to back',
    group: 'Arrange',
    icon: SendToBack,
    keys: ['mod+shift+['],
    perform: sendToBack,
    enabled: hasSelection,
  },
  {
    id: 'flipH',
    label: 'Flip horizontal',
    group: 'Arrange',
    icon: FlipHorizontal2,
    keys: ['shift+h'],
    perform: () => flipSelected('horizontal'),
    enabled: hasSelection,
  },
  {
    id: 'flipV',
    label: 'Flip vertical',
    group: 'Arrange',
    icon: FlipVertical2,
    keys: ['shift+v'],
    perform: () => flipSelected('vertical'),
    enabled: hasSelection,
  },
  {
    id: 'alignLeft',
    label: 'Align left',
    group: 'Arrange',
    icon: AlignStartVertical,
    perform: () => alignSelected('left'),
    enabled: multi(2),
  },
  {
    id: 'alignCenterX',
    label: 'Align center horizontally',
    group: 'Arrange',
    icon: AlignCenterVertical,
    perform: () => alignSelected('centerX'),
    enabled: multi(2),
  },
  {
    id: 'alignRight',
    label: 'Align right',
    group: 'Arrange',
    icon: AlignEndVertical,
    perform: () => alignSelected('right'),
    enabled: multi(2),
  },
  {
    id: 'alignTop',
    label: 'Align top',
    group: 'Arrange',
    icon: AlignStartHorizontal,
    perform: () => alignSelected('top'),
    enabled: multi(2),
  },
  {
    id: 'alignCenterY',
    label: 'Align center vertically',
    group: 'Arrange',
    icon: AlignCenterHorizontal,
    perform: () => alignSelected('centerY'),
    enabled: multi(2),
  },
  {
    id: 'alignBottom',
    label: 'Align bottom',
    group: 'Arrange',
    icon: AlignEndHorizontal,
    perform: () => alignSelected('bottom'),
    enabled: multi(2),
  },
  {
    id: 'distributeX',
    label: 'Distribute horizontally',
    group: 'Arrange',
    icon: AlignHorizontalDistributeCenter,
    perform: () => distributeSelected('x'),
    enabled: multi(3),
  },
  {
    id: 'distributeY',
    label: 'Distribute vertically',
    group: 'Arrange',
    icon: AlignVerticalDistributeCenter,
    perform: () => distributeSelected('y'),
    enabled: multi(3),
  },

  // View
  {
    id: 'zoomIn',
    label: 'Zoom in',
    group: 'View',
    icon: ZoomIn,
    keys: ['mod+=', 'mod+shift+=', 'mod++'],
    perform: () => zoomBy(1),
  },
  {
    id: 'zoomOut',
    label: 'Zoom out',
    group: 'View',
    icon: ZoomOut,
    keys: ['mod+-'],
    perform: () => zoomBy(-1),
  },
  {
    id: 'resetZoom',
    label: 'Reset zoom to 100%',
    group: 'View',
    icon: Scan,
    keys: ['mod+0'],
    perform: resetZoom,
  },
  {
    id: 'zoomToFit',
    label: 'Zoom to fit everything',
    group: 'View',
    icon: Maximize,
    keys: ['shift+1'],
    perform: () => zoomToFit(false),
  },
  {
    id: 'zoomToSelection',
    label: 'Zoom to selection',
    group: 'View',
    icon: Maximize,
    keys: ['shift+2'],
    perform: () => zoomToFit(true),
    enabled: (s) => s.selectedIds.length > 0,
  },
  {
    id: 'toggleGrid',
    label: 'Grid & snap to grid',
    group: 'View',
    icon: Grid3x3,
    keys: ["mod+'"],
    perform: toggleGrid,
    checked: (s) => s.gridEnabled,
  },
  {
    id: 'toggleSnapping',
    label: 'Smart guides (snap to objects)',
    group: 'View',
    icon: Magnet,
    keys: ['alt+s'],
    perform: toggleSnapping,
    checked: (s) => s.objectSnapping,
  },
  {
    id: 'toggleMinimap',
    label: 'Minimap',
    group: 'View',
    icon: MapIcon,
    keys: ['alt+m'],
    perform: toggleMinimap,
    checked: (s) => s.minimapOpen,
  },
  {
    id: 'toggleZen',
    label: 'Zen mode (hide UI)',
    group: 'View',
    icon: PanelsTopLeft,
    keys: ['alt+z'],
    perform: toggleZen,
    checked: (s) => s.zenMode,
  },
  {
    id: 'toggleViewMode',
    label: 'View-only mode',
    group: 'View',
    icon: Eye,
    keys: ['alt+r'],
    perform: toggleViewMode,
    checked: (s) => s.viewMode,
  },
  {
    id: 'toggleTheme',
    label: 'Toggle dark mode',
    group: 'View',
    icon: Moon,
    keys: ['alt+shift+d'],
    keywords: 'theme light dark night',
    perform: toggleTheme,
    checked: (s) => s.theme === 'dark',
  },

  // Board
  {
    id: 'newBoard',
    label: 'New board',
    group: 'Board',
    icon: FilePlus2,
    keys: ['alt+n'],
    perform: () => void createBoard(),
  },
  {
    id: 'boards',
    label: 'My boards…',
    group: 'Board',
    icon: Layers,
    keys: ['alt+b'],
    perform: () => openDialog('boards'),
  },
  {
    id: 'open',
    label: 'Open from file…',
    group: 'Board',
    icon: FolderOpen,
    keys: ['mod+o'],
    perform: () => void openFromFile(),
  },
  {
    id: 'save',
    label: 'Save to file',
    group: 'Board',
    icon: Save,
    keys: ['mod+s'],
    perform: saveToFile,
  },
  {
    id: 'export',
    label: 'Export image…',
    group: 'Board',
    icon: ImageDown,
    keys: ['mod+shift+e'],
    keywords: 'png svg download',
    perform: () => openDialog('export'),
  },
  {
    id: 'share',
    label: 'Share link…',
    group: 'Board',
    icon: Share2,
    keys: ['mod+shift+s'],
    keywords: 'url link collaborate',
    perform: () => openDialog('share'),
  },
  {
    id: 'templates',
    label: 'Insert template…',
    group: 'Board',
    icon: LayoutTemplate,
    keywords: 'flowchart mind map kanban',
    perform: () => openDialog('templates'),
    enabled: editable,
  },
  {
    id: 'clear',
    label: 'Clear canvas',
    group: 'Board',
    icon: Trash2,
    keywords: 'reset delete all',
    perform: clearCanvas,
    enabled: (s) => s.elements.length > 0 && !s.viewMode,
  },

  // Help
  {
    id: 'commandPalette',
    label: 'Command palette',
    group: 'Help',
    icon: Command,
    keys: ['mod+k', 'mod+/'],
    perform: () => openDialog('commands'),
    hidden: true,
  },
  {
    id: 'shortcuts',
    label: 'Keyboard shortcuts',
    group: 'Help',
    icon: Keyboard,
    keys: ['shift+/'],
    perform: () => openDialog('shortcuts'),
  },
  {
    id: 'tutorial',
    label: 'Show the tutorial',
    group: 'Help',
    icon: BookOpen,
    keywords: 'help guide intro onboarding',
    perform: () => openDialog('tutorial'),
  },
  {
    id: 'whatsNew',
    label: 'Tips & tricks',
    group: 'Help',
    icon: Sparkles,
    perform: () => openDialog('shortcuts'),
    hidden: true,
  },
  {
    id: 'download',
    label: 'Download PNG (quick)',
    group: 'Board',
    icon: Download,
    hidden: true,
    perform: () => openDialog('export'),
  },
];

export const ACTION_MAP = new Map(ACTIONS.map((a) => [a.id, a]));

export const runAction = (id: string) => {
  const action = ACTION_MAP.get(id);
  if (!action) return;
  if (action.enabled && !action.enabled(getState())) return;
  action.perform();
  controller.updateCursor();
};

// ---------------------------------------------------------------------------------------------
// Shortcut matching & display
// ---------------------------------------------------------------------------------------------

export const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

/** Normalizes a keyboard event to a combo string such as "mod+shift+z". */
export const eventToCombo = (e: KeyboardEvent) => {
  let key: string;
  if (e.code.startsWith('Key')) key = e.code.slice(3).toLowerCase();
  else if (e.code.startsWith('Digit')) key = e.code.slice(5);
  else if (e.code === 'BracketLeft') key = '[';
  else if (e.code === 'BracketRight') key = ']';
  else if (e.code === 'Slash') key = '/';
  else if (e.code === 'Quote') key = "'";
  else if (e.code === 'Equal') key = '=';
  else if (e.code === 'Minus') key = '-';
  else if (e.code === 'NumpadAdd') key = '+';
  else if (e.code === 'NumpadSubtract') key = '-';
  else key = e.key.toLowerCase();
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('mod');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  parts.push(key);
  return parts.join('+');
};

const KEY_LABELS: Record<string, string> = {
  mod: isMac ? '⌘' : 'Ctrl',
  alt: isMac ? '⌥' : 'Alt',
  shift: isMac ? '⇧' : 'Shift',
  delete: 'Del',
  backspace: '⌫',
  enter: '↵',
  escape: 'Esc',
  space: 'Space',
};

export const comboParts = (combo: string) =>
  combo
    .split('+')
    .map((p) => KEY_LABELS[p] ?? (p === '/' && combo.includes('shift') ? '/' : p.toUpperCase()));

export const formatCombo = (combo: string) => comboParts(combo).join(isMac ? '' : '+');
