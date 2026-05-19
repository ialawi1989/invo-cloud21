/**
 * SEO Settings — domain types.
 *
 * Models the Invo-style SEO IA: the user manages SEO meta across a
 * catalog of *page types* (Main pages, Blog posts, Blog categories,
 * Blog tags, Blog archive pages, Restaurant menus, …). Each page
 * type has:
 *   • a per-page list — per-row meta override (title, description,
 *     URL slug, indexable, social share, focus keyword)
 *   • a "Customize defaults" bundle — site-wide template applied to
 *     every page of that type when the per-page row leaves a field
 *     blank (Basics & Social, Page URL, Structured data, Robots
 *     meta, Additional meta tags)
 *
 * Persistence is intentionally one big JSON document per company so
 * the backend can save/load it the same way `WebsiteTheme` blobs
 * are stored — no schema migrations every time we add a new robots
 * directive.
 */

/** Each page-type group renders as a tile on the SEO landing.
 *  `slug` matches the `:type` route param; `icon` is an SVG-inner
 *  string the landing renders inside a 24x24 viewBox. */
export interface SeoPageType {
  slug:        string;
  labelKey:    string;        // i18n key under SEO.PAGE_TYPES.*
  descKey?:    string;
  icon:        string;        // SVG inner markup
  /** True for catalog-driven types (Main pages, Items list, Services
   *  list, …) where the backend supplies the per-page list. False
   *  for blog-only types when the storefront has no blog. */
  builtIn?:    boolean;
}

/** One row in the "Edit by page" table. Each field may be blank —
 *  the renderer falls back to `SeoCustomizeDefaults.basics` when a
 *  field is empty. Title length / description length are validated
 *  against Google's display limits in the editor side-panel. */
export interface SeoPageRow {
  id:              string;     // stable; backend-generated for built-in pages
  pageName:        string;     // "Services (List)" — read-only label
  pageUrl:         string;     // "/services"
  focusKeyword:    string;
  titleTag:        string;
  metaDescription: string;
  indexable:       boolean;
  /** Social-share overrides — when blank, falls through to defaults. */
  ogTitle?:        string;
  ogDescription?:  string;
  ogImage?:        string;
  xTitle?:         string;
  xDescription?:   string;
  xImage?:         string;
  /** Per-page robots overrides — same shape as the per-type
   *  defaults; blank means "inherit". */
  robots?:         Partial<SeoRobotsTags>;
  /** Optional per-page structured-data overrides. Each entry is a
   *  named JSON-LD blob — Invo's "Add New Markup" wizard produces one
   *  entry per call, and the renderer emits them as separate
   *  `<script type="application/ld+json">` tags. */
  structuredData?: SeoStructuredDataItem[];
  /** Additional meta tags for one page, keyed by tag name. */
  additionalTags?: SeoAdditionalTag[];

  // ── Page-content snapshots for the SEO Assistant ─────────────────
  // These mirror what's actually rendered on the storefront so the
  // assistant can evaluate H1/body/image/multilingual tasks. Each
  // field is optional — when missing, the assistant gates the
  // corresponding task off rather than reporting a false negative.

  /** Visible H1 on the page (typically the product / post / service
   *  title). Used by the "Add focus keyword to H1" check. */
  h1Text?:         string;
  /** Plain-text body content — HTML is fine; the assistant lowercases
   *  and substring-matches the focus keyword against it. */
  bodyText?:       string;
  /** H2/H3 subheadings rendered on the page. Only relevant for blog
   *  posts; gates the "keyword in subheading" task. */
  subheadings?:    string[];
  /** Images shown on the page with their alt text (if any). Drives
   *  the "alt text for all images" check. */
  images?:         { url?: string; altText?: string }[];
  /** Number of videos embedded on the page. Combined with images to
   *  decide if the page has any visual content. */
  videosCount?:    number;
  /** True for blog-post page types — enables the subheading check.
   *  Defaults to false (host has to opt-in). */
  isBlogPost?:     boolean;
  /** True when the storefront serves this page in multiple
   *  languages. Gates the hreflang task. */
  isMultilingual?: boolean;
  /** Per-language hreflang entries the storefront should emit. */
  hreflangTags?:   { lang: string; url: string }[];
}

