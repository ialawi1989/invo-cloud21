// ── Colour-space conversions ─────────────────────────────────────────────
//
// Pure helpers used by the color picker's spectrum, rainbow grid, and
// multi-format readouts. Everything is hand-rolled (no `chroma-js` /
// `color`) so the picker stays a small standalone component.
//
// Conventions:
//   • Hex strings are ALWAYS the canonical 7-char `#RRGGBB` (uppercase).
//   • RGB components live in [0, 255] and are integer.
//   • H is in [0, 360); S, L, V, etc. are normalised in [0, 100].
//   • Conversions tolerate fractional inputs but always emit display-
//     friendly integers from the round-trips used by the picker UI.
//
// The Lab / XYZ / Luv / HWB conversions are accurate enough for a
// readout — not a colour-management pipeline. We use the standard sRGB
// primaries with a D65 reference white.
// ──────────────────────────────────────────────────────────────────────────

export interface RGB { r: number; g: number; b: number; }
export interface HSL { h: number; s: number; l: number; }
export interface HSV { h: number; s: number; v: number; }

/** Coerce a free-text or `#RGB` form into canonical `#RRGGBB`, or return ''. */
export function normaliseHex(raw: string): string {
  if (!raw) return '';
  const s = raw.trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(s)) return ('#' + s).toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    const r = s[1], g = s[2], b = s[3];
    return ('#' + r + r + g + g + b + b).toUpperCase();
  }
  if (/^[0-9a-f]{3}$/i.test(s)) {
    const r = s[0], g = s[1], b = s[2];
    return ('#' + r + r + g + g + b + b).toUpperCase();
  }
  return s.toUpperCase();
}

export function hexToRgb(hex: string): RGB {
  const h = normaliseHex(hex);
  if (!/^#[0-9A-F]{6}$/.test(h)) return { r: 0, g: 0, b: 0 };
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return ('#' + c(r) + c(g) + c(b)).toUpperCase();
}

// ── HSL / HSV / RGB ──────────────────────────────────────────────────────
export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case rr: h = ((gg - bb) / d + (gg < bb ? 6 : 0)); break;
    case gg: h = ((bb - rr) / d + 2); break;
    case bb: h = ((rr - gg) / d + 4); break;
  }
  return { h: h * 60, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const ss = s / 100, ll = l / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ll - c / 2;
  let rr = 0, gg = 0, bb = 0;
  if      (0   <= h && h < 60)  { rr = c; gg = x; bb = 0; }
  else if (60  <= h && h < 120) { rr = x; gg = c; bb = 0; }
  else if (120 <= h && h < 180) { rr = 0; gg = c; bb = x; }
  else if (180 <= h && h < 240) { rr = 0; gg = x; bb = c; }
  else if (240 <= h && h < 300) { rr = x; gg = 0; bb = c; }
  else                          { rr = c; gg = 0; bb = x; }
  return { r: Math.round((rr + m) * 255), g: Math.round((gg + m) * 255), b: Math.round((bb + m) * 255) };
}

export function rgbToHsv({ r, g, b }: RGB): HSV {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case rr: h = ((gg - bb) / d + (gg < bb ? 6 : 0)); break;
      case gg: h = ((bb - rr) / d + 2); break;
      case bb: h = ((rr - gg) / d + 4); break;
    }
  }
  return { h: h * 60, s: s * 100, v: v * 100 };
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
  const ss = s / 100, vv = v / 100;
  const c = vv * ss;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vv - c;
  let rr = 0, gg = 0, bb = 0;
  if      (0   <= h && h < 60)  { rr = c; gg = x; bb = 0; }
  else if (60  <= h && h < 120) { rr = x; gg = c; bb = 0; }
  else if (120 <= h && h < 180) { rr = 0; gg = c; bb = x; }
  else if (180 <= h && h < 240) { rr = 0; gg = x; bb = c; }
  else if (240 <= h && h < 300) { rr = x; gg = 0; bb = c; }
  else                          { rr = c; gg = 0; bb = x; }
  return { r: Math.round((rr + m) * 255), g: Math.round((gg + m) * 255), b: Math.round((bb + m) * 255) };
}

// ── CMYK ─────────────────────────────────────────────────────────────────
export function rgbToCmyk({ r, g, b }: RGB): { c: number; m: number; y: number; k: number } {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const k = 1 - Math.max(rr, gg, bb);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  const c = (1 - rr - k) / (1 - k);
  const m = (1 - gg - k) / (1 - k);
  const y = (1 - bb - k) / (1 - k);
  return { c: Math.round(c * 100), m: Math.round(m * 100), y: Math.round(y * 100), k: Math.round(k * 100) };
}

// ── HWB ──────────────────────────────────────────────────────────────────
export function rgbToHwb(rgb: RGB): { h: number; w: number; b: number } {
  const hsv = rgbToHsv(rgb);
  const w = (1 - hsv.s / 100) * (hsv.v / 100) * 100;
  const b = (1 - hsv.v / 100) * 100;
  return { h: Math.round(hsv.h), w: Math.round(w), b: Math.round(b) };
}

