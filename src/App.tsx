import {
  Box,
  CssBaseline,
  GlobalStyles,
  ThemeProvider,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Palette, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { handleDroppedFile, initApp } from './actions/boardActions';
import { Canvas } from './canvas/Canvas';
import { BoardsDialog } from './components/BoardsDialog';
import { BottomLeft, BottomRight } from './components/BottomBar';
import { CommandPalette } from './components/CommandPalette';
import { ContextMenu } from './components/ContextMenu';
import { ExportDialog } from './components/ExportDialog';
import { Minimap } from './components/Minimap';
import { ImportSharedDialog, Toasts } from './components/MiscDialogs';
import { PropertiesPanel } from './components/PropertiesPanel';
import { ShareDialog } from './components/ShareDialog';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { Island } from './components/styled';
import { IconAction } from './components/ui';
import { TemplatesDialog } from './components/TemplatesDialog';
import { Toolbar } from './components/Toolbar';
import { TopLeft, TopRight } from './components/TopBar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { useKeyboard } from './hooks/useKeyboard';
import { screenToScene } from './scene/viewport';
import { isTutorialDone } from './scene/persistence';
import { getState, openDialog, resolveTheme, setState, useStore } from './store/store';
import { buildTheme } from './theme/theme';
import { Tutorial } from './tutorial/Tutorial';

function useSystemTheme() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (getState().themePreference === 'system') setState({ theme: resolveTheme('system') });
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
}

function DropOverlay() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e) || getState().viewMode) return;
      e.preventDefault();
      depth++;
      setActive(true);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setActive(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setActive(false);
      if (getState().viewMode) return;
      const files = [...(e.dataTransfer?.files ?? [])];
      const at = screenToScene([e.clientX, e.clientY], getState().viewport);
      files.forEach((f, i) => void handleDroppedFile(f, [at[0] + i * 24, at[1] + i * 24]));
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);
  if (!active) return null;
  return (
    <Box
      sx={(t) => ({
        position: 'fixed',
        inset: 12,
        zIndex: 1400,
        borderRadius: '24px',
        border: `2.5px dashed ${t.tokens.accent}`,
        background: t.tokens.accentSoft,
        display: 'grid',
        placeItems: 'center',
        pointerEvents: 'none',
        backdropFilter: 'blur(2px)',
      })}
    >
      <Box sx={{ textAlign: 'center' }}>
        <Upload size={40} />
        <Typography variant="h5" sx={{ mt: 1 }}>
          Drop images or a board file
        </Typography>
      </Box>
    </Box>
  );
}

const DRAWING_TOOLS = new Set([
  'rectangle',
  'diamond',
  'ellipse',
  'arrow',
  'line',
  'freedraw',
  'text',
]);

/** Desktop: the style panel is always visible. Phones: it collapses behind a toggle button. */
function StylePanelSlot() {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const [open, setOpen] = useState(false);
  const relevant = useStore((s) => s.selectedIds.length > 0 || DRAWING_TOOLS.has(s.tool));
  if (!phone) return <PropertiesPanel />;
  if (!relevant) return null;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
      <Island sx={{ p: 0.5 }}>
        <IconAction
          icon={Palette}
          label={open ? 'Hide style options' : 'Style options'}
          active={open}
          onClick={() => setOpen((o) => !o)}
          testId="style-toggle"
          placement="right"
        />
      </Island>
      {open && (
        <Box sx={{ '& > *': { maxHeight: '48dvh !important' } }}>
          <PropertiesPanel />
        </Box>
      )}
    </Box>
  );
}

function Layout() {
  const zen = useStore((s) => s.zenMode);
  const ready = useStore((s) => s.ready);
  const showPanel = useStore((s) => !s.viewMode);
  if (!ready) return null;

  const slot = (sx: object) => ({
    position: 'fixed',
    zIndex: 10,
    pointerEvents: 'none',
    '& > *': { pointerEvents: 'auto' },
    ...sx,
  });

  return (
    <>
      <WelcomeScreen />
      {!zen && (
        <>
          <Box sx={slot({ top: 12, left: 12 })}>
            <TopLeft />
          </Box>
          <Box
            sx={slot({
              top: { xs: 'auto', md: 12 },
              bottom: { xs: 76, md: 'auto' },
              left: '50%',
              transform: 'translateX(-50%)',
            })}
          >
            <Toolbar />
          </Box>
          <Box sx={slot({ top: 12, right: 12 })}>
            <TopRight />
          </Box>
          {showPanel && (
            <Box sx={slot({ top: { xs: 72, md: 76 }, left: 12 })}>
              <StylePanelSlot />
            </Box>
          )}
          <Box sx={slot({ bottom: 12, left: 12 })}>
            <BottomLeft />
          </Box>
          <Box
            sx={slot({
              bottom: 12,
              right: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 1,
            })}
          >
            <Minimap />
            <BottomRight />
          </Box>
        </>
      )}
      {zen && (
        <Box sx={slot({ bottom: 12, right: 12 })}>
          <Box
            component="button"
            onClick={() => setState({ zenMode: false })}
            sx={(t) => ({
              border: 'none',
              cursor: 'pointer',
              font: 'inherit',
              fontWeight: 650,
              fontSize: '0.8rem',
              px: 1.75,
              py: 1,
              borderRadius: '12px',
              color: t.tokens.ink,
              background: t.tokens.surface,
              boxShadow: t.tokens.shadow,
            })}
          >
            Exit zen mode
          </Box>
        </Box>
      )}
      <ContextMenu />
      <CommandPalette />
      <ShortcutsDialog />
      <ExportDialog />
      <ShareDialog />
      <BoardsDialog />
      <TemplatesDialog />
      <ImportSharedDialog />
      <Tutorial />
      <Toasts />
      <DropOverlay />
    </>
  );
}

export default function App() {
  const mode = useStore((s) => s.theme);
  const theme = useMemo(() => buildTheme(mode), [mode]);
  useKeyboard();
  useSystemTheme();

  useEffect(() => {
    void initApp().then(() => {
      if (!isTutorialDone() && !getState().dialog) openDialog('tutorial');
    });
  }, []);

  useEffect(() => {
    document.documentElement.style.colorScheme = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.tokens.paper);
  }, [mode, theme]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
        }}
      />
      <Canvas />
      <Layout />
    </ThemeProvider>
  );
}
