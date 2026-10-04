import { Box, ButtonBase, Divider, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Eye, Lock, LockOpen } from 'lucide-react';
import { TOOLS, type ToolDef } from '../actions/registry';
import { setTool, toggleToolLock, toggleViewMode } from '../actions/sceneActions';
import { useStore } from '../store/store';
import { Island } from './styled';
import { TooltipTitle } from './ui';

const ToolButton = ({ def, active }: { def: ToolDef; active: boolean }) => {
  const Icon = def.icon;
  return (
    <Tooltip title={<TooltipTitle label={def.label} combo={def.keys[0]} />}>
      <ButtonBase
        aria-label={def.label}
        aria-pressed={active}
        data-testid={`tool-${def.tool}`}
        onClick={() => setTool(def.tool)}
        sx={(t) => ({
          position: 'relative',
          width: 38,
          height: 38,
          borderRadius: '11px',
          color: active ? t.tokens.accentContrast : t.tokens.ink,
          background: active ? t.tokens.accent : 'transparent',
          boxShadow: active
            ? `0 1px 0 ${alpha('#fff', 0.25)} inset, 0 6px 14px -6px ${alpha(t.tokens.accent, 0.9)}`
            : 'none',
          transition: 'background-color .15s ease, color .15s ease, transform .12s ease',
          flexShrink: 0,
          '&:hover': { background: active ? t.tokens.accent : alpha(t.tokens.ink, 0.07) },
          '&:active': { transform: 'scale(0.92)' },
          '&:focus-visible': { outline: `2px solid ${t.tokens.accent}`, outlineOffset: 2 },
        })}
      >
        <Icon size={18} strokeWidth={active ? 2.2 : 1.9} />
        <Box
          component="span"
          sx={{
            position: 'absolute',
            right: 4,
            bottom: 2,
            fontSize: '0.56rem',
            fontWeight: 700,
            opacity: active ? 0.85 : 0.45,
            lineHeight: 1,
          }}
        >
          {def.hint}
        </Box>
      </ButtonBase>
    </Tooltip>
  );
};

export function Toolbar() {
  const tool = useStore((s) => s.tool);
  const toolLocked = useStore((s) => s.toolLocked);
  const viewMode = useStore((s) => s.viewMode);

  if (viewMode) {
    return (
      <Island
        sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 0.75, pl: 1.5 }}
        data-testid="view-mode-bar"
      >
        <Eye size={16} />
        <Typography variant="body2" sx={{ fontWeight: 650 }}>
          View only
        </Typography>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        {TOOLS.filter((t) => t.tool === 'hand' || t.tool === 'laser').map((d) => (
          <ToolButton key={d.tool} def={d} active={tool === d.tool} />
        ))}
        <ButtonBase
          onClick={toggleViewMode}
          sx={(t) => ({
            px: 1.5,
            height: 34,
            borderRadius: '10px',
            fontWeight: 650,
            fontSize: '0.8rem',
            color: t.tokens.accent,
            '&:hover': { background: t.tokens.accentSoft },
          })}
        >
          Edit board
        </ButtonBase>
      </Island>
    );
  }

  return (
    <Island
      role="toolbar"
      aria-label="Drawing tools"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.4,
        p: 0.6,
        maxWidth: 'calc(100vw - 24px)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      <Tooltip
        title={
          <TooltipTitle
            label={toolLocked ? 'Tool stays active (click to release)' : 'Keep tool active'}
            combo="q"
          />
        }
      >
        <ButtonBase
          aria-label="Keep tool active"
          aria-pressed={toolLocked}
          data-testid="tool-lock"
          onClick={toggleToolLock}
          sx={(t) => ({
            width: 32,
            height: 38,
            borderRadius: '10px',
            flexShrink: 0,
            color: toolLocked ? t.tokens.accent : t.tokens.inkMuted,
            background: toolLocked ? t.tokens.accentSoft : 'transparent',
            '&:hover': { background: toolLocked ? t.tokens.accentSoft : alpha(t.tokens.ink, 0.07) },
          })}
        >
          {toolLocked ? <Lock size={15} /> : <LockOpen size={15} />}
        </ButtonBase>
      </Tooltip>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.4, my: 0.75 }} />
      {TOOLS.slice(0, 2).map((d) => (
        <ToolButton key={d.tool} def={d} active={tool === d.tool} />
      ))}
      <Divider orientation="vertical" flexItem sx={{ mx: 0.4, my: 0.75 }} />
      {TOOLS.slice(2, 10).map((d) => (
        <ToolButton key={d.tool} def={d} active={tool === d.tool} />
      ))}
      <Divider orientation="vertical" flexItem sx={{ mx: 0.4, my: 0.75 }} />
      {TOOLS.slice(10).map((d) => (
        <ToolButton key={d.tool} def={d} active={tool === d.tool} />
      ))}
    </Island>
  );
}
