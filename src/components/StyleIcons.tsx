import type { Arrowhead, FillStyle, Roughness, StrokeStyle } from '../types';

const S = { width: 18, height: 18, viewBox: '0 0 20 20', fill: 'none' as const };
const stroke = {
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const FillIcon = ({ kind }: { kind: FillStyle }) => (
  <svg {...S}>
    <defs>
      <clipPath id={`fill-${kind}`}>
        <rect x="3" y="3" width="14" height="14" rx="3" />
      </clipPath>
    </defs>
    <rect x="3" y="3" width="14" height="14" rx="3" {...stroke} strokeWidth="1.6" />
    <g clipPath={`url(#fill-${kind})`} {...stroke} strokeWidth="1.3">
      {kind === 'solid' && <rect x="3" y="3" width="14" height="14" fill="currentColor" />}
      {(kind === 'hachure' || kind === 'cross-hatch') &&
        [-6, -1, 4, 9, 14].map((o) => <line key={o} x1={o} y1="20" x2={o + 14} y2="3" />)}
      {kind === 'cross-hatch' &&
        [-6, -1, 4, 9, 14].map((o) => <line key={`c${o}`} x1={o} y1="3" x2={o + 14} y2="20" />)}
      {kind === 'zigzag' && <path d="M2 16 L6 6 L9 16 L12 6 L15 16 L18 6" />}
    </g>
  </svg>
);

export const StrokeWidthIcon = ({ width }: { width: number }) => (
  <svg {...S}>
    <line
      x1="4"
      y1="10"
      x2="16"
      y2="10"
      {...stroke}
      strokeWidth={width === 1 ? 1.2 : width === 2 ? 2.4 : 4}
    />
  </svg>
);

export const StrokeStyleIcon = ({ kind }: { kind: StrokeStyle }) => (
  <svg {...S}>
    <line
      x1="3"
      y1="10"
      x2="17"
      y2="10"
      {...stroke}
      strokeWidth="2"
      strokeDasharray={kind === 'dashed' ? '4 3' : kind === 'dotted' ? '0.5 3.5' : undefined}
    />
  </svg>
);

export const SloppinessIcon = ({ level }: { level: Roughness }) => (
  <svg {...S}>
    <path
      d={
        level === 0
          ? 'M3 13 C7 13, 13 7, 17 7'
          : level === 1
            ? 'M3 13 C5 10, 7 14, 10 10 S 14 6, 17 7'
            : 'M3 13 C4 7, 6 15, 8 9 S 11 15, 13 8 S 16 9, 17 6'
      }
      {...stroke}
      strokeWidth="1.7"
    />
  </svg>
);

export const EdgeIcon = ({ round }: { round: boolean }) => (
  <svg {...S}>
    <path d={round ? 'M4 16 V10 Q4 4 10 4 H16' : 'M4 16 V4 H16'} {...stroke} strokeWidth="1.8" />
  </svg>
);

export const LineTypeIcon = ({ curved }: { curved: boolean }) => (
  <svg {...S}>
    <path d={curved ? 'M3 15 Q 10 1, 17 15' : 'M3 15 L10 5 L17 15'} {...stroke} strokeWidth="1.8" />
  </svg>
);

export const ArrowheadIcon = ({ kind, flip }: { kind: Arrowhead; flip?: boolean }) => (
  <svg {...S} style={flip ? { transform: 'scaleX(-1)' } : undefined}>
    <line x1="2" y1="10" x2={kind === 'none' ? 18 : 14} y2="10" {...stroke} strokeWidth="1.7" />
    {kind === 'arrow' && <path d="M11 6 L16 10 L11 14" {...stroke} strokeWidth="1.7" />}
    {kind === 'triangle' && (
      <path d="M12 6 L17 10 L12 14 Z" fill="currentColor" {...stroke} strokeWidth="1.2" />
    )}
    {kind === 'dot' && <circle cx="15" cy="10" r="2.6" fill="currentColor" />}
    {kind === 'bar' && <line x1="16" y1="5.5" x2="16" y2="14.5" {...stroke} strokeWidth="1.8" />}
    {kind === 'diamond' && (
      <path d="M18 10 L15 7 L12 10 L15 13 Z" fill="currentColor" {...stroke} strokeWidth="1.1" />
    )}
  </svg>
);
