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

/**
 * A single adjustment slider. Values are the raw scale the pixel pipeline
 * consumes (e.g. brightness 0.5–1.5, temperature −1…1), NOT percentages —
 * `image-editor.component` reads `adjustments()[key]` straight into the math.
 */
export interface AdjustControl {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  /** Full inline SVG markup rendered next to the label. */
  icon: string;
  /** When true, the control pairs the slider with a colour picker (Tint). */
  color?: boolean;
}

/** A titled section of the Adjust panel. */
export interface AdjustGroup {
  title: string;
  controls: AdjustControl[];
}

// Wix WDS 18×18 glyphs, kept as full SVG so the panel matches the reference.
const IC = {
  brightness: '<svg viewBox="0 0 18 18" fill="currentColor" width="18" height="18"><path d="M9.5,12 C8.119,12 7,10.881 7,9.5 C7,8.119 8.119,7 9.5,7 C10.881,7 12,8.119 12,9.5 C12,10.881 10.881,12 9.5,12 Z M9,3 L10,3 L10,6 L9,6 L9,3 Z M13,9 L16,9 L16,10 L13,10 L13,9 Z M3,9 L6,9 L6,10 L3,10 L3,9 Z M9,13 L10,13 L10,16 L9,16 L9,13 Z M12.152,6.153 L13.147,5.152 C13.339,4.959 13.652,4.958 13.845,5.15 C14.039,5.344 14.04,5.658 13.847,5.852 L12.853,6.853 C12.661,7.046 12.348,7.048 12.154,6.855 C11.96,6.661 11.959,6.347 12.152,6.153 Z M6.853,12.839 L5.84,13.855 C5.647,14.049 5.333,14.051 5.137,13.859 C4.944,13.669 4.941,13.359 5.13,13.165 L6.152,12.139 C6.345,11.946 6.658,11.945 6.851,12.138 C7.046,12.332 7.046,12.645 6.853,12.839 Z M12.853,12.16 L13.847,13.162 C14.035,13.351 14.034,13.655 13.845,13.843 C13.842,13.846 13.839,13.849 13.836,13.852 C13.635,14.041 13.321,14.035 13.126,13.84 L12.152,12.86 C11.959,12.666 11.96,12.352 12.154,12.158 C12.346,11.966 12.659,11.966 12.852,12.159 L12.853,12.16 Z M6.852,6.156 C7.045,6.347 7.045,6.659 6.854,6.851 L6.852,6.853 C6.659,7.046 6.346,7.046 6.152,6.853 L5.147,5.855 C4.953,5.662 4.952,5.348 5.144,5.153 C5.334,4.96 5.646,4.957 5.84,5.148 L6.852,6.156 Z"></path></svg>',
  contrast: '<svg viewBox="0 0 18 18" fill="currentColor" width="18" height="18"><path d="M9,16 C5.134,16 2,12.866 2,9 C2,5.134 5.134,2 9,2 C12.866,2 16,5.134 16,9 C16,12.866 12.866,16 9,16 Z M9,15 C12.314,15 15,12.314 15,9 C15,5.686 12.314,3 9,3 C5.686,3 3,5.686 3,9 C3,12.314 5.686,15 9,15 Z M9,13 L9,5 C11.209,5 13,6.791 13,9 C13,11.209 11.209,13 9,13 Z"></path></svg>',
  highlights: '<svg viewBox="0 0 18 18" fill="currentColor" width="18" height="18"><path d="M9,2 C12.866,2 16,5.134 16,9 C16,12.866 12.866,16 9,16 C5.134,16 2,12.866 2,9 C2,5.134 5.134,2 9,2 Z M9,3 C5.686,3 3,5.686 3,9 C3,12.314 5.686,15 9,15 C10.226,15 11.366,14.632 12.315,14.002 L9,14 L9,13 L13.472,13.001 C13.988,12.424 14.395,11.746 14.658,11.001 L9,11 L9,10 L14.917,10.001 C14.972,9.675 15,9.341 15,9 C15,8.659 14.972,8.325 14.917,8 L9,8 L9,7 L14.659,7 C14.395,6.255 13.989,5.577 13.472,5 L9,5 L9,4 L12.318,4 C11.367,3.368 10.227,3 9,3 Z"></path></svg>',
  shadows: '<svg viewBox="0 0 18 18" fill="currentColor" width="18" height="18"><path d="M9,2 C12.866,2 16,5.134 16,9 C16,12.785 12.995,15.869 9.241,15.996 L9,16 C5.134,16 2,12.866 2,9 C2,5.134 5.134,2 9,2 Z M9,14 L5.684,14.001 C6.575,14.593 7.635,14.954 8.775,14.996 L9,15 L9,14 Z M9,11 L3.342,11.001 C3.605,11.746 4.012,12.424 4.529,13.001 L9,13 L9,11 Z M3.083,8 C3.028,8.325 3,8.659 3,9 C3,9.341 3.028,9.675 3.083,10.001 L9,10 L9,8 L3.083,8 Z M9,5 L4.528,5 C4.011,5.577 3.605,6.255 3.341,7 L9,7 L9,5 Z M9,3 C7.773,3 6.633,3.368 5.682,4 L9,4 L9,3 Z"></path></svg>',
  saturation: '<svg viewBox="0 0 18 18" fill="currentColor" width="18" height="18"><g clip-path="url(#adj-sat)"><path d="M10 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 5a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM6 9a3 3 0 1 0 6 0H6Zm3 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm7-7a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM3 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm2.977-5.449a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM4.8 14.277a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9.23-9.717a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM13.466 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"></path></g><defs><clipPath id="adj-sat"><path d="M0 0h18v18H0z"></path></clipPath></defs></svg>',
  temperature: '<svg viewBox="0 0 18 18" fill="currentColor" width="18" height="18"><path d="M8.5,2 C9.881,2 11,3.119 11,4.5 L11.001,10.052 C11.619,10.683 12,11.547 12,12.5 C12,14.433 10.433,16 8.5,16 C6.567,16 5,14.433 5,12.5 C5,11.547 5.381,10.682 5.999,10.051 L6,4.5 C6,3.119 7.119,2 8.5,2 Z M8.5,3 C7.672,3 7,3.672 7,4.5 L7,10.5 C6.393,10.956 6,11.682 6,12.5 C6,13.881 7.119,15 8.5,15 C9.881,15 11,13.881 11,12.5 C11,11.683 10.608,10.957 10.001,10.501 L10,4.5 C10,3.672 9.328,3 8.5,3 Z M9,5 L9.001,11.086 C9.583,11.292 10,11.847 10,12.5 C10,13.328 9.328,14 8.5,14 C7.672,14 7,13.328 7,12.5 C7,11.847 7.418,11.291 8,11.085 L8,5 L9,5 Z"></path></svg>',
  exposure: '<svg viewBox="0 0 18 18" fill="currentColor" width="18" height="18"><path d="M14,3 C14.552,3 15,3.448 15,4 L15,14 C15,14.552 14.552,15 14,15 L4,15 C3.448,15 3,14.552 3,14 L3,4 C3,3.448 3.448,3 4,3 L14,3 Z M13.999,4 L4,4 L4,13.999 L13.999,4 Z M13,11 L10,11 L10,12 L13,12 L13,11 Z M7,5 L7,6 L8,6 L8,7 L7,7 L7,8 L6,8 L6,7 L5,7 L5,6 L6,6 L6,5 L7,5 Z"></path></svg>',
  sharpness: '<svg viewBox="0 0 18 18" fill="currentColor" width="18" height="18"><path d="M15.5,5 C15.911,5 16.106,5.448 15.946,5.726 L9.405,14.793 C9.233,15.035 8.819,15.094 8.595,14.793 L2.095,5.793 C1.884,5.513 2.035,5 2.5,5 L15.5,5 Z M14.522,6 L3.478,6 L9,13.646 L14.522,6 Z M12.5,7 L9,12 L9,7 L12.5,7 Z"></path></svg>',
  vignette: '<svg viewBox="0 0 18 18" fill="currentColor" width="18" height="18"><path d="M9,2 C12.866,2 16,5.134 16,9 C16,12.866 12.866,16 9,16 C5.134,16 2,12.866 2,9 C2,5.134 5.134,2 9,2 Z M9,3 C5.686,3 3,5.686 3,9 C3,12.314 5.686,15 9,15 C12.314,15 15,12.314 15,9 C15,5.686 12.314,3 9,3 Z M9,7 C10.105,7 11,7.895 11,9 C11,10.105 10.105,11 9,11 C7.895,11 7,10.105 7,9 C7,7.895 7.895,7 9,7 Z"></path></svg>',
  grain: '<svg viewBox="0 0 18 18" fill="currentColor" width="18" height="18"><path d="M12 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-3-2a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM8 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm-3 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm5-2a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM6 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path><path d="M16 9A7 7 0 1 1 2 9a7 7 0 0 1 14 0Zm-1 0A6 6 0 1 0 3 9a6 6 0 0 0 12 0Z"></path></svg>',
  tint: '<svg viewBox="0 0 18 18" fill="currentColor" width="18" height="18"><path d="M9,2 C12.866,2 16,5.134 16,9 C16,12.785 12.995,15.869 9.241,15.996 L9,16 C5.134,16 2,12.866 2,9 C2,5.134 5.134,2 9,2 Z M9,3 C5.686,3 3,5.686 3,9 C3,12.314 5.686,15 9,15 C10.226,15 11.366,14.632 12.315,14.002 L9,14 Z"></path></svg>',
};

