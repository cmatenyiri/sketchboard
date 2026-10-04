import { alpha, createTheme, type Theme } from '@mui/material/styles';
import type { ThemeMode } from '../types';
import { getTokens, type Tokens } from './tokens';

declare module '@mui/material/styles' {
  interface Theme {
    tokens: Tokens;
  }
  interface ThemeOptions {
    tokens?: Tokens;
  }
}

export const UI_FONT = '"Plus Jakarta Sans Variable", "Plus Jakarta Sans", system-ui, sans-serif';
export const DISPLAY_FONT =
  '"Bricolage Grotesque Variable", "Plus Jakarta Sans Variable", sans-serif';
export const HAND_FONT = '"Kalam", cursive';

export const buildTheme = (mode: ThemeMode): Theme => {
  const t = getTokens(mode);
  return createTheme({
    tokens: t,
    palette: {
      mode,
      primary: { main: t.accent, dark: t.accentStrong, contrastText: t.accentContrast },
      secondary: { main: t.secondary },
      background: { default: t.paper, paper: t.surfaceSolid },
      text: { primary: t.ink, secondary: t.inkSoft, disabled: t.inkMuted },
      divider: t.border,
      error: { main: mode === 'dark' ? '#ff6b6b' : '#d92d20' },
      success: { main: mode === 'dark' ? '#4ade80' : '#13955f' },
      warning: { main: mode === 'dark' ? '#fbbf24' : '#c27803' },
      info: { main: t.secondary },
      action: {
        hover: alpha(t.ink, 0.06),
        selected: t.accentSoft,
        focus: alpha(t.accent, 0.2),
      },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: UI_FONT,
      fontSize: 13.5,
      h1: { fontFamily: DISPLAY_FONT, fontWeight: 800, letterSpacing: '-0.03em' },
      h2: { fontFamily: DISPLAY_FONT, fontWeight: 800, letterSpacing: '-0.03em' },
      h3: { fontFamily: DISPLAY_FONT, fontWeight: 750, letterSpacing: '-0.025em' },
      h4: { fontFamily: DISPLAY_FONT, fontWeight: 750, letterSpacing: '-0.02em' },
      h5: { fontFamily: DISPLAY_FONT, fontWeight: 700, letterSpacing: '-0.015em' },
      h6: {
        fontFamily: DISPLAY_FONT,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        fontSize: '1.05rem',
      },
      subtitle2: {
        fontWeight: 650,
        fontSize: '0.72rem',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      },
      button: { textTransform: 'none', fontWeight: 650, letterSpacing: 0 },
      body2: { fontSize: '0.84rem' },
      caption: { fontSize: '0.74rem' },
    },
    shadows: [
      'none',
      t.shadow,
      t.shadow,
      t.shadow,
      t.shadow,
      t.shadow,
      t.shadow,
      t.shadow,
      t.shadowLg,
      t.shadowLg,
      t.shadowLg,
      t.shadowLg,
      t.shadowLg,
      t.shadowLg,
      t.shadowLg,
      t.shadowLg,
      t.shadowLg,
      t.shadowLg,
      t.shadowLg,
      t.shadowLg,
      t.shadowLg,
      t.shadowLg,
      t.shadowLg,
      t.shadowLg,
      t.shadowLg,
    ],
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          'html, body, #root': { height: '100%', overflow: 'hidden', overscrollBehavior: 'none' },
          body: {
            background: t.paper,
            WebkitFontSmoothing: 'antialiased',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          },
          '::selection': { background: alpha(t.accent, 0.25) },
          'input, textarea': { userSelect: 'text', WebkitUserSelect: 'text' },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiButtonBase: { defaultProps: { disableRipple: true } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 10,
            paddingInline: 14,
            minHeight: 36,
            transition: 'transform .12s ease, background-color .15s ease, box-shadow .15s ease',
            '&:active': { transform: 'translateY(1px) scale(0.99)' },
            variants: [
              {
                props: { variant: 'contained', color: 'primary' },
                style: {
                  background: `linear-gradient(180deg, ${alpha('#ffffff', 0.14)}, ${alpha('#ffffff', 0)}) ${t.accent}`,
                  boxShadow: `0 1px 0 ${alpha('#ffffff', 0.25)} inset, 0 6px 16px -6px ${alpha(t.accent, 0.7)}`,
                  '&:hover': {
                    background: t.accentStrong,
                    boxShadow: `0 1px 0 ${alpha('#ffffff', 0.25)} inset, 0 8px 22px -6px ${alpha(t.accent, 0.8)}`,
                  },
                },
              },
            ],
          },
          outlined: {
            borderColor: t.borderStrong,
            color: t.ink,
            '&:hover': { borderColor: t.ink, background: alpha(t.ink, 0.04) },
          },
          text: { color: t.ink, '&:hover': { background: alpha(t.ink, 0.06) } },
          sizeSmall: { minHeight: 30, paddingInline: 10, fontSize: '0.8rem', borderRadius: 8 },
          sizeLarge: { minHeight: 44, paddingInline: 20, fontSize: '0.95rem', borderRadius: 12 },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            color: t.ink,
            transition: 'background-color .15s ease, color .15s ease, transform .12s ease',
            '&:hover': { background: alpha(t.ink, 0.07) },
            '&:active': { transform: 'scale(0.94)' },
            '&.Mui-disabled': { color: alpha(t.ink, 0.28) },
          },
          sizeSmall: { padding: 6 },
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: {
            gap: 4,
            background: t.surfaceSunken,
            padding: 3,
            borderRadius: 10,
          },
          grouped: {
            border: 'none !important',
            borderRadius: '8px !important',
            margin: '0 !important',
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            border: 'none',
            color: t.inkSoft,
            padding: 6,
            minWidth: 32,
            height: 30,
            textTransform: 'none',
            fontWeight: 650,
            fontSize: '0.78rem',
            '&:hover': { background: alpha(t.ink, 0.06), color: t.ink },
            '&.Mui-selected': {
              background: t.surfaceRaised,
              color: t.accent,
              boxShadow: `0 1px 2px ${alpha('#000', 0.12)}, 0 0 0 1px ${t.border}`,
              '&:hover': { background: t.surfaceRaised },
            },
          },
        },
      },
      MuiTooltip: {
        defaultProps: {
          arrow: false,
          enterDelay: 350,
          enterNextDelay: 120,
          disableInteractive: true,
        },
        styleOverrides: {
          tooltip: {
            background: mode === 'dark' ? '#f3efe8' : '#1d1b18',
            color: mode === 'dark' ? '#1d1b18' : '#f3efe8',
            fontSize: '0.74rem',
            fontWeight: 600,
            padding: '6px 9px',
            borderRadius: 8,
            boxShadow: t.shadow,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 22,
            background: t.surfaceSolid,
            boxShadow: t.shadowLg,
            border: `1px solid ${t.border}`,
          },
        },
      },
      MuiBackdrop: {
        styleOverrides: {
          root: {
            '&:not(.MuiBackdrop-invisible)': {
              background: alpha(
                mode === 'dark' ? '#000' : '#1d1b18',
                mode === 'dark' ? 0.55 : 0.32,
              ),
              backdropFilter: 'blur(4px)',
            },
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontFamily: DISPLAY_FONT,
            fontWeight: 750,
            fontSize: '1.25rem',
            letterSpacing: '-0.02em',
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 14,
            border: `1px solid ${t.border}`,
            boxShadow: t.shadowLg,
            background: t.surfaceSolid,
            minWidth: 220,
          },
          list: { padding: 6 },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontSize: '0.84rem',
            fontWeight: 550,
            minHeight: 34,
            gap: 10,
            '&:hover': { background: alpha(t.ink, 0.06) },
            '&.Mui-selected': { background: t.accentSoft },
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: { root: { minWidth: '0 !important', color: t.inkSoft } },
      },
      MuiDivider: { styleOverrides: { root: { borderColor: t.border } } },
      MuiSlider: {
        styleOverrides: {
          root: { height: 4, padding: '10px 0' },
          rail: { background: t.borderStrong, opacity: 1 },
          track: { border: 'none' },
          thumb: {
            width: 14,
            height: 14,
            background: '#fff',
            border: `2px solid ${t.accent}`,
            boxShadow: t.shadow,
            '&:hover, &.Mui-focusVisible': { boxShadow: `0 0 0 6px ${alpha(t.accent, 0.16)}` },
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          root: { width: 38, height: 22, padding: 0, margin: 6 },
          switchBase: {
            padding: 3,
            '&.Mui-checked': {
              transform: 'translateX(16px)',
              color: '#fff',
              '& + .MuiSwitch-track': { background: t.accent, opacity: 1 },
            },
          },
          thumb: { width: 16, height: 16, boxShadow: 'none' },
          track: { borderRadius: 11, background: t.borderStrong, opacity: 1 },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            background: t.surfaceSunken,
            '& fieldset': { borderColor: 'transparent' },
            '&:hover fieldset': { borderColor: `${t.borderStrong} !important` },
            '&.Mui-focused fieldset': {
              borderColor: `${t.accent} !important`,
              borderWidth: '1.5px !important',
            },
          },
          input: { padding: '9px 12px', fontSize: '0.86rem' },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 8, fontWeight: 650, fontSize: '0.72rem' },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
            border: `1px solid ${t.border}`,
            boxShadow: t.shadowLg,
            background: t.surfaceSolid,
          },
        },
      },
      MuiSnackbarContent: {
        styleOverrides: {
          root: { borderRadius: 12, fontWeight: 600 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 650, minHeight: 40 },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 4, height: 4, background: t.surfaceSunken },
        },
      },
    },
  });
};
