import { Injectable, signal } from '@angular/core';

import { FALLBACK_MANIFEST } from './page-type.fallback';
import {
  ListingSource,
  PageTypeDef,
  PageTypeManifest,
  ResolvedPage,
  SettingField,
} from './page-type.types';

/**
 * Page-type registry client.
 *
 * Resolves a raw `WebSiteBuilder` row into a {@link ResolvedPage}: a page type,
 * a settings object with defaults filled in, and (for listings) a source.
 *
 * Why this exists: today the storefront hardcodes one component per slug and
 * reads bare string keys out of `template.settings`, so a page saved before a
 * setting existed reads `undefined`, and adding a page type means editing three
 * repos. Everything the renderer needs now comes from one manifest.
 *
 * Resolution order for a page's type — no migration required:
 *   1. `template.pageType`   (new rows)
 *   2. legacy slug → type    (every existing row)
 *   3. `content`             (anything else)
 *
 * The manifest is NOT fetched here. It is an editing catalog — every page type
 * and every setting a merchant can configure — so it lives behind dashboard
 * auth, and a shop visitor has no business enumerating it. The storefront only
 * needs setting defaults and the legacy slug maps, which ship bundled in
 * `page-type.fallback.ts`. Keep that file in step with the backend manifest.
 */
/**
 * Page setting key → the site-config key that provides its default. Mirrors the
 * `precedence: 'default'` entries of OPTION_RELOCATIONS in the backend module.
 */
const SITE_DEFAULT_KEYS: Record<string, string> = {
  product_style:      'defaultProductStyle',
  product_image_size: 'defaultProductImageFit',
  default_view:       'defaultListingView',
  page_limit:         'defaultPageLimit',
  sort_By:            'defaultSortBy',
  long_product_name:  'allowLongProductName',
};

@Injectable({ providedIn: 'root' })
export class PageTypeService {
  private manifestSig = signal<PageTypeManifest>(FALLBACK_MANIFEST);

  manifest = this.manifestSig.asReadonly();

  /** Kept as a promise so callers can `await` it without caring that the
   *  manifest is bundled rather than fetched. */
  load(): Promise<void> {
    return Promise.resolve();
  }

  typeDef(id: string): PageTypeDef | null {
    return this.manifestSig().pageTypes.find(t => t.id === id) ?? null;
  }

  /**
   * Page kind, strongest signal first:
   *   `template.pageType` → `template.templateType` → legacy slug → 'content'.
   *
   * `templateType` is the field the old dashboard stored the kind in and it
   * outranks the slug, which a merchant can rename.
   */
  pageTypeFor(slug: string, template: any): string {
    const explicit = String(template?.pageType ?? '').trim();
    if (explicit) return explicit;

    const templateType = String(template?.templateType ?? '').trim();
    const fromTemplate = templateType
      ? this.manifestSig().legacyTemplateTypes?.[templateType]
      : '';
    if (fromTemplate) return fromTemplate;

    return this.manifestSig().legacySlugs[slug] ?? 'content';
  }

  /** `template.source` → templateType map → legacy slug map → null. */
  sourceFor(slug: string, template: any): ListingSource | null {
    const explicit = template?.source;
    if (explicit?.kind) return explicit as ListingSource;

    const templateType = String(template?.templateType ?? '').trim();
    const fromTemplate = templateType
      ? this.manifestSig().legacyTemplateSources?.[templateType]
      : null;
    if (fromTemplate) return fromTemplate;

    return this.manifestSig().legacySources[slug] ?? null;
  }

  /**
   * Effective settings for a page: PAGE value → SITE default → manifest default.
   *
   * Several legacy options moved up to site config because every merchant set
   * them identically on every listing (card style, view, page size…). They stay
   * overridable per page, so the page wins when it has a value — and an
   * un-migrated page, which still carries its own copy, behaves exactly as it
   * did before anything moved.
   *
   * `siteDefaults` maps a page key to its site-config key, e.g.
   * `product_style → defaultProductStyle`.
   */
  settingsFor(
    pageType: string,
    stored: Record<string, any> | null | undefined,
    siteCommerce?: Record<string, any> | null,
  ): Record<string, any> {
    const out: Record<string, any> = { ...(stored ?? {}) };

    for (const field of this.fieldsOf(pageType)) {
      if (out[field.key] !== undefined && out[field.key] !== '') continue;

      const siteKey = SITE_DEFAULT_KEYS[field.key];
      const siteValue = siteKey ? siteCommerce?.[siteKey] : undefined;
      if (siteValue !== undefined && siteValue !== '') {
        out[field.key] = siteValue;
        continue;
      }

      if (field.default !== undefined) out[field.key] = field.default;
    }
    return out;
  }

  private fieldsOf(pageType: string): SettingField[] {
    const def = this.typeDef(pageType);
    if (!def) return [];
    return def.settings.flatMap(g => g.fields);
  }

  /**
   * Normalise a raw row (`{ name, template }` from `theme/getPage/:slug`) into
   * the shape components consume.
   */
  resolve(slug: string, row: any | null, siteCommerce?: Record<string, any> | null): ResolvedPage {
    const template = row?.template ?? null;
    const pageType = this.pageTypeFor(slug, template);
    return {
      slug,
      name:     String(row?.name ?? ''),
      pageType,
      settings: this.settingsFor(pageType, template?.settings, siteCommerce),
      source:   pageType === 'product-list' ? this.sourceFor(slug, template) : null,
      sections: Array.isArray(template?.sections) ? template.sections : [],
      missing:  !row,
      ...this.statusOf(template),
    };
  }

  /**
   * Page status, with the legacy option honoured as a FALLBACK.
   *
   * A first-time upload must behave like the old site before anyone runs a
   * migration, so a retired option keeps working until its replacement is
   * actually set: `settings.redirect_to_shop` still produces a redirect when no
   * `status` exists. Saved values are never rewritten by this — reading is
   * where compatibility is paid for, not writing.
   */
  private statusOf(template: any): { status: any; redirectTo: string } {
    const explicit = String(template?.status ?? '').trim();
    if (explicit) {
      return { status: explicit as any, redirectTo: String(template?.redirectTo ?? '') };
    }

    if (template?.settings?.redirect_to_shop === true) {
      return { status: 'redirect', redirectTo: String(template?.redirectTo ?? 'shop') };
    }

    // Absent means published — never hide a page because a field is missing.
    return { status: 'published', redirectTo: '' };
  }

  /**
   * Should a field be shown, given the current values? Mirrors the manifest's
   * `condition`, including dotted keys like `source.kind` so a source-specific
   * setting (the ONLY thing that differed between the old menu and shop pages)
   * hides itself on the wrong source.
   */
  isFieldVisible(field: SettingField, values: Record<string, any>, source?: ListingSource | null): boolean {
    const cond = field.condition;
    if (!cond) return true;
    const actual = cond.key.startsWith('source.')
      ? (source as any)?.[cond.key.slice('source.'.length)]
      : values[cond.key];
    return actual === cond.value;
  }
}
