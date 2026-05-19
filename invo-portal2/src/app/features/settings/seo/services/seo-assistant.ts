import type { SeoPageRow } from './seo.types';

/**
 * SEO Assistant — task catalog + evaluator.
 *
 * Each task is a pure function over the page row plus the
 * site-wide indexing flag, returning `true` when the task passes.
 * Severity labels mirror the Invo copy verbatim so the UI matches
 * what the user expects:
 *
 *   • Critical — gates indexability. Failing one of these almost
 *     certainly keeps the page out of search results.
 *   • High     — affects how the page appears / ranks in search
 *     results once it IS indexable.
 *   • Medium   — softer ranking factor; informational tags.
 *   • Low      — nice-to-have polish; influences clickthrough more
 *     than ranking.
 *
 * Tasks tagged `requiresFocusKeyword: true` are only evaluated when
 * the row has a non-empty focus keyword set. Without one the
 * assistant skips them (they'd all be no-ops) AND surfaces a
 * separate "Add a focus keyword" prompt at the top of the High
 * group, matching the Invo UX of "add a focus keyword to unlock
 * more tasks."
 */
export type SeoSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SeoAssistantTask {
  id:                    string;
  /** i18n key for the task description shown in the list. */
  labelKey:              string;
  severity:              SeoSeverity;
  /** Only evaluate when the row has a focus keyword. */
  requiresFocusKeyword?: boolean;
  /** Only evaluate when the row is a blog post (`row.isBlogPost`). */
  requiresBlogPost?:     boolean;
  /** Only evaluate when the row has multilingual storefront copies. */
  requiresMultilingual?: boolean;
  /** Per-task gate evaluated *before* the main evaluator runs. Lets a
   *  task skip itself when its input data isn't present at all (e.g.
   *  alt-text check skips when the row carries no images list). */
  appliesIf?:            (ctx: SeoAssistantContext) => boolean;
}

export interface SeoAssistantContext {
  row:           SeoPageRow;
  siteIndexable: boolean;
  /** Default og:image from site preferences. Used as fallback for
   *  the "Add an og:image" check so per-page rows that inherit a
   *  site-wide image still count as passing. */
  defaultOgImage?: string;
}

export interface SeoAssistantTaskResult {
  task:   SeoAssistantTask;
  passed: boolean;
}

export interface SeoAssistantSummary {
  /** Failed-task counts keyed by severity. Used by the four header
   *  cards to render the count or a ✓ when zero. */
  failures: Record<SeoSeverity, number>;
  /** All passed? Lets the header surface a single celebratory state
   *  if every task is green. */
  allPassed: boolean;
}

// ─── Catalog ──────────────────────────────────────────────────────────────

/** Ordered task list — preserved in `evaluate()`'s return order so
 *  the UI can render them top-to-bottom without re-sorting. Critical
 *  first, then High, Medium, Low. */
