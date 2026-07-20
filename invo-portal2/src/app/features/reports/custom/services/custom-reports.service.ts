import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '@core/auth/auth.service';

import {
  CustomReportRequest,
  DataSourceTable,
  ReportFormula,
  SavedModule,
  SavedQuery,
} from '../shared/models/custom-report.model';
import { REPORT_FORMULAS } from '../shared/formulas/formula-registry';

@Injectable({
  providedIn: 'root',
})
export class CustomReportsService {
  // invo-portal2: the base URL is a constant from the environment, and the auth
  // interceptor attaches the `api-auth` token to every call, so this service no
  // longer resolves config or sets the header itself.
  private baseUrl = environment.backendUrl;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private router: Router
  ) {}

  private async ensureConfig(): Promise<string> {
    return this.baseUrl;
  }

  private getHeaders(): HttpHeaders {
    // Empty — the auth interceptor adds `api-auth`. (getCustomizedReport still
    // chains `.set('Content-Type', …)` onto this.)
    return new HttpHeaders();
  }

  private handleAuthError(error: any): void {
    if (error.status === 401) {
      this.auth.logout();
      this.router.navigateByUrl('login');
    }
  }

  // Per docs/custom-reports-backend-api.md the backend uses HTTP 200 for both
  // success and validation failure — the discriminator is `response.success`.
  // Mutating callers must reject the promise so consumers can `await … catch`
  // and surface the failure; read-only callers log and return an empty result.
  private isFailureResponse(response: any): boolean {
    return !!response && typeof response === 'object' && response.success === false;
  }
  private failureMessage(response: any, method: string): string {
    return response?.msg || `${method} failed`;
  }

  // ─── Data Source ───────────────────────────────────────────

  async getDataSource(): Promise<DataSourceTable[]> {
    const baseUrl = await this.ensureConfig();
    return new Promise<DataSourceTable[]>((resolve) => {
      this.http
        .get(`${baseUrl}accounts/reports/getDataSource`, {
          headers: this.getHeaders(),
        })
        .subscribe({
          next: (response: any) => {
            try {
              if (this.isFailureResponse(response)) {
                console.error(`[CustomReports] getDataSource failed: ${this.failureMessage(response, 'getDataSource')}`);
                resolve([]);
                return;
              }
              // Debug: log full response structure
              console.warn('[CustomReports] RAW getDataSource response:', JSON.stringify(response).substring(0, 500));

              const raw = response?.data?.dataSources;
              if (!raw) {
                console.warn('[CustomReports] No dataSources found in response.data.dataSources, trying response.data');
                // Maybe dataSources IS response.data directly
                const altRaw = response?.data;
                if (altRaw && typeof altRaw === 'object' && !altRaw.dataSources) {
                  resolve(this.parseDataSourceMap(altRaw));
                  return;
                }
                resolve([]);
                return;
              }

              if (Array.isArray(raw)) {
                resolve(raw);
                return;
              }

              resolve(this.parseDataSourceMap(raw));
            } catch (e) {
              console.error('[CustomReports] getDataSource parse error:', e);
              resolve([]);
            }
          },
          error: (error) => {
            this.handleAuthError(error);
            resolve([]);
          },
        });
    });
  }

  private parseDataSourceMap(raw: any): DataSourceTable[] {
    const tables: DataSourceTable[] = Object.keys(raw).map((key) => {
      const entry = raw[key];

      // Debug: log first table structure
      if (key === Object.keys(raw)[0]) {
        console.warn('[CustomReports] Sample table entry "' + key + '":', JSON.stringify(entry).substring(0, 400));
      }

      const fields = this.extractFields(entry);
      const tableId = entry.id || key;

      return {
        id: tableId,
        label: entry.name || entry.label || key,
        data: fields,
        refs: entry.refs || [],
        formulas: this.extractFormulas(entry, tableId),
      } as any;
    });

    console.warn('[CustomReports] Parsed tables:');
    tables.forEach((t) => console.warn(`  - ${t.id} (${t.label}): ${t.data.length} fields`, t.data.slice(0, 3)));

    return tables;
  }

  private extractFields(entry: any): { id: string; label: string; type: 'text' | 'number' | 'date'; numberFormat?: string }[] {
    const fields: { id: string; label: string; type: 'text' | 'number' | 'date'; numberFormat?: string }[] = [];

    // Case 1: data is an array
    if (Array.isArray(entry.data)) {
      return entry.data.map((f: any) => ({
        id: f.id || f.field || f.column || '',
        label: f.label || f.name || f.header || f.id || '',
        type: this.inferFieldType(f.type || f.dataType || ''),
        // Preserve the backend's numeric sub-format (currency/decimal/integer)
        // so numeric coercion and cell formatting work (see coerceNumericRows).
        ...(f.numberFormat ? { numberFormat: f.numberFormat } : {}),
      }));
    }

    // Case 2: data is an object map
    if (entry.data && typeof entry.data === 'object' && !Array.isArray(entry.data)) {
      return Object.keys(entry.data).map((fk) => {
        const fd = entry.data[fk];
        if (typeof fd === 'object') {
          return {
            id: fd.id || fd.field || fk,
            label: fd.label || fd.name || fd.header || fk,
            type: this.inferFieldType(fd.type || fd.dataType || ''),
          };
        }
        return { id: fk, label: fk, type: 'text' as const };
      });
    }

    // Case 3: columns array
    if (entry.columns && Array.isArray(entry.columns)) {
      return entry.columns.map((f: any) => ({
        id: typeof f === 'string' ? f : (f.id || f.field || ''),
        label: typeof f === 'string' ? f : (f.label || f.name || f.id || ''),
        type: typeof f === 'string' ? 'text' as const : this.inferFieldType(f.type || ''),
      }));
    }

    // Case 4: fields are top-level keys in entry (skip meta keys)
    const skipKeys = new Set(['id', 'name', 'label', 'data', 'columns', 'joins', 'type', 'tableName']);
    Object.keys(entry).forEach((fk) => {
      if (skipKeys.has(fk)) return;
      const val = entry[fk];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        fields.push({
          id: val.id || val.field || fk,
          label: val.label || val.name || val.header || fk,
          type: this.inferFieldType(val.type || val.dataType || ''),
        });
      } else if (typeof val === 'string') {
        // Maybe it's { fieldKey: "Field Label" } format
        fields.push({ id: fk, label: val || fk, type: 'text' });
      }
    });

    return fields;
  }

  private inferFieldType(raw: string): 'text' | 'number' | 'date' {
    if (!raw) return 'text';
    const lower = raw.toLowerCase();
    if (lower === 'number' || lower === 'integer' || lower === 'numeric' ||
        lower.includes('int') || lower.includes('float') || lower.includes('double') ||
        lower.includes('decimal') || lower.includes('money') || lower.includes('currency')) {
      return 'number';
    }
    if (lower === 'date' || lower.includes('time') || lower.includes('timestamp')) {
      return 'date';
    }
    // reference, boolean, text, json, array → all treated as text for filter purposes
    return 'text';
  }

  /**
   * Resolve the predefined formulas (calculated fields) for a table. Prefers
   * the backend's `formulas` array (authoritative) and falls back to the
   * developer registry. Only `key`, `name` and `type` are ever surfaced — the
   * SQL expression stays backend-side (see custom-reports-backend-api.md).
   */
  private extractFormulas(entry: any, tableId: string): ReportFormula[] {
    const raw = Array.isArray(entry?.formulas) ? entry.formulas : null;
    if (raw && raw.length > 0) {
      return raw
        .map((f: any) => ({
          key: f.key || f.id || '',
          name: f.name || f.label || f.key || '',
          type: this.inferFieldType(f.type || f.dataType || 'number'),
          ...(f.numberFormat ? { numberFormat: f.numberFormat } : {}),
        }))
        .filter((f: ReportFormula) => !!f.key);
    }
    return REPORT_FORMULAS[tableId] || [];
  }

  // ─── Modules (saved report configs) ───────────────────────

  async getModules(): Promise<SavedModule[]> {
    const baseUrl = await this.ensureConfig();
    return new Promise<SavedModule[]>((resolve) => {
      this.http
        .get(`${baseUrl}accounts/reports/modules/getModules`, {
          headers: this.getHeaders(),
        })
        .subscribe({
          next: (response: any) => {
            try {
              if (this.isFailureResponse(response)) {
                console.error(`[CustomReports] getModules failed: ${this.failureMessage(response, 'getModules')}`);
                resolve([]);
                return;
              }
              const raw = response?.data?.dataSources || response?.data || [];
              resolve(Array.isArray(raw) ? raw : []);
            } catch {
              resolve([]);
            }
          },
          error: (error) => {
            this.handleAuthError(error);
            resolve([]);
          },
        });
    });
  }

  async getModule(id: string): Promise<SavedModule | null> {
    const baseUrl = await this.ensureConfig();
    return new Promise<SavedModule | null>((resolve) => {
      this.http
        .get(`${baseUrl}accounts/reports/modules/getModule/${id}`, {
          headers: this.getHeaders(),
        })
        .subscribe({
          next: (response: any) => {
            try {
              if (this.isFailureResponse(response)) {
                console.error(`[CustomReports] getModule failed: ${this.failureMessage(response, 'getModule')}`);
                resolve(null);
                return;
              }
              // Some deployments wrap the module under data.dataSources, others
              // return it directly as data. Mirror getModules()' fallback.
              resolve(response?.data?.dataSources || response?.data || null);
            } catch {
              resolve(null);
            }
          },
          error: (error) => {
            this.handleAuthError(error);
            resolve(null);
          },
        });
    });
  }

  async saveModule(data: { name: string; text: string }): Promise<any> {
    const baseUrl = await this.ensureConfig();
    return new Promise<any>((resolve, reject) => {
      this.http
        .post(`${baseUrl}accounts/reports/modules/saveModule/0`, data, {
          headers: this.getHeaders(),
        })
        .subscribe({
          next: (response: any) => {
            if (this.isFailureResponse(response)) {
              reject(new Error(this.failureMessage(response, 'saveModule')));
              return;
            }
            resolve(response?.data?.dataSources || response?.data || response);
          },
          error: (error) => {
            this.handleAuthError(error);
            reject(error);
          },
        });
    });
  }

  async updateModule(id: string, data: { name: string; text: string }): Promise<any> {
    const baseUrl = await this.ensureConfig();
    return new Promise<any>((resolve, reject) => {
      this.http
        .post(`${baseUrl}accounts/reports/modules/saveModule/${id}`, data, {
          headers: this.getHeaders(),
        })
        .subscribe({
          next: (response: any) => {
            if (this.isFailureResponse(response)) {
              reject(new Error(this.failureMessage(response, 'updateModule')));
              return;
            }
            resolve(response?.data?.dataSources || response?.data || response);
          },
          error: (error) => {
            this.handleAuthError(error);
            reject(error);
          },
        });
    });
  }

  async deleteModule(id: string): Promise<any> {
    const baseUrl = await this.ensureConfig();
    return new Promise<any>((resolve, reject) => {
      this.http
        .get(`${baseUrl}accounts/reports/modules/deleteModule/${id}`, {
          headers: this.getHeaders(),
        })
        .subscribe({
          next: (response: any) => {
            if (this.isFailureResponse(response)) {
              reject(new Error(this.failureMessage(response, 'deleteModule')));
              return;
            }
            resolve(response);
          },
          error: (error) => {
            this.handleAuthError(error);
            reject(error);
          },
        });
    });
  }

  // ─── Queries (saved filters) ──────────────────────────────

  async getQueries(): Promise<SavedQuery[]> {
    const baseUrl = await this.ensureConfig();
    return new Promise<SavedQuery[]>((resolve) => {
      this.http
        .get(`${baseUrl}accounts/reports/queries/getQueries`, {
          headers: this.getHeaders(),
        })
        .subscribe({
          next: (response: any) => {
            try {
              if (this.isFailureResponse(response)) {
                console.error(`[CustomReports] getQueries failed: ${this.failureMessage(response, 'getQueries')}`);
                resolve([]);
                return;
              }
              const raw = response?.data?.dataSources || response?.data || [];
              resolve(Array.isArray(raw) ? raw : []);
            } catch {
              resolve([]);
            }
          },
          error: (error) => {
            this.handleAuthError(error);
            resolve([]);
          },
        });
    });
  }

  async saveQuery(data: { name: string; text: string }): Promise<any> {
    const baseUrl = await this.ensureConfig();
    return new Promise<any>((resolve, reject) => {
      this.http
        .post(`${baseUrl}accounts/reports/queries/saveQuery`, data, {
          headers: this.getHeaders(),
        })
        .subscribe({
          next: (response: any) => {
            if (this.isFailureResponse(response)) {
              reject(new Error(this.failureMessage(response, 'saveQuery')));
              return;
            }
            resolve(response?.data?.dataSources);
          },
          error: (error) => {
            this.handleAuthError(error);
            reject(error);
          },
        });
    });
  }

  async updateQuery(id: string, data: { name: string; text: string }): Promise<any> {
    const baseUrl = await this.ensureConfig();
    return new Promise<any>((resolve, reject) => {
      this.http
        .post(`${baseUrl}accounts/reports/queries/saveQuery`, { ...data, id }, {
          headers: this.getHeaders(),
        })
        .subscribe({
          next: (response: any) => {
            if (this.isFailureResponse(response)) {
              reject(new Error(this.failureMessage(response, 'updateQuery')));
              return;
            }
            resolve(response?.data?.dataSources);
          },
          error: (error) => {
            this.handleAuthError(error);
            reject(error);
          },
        });
    });
  }

  // ─── Options / Suggests ───────────────────────────────────

  async getOptions(field: string): Promise<any[]> {
    const baseUrl = await this.ensureConfig();
    return new Promise<any[]>((resolve) => {
      this.http
        .get(`${baseUrl}accounts/reports/options/getOptions/${field}`, {
          headers: this.getHeaders(),
        })
        .subscribe({
          next: (response: any) => {
            try {
              if (this.isFailureResponse(response)) {
                console.error(`[CustomReports] getOptions failed: ${this.failureMessage(response, 'getOptions')}`);
                resolve([]);
                return;
              }
              resolve(response?.data?.dataSources || []);
            } catch {
              resolve([]);
            }
          },
          error: (error) => {
            this.handleAuthError(error);
            resolve([]);
          },
        });
    });
  }

  async getSuggests(field: string): Promise<any[]> {
    const baseUrl = await this.ensureConfig();
    return new Promise<any[]>((resolve) => {
      this.http
        .get(`${baseUrl}accounts/reports/options/getSuggests/${field}`, {
          headers: this.getHeaders(),
        })
        .subscribe({
          next: (response: any) => {
            try {
              if (this.isFailureResponse(response)) {
                console.error(`[CustomReports] getSuggests failed: ${this.failureMessage(response, 'getSuggests')}`);
                resolve([]);
                return;
              }
              resolve(response?.data?.dataSources || []);
            } catch {
              resolve([]);
            }
          },
          error: (error) => {
            this.handleAuthError(error);
            resolve([]);
          },
        });
    });
  }

  // ─── Report Execution ─────────────────────────────────────

  async getCustomizedReport(request: CustomReportRequest): Promise<{ rows: any[]; totalCount: number; groups?: any[] }> {
    const baseUrl = await this.ensureConfig();

    // Exact wire format required (from URL-encoded expected payload):
    //   data=InvoiceView
    //   query=                          ← empty string when no filter
    //   columns=["T.col","T.col2"]      ← JSON array string
    //   joins=[]                        ← JSON array string (always)
    //   sort=                           ← empty string when no sort
    //   group=                          ← empty string when no group
    //   buckets=                        ← empty string when no buckets
    //   limit=30
    const params: any = {
      data:    request.tableName || '',
      columns: JSON.stringify(request.columns || []),
      joins:   JSON.stringify(request.joins   || []),      // always "[]" — backend does JSON.parse(joins)
      sort:    (request.sort    && request.sort.length)    // empty string when none — backend checks sort.length > 0 before JSON.parse
                 ? JSON.stringify(request.sort)    : '',
      group:   (request.group   && request.group.length)  // empty string when none — toArray('') returns []
                 ? JSON.stringify(request.group)   : '',
      // Display grouping field for the Group by shelf (distinct from `group`).
      // Empty string when no group-by is set.
      groupBy: request.groupBy || '',
      query:   request.query                               // empty string when none — backend checks query.length > 0
                 ? (typeof request.query === 'string' ? request.query : JSON.stringify(request.query))
                 : '',
      buckets: (request.buckets && request.buckets.length) // empty string when none — backend checks buckets.length > 0
                 ? JSON.stringify(request.buckets) : '',
      // `null` is the explicit "no limit" sentinel — emit an empty
       // `limit` form field so the backend returns every row. `undefined` /
       // missing keeps the historic default of 30.
      limit:   request.limit === null
                 ? ''
                 : String(request.limit || 30),
      offset:  String(request.offset || 0),
    };

    // Build form data
    const formData = new URLSearchParams();
    Object.keys(params).forEach((key) => {
      formData.set(key, params[key]);
    });

    console.warn('[CustomReports] getCustomizedReport params:', params);

    return new Promise<{ rows: any[]; totalCount: number; groups?: any[] }>((resolve) => {
      this.http
        .post(`${baseUrl}accounts/reports/getCustomizedReport`, formData.toString(), {
          headers: this.getHeaders().set('Content-Type', 'application/x-www-form-urlencoded'),
          responseType: 'text',
        })
        .subscribe({
          next: (response: any) => {
            try {
              let parsed = response;
              if (typeof response === 'string') {
                try { parsed = JSON.parse(response); } catch { parsed = response; }
              }
              if (this.isFailureResponse(parsed)) {
                console.error(`[CustomReports] getCustomizedReport failed: ${this.failureMessage(parsed, 'getCustomizedReport')}`);
                resolve({ rows: [], totalCount: 0 });
                return;
              }
              // Per the contract, the response body is a flat JSON array of rows
              // (Content-Type: text/html, but the payload is JSON text). The
              // legacy `data.dataSources` envelope is kept here as a defensive
              // fallback in case the backend ever changes shape.
              const container = parsed?.data;
              const rows = container?.dataSources || container || parsed || [];
              const totalCount = container?.totalCount ?? -1; // -1 means server didn't send it
              // Group by shelf: backend returns groups[] with per-group rows +
              // subtotals + count. Surfaced only when present (normal mode unchanged).
              const groups = Array.isArray(container?.groups) ? container.groups : undefined;
              resolve({
                rows: Array.isArray(rows) ? rows : [],
                totalCount: typeof totalCount === 'number' ? totalCount : -1,
                groups,
              });
            } catch (e) {
              console.error('[CustomReports] Response parse error:', e);
              resolve({ rows: [], totalCount: 0 });
            }
          },
          error: (error) => {
            console.error('[CustomReports] getCustomizedReport error:', error?.error || error);
            this.handleAuthError(error);
            resolve({ rows: [], totalCount: 0 });
          },
        });
    });
  }
}