/** One JSON-LD markup block. `name` is the human label shown in the
 *  Advanced tab list (e.g. "Organization", "BreadcrumbList") and
 *  `code` is the raw JSON-LD body. */
export interface SeoStructuredDataItem {
  name: string;
  code: string;
}

/** Basics & Social Share template applied to every page of one
 *  type. Variables like `{{ pageName }}` / `{{ siteName }}` are
 *  resolved at render time when the per-page row leaves the field
 *  blank. */
export interface SeoBasicsAndSocial {
  titleTagTemplate:    string;     // "{{ pageName }} | {{ siteName }}"
  metaDescTemplate:    string;
  indexable:           boolean;
  // Open Graph
  ogTitleTemplate:     string;
  ogDescTemplate:      string;
  ogImage:             string;     // URL
  // Twitter / X
  xCardSize:           'large' | 'small';
  xTitleTemplate:      string;
  xDescTemplate:       string;
  xImage:              string;
}

/** Page-URL behaviour for a page type. `showHierarchy` toggles
 *  whether parental paths appear in the URL; `seoFriendly404`
 *  controls whether the storefront returns a soft 404 page. */
export interface SeoPageUrl {
  showHierarchy:    boolean;
  seoFriendly404:   boolean;
  /** Free-form slug pattern, e.g. `/blog/{{ category }}/{{ slug }}`. */
  slugPattern:      string;
}

/** Robots meta-tag directives for a page type — defaults the
 *  storefront emits unless a per-page row overrides one of them. */
export interface SeoRobotsTags {
  noindex:        boolean;
  nofollow:       boolean;
  nosnippet:      boolean;
  noimageindex:   boolean;
  noarchive:      boolean;
  maxImagePreview:'none' | 'standard' | 'large';
  maxSnippet:     number;   // -1 = no limit
  maxVideoPreview:number;   // -1 = no limit
}

/** One row in the "Additional meta tags" sub-card — open-ended key /
 *  value bag with variable interpolation in the value. */
export interface SeoAdditionalTag {
  name:   string;       // og:site_name, og:type, og:url, twitter:site, …
  value:  string;
}

/** Bundle of every "Customize defaults" sub-card for one page type.
 *  The page-list rows fall back to these when their own field is
 *  blank. */
export interface SeoCustomizeDefaults {
  basics:         SeoBasicsAndSocial;
  pageUrl:        SeoPageUrl;
  /** JSON-LD template the storefront emits as a `<script type="application/ld+json">`
   *  block for every page of this type. */
  structuredData: string;
  robots:         SeoRobotsTags;
  additionalTags: SeoAdditionalTag[];
}

/** Settings for a single page type — only the customize-defaults
 *  bundle. Per-resource overrides used to live here as a `pages[]`
 *  array but now persist in the polymorphic `SeoOverrides` backend
 *  table (see `SeoOverridesService`), keyed by `(companyId,
 *  ownerType, ownerId)`. That keeps the SEO settings document tiny
 *  no matter how many products / posts / pages the tenant has. */
export interface SeoPageTypeSettings {
  type:     string;                    // matches SeoPageType.slug
  defaults: SeoCustomizeDefaults;
}

/** Site-wide preferences shown on the SEO landing page itself. */
export interface SeoSitePreferences {
  /** Master indexing toggle — when off, every page emits noindex
   *  regardless of per-type / per-page settings. The landing page
   *  surfaces this prominently because it can silently nuke an
   *  entire storefront's search visibility. */
  allowIndexing: boolean;
  /** General og:image used when a page type / row leaves ogImage
   *  blank. */
  generalOgImage: string;
}

/** Root document persisted per company. Empty/missing types fall
 *  back to `DEFAULT_SEO_CUSTOMIZE_DEFAULTS` defined in seo.config. */
export interface SeoSettingsDocument {
  sitePreferences: SeoSitePreferences;
  /** Keyed by page type slug — e.g. `mainPages`, `blogPosts`. */
  pageTypes: Record<string, SeoPageTypeSettings>;
}
