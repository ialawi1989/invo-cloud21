import { inject, Injectable } from '@angular/core';
import { ApiService } from '@core/http';
import {
  LabelTemplate,
  LabelTemplateSummary,
  LabelTemplateType,
} from './label-template.types';

/**
 * Wraps the legacy label-template endpoints from the old back-end —
 * routes are unchanged so existing rows persisted by InvoCloudFront2
 * load identically here.
 *
 *   POST company/getLabelTemplates             → list
 *   GET  company/getLabelTemplate/:id          → single read
 *   POST company/saveLabelTemplate             → upsert
 *   GET  company/deleteLabelTemplate/:id       → delete
 *
 * The wire format is the full `LabelTemplate` (scalar fields at the
 * top, `template[]` carrying the element JSONs). `parseTemplate()`
 * rehydrates the element subclasses on read; `toJSON()` strips
 * transient flags before save.
 */
@Injectable({ providedIn: 'root' })
export class LabelBuilderService {
  private api = inject(ApiService);

  /** List saved templates, paginated. Returns `{ list, total }` so
   *  the page can render a pager. The legacy endpoint shipped a bare
   *  array — when that shape comes back the response is treated as
   *  one full page (total = list.length) so the UI degrades safely. */
  async getList(opts: { page?: number; limit?: number; search?: string; type?: LabelTemplateType } = {}): Promise<{ list: LabelTemplateSummary[]; total: number }> {
    const body = {
      page:       opts.page  ?? 1,
      limit:      opts.limit ?? 15,
      searchTerm: opts.search ?? '',
      sortBy:     {},
      ...(opts.type ? { templateType: opts.type } : {}),
    };
    const res = await this.api.request<any>(
      this.api.post('company/getLabelTemplates', body),
    );
    const raw = res?.data ?? res;
    const list: any[] = Array.isArray(raw?.list) ? raw.list : Array.isArray(raw) ? raw : [];
    const total: number = Number(raw?.count ?? raw?.total ?? list.length) || 0;
    const mapped = list.map((t): LabelTemplateSummary => ({
      id:           String(t?.id ?? ''),
      name:         String(t?.name ?? ''),
      templateType: (t?.templateType ?? '') as LabelTemplateType | '',
      labelHeight:  Number(t?.labelHeight ?? 0.75),
      labelWidth:   Number(t?.labelWidth  ?? 1.75),
      dpi:          Number(t?.dpi ?? 203),
      updatedDate:  t?.updatedDate ? String(t.updatedDate) : undefined,
      // Pick up the inline element array from the new list shape.
      // Optional — the page falls back to `getById` per row when the
      // backend hasn't been upgraded yet.
      template:     Array.isArray(t?.template) ? t.template : undefined,
    }));
    return { list: mapped, total };
  }

  /** Get a single template by id. Returns `null` when the endpoint
   *  replies with no row — used for the "new template" flow where
   *  the route param is `0`. */
  async getById(id: string): Promise<LabelTemplate | null> {
    const res = await this.api.request<any>(
      this.api.get(`company/getLabelTemplate/${id}`),
    );
    if (!res?.success) return null;
    const raw = res?.data;
    if (!raw || typeof raw !== 'object') return null;
    const tpl = new LabelTemplate();
    tpl.ParseJson(raw);
    return tpl;
  }

  /** Create or update a template. New rows omit `id` (or send it
   *  empty); the server inserts and replies with `{ id }`. */
  async save(t: LabelTemplate): Promise<{ id: string } | null> {
    const body = t.toJSON();
    const res = await this.api.request<any>(
      this.api.post('company/saveLabelTemplate', body),
    );
    if (!res?.success) return null;
    const newId = res?.data?.id ?? t.id;
    return newId ? { id: String(newId) } : null;
  }

  /** Delete a template. Backend returns a success flag — caller can
   *  toast on failure. */
  async delete(id: string): Promise<boolean> {
    const res = await this.api.request<any>(
      this.api.get(`company/deleteLabelTemplate/${id}`),
    );
    return !!res?.success;
  }
}
