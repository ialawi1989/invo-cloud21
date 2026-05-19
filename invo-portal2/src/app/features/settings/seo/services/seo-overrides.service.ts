import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import type {
  SeoOverrideListRow,
  SeoOverridePatch,
  SeoOwnerType,
} from './seo-overrides.types';

/**
 * SeoOverridesService
 * ───────────────────
 * Thin client for the polymorphic `/seoOverride/*` endpoints. The
 * backend stores one row per `(companyId, ownerType, ownerId)` in
 * a dedicated `SeoOverrides` table, so adding SEO to a new resource
 * type (blog posts, services, events, …) needs zero schema changes
 * here OR on the owning resource — only a new `ownerType` string.
 *
 * Per-type defaults and site preferences keep living in the small
 * `SeoSettings` document handled by `SeoSettingsService`. This
 * service only covers the *overrides* (one row per actually-edited
 * resource), which is what scales with content volume.
 */
@Injectable({ providedIn: 'root' })
export class SeoOverridesService {
  private http = inject(HttpClient);
  private base = environment.backendUrl;

  // ─── Single-resource reads ────────────────────────────────────────────
  /** Fetch the override for one resource. Returns `null` when no row
   *  exists — the storefront falls through to the per-type defaults
   *  from `SeoSettingsService.pageType(slug).defaults` in that case. */
  async getByOwner(
    ownerType: SeoOwnerType,
    ownerId:   string,
  ): Promise<SeoOverrideListRow | null> {
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${this.base}seoOverride/get`, { ownerType, ownerId }),
      );
      return res?.data ?? null;
    } catch {
      // 404 on a never-edited resource is normal — treat as no override.
      return null;
    }
  }

  // ─── Single-resource writes ───────────────────────────────────────────
  /** Upsert the override for one resource. The backend merges the
   *  patch onto the existing row (creating one when needed), so
   *  callers can send sparse patches that touch only the fields
   *  the user actually edited. */
  async save(
    ownerType: SeoOwnerType,
    ownerId:   string,
    patch:     SeoOverridePatch,
  ): Promise<SeoOverrideListRow> {
    const res = await firstValueFrom(
      this.http.post<any>(`${this.base}seoOverride/save`, {
        ownerType,
        ownerId,
        patch,
      }),
    );
    return res?.data;
  }

  /** Drop the override entirely — the resource reverts to its
   *  per-type defaults. Idempotent; missing rows resolve cleanly. */
  async remove(ownerType: SeoOwnerType, ownerId: string): Promise<void> {
    await firstValueFrom(
      this.http.post<any>(`${this.base}seoOverride/remove`, { ownerType, ownerId }),
    );
  }

  // ─── Listing for the Edit-by-page table ───────────────────────────────
  /** Paginated list of resources of a given type with their SEO
   *  data joined in. The backend joins the corresponding owner
   *  table (Products, Pages, Posts, …) so the response carries
   *  the resource name + slug ready for the table to render. */
  async list(params: {
    ownerType:   SeoOwnerType;
    page?:       number;
    limit?:      number;
    searchTerm?: string;
    sortBy?:     Record<string, 1 | -1>;
    /** Optional indexable filter — `true` = only indexable rows,
     *  `false` = only non-indexable, omit for both. Drives the
     *  filter chips on the Edit-by-page table. */
    indexable?:  boolean;
  }): Promise<{ list: SeoOverrideListRow[]; count: number }> {
    const res = await firstValueFrom(
      this.http.post<any>(`${this.base}seoOverride/list`, {
        ownerType:  params.ownerType,
        page:       params.page       ?? 1,
        limit:      params.limit      ?? 15,
        searchTerm: params.searchTerm ?? '',
        sortBy:     params.sortBy     ?? {},
        ...(params.indexable !== undefined ? { indexable: params.indexable } : {}),
      }),
    );
    const list  = Array.isArray(res?.data?.list) ? res.data.list : [];
    const count = res?.data?.count ?? list.length;
    return { list, count };
  }

  // ─── Bulk actions ─────────────────────────────────────────────────────
  /** Block / allow indexing across many resources in one round-trip.
   *  Powers the bulk-action toolbar on the Edit-by-page table (audit
   *  item 12.4). Upserts rows that don't have an override yet so the
   *  `indexable` value persists. */
  async bulkSetIndexable(
    ownerType: SeoOwnerType,
    ownerIds:  string[],
    indexable: boolean,
  ): Promise<void> {
    if (ownerIds.length === 0) return;
    await firstValueFrom(
      this.http.post<any>(`${this.base}seoOverride/bulkSetIndexable`, {
        ownerType,
        ownerIds,
        indexable,
      }),
    );
  }

  /** Bulk reset selected fields back to per-type defaults — clears
   *  the named columns on the matched override rows. Wires to audit
   *  item 12.6 (bulk reset-to-default dropdown). */
  async bulkReset(
    ownerType: SeoOwnerType,
    ownerIds:  string[],
    fields:    Array<keyof SeoOverridePatch>,
  ): Promise<void> {
    if (ownerIds.length === 0 || fields.length === 0) return;
    await firstValueFrom(
      this.http.post<any>(`${this.base}seoOverride/bulkReset`, {
        ownerType,
        ownerIds,
        fields,
      }),
    );
  }
}
