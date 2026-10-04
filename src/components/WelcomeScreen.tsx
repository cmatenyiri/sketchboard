import { Box, ButtonBase, Typography } from '@mui/material';
import { BookOpen, Command, FolderOpen, LayoutTemplate, Sparkles } from 'lucide-react';
import { openFromFile } from '../actions/boardActions';
import { insertElements } from '../actions/sceneActions';
import { TEMPLATES } from '../scene/templates';
import { openDialog, useStore } from '../store/store';
import { DISPLAY_FONT, HAND_FONT } from '../theme/theme';
import { Kbd, Logo } from './ui';

const HintArrow = ({ d, sx }: { d: string; sx: object }) => (
  <Box
    component="svg"
    viewBox="0 0 100 100"
    sx={(t) => ({ position: 'absolute', overflow: 'visible', color: t.tokens.inkMuted, ...sx })}
    aria-hidden
  >
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Box>
);

const Hint = ({ children, sx }: { children: React.ReactNode; sx: object }) => (
  <Typography
    sx={(t) => ({
      position: 'absolute',
      fontFamily: HAND_FONT,
      fontSize: '1.15rem',
      lineHeight: 1.25,
      color: t.tokens.inkMuted,
      ...sx,
    })}
  >
    {children}
  </Typography>
);

export function WelcomeScreen() {
  const show = useStore(
    (s) =>
      s.ready &&
      s.elements.length === 0 &&
      !s.zenMode &&
      !s.viewMode &&
      !s.editing &&
      s.tool === 'select',
  );
  if (!show) return null;

  const actions = [
    {
      icon: FolderOpen,
      label: 'Open a board file',
      combo: 'mod+o',
      run: () => void openFromFile(),
    },
    { icon: LayoutTemplate, label: 'Start from a template', run: () => openDialog('templates') },
    {
      icon: Sparkles,
      label: 'Load the sample board',
      run: () => insertElements(TEMPLATES.find((t) => t.id === 'welcome')!.build()),
    },
    { icon: Command, label: 'Command palette', combo: 'mod+k', run: () => openDialog('commands') },
    { icon: BookOpen, label: 'Take the tour', run: () => openDialog('tutorial') },
  ];

  return (
    <Box
      data-testid="welcome-screen"
      sx={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
        animation: 'fadeIn .4s ease',
      }}
    >
      {/* Hints pointing at the UI */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <HintArrow
          d="M 10 90 C 20 40, 50 20, 92 8 M 80 4 L 92 8 L 84 18"
          sx={{ top: 74, left: 'calc(50% - 250px)', width: 110, height: 70 }}
        />
        <Hint sx={{ top: 150, left: 'calc(50% - 330px)', width: 220, textAlign: 'center' }}>
          Pick a tool &amp; start drawing!
        </Hint>
        <HintArrow
          d="M 90 95 C 60 85, 20 60, 8 10 M 2 22 L 8 10 L 18 20"
          sx={{ top: 74, left: 40, width: 60, height: 80 }}
        />
        <Hint sx={{ top: 168, left: 64, width: 210 }}>Boards, export, theme &amp; preferences</Hint>
        <HintArrow
          d="M 10 10 C 40 20, 70 50, 90 88 M 78 84 L 90 88 L 92 76"
          sx={{ bottom: 70, right: 46, width: 70, height: 70 }}
        />
        <Hint sx={{ bottom: 150, right: 70, width: 200, textAlign: 'right' }}>
          Shortcuts &amp; help live here
        </Hint>
      </Box>

      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -46%)',
          width: 'min(380px, calc(100vw - 32px))',
          textAlign: 'center',
        }}
      >
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 1 }}
        >
          <Logo size={44} />
          <Typography
            sx={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 800,
              fontSize: '2.4rem',
              letterSpacing: '-0.04em',
            }}
          >
            Sketchboard
          </Typography>
        </Box>
        <Typography
          sx={(t) => ({
            fontFamily: HAND_FONT,
            fontSize: '1.25rem',
            color: t.tokens.inkSoft,
            mb: 3,
          })}
        >
          Your ideas, hand-drawn. Everything stays in your browser.
        </Typography>
        <Box sx={{ display: 'grid', gap: 0.5, pointerEvents: 'auto' }}>
          {actions.map(({ icon: Icon, label, combo, run }) => (
            <ButtonBase
              key={label}
              onClick={run}
              sx={(t) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1.75,
                py: 1.15,
                borderRadius: '12px',
                color: t.tokens.inkSoft,
                transition: 'background-color .15s ease, color .15s ease',
                '&:hover': {
                  background: t.tokens.surface,
                  color: t.tokens.accent,
                  boxShadow: t.tokens.shadow,
                },
              })}
            >
              <Icon size={17} />
              <Typography
                variant="body2"
                sx={{ flex: 1, textAlign: 'left', fontWeight: 650, color: 'inherit' }}
              >
                {label}
              </Typography>
              {combo && <Kbd combo={combo} />}
            </ButtonBase>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
