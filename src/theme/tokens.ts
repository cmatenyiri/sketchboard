import type { ThemeMode } from '../types';

/** Design tokens shared by the MUI theme and the canvas renderer. */
export const tokens = {
  light: {
    accent: '#f2542d',
    accentStrong: '#d63f1a',
    accentSoft: 'rgba(242, 84, 45, 0.12)',
    accentContrast: '#ffffff',
    secondary: '#2f6fed',
    ink: '#1d1b18',
    inkSoft: '#5f5a52',
    inkMuted: '#8f897f',
    paper: '#fbf8f2',
    surface: 'rgba(255, 255, 255, 0.88)',
    surfaceSolid: '#ffffff',
    surfaceRaised: '#ffffff',
    surfaceSunken: '#f3efe7',
    border: 'rgba(29, 27, 24, 0.09)',
    borderStrong: 'rgba(29, 27, 24, 0.16)',
    shadow:
      '0 1px 2px rgba(29, 27, 24, 0.06), 0 8px 24px -6px rgba(29, 27, 24, 0.14), 0 0 0 1px rgba(29, 27, 24, 0.05)',
    shadowLg:
      '0 2px 6px rgba(29, 27, 24, 0.06), 0 24px 64px -12px rgba(29, 27, 24, 0.28), 0 0 0 1px rgba(29, 27, 24, 0.06)',
    selection: '#f2542d',
    selectionFill: 'rgba(242, 84, 45, 0.07)',
    snap: '#e6197a',
    laser: '#ff2d55',
  },
  dark: {
    accent: '#ff7a50',
    accentStrong: '#ff936e',
    accentSoft: 'rgba(255, 122, 80, 0.16)',
    accentContrast: '#1a0d07',
    secondary: '#7aa5ff',
    ink: '#f3efe8',
    inkSoft: '#b9b3a9',
    inkMuted: '#8a857d',
    paper: '#151413',
    surface: 'rgba(33, 32, 36, 0.86)',
    surfaceSolid: '#212024',
    surfaceRaised: '#29282d',
    surfaceSunken: '#1a191c',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.15)',
    shadow:
      '0 1px 2px rgba(0, 0, 0, 0.4), 0 10px 30px -8px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.06)',
    shadowLg:
      '0 2px 8px rgba(0, 0, 0, 0.45), 0 28px 70px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.07)',
    selection: '#ff7a50',
    selectionFill: 'rgba(255, 122, 80, 0.09)',
    snap: '#ff4fa3',
    laser: '#ff3b6b',
  },
} satisfies Record<ThemeMode, Record<string, string>>;

export type Tokens = (typeof tokens)['light'];

export const getTokens = (mode: ThemeMode): Tokens => tokens[mode];
