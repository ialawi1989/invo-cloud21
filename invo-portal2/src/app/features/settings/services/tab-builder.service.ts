import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { TabTemplate, normaliseTemplates } from '@shared/components/tab-builder/tab-builder.types';

/**
 * Wraps the company-customization endpoints for the `tabBuilder` key
 * (type = 'product'). The stored shape is `{ templates: TabTemplate[] }`
 * — templates only, no values. Per-product values live on `Product.tabBuilder`.
 *
 * There is no dedicated FE `Customization` class — tabBuilder is opaque JSON
 * so we call the generic customization endpoints directly (same pattern as
 * `ProductListService.getCustomFields`).
 *
 * ── Save protocol (mirrors backend `CustomizationRepo`) ───────────────────
 *   1. GET  `company/getCustomizationByType/:type`  → returns `{ id | null }`.
 *   2. POST `company/saveCustomizations` with body:
 *          {
 *            data: { id, type, settings: { [key]: payload } },
 *            key
 *          }
 *      The backend inserts a new row when `id` is null/empty, otherwise
 *      runs a `jsonb_set` on the existing row for the given key.
 */
@Injectable({ providedIn: 'root' })
export class TabBuilderSettingsService {
  private api = inject(ApiService);

  private static readonly TYPE = 'product';
  private static readonly KEY  = 'tabBuilder';

  /**
   * Cached CustomizationSettings row id for `type=product`. Populated the
   * first time `getTemplates()` runs and every time a fresh save returns a
   * new id. Using a cache keeps repeated saves idempotent on a single row
   * — without it, each save races to resolve the id and may end up
   * inserting a duplicate row when the previous insert hasn't committed
   * (or when the id lookup silently fails).
   */
  private customizationId: string | null = null;

  /** In-flight save promise so rapid button-clicks don't trigger parallel inserts. */
  private savePromise: Promise<void> | null = null;

  /**
   * Fetch the company-wide templates. Returns `[]` if none is set yet.
   * Also captures the CustomizationSettings row id from the same response
   * so saves can target the existing row instead of inserting a new one.
   *
   * Backend `getCustomizationByKey` falls back to
   * `Companies.productOptions.tabBuilder` when no CustomizationSettings row
   * exists, so the returned `id` is only populated for real row hits.
   */
  async getTemplates(): Promise<TabTemplate[]> {
    try {
      const res = await this.api.request<any>(
        this.api.get(`company/getCustomizationByKey/${TabBuilderSettingsService.TYPE}/${TabBuilderSettingsService.KEY}`)
      );
      const data = res?.data ?? {};
      // Persist the row id so the next save targets the same record.
      this.customizationId = data?.id ?? null;
      // Backend returns `{ id, tabBuilder: <jsonb> }`. Accept a few legacy shapes too.
      const raw = data?.[TabBuilderSettingsService.KEY] ?? data?.tabBuilder ?? data?.value ?? data;
      return normaliseTemplates(raw);
    } catch (e) {
      console.error('[tab-builder] getTemplates failed', e);
      return [];
    }
  }

  /**
   * Upsert the templates array. Serialises concurrent calls (returns the
   * same in-flight promise) so a double-clicked Save can't fire two
   * parallel inserts.
   */
  async saveTemplates(templates: TabTemplate[]): Promise<void> {
    if (this.savePromise) return this.savePromise;
    this.savePromise = this.doSave(templates)
      .finally(() => { this.savePromise = null; });
    return this.savePromise;
  }

  private async doSave(templates: TabTemplate[]): Promise<void> {
    const payload = { templates: templates.map(t => this.sanitiseTemplate(t)) };
    const res = await this.api.request<any>(this.api.post('company/saveCustomizations', {
      data: {
        id: this.customizationId,
        type: TabBuilderSettingsService.TYPE,
        settings: { [TabBuilderSettingsService.KEY]: payload },
      },
      key: TabBuilderSettingsService.KEY,
    }));

    // Backend returns the row id — capture it so subsequent saves hit the
    // edit path instead of inserting again.
    const newId = res?.data?.id ?? null;
    if (newId) this.customizationId = newId;
  }

  /**
   * Drop rows that the user added but never filled. Keeps the template
   * itself (a named-but-empty template is intentional — the user may come
   * back to populate it), but removes half-entered child rows so they
   * don't round-trip and confuse the UI.
   */
  private sanitiseTemplate(tpl: TabTemplate): TabTemplate {
    const out: TabTemplate = { ...tpl };

    if (Array.isArray(out.specFields)) {
      out.specFields = out.specFields
        .filter(f => (f.label ?? '').trim() !== '')
        .map(f => ({
          ...f,
          label: f.label.trim(),
          abbr:  (f.abbr ?? '').trim(),
          options: Array.isArray(f.options)
            ? f.options.map(o => o.trim()).filter(Boolean)
            : undefined,
        }));
    }

    if (Array.isArray(out.recordFields)) {
      out.recordFields = out.recordFields
        .filter(f => (f.label ?? '').trim() !== '')
        .map(f => ({
          ...f,
          label: f.label.trim(),
          abbr:  (f.abbr ?? '').trim(),
          options: Array.isArray(f.options)
            ? f.options.map(o => o.trim()).filter(Boolean)
            : undefined,
        }));
    }

    if (Array.isArray(out.faqFields)) {
      out.faqFields = out.faqFields
        .filter(f => (f.question ?? '').trim() !== '')
        .map(f => ({ ...f, question: f.question.trim() }));
    }

    return out;
  }
}
