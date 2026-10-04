import type { ElementStyle, ElementType, LinearElement, Point, SceneElement } from '../types';
import { updateLinearBindings } from './binding';
import { TRANSPARENT } from './colors';
import { createElement, DEFAULT_STYLE, normalizePoints, refreshTextDimensions } from './elements';
import { randomId } from './math';

type StyleOverrides = Partial<ElementStyle> & { text?: string; angle?: number };

class Builder {
  elements: SceneElement[] = [];

  shape(type: ElementType, x: number, y: number, w: number, h: number, o: StyleOverrides = {}) {
    const { text, angle, ...style } = o;
    const el = createElement(type, x, y, { ...DEFAULT_STYLE, ...style }, {
      width: w,
      height: h,
      text,
      angle: angle ?? 0,
    } as Partial<SceneElement>);
    this.elements.push(el);
    return el;
  }

  text(x: number, y: number, text: string, o: StyleOverrides = {}) {
    const { angle, ...style } = o;
    const el = refreshTextDimensions(
      createElement('text', x, y, { ...DEFAULT_STYLE, textAlign: 'left', ...style }, {
        text,
      } as Partial<SceneElement>) as never,
    );
    const placed = { ...(el as SceneElement), angle: angle ?? 0 };
    this.elements.push(placed);
    return placed;
  }

  arrow(
    from: SceneElement | Point,
    to: SceneElement | Point,
    o: StyleOverrides & { via?: Point[]; type?: 'arrow' | 'line' } = {},
  ) {
    const { via = [], type = 'arrow', text, ...style } = o;
    const center = (e: SceneElement | Point): Point =>
      Array.isArray(e) ? e : [e.x + e.width / 2, e.y + e.height / 2];
    const pts: Point[] = [center(from), ...via, center(to)];
    let el = createElement(type, 0, 0, { ...DEFAULT_STYLE, ...style }, {
      points: pts,
      text,
      startBinding: Array.isArray(from) ? null : { elementId: from.id },
      endBinding: Array.isArray(to) ? null : { elementId: to.id },
      startArrowhead: type === 'arrow' ? (style.startArrowhead ?? 'none') : 'none',
      endArrowhead: type === 'arrow' ? (style.endArrowhead ?? 'arrow') : 'none',
    } as Partial<LinearElement>) as LinearElement;
    el = normalizePoints(el);
    el = updateLinearBindings(el, new Map(this.elements.map((e) => [e.id, e])));
    this.elements.push(el);
    return el;
  }

  group(...els: SceneElement[]) {
    const id = randomId();
    const ids = new Set(els.map((e) => e.id));
    this.elements = this.elements.map((e) =>
      ids.has(e.id) ? { ...e, groupIds: [...e.groupIds, id] } : e,
    );
  }
}

const sticky = (b: Builder, x: number, y: number, text: string, bg: string, angle = 0) =>
  b.shape('rectangle', x, y, 160, 110, {
    backgroundColor: bg,
    fillStyle: 'solid',
    strokeColor: '#45413b',
    strokeWidth: 1,
    roughness: 1,
    roundness: 'sharp',
    text,
    fontSize: 20,
    angle,
  });

export interface Template {
  id: string;
  name: string;
  description: string;
  build: () => SceneElement[];
}

