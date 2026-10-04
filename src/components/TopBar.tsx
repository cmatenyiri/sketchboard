import { Box, Button, IconButton, InputBase, Tooltip } from '@mui/material';
import { Layers, Moon, Share2, Sun } from 'lucide-react';
import { useState } from 'react';
import { renameCurrentBoard } from '../actions/boardActions';
import { toggleTheme } from '../actions/sceneActions';
import { openDialog, useStore } from '../store/store';
import { MainMenu } from './MainMenu';
import { Island } from './styled';
import { Logo, TooltipTitle } from './ui';

function BoardName() {
  const name = useStore((s) => s.boardName);
  // Local draft only exists while editing; otherwise the store value is shown.
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? name;

  return (
    <InputBase
      value={value}
      inputProps={{ 'aria-label': 'Board name', 'data-testid': 'board-name', maxLength: 120 }}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => {
        setDraft(name);
        e.target.select();
      }}
      onBlur={() => {
        if (draft !== null) renameCurrentBoard(draft);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur();
      }}
      sx={(t) => ({
        fontWeight: 700,
        fontSize: '0.9rem',
        color: t.tokens.ink,
        width: `${Math.min(26, Math.max(8, value.length + 1))}ch`,
        maxWidth: { xs: 120, sm: 260 },
        '& input': {
          px: 1,
          py: 0.6,
          borderRadius: '8px',
          transition: 'background-color .15s ease',
          textOverflow: 'ellipsis',
        },
        '& input:hover': { background: t.tokens.surfaceSunken },
        '& input:focus': { background: t.tokens.surfaceSunken },
      })}
    />
  );
}

export function TopLeft() {
  return (
    <Island sx={{ display: 'flex', alignItems: 'center', gap: 0.25, p: 0.5, pr: 1 }}>
      <MainMenu />
      <Box sx={{ display: { xs: 'none', sm: 'block' }, ml: 0.25 }}>
        <Logo size={22} />
      </Box>
      <BoardName />
      <Tooltip title={<TooltipTitle label="My boards" combo="alt+b" />}>
        <IconButton
          aria-label="My boards"
          data-testid="boards-button"
          onClick={() => openDialog('boards')}
          sx={{ width: 34, height: 34 }}
        >
          <Layers size={17} />
        </IconButton>
      </Tooltip>
    </Island>
  );
}

export function TopRight() {
  const theme = useStore((s) => s.theme);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Island sx={{ p: 0.5, display: { xs: 'none', sm: 'block' } }}>
        <Tooltip
          title={
            <TooltipTitle
              label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              combo="alt+shift+d"
            />
          }
        >
          <IconButton
            aria-label="Toggle dark mode"
            data-testid="theme-toggle"
            onClick={toggleTheme}
            sx={{ width: 40, height: 40 }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </IconButton>
        </Tooltip>
      </Island>
      <Button
        variant="contained"
        data-testid="share-button"
        startIcon={<Share2 size={16} />}
        onClick={() => openDialog('share')}
        sx={{ height: 48, borderRadius: '14px', px: 2.25 }}
      >
        Share
      </Button>
    </Box>
  );
}
