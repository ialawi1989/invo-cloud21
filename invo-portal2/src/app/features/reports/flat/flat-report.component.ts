import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { QueryParamsService } from '@shared/services/query-params.service';
import { journalLink } from '../../settings/chart-of-accounts/utils/journal-links';
import { BoTableShellComponent } from '../business-overview/components/bo-table-shell/bo-table-shell.component';
import { PAGING_PARAMS, pickPageSize } from '../business-overview/shared/paging-params';
import { ReportErrorComponent } from '../components/report-error/report-error.component';
import { ReportApiFilter, ReportKpi } from '../models/report.model';
import { ReportKpiRowComponent } from '../components/report-kpi-row/report-kpi-row.component';
import { FLAT_REPORTS, FlatColumn } from './flat-reports';
import { FlatData, FlatRecord, FlatReportService } from './flat-report.service';
import { ReportEmptyComponent } from '../components/report-empty/report-empty.component';

const toNum = (v: unknown): number => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : 0; };

interface Row { kind: 'data' | 'subtotal'; rec: FlatRecord; first: boolean; group?: string; /** rows the group's merged cell covers (on its first row) */ span?: number; /** the second merged cell starts here, covering `span2` rows */ first2?: boolean; span2?: number }

/**
 * A report that is one plain table (see `FLAT_REPORTS`): its columns, paging and Total row come from the report's config, the
 * data from `POST accounts/reports/{route}`. The page, its size and the filters live in the URL like every report.
 */
@Component({
  selector: 'app-flat-report',
  standalone: true,
  imports: [RouterLink, ReportEmptyComponent, ReportErrorComponent, TranslateModule, DatePipe, DecimalPipe, MycurrencyPipe, PaginationComponent, BoTableShellComponent, ReportKpiRowComponent],
  templateUrl: './flat-report.component.html',
  styleUrl: './flat-report.component.scss',
})
export class FlatReportComponent {
  private svc = inject(FlatReportService);
  private lang = inject(LanguageService);
  private urlState = inject(QueryParamsService);

  /** The report's catalog slug — its columns and data call come from `FLAT_REPORTS`. */
  slug = input.required<string>();
  filter = input.required<ReportApiFilter>();
  refresh = input(0);

  readonly sizes = [10, 25, 50, 100];
  readonly num = toNum;
  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<FlatData | null>(null);
  page = signal(1);
  pageSize = signal(50);

  config = computed(() => FLAT_REPORTS[this.slug()]);
  /** A report with coloured columns also gets dark headers on its plain columns. */
  hasTones = computed(() => !!this.config()?.columns.some(c => c.tone));
  /** The config's columns; a `spread` column is replaced by one currency column per key found in the rows (the payment methods). */
  columns = computed<FlatColumn[]>(() => {
    const c = this.config();
    if (!c.spread) return c.columns;
    const keys = new Set<string>();
    for (const r of this.data()?.records ?? []) for (const k of Object.keys((r[c.spread] as Record<string, unknown>) ?? {})) keys.add(k);
    const dyn: FlatColumn[] = [...keys].map(k => ({ key: 'sp:' + k, label: k, type: 'currency' as const, end: true, total: true }));
    return c.columns.flatMap(col => (col.key === c.spread ? dyn : [col]));
  });
  hasTotal = computed(() => this.columns().some(c => c.total));
  /** Tiles above the table (the same tiles as Sales Summary): a column's sum over the rows shown, or the record count (`#records`). */
  kpiItems = computed<ReportKpi[]>(() => {
    const d = this.data();
    const list = this.config().kpis ?? [];
    if (!d || !list.length) return [];
    const tone: Record<string, ReportKpi['tone']> = { green: 'income', red: 'expense', blue: 'asset', orange: 'liability', amber: 'liability', purple: 'equity', teal: 'profit' };
    return list.map(k => {
      const col = this.columns().find(c => c.key === k.key);
      let value: number;
      if (k.key === '#records') value = d.count;
      else if (k.weightBy) {
        // a percentage averaged over the rows, each weighted by its scheduled days (the whole branch set, not a plain mean)
        const w = d.records.reduce((s, r) => s + toNum(r[k.weightBy!]), 0);
        value = w > 0 ? d.records.reduce((s, r) => s + toNum(r[k.key]) * toNum(r[k.weightBy!]), 0) / w : 0;
      } else value = d.records.reduce((s, r) => s + toNum(r[k.key]), 0);
      const type = k.weightBy ? 'percent' as const : col?.type === 'currency' ? 'currency' as const : 'number' as const;
      return { label: k.key === '#records' ? 'REPORTS.FLAT.RECORDS' : (k.label ?? this.labelOf(col ?? { key: k.key })), value, type, tone: tone[k.tone] };
    });
  });
  /** The figures above the table (the Daily Attendance Sheet's scheduled / present / late …), as the same tiles as Sales Summary. */
  summaryItems = computed<ReportKpi[]>(() => {
    const keys = this.config().summary ?? [];
    const sm = this.data()?.summary;
    if (!sm) return [];
    const tone: Record<string, ReportKpi['tone']> = { green: 'income', red: 'expense', blue: 'asset', orange: 'liability', amber: 'liability', purple: 'equity', teal: 'profit' };
    return keys.filter(k => sm[k.key] !== undefined).map(k => ({ label: 'REPORTS.FLAT.SUMMARY.' + k.key, value: Number(sm[k.key]) || 0, type: 'number' as const, tone: tone[k.tone] }));
  });

