import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '@core/http/api.service';

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
 * Loads once and caches. If the endpoint isn't mounted yet the manifest is
 * empty and callers should fall back to their existing behaviour — this service
 * never throws.
 */
@Injectable({ providedIn: 'root' })
export class PageTypeService {
  private api = inject(ApiService);

  private manifestSig = signal<PageTypeManifest | null>(null);
  private inFlight: Promise<PageTypeManifest | null> | null = null;

  manifest = this.manifestSig.asReadonly();

  async load(): Promise<PageTypeManifest | null> {
    if (this.manifestSig()) return this.manifestSig();
    return (this.inFlight ??= this.doLoad());
  }

  private async doLoad(): Promise<PageTypeManifest | null> {
    try {
      const res = await this.api.request<any>(this.api.get('website/pageTypes'));
      const data = res?.data ?? null;
      if (data?.pageTypes?.length) this.manifestSig.set(data as PageTypeManifest);
    } catch {
      // Endpoint not mounted yet — see the backend module README.
    } finally {
      this.inFlight = null;
    }
    return this.manifestSig();
  }

  types(): PageTypeDef[] {
    return this.manifestSig()?.pageTypes ?? [];
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

  /** Legacy slug → page type, for rows saved before `pageType` existed. */
  pageTypeForSlug(slug: string): string {
    return this.manifestSig()?.legacySlugs?.[slug] ?? 'content';
  }

  sourceForSlug(slug: string): ListingSource | null {
    return this.manifestSig()?.legacySources?.[slug] ?? null;
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
