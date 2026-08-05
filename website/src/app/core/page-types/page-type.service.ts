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

  /** `template.pageType` → legacy slug map → 'content'. */
  pageTypeFor(slug: string, template: any): string {
    const explicit = String(template?.pageType ?? '').trim();
    if (explicit) return explicit;
    return this.manifestSig().legacySlugs[slug] ?? 'content';
  }

  /** `template.source` → legacy slug map → null. */
  sourceFor(slug: string, template: any): ListingSource | null {
    const explicit = template?.source;
    if (explicit?.kind) return explicit as ListingSource;
    return this.manifestSig().legacySources[slug] ?? null;
  }

  /** Stored settings with every manifest default applied for unset keys. */
  settingsFor(pageType: string, stored: Record<string, any> | null | undefined): Record<string, any> {
    const out: Record<string, any> = { ...(stored ?? {}) };
    for (const field of this.fieldsOf(pageType)) {
      if (out[field.key] === undefined && field.default !== undefined) {
        out[field.key] = field.default;
      }
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
  resolve(slug: string, row: any | null): ResolvedPage {
    const template = row?.template ?? null;
    const pageType = this.pageTypeFor(slug, template);
    return {
      slug,
      name:     String(row?.name ?? ''),
      pageType,
      settings: this.settingsFor(pageType, template?.settings),
      source:   pageType === 'product-list' ? this.sourceFor(slug, template) : null,
      sections: Array.isArray(template?.sections) ? template.sections : [],
      missing:  !row,
    };
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
