export type Point = [number, number];

export type ToolType =
  | 'select'
  | 'hand'
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'freedraw'
  | 'text'
  | 'image'
  | 'eraser'
  | 'laser';

export type ElementType =
  'rectangle' | 'diamond' | 'ellipse' | 'arrow' | 'line' | 'freedraw' | 'text' | 'image';

export type FillStyle = 'hachure' | 'cross-hatch' | 'solid' | 'zigzag';
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type Roughness = 0 | 1 | 2;
export type Roundness = 'sharp' | 'round';
export type FontFamily = 'hand' | 'sans' | 'mono';
export type TextAlign = 'left' | 'center' | 'right';
export type Arrowhead = 'none' | 'arrow' | 'triangle' | 'dot' | 'bar' | 'diamond';
export type ThemeMode = 'light' | 'dark';

export interface ElementStyle {
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: Roughness;
  opacity: number;
  roundness: Roundness;
  fontFamily: FontFamily;
  fontSize: number;
  textAlign: TextAlign;
  startArrowhead: Arrowhead;
  endArrowhead: Arrowhead;
}

export interface Binding {
  elementId: string;
}

export interface BaseElement extends ElementStyle {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  seed: number;
  version: number;
  groupIds: string[];
  locked: boolean;
  link?: string;
  /** Label rendered inside shapes / on top of linear elements, or the content of a text element. */
  text?: string;
}

export interface ShapeElement extends BaseElement {
  type: 'rectangle' | 'diamond' | 'ellipse';
}

export interface LinearElement extends BaseElement {
  type: 'arrow' | 'line';
  /** Points relative to (x, y). The element's box always tightly wraps its points. */
  points: Point[];
  startBinding: Binding | null;
  endBinding: Binding | null;
}

export interface FreedrawElement extends BaseElement {
  type: 'freedraw';
  /** [x, y, pressure] relative to (x, y). */
  points: [number, number, number][];
  simulatePressure: boolean;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  fileId: string;
}

export type SceneElement =
  ShapeElement | LinearElement | FreedrawElement | TextElement | ImageElement;

export interface BinaryFile {
  id: string;
  dataURL: string;
  mimeType: string;
}

export type BinaryFiles = Record<string, BinaryFile>;

export interface Viewport {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type TransformHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'rotation';

export interface SceneData {
  elements: SceneElement[];
  files: BinaryFiles;
  background: string;
}

export interface SavedBoardFile extends SceneData {
  type: 'sketchboard';
  version: 1;
  name?: string;
}