export const SEO_ASSISTANT_TASKS: readonly SeoAssistantTask[] = [
  // ── Critical ──
  { id: 'indexable',
    labelKey: 'SEO.ASSISTANT.TASK.INDEXABLE',
    severity: 'critical' },

  // ── High ──
  { id: 'has-focus-keyword',
    labelKey: 'SEO.ASSISTANT.TASK.HAS_FOCUS_KEYWORD',
    severity: 'high' },
  { id: 'has-title-tag',
    labelKey: 'SEO.ASSISTANT.TASK.HAS_TITLE_TAG',
    severity: 'high' },
  { id: 'keyword-in-title',
    labelKey: 'SEO.ASSISTANT.TASK.KEYWORD_IN_TITLE',
    severity: 'high',
    requiresFocusKeyword: true },
  { id: 'keyword-in-h1',
    labelKey: 'SEO.ASSISTANT.TASK.KEYWORD_IN_H1',
    severity: 'high',
    requiresFocusKeyword: true,
    appliesIf: (ctx) => typeof ctx.row.h1Text === 'string' },
  { id: 'keyword-in-url',
    labelKey: 'SEO.ASSISTANT.TASK.KEYWORD_IN_URL',
    severity: 'high',
    requiresFocusKeyword: true },
  { id: 'has-meta-desc',
    labelKey: 'SEO.ASSISTANT.TASK.HAS_META_DESC',
    severity: 'high' },

  // ── Medium ──
  { id: 'keyword-in-meta-desc',
    labelKey: 'SEO.ASSISTANT.TASK.KEYWORD_IN_META_DESC',
    severity: 'medium',
    requiresFocusKeyword: true },
  { id: 'keyword-in-body',
    labelKey: 'SEO.ASSISTANT.TASK.KEYWORD_IN_BODY',
    severity: 'medium',
    requiresFocusKeyword: true,
    appliesIf: (ctx) => typeof ctx.row.bodyText === 'string' },
  { id: 'keyword-in-subheading',
    labelKey: 'SEO.ASSISTANT.TASK.KEYWORD_IN_SUBHEADING',
    severity: 'medium',
    requiresFocusKeyword: true,
    requiresBlogPost: true },
  { id: 'title-length',
    labelKey: 'SEO.ASSISTANT.TASK.TITLE_LENGTH',
    severity: 'medium' },
  { id: 'meta-length',
    labelKey: 'SEO.ASSISTANT.TASK.META_LENGTH',
    severity: 'medium' },
  { id: 'images-have-alt-text',
    labelKey: 'SEO.ASSISTANT.TASK.IMAGES_HAVE_ALT_TEXT',
    severity: 'medium',
    appliesIf: (ctx) => Array.isArray(ctx.row.images) && ctx.row.images.length > 0 },
  { id: 'has-visual-content',
    labelKey: 'SEO.ASSISTANT.TASK.HAS_VISUAL_CONTENT',
    severity: 'medium',
    // Always applies — the assistant nudges authors to add at least
    // one image / video to every page.
    appliesIf: (ctx) =>
      Array.isArray(ctx.row.images) || typeof ctx.row.videosCount === 'number' },
  { id: 'has-structured-data',
    labelKey: 'SEO.ASSISTANT.TASK.HAS_STRUCTURED_DATA',
    severity: 'medium' },
  { id: 'has-hreflang',
    labelKey: 'SEO.ASSISTANT.TASK.HAS_HREFLANG',
    severity: 'medium',
    requiresMultilingual: true },
  { id: 'has-og-image',
    labelKey: 'SEO.ASSISTANT.TASK.HAS_OG_IMAGE',
    severity: 'medium' },

  // ── Low ──
  { id: 'og-title-set',
    labelKey: 'SEO.ASSISTANT.TASK.OG_TITLE_SET',
    severity: 'low' },
  { id: 'meaningful-slug',
    labelKey: 'SEO.ASSISTANT.TASK.MEANINGFUL_SLUG',
    severity: 'low' },
];

// ─── Evaluators ───────────────────────────────────────────────────────────

/** Per-task evaluator dispatch — keyed by task id. Each function is
 *  pure and side-effect-free; the assistant calls it once per
 *  evaluation pass. */
