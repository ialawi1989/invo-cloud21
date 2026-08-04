import { Block } from '../types/block.types';
import { BlockStyle, SpacingBox } from '../types/style.types';
import { ReportTemplate, Section } from '../types/template.types';

/**
 * Multipliers applied when the page geometry changes.
 *
 * Callers derive these from the content-box ratio — inside the margins, which
 * is the origin block coordinates are relative to (see the HTML renderer's
 * `.page` padding). The axes are kept separate here because padding and
 * per-axis measurements read them independently, but `DesignerStateService`
 * passes the same value for all three: uniform scaling is what keeps a
 * portrait↔landscape flip from stretching every block.
 */
export interface ScaleFactors {
  x: number;
  y: number;
  font: number;
}

/** Below this the change isn't worth a rewrite of every block. */
const EPSILON = 0.001;

export function isIdentityScale(f: ScaleFactors): boolean {
  return Math.abs(f.x - 1) < EPSILON && Math.abs(f.y - 1) < EPSILON;
}

/**
 * Values are kept at full precision (trimmed only of float noise at 1e-6) and
 * NOT snapped to a friendly step: snapping to 0.01mm turns 15 into 14.99 the
 * moment anything is scaled and back, and clamping fonts to a legible minimum
 * is a one-way door. Exact round trips are handled a level up, by the
 * snapshot restore in DesignerStateService; this keeps the drift small for
 * every path that doesn't hit it. The property panel rounds for display.
 */
const round = (v: number): number => Math.round(v * 1e6) / 1e6;

const mm = (v: number, factor: number): number => round(v * factor);

const ptFont = (v: number, factor: number): number => round(v * factor);

function scaleSpacing(box: SpacingBox | undefined, f: ScaleFactors): SpacingBox | undefined {
  if (!box) return box;
  return {
    ...box,
    top: box.top === undefined ? undefined : mm(box.top, f.y),
    bottom: box.bottom === undefined ? undefined : mm(box.bottom, f.y),
    left: box.left === undefined ? undefined : mm(box.left, f.x),
    right: box.right === undefined ? undefined : mm(box.right, f.x),
  };
}

function scaleStyle(style: BlockStyle | undefined, f: ScaleFactors): BlockStyle | undefined {
  if (!style) return style;
  const out: BlockStyle = { ...style };
  if (style.font) {
    out.font = {
      ...style.font,
      size: style.font.size === undefined ? undefined : ptFont(style.font.size, f.font),
      letterSpacing:
        style.font.letterSpacing === undefined
          ? undefined
          : round(style.font.letterSpacing * f.font),
    };
  }
  if (style.padding) out.padding = scaleSpacing(style.padding, f);
  if (style.margin) out.margin = scaleSpacing(style.margin, f);
  // Border widths are deliberately left alone: they're hairlines in pt, and
  // scaling a 0.25pt rule down makes it vanish in print.
  return out;
}

/**
 * Rescale one block (and, for repeaters, its children — whose coordinates are
 * card-relative, so the same factors apply unchanged).
 */
export function scaleBlock(block: Block, f: ScaleFactors): Block {
  const b: any = {
    ...block,
    position: { x: mm(block.position.x, f.x), y: mm(block.position.y, f.y) },
    size: {
      ...block.size,
      width: mm(block.size.width, f.x),
      height: mm(block.size.height, f.y),
    },
    style: scaleStyle(block.style, f),
  };

  if (block.conditionalStyles?.length) {
    b.conditionalStyles = block.conditionalStyles.map((c) => ({
      ...c,
      style: scaleStyle(c.style, f) ?? c.style,
    }));
  }

  // Type-specific geometry. Everything measured in mm follows the axis it
  // lives on; pt-based rule thickness follows the uniform font factor.
  switch (block.type) {
    case 'line':
      b.thickness = round(block.thickness * f.font);
      break;
    case 'divider':
      if (block.thickness !== undefined) b.thickness = round(block.thickness * f.font);
      break;
    case 'rectangle':
      if (block.borderRadius) b.borderRadius = mm(block.borderRadius, f.font);
      break;
    case 'table':
      if (block.rowMinHeight !== undefined) b.rowMinHeight = mm(block.rowMinHeight, f.y);
      b.columns = block.columns.map((c) => ({
        ...c,
        // Only `fixed` columns carry a real measurement — fraction/auto are
        // proportional already and resize with the table.
        width: c.width.kind === 'fixed' ? { ...c.width, mm: mm(c.width.mm, f.x) } : c.width,
        imageHeightMm: c.imageHeightMm === undefined ? undefined : mm(c.imageHeightMm, f.y),
        cellStyle: scaleStyle(c.cellStyle, f),
        headerStyle: scaleStyle(c.headerStyle, f),
      }));
      break;
    case 'payments':
      if (block.rowMinHeight !== undefined) b.rowMinHeight = mm(block.rowMinHeight, f.y);
      break;
    case 'totals':
      if (block.labelWidth !== undefined) b.labelWidth = mm(block.labelWidth, f.x);
      break;
    case 'repeater':
      b.itemHeight = mm(block.itemHeight, f.y);
      if (block.itemSpacing !== undefined) b.itemSpacing = mm(block.itemSpacing, f.y);
      if (block.borderRadius) b.borderRadius = mm(block.borderRadius, f.font);
      b.items = block.items.map((c) => scaleBlock(c, f));
      break;
  }

  return b as Block;
}

function scaleSection(section: Section, f: ScaleFactors): Section {
  return {
    ...section,
    height: section.height === undefined ? undefined : mm(section.height, f.y),
    blocks: section.blocks.map((b) => scaleBlock(b, f)),
    style: scaleStyle(section.style, f),
  };
}

/**
 * Proportionally rescale every positioned thing in the template so a design
 * authored for one paper size reappears intact on another. Pure — returns a
 * new template, leaving the original untouched for the history stack.
 */
export function scaleTemplateGeometry(template: ReportTemplate, f: ScaleFactors): ReportTemplate {
  if (isIdentityScale(f)) return template;
  return {
    ...template,
    sections: template.sections.map((s) => scaleSection(s, f)),
    defaultStyle: scaleStyle(template.defaultStyle, f),
  };
}
