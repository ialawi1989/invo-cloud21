import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/http/api.service';

/**
 * Pool tip distribution. Tips themselves are only entered on the POS; the web app splits General Pool tips
 * between employees and can undo a split. Every call resolves with the whole envelope: check `success`, show
 * `msg` on failure (validation errors arrive as HTTP 200).
 */
@Injectable({ providedIn: 'root' })
export class EmployeeTipsService {
  private api = inject(ApiService);

  /** Undistributed pool tips of one branch in a date range: `{ rows, total }`. */
  getUndistributedPoolTips = (body: { branchId: string; fromDate: string; toDate: string }) =>
    this.api.request<any>(this.api.post('accounts/getUndistributedPoolTips', body));

  /** Splits the range's pool tips evenly between `employeeIds`, in order: `{ id, total }`. */
  distributePoolTips = (body: { branchId: string; fromDate: string; toDate: string; distributionDate: string; employeeIds: string[] }) =>
    this.api.request<any>(this.api.post('accounts/distributePoolTips', body));

  /** Refused once any share of the distribution has been paid out. */
  undoTipDistribution = (distributionId: string) => this.api.request<any>(this.api.delete(`accounts/undoTipDistribution/${distributionId}`));

  getTipDistributionsList = (body: { page: number; limit: number }) =>
    this.api.request<any>(this.api.post('accounts/getTipDistributionsList', body));
}
