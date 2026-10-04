import { Box, ButtonBase, Dialog, IconButton, Typography } from '@mui/material';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { insertElements } from '../actions/sceneActions';
import { exportToCanvas } from '../scene/export';
import { TEMPLATES } from '../scene/templates';
import { closeDialog, getState, useStore } from '../store/store';

export function TemplatesDialog() {
  const open = useStore((s) => s.dialog === 'templates');
  return (
    <Dialog
      open={open}
      onClose={closeDialog}
      maxWidth="md"
      fullWidth
      data-testid="templates-dialog"
    >
      {open && <TemplatesBody />}
    </Dialog>
  );
}

function TemplatesBody() {
  const theme = useStore((s) => s.theme);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const out: Record<string, string> = {};
      for (const t of TEMPLATES) {
        const canvas = await exportToCanvas(
          t.build(),
          {},
          {
            background: false,
            canvasBackground: getState().background,
            theme,
            scale: 0.6,
            padding: 16,
          },
        );
        out[t.id] = canvas.toDataURL();
      }
      if (!cancelled) setPreviews(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [theme]);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5">Templates</Typography>
          <Typography variant="body2" sx={(t) => ({ color: t.tokens.inkSoft })}>
            Drop a ready-made layout into the middle of your view.
          </Typography>
        </Box>
        <IconButton aria-label="Close" onClick={closeDialog}>
          <X size={18} />
        </IconButton>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
          gap: 2,
        }}
      >
        {TEMPLATES.map((t) => (
          <ButtonBase
            key={t.id}
            data-testid={`template-${t.id}`}
            onClick={() => {
              insertElements(t.build());
              closeDialog();
            }}
            sx={(th) => ({
              display: 'block',
              textAlign: 'left',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: `0 0 0 1px ${th.tokens.border}`,
              transition: 'transform .15s ease, box-shadow .15s ease',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: th.tokens.shadow },
            })}
          >
            <Box
              sx={(th) => ({
                height: 140,
                background: th.tokens.surfaceSunken,
                display: 'grid',
                placeItems: 'center',
                p: 1.5,
              })}
            >
              {previews[t.id] && (
                <Box
                  component="img"
                  src={previews[t.id]}
                  alt=""
                  sx={{ maxWidth: '100%', maxHeight: 116, objectFit: 'contain' }}
                />
              )}
            </Box>
            <Box sx={{ p: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {t.name}
              </Typography>
              <Typography variant="caption" sx={(th) => ({ color: th.tokens.inkSoft })}>
                {t.description}
              </Typography>
            </Box>
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}
