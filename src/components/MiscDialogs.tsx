import { Alert, Box, Button, Dialog, Slide, Typography } from '@mui/material';
import { CircleAlert, CircleCheck, Info, Link2, TriangleAlert } from 'lucide-react';
import { acceptSharedBoard, dismissSharedBoard, getPendingShared } from '../actions/boardActions';
import { useStore } from '../store/store';

export function ImportSharedDialog() {
  const open = useStore((s) => s.dialog === 'importShared');
  const shared = open ? getPendingShared() : null;
  return (
    <Dialog
      open={open}
      onClose={dismissSharedBoard}
      maxWidth="xs"
      fullWidth
      data-testid="import-shared-dialog"
    >
      <Box sx={{ p: 3 }}>
        <Box
          sx={(t) => ({
            width: 48,
            height: 48,
            borderRadius: '14px',
            display: 'grid',
            placeItems: 'center',
            color: t.tokens.accent,
            background: t.tokens.accentSoft,
            mb: 2,
          })}
        >
          <Link2 size={22} />
        </Box>
        {shared ? (
          <>
            <Typography variant="h5">Open shared board?</Typography>
            <Typography variant="body2" sx={(t) => ({ color: t.tokens.inkSoft, mt: 1 })}>
              Someone shared <b>“{shared.name}”</b> with you ({shared.elements.length} item
              {shared.elements.length === 1 ? '' : 's'}). It will open as a new board — your
              existing boards stay untouched.
            </Typography>
            {shared.viewOnly && (
              <Alert severity="info" sx={{ mt: 2, borderRadius: 3 }}>
                This link opens in view-only mode. You can switch to editing at any time.
              </Alert>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
              <Button variant="text" onClick={dismissSharedBoard}>
                Not now
              </Button>
              <Button
                variant="contained"
                onClick={() => void acceptSharedBoard()}
                data-testid="open-shared"
              >
                Open board
              </Button>
            </Box>
          </>
        ) : (
          <>
            <Typography variant="h5">This link looks broken</Typography>
            <Typography variant="body2" sx={(t) => ({ color: t.tokens.inkSoft, mt: 1 })}>
              The board data in the link could not be read. It may have been cut off when it was
              copied — ask for the link again.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button variant="contained" onClick={dismissSharedBoard}>
                OK
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Dialog>
  );
}

const ICONS = {
  success: CircleCheck,
  info: Info,
  warning: TriangleAlert,
  error: CircleAlert,
};

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: { xs: 140, sm: 84 },
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        zIndex: 1500,
        pointerEvents: 'none',
      }}
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.severity];
        return (
          <Slide key={t.id} direction="up" in mountOnEnter>
            <Box
              role="status"
              data-testid="toast"
              sx={(th) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 1.1,
                borderRadius: '12px',
                background: th.palette.mode === 'dark' ? '#f3efe8' : '#1d1b18',
                color: th.palette.mode === 'dark' ? '#1d1b18' : '#f3efe8',
                boxShadow: th.tokens.shadowLg,
                fontWeight: 650,
                fontSize: '0.84rem',
                '& svg': {
                  color:
                    t.severity === 'success'
                      ? '#3fc79a'
                      : t.severity === 'error'
                        ? '#ff7a5c'
                        : t.severity === 'warning'
                          ? '#f7b52c'
                          : '#5aa8f6',
                },
              })}
            >
              <Icon size={16} />
              {t.message}
            </Box>
          </Slide>
        );
      })}
    </Box>
  );
}
