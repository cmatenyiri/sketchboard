import {
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { Check, Menu as MenuIcon, Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { ACTION_MAP, formatCombo, runAction } from '../actions/registry';
import { setCanvasBackground, setThemePreference } from '../actions/sceneActions';
import { CANVAS_BACKGROUNDS, themed } from '../scene/colors';
import { getState, useStore } from '../store/store';
import { Swatch } from './styled';

const ITEMS: (string | '-')[] = [
  'newBoard',
  'boards',
  'open',
  'save',
  'export',
  'share',
  '-',
  'templates',
  'commandPalette',
  '-',
  'toggleGrid',
  'toggleSnapping',
  'toggleMinimap',
  'toggleZen',
  'toggleViewMode',
  '-',
  'shortcuts',
  'tutorial',
  'clear',
];

export function MainMenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // Only subscribe to the whole store while the menu is open.
  const live = useStore((s) => (anchor ? s : null));
  const state = live ?? getState();
  const close = () => setAnchor(null);

  return (
    <>
      <Tooltip title="Menu">
        <IconButton
          aria-label="Main menu"
          data-testid="main-menu-button"
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ width: 40, height: 40 }}
        >
          <MenuIcon size={19} />
        </IconButton>
      </Tooltip>
      <Menu
        open={!!anchor}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { mt: 1, width: 280, maxHeight: 'calc(100dvh - 90px)' } } }}
      >
        {ITEMS.map((id, i) => {
          if (id === '-') return <Divider key={`d${i}`} sx={{ my: '4px !important' }} />;
          const a = ACTION_MAP.get(id)!;
          const Icon = a.icon;
          const disabled = a.enabled ? !a.enabled(state) : false;
          const checked = a.checked?.(state);
          return (
            <MenuItem
              key={id}
              disabled={disabled}
              data-testid={`menu-${id}`}
              onClick={() => {
                close();
                runAction(id);
              }}
            >
              <ListItemIcon>{Icon && <Icon size={16} />}</ListItemIcon>
              <ListItemText
                slotProps={{ primary: { sx: { fontSize: '0.84rem', fontWeight: 550 } } }}
              >
                {a.label}
              </ListItemText>
              {checked !== undefined && (
                <Box
                  sx={(t) => ({
                    color: t.tokens.accent,
                    display: 'flex',
                    opacity: checked ? 1 : 0,
                  })}
                >
                  <Check size={15} strokeWidth={2.6} />
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
        })}
        <Divider sx={{ my: '4px !important' }} />
        <Box sx={{ px: 1.25, py: 1 }}>
          <Typography
            variant="subtitle2"
            sx={(t) => ({ color: t.tokens.inkMuted, fontSize: '0.66rem', mb: 0.75 })}
          >
            Theme
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={state.themePreference}
            onChange={(_, v) => v && setThemePreference(v)}
          >
            <ToggleButton value="light" aria-label="Light theme" data-testid="theme-light">
              <Sun size={15} />
              <Box component="span" sx={{ ml: 0.75 }}>
                Light
              </Box>
            </ToggleButton>
            <ToggleButton value="dark" aria-label="Dark theme" data-testid="theme-dark">
              <Moon size={15} />
              <Box component="span" sx={{ ml: 0.75 }}>
                Dark
              </Box>
            </ToggleButton>
            <ToggleButton value="system" aria-label="System theme">
              <Monitor size={15} />
              <Box component="span" sx={{ ml: 0.75 }}>
                Auto
              </Box>
            </ToggleButton>
          </ToggleButtonGroup>
          <Typography
            variant="subtitle2"
            sx={(t) => ({ color: t.tokens.inkMuted, fontSize: '0.66rem', mt: 1.5, mb: 0.75 })}
          >
            Canvas background
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.9 }}>
            {CANVAS_BACKGROUNDS.map((c) => (
              <Swatch
                key={c}
                color={themed(c, state.theme)}
                selected={state.background === c}
                aria-label={`Canvas background ${c}`}
                onClick={() => setCanvasBackground(c)}
              />
            ))}
          </Box>
        </Box>
      </Menu>
    </>
  );
}
