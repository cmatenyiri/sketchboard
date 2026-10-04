import {
  Box,
  Button,
  Dialog,
  FormControlLabel,
  IconButton,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Clipboard, FileCode2, FileJson, ImageDown, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { saveToFile } from '../actions/boardActions';
import {
  downloadBlob,
  exportToBlob,
  exportToCanvas,
  exportToSvg,
  safeFilename,
} from '../scene/export';
import { closeDialog, getState, toast, useStore } from '../store/store';
import { SectionLabel } from './ui';

export function ExportDialog() {
  const open = useStore((s) => s.dialog === 'export');
  return (
    <Dialog open={open} onClose={closeDialog} maxWidth="md" fullWidth data-testid="export-dialog">
      {open && <ExportBody />}
    </Dialog>
  );
}

function ExportBody() {
  const s = getState();
  const hasSelection = s.selectedIds.length > 0;
  const [background, setBackground] = useState(true);
  const [dark, setDark] = useState(s.theme === 'dark');
  const [onlySelected, setOnlySelected] = useState(hasSelection);
  const [scale, setScale] = useState(2);
  const [preview, setPreview] = useState<string | null>(null);

  const elements = useMemo(() => {
    if (!onlySelected) return s.elements;
    const ids = new Set(s.selectedIds);
    return s.elements.filter((e) => ids.has(e.id));
  }, [onlySelected, s.elements, s.selectedIds]);

  const opts = useMemo(
    () => ({
      background,
      canvasBackground: s.background,
      theme: dark ? ('dark' as const) : ('light' as const),
      scale,
      padding: 24,
    }),
    [background, dark, scale, s.background],
  );

  useEffect(() => {
    let cancelled = false;
    if (!elements.length) return;
    void exportToCanvas(elements, s.files, { ...opts, scale: 1 }).then((c) => {
      if (!cancelled) setPreview(c.toDataURL());
    });
    return () => {
      cancelled = true;
    };
  }, [elements, opts, s.files]);

  const name = safeFilename(s.boardName);
  const empty = elements.length === 0;

  const png = async () => {
    downloadBlob(await exportToBlob(elements, s.files, opts), `${name}.png`);
    toast('PNG downloaded', 'success');
  };
  const svg = async () => {
    const markup = await exportToSvg(elements, s.files, opts);
    downloadBlob(new Blob([markup], { type: 'image/svg+xml' }), `${name}.svg`);
    toast('SVG downloaded', 'success');
  };
  const copy = async () => {
    try {
      const blob = exportToBlob(elements, s.files, opts);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast('Image copied to clipboard', 'success');
    } catch {
      toast('Your browser blocked clipboard access', 'error');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: 420 }}>
      <Box
        sx={(t) => ({
          flex: 1,
          minHeight: 260,
          m: 1.5,
          mr: { md: 0 },
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
          background: `repeating-conic-gradient(${t.tokens.surfaceSunken} 0% 25%, ${t.tokens.surfaceSolid} 0% 50%) 50% / 18px 18px`,
          boxShadow: `inset 0 0 0 1px ${t.tokens.border}`,
        })}
      >
        {empty ? (
          <Typography variant="body2" sx={{ opacity: 0.6 }}>
            Nothing to export yet — draw something first.
          </Typography>
        ) : (
          preview && (
            <Box
              component="img"
              src={preview}
              alt="Export preview"
              sx={(t) => ({
                maxWidth: '100%',
                maxHeight: 360,
                objectFit: 'contain',
                borderRadius: '6px',
                boxShadow: t.tokens.shadow,
              })}
            />
          )
        )}
      </Box>
      <Box sx={{ width: { md: 300 }, p: 3, pt: 2.5, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" sx={{ flex: 1 }}>
            Export image
          </Typography>
          <IconButton aria-label="Close" onClick={closeDialog} sx={{ mr: -1 }}>
            <X size={18} />
          </IconButton>
        </Box>
        <FormControlLabel
          control={
            <Switch checked={background} onChange={(e) => setBackground(e.target.checked)} />
          }
          label="Background"
          sx={{
            ml: -0.75,
            mb: 0.5,
            '& .MuiFormControlLabel-label': { fontWeight: 600, fontSize: '0.86rem' },
          }}
        />
        <FormControlLabel
          control={<Switch checked={dark} onChange={(e) => setDark(e.target.checked)} />}
          label="Dark mode"
          sx={{
            ml: -0.75,
            mb: 0.5,
            '& .MuiFormControlLabel-label': { fontWeight: 600, fontSize: '0.86rem' },
          }}
        />
        <FormControlLabel
          disabled={!hasSelection}
          control={
            <Switch checked={onlySelected} onChange={(e) => setOnlySelected(e.target.checked)} />
          }
          label="Only selected"
          sx={{
            ml: -0.75,
            mb: 2,
            '& .MuiFormControlLabel-label': { fontWeight: 600, fontSize: '0.86rem' },
          }}
        />
        <SectionLabel>PNG scale</SectionLabel>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={scale}
          onChange={(_, v) => v && setScale(v)}
          sx={{ mb: 3 }}
        >
          {[1, 2, 3, 4].map((x) => (
            <ToggleButton key={x} value={x} sx={{ px: 1.5 }}>
              {x}×
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Box sx={{ mt: 'auto', display: 'grid', gap: 1 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<ImageDown size={17} />}
            disabled={empty}
            onClick={png}
            data-testid="export-png"
          >
            Download PNG
          </Button>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<FileCode2 size={16} />}
              disabled={empty}
              onClick={svg}
              data-testid="export-svg"
            >
              SVG
            </Button>
            <Button
              variant="outlined"
              startIcon={<Clipboard size={16} />}
              disabled={empty}
              onClick={copy}
            >
              Copy
            </Button>
          </Box>
          <Button
            variant="text"
            startIcon={<FileJson size={16} />}
            onClick={saveToFile}
            sx={{ mt: 0.5 }}
          >
            Save editable board file
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
