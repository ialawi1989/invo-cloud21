import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../../models/report.model';

/** Everything the Sales Summary page shows (each card loads on its own; a failed card is just empty). */
export interface SalesSummaryData {
  stats: any;
  categories: any[];
  services: any[];
  taxes: any[];
  discounts: any[];
  payments: any[];
}

/**
 * Sales Summary data — the same six calls as the legacy page (`accounts/reports/summary/*`, verified against
 * InvoCloudBack `routes/v1/app/reports/reports.ts`). Note there is no `salesSummary` DATA route: that name only
 * exists as an export route, which is why the page could not load through the generic report shell.
 */
@Injectable({ providedIn: 'root' })
export class SalesSummaryService {
  private api = inject(ApiService);

  private async post<T>(route: string, filter: ReportApiFilter): Promise<T> {
    const res = await this.api.request<any>(this.api.post(`accounts/reports/${route}`, { filter }));
    return (res?.data ?? res ?? {}) as T;
  }

  /** Only the headline figures are required; a failing table card must not blank the page. */
  async load(f: ReportApiFilter): Promise<SalesSummaryData> {
    // Same shape the legacy filter converter sends (no comparison, page 1).
    const filter: ReportApiFilter = { page: 1, allowComparison: false, periodQty: 1, ...f };
    const [stats, categories, services, taxes, discounts, payments] = await Promise.allSettled([
      this.post<any>('summary/static', filter),
      this.post<any>('summary/getSalesByCategory', filter),
      this.post<any>('summary/getSalesByServices', filter),
      this.post<any>('summary/taxDetails', filter),
      this.post<any>('summary/discount', filter),
      this.post<any>('summary/paymentReceived', filter),
    ]);
    if (stats.status === 'rejected') throw stats.reason;
    const list = (r: PromiseSettledResult<any>): any[] => (r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []);
    return {
      stats: stats.value ?? {},
      categories: list(categories), services: list(services), taxes: list(taxes),
      discounts: list(discounts), payments: list(payments),
    };
  }
}
