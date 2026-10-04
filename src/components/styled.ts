import { Box } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';

/** Floating glass panel used for every piece of UI that sits on the canvas. */
export const Island = styled(Box)(({ theme }) => ({
  background: theme.tokens.surface,
  backdropFilter: 'blur(18px) saturate(1.6)',
  WebkitBackdropFilter: 'blur(18px) saturate(1.6)',
  borderRadius: 16,
  boxShadow: theme.tokens.shadow,
  pointerEvents: 'auto',
}));

export const Swatch = styled('button', {
  shouldForwardProp: (p) => p !== 'color' && p !== 'selected' && p !== 'swatchSize',
})<{ color: string; selected?: boolean; swatchSize?: number }>(
  ({ theme, color, selected, swatchSize = 26 }) => ({
    width: swatchSize,
    height: swatchSize,
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    position: 'relative',
    flexShrink: 0,
    background:
      color === 'transparent'
        ? `repeating-conic-gradient(${alpha(theme.tokens.ink, 0.12)} 0% 25%, transparent 0% 50%) 50% / 10px 10px`
        : color,
    boxShadow: selected
      ? `0 0 0 2px ${theme.tokens.surfaceSolid}, 0 0 0 4px ${theme.tokens.accent}`
      : `inset 0 0 0 1px ${alpha(theme.tokens.ink, 0.12)}`,
    transition: 'transform .12s ease, box-shadow .15s ease',
    '&:hover': { transform: 'scale(1.08)' },
    '&:focus-visible': { outline: `2px solid ${theme.tokens.accent}`, outlineOffset: 2 },
  }),
);
