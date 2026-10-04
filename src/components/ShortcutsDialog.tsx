import { Box, Dialog, DialogContent, IconButton, Typography } from '@mui/material';
import { BookOpen, X } from 'lucide-react';
import { ACTIONS, type ActionGroup } from '../actions/registry';
import { closeDialog, openDialog, useStore } from '../store/store';
import { Kbd } from './ui';

const GESTURES: { label: string; keys: string[] }[] = [
  { label: 'Pan the canvas', keys: ['space', 'drag'] },
  { label: 'Pan with the scroll wheel', keys: ['wheel'] },
  { label: 'Zoom at cursor', keys: ['mod', 'wheel'] },
  { label: 'Constrain shape / angle', keys: ['shift', 'drag'] },
  { label: 'Draw / resize from center', keys: ['alt', 'drag'] },
  { label: 'Duplicate while dragging', keys: ['alt', 'drag'] },
  { label: 'Ignore snapping & binding', keys: ['mod', 'drag'] },
  { label: 'Nudge selection (×10 with Shift)', keys: ['←↑→↓'] },
  { label: 'Edit text, label or enter group', keys: ['double-click'] },
  { label: 'Multi-point line: click, click…', keys: ['enter'] },
];

const GROUPS: ActionGroup[] = ['Tools', 'Edit', 'Arrange', 'View', 'Board', 'Help'];

const Pill = ({ k }: { k: string }) =>
  ['drag', 'wheel', 'double-click', '←↑→↓', 'space'].includes(k) ? (
    <Box
      component="span"
      sx={(t) => ({
        fontSize: '0.68rem',
        fontWeight: 700,
        px: 0.75,
        height: 18,
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 1,
        color: t.tokens.inkSoft,
        background: t.tokens.surfaceSunken,
        boxShadow: `inset 0 -1px 0 ${t.tokens.borderStrong}, 0 0 0 1px ${t.tokens.border}`,
      })}
    >
      {k === 'space'
        ? 'Space'
        : k === 'wheel'
          ? 'Scroll'
          : k === 'drag'
            ? 'Drag'
            : k === 'double-click'
              ? 'Double-click'
              : k}
    </Box>
  ) : (
    <Kbd combo={k} />
  );

export function ShortcutsDialog() {
  const open = useStore((s) => s.dialog === 'shortcuts');
  return (
    <Dialog
      open={open}
      onClose={closeDialog}
      maxWidth="lg"
      fullWidth
      data-testid="shortcuts-dialog"
    >
      <Box sx={{ display: 'flex', alignItems: 'center', px: 3, pt: 2.5, pb: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5">Keyboard shortcuts & gestures</Typography>
          <Typography variant="body2" sx={(t) => ({ color: t.tokens.inkSoft, mt: 0.25 })}>
            Tip: press <Kbd combo="mod+k" /> anywhere to search every command.
          </Typography>
        </Box>
        <IconButton
          aria-label="Open tutorial"
          onClick={() => openDialog('tutorial')}
          sx={{ mr: 0.5 }}
          title="Open the tutorial"
        >
          <BookOpen size={18} />
        </IconButton>
        <IconButton aria-label="Close" onClick={closeDialog}>
          <X size={18} />
        </IconButton>
      </Box>
      <DialogContent sx={{ pt: 1 }}>
        <Box sx={{ columnWidth: 300, columnGap: 4 }}>
          {[
            ...GROUPS.map((g) => ({
              g,
              items: ACTIONS.filter((a) => a.group === g && a.keys?.length),
            })),
            { g: 'Gestures' as const, items: [] },
          ].map(({ g, items }) => (
            <Box key={g} sx={{ breakInside: 'avoid', mb: 3 }}>
              <Typography variant="subtitle2" sx={(t) => ({ color: t.tokens.accent, mb: 1 })}>
                {g}
              </Typography>
              {g === 'Gestures'
                ? GESTURES.map((x) => (
                    <Row key={x.label} label={x.label}>
                      {x.keys.map((k, i) => (
                        <Pill key={i} k={k} />
                      ))}
                    </Row>
                  ))
                : items.map((a) => (
                    <Row key={a.id} label={a.label}>
                      {a.keys!.slice(0, 2).map((k, i) => (
                        <Box
                          key={k}
                          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                        >
                          {i > 0 && (
                            <Typography variant="caption" sx={{ opacity: 0.5 }}>
                              or
                            </Typography>
                          )}
                          <Kbd combo={k} />
                        </Box>
                      ))}
                    </Row>
                  ))}
            </Box>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <Box
    sx={(t) => ({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 2,
      py: 0.7,
      borderBottom: `1px dashed ${t.tokens.border}`,
    })}
  >
    <Typography variant="body2" sx={{ fontWeight: 550 }}>
      {label}
    </Typography>
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0 }}>{children}</Box>
  </Box>
);
