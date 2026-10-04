import rough from 'roughjs';
import type { Drawable, Options } from 'roughjs/bin/core';
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { HAND_FONT } from '../theme/theme';
import './tutorial.css';

const gen = rough.generator();

const base = (o: Options): Options => ({
  stroke: 'var(--ink)',
  strokeWidth: 2,
  roughness: 1.1,
  fillWeight: 1.4,
  hachureGap: 7,
  ...o,
});

const rect = (x: number, y: number, w: number, h: number, o: Options = {}) =>
  gen.rectangle(x, y, w, h, base(o));
const ellipse = (cx: number, cy: number, w: number, h: number, o: Options = {}) =>
  gen.ellipse(cx, cy, w, h, base(o));
const poly = (pts: [number, number][], o: Options = {}) => gen.polygon(pts, base(o));
const line = (pts: [number, number][], o: Options = {}) => gen.linearPath(pts, base(o));
const curve = (pts: [number, number][], o: Options = {}) => gen.curve(pts, base(o));

/** Renders a roughjs drawable as SVG paths that draw themselves in. */
function R({
  d,
  delay = 0,
  dur = 0.9,
  style,
}: {
  d: Drawable;
  delay?: number;
  dur?: number;
  style?: CSSProperties;
}) {
  const paths = useMemo(
    () =>
      d.sets.map((set) => {
        const path = gen.opsToPath(set, 2);
        if (set.type === 'fillPath')
          return { path, fill: d.options.fill, stroke: 'none', width: 0, isFill: true };
        if (set.type === 'fillSketch')
          return {
            path,
            fill: 'none',
            stroke: d.options.fill,
            width: d.options.fillWeight,
            isFill: false,
          };
        return {
          path,
          fill: 'none',
          stroke: d.options.stroke,
          width: d.options.strokeWidth,
          isFill: false,
        };
      }),
    [d],
  );
  return (
    <g
      className="tut-draw"
      style={{ '--d': `${delay}s`, '--dur': `${dur}s`, ...style } as CSSProperties}
    >
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.path}
          pathLength={1}
          className={p.isFill ? 'tut-fill' : undefined}
          style={{
            fill: p.fill,
            stroke: p.stroke,
            strokeWidth: p.width,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }}
        />
      ))}
    </g>
  );
}

const Hand = ({
  x,
  y,
  children,
  size = 18,
  anchor = 'middle',
  delay,
  color = 'var(--ink)',
  style,
}: {
  x: number;
  y: number;
  children: ReactNode;
  size?: number;
  anchor?: 'start' | 'middle' | 'end';
  delay?: number;
  color?: string;
  style?: CSSProperties;
}) => (
  <text
    x={x}
    y={y}
    fontFamily={HAND_FONT}
    fontSize={size}
    textAnchor={anchor}
    dominantBaseline="central"
    fill={color}
    className={delay !== undefined ? 'tut-fade-in' : undefined}
    style={{ '--d': `${delay ?? 0}s`, ...style } as CSSProperties}
  >
    {children}
  </text>
);

const Cursor = ({
  className,
  style,
  hand,
}: {
  className?: string;
  style?: CSSProperties;
  hand?: boolean;
}) => (
  <g className={className} style={style}>
    {hand ? (
      <path
        d="M6 9 V3.5 a1.6 1.6 0 0 1 3.2 0 V8 V2.4 a1.6 1.6 0 0 1 3.2 0 V8 V3.2 a1.6 1.6 0 0 1 3.2 0 V9 V5.6 a1.6 1.6 0 0 1 3.2 0 V13 c0 4 -2.6 7 -6.6 7 h-1.4 c-2.4 0 -3.8 -1 -5 -2.8 L1.6 12.4 a1.7 1.7 0 0 1 2.8 -1.9 Z"
        fill="#fff"
        stroke="#1d1b18"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    ) : (
      <path
        d="M0 0 L0 17 L4.6 12.6 L7.6 19.4 L10.4 18.2 L7.4 11.6 L13.4 11.6 Z"
        fill="#fff"
        stroke="#1d1b18"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    )}
  </g>
);

