import { Box, Button, Dialog, IconButton, Typography, useMediaQuery } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  ArrowLeft,
  ArrowRight,
  Command,
  Eye,
  FileDown,
  Grid3x3,
  Hand,
  Keyboard,
  LayoutTemplate,
  Layers,
  Link2,
  Lock,
  Magnet,
  MousePointerClick,
  Move,
  Palette,
  PenLine,
  Shapes,
  Spline,
  Sparkles,
  Type,
  X,
  ZoomIn,
  type LucideIcon,
} from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { insertElements } from '../actions/sceneActions';
import { Kbd, Logo } from '../components/ui';
import { setTutorialDone } from '../scene/persistence';
import { TEMPLATES } from '../scene/templates';
import { closeDialog, getState, useStore } from '../store/store';
import { DISPLAY_FONT, HAND_FONT } from '../theme/theme';
import {
  ArrowsIllustration,
  CanvasIllustration,
  ProIllustration,
  ReadyIllustration,
  SelectIllustration,
  ShareIllustration,
  StyleIllustration,
  TextIllustration,
  ToolsIllustration,
  WelcomeIllustration,
} from './Illustrations';

interface Point {
  icon: LucideIcon;
  text: string;
  combo?: string;
}

interface Step {
  kicker: string;
  title: string;
  body: string;
  points: Point[];
  tint: string;
  Illustration: () => React.JSX.Element;
}

const STEPS: Step[] = [
  {
    kicker: 'Welcome',
    title: 'Think on an endless sheet of paper',
    body: 'Sketchboard is a hand-drawn style whiteboard for sketching ideas, diagrams and wireframes. It runs entirely in your browser — no account, no server. Your boards stay on your device unless you share them.',
    points: [
      { icon: Sparkles, text: 'Hand-drawn shapes that feel like a napkin sketch' },
      { icon: Layers, text: 'Every change autosaves, across as many boards as you like' },
      { icon: Link2, text: 'Share a whole board as one link — no backend involved' },
    ],
    tint: '#ffb3a3',
    Illustration: WelcomeIllustration,
  },
  {
    kicker: 'Draw',
    title: 'Pick a tool, then drag',
    body: 'Choose a tool from the toolbar at the top — or press its key — and drag on the canvas. Shapes, arrows, lines, a pressure-sensitive pen, text and images are all a keystroke away.',
    points: [
      { icon: Shapes, text: 'Rectangle, diamond, ellipse', combo: 'r' },
      { icon: PenLine, text: 'Freehand pen with smooth strokes', combo: 'p' },
      { icon: Magnet, text: 'Hold Shift for perfect squares & 15° angles', combo: 'shift' },
      { icon: Lock, text: 'Lock a tool to draw many shapes in a row', combo: 'q' },
    ],
    tint: '#a5d2ff',
    Illustration: ToolsIllustration,
  },
  {
    kicker: 'Select & transform',
    title: 'Move, resize, rotate — precisely',
    body: 'Click to select, drag to move, or drag across empty space to select many. Use the handles to resize and rotate. Smart guides snap your shapes into line with their neighbours.',
    points: [
      { icon: MousePointerClick, text: 'Shift-click to add to the selection', combo: 'shift' },
      { icon: Move, text: 'Alt-drag duplicates, arrow keys nudge', combo: 'alt' },
      { icon: Layers, text: 'Group, lock, align, distribute & reorder', combo: 'mod+g' },
    ],
    tint: '#9be6c8',
    Illustration: SelectIllustration,
  },
  {
    kicker: 'Connect',
    title: 'Arrows that stick to shapes',
    body: 'Start or end an arrow on a shape and it binds to it. Move the shape and the arrow follows, keeping your diagram tidy. Click-click-click to draw multi-point lines and press Enter to finish.',
    points: [
      { icon: Spline, text: 'Drag the midpoint handles to bend a line' },
      { icon: Sparkles, text: 'Arrowheads: arrow, triangle, dot, bar, diamond' },
      { icon: Type, text: 'Double-click an arrow to give it a label' },
    ],
    tint: '#ffd978',
    Illustration: ArrowsIllustration,
  },
  {
    kicker: 'Style',
    title: 'Make it yours',
    body: 'The style panel appears whenever you select something. Set stroke and fill colors, hachure or solid fills, stroke width and dash style, and how sloppy the hand-drawn look should be.',
    points: [
      { icon: Palette, text: 'Curated palette, hex input & any custom color' },
      { icon: PenLine, text: 'Architect, artist or cartoonist sloppiness' },
      { icon: Sparkles, text: 'Copy & paste styles between elements', combo: 'mod+alt+c' },
    ],
    tint: '#c9b8ff',
    Illustration: StyleIllustration,
  },
  {
    kicker: 'Text',
    title: 'Words where you need them',
    body: 'Press T and click anywhere, or simply double-click the empty canvas. Double-click any shape or arrow to write a label that travels with it.',
    points: [
      { icon: Type, text: 'Hand-drawn, normal and code fonts in four sizes' },
      { icon: Shapes, text: 'Labels wrap & shapes grow to fit' },
      { icon: Keyboard, text: 'Finish editing with Esc or Ctrl+Enter', combo: 'escape' },
    ],
    tint: '#ffadd3',
    Illustration: TextIllustration,
  },
  {
    kicker: 'Navigate',
    title: 'An infinite canvas',
    body: 'Scroll to pan and Ctrl+scroll (or pinch) to zoom around the cursor. Hold Space and drag, or use the hand tool. Lost? Zoom to fit brings everything back into view.',
    points: [
      { icon: ZoomIn, text: 'Zoom to fit everything', combo: 'shift+1' },
      { icon: Hand, text: 'Pan with Space + drag', combo: 'space' },
      { icon: Grid3x3, text: 'Dot grid with snapping, minimap & zen mode', combo: "mod+'" },
    ],
    tint: '#9be6c8',
    Illustration: CanvasIllustration,
  },
  {
    kicker: 'Share & export',
    title: 'The board lives in the link',
    body: 'Share compresses your entire board into the URL itself, so anyone can open their own copy — optionally view-only. Export crisp PNG or SVG images, or save an editable file.',
    points: [
      { icon: Link2, text: 'Compressed share links, no server needed', combo: 'mod+shift+s' },
      { icon: FileDown, text: 'PNG (up to 4×), SVG, copy to clipboard', combo: 'mod+shift+e' },
      { icon: Eye, text: 'View-only mode for presenting' },
    ],
    tint: '#a5d2ff',
    Illustration: ShareIllustration,
  },
  {
    kicker: 'Power moves',
    title: 'Fly through it with the keyboard',
    body: 'Every action is searchable in the command palette. Right-click for context actions, press ? for all shortcuts, and use the laser pointer when you present.',
    points: [
      { icon: Command, text: 'Command palette', combo: 'mod+k' },
      { icon: LayoutTemplate, text: 'Templates: flowchart, mind map, kanban & more' },
      { icon: Sparkles, text: 'Laser pointer for presenting', combo: 'k' },
    ],
    tint: '#ffd978',
    Illustration: ProIllustration,
  },
  {
    kicker: 'All set',
    title: 'You’re ready to sketch',
    body: 'Start with a blank canvas, or open the sample board to play with a ready-made example. You can reopen this tour any time from the menu or the help button.',
    points: [],
    tint: '#ffb3a3',
    Illustration: ReadyIllustration,
  },
];

