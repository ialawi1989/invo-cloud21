import { inject, Injectable } from '@angular/core';
import { ApiService } from '@core/http';
import {
  PrintElement,
  ReceiptTemplate,
  ReceiptTemplateListPage,
  ReceiptTemplateListParams,
  ReceiptTemplateSummary,
  TemplateType,
} from './receipt-builder.types';

/**
 * Wraps the legacy receipt-builder endpoints. Same wire shape as the
 * old builder so existing templates load here without migration:
 *
 *   POST   company/getRecieptTemplates
 *   GET    company/getRecieptTemplate/:id
 *   POST   company/saveRecieptTemplate
 *   GET    company/deleteRecieptTemplate/:id   (yes, GET — legacy)
 */
@Injectable({ providedIn: 'root' })
export class ReceiptBuilderService {
  private api = inject(ApiService);

  // ─── List ────────────────────────────────────────────────────────────
  async getList(params: ReceiptTemplateListParams = {}): Promise<ReceiptTemplateListPage> {
    const body = {
      page:          params.page  ?? 1,
      limit:         params.limit ?? 20,
      searchTerm:    params.searchTerm ?? '',
      sortBy:        params.sortBy ?? null,
    };
    const res = await this.api.request<any>(this.api.post('company/getRecieptTemplates', body));
    const raw = res?.data ?? res;
    const list: any[] = Array.isArray(raw?.list) ? raw.list : Array.isArray(raw) ? raw : [];
    return {
      list: list.map((t): ReceiptTemplateSummary => ({
        id:            String(t?.id ?? ''),
        name:          String(t?.name ?? ''),
        templateType:  normaliseTemplateType(t?.templateType),
        updatedDate:   t?.updatedDate ? String(t.updatedDate) : undefined,
        // Prefer the server-side `elementsCount` (computed via
        // `jsonb_array_length` so the wire stays small); fall back to
        // counting the inline array for older builds that still ship
        // the whole `recieptTemplate` blob.
        elementsCount: typeof t?.elementsCount === 'number'
          ? t.elementsCount
          : (Array.isArray(t?.recieptTemplate) ? t.recieptTemplate.length : 0),
      })),
      total:     int(raw?.count     ?? raw?.total     ?? list.length, list.length),
      pageCount: int(raw?.pageCount ?? Math.ceil(list.length / (params.limit ?? 20)), 1),
    };
  }

  // ─── Single read ────────────────────────────────────────────────────
  async getById(id: string): Promise<ReceiptTemplate | null> {
    const res = await this.api.request<any>(this.api.get(`company/getRecieptTemplate/${id}`));
    const raw = res?.data ?? res;
    if (!raw) return null;
    return this.parseTemplate(raw);
  }

  // ─── Save (create or update) ────────────────────────────────────────
  async save(template: ReceiptTemplate): Promise<{ success: boolean; data?: ReceiptTemplate | null }> {
    const payload = this.serialiseTemplate(template);
    const res = await this.api.request<any>(this.api.post('company/saveRecieptTemplate', payload));
    return {
      success: res?.success !== false,
      data:    res?.data ? this.parseTemplate(res.data) : null,
    };
  }

  // ─── Delete ─────────────────────────────────────────────────────────
  // Legacy uses GET for the delete; preserved here so existing
  // server-side route handlers still match.
  async deleteTemplate(id: string): Promise<boolean> {
    const res = await this.api.request<any>(this.api.get(`company/deleteRecieptTemplate/${id}`));
    return res?.success !== false;
  }

  // ─── Wire ↔ model ───────────────────────────────────────────────────
  private parseTemplate(raw: any): ReceiptTemplate {
    return {
      id:              String(raw?.id ?? ''),
      companyId:       String(raw?.companyId ?? ''),
      name:            String(raw?.name ?? ''),
      templateType:    normaliseTemplateType(raw?.templateType),
      recieptTemplate: Array.isArray(raw?.recieptTemplate)
        ? raw.recieptTemplate.map((e: any) => ({ ...e, type: e?.type } as PrintElement))
        : [],
      updatedDate:     raw?.updatedDate ? String(raw.updatedDate) : undefined,
    };
  }

  private serialiseTemplate(t: ReceiptTemplate): Record<string, unknown> {
    return {
      id:              t.id || null,
      companyId:       t.companyId,
      name:            t.name,
      templateType:    t.templateType,
      recieptTemplate: t.recieptTemplate,
    };
  }
}

function normaliseTemplateType(v: unknown): TemplateType {
  return v === 'kitchen' ? 'kitchen' : 'recieptType';
}

function int(v: unknown, fb: number): number {
  if (v == null || v === '') return fb;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fb;
}
