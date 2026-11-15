import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

import { BranchListParams, BranchListResult, BranchRow } from '../models/branch-payments.model';

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/**
 * Branch payments API - legacy `BranchService.getBranchList` / `getPosInvoicePayment`:
 * `POST branch/getBranches/` (InvoCloudBack `routes/v1/app/branch.ts`) and `POST accounts/getPosInvoicePayment/`
 * (`routes/v1/app/accounts.ts` -> `InvoicePaymentController.getPosInvoicePayment`).
 */
@Injectable({ providedIn: 'root' })
export class BranchPaymentsService {
  private api = inject(ApiService);

  async getBranches(params: BranchListParams = {}): Promise<BranchListResult> {
    const body = {
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      // Left out when unsorted: the backend reads `sortBy.sortValue` straight into its ORDER BY.
      ...(params.sortBy ? { sortBy: params.sortBy } : {}),
    };
    const res = await this.api.request<any>(this.api.post('branch/getBranches/', body));
    const list: BranchRow[] = (res?.data?.list ?? []).map((b: any) => ({ id: b.id, name: b.name ?? '' }));
    return { list, count: num(res?.data?.count ?? list.length), pageCount: num(res?.data?.pageCount ?? 1) || 1 };
  }

  /**
   * Asks the branch's POS (over the socket) to push its open invoices' payments to the cloud. Legacy sends only
   * `{ branchId }` (the backend then picks the branch's open invoices itself). Returns the raw `{ success, msg }` envelope.
   */
  async getPosInvoicePayment(branchId: string): Promise<{ success: boolean; msg?: string }> {
    const res = await this.api.request<any>(this.api.post('accounts/getPosInvoicePayment/', { branchId }));
    return { success: !!res?.success, msg: res?.msg };
  }
}