const Key = ({
  x,
  y,
  label,
  w = 34,
  delay = 0,
}: {
  x: number;
  y: number;
  label: string;
  w?: number;
  delay?: number;
}) => (
  <g className="tut-press" style={{ '--d': `${delay}s` } as CSSProperties}>
    <rect x={x} y={y + 3} width={w} height={30} rx={8} style={{ fill: 'var(--key-shadow)' }} />
    <rect
      x={x}
      y={y}
      width={w}
      height={30}
      rx={8}
      style={{ fill: 'var(--surface)', stroke: 'var(--border)' }}
    />
    <text
      x={x + w / 2}
      y={y + 16}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={700}
      style={{ fill: 'var(--ink)' }}
    >
      {label}
    </text>
  </g>
);

const Chip = ({
  x,
  y,
  w,
  label,
  color = 'var(--surface)',
  text = 'var(--ink)',
  delay = 0,
  mono,
  font,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  color?: string;
  text?: string;
  delay?: number;
  mono?: boolean;
  font?: string;
}) => (
  <g className="tut-pop" style={{ '--d': `${delay}s` } as CSSProperties}>
    <rect
      x={x}
      y={y}
      width={w}
      height={28}
      rx={9}
      style={{ fill: color, stroke: 'var(--border)' }}
    />
    <text
      x={x + w / 2}
      y={y + 14.5}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={font ? 15 : mono ? 10.5 : 12}
      fontWeight={font ? 400 : 700}
      fontFamily={font ?? (mono ? '"JetBrains Mono Variable", monospace' : undefined)}
      style={{ fill: text }}
    >
      {label}
    </text>
  </g>
);

const ArrowMarker = ({ id }: { id: string }) => (
  <defs>
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="8"
      refY="5"
      markerWidth="7"
      markerHeight="7"
      orient="auto-start-reverse"
    >
      <path
        d="M1 1 L9 5 L1 9"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </marker>
  </defs>
);

const Svg = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 440 300"
    width="100%"
    height="100%"
    style={{ display: 'block', overflow: 'visible' }}
  >
    {children}
  </svg>
);

// ---------------------------------------------------------------------------------------------

const welcome = {
  idea: rect(28, 112, 104, 68, { fill: 'var(--c-yellow)', fillStyle: 'hachure', seed: 11 }),
  a1: line(
    [
      [138, 146],
      [172, 146],
    ],
    { seed: 4 },
  ),
  a1h: line(
    [
      [163, 139],
      [173, 146],
      [163, 153],
    ],
    { seed: 5 },
  ),
  sketch: ellipse(232, 146, 112, 80, { fill: 'var(--c-blue)', fillStyle: 'cross-hatch', seed: 7 }),
  a2: line(
    [
      [292, 146],
      [322, 146],
    ],
    { seed: 8 },
  ),
  a2h: line(
    [
      [313, 139],
      [323, 146],
      [313, 153],
    ],
    { seed: 9 },
  ),
  share: poly(
    [
      [378, 98],
      [428, 146],
      [378, 194],
      [328, 146],
    ],
    { fill: 'var(--c-green)', fillStyle: 'solid', seed: 3 },
  ),
  underline: curve(
    [
      [120, 70],
      [180, 64],
      [250, 70],
      [320, 63],
    ],
    { stroke: 'var(--accent)', strokeWidth: 3, seed: 2 },
  ),
};

export function WelcomeIllustration() {
  return (
    <Svg>
      <Hand x={220} y={42} size={34} delay={0}>
        hello, ideas!
      </Hand>
      <R d={welcome.underline} delay={0.3} />
      <R d={welcome.idea} delay={0.6} />
      <Hand x={80} y={146} delay={1.1}>
        Idea
      </Hand>
      <R d={welcome.a1} delay={1.2} dur={0.4} />
      <R d={welcome.a1h} delay={1.5} dur={0.3} />
      <R d={welcome.sketch} delay={1.6} />
      <Hand x={232} y={146} delay={2.1}>
        Sketch
      </Hand>
      <R d={welcome.a2} delay={2.2} dur={0.4} />
      <R d={welcome.a2h} delay={2.5} dur={0.3} />
      <R d={welcome.share} delay={2.6} />
      <Hand x={378} y={146} delay={3.1}>
        Share
      </Hand>
      {[
        [60, 230, 0, 3.3],
        [380, 60, 1, 3.5],
        [250, 240, 2, 3.7],
        [40, 70, 1, 3.9],
      ].map(([x, y, c, d], i) => (
        <g key={i} className="tut-pop" style={{ '--d': `${d}s` } as CSSProperties}>
          <path
            className="tut-float"
            d={`M${x} ${y - 10} Q${x + 2} ${y - 2} ${x + 10} ${y} Q${x + 2} ${y + 2} ${x} ${y + 10} Q${x - 2} ${y + 2} ${x - 10} ${y} Q${x - 2} ${y - 2} ${x} ${y - 10}Z`}
            style={{ fill: ['var(--c-yellow)', 'var(--accent)', 'var(--c-purple)'][c] }}
          />
        </g>
      ))}
      <Hand x={330} y={250} size={15} delay={3.8} color="var(--ink-soft)">
        no account needed ✓
      </Hand>
    </Svg>
  );
}