const EVALUATORS: Record<string, (ctx: SeoAssistantContext) => boolean> = {
  'indexable': (ctx) =>
    ctx.siteIndexable && ctx.row.indexable === true,

  'has-focus-keyword': (ctx) =>
    !!ctx.row.focusKeyword?.trim(),

  'has-title-tag': (ctx) =>
    !!ctx.row.titleTag?.trim(),

  'keyword-in-title': (ctx) => {
    const kw = ctx.row.focusKeyword?.trim().toLowerCase() ?? '';
    if (!kw) return false;
    return (ctx.row.titleTag ?? '').toLowerCase().includes(kw);
  },

  'keyword-in-h1': (ctx) => {
    const kw = ctx.row.focusKeyword?.trim().toLowerCase() ?? '';
    if (!kw) return false;
    return (ctx.row.h1Text ?? '').toLowerCase().includes(kw);
  },

  'keyword-in-url': (ctx) => {
    const kw = ctx.row.focusKeyword?.trim().toLowerCase() ?? '';
    if (!kw) return false;
    // URL slugs are kebab-cased, so match both raw and dashed forms.
    const slug   = (ctx.row.pageUrl ?? '').toLowerCase();
    const dashed = kw.replace(/\s+/g, '-');
    return slug.includes(kw) || slug.includes(dashed);
  },

  'has-meta-desc': (ctx) =>
    !!ctx.row.metaDescription?.trim(),

  'keyword-in-meta-desc': (ctx) => {
    const kw = ctx.row.focusKeyword?.trim().toLowerCase() ?? '';
    if (!kw) return false;
    return (ctx.row.metaDescription ?? '').toLowerCase().includes(kw);
  },

  'keyword-in-body': (ctx) => {
    const kw = ctx.row.focusKeyword?.trim().toLowerCase() ?? '';
    if (!kw) return false;
    // Strip HTML tags so rich-editor markup doesn't dilute the match.
    const body = (ctx.row.bodyText ?? '').replace(/<[^>]*>/g, ' ').toLowerCase();
    return body.includes(kw);
  },

  'keyword-in-subheading': (ctx) => {
    const kw = ctx.row.focusKeyword?.trim().toLowerCase() ?? '';
    if (!kw) return false;
    const subs = ctx.row.subheadings ?? [];
    return subs.some(s => (s ?? '').toLowerCase().includes(kw));
  },

  'images-have-alt-text': (ctx) => {
    const imgs = ctx.row.images ?? [];
    // Vacuously true when there are no images — the task is gated by
    // appliesIf so this branch shouldn't actually be hit, but it
    // keeps the evaluator total.
    if (!imgs.length) return true;
    return imgs.every(i => !!i.altText?.trim());
  },

  'has-visual-content': (ctx) => {
    const imgCount   = (ctx.row.images ?? []).length;
    const videoCount = ctx.row.videosCount ?? 0;
    return imgCount + videoCount > 0;
  },

  'has-structured-data': (ctx) => {
    const items = ctx.row.structuredData ?? [];
    return items.some(it => !!it?.code?.trim());
  },

  'has-hreflang': (ctx) => {
    const tags = ctx.row.hreflangTags ?? [];
    // At least one hreflang plus a default — Invo auto-injects both
    // when Multilingual is enabled, so the presence of any entry is
    // the practical signal here.
    return tags.length > 0;
  },

  'title-length': (ctx) => {
    // Google truncates around 50-65 chars. Pass between 30 and 70
    // so the assistant rewards "in the safe zone" without being
    // pedantic about the exact 55-65 sweet spot.
    const n = (ctx.row.titleTag ?? '').trim().length;
    return n >= 30 && n <= 70;
  },

  'meta-length': (ctx) => {
    const n = (ctx.row.metaDescription ?? '').trim().length;
    return n >= 120 && n <= 170;
  },

  'has-og-image': (ctx) =>
    !!(ctx.row.ogImage?.trim() || ctx.defaultOgImage?.trim()),

  'og-title-set': (ctx) =>
    !!ctx.row.ogTitle?.trim(),

  'meaningful-slug': (ctx) => {
    const slug = (ctx.row.pageUrl ?? '').trim().toLowerCase();
    if (!slug || slug === '/' || slug === '/home') return true;
    // Anything that starts with /blank, /page-N, /new-page etc. is
    // an editor-default placeholder and counts as a fail.
    return !/^\/(blank|new-page|page)-?\d*$/.test(slug);
  },
};

// ─── API ──────────────────────────────────────────────────────────────────

/** Run every task evaluator and return the per-task results plus
 *  the summary used by the header tally. Tasks that require a focus
 *  keyword are skipped entirely (excluded from the results) when
 *  the row has no keyword — they'd all read as "failing" which is
 *  noise. */
export function evaluateAssistant(ctx: SeoAssistantContext): {
  results: SeoAssistantTaskResult[];
  summary: SeoAssistantSummary;
} {
  const hasKeyword = !!ctx.row.focusKeyword?.trim();

  const results: SeoAssistantTaskResult[] = [];
  for (const task of SEO_ASSISTANT_TASKS) {
    if (task.requiresFocusKeyword && !hasKeyword) continue;
    if (task.requiresBlogPost     && !ctx.row.isBlogPost)     continue;
    if (task.requiresMultilingual && !ctx.row.isMultilingual) continue;
    if (task.appliesIf            && !task.appliesIf(ctx))    continue;
    const ev = EVALUATORS[task.id];
    const passed = ev ? ev(ctx) : true;
    results.push({ task, passed });
  }

  const failures: Record<SeoSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const r of results) if (!r.passed) failures[r.task.severity]++;

  const allPassed = results.every(r => r.passed);
  return { results, summary: { failures, allPassed } };
}
