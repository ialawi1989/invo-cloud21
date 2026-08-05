import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '@core/http/api.service';

import { FALLBACK_MANIFEST } from './page-type.fallback';
import {
  ListingSource,
  PageTypeDef,
  PageTypeManifest,
  SettingField,
} from './page-type.types';

/**
 * Page-type manifest client for the dashboard.
 *
 * Replaces the hardcoded `WebsiteBuilderService.staticPageOptions` catalog: the
 * settings schema now comes from the backend, so the dashboard form, the
 * storefront renderer and the stored blob can't drift apart.
 *
 * Loads once and caches. The endpoint is additive and may not be mounted on a
 * given deployment, so a bundled fallback ships with the app: without it the
 * Pages screen would come up with no type names, an empty "Add page" menu and
 * no setting defaults, which reads as broken rather than degraded. The live
 * manifest always wins. This service never throws.
 */
@Injectable({ providedIn: 'root' })
export class PageTypeService {
  private api = inject(ApiService);

  private manifestSig = signal<PageTypeManifest>(FALLBACK_MANIFEST);
  private loaded = false;
  private inFlight: Promise<PageTypeManifest> | null = null;

  manifest = this.manifestSig.asReadonly();

  /** True while running on the bundled copy — the endpoint isn't mounted. */
  private fromFallback = signal<boolean>(true);
  usingFallback = this.fromFallback.asReadonly();

  async load(): Promise<PageTypeManifest> {
    if (this.loaded) return this.manifestSig();
    return (this.inFlight ??= this.doLoad());
  }

  private async doLoad(): Promise<PageTypeManifest> {
    try {
      const res = await this.api.request<any>(this.api.get('website/pageTypes'));
      const data = res?.data ?? null;
      if (data?.pageTypes?.length) {
        this.manifestSig.set(data as PageTypeManifest);
        this.fromFallback.set(false);
      }
    } catch {
      // Endpoint not mounted yet — the bundled manifest carries the screen.
      // See the backend module README for the one line that mounts it.
    } finally {
      this.loaded = true;
      this.inFlight = null;
    }
    return this.manifestSig();
  }

  types(): PageTypeDef[] {
    return this.manifestSig().pageTypes ?? [];
  }

  typeDef(id: string): PageTypeDef | null {
    return this.types().find(t => t.id === id) ?? null;
  }

  /** Page types a merchant may add more than one of. */
  multiTypes(): PageTypeDef[] {
    return this.types().filter(t => t.multiple);
  }

  /** Flat field list for a type, in group order. */
  fieldsOf(pageTypeId: string): SettingField[] {
    return (this.typeDef(pageTypeId)?.settings ?? []).flatMap(g => g.fields);
  }

  /** Stored settings with manifest defaults applied — what the form binds to. */
  withDefaults(pageTypeId: string, stored: Record<string, any> | null | undefined): Record<string, any> {
    const out: Record<string, any> = { ...(stored ?? {}) };
    for (const f of this.fieldsOf(pageTypeId)) {
      if (out[f.key] === undefined && f.default !== undefined) out[f.key] = f.default;
    }
    return out;
  }

  /**
   * `template.templateType` → page type. This is the field the OLD dashboard
   * recorded the page kind in, and it outranks the slug: a merchant can rename
   * a URL, but the template type stays. Returns '' when unknown so callers can
   * fall through to the slug.
   */
  pageTypeForTemplateType(templateType: string): string {
    if (!templateType) return '';
    return this.manifestSig().legacyTemplateTypes?.[templateType] ?? '';
  }

  sourceForTemplateType(templateType: string): ListingSource | null {
    if (!templateType) return null;
    return this.manifestSig().legacyTemplateSources?.[templateType] ?? null;
  }

  /**
   * Dynamic pages are the ones with a canvas — that is exactly `content`.
   * Every other type is a system page configured through settings, so the old
   * `isStatic` flag is redundant once a page carries its type.
   */
  isDynamic(pageType: string): boolean {
    return pageType === 'content';
  }

  /** Legacy slug → page type, for rows saved before `pageType` existed. */
  pageTypeForSlug(slug: string): string {
    return this.manifestSig().legacySlugs?.[slug] ?? 'content';
  }

  sourceForSlug(slug: string): ListingSource | null {
    return this.manifestSig().legacySources?.[slug] ?? null;
  }

  /**
   * Field visibility, honouring the manifest's `condition` — including dotted
   * `source.kind` keys, which is how one product-list form shows the menu-only
   * or catalog-only toggles without two separate schemas.
   */
  isVisible(field: SettingField, values: Record<string, any>, source?: ListingSource | null): boolean {
    const cond = field.condition;
    if (!cond) return true;
    const actual = cond.key.startsWith('source.')
      ? (source as any)?.[cond.key.slice('source.'.length)]
      : values[cond.key];
    return actual === cond.value;
  }
}
