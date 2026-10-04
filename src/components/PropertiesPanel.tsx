import { Box, Slider, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  BringToFront,
  CopyPlus,
  Group,
  Lock,
  SendToBack,
  Trash2,
  Ungroup,
} from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { ACTION_MAP, runAction } from '../actions/registry';
import { updateStyle } from '../actions/sceneActions';
import { QUICK_BACKGROUNDS, QUICK_STROKES, TRANSPARENT } from '../scene/colors';
import { FONT_LABELS, FONT_SIZES, FONT_STACKS } from '../scene/text';
import { useStore } from '../store/store';
import type {
  Arrowhead,
  ElementStyle,
  ElementType,
  FontFamily,
  SceneElement,
  ToolType,
} from '../types';
import { ColorPicker } from './ColorPicker';
import {
  ArrowheadIcon,
  EdgeIcon,
  FillIcon,
  LineTypeIcon,
  SloppinessIcon,
  StrokeStyleIcon,
  StrokeWidthIcon,
} from './StyleIcons';
import { Island } from './styled';
import { IconAction, SectionLabel } from './ui';

const TOOL_TO_TYPE: Partial<Record<ToolType, ElementType>> = {
  rectangle: 'rectangle',
  diamond: 'diamond',
  ellipse: 'ellipse',
  arrow: 'arrow',
  line: 'line',
  freedraw: 'freedraw',
  text: 'text',
};

const SHAPES: ElementType[] = ['rectangle', 'diamond', 'ellipse'];

/** Value shared by all targets, or null when mixed. */
const common = <K extends keyof ElementStyle>(
  targets: (SceneElement | ElementStyle)[],
  key: K,
): ElementStyle[K] | null => {
  if (!targets.length) return null;
  const first = targets[0][key];
  return targets.every((t) => t[key] === first) ? first : null;
};

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <Box sx={{ mb: 1.75 }}>
    <SectionLabel>{label}</SectionLabel>
    {children}
  </Box>
);