// ---------------------------------------------------------------------------------------------

const tools = {
  rect: rect(60, 100, 120, 80, { fill: 'var(--c-red)', fillStyle: 'hachure', seed: 21 }),
  ellipse: ellipse(300, 140, 130, 88, { fill: 'var(--c-blue)', fillStyle: 'zigzag', seed: 22 }),
  arrow: line(
    [
      [186, 140],
      [228, 140],
    ],
    { seed: 23 },
  ),
  arrowHead: line(
    [
      [218, 133],
      [229, 140],
      [218, 147],
    ],
    { seed: 24 },
  ),
};

const TOOL_GLYPHS = [
  <rect key="r" x={-7} y={-6} width={14} height={12} rx={2} />,
  <path key="d" d="M0 -8 L8 0 L0 8 L-8 0 Z" />,
  <circle key="c" r={7} />,
  <path key="a" d="M-8 0 H7 M2 -5 L7 0 L2 5" />,
  <path key="l" d="M-8 5 L8 -5" />,
  <path key="p" d="M-7 7 L-6 3 L4 -7 L7 -4 L-3 6 Z" />,
  <path key="t" d="M-6 -6 H6 M0 -6 V7" />,
];

export function ToolsIllustration() {
  return (
    <Svg>
      <style>{`
        .tut-tool-hl { animation: tut-tool-hl 5.6s ease both; }
        @keyframes tut-tool-hl { 0%,28% { transform: translateX(0px) } 31%,52% { transform: translateX(60px) } 55%,73% { transform: translateX(90px) } 76%,100% { transform: translateX(150px) } }
        .tut-tools-cursor { animation: tut-tools-cursor 5.6s ease-in-out both; }
        @keyframes tut-tools-cursor {
          0% { transform: translate(60px,100px) } 25% { transform: translate(180px,180px) }
          32% { transform: translate(235px,96px) } 50% { transform: translate(365px,184px) }
          56% { transform: translate(186px,140px) } 70% { transform: translate(228px,140px) }
          77% { transform: translate(90px,238px) } 100% { transform: translate(370px,244px) } }
      `}</style>
      <rect
        x={110}
        y={16}
        width={220}
        height={40}
        rx={13}
        style={{ fill: 'var(--surface)', stroke: 'var(--border)' }}
      />
      <rect
        className="tut-tool-hl"
        x={124}
        y={23}
        width={26}
        height={26}
        rx={8}
        style={{ fill: 'var(--accent)' }}
      />
      {TOOL_GLYPHS.map((g, i) => (
        <g
          key={i}
          transform={`translate(${137 + i * 30} 36)`}
          style={{
            fill: 'none',
            stroke: 'var(--ink)',
            strokeWidth: 1.6,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }}
        >
          {g}
        </g>
      ))}
      <R d={tools.rect} delay={0.2} dur={1.1} />
      <R d={tools.ellipse} delay={1.8} dur={1.1} />
      <R d={tools.arrow} delay={3.1} dur={0.6} />
      <R d={tools.arrowHead} delay={3.7} dur={0.3} />
      <g className="tut-draw" style={{ '--d': '4.3s', '--dur': '1.3s' } as CSSProperties}>
        <path
          d="M90 240 C120 210, 150 270, 190 235 S260 220, 300 250 S350 230, 370 245"
          pathLength={1}
          style={{
            fill: 'none',
            stroke: 'var(--c-purple-ink)',
            strokeWidth: 4,
            strokeLinecap: 'round',
          }}
        />
      </g>
      <Cursor className="tut-tools-cursor" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------------------------

const select = {
  card: rect(160, 100, 130, 90, { fill: 'var(--c-green)', fillStyle: 'hachure', seed: 31 }),
  small1: ellipse(70, 230, 50, 40, { fill: 'var(--c-yellow)', fillStyle: 'solid', seed: 32 }),
  small2: poly(
    [
      [360, 210],
      [392, 250],
      [328, 250],
    ],
    { fill: 'var(--c-pink)', fillStyle: 'solid', seed: 33 },
  ),
};

export function SelectIllustration() {
  const handles: [number, number][] = [
    [152, 92],
    [225, 92],
    [298, 92],
    [298, 145],
    [298, 198],
    [225, 198],
    [152, 198],
    [152, 145],
  ];
  return (
    <Svg>
      <R d={select.small1} delay={0.1} />
      <R d={select.small2} delay={0.3} />
      <g className="tut-transform">
        <R d={select.card} delay={0} />
        <Hand x={225} y={145} size={20}>
          Drag me
        </Hand>
        <rect
          x={152}
          y={92}
          width={146}
          height={106}
          fill="none"
          style={{ stroke: 'var(--accent)', strokeWidth: 1.5 }}
        />
        <line
          x1={225}
          y1={92}
          x2={225}
          y2={72}
          style={{ stroke: 'var(--accent)', strokeWidth: 1.5 }}
        />
        <circle
          cx={225}
          cy={68}
          r={5}
          style={{ fill: '#fff', stroke: 'var(--accent)', strokeWidth: 1.8 }}
        />
        {handles.map(([x, y], i) => (
          <rect
            key={i}
            x={x - 4.5}
            y={y - 4.5}
            width={9}
            height={9}
            rx={2.5}
            style={{ fill: '#fff', stroke: 'var(--accent)', strokeWidth: 1.6 }}
          />
        ))}
      </g>
      <g transform="translate(298 198)">
        <Cursor className="tut-cursor-transform" />
      </g>
      <Chip x={20} y={24} w={112} label="Shift + click" delay={0.8} />
      <Chip x={150} y={24} w={140} label="Alt + drag = copy" delay={1.1} />
      <Chip x={308} y={24} w={112} label="Ctrl + G group" delay={1.4} />
      <Hand x={70} y={275} size={14} color="var(--ink-soft)" delay={1.6}>
        smart guides snap ✦
      </Hand>
    </Svg>
  );
}

// ---------------------------------------------------------------------------------------------

const arrows = {
  client: rect(30, 100, 120, 76, { fill: 'var(--c-blue)', fillStyle: 'hachure', seed: 41 }),
  server: ellipse(340, 138, 124, 84, { fill: 'var(--c-red)', fillStyle: 'cross-hatch', seed: 42 }),
};

export function ArrowsIllustration() {
  const kt = '0;0.3;0.5;0.8;1';
  const spline = '0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1';
  return (
    <Svg>
      <ArrowMarker id="tut-arrow" />
      <R d={arrows.client} delay={0} />
      <Hand x={90} y={138}>
        Client
      </Hand>
      <line
        x1={156}
        y1={138}
        x2={272}
        y2={138}
        markerEnd="url(#tut-arrow)"
        style={{ stroke: 'var(--ink)', strokeWidth: 2.2, strokeLinecap: 'round' }}
      >
        <animate
          attributeName="y1"
          values="138;128;138;148;138"
          keyTimes={kt}
          dur="4s"
          repeatCount="indefinite"
          calcMode="spline"
          keySplines={spline}
        />
        <animate
          attributeName="y2"
          values="138;66;138;210;138"
          keyTimes={kt}
          dur="4s"
          repeatCount="indefinite"
          calcMode="spline"
          keySplines={spline}
        />
        <animate
          attributeName="x2"
          values="272;282;272;282;272"
          keyTimes={kt}
          dur="4s"
          repeatCount="indefinite"
          calcMode="spline"
          keySplines={spline}
        />
      </line>
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0;0 -78;0 0;0 78;0 0"
          keyTimes={kt}
          dur="4s"
          repeatCount="indefinite"
          calcMode="spline"
          keySplines={spline}
        />
        <R d={arrows.server} delay={0.3} />
        <Hand x={340} y={138}>
          Server
        </Hand>
        <g transform="translate(372 160)">
          <Cursor />
        </g>
      </g>
      <path
        d="M60 222 Q 220 282 380 222"
        fill="none"
        markerEnd="url(#tut-arrow)"
        className="tut-fade-in"
        style={
          {
            stroke: 'var(--ink-soft)',
            strokeWidth: 2,
            strokeDasharray: '7 7',
            '--d': '0.9s',
          } as CSSProperties
        }
      />
      <Hand x={220} y={278} size={15} color="var(--ink-soft)" delay={1.1}>
        curved · dashed · labeled
      </Hand>
      <Chip
        x={160}
        y={28}
        w={120}
        label="arrows stick ✓"
        color="var(--accent)"
        text="var(--accent-contrast)"
        delay={0.6}
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------------------------

const styles = {
  hachure: rect(28, 40, 110, 80, { fill: 'var(--c-red)', fillStyle: 'hachure', seed: 51 }),
  cross: rect(165, 40, 110, 80, { fill: 'var(--c-blue)', fillStyle: 'cross-hatch', seed: 52 }),
  solid: rect(302, 40, 110, 80, { fill: 'var(--c-green)', fillStyle: 'solid', seed: 53 }),
  architect: line(
    [
      [30, 170],
      [140, 170],
    ],
    { roughness: 0, seed: 54 },
  ),
  artist: line(
    [
      [165, 170],
      [275, 170],
    ],
    { roughness: 1.4, seed: 55 },
  ),
  cartoon: line(
    [
      [300, 170],
      [410, 170],
    ],
    { roughness: 3, seed: 56 },
  ),
  dashed: line(
    [
      [30, 205],
      [140, 205],
    ],
    { strokeLineDash: [8, 8], seed: 57, roughness: 0.6 },
  ),
  dotted: line(
    [
      [165, 205],
      [275, 205],
    ],
    { strokeLineDash: [1, 8], strokeWidth: 3, seed: 58, roughness: 0.3 },
  ),
  thick: line(
    [
      [300, 205],
      [410, 205],
    ],
    { strokeWidth: 5, seed: 59, roughness: 0.8 },
  ),
};

export function StyleIllustration() {
  const swatches = [
    'var(--c-red)',
    'var(--c-blue)',
    'var(--c-green)',
    'var(--c-yellow)',
    'var(--c-purple)',
  ];
  return (
    <Svg>
      <R d={styles.hachure} delay={0} />
      <R d={styles.cross} delay={0.3} />
      <R d={styles.solid} delay={0.6} />
      <Hand x={83} y={137} size={14} color="var(--ink-soft)">
        hachure
      </Hand>
      <Hand x={220} y={137} size={14} color="var(--ink-soft)">
        cross-hatch
      </Hand>
      <Hand x={357} y={137} size={14} color="var(--ink-soft)">
        solid
      </Hand>
      <R d={styles.architect} delay={1.0} dur={0.5} />
      <R d={styles.artist} delay={1.2} dur={0.5} />
      <R d={styles.cartoon} delay={1.4} dur={0.5} />
      <R d={styles.dashed} delay={1.6} dur={0.5} />
      <R d={styles.dotted} delay={1.8} dur={0.5} />
      <R d={styles.thick} delay={2.0} dur={0.5} />
      <g transform="translate(135 238)">
        {swatches.map((c, i) => (
          <rect
            key={i}
            x={i * 34}
            y={0}
            width={26}
            height={26}
            rx={8}
            className="tut-pop"
            style={{ fill: c, '--d': `${2.2 + i * 0.08}s` } as CSSProperties}
          />
        ))}
        <rect
          className="tut-swatch-ring"
          x={-4}
          y={-4}
          width={34}
          height={34}
          rx={11}
          fill="none"
          style={{ stroke: 'var(--accent)', strokeWidth: 2.4 }}
        />
      </g>
    </Svg>
  );
}

// ---------------------------------------------------------------------------------------------

const textIllo = {
  box: rect(40, 60, 210, 100, { fill: 'var(--c-yellow)', fillStyle: 'hachure', seed: 61 }),
  sticky: rect(280, 150, 130, 100, {
    fill: 'var(--c-pink)',
    fillStyle: 'solid',
    seed: 62,
    roughness: 0.6,
  }),
};

export function TextIllustration() {
  return (
    <Svg>
      <defs>
        <clipPath id="tut-type-clip">
          <rect
            className="tut-type"
            x={52}
            y={95}
            width={186}
            height={30}
            style={{ '--d': '0.8s', '--dur': '1.8s', '--steps': 22 } as CSSProperties}
          />
        </clipPath>
        <clipPath id="tut-type-clip2">
          <rect
            className="tut-type"
            x={40}
            y={200}
            width={220}
            height={60}
            style={{ '--d': '2.8s', '--dur': '1.2s', '--steps': 12 } as CSSProperties}
          />
        </clipPath>
      </defs>
      <R d={textIllo.box} delay={0} />
      <g clipPath="url(#tut-type-clip)">
        <Hand x={145} y={110} size={21}>
          Double-click me!
        </Hand>
      </g>
      <rect
        x={236}
        y={98}
        width={2}
        height={24}
        className="tut-blink"
        style={{ fill: 'var(--accent)' }}
      />
      <g clipPath="url(#tut-type-clip2)">
        <Hand x={44} y={228} size={36} anchor="start">
          Hello ✏️
        </Hand>
      </g>
      <g transform="rotate(4 345 200)">
        <R d={textIllo.sticky} delay={1.4} />
        <Hand x={345} y={190} size={17} delay={1.9}>
          labels move
        </Hand>
        <Hand x={345} y={212} size={17} delay={2.0}>
          with shapes
        </Hand>
      </g>
      <Chip x={290} y={36} w={42} label="Aa" font={HAND_FONT} delay={0.4} />
      <Chip x={338} y={36} w={42} label="Aa" delay={0.5} />
      <Chip x={386} y={36} w={42} label="Aa" mono delay={0.6} />
    </Svg>
  );
}

// ---------------------------------------------------------------------------------------------

const canvasIllo = {
  a: rect(60, 70, 80, 56, { fill: 'var(--c-blue)', fillStyle: 'hachure', seed: 71 }),
  b: ellipse(250, 110, 90, 60, { fill: 'var(--c-yellow)', fillStyle: 'solid', seed: 72 }),
  c: poly(
    [
      [400, 60],
      [440, 100],
      [400, 140],
      [360, 100],
    ],
    { fill: 'var(--c-green)', fillStyle: 'cross-hatch', seed: 73 },
  ),
  d: rect(140, 190, 100, 60, { fill: 'var(--c-pink)', fillStyle: 'hachure', seed: 74 }),
  e: ellipse(430, 230, 70, 50, { fill: 'var(--c-purple)', fillStyle: 'solid', seed: 75 }),
};

export function CanvasIllustration() {
  return (
    <Svg>
      <defs>
        <pattern id="tut-dots" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.2" style={{ fill: 'var(--dot)' }} />
        </pattern>
        <clipPath id="tut-viewport">
          <rect x={10} y={10} width={420} height={280} rx={14} />
        </clipPath>
      </defs>
      <g clipPath="url(#tut-viewport)">
        <g className="tut-pan">
          <rect x={-200} y={-200} width={900} height={700} fill="url(#tut-dots)" />
          <R d={canvasIllo.a} />
          <R d={canvasIllo.b} delay={0.2} />
          <R d={canvasIllo.c} delay={0.4} />
          <R d={canvasIllo.d} delay={0.6} />
          <R d={canvasIllo.e} delay={0.8} />
          <path
            d="M 145 98 C 180 95, 190 108, 203 110"
            fill="none"
            style={{ stroke: 'var(--ink)', strokeWidth: 2 }}
          />
        </g>
      </g>
      <g transform="translate(316 206)">
        <rect
          width={104}
          height={70}
          rx={10}
          style={{ fill: 'var(--surface)', stroke: 'var(--border)' }}
        />
        {[
          [10, 12, 16, 10],
          [44, 16, 14, 9],
          [74, 10, 12, 12],
          [30, 42, 16, 9],
          [78, 44, 12, 10],
        ].map(([x, y, w, h], i) => (
          <rect
            key={i}
            x={x}
            y={y}
            width={w}
            height={h}
            rx={2}
            style={{ fill: 'var(--ink-soft)', opacity: 0.35 }}
          />
        ))}
        <rect
          className="tut-pan-view"
          x={8}
          y={8}
          width={60}
          height={44}
          rx={4}
          style={{ fill: 'var(--accent-soft)', stroke: 'var(--accent)', strokeWidth: 1.5 }}
        />
      </g>
      <g transform="translate(26 236)">
        <rect
          width={110}
          height={34}
          rx={10}
          style={{ fill: 'var(--surface)', stroke: 'var(--border)' }}
        />
        <text
          x={18}
          y={18}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={16}
          fontWeight={700}
          style={{ fill: 'var(--ink)' }}
        >
          −
        </text>
        <text
          x={55}
          y={18}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={12}
          fontWeight={700}
          style={{ fill: 'var(--ink)' }}
        >
          118%
        </text>
        <text
          x={92}
          y={18}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={16}
          fontWeight={700}
          style={{ fill: 'var(--ink)' }}
        >
          +
        </text>
      </g>
      <g transform="translate(205 140)">
        <Cursor hand className="tut-float" />
      </g>
    </Svg>
  );
}

// ---------------------------------------------------------------------------------------------

const shareIllo = {
  board: rect(26, 60, 150, 110, {
    fill: 'var(--surface)',
    fillStyle: 'solid',
    seed: 81,
    roughness: 0.5,
  }),
  b1: rect(42, 80, 46, 30, {
    fill: 'var(--c-yellow)',
    fillStyle: 'hachure',
    seed: 82,
    strokeWidth: 1.4,
  }),
  b2: ellipse(136, 96, 46, 30, {
    fill: 'var(--c-blue)',
    fillStyle: 'hachure',
    seed: 83,
    strokeWidth: 1.4,
  }),
  b3: rect(70, 128, 70, 26, {
    fill: 'var(--c-green)',
    fillStyle: 'solid',
    seed: 84,
    strokeWidth: 1.4,
  }),
  arrow: curve(
    [
      [186, 115],
      [210, 100],
      [236, 108],
    ],
    { seed: 85 },
  ),
};

export function ShareIllustration() {
  return (
    <Svg>
      <ArrowMarker id="tut-arrow-share" />
      <R d={shareIllo.board} />
      <R d={shareIllo.b1} delay={0.3} dur={0.6} />
      <R d={shareIllo.b2} delay={0.45} dur={0.6} />
      <R d={shareIllo.b3} delay={0.6} dur={0.6} />
      <R d={shareIllo.arrow} delay={0.9} dur={0.5} />
      <path
        d="M228 102 L238 108 L228 115"
        fill="none"
        className="tut-fade-in"
        style={
          {
            stroke: 'var(--ink)',
            strokeWidth: 2,
            strokeLinecap: 'round',
            '--d': '1.3s',
          } as CSSProperties
        }
      />
      <g className="tut-pop" style={{ '--d': '1.4s' } as CSSProperties}>
        <rect
          x={246}
          y={88}
          width={176}
          height={40}
          rx={12}
          style={{ fill: 'var(--surface)', stroke: 'var(--border)' }}
        />
        <text
          x={258}
          y={109}
          dominantBaseline="central"
          fontSize={10.5}
          fontFamily='"JetBrains Mono Variable", monospace'
          style={{ fill: 'var(--ink-soft)' }}
        >
          …/#board=eNqrVk
        </text>
        <rect x={378} y={96} width={36} height={24} rx={7} style={{ fill: 'var(--accent)' }} />
        <path
          d="M389 108 l4 4 l8 -8"
          fill="none"
          className="tut-fade-in"
          style={
            {
              stroke: 'var(--accent-contrast)',
              strokeWidth: 2.2,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              '--d': '2.4s',
            } as CSSProperties
          }
        />
      </g>
      <g transform="translate(396 112)">
        <circle
          r={14}
          className="tut-click"
          style={{ fill: 'var(--accent-soft)', '--d': '1.2s' } as CSSProperties}
        />
        <Cursor />
      </g>
      <Hand x={334} y={152} size={14} color="var(--ink-soft)" delay={2.2}>
        the board lives in the link
      </Hand>
      <Chip x={48} y={214} w={78} label="PNG" delay={2.6} />
      <Chip x={136} y={214} w={78} label="SVG" delay={2.75} />
      <Chip x={224} y={214} w={110} label=".sketchboard" delay={2.9} />
      <Chip x={344} y={214} w={70} label="Copy" delay={3.05} />
      <Hand x={220} y={268} size={15} color="var(--ink-soft)" delay={3.3}>
        no server · no account · works offline
      </Hand>
    </Svg>
  );
}

// ---------------------------------------------------------------------------------------------

export function ProIllustration() {
  return (
    <Svg>
      <g className="tut-pop" style={{ '--d': '0.1s' } as CSSProperties}>
        <rect
          x={40}
          y={30}
          width={250}
          height={170}
          rx={16}
          style={{ fill: 'var(--surface)', stroke: 'var(--border)' }}
        />
        <line x1={40} y1={70} x2={290} y2={70} style={{ stroke: 'var(--border)' }} />
        <circle
          cx={62}
          cy={50}
          r={6}
          fill="none"
          style={{ stroke: 'var(--ink-soft)', strokeWidth: 1.6 }}
        />
        <line
          x1={66.5}
          y1={54.5}
          x2={71}
          y2={59}
          style={{ stroke: 'var(--ink-soft)', strokeWidth: 1.6, strokeLinecap: 'round' }}
        />
        <clipPath id="tut-query">
          <rect
            className="tut-type"
            x={80}
            y={40}
            width={60}
            height={22}
            style={{ '--d': '0.6s', '--dur': '0.8s', '--steps': 5 } as CSSProperties}
          />
        </clipPath>
        <text
          x={82}
          y={51}
          dominantBaseline="central"
          fontSize={13}
          fontWeight={600}
          clipPath="url(#tut-query)"
          style={{ fill: 'var(--ink)' }}
        >
          align
        </text>
        <rect
          className="tut-row-highlight"
          x={50}
          y={80}
          width={230}
          height={30}
          rx={8}
          style={{ fill: 'var(--accent-soft)' }}
        />
        {['Align left', 'Align center', 'Align right'].map((l, i) => (
          <g key={l}>
            <text
              x={66}
              y={95 + i * 34}
              dominantBaseline="central"
              fontSize={12.5}
              fontWeight={600}
              style={{ fill: 'var(--ink)' }}
            >
              {l}
            </text>
            <rect
              x={238}
              y={86 + i * 34}
              width={30}
              height={18}
              rx={5}
              style={{ fill: 'var(--key-shadow)' }}
            />
          </g>
        ))}
      </g>
      <Key x={312} y={60} w={52} label="Ctrl" delay={0} />
      <Key x={372} y={60} label="K" delay={0.05} />
      <Key x={312} y={110} w={34} label="?" delay={1.2} />
      <Hand x={386} y={126} size={15} color="var(--ink-soft)" anchor="middle">
        shortcuts
      </Hand>
      <g className="tut-laser" style={{ filter: 'drop-shadow(0 0 4px var(--laser))' }}>
        <path
          d="M60 250 C 110 210, 150 280, 200 240 S 280 200, 330 250 S 390 260, 410 230"
          pathLength={1}
          fill="none"
          style={{ stroke: 'var(--laser)', strokeWidth: 4, strokeLinecap: 'round' }}
        />
      </g>
      <Hand x={110} y={282} size={14} color="var(--ink-soft)">
        laser pointer for presenting
      </Hand>
      <Chip x={312} y={160} w={108} label="Right-click ⋯" delay={0.8} />
    </Svg>
  );
}

// ---------------------------------------------------------------------------------------------

const ready = {
  check: line(
    [
      [160, 150],
      [205, 195],
      [290, 100],
    ],
    { stroke: 'var(--accent)', strokeWidth: 9, roughness: 1.6, seed: 91 },
  ),
  circle: ellipse(220, 150, 220, 180, {
    stroke: 'var(--ink)',
    strokeWidth: 2.5,
    roughness: 1.6,
    seed: 92,
  }),
};

export function ReadyIllustration() {
  const confetti = [
    [60, 40, 'var(--c-red)', 0],
    [120, 20, 'var(--c-blue)', 0.6],
    [330, 30, 'var(--c-yellow)', 1.1],
    [390, 60, 'var(--c-green)', 0.3],
    [40, 140, 'var(--c-purple)', 1.5],
    [400, 160, 'var(--c-pink)', 0.9],
    [300, 10, 'var(--c-green)', 2],
    [160, 30, 'var(--c-yellow)', 2.4],
  ] as const;
  return (
    <Svg>
      {confetti.map(([x, y, c, d], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={10}
          height={6}
          rx={2}
          className="tut-confetti"
          style={{ fill: c, '--d': `${d}s` } as CSSProperties}
        />
      ))}
      <R d={ready.circle} delay={0.1} dur={1} />
      <R d={ready.check} delay={0.8} dur={0.7} />
      <Hand x={220} y={272} size={28} delay={1.4}>
        Let&apos;s draw!
      </Hand>
    </Svg>
  );
}