  /** How the rows are grouped, if they are: nested groups from the backend, or runs of one field in flat rows. */
  private grouping = computed<{ groupColumn: string; nested?: { groupKey: string; listKey: string }; flatField?: string } | null>(() => {
    const c = this.config();
    if (c.grouped) return { groupColumn: c.grouped.groupColumn, nested: c.grouped };
    if (c.groupedBy) {
      const o = c.groupedBy.options[String(this.filter()[c.groupedBy.filterKey] ?? c.groupedBy.default ?? '')];
      if (!o) return null;
      return o.listKey ? { groupColumn: o.groupColumn, nested: { groupKey: o.groupKey!, listKey: o.listKey } } : { groupColumn: o.groupColumn, flatField: o.flatField };
    }
    if (c.groupBy) return { groupColumn: c.groupBy.field, flatField: c.groupBy.field };
    return null;
  });
  /** The column that carries the "Subtotal" label of a group's subtotal row — the first one that is not the merged group column. */
  labelColumn = computed(() => this.columns().find(c => c.key !== this.groupColumn())?.key ?? null);
  /** The column that names the group — shown on the group's first row only. */
  groupColumn = computed(() => this.grouping()?.groupColumn ?? null);
  /** A second column merged inside each group (the cashier within a date). */
  secondColumn = computed(() => this.config().groupBy?.then ?? null);

  /** Rows to draw: the records, or each group's rows followed by its subtotal. */
  rows = computed<Row[]>(() => {
    const d = this.data();
    if (!d) return [];
    const g = this.grouping();
    if (!g) return d.records.map(rec => ({ kind: 'data' as const, rec, first: false }));
    const totalCols = this.columns().filter(c => c.total);
    const out: Row[] = [];
    if (g.nested) {
      for (const grp of d.records) {
        const list: FlatRecord[] = grp[g.nested.listKey] ?? [];
        const start = out.length;
        list.forEach((rec, i) => out.push({ kind: 'data', rec: { ...rec, [g.groupColumn]: grp[g.nested!.groupKey] }, first: i === 0 }));
        if (totalCols.length) {
          const sub: FlatRecord = {};
          for (const c of totalCols) sub[c.key] = list.reduce((s, r) => s + toNum(r[c.key]), 0);
          out.push({ kind: 'subtotal', rec: sub, first: false, group: grp[g.nested.groupKey] || '' });
        }
        if (out.length > start) out[start].span = out.length - start;
      }
      return out;
    }
    // flat rows, a run of one value is a group
    const mapping = this.config().groupBy?.subtotal;
    let run: FlatRecord[] = [];
    const flush = () => {
      if (!run.length) return;
      const start = out.length;
      run.forEach((rec, i) => out.push({ kind: 'data', rec, first: i === 0 }));
      if (totalCols.length && !this.config().groupBy?.noSubtotal) {
        const sub: FlatRecord = {};
        for (const c of totalCols) sub[c.key] = mapping?.[c.key] ? toNum(run[0][mapping[c.key]]) : run.reduce((s, r) => s + toNum(r[c.key]), 0);
        out.push({ kind: 'subtotal', rec: sub, first: false, group: run[0][g.flatField!] || '' });
      }
      out[start].span = out.length - start;
      const then = this.config().groupBy?.then;
      if (then) {
        let from = start;
        for (let i = start; i <= out.length; i++) {
          const cur = out[i];
          if (cur && cur.kind === 'data' && i > from && out[from].rec[then] === cur.rec[then]) continue;
          if (i > from && out[from].kind === 'data') { out[from].first2 = true; out[from].span2 = i - from; }
          from = i;
        }
      }
      run = [];
    };
    for (const rec of d.records) {
      if (run.length && run[0][g.flatField!] !== rec[g.flatField!]) flush();
      run.push(rec);
    }
    flush();
    return out;
  });
  isEmpty = computed(() => !!this.data() && this.rows().filter(r => r.kind === 'data').length === 0);