export const TEMPLATES: Template[] = [
  {
    id: 'flowchart',
    name: 'Flowchart',
    description: 'Decision flow with connected, auto-following arrows',
    build: () => {
      const b = new Builder();
      const start = b.shape('ellipse', 0, 0, 170, 70, {
        text: 'Start',
        backgroundColor: '#9be6c8',
        fillStyle: 'solid',
      });
      const step = b.shape('rectangle', -5, 140, 180, 80, {
        text: 'Gather ideas',
        backgroundColor: '#a5d2ff',
        fillStyle: 'hachure',
      });
      const decide = b.shape('diamond', -15, 290, 200, 130, {
        text: 'Good enough?',
        backgroundColor: '#ffd978',
        fillStyle: 'solid',
      });
      const ship = b.shape('rectangle', -5, 490, 180, 80, {
        text: 'Ship it 🚀',
        backgroundColor: '#9be6c8',
        fillStyle: 'cross-hatch',
      });
      const iterate = b.shape('rectangle', 300, 315, 170, 80, {
        text: 'Iterate',
        backgroundColor: '#ffb3a3',
        fillStyle: 'hachure',
      });
      b.arrow(start, step);
      b.arrow(step, decide);
      b.arrow(decide, ship, { text: 'yes' });
      b.arrow(decide, iterate, { text: 'no' });
      b.arrow(iterate, step, { via: [[385, 180]], roundness: 'round' });
      return b.elements;
    },
  },
  {
    id: 'mindmap',
    name: 'Mind map',
    description: 'Central idea with colorful branches',
    build: () => {
      const b = new Builder();
      const center = b.shape('ellipse', 0, 0, 220, 110, {
        text: 'Big idea',
        backgroundColor: '#ffb3a3',
        fillStyle: 'solid',
        fontSize: 28,
        strokeWidth: 2,
      });
      const branches: [string, string, number, number][] = [
        ['Goals', '#a5d2ff', -330, -170],
        ['Audience', '#9be6c8', 330, -170],
        ['Risks', '#ffd978', -360, 120],
        ['Timeline', '#c9b8ff', 360, 120],
        ['Resources', '#ffadd3', 0, 240],
      ];
      for (const [label, color, dx, dy] of branches) {
        const node = b.shape('rectangle', dx + 30, dy + 25, 160, 60, {
          text: label,
          backgroundColor: color,
          fillStyle: 'hachure',
        });
        b.arrow(center, node, { type: 'line', strokeColor: '#8a857c', roundness: 'round' });
      }
      return b.elements;
    },
  },
  {
    id: 'kanban',
    name: 'Kanban board',
    description: 'Three columns with sticky notes',
    build: () => {
      const b = new Builder();
      const columns = ['To do', 'In progress', 'Done'];
      const colors = ['#fff1cc', '#dbeeff', '#d8f6ea'];
      columns.forEach((c, i) => {
        const x = i * 230;
        b.shape('rectangle', x, 0, 210, 470, {
          backgroundColor: TRANSPARENT,
          strokeColor: '#8a857c',
          strokeStyle: 'dashed',
          strokeWidth: 1,
        });
        b.text(x + 18, 16, c, { fontSize: 28, fontFamily: 'hand' });
        const notes = [
          ['Sketch the UI', 'Write the copy', 'User interviews'],
          ['Build prototype', 'Review designs'],
          ['Kick-off meeting'],
        ][i];
        notes.forEach((n, j) =>
          sticky(b, x + 25, 70 + j * 128, n, colors[i], ((j % 2) - 0.5) * 0.04),
        );
      });
      return b.elements;
    },
  },
  {
    id: 'swot',
    name: 'SWOT analysis',
    description: 'Strengths, weaknesses, opportunities, threats',
    build: () => {
      const b = new Builder();
      const quads: [string, string, number, number][] = [
        ['Strengths', '#d8f6ea', 0, 0],
        ['Weaknesses', '#ffe4de', 300, 0],
        ['Opportunities', '#dbeeff', 0, 230],
        ['Threats', '#fff1cc', 300, 230],
      ];
      b.text(170, -70, 'SWOT', { fontSize: 40, fontFamily: 'hand', textAlign: 'center' });
      for (const [label, color, x, y] of quads) {
        b.shape('rectangle', x, y, 280, 210, {
          backgroundColor: color,
          fillStyle: 'solid',
          strokeWidth: 1,
        });
        b.text(x + 20, y + 16, label, { fontSize: 28, fontFamily: 'hand' });
        b.text(x + 22, y + 66, '• …\n• …', {
          fontSize: 20,
          fontFamily: 'hand',
          strokeColor: '#5f5a52',
        });
      }
      return b.elements;
    },
  },
  {
    id: 'wireframe',
    name: 'Web wireframe',
    description: 'Low-fidelity landing page layout',
    build: () => {
      const b = new Builder();
      const s = { strokeWidth: 2, roughness: 1 as const };
      const frame = b.shape('rectangle', 0, 0, 640, 440, { ...s, roundness: 'sharp' });
      const bar = b.shape('rectangle', 0, 0, 640, 36, {
        ...s,
        roundness: 'sharp',
        backgroundColor: '#f4f1ea',
        fillStyle: 'solid',
      });
      const dots = [0, 1, 2].map((i) =>
        b.shape('ellipse', 14 + i * 20, 12, 12, 12, {
          backgroundColor: ['#ff7a5c', '#f7b52c', '#3fc79a'][i],
          fillStyle: 'solid',
          strokeWidth: 1,
        }),
      );
      const logo = b.shape('rectangle', 30, 60, 90, 30, {
        text: 'LOGO',
        fontSize: 16,
        roundness: 'round',
      });
      const nav = b.text(420, 64, 'Home   About   Contact', { fontSize: 16 });
      const hero = b.shape('rectangle', 30, 120, 580, 170, {
        backgroundColor: '#dbeeff',
        fillStyle: 'hachure',
        text: 'Hero headline that sells the idea',
        fontSize: 28,
      });
      const cards = [0, 1, 2].map((i) =>
        b.shape('rectangle', 30 + i * 200, 310, 180, 100, {
          text: `Feature ${i + 1}`,
          roundness: 'round',
        }),
      );
      b.group(frame, bar, ...dots, logo, nav, hero, ...cards);
      return b.elements;
    },
  },
  {
    id: 'welcome',
    name: 'Welcome tour',
    description: 'A sample board showing off what you can do',
    build: () => {
      const b = new Builder();
      b.text(0, 0, 'Welcome to Sketchboard ✏️', { fontSize: 40, fontFamily: 'hand' });
      b.text(
        2,
        62,
        'Everything here is editable — drag things around, double-click to edit text.',
        {
          fontSize: 20,
          fontFamily: 'hand',
          strokeColor: '#5f5a52',
        },
      );
      const idea = b.shape('rectangle', 0, 140, 190, 90, {
        text: 'Idea',
        backgroundColor: '#ffd978',
        fillStyle: 'hachure',
      });
      const sketch = b.shape('ellipse', 300, 130, 200, 110, {
        text: 'Sketch it',
        backgroundColor: '#a5d2ff',
        fillStyle: 'cross-hatch',
      });
      const share = b.shape('diamond', 610, 115, 200, 140, {
        text: 'Share it',
        backgroundColor: '#9be6c8',
        fillStyle: 'solid',
      });
      b.arrow(idea, sketch);
      b.arrow(sketch, share, { strokeStyle: 'dashed' });
      sticky(b, 20, 320, 'Drag a shape —\narrows follow!', '#fff1cc', -0.04);
      sticky(b, 220, 320, 'Press Ctrl+K\nfor all commands', '#ffe0ef', 0.03);
      sticky(b, 420, 320, 'Share → link\nwith the board\ninside', '#ece6ff', -0.02);
      sticky(b, 620, 320, 'Try the laser\npointer (K)', '#d8f6ea', 0.04);
      b.shape('rectangle', 0, 490, 820, 4, {
        backgroundColor: TRANSPARENT,
        strokeColor: '#cfcac0',
        strokeWidth: 1,
        roughness: 2,
        roundness: 'sharp',
      });
      b.text(0, 520, 'Styles: architect · artist · cartoonist', {
        fontSize: 20,
        fontFamily: 'hand',
        strokeColor: '#5f5a52',
      });
      [0, 1, 2].forEach((r) =>
        b.shape('rectangle', r * 150, 570, 120, 70, {
          roughness: r as 0 | 1 | 2,
          backgroundColor: ['#ffb3a3', '#9be6c8', '#c9b8ff'][r],
          fillStyle: (['solid', 'hachure', 'zigzag'] as const)[r],
        }),
      );
      return b.elements;
    },
  },
];
