import {
  Alert,
  Box,
  Button,
  Dialog,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { Check, Copy, Link2, Lock, Send, X, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { saveToFile } from '../actions/boardActions';
import { createShareLink } from '../scene/share';
import { closeDialog, getState, toast, useStore } from '../store/store';

export function ShareDialog() {
  const open = useStore((s) => s.dialog === 'share');
  return (
    <Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth data-testid="share-dialog">
      {open && <ShareBody />}
    </Dialog>
  );
}

const SOFT_LIMIT = 8000;
const HARD_LIMIT = 60000;

function ShareBody() {
  const s = getState();
  const [viewOnly, setViewOnly] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = useMemo(
    () => createShareLink(s.elements, s.background, s.boardName, viewOnly),
    [s.elements, s.background, s.boardName, viewOnly],
  );
  const length = link.url.length;
  const level = length < SOFT_LIMIT ? 'good' : length < HARD_LIMIT ? 'long' : 'huge';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      toast('Link copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast('Could not access the clipboard — copy the link manually', 'warning');
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: s.boardName, url: link.url });
    } catch {
      // user cancelled
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2.5 }}>
        <Box
          sx={(t) => ({
            width: 46,
            height: 46,
            borderRadius: '14px',
            display: 'grid',
            placeItems: 'center',
            color: t.tokens.accent,
            background: t.tokens.accentSoft,
            flexShrink: 0,
          })}
        >
          <Link2 size={22} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5">Share this board</Typography>
          <Typography variant="body2" sx={(t) => ({ color: t.tokens.inkSoft, mt: 0.5 })}>
            The whole board is compressed <b>into the link itself</b> — no server, no account.
            Anyone who opens it gets their own copy.
          </Typography>
        </Box>
        <IconButton aria-label="Close" onClick={closeDialog} sx={{ mt: -0.5, mr: -1 }}>
          <X size={18} />
        </IconButton>
      </Box>

      {s.elements.length === 0 && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 3 }}>
          The board is empty — the link will open a blank board.
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          value={link.url}
          slotProps={{
            htmlInput: { readOnly: true, 'data-testid': 'share-link', 'aria-label': 'Share link' },
            input: {
              sx: { fontFamily: '"JetBrains Mono Variable", monospace', fontSize: '0.76rem' },
            },
          }}
          onFocus={(e) => e.target.select()}
        />
        <Button
          variant="contained"
          onClick={copy}
          data-testid="copy-share-link"
          startIcon={copied ? <Check size={16} /> : <Copy size={16} />}
          sx={{ flexShrink: 0, minWidth: 112 }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </Box>

      <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <LinearProgress
          variant="determinate"
          value={Math.min(100, (length / HARD_LIMIT) * 100)}
          color={level === 'good' ? 'success' : level === 'long' ? 'warning' : 'error'}
          sx={{ flex: 1 }}
        />
        <Typography
          variant="caption"
          sx={(t) => ({ color: t.tokens.inkSoft, fontWeight: 650, whiteSpace: 'nowrap' })}
        >
          <Zap size={11} style={{ verticalAlign: -1 }} /> {(length / 1024).toFixed(1)} KB link
        </Typography>
      </Box>
      <Typography
        variant="caption"
        sx={(t) => ({ color: t.tokens.inkMuted, display: 'block', mt: 0.5 })}
      >
        {level === 'good'
          ? 'Compact enough for any chat app or email.'
          : level === 'long'
            ? 'Long link — works in browsers, but some chat apps may cut it off.'
            : 'Very large board — consider sharing the board file instead.'}
      </Typography>

      {link.skippedImages > 0 && (
        <Alert severity="warning" sx={{ mt: 2, borderRadius: 3 }}>
          {link.skippedImages} image{link.skippedImages > 1 ? 's are' : ' is'} too large for a link
          and won’t be included. Use “Save to file” to share everything.
        </Alert>
      )}

      <Box
        sx={(t) => ({
          mt: 2.5,
          p: 1.5,
          pl: 2,
          borderRadius: '14px',
          background: t.tokens.surfaceSunken,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        })}
      >
        <Lock size={17} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            View-only link
          </Typography>
          <Typography variant="caption" sx={(t) => ({ color: t.tokens.inkSoft })}>
            Opens in presentation mode — pan, zoom & laser pointer only.
          </Typography>
        </Box>
        <FormControlLabel
          sx={{ mr: 0 }}
          label=""
          control={
            <Switch
              checked={viewOnly}
              onChange={(e) => setViewOnly(e.target.checked)}
              slotProps={{ input: { 'aria-label': 'View-only link' } }}
            />
          }
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mt: 2.5, justifyContent: 'flex-end' }}>
        <Button variant="text" onClick={saveToFile}>
          Save to file instead
        </Button>
        {'share' in navigator && (
          <Button variant="outlined" startIcon={<Send size={15} />} onClick={nativeShare}>
            Share…
          </Button>
        )}
      </Box>
    </Box>
  );
}
