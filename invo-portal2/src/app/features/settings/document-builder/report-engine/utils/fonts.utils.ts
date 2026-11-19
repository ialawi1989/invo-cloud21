/**
 * Font families offered by the designer's Font family picker.
 *
 * Restricted to families that resolve on BOTH Windows and Linux, because a
 * template is authored on a workstation but rendered wherever the server runs.
 * Offering whatever happens to be installed on the designer's own PC would let
 * someone pick Calibri and get a silent fallback in production.
 *
 * Each value is a CSS stack rather than a bare name: the Windows font first,
 * then its metric-compatible Linux counterpart (Liberation / DejaVu, which
 * ship with essentially every distro), then a generic. So the same declaration
 * renders at the same measurements on either OS.
 *
 * PDF caveat: the pdfmake exporter only has `Roboto` and `Amiri` registered
 * (see pdfmake-fonts.ts), so any other choice renders in the canvas, the HTML
 * preview, and browser print, but falls back to Roboto in an exported PDF.
 * `pdfSafe` marks the two that survive everywhere, and the picker groups on it.
 */
export interface FontOption {
  /** CSS font stack stored on the block's `style.font.family`. */
  value: string;
  label: string;
  /** Renders identically in an exported PDF, not just on screen. */
  pdfSafe: boolean;
  /** Heading the picker groups this option under. */
  group: string;
}

const GROUP_DEFAULT = 'Default';
const GROUP_PDF = 'Renders in PDF too';
const GROUP_SCREEN = 'Screen & browser print (PDF falls back)';

/**
 * What "Inherit" resolves to when the template's theme sets no family of its
 * own — the designer canvas, the HTML export, and the exported PDF all fall
 * back to this, so an untouched block looks the same in all three.
 *
 * Deliberately two families, in this order:
 *  - `Roboto` covers Latin and is pdfmake's built-in default, so Latin text on
 *    screen matches the PDF exactly.
 *  - `Amiri` has no effect on Latin (Roboto already supplied it) but is the
 *    first family in the stack with Arabic coverage, so the browser's
 *    per-glyph fallback lands Arabic characters on it. That mirrors
 *    `arabicFontOverride()` in the pdfmake renderer, which forces Amiri on any
 *    run containing Arabic.
 *
 * Order is load-bearing: a family with Arabic glyphs placed before Amiri (an
 * `Arial` or a `Tahoma`) would win the fallback on Windows and the canvas
 * would stop matching the PDF. Keep Amiri ahead of every generic.
 */
export const DEFAULT_FONT_STACK = 'Roboto, Amiri, sans-serif';

/** Clears the block's own family so it inherits from the template. */
const INHERIT: FontOption = {
  value: '',
  label: 'Inherit',
  pdfSafe: true,
  group: GROUP_DEFAULT,
};

/** Bundled with the exporter — these render everywhere, PDF included. */
const PDF_FONTS: ReadonlyArray<FontOption> = [
  { value: 'Roboto', label: 'Roboto', pdfSafe: true, group: GROUP_PDF },
  { value: 'Amiri', label: 'Amiri (Arabic)', pdfSafe: true, group: GROUP_PDF },
];

/**
 * Windows family → Linux equivalent. The Liberation set is metric-compatible
 * with Arial / Times New Roman / Courier New (same advance widths), so a line
 * of text wraps at the same point on both platforms. DejaVu covers the rest at
 * similar proportions.
 */