export const ADJUST_GROUPS: AdjustGroup[] = [
  {
    title: 'Light & Color',
    controls: [
      { key: 'brightness',  label: 'Brightness',       min: 0.5,  max: 1.5,  step: 0.01, default: 1,   icon: IC.brightness },
      { key: 'contrast',    label: 'Contrast',         min: 0.5,  max: 1.5,  step: 0.01, default: 1,   icon: IC.contrast },
      { key: 'highlights',  label: 'Highlights',       min: -1,   max: 1,    step: 0.01, default: 0,   icon: IC.highlights },
      { key: 'shadows',     label: 'Shadows',          min: -1,   max: 1,    step: 0.01, default: 0,   icon: IC.shadows },
      { key: 'saturation',  label: 'Color Saturation', min: 0,    max: 2,    step: 0.01, default: 1,   icon: IC.saturation },
      { key: 'temperature', label: 'Temperature',      min: -1,   max: 1,    step: 0.01, default: 0,   icon: IC.temperature },
      { key: 'exposure',    label: 'Exposure',         min: -0.8, max: 0.8,  step: 0.01, default: 0,   icon: IC.exposure },
    ],
  },
  {
    title: 'Effects',
    controls: [
      { key: 'sharpness',   label: 'Sharpness',        min: -25,  max: 25,   step: 1,    default: 0,   icon: IC.sharpness },
      { key: 'vignette',    label: 'Vignette',         min: -1,   max: 1,    step: 0.01, default: 0,   icon: IC.vignette },
      { key: 'grain',       label: 'Grain',            min: 0,    max: 1,    step: 0.01, default: 0,   icon: IC.grain },
      { key: 'tint',        label: 'Tint',             min: 0,    max: 0.5,  step: 0.01, default: 0,   icon: IC.tint, color: true },
    ],
  },
];

/** Flat list of every adjustment control (for defaults + iteration). */
export const ADJUST_CONTROLS: AdjustControl[] = ADJUST_GROUPS.flatMap(g => g.controls);

/** Default value map, keyed by control key. */
export const ADJUST_DEFAULTS: Record<string, number> =
  Object.fromEntries(ADJUST_CONTROLS.map(c => [c.key, c.default]));

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
