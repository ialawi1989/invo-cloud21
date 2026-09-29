import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ApiService } from '@core/http/api.service';

import { Estimate } from '../../models/estimate.model';

/**
 * Estimates API — the endpoints of the legacy `EstimateService` (same paths, verbs, payloads).
 * Reads unwrap the envelope to `data`; the save returns the raw `{success,msg,data}` body and, like
 * legacy, resolves the server's error body on HTTP failure so callers can show `msg`.
 */
@Injectable({ providedIn: 'root' })
export class EstimatesService {
  private api = inject(ApiService);
  private translate = inject(TranslateService);

  private async data<T = any>(req: ReturnType<ApiService['get']>): Promise<T> {
    return (await this.api.request(req))?.data as T;
  }

  private async envelope(req: ReturnType<ApiService['get']>): Promise<any> {
    try {
      return await this.api.request(req);
    } catch (e: any) {
      return e?.error ?? e;
    }
  }

  private get lang(): string {
    return this.translate.currentLang || this.translate.defaultLang || '';
  }

  /** Paged list: `{ list, count, pageCount, startIndex, lastIndex }`. */
  async getEstimateList(param: any): Promise<any> {
    const d = await this.data<any>(this.api.post('accounts/getEstimates/', param));
    if (!d) return { list: [], count: 0, pageCount: 0 };
    return { list: d.list, count: d.count, pageCount: d.pageCount, startIndex: d.startIndex, lastIndex: d.lastIndex };
  }

  getEstimateRaw = (id: string) => this.data(this.api.get('accounts/getEstimate/' + id));

  async getEstimate(id: string): Promise<Estimate> {
    const estimate = new Estimate();
    estimate.ParseJson(await this.getEstimateRaw(id));
    return estimate;
  }

  async getEstimateNumber(): Promise<string> {
    return (await this.data<any>(this.api.get('accounts/getEstimateNumber/')))?.estimateNumber ?? '';
  }

  saveEstimate(info: any): Promise<any> {
    info.lines.forEach((l: any) => {
      l.isNew = false;
      if (l.productId == '') l.productId = null;
    });
    return this.envelope(this.api.post('accounts/saveEstimate', info));
  }

  deleteEstimate = (id: string) => this.api.request(this.api.delete('accounts/deleteEstimate/' + id));

  sendEstimateEmail = (param: any = null) => this.api.request(this.api.post('accounts/sendEstimateEmail/', param));

  viewEstimatePdf = (id: string) =>
    this.data(this.api.get('accounts/viewEstimatePdf/' + id, this.lang ? { lang: this.lang } : undefined));
}
