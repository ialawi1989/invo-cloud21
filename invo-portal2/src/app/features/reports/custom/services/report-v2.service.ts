import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ApiService } from '@core/http/api.service';
import { AuthService } from '@core/auth/auth.service';

import {
  AiBuildResult,
  AiHistoryTurn,
  AiUsage,
  CatalogEntity,
  ReportApiError,
  ReportSpecV2,
  RunResult,
  SavedSpec,
  ValidateResult,
} from '../shared/v2/report-v2.model';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Custom Reports v2 API (/v1/app/accounts/reports/v2). Every call answers the
 * usual `{ success, msg, data }` envelope; refusals come back as HTTP 200 with
 * `success: false`, `msg` safe to show, and `error.code` (REPORT_INVALID |
 * REPORT_TIMEOUT | REPORT_FAILED). Failures reject with a ReportApiError.
 */
@Injectable({
  providedIn: 'root',
})
export class ReportV2Service {
  private catalogCache = new Map<string, Promise<CatalogEntity[]>>();

  // invo-portal2: HTTP goes through ApiService (base URL + the `api-auth`
  // header come from the environment / auth interceptor, not from here).
  constructor(
    private api: ApiService,
    private auth: AuthService,
    private router: Router,
    private translate: TranslateService
  ) {}

  /** True when `id` can be a saved v2 spec (the backend only accepts UUIDs). */
  static isSpecId(id: string | null | undefined): boolean {
    return !!id && UUID.test(id);
  }

  private get lang(): string {
    return (this.translate.currentLang || this.translate.defaultLang || 'en').startsWith('ar') ? 'ar' : 'en';
  }

  // ─── Catalog ───────────────────────────────────────────────

  /** Entities the user can report on. Cached per language for the session. */
  getCatalog(): Promise<CatalogEntity[]> {
    const lang = this.lang;
    let cached = this.catalogCache.get(lang);
    if (!cached) {
      cached = this.request<CatalogEntity[]>('GET', `catalog?lang=${lang}`)
        .then(data => (Array.isArray(data) ? data : []));
      cached.catch(() => this.catalogCache.delete(lang));
      this.catalogCache.set(lang, cached);
    }
    return cached;
  }

  // ─── Running ───────────────────────────────────────────────

  async run(spec: ReportSpecV2): Promise<RunResult> {
    try {
      return await this.request<RunResult>('POST', 'run', { spec: this.stripUi(spec) });
    } catch (err) {
      // The catalog can't always tell us which entity (e.g. a sub table such as
      // accounts → journalEntries) needs a date range. If the backend refuses for
      // that reason and the spec already holds a date "between" filter, send it
      // as the spec-level dateRange instead and retry once.
      const moved = err instanceof ReportApiError && /date\s*range/i.test(err.message)
        ? this.dateRangeFromFilters(spec)
        : null;
      if (!moved) throw err;
      return this.request<RunResult>('POST', 'run', { spec: this.stripUi(moved) });
    }
  }

  /** Spec with its top-level AND date "between" rule moved into `dateRange`, or null. */
  private dateRangeFromFilters(spec: ReportSpecV2): ReportSpecV2 | null {
    const group = spec.filters;
    if (spec.dateRange || !group || group.glue !== 'and') return null;
    const plainDay = /^\d{4}-\d{2}-\d{2}$/;
    const hit: any = (group.rules || []).find((r: any) =>
      r?.op === 'between' && Array.isArray(r.value) && r.value.length === 2
      && plainDay.test(String(r.value[0])) && plainDay.test(String(r.value[1])));
    if (!hit) return null;
    const rules = group.rules.filter((r: any) => r !== hit);
    const { filters, ...rest } = spec;
    return {
      ...rest,
      dateRange: { field: hit.field, from: String(hit.value[0]), to: String(hit.value[1]) },
      ...(rules.length ? { filters: { ...group, rules } } : {}),
    };
  }

  /** `success` is true even for an invalid spec — read `ok` / `error`. */
  validate(spec: ReportSpecV2): Promise<ValidateResult> {
    return this.request<ValidateResult>('POST', 'validate', { spec: this.stripUi(spec) });
  }

  /** Up to 50 distinct raw values of a field (numbers, strings, dates or null). */
  fieldValues(entity: string, field: string, q?: string): Promise<any[]> {
    return this.request<any[]>('POST', 'fieldValues', { entity, field, ...(q ? { q } : {}) })
      .then(data => (Array.isArray(data) ? data : []));
  }

  // ─── Saved reports ─────────────────────────────────────────

  listSpecs(): Promise<SavedSpec[]> {
    return this.request<SavedSpec[]>('GET', 'specs').then(data => (Array.isArray(data) ? data : []));
  }

  getSpec(id: string): Promise<SavedSpec> {
    return this.request<SavedSpec>('GET', `specs/${encodeURIComponent(id)}`);
  }

  /**
   * Create (no id) or update. `isShared` is always sent: the backend resets it
   * to true when omitted, even on update.
   */
  saveSpec(body: { id?: string; name: string; spec: ReportSpecV2; isShared: boolean }): Promise<{ id: string }> {
    return this.request<{ id: string }>('POST', 'specs', body);
  }

  deleteSpec(id: string): Promise<void> {
    return this.request<void>('DELETE', `specs/${encodeURIComponent(id)}`);
  }

  /** Convert a legacy /getCustomizedReport body into a v2 spec. */
  fromLegacy(payload: any): Promise<ReportSpecV2> {
    return this.request<ReportSpecV2>('POST', 'fromLegacy', payload);
  }

  // ─── AI ────────────────────────────────────────────────────

  /** Takes several seconds to about a minute. */
  aiBuild(body: { message: string; history?: AiHistoryTurn[]; currentSpec?: ReportSpecV2 | null }): Promise<AiBuildResult> {
    const payload: any = { message: body.message };
    if (body.history?.length) payload.history = body.history.slice(-10);
    if (body.currentSpec) payload.currentSpec = this.stripUi(body.currentSpec);
    return this.request<AiBuildResult>('POST', `ai/build?lang=${this.lang}`, payload);
  }

  getAiUsage(): Promise<AiUsage> {
    return this.request<AiUsage>('GET', 'ai/usage');
  }

  // ─── Plumbing ──────────────────────────────────────────────

  /** `ui` is builder-only; keep it out of run/validate/AI payloads. */
  private stripUi(spec: ReportSpecV2): ReportSpecV2 {
    if (!spec || !('ui' in spec)) return spec;
    const { ui, ...rest } = spec;
    return rest as ReportSpecV2;
  }

  private async request<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
    const url = `accounts/reports/v2/${path}`;
    let response: any;
    try {
      response = await this.api.request<T>(
        method === 'GET' ? this.api.get<T>(url) : method === 'POST' ? this.api.post<T>(url, body) : this.api.delete<T>(url)
      );
    } catch (error: any) {
      if (error?.status === 401) {
        this.auth.logout();
        this.router.navigateByUrl('login');
      }
      throw new ReportApiError(error?.error?.msg || error?.message || 'Request failed', error?.error?.error?.code);
    }
    if (!response || response.success === false) {
      throw new ReportApiError(response?.msg || 'Request failed', response?.error?.code);
    }
    return response.data as T;
  }
}