function Toggle<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T | null;
  options: { value: T; label: string; icon: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      aria-label={label}
      onChange={(_, v) => v !== null && onChange(v)}
    >
      {options.map((o) => (
        <ToggleButton key={String(o.value)} value={o.value} aria-label={o.label}>
          <Tooltip title={o.label} placement="top">
            <Box
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 20 }}
            >
              {o.icon}
            </Box>
          </Tooltip>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

const ARROWHEADS: Arrowhead[] = ['none', 'arrow', 'triangle', 'dot', 'bar', 'diamond'];

export function PropertiesPanel() {
  const tool = useStore((s) => s.tool);
  const selectedIds = useStore((s) => s.selectedIds);
  const elements = useStore((s) => s.elements);
  const currentStyle = useStore((s) => s.currentStyle);
  const editing = useStore((s) => s.editing);

  const selected = useMemo(() => {
    const ids = new Set(selectedIds);
    return elements.filter((e) => ids.has(e.id));
  }, [elements, selectedIds]);

  const toolType = TOOL_TO_TYPE[tool];
  const hasSelection = selected.length > 0;
  if (!hasSelection && !toolType) return null;

  const types = new Set<ElementType>(hasSelection ? selected.map((e) => e.type) : [toolType!]);
  const targets: (SceneElement | ElementStyle)[] = hasSelection ? selected : [currentStyle];
  const has = (...t: ElementType[]) => t.some((x) => types.has(x));
  const onlyImages = [...types].every((t) => t === 'image');
  const hasShapes = has(...SHAPES);
  const hasLinear = has('arrow', 'line');
  const hasText =
    has('text') ||
    (hasSelection && selected.some((e) => !!e.text)) ||
    (editing && selected.some((e) => e.id === editing.id));
  const background = common(targets, 'backgroundColor');
  const locked = hasSelection && selected.every((e) => e.locked);

  return (
    <Island
      data-testid="properties-panel"
      data-wheel-scroll
      sx={{
        width: 236,
        p: 1.75,
        pb: 0.5,
        maxHeight: 'calc(100dvh - 170px)',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {locked ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Lock size={16} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Locked — unlock to edit
          </Typography>
        </Box>
      ) : (
        <>
          {!onlyImages && (
            <Row label="Stroke">
              <ColorPicker
                label="Stroke"
                testId="stroke-colors"
                value={common(targets, 'strokeColor')}
                quick={QUICK_STROKES}
                onChange={(c) => updateStyle({ strokeColor: c })}
              />
            </Row>
          )}

          {hasShapes && (
            <Row label="Background">
              <ColorPicker
                label="Background"
                testId="background-colors"
                allowTransparent
                value={background}
                quick={QUICK_BACKGROUNDS}
                onChange={(c) => updateStyle({ backgroundColor: c })}
              />
            </Row>
          )}

          {hasShapes && background !== TRANSPARENT && (
            <Row label="Fill">
              <Toggle
                label="Fill style"
                value={common(targets, 'fillStyle')}
                onChange={(v) => updateStyle({ fillStyle: v })}
                options={[
                  { value: 'hachure', label: 'Hachure', icon: <FillIcon kind="hachure" /> },
                  {
                    value: 'cross-hatch',
                    label: 'Cross-hatch',
                    icon: <FillIcon kind="cross-hatch" />,
                  },
                  { value: 'zigzag', label: 'Zigzag', icon: <FillIcon kind="zigzag" /> },
                  { value: 'solid', label: 'Solid', icon: <FillIcon kind="solid" /> },
                ]}
              />
            </Row>
          )}

          {has(...SHAPES, 'arrow', 'line', 'freedraw') && (
            <Row label="Stroke width">
              <Toggle
                label="Stroke width"
                value={common(targets, 'strokeWidth')}
                onChange={(v) => updateStyle({ strokeWidth: v })}
                options={[
                  { value: 1, label: 'Thin', icon: <StrokeWidthIcon width={1} /> },
                  { value: 2, label: 'Bold', icon: <StrokeWidthIcon width={2} /> },
                  { value: 4, label: 'Extra bold', icon: <StrokeWidthIcon width={4} /> },
                ]}
              />
            </Row>
          )}

          {(hasShapes || hasLinear) && (
            <>
              <Row label="Stroke style">
                <Toggle
                  label="Stroke style"
                  value={common(targets, 'strokeStyle')}
                  onChange={(v) => updateStyle({ strokeStyle: v })}
                  options={[
                    { value: 'solid', label: 'Solid', icon: <StrokeStyleIcon kind="solid" /> },
                    { value: 'dashed', label: 'Dashed', icon: <StrokeStyleIcon kind="dashed" /> },
                    { value: 'dotted', label: 'Dotted', icon: <StrokeStyleIcon kind="dotted" /> },
                  ]}
                />
              </Row>
              <Row label="Sloppiness">
                <Toggle
                  label="Sloppiness"
                  value={common(targets, 'roughness')}
                  onChange={(v) => updateStyle({ roughness: v })}
                  options={[
                    { value: 0, label: 'Architect', icon: <SloppinessIcon level={0} /> },
                    { value: 1, label: 'Artist', icon: <SloppinessIcon level={1} /> },
                    { value: 2, label: 'Cartoonist', icon: <SloppinessIcon level={2} /> },
                  ]}
                />
              </Row>
            </>
          )}

          {has('rectangle', 'diamond', 'image') && !hasLinear && (
            <Row label="Edges">
              <Toggle
                label="Edges"
                value={common(targets, 'roundness')}
                onChange={(v) => updateStyle({ roundness: v })}
                options={[
                  { value: 'sharp', label: 'Sharp', icon: <EdgeIcon round={false} /> },
                  { value: 'round', label: 'Round', icon: <EdgeIcon round /> },
                ]}
              />
            </Row>
          )}

          {hasLinear && !hasShapes && (
            <Row label="Line type">
              <Toggle
                label="Line type"
                value={common(targets, 'roundness')}
                onChange={(v) => updateStyle({ roundness: v })}
                options={[
                  {
                    value: 'sharp',
                    label: 'Straight segments',
                    icon: <LineTypeIcon curved={false} />,
                  },
                  { value: 'round', label: 'Curved', icon: <LineTypeIcon curved /> },
                ]}
              />
            </Row>
          )}

          {has('arrow') && (
            <Row label="Arrowheads">
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Toggle
                  label="Start arrowhead"
                  value={common(targets, 'startArrowhead')}
                  onChange={(v) => updateStyle({ startArrowhead: v })}
                  options={ARROWHEADS.map((a) => ({
                    value: a,
                    label: `Start: ${a}`,
                    icon: <ArrowheadIcon kind={a} flip />,
                  }))}
                />
                <Toggle
                  label="End arrowhead"
                  value={common(targets, 'endArrowhead')}
                  onChange={(v) => updateStyle({ endArrowhead: v })}
                  options={ARROWHEADS.map((a) => ({
                    value: a,
                    label: `End: ${a}`,
                    icon: <ArrowheadIcon kind={a} />,
                  }))}
                />
              </Box>
            </Row>
          )}

          {(hasText || (!hasSelection && tool === 'text')) && (
            <>
              <Row label="Font">
                <Toggle
                  label="Font family"
                  value={common(targets, 'fontFamily')}
                  onChange={(v) => updateStyle({ fontFamily: v })}
                  options={(['hand', 'sans', 'mono'] as FontFamily[]).map((f) => ({
                    value: f,
                    label: FONT_LABELS[f],
                    icon: (
                      <Box
                        component="span"
                        sx={{
                          fontFamily: FONT_STACKS[f],
                          fontSize: f === 'hand' ? 16 : 13,
                          lineHeight: 1,
                        }}
                      >
                        Aa
                      </Box>
                    ),
                  }))}
                />
              </Row>
              <Row label="Size">
                <Toggle
                  label="Font size"
                  value={common(targets, 'fontSize')}
                  onChange={(v) => updateStyle({ fontSize: v })}
                  options={FONT_SIZES.map((f) => ({
                    value: f.value,
                    label: `${f.label} (${f.value}px)`,
                    icon: <span>{f.label}</span>,
                  }))}
                />
              </Row>
              {!hasLinear && (
                <Row label="Align">
                  <Toggle
                    label="Text align"
                    value={common(targets, 'textAlign')}
                    onChange={(v) => updateStyle({ textAlign: v })}
                    options={[
                      { value: 'left', label: 'Left', icon: <AlignLeft size={16} /> },
                      { value: 'center', label: 'Center', icon: <AlignCenter size={16} /> },
                      { value: 'right', label: 'Right', icon: <AlignRight size={16} /> },
                    ]}
                  />
                </Row>
              )}
            </>
          )}

          <Row label="Opacity">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 0.5 }}>
              <Slider
                size="small"
                aria-label="Opacity"
                min={10}
                max={100}
                step={5}
                value={common(targets, 'opacity') ?? 100}
                onChange={(_, v) => updateStyle({ opacity: v as number })}
              />
              <Typography
                variant="caption"
                sx={(t) => ({
                  minWidth: 30,
                  textAlign: 'right',
                  color: t.tokens.inkSoft,
                  fontWeight: 650,
                })}
              >
                {common(targets, 'opacity') ?? '—'}
              </Typography>
            </Box>
          </Row>
        </>
      )}

      {hasSelection && (
        <>
          {!locked && (
            <Row label="Layers">
              <Box sx={{ display: 'flex', gap: 0.25 }}>
                <IconAction
                  icon={SendToBack}
                  label="Send to back"
                  combo={ACTION_MAP.get('sendToBack')?.keys?.[0]}
                  onClick={() => runAction('sendToBack')}
                  placement="top"
                />
                <IconAction
                  icon={ArrowDownToLine}
                  label="Send backward"
                  combo={ACTION_MAP.get('sendBackward')?.keys?.[0]}
                  onClick={() => runAction('sendBackward')}
                  placement="top"
                />
                <IconAction
                  icon={ArrowUpToLine}
                  label="Bring forward"
                  combo={ACTION_MAP.get('bringForward')?.keys?.[0]}
                  onClick={() => runAction('bringForward')}
                  placement="top"
                />
                <IconAction
                  icon={BringToFront}
                  label="Bring to front"
                  combo={ACTION_MAP.get('bringToFront')?.keys?.[0]}
                  onClick={() => runAction('bringToFront')}
                  placement="top"
                />
              </Box>
            </Row>
          )}

          {selected.length > 1 && !locked && (
            <Row label="Align">
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
                {[
                  'alignLeft',
                  'alignCenterX',
                  'alignRight',
                  'alignTop',
                  'alignCenterY',
                  'alignBottom',
                  'distributeX',
                  'distributeY',
                ].map((id) => {
                  const a = ACTION_MAP.get(id)!;
                  return (
                    <IconAction
                      key={id}
                      icon={a.icon!}
                      label={a.label}
                      onClick={() => runAction(id)}
                      disabled={id.startsWith('distribute') && selected.length < 3}
                      placement="top"
                    />
                  );
                })}
              </Box>
            </Row>
          )}

          <Row label="Actions">
            <Box sx={{ display: 'flex', gap: 0.25 }}>
              {!locked && (
                <IconAction
                  icon={CopyPlus}
                  label="Duplicate"
                  combo="mod+d"
                  onClick={() => runAction('duplicate')}
                  placement="top"
                />
              )}
              {!locked && (
                <IconAction
                  icon={Trash2}
                  label="Delete"
                  combo="delete"
                  onClick={() => runAction('delete')}
                  placement="top"
                  testId="action-delete"
                />
              )}
              {!locked && selected.length > 1 && (
                <IconAction
                  icon={Group}
                  label="Group"
                  combo="mod+g"
                  onClick={() => runAction('group')}
                  placement="top"
                />
              )}
              {!locked && selected.some((e) => e.groupIds.length) && (
                <IconAction
                  icon={Ungroup}
                  label="Ungroup"
                  combo="mod+shift+g"
                  onClick={() => runAction('ungroup')}
                  placement="top"
                />
              )}
              <IconAction
                icon={Lock}
                label={locked ? 'Unlock' : 'Lock'}
                combo="mod+shift+l"
                active={locked}
                onClick={() => runAction('lock')}
                placement="top"
              />
            </Box>
          </Row>
        </>
      )}
    </Island>
  );
}
