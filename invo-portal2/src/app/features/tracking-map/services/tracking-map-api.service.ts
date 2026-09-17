import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';
import { RawDriverRow } from './tracking-map.types';
import { RawBranch } from './branch-mapper';

/**
 * REST calls for the Tracking Map feature. Endpoints verified directly
 * against InvoCloudBack (`feature/new-project`):
 *   - `GET getDriverList/:branchId` → `DriverRepo.getDriverList`
 *   - `POST branch/getBranches/`    → same endpoint `BranchSettingsService` uses
 */
@Injectable({ providedIn: 'root' })
export class TrackingMapApiService {
  private api = inject(ApiService);

  /** The response envelope's field is `msg`, not `message` — see `ApiResponse`. */
  async getDriverList(branchId: string): Promise<RawDriverRow[]> {
    const res = await this.api.request<RawDriverRow[] | { list?: RawDriverRow[] }>(
      this.api.get(`getDriverList/${branchId}`),
    );
    const data = res?.data;
    if (Array.isArray(data)) return data;
    if (data && Array.isArray((data as any).list)) return (data as any).list;
    return [];
  }

  /** Large limit mirrors the legacy `getBranchList({ limit: 1000 })` call — every branch, one page. */
  async getBranches(): Promise<RawBranch[]> {
    const res = await this.api.request<{ list?: RawBranch[] }>(
      this.api.post('branch/getBranches/', { page: 1, limit: 1000, searchTerm: '', sortBy: {} }),
    );
    return res?.data?.list ?? [];
  }
}
