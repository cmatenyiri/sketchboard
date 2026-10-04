import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Copy, Ellipsis, FolderOpen, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  createBoard,
  deleteBoardById,
  duplicateBoard,
  listBoards,
  onBoardsChanged,
  openFromFile,
  switchBoard,
  type BoardMeta,
} from '../actions/boardActions';
import { closeDialog, useStore } from '../store/store';

const timeAgo = (ts: number) => {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`;
  return new Date(ts).toLocaleDateString();
};

export function BoardsDialog() {
  const open = useStore((s) => s.dialog === 'boards');
  return (
    <Dialog open={open} onClose={closeDialog} maxWidth="md" fullWidth data-testid="boards-dialog">
      {open && <BoardsBody />}
    </Dialog>
  );
}

function BoardsBody() {
  const currentId = useStore((s) => s.boardId);
  const [boards, setBoards] = useState<BoardMeta[]>([]);
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<{ el: HTMLElement; id: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => void listBoards().then(setBoards);
    refresh();
    return onBoardsChanged(refresh);
  }, []);

  const filtered = boards.filter((b) => b.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <Box sx={{ p: 3, pb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 180 }}>
          <Typography variant="h5">My boards</Typography>
          <Typography variant="body2" sx={(t) => ({ color: t.tokens.inkSoft })}>
            Saved automatically in this browser.
          </Typography>
        </Box>
        <TextField
          size="small"
          placeholder="Search boards"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={15} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ width: 200 }}
        />
        <IconButton aria-label="Close" onClick={closeDialog}>
          <X size={18} />
        </IconButton>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
          gap: 2,
          maxHeight: '58vh',
          overflowY: 'auto',
          p: 0.5,
          m: -0.5,
        }}
      >
        <ButtonBase
          data-testid="new-board"
          onClick={() => {
            void createBoard().then(closeDialog);
          }}
          sx={(t) => ({
            borderRadius: '16px',
            minHeight: 168,
            border: `2px dashed ${t.tokens.borderStrong}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            color: t.tokens.inkSoft,
            transition: 'all .15s ease',
            '&:hover': {
              borderColor: t.tokens.accent,
              color: t.tokens.accent,
              background: t.tokens.accentSoft,
            },
          })}
        >
          <Plus size={26} />
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            New board
          </Typography>
        </ButtonBase>
        {filtered.map((b) => {
          const current = b.id === currentId;
          return (
            <Box
              key={b.id}
              sx={(t) => ({
                position: 'relative',
                borderRadius: '16px',
                overflow: 'hidden',
                background: t.tokens.surfaceSunken,
                boxShadow: current
                  ? `0 0 0 2px ${t.tokens.accent}`
                  : `0 0 0 1px ${t.tokens.border}`,
                transition: 'transform .15s ease, box-shadow .15s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: current ? `0 0 0 2px ${t.tokens.accent}` : t.tokens.shadow,
                },
              })}
            >
              <ButtonBase
                onClick={() => {
                  void switchBoard(b.id).then(closeDialog);
                }}
                sx={{ display: 'block', width: '100%', textAlign: 'left' }}
              >
                <Box
                  sx={(t) => ({
                    height: 112,
                    background: b.thumbnail
                      ? `#fbf8f2 url(${b.thumbnail}) center/cover`
                      : t.tokens.surfaceSolid,
                    display: 'grid',
                    placeItems: 'center',
                    borderBottom: `1px solid ${t.tokens.border}`,
                  })}
                >
                  {!b.thumbnail && (
                    <Typography
                      variant="caption"
                      sx={{ opacity: 0.5, fontFamily: '"Kalam", cursive', fontSize: '1rem' }}
                    >
                      empty board
                    </Typography>
                  )}
                </Box>
                <Box sx={{ p: 1.25, pr: 4.5 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                    {b.name}
                  </Typography>
                  <Typography variant="caption" sx={(t) => ({ color: t.tokens.inkMuted })}>
                    {current ? 'Open now' : timeAgo(b.updatedAt)} · {b.elementCount} item
                    {b.elementCount === 1 ? '' : 's'}
                  </Typography>
                </Box>
              </ButtonBase>
              <IconButton
                size="small"
                aria-label={`Options for ${b.name}`}
                onClick={(e) => setMenu({ el: e.currentTarget, id: b.id })}
                sx={{ position: 'absolute', right: 6, bottom: 12 }}
              >
                <Ellipsis size={16} />
              </IconButton>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
        <Tooltip title="Open a .sketchboard file">
          <Button
            variant="text"
            startIcon={<FolderOpen size={16} />}
            onClick={() => void openFromFile().then(closeDialog)}
          >
            Open from file
          </Button>
        </Tooltip>
        <Typography
          variant="caption"
          sx={(t) => ({ color: t.tokens.inkMuted, alignSelf: 'center' })}
        >
          {boards.length} board{boards.length === 1 ? '' : 's'}
        </Typography>
      </Box>

      <Menu open={!!menu} anchorEl={menu?.el} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            const id = menu!.id;
            setMenu(null);
            void duplicateBoard(id).then(closeDialog);
          }}
        >
          <Copy size={15} /> Duplicate
        </MenuItem>
        <MenuItem
          sx={(t) => ({ color: t.palette.error.main })}
          onClick={() => {
            setConfirmDelete(menu!.id);
            setMenu(null);
          }}
        >
          <Trash2 size={15} /> Delete
        </MenuItem>
      </Menu>

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs">
        <Box sx={{ p: 3 }}>
          <Typography variant="h6">Delete this board?</Typography>
          <Typography variant="body2" sx={(t) => ({ color: t.tokens.inkSoft, mt: 1 })}>
            “{boards.find((b) => b.id === confirmDelete)?.name}” will be removed from this browser.
            This can’t be undone.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
            <Button variant="text" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => {
                const id = confirmDelete!;
                setConfirmDelete(null);
                void deleteBoardById(id);
              }}
            >
              Delete
            </Button>
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
}