const CROSS_PLATFORM: ReadonlyArray<FontOption> = [
  {
    label: 'Arial / Helvetica',
    value: 'Arial, "Liberation Sans", Helvetica, sans-serif',
    pdfSafe: false,
    group: GROUP_SCREEN,
  },
  {
    label: 'Times New Roman',
    value: '"Times New Roman", "Liberation Serif", Times, serif',
    pdfSafe: false,
    group: GROUP_SCREEN,
  },
  {
    label: 'Courier New',
    value: '"Courier New", "Liberation Mono", Courier, monospace',
    pdfSafe: false,
    group: GROUP_SCREEN,
  },
  {
    label: 'Verdana',
    value: 'Verdana, "DejaVu Sans", Geneva, sans-serif',
    pdfSafe: false,
    group: GROUP_SCREEN,
  },
  {
    label: 'Tahoma',
    value: 'Tahoma, "DejaVu Sans", Geneva, sans-serif',
    pdfSafe: false,
    group: GROUP_SCREEN,
  },
  {
    label: 'Georgia',
    value: 'Georgia, "DejaVu Serif", serif',
    pdfSafe: false,
    group: GROUP_SCREEN,
  },
];

/** Generic families, resolved by every browser on every platform. */
const GENERIC: ReadonlyArray<FontOption> = [
  { value: 'system-ui', label: 'System UI', pdfSafe: false, group: GROUP_SCREEN },
  { value: 'sans-serif', label: 'Sans-serif', pdfSafe: false, group: GROUP_SCREEN },
  { value: 'serif', label: 'Serif', pdfSafe: false, group: GROUP_SCREEN },
  { value: 'monospace', label: 'Monospace', pdfSafe: false, group: GROUP_SCREEN },
];

/**
 * The picker's families, PDF-safe first. A fixed list, not a probe of the
 * local machine: the point is that every option renders the same way for
 * everyone who opens the document, so the list must not vary by workstation.
 */
export function availableFontFamilies(): FontOption[] {
  return [INHERIT, ...PDF_FONTS, ...CROSS_PLATFORM, ...GENERIC];
}

/**
 * The picker's options for a block, with `current` prepended when it isn't a
 * family we know about — a template authored elsewhere (or converted from
 * Classic) can carry any family, and dropping it from the list would silently
 * rewrite the design the moment the user touched another field.
 */
export function fontOptionsIncluding(current: string | undefined): FontOption[] {
  const options = availableFontFamilies();
  const value = (current ?? '').trim();
  if (!value || options.some((o) => o.value === value)) return options;
  return [
    { value, label: `${value} (custom)`, pdfSafe: false, group: GROUP_DEFAULT },
    ...options,
  ];
}

/**
 * The same list for the document-level (theme) picker.
 *
 * Only the empty option differs: on a block it means "inherit from the
 * template", but the template has nothing above it to inherit from — clearing
 * it there falls back to DEFAULT_FONT_STACK. Naming the stack in the label
 * keeps the two pickers from reading like the same choice.
 */
export function themeFontOptionsIncluding(current: string | undefined): FontOption[] {
  return fontOptionsIncluding(current).map((o) =>
    o.value === '' ? { ...o, label: 'Default (Roboto, Amiri)' } : o,
  );
}

/**
 * Families that were only ever a seed value, never a user choice.
 *
 * The bundled sample template shipped with Inter as its theme font, and
 * `starterTemplate()` copies the sample for every document type — so every
 * design created before that changed carries Inter without anyone having
 * picked it. Inter is loaded nowhere in the app and registered nowhere in the
 * PDF exporter, so those templates render Helvetica/Arial on the canvas and
 * Roboto in the export. Every render site maps them back to
 * DEFAULT_FONT_STACK so "Inherit" means the same thing on all three surfaces.
 * Done at read time, not by rewriting the stored design: a family the user
 * actually selected (anything not in this list) is never touched.
 */
const LEGACY_SEED_FAMILIES: ReadonlySet<string> = new Set([
  '"Inter", "Helvetica Neue", Arial, sans-serif',
  '"Inter", Arial, sans-serif',
]);

/** `family`, or DEFAULT_FONT_STACK when it's one of the legacy seed values. */
export function normalizeSeedFontFamily(family: string | undefined): string | undefined {
  if (!family) return family;
  return LEGACY_SEED_FAMILIES.has(family.trim()) ? DEFAULT_FONT_STACK : family;
}
