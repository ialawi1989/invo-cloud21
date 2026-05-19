/**
 * Slugify with full-Unicode support (works for Arabic, Cyrillic, etc.).
 * Mirrors the backend slug rules: lowercase, separator `-`, strips
 * everything that isn't a letter, number, space, or dash; caps length.
 */
export function generateSlug(text: string, maxLength = 80): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, maxLength);
}

/** Extract hashtags out of HTML / plain text. Matches `#` followed by
 *  letters/numbers/underscore in any script. Returns lowercase, unique. */
export function extractHashtags(html: string): string[] {
  const text = (html ?? '').replace(/<[^>]*>/g, ' ');
  const matches = text.matchAll(/#([\p{L}\p{N}_]+)/gu);
  const set = new Set<string>();
  for (const m of matches) set.add(m[1].toLowerCase());
  return [...set];
}

/** Estimate reading time in whole minutes (200 wpm). Min 1. */
export function estimateReadingTime(html: string): number {
  const words = (html ?? '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** "12s ago" / "3m ago" / "yesterday" formatting for save indicators
 *  and comment timestamps. Falls back to locale date when > 6 days. */
export function timeAgo(iso: string | null | undefined, locale: string = 'en'): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diffMs = Date.now() - t;
  const s = Math.floor(diffMs / 1000);
  if (s < 5)      return locale === 'ar' ? 'الآن' : 'just now';
  if (s < 60)    return locale === 'ar' ? `قبل ${s}ث`    : `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)    return locale === 'ar' ? `قبل ${m}د`    : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)    return locale === 'ar' ? `قبل ${h}س`    : `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)     return locale === 'ar' ? `قبل ${d}ي`    : `${d}d ago`;
  return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar' : 'en');
}

/** True if the language code reads right-to-left for the given settings. */
export function isRtl(lang: string, rtlLanguages: string[]): boolean {
  return rtlLanguages.includes(lang);
}

/** Resolve a translated field from a locale map with fallback to default. */
export function getLocalizedField<T>(
  translations: Record<string, any> | undefined,
  lang: string,
  field: string,
  defaultLang: string,
): T | string {
  return translations?.[lang]?.[field] ?? translations?.[defaultLang]?.[field] ?? '';
}