  /** The Total row: the backend's `total`, else the sum of the subtotals, else the sum of the rows on screen. */
  totals = computed<Record<string, number>>(() => {
    const t = this.data()?.total;
    const subs = this.rows().filter(r => r.kind === 'subtotal');
    const data = this.rows().filter(r => r.kind === 'data');
    const out: Record<string, number> = {};
    for (const c of this.columns()) {
      if (!c.total) continue;
      out[c.key] = t && t[c.key] !== undefined ? toNum(t[c.key]) : (subs.length ? subs : data).reduce((s, r) => s + toNum(r.rec[c.key]), 0);
    }
    return out;
  });

  private seq = 0;
  private prevKey = '';

  constructor() {
    const u = this.urlState.read(PAGING_PARAMS);
    this.page.set(u.page);
    this.pageSize.set(pickPageSize(u.limit, this.sizes));
    effect(() => {
      const key = this.slug() + JSON.stringify(this.filter());
      this.refresh();
      untracked(() => {
        if (this.prevKey && this.prevKey !== key) { this.page.set(1); this.persist(); }
        this.prevKey = key;
        void this.load();
      });
    });
  }

  async load(): Promise<void> {
    const mine = ++this.seq;
    this.loading.set(true);
    this.error.set(null);
    try {
      const c = this.config();
      const d = await this.svc.load(c.route, this.filter(), c.paged ? { page: this.page(), limit: this.pageSize() } : null);
      if (c.expand) d.records = d.records.flatMap(r => (Array.isArray(r[c.expand!]) ? r[c.expand!] : []).map((x: any) => { const { [c.expand!]: _drop, ...rest } = r; return { ...rest, ...x }; }));
      if (c.spread) d.records = d.records.map(r => ({ ...r, ...Object.fromEntries(Object.entries((r[c.spread!] as Record<string, unknown>) ?? {}).map(([k, v]) => ['sp:' + k, v])) }));
      if (c.map) d.records = d.records.map(c.map);
      if (mine === this.seq) this.data.set(d);
    } catch (e: any) {
      if (mine !== this.seq) return;
      this.error.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.data.set(null);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  private persist(): void {
    this.urlState.write(PAGING_PARAMS, { page: this.page(), limit: this.pageSize(), sortBy: '', sortDirection: 'asc' });
  }
  goTo(p: number): void { this.page.set(p); this.persist(); void this.load(); }
  setSize(n: number): void { this.pageSize.set(n); this.page.set(1); this.persist(); void this.load(); }

  /** A product's stock card for the same period and branches (Product Movement). */
  movementParams(rec: FlatRecord): Record<string, string | null> {
    const f = this.filter();
    return {
      preset: 'custom', fromDate: f.fromDate ?? null, toDate: f.toDate ?? null,
      branches: f.branches?.length ? f.branches.join(',') : null, products: rec['productId'] ?? null,
    };
  }
  /** The page of the document a cell links to (an invoice, a credit note …). */
  docLink = (rec: FlatRecord, c: FlatColumn): string => journalLink(c.doc!.type, rec[c.doc!.idKey]);
  /** Another report for the row's customer, over the same period and branches. */
  drillParams(rec: FlatRecord, c: FlatColumn): Record<string, string | null> {
    const f = this.filter();
    return {
      preset: 'custom', fromDate: f.fromDate ?? null, toDate: f.toDate ?? null,
      branches: f.branches?.length ? f.branches.join(',') : null, [c.drill!.param ?? 'customers']: rec[c.drill!.idKey] ?? c.drill!.fallback ?? null,
    };
  }
  labelOf = (c: FlatColumn): string => c.label ?? `REPORTS.FLAT.COLUMNS.${c.key}`;
  isEmptyVal = (v: unknown): boolean => v === null || v === undefined || v === '';

  /** Colour of a stock-status badge (the legacy mapping). */
  statusClass(s: string | null | undefined): string {
    switch ((s ?? '').toLowerCase()) {
      case 'low': case 'low stock': return 'fl-warn';
      case 'out': case 'out of stock': case 'critical': return 'fl-bad';
      case 'ok': case 'in stock': case 'normal': return 'fl-ok';
      default: return 'fl-muted';
    }
  }
  /** A purchase order's conversion status: its badge colour and the translation key of its label. */
  /** An interval object (or an already formatted string) as "Xh Ym Zs". */
  interval(v: any): string {
    if (v == null || v === '') return '-';
    if (typeof v === 'string') return v;
    const h = (Number(v.days) || 0) * 24 + (Number(v.hours) || 0);
    return `${h}h ${Number(v.minutes) || 0}m ${Math.floor(Number(v.seconds) || 0)}s`;
  }
  /** A duration in seconds as "Xh Ym" (or "Ym Zs" under an hour). */
  seconds(v: any): string {
    const n = Number(v);
    if (v == null || v === '' || !Number.isFinite(n)) return '-';
    const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), sec = Math.floor(n % 60);
    return h ? `${h}h ${m}m` : `${m}m ${sec}s`;
  }
  /** The photo being previewed (hover / focus on a photo icon). */
  photo = signal<{ url: string; label: string; x: number; y: number; below: boolean } | null>(null);
  showPhoto(ev: Event, url: string | null | undefined, label: string): void {
    if (!url) return;
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const below = r.top < 230;
    this.photo.set({ url, label, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below });
  }
  hidePhoto(): void { this.photo.set(null); }
  /** A row's shifts (the Daily Attendance Sheet carries them as `shifts`). */
  shiftsOf(rec: FlatRecord): { clockedInMediaUrl?: string | null; clockedOutMediaUrl?: string | null }[] { return Array.isArray(rec['shifts']) ? rec['shifts'] : []; }
  /** An age in seconds: "47h 12m" under two days, "10d 7h" from two days on. */
  ageText(v: any): string {
    const n = Number(v);
    if (v == null || v === '' || !Number.isFinite(n)) return '-';
    const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60);
    return h < 48 ? `${h}h ${m}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
  }
  /** A backend status word (`on_time`, `Late`, `absent` …) as readable text. */
  tagText(v: any): string {
    const raw = String(v ?? '').replace(/[_-]+/g, ' ').trim();
    // "no clock in" / "no clock out" read as "No clock-in" / "No clock-out"
    const t = raw.replace(/^(no clock) (in|out)$/i, '$1-$2');
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : '-';
  }
  tagClass(v: any): string {
    const t = String(v ?? '').toLowerCase();
    if (/(on[ _-]?time|present|excellent|good|ok|clocked out|normal)/.test(t)) return 'fl-ok';
    if (/(late|adjusted|upcoming|fair|leave|warn|over limit|approaching|unscheduled|no[ _-]clock)/.test(t)) return 'fl-warn';
    if (/(absent|missing|poor|critical|exceed|over|no[ _-]?show|needs[ _-]?improvement)/.test(t)) return 'fl-bad';
    return 'fl-muted';
  }
  /** HH:mm of a date-time value; a dash when there is none. */
  timeOf(v: any): string {
    if (!v) return '-';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '-' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  conversionClass(s: string | null | undefined): string { return s === 'Fully Converted' ? 'fl-ok' : s === 'Partially Converted' ? 'fl-warn' : 'fl-bad'; }
  conversionKey(s: string | null | undefined): string { return s === 'Fully Converted' ? 'FULL' : s === 'Partially Converted' ? 'PARTIAL' : 'NOT'; }
  /** Out-going movements red, in-coming green, anything else grey. */
  directionClass(t: string | null | undefined): string {
    const v = (t ?? '').toLowerCase();
    return /\bout\b/.test(v) ? 'fl-bad' : /\bin\b/.test(v) ? 'fl-ok' : 'fl-muted';
  }
  /** Stock on hand against its reorder point / level. */
  stockClass(rec: FlatRecord, key: string): string {
    const n = toNum(rec[key]);
    return n <= 0 ? 'fl-text-bad fl-bold' : n <= toNum(rec['reorderPoint']) ? 'fl-text-bad' : n <= toNum(rec['reorderLevel']) ? 'fl-text-warn' : '';
  }
  stockoutClass(d: string | null | undefined): string {
    const n = this.daysTo(d);
    return n === null ? 'fl-muted' : n <= 7 ? 'fl-bad' : n <= 14 ? 'fl-warn' : n <= 30 ? 'fl-info' : 'fl-ok';
  }
  /** Whole days from today to a date (negative = in the past). */
  daysTo(d: string | null | undefined): number | null {
    if (!d) return null;
    const t = new Date(d);
    if (isNaN(t.getTime())) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    t.setHours(0, 0, 0, 0);
    return Math.round((t.getTime() - today.getTime()) / 86400000);
  }
  expiryClass(d: string | null | undefined): string {
    const n = this.daysTo(d);
    return n === null ? 'fl-muted' : n < 0 ? 'fl-bad' : n <= 30 ? 'fl-warn' : 'fl-ok';
  }
  profitPctClass(v: unknown): string { const n = toNum(v); return n < 0 ? 'fl-bad' : n < 20 ? 'fl-warn' : 'fl-ok'; }

  trackRow = (i: number, r: Row) => `${r.kind}|${i}`;
}
