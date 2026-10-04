import {
  Box,
  ButtonBase,
  InputAdornment,
  Popover,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Pipette, Plus } from 'lucide-react';
import { useState } from 'react';
import { COLOR_FAMILIES, isValidHex, normalizeHex, TRANSPARENT } from '../scene/colors';
import { Swatch } from './styled';

interface Props {
  value: string | null;
  quick: string[];
  onChange: (color: string) => void;
  allowTransparent?: boolean;
  label: string;
  testId?: string;
}

/** Quick swatches plus a popover with the full palette, hex input and the native picker. */
export function ColorPicker({ value, quick, onChange, allowTransparent, label, testId }: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [hex, setHex] = useState('');
  const isCustom = value !== null && !quick.includes(value);

  const open = (el: HTMLElement) => {
    setHex(value && value !== TRANSPARENT ? value.replace('#', '') : '');
    setAnchor(el);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }} data-testid={testId}>
      {quick.map((c) => (
        <Tooltip key={c} title={c === TRANSPARENT ? 'Transparent' : c} placement="top">
          <Swatch
            color={c}
            selected={value === c}
            aria-label={`${label} ${c}`}
            onClick={() => onChange(c)}
          />
        </Tooltip>
      ))}
      <Box sx={(t) => ({ width: '1px', height: 20, background: t.tokens.border, mx: 0.25 })} />
      <Tooltip title="More colors" placement="top">
        <ButtonBase
          aria-label={`More ${label.toLowerCase()} colors`}
          onClick={(e) => open(e.currentTarget)}
          sx={(t) => ({
            width: 26,
            height: 26,
            borderRadius: '8px',
            background: isCustom && value !== TRANSPARENT ? value : t.tokens.surfaceSunken,
            boxShadow: isCustom
              ? `0 0 0 2px ${t.tokens.surfaceSolid}, 0 0 0 4px ${t.tokens.accent}`
              : `inset 0 0 0 1px ${t.tokens.border}`,
            color: t.tokens.inkSoft,
          })}
        >
          {!isCustom && <Plus size={14} />}
        </ButtonBase>
      </Tooltip>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { p: 1.75, ml: 1.5, width: 252 } } }}
      >
        <Typography variant="subtitle2" sx={(t) => ({ color: t.tokens.inkMuted, mb: 1 })}>
          {label}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 0.6 }}>
          {Array.from({ length: 5 }).flatMap((_, shade) =>
            COLOR_FAMILIES.map((f) => (
              <Tooltip key={`${f.name}${shade}`} title={`${f.name} ${shade + 1}`} placement="top">
                <Swatch
                  swatchSize={24}
                  color={f.shades[shade]}
                  selected={value === f.shades[shade]}
                  aria-label={`${f.name} ${shade + 1}`}
                  onClick={() => onChange(f.shades[shade])}
                />
              </Tooltip>
            )),
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 1.5, alignItems: 'center' }}>
          {allowTransparent && (
            <Tooltip title="Transparent">
              <Swatch
                color={TRANSPARENT}
                selected={value === TRANSPARENT}
                aria-label="Transparent"
                onClick={() => onChange(TRANSPARENT)}
              />
            </Tooltip>
          )}
          <TextField
            size="small"
            value={hex}
            placeholder="hex"
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6);
              setHex(v);
              if ((v.length === 6 || v.length === 3) && isValidHex(v)) onChange(normalizeHex(v)!);
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start" sx={{ mr: 0.25 }}>
                    #
                  </InputAdornment>
                ),
                sx: { fontFamily: '"JetBrains Mono Variable", monospace', fontSize: '0.8rem' },
              },
            }}
            sx={{ flex: 1 }}
          />
          <Tooltip title="Pick any color">
            <ButtonBase
              component="label"
              sx={(t) => ({
                width: 34,
                height: 34,
                borderRadius: '10px',
                background: t.tokens.surfaceSunken,
                color: t.tokens.inkSoft,
                position: 'relative',
              })}
            >
              <Pipette size={15} />
              <input
                type="color"
                value={value && value !== TRANSPARENT ? value : '#000000'}
                onChange={(e) => onChange(e.target.value)}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
              />
            </ButtonBase>
          </Tooltip>
        </Box>
      </Popover>
    </Box>
  );
}