// ── XYZ (D65) ────────────────────────────────────────────────────────────
function srgbToLin(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

export function rgbToXyz({ r, g, b }: RGB): { x: number; y: number; z: number } {
  const R = srgbToLin(r), G = srgbToLin(g), B = srgbToLin(b);
  // sRGB D65 matrix.
  const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) * 100;
  const y = (R * 0.2126729 + G * 0.7151522 + B * 0.0721750) * 100;
  const z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) * 100;
  return { x: Math.round(x), y: Math.round(y), z: Math.round(z) };
}

// ── CIE Lab (D65) ────────────────────────────────────────────────────────
const REF_X = 95.047, REF_Y = 100, REF_Z = 108.883; // D65 reference white
const labFn = (t: number) => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);

export function rgbToLab(rgb: RGB): { l: number; a: number; b: number } {
  const xyz = rgbToXyz(rgb);
  const fx = labFn(xyz.x / REF_X);
  const fy = labFn(xyz.y / REF_Y);
  const fz = labFn(xyz.z / REF_Z);
  return {
    l: Math.round(116 * fy - 16),
    a: Math.round(500 * (fx - fy)),
    b: Math.round(200 * (fy - fz)),
  };
}

// ── CIE Luv (D65) ────────────────────────────────────────────────────────
export function rgbToLuv(rgb: RGB): { l: number; u: number; v: number } {
  const xyz = rgbToXyz(rgb);
  if (xyz.y === 0) return { l: 0, u: 0, v: 0 };
  const denom = xyz.x + 15 * xyz.y + 3 * xyz.z;
  const u_ = denom === 0 ? 0 : 4 * xyz.x / denom;
  const v_ = denom === 0 ? 0 : 9 * xyz.y / denom;
  // D65 reference u'/v'.
  const denomR = REF_X + 15 * REF_Y + 3 * REF_Z;
  const ur = 4 * REF_X / denomR;
  const vr = 9 * REF_Y / denomR;
  const yr = xyz.y / REF_Y;
  const L = yr > 0.008856 ? 116 * Math.cbrt(yr) - 16 : 903.3 * yr;
  return {
    l: Math.round(L),
    u: Math.round(13 * L * (u_ - ur)),
    v: Math.round(13 * L * (v_ - vr)),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────
export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Build a rainbow swatch grid (11 hues × 10 lightnesses + 10 greys = 120)
 *  used by the picker's `[showRainbowPresets]` mode. Output shape matches
 *  the screenshot the user shared — last column is a grey ramp. */
export function buildRainbowGrid(): string[] {
  const out: string[] = [];
  const hues = [0, 15, 35, 60, 90, 130, 175, 200, 225, 270, 320];
  const lightnesses = [85, 75, 65, 55, 45, 38, 30, 22, 14, 6];
  for (const l of lightnesses) {
    for (const h of hues) {
      out.push(rgbToHex(hslToRgb({ h, s: 80, l })));
    }
    // Trailing grey column — matches the screenshot's right-most strip.
    out.push(rgbToHex(hslToRgb({ h: 0, s: 0, l })));
  }
  return out;
}

// ── WCAG 2.1 contrast utilities ──────────────────────────────────────────
//
// Standard "is this color readable on that background?" math. Used by the
// color picker to surface a pass/fail badge so brand teams don't ship
// illegible text. The thresholds match the WCAG 2.1 spec verbatim:
//
//    AA  (normal text)  4.5 : 1
//    AA  (large text)   3.0 : 1
//    AAA (normal text)  7.0 : 1
//
// Returning a `WcagLevel` keeps the consumer code declarative — pick the
// chip variant by level rather than re-computing the ratio against
// thresholds at the call site.
// ──────────────────────────────────────────────────────────────────────────

export const CONTRAST_AA_LARGE = 3.0;
export const CONTRAST_AA       = 4.5;
export const CONTRAST_AAA      = 7.0;

export type WcagLevel = 'fail' | 'aa-large' | 'aa' | 'aaa';

/** sRGB → relative luminance per WCAG 2.1 §1.4.3. Gamma-corrected,
 *  normalised to [0, 1]. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

/** Contrast ratio between two hex colours per WCAG 2.1 §1.4.3.
 *  Range [1, 21]. Order-independent. */
export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [bright, dark] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (bright + 0.05) / (dark + 0.05);
}

/** Bucket a contrast ratio into the highest WCAG level it satisfies.
 *  Use the result to pick a badge variant (`fail` → red, `aa` → green,
 *  `aaa` → emerald, etc.). */
export function wcagLevel(ratio: number): WcagLevel {
  if (ratio >= CONTRAST_AAA)      return 'aaa';
  if (ratio >= CONTRAST_AA)       return 'aa';
  if (ratio >= CONTRAST_AA_LARGE) return 'aa-large';
  return 'fail';
}
