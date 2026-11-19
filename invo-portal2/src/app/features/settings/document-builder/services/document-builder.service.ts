import { inject, Injectable } from '@angular/core';
import { ApiService } from '@core/http';
import {
  DocumentTemplate,
  DocumentTemplateSummary,
  DocumentType,
  RenderMode,
  parseTemplate,
  serializeTemplate,
} from './document-template.types';

/**
 * Wraps the document-template endpoints. New routes (mounted under
 * the `company` base path) — distinct from the legacy
 * `CustomizationSettings` endpoints which now only handle
 * non-document customisations (productOptions, branchOptions, …):
 *
 *   POST   company/document-templates/list                → list (paginated)
 *   GET    company/document-templates/:id                 → single read
 *   POST   company/document-templates/save                → upsert
 *   DELETE company/document-templates/:id                 → delete
 *   POST   company/document-templates/:id/default         → set default
 *   GET    company/document-templates/default/:type       → fetch the default
 *
 * The wire format mirrors the `DocumentTemplate` shape: scalar
 * columns (`templateName`, `renderMode`, `isDefault`, `type`) live
 * at the top level; everything else (header / footer / table /
 * total / designerElements / additionalData / …) goes in the
 * `template` JSONB column. The `parseTemplate()` / `serializeTemplate()`
 * helpers handle the conversion in both directions.
 */
/**
 * The API's `type` column uses a different vocabulary from the route slugs (`credit-note` is stored as `creditNote`, ...) —
 * the same map the legacy `DOCUMENT_TEMPLATE_TYPE` is. Every call to the template endpoints goes through it, and every
 * `type` the server returns goes back through `fromApiType`, so existing rows are found and new ones are written as legacy does.
 */
const API_TYPE: Record<DocumentType, string> = {
  'invoice': 'invoice',
  'estimate': 'estimate',
  'credit-note': 'creditNote',
  'purchase-order': 'purchaseOrder',
  'bill': 'bill',
  'expense': 'expense',
  'supplier-credit': 'supplierCredit',
};
const toApiType = (t: DocumentType): string => API_TYPE[t] ?? t;
const fromApiType = (v: unknown, fallback: DocumentType): DocumentType => {
  const s = String(v ?? '');
  const hit = (Object.keys(API_TYPE) as DocumentType[]).find((k) => API_TYPE[k] === s || k === s);
  return hit ?? fallback;
};

@Injectable({ providedIn: 'root' })
export class DocumentBuilderService {
  private api = inject(ApiService);

  /** List every saved template for a document type. Paginated on the
   *  server (default 15 / page); we currently fetch the first
   *  page since the list view doesn't paginate yet — bump the limit
   *  if/when we need to scroll past 15. */
  async getList(
    type: DocumentType,
    opts: { page?: number; limit?: number; search?: string } = {},
  ): Promise<DocumentTemplateSummary[]> {
    const body = {
      type: toApiType(type),
      page:   opts.page  ?? 1,
      limit:  opts.limit ?? 100,
      search: opts.search ?? '',
    };
    const res = await this.api.request<any>(
      this.api.post('company/document-templates/list', body),
    );
    const raw = res?.data ?? res;
    const list: any[] = Array.isArray(raw?.list) ? raw.list : Array.isArray(raw) ? raw : [];
    return list.map((t): DocumentTemplateSummary => ({
      id:           String(t?.id ?? ''),
      // The backend returns `templateName` and `type`; we keep the
      // frontend's friendlier names (`name` / `documentType`) so
      // existing code doesn't have to change.
      name:         String(t?.templateName ?? t?.name ?? ''),
      documentType: fromApiType(t?.type ?? t?.documentType, type),
      renderMode:   (t?.renderMode === 'designer' ? 'designer' : 'classic') as RenderMode,
      isDefault:    !!t?.isDefault,
      updatedDate:  t?.updatedDate ? String(t.updatedDate) : undefined,
    }));
  }

  /** Get a single template by its server id. Returns `null` when the
   *  endpoint replies with no data (used for the "new template"
   *  initial flow). */
  async getById(type: DocumentType, id: string): Promise<DocumentTemplate | null> {
    const res = await this.api.request<any>(
      this.api.get(`company/document-templates/${id}`),
    );
    const raw = res?.data ?? res;
    if (!raw || typeof raw !== 'object') return null;
    // The backend returns the row with `template` (JSONB) holding
    // the structural blob plus scalar columns at the top. Merge
    // them so `parseTemplate` sees one flat shape.
    const flat = {
      ...(raw.template && typeof raw.template === 'object' ? raw.template : {}),
      id:           raw.id,
      templateName: raw.templateName ?? '',
      documentType: fromApiType(raw.type, type),
      renderMode:   raw.renderMode ?? 'classic',
      isDefault:    !!raw.isDefault,
    };
    return parseTemplate(flat, type);
  }

  /** Create or update a template. New rows omit `id`; the server
   *  inserts and replies with the new id. The full `template` JSONB
   *  goes alongside the scalar columns. */
  async save(t: DocumentTemplate): Promise<DocumentTemplate | null> {
    const blob = serializeTemplate(t);
    const body = {
      id:           t.id || undefined,
      type:         toApiType(t.documentType),
      templateName: t.templateName,
      renderMode:   t.renderMode,
      template:     blob,
      // `isDefault` only goes on save when the user hasn't yet picked
      // a default for this type — the backend should still treat
      // setDefault() as the canonical way to flip it.
      isDefault:    t.isDefault,
    };
    const res = await this.api.request<any>(
      this.api.post('company/document-templates/save', body),
    );
    const raw = res?.data ?? res;
    if (!raw) return null;
    // Server replies with `{ id }` — re-load via getById to get the
    // canonical row + any server-assigned defaults.
    const newId = raw.id ?? t.id;
    if (!newId) return null;
    return this.getById(t.documentType, String(newId));
  }

  /** Delete a template. Backend returns 409 / error when the row is
   *  the default — frontend already prevents that in the UI but we
   *  let the error bubble so callers can toast it. */
  async delete(id: string): Promise<boolean> {
    await this.api.request<any>(this.api.delete(`company/document-templates/${id}`));
    return true;
  }

  /** Set this template as the default for its document type. The
   *  backend atomically clears the previous default (the
   *  partial-unique index on `(companyId, type) WHERE isDefault`
   *  enforces "exactly one default per type" at the schema level). */
  async setDefault(id: string, type: DocumentType): Promise<boolean> {
    await this.api.request<any>(
      this.api.post(`company/document-templates/${id}/default`, { type: toApiType(type) }),
    );
    return true;
  }

  /** Fetch the default template for a type. Used by entity view /
   *  print pages — they don't need to enumerate; they just want the
   *  canonical layout. Returns null when no default is set yet. */
  async getDefault(type: DocumentType): Promise<DocumentTemplate | null> {
    const res = await this.api.request<any>(
      this.api.get(`company/document-templates/default/${toApiType(type)}`),
    );
    const raw = res?.data ?? res;
    if (!raw || typeof raw !== 'object') return null;
    const flat = {
      ...(raw.template && typeof raw.template === 'object' ? raw.template : {}),
      id:           raw.id,
      templateName: raw.templateName ?? '',
      documentType: fromApiType(raw.type, type),
      renderMode:   raw.renderMode ?? 'classic',
      isDefault:    !!raw.isDefault,
    };
    return parseTemplate(flat, type);
  }
}