export function Tutorial() {
  const open = useStore((s) => s.dialog === 'tutorial');
  const theme = useTheme();
  const small = useMediaQuery(theme.breakpoints.down('md'));
  const [index, setIndex] = useState(0);

  const finish = (loadSample = false) => {
    setTutorialDone();
    closeDialog();
    if (loadSample) insertElements(TEMPLATES.find((t) => t.id === 'welcome')!.build());
  };

  const step = STEPS[index];
  const last = index === STEPS.length - 1;
  const next = () => (last ? finish(false) : setIndex((i) => i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  const t = theme.tokens;
  const dark = theme.palette.mode === 'dark';
  const vars = {
    '--ink': t.ink,
    '--ink-soft': t.inkSoft,
    '--accent': t.accent,
    '--accent-soft': t.accentSoft,
    '--accent-contrast': t.accentContrast,
    '--surface': t.surfaceSolid,
    '--border': t.borderStrong,
    '--key-shadow': dark ? '#0d0d0f' : '#d9d3c7',
    '--dot': alpha(t.ink, 0.18),
    '--laser': t.laser,
    '--c-red': dark ? '#b8432d' : '#ff9a82',
    '--c-blue': dark ? '#2f6db8' : '#8cc4ff',
    '--c-green': dark ? '#1f8c66' : '#86dfbd',
    '--c-yellow': dark ? '#b88412' : '#ffd36a',
    '--c-purple': dark ? '#6c4fd6' : '#b9a3ff',
    '--c-purple-ink': dark ? '#b9a3ff' : '#6c47e0',
    '--c-pink': dark ? '#b23a73' : '#ff9fcb',
  } as CSSProperties;

  return (
    <Dialog
      open={open}
      onClose={() => finish(false)}
      maxWidth={false}
      fullScreen={small}
      data-testid="tutorial"
      slotProps={{
        transition: { onExited: () => setIndex(0) },
        paper: {
          sx: {
            width: { md: 980 },
            maxWidth: 'calc(100vw - 32px)',
            overflow: 'hidden',
            ...(small && { maxWidth: '100vw', borderRadius: 0, overflowY: 'auto' }),
          },
        },
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') next();
        if (e.key === 'ArrowLeft') back();
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          height: { md: 600 },
          minHeight: small ? '100%' : undefined,
        }}
      >
        {/* Illustration */}
        <Box
          sx={{
            position: 'relative',
            flex: { md: '0 0 54%' },
            flexShrink: 0,
            height: { xs: 250, sm: 340, md: 'auto' },
            background: `radial-gradient(circle at 30% 20%, ${alpha(step.tint, dark ? 0.22 : 0.55)}, transparent 60%), radial-gradient(circle at 80% 90%, ${alpha(step.tint, dark ? 0.16 : 0.4)}, transparent 55%), ${dark ? '#19181b' : t.paper}`,
            backgroundSize: 'auto',
            transition: 'background .5s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 2, md: 4 },
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              backgroundImage: `radial-gradient(${alpha(t.ink, dark ? 0.12 : 0.13)} 1.2px, transparent 1.2px)`,
              backgroundSize: '20px 20px',
              maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 85%)',
            },
            ...vars,
          }}
        >
          <Box
            key={index}
            sx={{ position: 'relative', width: '100%', maxWidth: 470, aspectRatio: '440 / 300' }}
            data-testid={`tutorial-illustration-${index}`}
          >
            <step.Illustration />
          </Box>
          <Box
            sx={{
              position: 'absolute',
              top: 18,
              left: 20,
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Logo size={24} />
            <Typography
              sx={{ fontFamily: DISPLAY_FONT, fontWeight: 800, letterSpacing: '-0.03em' }}
            >
              Sketchboard
            </Typography>
          </Box>
        </Box>

        {/* Content */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            p: { xs: 3, md: 4.5 },
            pt: { xs: 2.5, md: 4 },
            minWidth: 0,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box
              sx={{ display: 'flex', gap: 0.5, flex: 1 }}
              role="progressbar"
              aria-valuenow={index + 1}
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
            >
              {STEPS.map((s, i) => (
                <Box
                  key={s.kicker}
                  component="button"
                  aria-label={`Go to step ${i + 1}: ${s.kicker}`}
                  onClick={() => setIndex(i)}
                  sx={{
                    flex: 1,
                    height: 5,
                    border: 'none',
                    p: 0,
                    cursor: 'pointer',
                    borderRadius: 3,
                    background: i <= index ? t.accent : t.surfaceSunken,
                    opacity: i < index ? 0.45 : 1,
                    transition: 'background-color .3s ease, opacity .3s ease',
                  }}
                />
              ))}
            </Box>
            <IconButton
              aria-label="Close tutorial"
              onClick={() => finish(false)}
              size="small"
              sx={{ mr: -1 }}
            >
              <X size={18} />
            </IconButton>
          </Box>

          <Box
            key={index}
            sx={{
              animation: 'tutSlide .45s cubic-bezier(.2,.8,.2,1)',
              flex: 1,
              '@keyframes tutSlide': {
                from: { opacity: 0, transform: 'translateX(14px)' },
                to: { opacity: 1, transform: 'none' },
              },
            }}
          >
            <Typography variant="subtitle2" sx={{ color: t.accent, mb: 1 }}>
              {String(index + 1).padStart(2, '0')} · {step.kicker}
            </Typography>
            <Typography
              variant="h4"
              sx={{ fontSize: { xs: '1.6rem', md: '2rem' }, lineHeight: 1.12, mb: 1.75 }}
            >
              {step.title}
            </Typography>
            <Typography sx={{ color: t.inkSoft, fontSize: '0.95rem', lineHeight: 1.6, mb: 2.5 }}>
              {step.body}
            </Typography>
            <Box sx={{ display: 'grid', gap: 1.1 }}>
              {step.points.map((p) => (
                <Box key={p.text} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '10px',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      color: t.accent,
                      background: t.accentSoft,
                    }}
                  >
                    <p.icon size={16} />
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                    {p.text}
                  </Typography>
                  {p.combo && <Kbd combo={p.combo} />}
                </Box>
              ))}
            </Box>
            {last && (
              <Box sx={{ display: 'grid', gap: 1.25, mt: 1 }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => finish(false)}
                  data-testid="tutorial-start"
                >
                  Start drawing
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => finish(true)}
                  data-testid="tutorial-sample"
                  disabled={getState().viewMode}
                >
                  Open the sample board
                </Button>
                <Typography
                  sx={{
                    fontFamily: HAND_FONT,
                    color: t.inkMuted,
                    textAlign: 'center',
                    mt: 1,
                    fontSize: '1.05rem',
                  }}
                >
                  tip: press <Kbd combo="shift+/" /> any time for shortcuts
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 3 }}>
            {!last && (
              <Button
                variant="text"
                onClick={() => finish(false)}
                data-testid="tutorial-skip"
                sx={{ color: t.inkSoft }}
              >
                Skip tour
              </Button>
            )}
            <Box sx={{ flex: 1 }} />
            {index > 0 && (
              <Button
                variant="outlined"
                onClick={back}
                startIcon={<ArrowLeft size={16} />}
                data-testid="tutorial-back"
              >
                Back
              </Button>
            )}
            {!last && (
              <Button
                variant="contained"
                onClick={next}
                endIcon={<ArrowRight size={16} />}
                data-testid="tutorial-next"
              >
                {index === 0 ? 'Show me around' : 'Next'}
              </Button>
            )}
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
}
