import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiService } from '@core/http/api.service';
import { LanguageService } from '@core/i18n/language.service';
import {
  RawReportResponse,
  ReportApiFilter,
  ReportColumn,
  ReportKpi,
  ReportMeta,
  ReportResult,
  ReportTable,
} from '../models/report.model';

/**
 * Data + export layer for the reports feature. Mirrors InvoCloudFront2's
 * `ReportsService.getCloudReport`, routed through the app's shared `ApiService`
 * so auth/base-url/error handling stay centralized.
 *
 * Backend contract:
 *   POST accounts/reports/{route}          body { filter }   → { records, columns, subColumns }
 *   POST accounts/reports/export/{path}    body { filter }   → Blob (xlsx/csv)
 *   POST accounts/reports/exportPdf/{path} body { filter }   → Blob (pdf)
 */

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private lang = inject(LanguageService);

  /** Fetch + normalize a report. Uses the meta's custom `normalize` or the default. */
  async getReport(meta: ReportMeta, filter: ReportApiFilter): Promise<ReportResult> {
    const raw = await this.fetchRaw(meta.route, filter);
    const normalize = meta.normalize ?? ((r: RawReportResponse) => defaultNormalize(r));
    const result = normalize(raw, { filter, t: (key, params) => this.lang.instant(key, params) });
    if (meta.kpis?.length && (!result.kpis || result.kpis.length === 0)) {
      result.kpis = computeKpis(meta, result.table);
    }
    return result;
  }

  /** Low-level fetch of the raw `{ records, columns, subColumns }` payload. */
  async fetchRaw(route: string, filter: ReportApiFilter): Promise<RawReportResponse> {
    const body = { filter: clean(filter) };
    const res = await this.api.request<RawReportResponse>(
      this.api.post(`accounts/reports/${route}`, body),
    );
    // Endpoints return the payload under `.data`; tolerate a bare payload too.
    return (res?.data ?? res ?? {}) as RawReportResponse;
  }

  /**
   * Trigger a server-side export and download the resulting file. `type`
   * selects the endpoint (`exportPdf` for PDF, `export` for xlsx/csv).
   */
  async export(
    meta: ReportMeta,
    type: 'pdf' | 'xlsx' | 'csv',
    filter: ReportApiFilter,
  ): Promise<void> {
    await this.exportPath(meta.export?.path ?? meta.route, type, filter, meta.slug);
  }

  /**
   * Same server-side export for a report that has no `ReportMeta` (e.g. the supplier statement on its
   * dashboard): `accounts/reports/export[Pdf]/{path}` with `{ filter }`, saved as `{fileBase}.{type}`.
   */
  async exportPath(
    path: string,
    type: 'pdf' | 'xlsx' | 'csv',
    filter: Record<string, any>,
    fileBase = path,
  ): Promise<void> {
    const endpoint = type === 'pdf' ? `accounts/reports/exportPdf/${path}` : `accounts/reports/export/${path}`;
    const body = { filter: clean({ ...filter, exportType: type }) };

    const response = await firstValueFrom(
      this.http.post(`${environment.backendUrl}${endpoint}`, body, {
        responseType: 'blob',
        observe: 'response',
      }),
    );

    const blob = response.body;
    if (!blob) return;
    const filename =
      parseFilename(response.headers.get('content-disposition')) ??
      `${fileBase}.${type === 'xlsx' ? 'xlsx' : type}`;
    downloadBlob(blob, filename);
  }

  /**
   * Server-side export for endpoints that read their params from the TOP LEVEL of the body (legacy
   * `exportXLSX` / `exportPDF`, e.g. `customerstatment`) — unlike {@link exportPath}, which wraps them in
   * `{ filter }`. PDFs also send the UI language so the server can render right-to-left.
   */
  async exportFlat(path: string, type: 'pdf' | 'xlsx', params: Record<string, any>, fileBase = path): Promise<void> {
    const { blob, filename } = await this.requestFlat(path, type, params, fileBase);
    if (blob) downloadBlob(blob, filename);
  }

  /** Same request as {@link exportFlat} for a PDF, but opens the print dialog instead of downloading. */
  async printFlat(path: string, params: Record<string, any>): Promise<void> {
    // Open synchronously (inside the click) so the popup isn't blocked while the PDF is generated.
    const w = window.open('', '_blank');
    try {
      const { blob } = await this.requestFlat(path, 'pdf', params, path);
      if (!blob || !w) { w?.close(); return; }
      this.printBlob(w, blob);
    } catch (e) {
      w?.close();
      throw e;
    }
  }

  /**
   * Prints the backend's own PDF of a report — the document `exportPath(path, 'pdf', …)` downloads —
   * by opening it in a new window and calling print. For `{ filter }`-style routes.
   * Must be called straight from a click: the window is opened before the (slow) request so the
   * popup blocker allows it.
   */
  async printPath(path: string, filter: Record<string, any>): Promise<void> {
    const w = window.open('', '_blank');
    try {
      const response = await firstValueFrom(
        this.http.post(`${environment.backendUrl}accounts/reports/exportPdf/${path}`, { filter: clean(filter) }, {
          responseType: 'blob',
          observe: 'response',
        }),
      );
      const blob = response.body;
      if (!blob || !w) { w?.close(); return; }
      this.printBlob(w, blob);
    } catch (e) {
      w?.close();
      throw e;
    }
  }

  /** Shows a PDF in `w` and opens the print dialog once it has loaded. */
  private printBlob(w: Window, blob: Blob): void {
    // The backend streams the file without a content type; without one the browser downloads it
    // instead of displaying it, so state it explicitly.
    const pdf = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
    const url = URL.createObjectURL(pdf);
    // Full-size frame: a hidden / 0x0 frame makes the PDF viewer print only the first page.
    w.document.write(
      `<html><body style="margin:0"><iframe id="pdf" src="${url}" style="width:100%;height:100vh;border:none"></iframe>` +
      `<script>document.getElementById('pdf').onload=function(){this.contentWindow.focus();this.contentWindow.print();}<\/script></body></html>`,
    );
    w.document.close();
  }

  private async requestFlat(path: string, type: 'pdf' | 'xlsx', params: Record<string, any>, fileBase: string) {
    const endpoint = type === 'pdf' ? `accounts/reports/exportPdf/${path}` : `accounts/reports/export/${path}`;
    const body = type === 'pdf' ? { ...clean(params), lang: this.lang.current() } : clean(params);
    const response = await firstValueFrom(
      this.http.post(`${environment.backendUrl}${endpoint}`, body, { responseType: 'blob', observe: 'response' }),
    );
    return {
      blob: response.body,
      filename: parseFilename(response.headers.get('content-disposition')) ?? `${fileBase}.${type}`,
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip null / undefined / '' so the backend gets a tidy filter object. */
function clean<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

/**
 * Default normalizer — assumes a flat-list shape, the most common across the
 * reporting endpoints:
 *   { records: Row[], columns?: (string | {key,label})[], totals?: {} }
 *
 * When `columns` is omitted it's inferred from the first record's keys.
 * Pivot/matrix reports can supply a custom `normalize` on their `ReportMeta`.
 */
export function defaultNormalize(raw: RawReportResponse): ReportResult {
  const rows: Record<string, any>[] = Array.isArray(raw.records)
    ? raw.records
    : Array.isArray((raw as any).list)
      ? (raw as any).list
      : Array.isArray(raw as any)
        ? (raw as any)
        : [];

  let columns: ReportColumn[];
  if (raw.columns?.length) {
    columns = raw.columns.map(c =>
      typeof c === 'string'
        ? { key: c, label: titleCase(c), align: guessAlign(c), type: guessType(c) }
        : { key: c.key, label: c.label ?? titleCase(c.key), align: guessAlign(c.key), type: guessType(c.key) },
    );
  } else if (rows.length) {
    columns = Object.keys(rows[0]).map(k => ({
      key: k, label: titleCase(k), align: guessAlign(k), type: guessType(k),
    }));
  } else {
    columns = [];
  }

  const table: ReportTable = { columns, rows, totals: raw.totals };
  return { table, chartRows: rows };
}

/** Sum each KPI column across rows (or read from `totals`). */
export function computeKpis(meta: ReportMeta, table: ReportTable): ReportKpi[] {
  return (meta.kpis ?? []).map(cfg => {
    const fromTotals = table.totals?.[cfg.key];
    const value =
      fromTotals != null
        ? Number(fromTotals) || 0
        : table.rows.reduce((sum, r) => sum + (Number(r[cfg.key]) || 0), 0);
    return { label: cfg.labelKey, value, type: cfg.type };
  });
}

function titleCase(str: string): string {
  return str
    .split(/(?=[A-Z])|[_\s-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Right-align money/quantity-looking columns. */
function guessAlign(key: string): 'start' | 'end' {
  return /(amount|total|sales|qty|quantity|price|cost|value|balance|net|gross|tax|vat|count|avg|percent)/i.test(key)
    ? 'end'
    : 'start';
}

function guessType(key: string): ReportColumn['type'] {
  if (/(amount|total|sales|price|cost|value|balance|net|gross|tax|vat|avg)/i.test(key)) return 'currency';
  if (/(qty|quantity|count|orders)/i.test(key)) return 'number';
  if (/(percent|rate|margin)/i.test(key)) return 'percent';
  if (/(date|day|time|created|updated)/i.test(key)) return 'date';
  return 'text';
}

/**
 * File name from a `Content-Disposition` header. The backend writes
 * `attachment; filename= "Report.pdf"` — with a SPACE after the `=` — so whitespace
 * there must be allowed, otherwise the name comes out as " " and the download has
 * no name or extension. Returns undefined when no usable name is present.
 */
export function parseFilename(contentDisposition: string | null): string | undefined {
  if (!contentDisposition) return undefined;
  const match = /filename\*?=\s*(?:UTF-8'')?\s*"?([^";]+)"?/i.exec(contentDisposition);
  if (!match) return undefined;
  let name = match[1].trim();
  try { name = decodeURIComponent(name); } catch { /* keep the raw text */ }
  return name || undefined;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
