import { Box, ButtonBase, Divider, Tooltip } from '@mui/material';
import { CircleHelp, Map as MapIcon, Minus, Plus, Redo2, Undo2 } from 'lucide-react';
import { resetZoom, toggleMinimap, zoomBy, zoomToFit } from '../actions/sceneActions';
import { openDialog, redo, undo, useStore } from '../store/store';
import { Island } from './styled';
import { IconAction, TooltipTitle } from './ui';

export function BottomLeft() {
  const zoom = useStore((s) => s.viewport.zoom);
  const canUndo = useStore((s) => s.past.length > 0 && !s.viewMode);
  const canRedo = useStore((s) => s.future.length > 0 && !s.viewMode);
  const viewMode = useStore((s) => s.viewMode);

  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Island sx={{ display: 'flex', alignItems: 'center', p: 0.5 }}>
        <IconAction
          icon={Minus}
          label="Zoom out"
          combo="mod+-"
          onClick={() => zoomBy(-1)}
          placement="top"
          testId="zoom-out"
        />
        <Tooltip
          placement="top"
          title={<TooltipTitle label="Reset zoom · double-click to fit" combo="mod+0" />}
        >
          <ButtonBase
            data-testid="zoom-level"
            onClick={resetZoom}
            onDoubleClick={() => zoomToFit(false)}
            sx={(t) => ({
              minWidth: 54,
              height: 32,
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.78rem',
              fontVariantNumeric: 'tabular-nums',
              color: t.tokens.ink,
              '&:hover': { background: t.tokens.surfaceSunken },
            })}
          >
            {Math.round(zoom * 100)}%
          </ButtonBase>
        </Tooltip>
        <IconAction
          icon={Plus}
          label="Zoom in"
          combo="mod+="
          onClick={() => zoomBy(1)}
          placement="top"
          testId="zoom-in"
        />
      </Island>
      {!viewMode && (
        <Island sx={{ display: 'flex', alignItems: 'center', p: 0.5 }}>
          <IconAction
            icon={Undo2}
            label="Undo"
            combo="mod+z"
            disabled={!canUndo}
            onClick={undo}
            placement="top"
            testId="undo"
          />
          <Divider orientation="vertical" flexItem sx={{ my: 1 }} />
          <IconAction
            icon={Redo2}
            label="Redo"
            combo="mod+shift+z"
            disabled={!canRedo}
            onClick={redo}
            placement="top"
            testId="redo"
          />
        </Island>
      )}
    </Box>
  );
}

export function BottomRight() {
  const minimapOpen = useStore((s) => s.minimapOpen);
  return (
    <Island sx={{ display: 'flex', alignItems: 'center', p: 0.5 }}>
      <IconAction
        icon={MapIcon}
        label="Minimap"
        combo="alt+m"
        active={minimapOpen}
        onClick={toggleMinimap}
        placement="top"
        testId="minimap-toggle"
      />
      <IconAction
        icon={CircleHelp}
        label="Help & shortcuts"
        combo="shift+/"
        onClick={() => openDialog('shortcuts')}
        placement="top"
        testId="help-button"
      />
    </Island>
  );
}
