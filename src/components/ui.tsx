import { Box, IconButton, Tooltip, Typography, type BoxProps } from '@mui/material';
import type { LucideIcon } from 'lucide-react';
import { forwardRef, type ReactNode } from 'react';
import { comboParts } from '../actions/registry';

export const Kbd = ({ combo, size = 'sm' }: { combo: string; size?: 'sm' | 'md' }) => (
  <Box component="span" sx={{ display: 'inline-flex', gap: 0.4 }}>
    {comboParts(combo).map((k, i) => (
      <Box
        key={i}
        component="kbd"
        sx={(t) => ({
          fontFamily: 'inherit',
          fontSize: size === 'sm' ? '0.66rem' : '0.75rem',
          fontWeight: 700,
          lineHeight: 1,
          minWidth: size === 'sm' ? 18 : 22,
          height: size === 'sm' ? 18 : 22,
          px: 0.6,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 1,
          color: t.tokens.inkSoft,
          background: t.tokens.surfaceSunken,
          boxShadow: `inset 0 -1px 0 ${t.tokens.borderStrong}, 0 0 0 1px ${t.tokens.border}`,
        })}
      >
        {k}
      </Box>
    ))}
  </Box>
);

export const TooltipTitle = ({ label, combo }: { label: string; combo?: string }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    <span>{label}</span>
    {combo && (
      <Box component="span" sx={{ opacity: 0.6, fontWeight: 700, letterSpacing: '0.02em' }}>
        {comboParts(combo).join(' ')}
      </Box>
    )}
  </Box>
);

interface IconActionProps {
  icon: LucideIcon;
  label: string;
  combo?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
  disabled?: boolean;
  size?: number;
  testId?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export const IconAction = forwardRef<HTMLButtonElement, IconActionProps>(function IconAction(
  { icon: Icon, label, combo, onClick, active, disabled, size = 18, testId, placement = 'bottom' },
  ref,
) {
  return (
    <Tooltip title={<TooltipTitle label={label} combo={combo} />} placement={placement}>
      <span>
        <IconButton
          ref={ref}
          aria-label={label}
          aria-pressed={active}
          data-testid={testId}
          disabled={disabled}
          onClick={onClick}
          sx={(t) => ({
            width: 36,
            height: 36,
            ...(active && {
              color: t.tokens.accent,
              background: t.tokens.accentSoft,
              '&:hover': { background: t.tokens.accentSoft },
            }),
          })}
        >
          <Icon size={size} strokeWidth={1.9} />
        </IconButton>
      </span>
    </Tooltip>
  );
});

export const SectionLabel = ({ children, ...rest }: { children: ReactNode } & BoxProps) => (
  <Box {...rest}>
    <Typography
      variant="subtitle2"
      sx={(t) => ({ color: t.tokens.inkMuted, fontSize: '0.66rem', mb: 0.75, display: 'block' })}
    >
      {children}
    </Typography>
  </Box>
);

export const Logo = ({ size = 28 }: { size?: number }) => (
  <Box
    component="svg"
    viewBox="0 0 32 32"
    sx={{ width: size, height: size, display: 'block', flexShrink: 0 }}
    aria-hidden
  >
    <rect x="2" y="2" width="28" height="28" rx="9" fill="#f2542d" />
    <path
      d="M9.5 20.5c2.2-5.6 4.4-8.7 6.4-8.7 2.3 0 .4 7.2 2.6 7.2 1.5 0 2.7-2.4 4-5.6"
      fill="none"
      stroke="#fff"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="23.2" cy="10.2" r="1.9" fill="#ffd978" />
  </Box>
);
