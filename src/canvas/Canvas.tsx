import { useEffect, useRef } from 'react';
import { themed } from '../scene/colors';
import {
  renderElements,
  renderGrid,
  setImageLoadListener,
  visibleSceneBounds,
} from '../scene/renderer';
import { pruneShapeCache } from '../scene/shapeCache';
import { getState, useStore, type AppState } from '../store/store';
import { getTokens } from '../theme/tokens';
import { controller, setInteractiveRenderer } from './instance';
import { renderInteractive } from './renderInteractive';
import { TextEditor } from './TextEditor';

const STATIC_KEYS: (keyof AppState)[] = [
  'elements',
  'files',
  'viewport',
  'theme',
  'background',
  'gridEnabled',
  'editing',
];
const INTERACTIVE_KEYS: (keyof AppState)[] = [
  'elements',
  'viewport',
  'theme',
  'selectedIds',
  'editingGroupId',
  'editing',
  'tool',
  'viewMode',
];

const sizeCanvas = (canvas: HTMLCanvasElement, w: number, h: number, dpr: number) => {
  const pw = Math.floor(w * dpr);
  const ph = Math.floor(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
};

const preventFocusChange = (e: MouseEvent) => e.preventDefault();

export function Canvas() {
  const staticRef = useRef<HTMLCanvasElement>(null);
  const interactiveRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const staticCanvas = staticRef.current!;
    const interactiveCanvas = interactiveRef.current!;
    let staticFrame = 0;
    let interactiveFrame = 0;
    let size = { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 };

    const drawStatic = () => {
      staticFrame = 0;
      const s = getState();
      sizeCanvas(staticCanvas, size.w, size.h, size.dpr);
      const ctx = staticCanvas.getContext('2d')!;
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      ctx.fillStyle = themed(s.background, s.theme);
      ctx.fillRect(0, 0, size.w, size.h);
      const { zoom, scrollX, scrollY } = s.viewport;
      ctx.scale(zoom, zoom);
      ctx.translate(scrollX, scrollY);
      if (s.gridEnabled) renderGrid(ctx, s.viewport, size.w, size.h, s.theme);
      renderElements(
        ctx,
        s.elements,
        {
          theme: s.theme,
          files: s.files,
          canvasBackground: s.background,
          hiddenLabelId: s.editing?.id ?? null,
          fadedIds: controller.getErasingIds(),
        },
        visibleSceneBounds(s.viewport, size.w, size.h),
      );
      pruneShapeCache(new Set(s.elements.map((e) => e.id)));
    };

    const drawInteractive = () => {
      interactiveFrame = 0;
      const s = getState();
      sizeCanvas(interactiveCanvas, size.w, size.h, size.dpr);
      const ctx = interactiveCanvas.getContext('2d')!;
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      ctx.clearRect(0, 0, size.w, size.h);
      const { zoom, scrollX, scrollY } = s.viewport;
      ctx.scale(zoom, zoom);
      ctx.translate(scrollX, scrollY);
      renderInteractive(
        ctx,
        controller.getInteractiveScene(),
        s.viewport,
        getTokens(s.theme),
        performance.now(),
      );
    };

    const scheduleStatic = () => {
      if (!staticFrame) staticFrame = requestAnimationFrame(drawStatic);
    };
    const scheduleInteractive = () => {
      if (!interactiveFrame) interactiveFrame = requestAnimationFrame(drawInteractive);
    };

    setInteractiveRenderer(scheduleInteractive);
    setImageLoadListener(scheduleStatic);
    controller.attach(interactiveCanvas);

    const unsubscribe = useStore.subscribe((state, prev) => {
      if (STATIC_KEYS.some((k) => state[k] !== prev[k])) scheduleStatic();
      if (INTERACTIVE_KEYS.some((k) => state[k] !== prev[k])) scheduleInteractive();
      if (state.tool !== prev.tool || state.viewMode !== prev.viewMode) {
        controller.clearHover();
        controller.updateCursor();
      }
    });

    const onResize = () => {
      size = { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 };
      scheduleStatic();
      scheduleInteractive();
    };
    window.addEventListener('resize', onResize);
    const fontsReady = () => scheduleStatic();
    document.fonts?.addEventListener?.('loadingdone', fontsReady);

    interactiveCanvas.addEventListener('pointerdown', controller.onPointerDown);
    interactiveCanvas.addEventListener('mousedown', preventFocusChange);
    window.addEventListener('pointermove', controller.onPointerMove);
    window.addEventListener('pointerup', controller.onPointerUp);
    window.addEventListener('pointercancel', controller.onPointerCancel);
    interactiveCanvas.addEventListener('pointerleave', controller.onPointerLeave);
    interactiveCanvas.addEventListener('dblclick', controller.onDoubleClick);
    interactiveCanvas.addEventListener('contextmenu', controller.onContextMenu);

    // Wheel anywhere pans/zooms the canvas (also over floating UI like the welcome screen),
    // except inside dialogs, menus and scrollable panels. Browser page-zoom is always blocked.
    const onWheel = (e: WheelEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.('.MuiModal-root, [data-wheel-scroll]')) {
        if (e.ctrlKey || e.metaKey) e.preventDefault();
        return;
      }
      controller.onWheel(e);
    };
    window.addEventListener('wheel', onWheel, { passive: false });

    scheduleStatic();
    scheduleInteractive();

    return () => {
      unsubscribe();
      cancelAnimationFrame(staticFrame);
      cancelAnimationFrame(interactiveFrame);
      setImageLoadListener(null);
      window.removeEventListener('resize', onResize);
      document.fonts?.removeEventListener?.('loadingdone', fontsReady);
      interactiveCanvas.removeEventListener('pointerdown', controller.onPointerDown);
      interactiveCanvas.removeEventListener('mousedown', preventFocusChange);
      window.removeEventListener('pointermove', controller.onPointerMove);
      window.removeEventListener('pointerup', controller.onPointerUp);
      window.removeEventListener('pointercancel', controller.onPointerCancel);
      interactiveCanvas.removeEventListener('pointerleave', controller.onPointerLeave);
      interactiveCanvas.removeEventListener('dblclick', controller.onDoubleClick);
      interactiveCanvas.removeEventListener('contextmenu', controller.onContextMenu);
      window.removeEventListener('wheel', onWheel);
    };
  }, []);

  return (
    <>
      <canvas
        ref={staticRef}
        aria-hidden
        style={{ position: 'fixed', inset: 0, display: 'block' }}
      />
      <canvas
        ref={interactiveRef}
        data-testid="board-canvas"
        aria-label="Drawing canvas"
        role="img"
        style={{ position: 'fixed', inset: 0, display: 'block', touchAction: 'none' }}
      />
      <TextEditor />
    </>
  );
}
