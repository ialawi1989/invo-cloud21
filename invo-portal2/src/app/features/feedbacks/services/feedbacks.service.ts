import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

import { Feedback, FeedbackListParams, FeedbackListResult, FeedbackSettings } from '../models/feedback.model';

/**
 * Feedbacks API - the `company/*Feedback*` endpoints of the legacy `FeedbacksService`
 * (InvoCloudBack `routes/v1/app/company.ts` -> `FeedbackController` -> `FeedBackRepo`), same paths, verbs and payloads.
 */
@Injectable({ providedIn: 'root' })
export class FeedbacksService {
  private api = inject(ApiService);

  async getList(params: FeedbackListParams): Promise<FeedbackListResult> {
    const res = await this.api.request<any>(this.api.post('company/getFeedbackList', params));
    if (!res?.success) return { list: [], hasNext: false };
    const d: any = res.data ?? {};
    const list: Feedback[] = (d.list ?? []).map((item: any) => ({
      ...item,
      customerPhone: item.customerContact || '',
      transactionId: item.transactionId || null,
      transactionNumber: item.transactionNumber || null,
    }));
    // The backend answers `has_next` (snake case); the legacy screen read `hasNext`, which never matched.
    return { list, hasNext: !!(d.has_next ?? d.hasNext) };
  }

  /** `null` when the company never saved any. */
  async getSettings(): Promise<Partial<FeedbackSettings> | null> {
    const res = await this.api.request<any>(this.api.get('company/getFeedbackSettings'));
    return res?.success ? (res.data?.feedbackSettings ?? null) : null;
  }

  /** Returns the raw `{ success, msg, data }` envelope. */
  saveSettings(feedbackSettings: FeedbackSettings): Promise<any> {
    return this.api.request<any>(this.api.post('company/setFeedbackSettings', { feedbackSettings }));
  }
}
