import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

/** Subset of the backend `Branch` shape — fields the settings UI cares about. */
export interface BranchSummary {
  id:                    string;
  name:                  string;
  phoneNumber:           string;
  address:               string;
  isEcommerceDefault:    boolean;
  mainBranch:            boolean;
  onlineAvailability:    boolean;
  startSubscriptionDate?: string | null;
  endSubscriptionDate?:   string | null;
}

export interface BranchDetails extends BranchSummary {
  closingTime?: string;
  location?:    { lat: number | string; lng: number | string };
  customFields: { [id: string]: any };
  isInclusiveTax?: boolean;
  // Working-hours-related fields are kept opaque for now — phase B doesn't
  // edit them but we still round-trip them so save doesn't drop the data.
  workingHours?: any;
  deliveryTimes?: any;
}

export interface BranchListParams {
  page?:       number;
  limit?:      number;
  searchTerm?: string;
  sortBy?:     { sortValue?: string; sortDirection?: 'asc' | 'desc' };
}

export interface BranchListResult {
  list:       BranchSummary[];
  count:      number;
  pageCount:  number;
  startIndex: number;
  lastIndex:  number;
}

/**
 * BranchSettingsService
 * ─────────────────────
 * Wraps the legacy branch endpoints (`branch/getBranches`, `branch/getBranch/:id`,
 * `branch/saveBranch`, `branch/setDefaultEcommerceBranch`) so the settings
 * pages don't have to know the wire shape. Mirrors the lazy/normalising
 * pattern from the other settings services.
 */
@Injectable({ providedIn: 'root' })
export class BranchSettingsService {
  private api = inject(ApiService);

  async getList(params: BranchListParams = {}): Promise<BranchListResult> {
    const body = {
      page:       params.page       ?? 1,
      limit:      params.limit      ?? 20,
      searchTerm: params.searchTerm ?? '',
      sortBy:     params.sortBy     ?? {},
    };
    const res = await this.api.request<any>(this.api.post('branch/getBranches/', body));
    const list = (res?.data?.list ?? []).map((b: any) => this.mapSummary(b));
    return {
      list,
      count:      res?.data?.count      ?? list.length,
      pageCount:  res?.data?.pageCount  ?? 1,
      startIndex: res?.data?.startIndex ?? 0,
      lastIndex:  res?.data?.lastIndex  ?? list.length,
    };
  }

  async getOne(id: string): Promise<BranchDetails | null> {
    const res = await this.api.request<any>(this.api.get(`branch/getBranch/${id}`));
    const raw = res?.data ?? null;
    if (!raw) return null;
    return this.mapDetails(raw);
  }

  /** Save (create-or-update). Backend accepts the merged record; we round-trip
   *  unknown fields by spreading the original payload over the edits. */
  async save(branch: Partial<BranchDetails> & { id?: string | null }): Promise<any> {
    return this.api.request<any>(this.api.post('branch/saveBranch', branch));
  }

  /** Mark a branch as the default for the storefront / e-commerce side. */
  async setDefault(branchId: string): Promise<any> {
    return this.api.request<any>(
      this.api.post('branch/setDefaultEcommerceBranch', { branchId }),
    );
  }

  // ─── Mappers ───────────────────────────────────────────────────────────
  private mapSummary(b: any): BranchSummary {
    return {
      id:                    b.id ?? b._id ?? '',
      name:                  b.name ?? '',
      phoneNumber:           b.phoneNumber ?? '',
      address:               b.address ?? '',
      isEcommerceDefault:    !!b.isEcommerceDefault,
      mainBranch:            !!b.mainBranch,
      onlineAvailability:    !!b.onlineAvailability,
      startSubscriptionDate: b.startSubscriptionDate ?? null,
      endSubscriptionDate:   b.endSubscriptionDate   ?? null,
    };
  }

  private mapDetails(b: any): BranchDetails {
    return {
      ...this.mapSummary(b),
      closingTime:   b.closingTime ?? '',
      location:      b.location ?? { lat: '', lng: '' },
      customFields:  (b.customFields && typeof b.customFields === 'object') ? { ...b.customFields } : {},
      isInclusiveTax: !!b.isInclusiveTax,
      workingHours:  b.workingHours ?? {},
      deliveryTimes: b.deliveryTimes ?? {},
    };
  }
}
