import { Box, Dialog, InputBase, Typography } from '@mui/material';
import { Search } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { ACTIONS, runAction, type Action } from '../actions/registry';
import { closeDialog, getState, useStore } from '../store/store';
import { Kbd } from './ui';

/** Simple subsequence fuzzy score: higher is better, -1 means no match. */
const score = (query: string, text: string) => {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 0;
  const idx = t.indexOf(q);
  if (idx >= 0) return 100 - idx;
  let ti = 0;
  let s = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found < 0) return -1;
    s += found === ti ? 3 : 1;
    ti = found + 1;
  }
  return s;
};

export function CommandPalette() {
  const open = useStore((s) => s.dialog === 'commands');
  return (
    <Dialog
      open={open}
      onClose={closeDialog}
      maxWidth={false}
      slotProps={{
        paper: {
          sx: { width: 560, maxWidth: 'calc(100vw - 24px)', alignSelf: 'flex-start', mt: '12vh' },
        },
      }}
    >
      {open && <PaletteBody />}
    </Dialog>
  );
}

function PaletteBody() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const state = getState();

  const results = useMemo(() => {
    const available = ACTIONS.filter((a) => !a.hidden && (!a.enabled || a.enabled(state)));
    if (!query.trim()) return available;
    return available
      .map((a) => ({
        a,
        s: Math.max(score(query, a.label), score(query, `${a.group} ${a.keywords ?? ''}`) - 20),
      }))
      .filter((r) => r.s >= 0)
      .sort((x, y) => y.s - x.s)
      .map((r) => r.a);
  }, [query, state]);

  const run = (a: Action) => {
    closeDialog();
    // Let the dialog close before running (some actions open other dialogs).
    setTimeout(() => runAction(a.id), 0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const a = results[active];
      if (a) run(a);
    }
    requestAnimationFrame(() => {
      listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
    });
  };

  return (
    <Box onKeyDown={onKeyDown} data-testid="command-palette">
      <Box
        sx={(t) => ({
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: 2.25,
          py: 1.75,
          borderBottom: `1px solid ${t.tokens.border}`,
        })}
      >
        <Search size={18} />
        <InputBase
          autoFocus
          fullWidth
          placeholder="Search commands…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          inputProps={{ 'aria-label': 'Search commands' }}
          sx={{ fontSize: '1rem', fontWeight: 550 }}
        />
        <Kbd combo="escape" />
      </Box>
      <Box ref={listRef} sx={{ maxHeight: 400, overflowY: 'auto', p: 1 }} role="listbox">
        {results.length === 0 && (
          <Typography variant="body2" sx={{ p: 3, textAlign: 'center', opacity: 0.6 }}>
            No matching commands
          </Typography>
        )}
        {results.map((a, i) => {
          const Icon = a.icon;
          const header = !query && (i === 0 || results[i - 1].group !== a.group) ? a.group : null;
          const isActive = i === active;
          return (
            <Box key={a.id}>
              {header && (
                <Typography
                  variant="subtitle2"
                  sx={(t) => ({
                    px: 1.25,
                    pt: i ? 1.5 : 0.5,
                    pb: 0.5,
                    color: t.tokens.inkMuted,
                    fontSize: '0.64rem',
                  })}
                >
                  {header}
                </Typography>
              )}
              <Box
                role="option"
                aria-selected={isActive}
                data-active={isActive}
                onMouseMove={() => setActive(i)}
                onClick={() => run(a)}
                sx={(t) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 1.25,
                  py: 1,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  background: isActive ? t.tokens.accentSoft : 'transparent',
                  color: isActive ? t.tokens.accent : t.tokens.ink,
                })}
              >
                <Box sx={{ display: 'flex', opacity: 0.85 }}>{Icon && <Icon size={16} />}</Box>
                <Typography variant="body2" sx={{ flex: 1, fontWeight: 600, color: 'inherit' }}>
                  {a.label}
                </Typography>
                {a.checked && (
                  <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.7 }}>
                    {a.checked(getState()) ? 'On' : 'Off'}
                  </Typography>
                )}
                {a.keys?.[0] && <Kbd combo={a.keys[0]} />}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
