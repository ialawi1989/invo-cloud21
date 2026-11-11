import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/http/api.service';
import { EmployeePayoutPayload } from '../models/employee-earnings.types';

/**
 * Employee payouts: one payout pays an employee's earned commission and tips (`accounts/*EmployeePayout*`).
 *
 * Every call resolves with the whole API envelope. Validation failures come back as HTTP 200 with
 * `success: false` and a readable `msg`, so callers check `success` and show `msg`.
 */
@Injectable({ providedIn: 'root' })
export class EmployeePayoutService {
  private api = inject(ApiService);

  /** Everything the employee can be paid right now: `{ periodEnd, records }`. */
  getEmployeePayables = (employeeId: string) => this.api.request<any>(this.api.get(`accounts/getEmployeePayables/${employeeId}`));

  /** Create a payout, or replace all lines of an existing one when `id` is set. Resolves `{ data: { id } }` on success. */
  saveEmployeePayout = (payout: EmployeePayoutPayload) => this.api.request<any>(this.api.post('accounts/saveEmployeePayout', payout));

  getEmployeePayout = (payoutId: string) => this.api.request<any>(this.api.get(`accounts/getEmployeePayout/${payoutId}`));

  /** `page` and `limit` belong at the top level of the body, not inside `filter`. */
  getEmployeePayoutsList = (body: { filter: { employeeId?: string | null }; page: number; limit: number }) =>
    this.api.request<any>(this.api.post('accounts/getEmployeePayoutsList', body));

  /** Deletes the payout and its journal; the items it paid become payable again. */
  deleteEmployeePayout = (payoutId: string) => this.api.request<any>(this.api.delete(`accounts/deleteEmployeePayout/${payoutId}`));
}
