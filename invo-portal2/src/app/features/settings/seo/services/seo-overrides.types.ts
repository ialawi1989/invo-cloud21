/**
 * Polymorphic per-resource SEO override — one row in the backend
 * `SeoOverrides` table. Stores the SEO fields a single product /
 * post / page / service / event has overridden away from its
 * per-type defaults.
 *
 * Identity is the `(companyId, ownerType, ownerId)` triple — the
 * backend's UNIQUE constraint. The owning resource (product, post,
 * page, …) lives in its own table; this row carries only the SEO
 * delta, kept intentionally sparse so missing fields fall back to
 * the per-type defaults stored in `SeoSettingsDocument`.
 */

export type SeoOwnerType =
  | 'product'      // Wix Stores product detail page
  | 'service'      // Wix Bookings service detail page
  | 'post'         // Wix Blog post page
  | 'page'         // Main site page
  | 'menu'         // Restaurant menu page
  | 'pageType';    // Collection / list pages keyed by SEO page-type
                   // slug (`items-list`, `services-list`, `blog-categories`, …)

/** Map a SEO page-type slug (from `SEO_PAGE_TYPES`) to the polymorphic
 *  `ownerType` the backend stores. Collection / list pages don't have
 *  a real resource id — they fall back to `pageType` with the slug as
 *  the `ownerId`, giving every list-style page one row per company. */
export function ownerTypeFromSlug(slug: string): { ownerType: SeoOwnerType; ownerIdFromSlug?: string } {
  switch (slug) {
    case 'main':              return { ownerType: 'page' };
    case 'items-detail':      return { ownerType: 'product' };
    case 'services-detail':   return { ownerType: 'service' };
    case 'blog-posts':        return { ownerType: 'post' };
    case 'restaurant-menus':  return { ownerType: 'menu' };
    // Collection / list pages — one row per (companyId, 'pageType', <slug>).
    case 'items-list':
    case 'services-list':
    case 'blog-categories':
    case 'blog-tags':
    case 'blog-archive':
      return { ownerType: 'pageType', ownerIdFromSlug: slug };
    default:
      return { ownerType: 'pageType', ownerIdFromSlug: slug };
  }
}

/** Payload shape the backend accepts on save. Fields are sparse —
 *  missing keys leave the existing value alone, while explicit
 *  empty strings clear the override (so the storefront falls
 *  through to defaults again). Aligns with `SeoPageRow` minus the
 *  display-only `pageName` / `pageUrl` columns the frontend joins
 *  in from the owner record. */
export interface SeoOverridePatch {
  focusKeyword?:    string;
  urlSlug?:         string;
  titleTag?:        string;
  metaDescription?: string;
  indexable?:       boolean;
  ogTitle?:         string;
  ogDescription?:   string;
  ogImage?:         string;
  xTitle?:          string;
  xDescription?:    string;
  xImage?:          string;
  robots?:          Record<string, unknown>;
  structuredData?:  Array<{ name: string; code: string }>;
  additionalTags?:  Array<{ name: string; value: string }>;
  hreflangTags?:    Array<{ lang: string; url: string }>;
}

/** One row returned by `POST /seoOverride/list` — the override
 *  itself plus the joined owner `name` and `url` so the Edit-by-page
 *  table can render the resource without a second round-trip. */
export interface SeoOverrideListRow extends SeoOverridePatch {
  id:        string;        // SeoOverrides.id
  ownerType: SeoOwnerType;
  ownerId:   string;
  /** Joined from the owner table — name displayed in the "Page name" column. */
  ownerName: string;
  /** Joined from the owner table — slug / canonical path for the "Page URL" column. */
  ownerUrl:  string;
}
