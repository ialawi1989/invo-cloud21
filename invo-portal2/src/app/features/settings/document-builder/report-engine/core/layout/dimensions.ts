import { Length } from '../types/style.types';
import { PageSetup } from '../types/template.types';

/**
 * Page dimensions in mm. Single source of truth — everywhere else converts
 * from this. We avoid CSS-pixel math because we render to PDF too.
 */
export interface PageDimensions {
  width: number;
  height: number;
  contentWidth: number;
  contentHeight: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
}

const PAPER_DIMENSIONS_MM: Record<string, [number, number]> = {
  A3: [297, 420],
  A4: [210, 297],
  A5: [148, 210],
  Letter: [215.9, 279.4],
  Legal: [215.9, 355.6],
  Thermal80: [80, 297], // height grows dynamically; treated as starting cap
  Thermal58: [58, 297],
};

export function computePageDimensions(setup: PageSetup): PageDimensions {
  let [w, h] =
    setup.size === 'Custom'
      ? [setup.customWidth ?? 210, setup.customHeight ?? 297]
      : PAPER_DIMENSIONS_MM[setup.size] ?? [210, 297];
  if (setup.orientation === 'landscape') [w, h] = [h, w];
  return {
    width: w,
    height: h,
    marginTop: setup.margins.top,
    marginRight: setup.margins.right,
    marginBottom: setup.margins.bottom,
    marginLeft: setup.margins.left,
    contentWidth: w - setup.margins.left - setup.margins.right,
    contentHeight: h - setup.margins.top - setup.margins.bottom,
  };
}

/** Convert any Length to millimeters. */
export function toMm(len: Length): number {
  switch (len.unit) {
    case 'mm':
      return len.value;
    case 'cm':
      return len.value * 10;
    case 'in':
      return len.value * 25.4;
    case 'pt':
      return len.value * 0.352778; // 1 pt = 1/72 in
    case 'px':
      return (len.value / 96) * 25.4; // assume 96 dpi
  }
}

/** Convert mm to CSS px at a given DPI (default 96 — browser standard). */
export function mmToPx(mm: number, dpi = 96): number {
  return (mm / 25.4) * dpi;
}

/** Convert mm to PDFMake points. */
export function mmToPt(mm: number): number {
  return mm * 2.83465; // 72 / 25.4
}

/** Approximate text height in mm given font size (pt) and number of lines. */
export function approximateTextHeightMm(fontSizePt: number, lines: number, lineHeight = 1.2): number {
  return ((fontSizePt * lineHeight) / 72) * 25.4 * lines;
}

/** Approximate text width using average advance width factor. Conservative. */
export function approximateTextWidthMm(text: string, fontSizePt: number, factor = 0.55): number {
  return text.length * fontSizePt * factor * 0.352778;
}
