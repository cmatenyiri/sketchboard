import {
  Box,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import { Check } from 'lucide-react';
import { ACTION_MAP, formatCombo, runAction } from '../actions/registry';
import { getSelectedElements, getState, setState, useStore } from '../store/store';

const ELEMENT_ITEMS = [
  ['cut', 'copy', 'paste', 'duplicate', 'delete'],
  ['copyStyles', 'pasteStyles', 'editText'],
  ['group', 'ungroup', 'lock'],
  ['bringToFront', 'bringForward', 'sendBackward', 'sendToBack'],
  ['flipH', 'flipV', 'zoomToSelection'],
];

const CANVAS_ITEMS = [
  ['paste', 'selectAll', 'unlockAll'],
  ['toggleGrid', 'toggleSnapping', 'zoomToFit'],
  ['export', 'commandPalette'],
];

export function ContextMenu() {
  const menu = useStore((s) => s.contextMenu);
  const live = useStore((s) => (s.contextMenu ? s : null));
  const state = live ?? getState();
  const close = () => setState({ contextMenu: null });
  if (!menu) return null;

  const selected = getSelectedElements(state);
  const allLocked = selected.length > 0 && selected.every((e) => e.locked);
  const groups = (menu.onElement ? ELEMENT_ITEMS : CANVAS_ITEMS).map((g) =>
    g.filter((id) => {
      const a = ACTION_MAP.get(id);
      if (!a) return false;
      // For locked items only show what still makes sense.
      if (allLocked && !['lock', 'copy', 'zoomToSelection'].includes(id)) return false;
      if (id === 'unlockAll' || id === 'ungroup' || id === 'editText')
        return a.enabled ? a.enabled(state) : true;
      return true;
    }),
  );

  return (
    <Menu
      open
      onClose={close}
      anchorReference="anchorPosition"
      anchorPosition={{ top: menu.y, left: menu.x }}
      data-testid="context-menu"
      slotProps={{
        paper: { sx: { width: 250 } },
        root: {
          onContextMenu: (e: React.MouseEvent) => {
            e.preventDefault();
            close();
          },
        },
      }}
    >
      {groups
        .filter((g) => g.length)
        .flatMap((g, gi) => [
          gi > 0 ? <Divider key={`d${gi}`} sx={{ my: '4px !important' }} /> : null,
          ...g.map((id) => {
            const a = ACTION_MAP.get(id)!;
            const Icon = a.icon;
            const disabled = a.enabled ? !a.enabled(state) : false;
            const label = id === 'lock' && allLocked ? 'Unlock' : a.label;
            const checked = a.checked?.(state);
            return (
              <MenuItem
                key={id}
                dense
                disabled={disabled}
                onClick={() => {
                  close();
                  runAction(id);
                }}
              >
                <ListItemIcon>{Icon && <Icon size={15} />}</ListItemIcon>
                <ListItemText
                  slotProps={{ primary: { sx: { fontSize: '0.82rem', fontWeight: 550 } } }}
                >
                  {label}
                </ListItemText>
                {checked && (
                  <Box sx={(t) => ({ color: t.tokens.accent, display: 'flex' })}>
                    <Check size={14} strokeWidth={2.6} />
                  </Box>
                )}
                {a.keys?.[0] && (
                  <Typography
                    variant="caption"
                    sx={(t) => ({ color: t.tokens.inkMuted, fontWeight: 600, ml: 1 })}
                  >
                    {formatCombo(a.keys[0])}
                  </Typography>
                )}
              </MenuItem>
            );
          }),
        ])}
    </Menu>
  );
}
