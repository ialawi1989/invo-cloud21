/**
 * Arabic / RTL helpers.
 *
 * Detection is done character-class — Arabic Unicode blocks are well-defined
 * (U+0600–U+06FF base, U+0750–U+077F supplement, U+08A0–U+08FF extended-A,
 * U+FB50–U+FDFF presentation A, U+FE70–U+FEFF presentation B). We don't try
 * to handle Hebrew or Syriac here because POS/ERP customer bases are Arabic-
 * dominant; extending later is one regex addition.
 *
 * For text *shaping* we delegate to the browser's native bidi algorithm by
 * setting `dir="rtl"` and a font that contains Arabic glyphs (the renderer
 * picks `theme.arabicFontFamily` when present, falling back to a system stack).
 * Server-side PDF rendering uses pdfmake's bidi support which honours the
 * `rtl: true` style on text runs.
 */

const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function containsArabic(text: string): boolean {
  return ARABIC_RANGE.test(text);
}

/** Heuristic — is the text predominantly Arabic? */
export function isArabicDominant(text: string): boolean {
  if (!text) return false;
  let arabic = 0;
  let latin = 0;
  for (const ch of text) {
    if (ARABIC_RANGE.test(ch)) arabic++;
    else if (/[A-Za-z]/.test(ch)) latin++;
  }
  return arabic > latin;
}

/** Convert ASCII digits to Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩). */
export function toArabicIndicDigits(input: string): string {
  return input.replace(/[0-9]/g, (d) =>
    String.fromCharCode(0x0660 + Number(d)),
  );
}

/** Inverse — Arabic-Indic to ASCII. */
export function toAsciiDigits(input: string): string {
  return input.replace(/[\u0660-\u0669]/g, (d) =>
    String((d.codePointAt(0) ?? 0x0660) - 0x0660),
  );
}

/** System Arabic font stack — used when no theme-level family is configured. */
export const DEFAULT_ARABIC_FONT_STACK =
  '"Noto Naskh Arabic", "Noto Sans Arabic", "Cairo", "Tajawal", "Amiri", "Geeza Pro", "Arial", sans-serif';

/** System Latin font stack. */
export const DEFAULT_LATIN_FONT_STACK =
  '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif';

/** Pick a font family for a given text segment — Arabic-aware. */
export function pickFontFamily(
  text: string,
  themeLatin?: string,
  themeArabic?: string,
): string {
  if (containsArabic(text)) {
    return themeArabic ?? DEFAULT_ARABIC_FONT_STACK;
  }
  return themeLatin ?? DEFAULT_LATIN_FONT_STACK;
}
