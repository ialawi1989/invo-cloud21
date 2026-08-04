/**
 * Style primitives shared across all blocks.
 * Units are millimeters by default (matches A4 conventions); pt allowed for typography.
 */

export type LengthUnit = 'mm' | 'pt' | 'px' | 'in' | 'cm';
export interface Length {
  value: number;
  unit: LengthUnit;
}

export const mm = (v: number): Length => ({ value: v, unit: 'mm' });
export const pt = (v: number): Length => ({ value: v, unit: 'pt' });
export const px = (v: number): Length => ({ value: v, unit: 'px' });

export type HorizontalAlign = 'left' | 'center' | 'right' | 'justify';
export type VerticalAlign = 'top' | 'middle' | 'bottom';
export type Direction = 'ltr' | 'rtl' | 'auto';

export interface Color {
  /** CSS-compatible color string: hex, rgb(), rgba(), or named color. */
  value: string;
}

export interface FontStyle {
  family?: string;
  size?: number; // pt
  weight?: 'normal' | 'bold' | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  italic?: boolean;
  underline?: boolean;
  strikeThrough?: boolean;
  letterSpacing?: number;
  lineHeight?: number;
  color?: string;
}

export interface BorderSide {
  width: number; // pt
  color: string;
  style: 'solid' | 'dashed' | 'dotted' | 'double';
}

export interface BorderStyle {
  top?: BorderSide;
  right?: BorderSide;
  bottom?: BorderSide;
  left?: BorderSide;
}

export interface SpacingBox {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface BlockStyle {
  font?: FontStyle;
  background?: string;
  border?: BorderStyle;
  padding?: SpacingBox;
  margin?: SpacingBox;
  align?: HorizontalAlign;
  vAlign?: VerticalAlign;
  direction?: Direction;
  opacity?: number;
  rotate?: number; // degrees
  /** Tenant CSS class hooks — appended in the HTML renderer for theme overrides. */
  className?: string;
}

/** Conditional style: applied if `when` expression evaluates truthy. */
export interface ConditionalStyle {
  when: string; // expression e.g. "row.qty > 10"
  style: BlockStyle;
}
