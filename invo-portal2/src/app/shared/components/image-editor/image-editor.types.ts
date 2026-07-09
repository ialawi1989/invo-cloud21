/** Active tool in the editor sidebar. */
export type EditorTool = 'crop' | 'rotate' | 'adjust' | 'filters' | 'draw' | 'resize';

/** How an in-progress crop-box gesture mutates the rect. */
export type CropDragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w';

/** Crop frame orientation — swaps every ratio preset between tall and wide. */
export type CropOrientation = 'portrait' | 'landscape';

/** A crop-ratio preset as rendered in the grid. */
export interface CropPresetView {
  /** Stable identity ('free', 'original', or 'r0'…'rN'). */
  key: string;
  /** Displayed label, e.g. "16:9" (flips with orientation). */
  label: string;
  /** Enforced width/height ratio; null = free, 0 = image's natural ratio. */
  ratio: number | null;
  /** Which icon to draw. */
  kind: 'free' | 'original' | 'ratio';
  /** Icon rect size (in the 24×24 viewBox) for `kind === 'ratio'`. */
  rw: number;
  rh: number;
}

/** Base ratio pairs (a ≥ b); orientation decides which side is vertical. */
export const CROP_RATIO_BASE: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [2, 1], [16, 9], [3, 2], [4, 3], [5, 4],
];

/** Adjustment slider definition. */
export interface AdjustmentDef {
  key: string;
  label: string;
  min: number;
  max: number;
  default: number;
  unit: string;
  icon: string; // SVG path
}

export const ADJUSTMENTS: AdjustmentDef[] = [
  { key: 'brightness', label: 'Brightness', min: 0,   max: 200, default: 100, unit: '%', icon: 'M12 3v1m0 16v1m-8-9H3m18 0h-1m-2.636-5.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z' },
  { key: 'contrast',   label: 'Contrast',   min: 0,   max: 200, default: 100, unit: '%', icon: 'M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zM12 4v16a8 8 0 000-16z' },
  { key: 'saturate',   label: 'Saturation', min: 0,   max: 200, default: 100, unit: '%', icon: 'M12 2.69l5.66 5.66a8 8 0 11-11.31 0L12 2.69z' },
  { key: 'blur',       label: 'Blur',       min: 0,   max: 10,  default: 0,   unit: 'px', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

/** Predefined filter presets. */
export interface FilterPreset {
  label: string;
  css: string; // CSS filter string
}

export const FILTER_PRESETS: FilterPreset[] = [
  { label: 'None',      css: '' },
  { label: 'Grayscale', css: 'grayscale(100%)' },
  { label: 'Sepia',     css: 'sepia(80%)' },
  { label: 'Warm',      css: 'sepia(30%) saturate(140%) brightness(105%)' },
  { label: 'Cool',      css: 'saturate(80%) hue-rotate(15deg) brightness(105%)' },
  { label: 'Vivid',     css: 'saturate(180%) contrast(110%)' },
  { label: 'Muted',     css: 'saturate(50%) brightness(110%)' },
  { label: 'Invert',    css: 'invert(100%)' },
  { label: 'B&W High',  css: 'grayscale(100%) contrast(150%)' },
  { label: 'Vintage',   css: 'sepia(50%) contrast(90%) brightness(110%)' },
];

/** Editor state snapshot for undo/redo. */
export interface EditorState {
  imageData: ImageData;
  width: number;
  height: number;
}
