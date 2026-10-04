import { Box } from '@mui/material';
import { useEffect, useRef } from 'react';
import { themed } from '../scene/colors';
import { getCommonBounds } from '../scene/elements';
import { renderElements, visibleSceneBounds } from '../scene/renderer';
import { getState, setState, useStore } from '../store/store';
import { getTokens } from '../theme/tokens';
import { Island } from './styled';

const W = 220;
const H = 150;

/** Overview of the whole board; click or drag to move the viewport. */
export function Minimap() {
  const open = useStore((s) => s.minimapOpen && !s.zenMode);
  const ref = useRef<HTMLCanvasElement>(null);
  const mapping = useRef<{ scale: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const draw = () => {
      frame = 0;
      const canvas = ref.current;
      if (!canvas) return;
      const s = getState();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = themed(s.background, s.theme);
      ctx.fillRect(0, 0, W, H);
      const view = visibleSceneBounds(s.viewport, window.innerWidth, window.innerHeight);
      const content = getCommonBounds(s.elements);
      const b = content
        ? {
            minX: Math.min(content.minX, view.minX),
            minY: Math.min(content.minY, view.minY),
            maxX: Math.max(content.maxX, view.maxX),
            maxY: Math.max(content.maxY, view.maxY),
          }
        : view;
      const pad = 40;
      const scale = Math.min(W / (b.maxX - b.minX + pad * 2), H / (b.maxY - b.minY + pad * 2));
      const ox = (W - (b.maxX - b.minX) * scale) / 2 - b.minX * scale;
      const oy = (H - (b.maxY - b.minY) * scale) / 2 - b.minY * scale;
      mapping.current = { scale, ox, oy };
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(scale, scale);
      renderElements(ctx, s.elements, {
        theme: s.theme,
        files: s.files,
        canvasBackground: s.background,
      });
      ctx.restore();
      const t = getTokens(s.theme);
      ctx.fillStyle = t.selectionFill;
      ctx.strokeStyle = t.selection;
      ctx.lineWidth = 1.5;
      const vx = ox + view.minX * scale;
      const vy = oy + view.minY * scale;
      const vw = (view.maxX - view.minX) * scale;
      const vh = (view.maxY - view.minY) * scale;
      ctx.beginPath();
      ctx.roundRect(vx, vy, vw, vh, 3);
      ctx.fill();
      ctx.stroke();
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    schedule();
    const unsub = useStore.subscribe((s, p) => {
      if (
        s.elements !== p.elements ||
        s.viewport !== p.viewport ||
        s.theme !== p.theme ||
        s.background !== p.background
      )
        schedule();
    });
    window.addEventListener('resize', schedule);
    return () => {
      unsub();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
    };
  }, [open]);

  if (!open) return null;

  const moveTo = (e: React.PointerEvent) => {
    const m = mapping.current;
    if (!m) return;
    const rect = ref.current!.getBoundingClientRect();
    const sx = (e.clientX - rect.left - m.ox) / m.scale;
    const sy = (e.clientY - rect.top - m.oy) / m.scale;
    const { viewport } = getState();
    setState({
      viewport: {
        ...viewport,
        scrollX: window.innerWidth / 2 / viewport.zoom - sx,
        scrollY: window.innerHeight / 2 / viewport.zoom - sy,
      },
    });
  };

  return (
    <Island sx={{ p: 0.75, borderRadius: '14px' }} data-testid="minimap">
      <Box
        component="canvas"
        ref={ref}
        sx={{
          width: W,
          height: H,
          display: 'block',
          borderRadius: '9px',
          cursor: 'pointer',
          touchAction: 'none',
        }}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture(e.pointerId);
          moveTo(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons) moveTo(e);
        }}
      />
    </Island>
  );
}
