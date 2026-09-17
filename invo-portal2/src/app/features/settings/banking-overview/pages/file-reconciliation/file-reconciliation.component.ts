import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import type { DateRange } from '@shared/components/datepicker/date-picker.types';
import { ToastService } from '@shared/components/toast/toast.service';

import { BankingOverviewService } from '../../services/banking-overview.service';
import { ReconciliationTransaction } from '../../services/banking-overview.types';
import { ParsedCsv, RECONCILIATION_FILE_ACCEPT, parseReconciliationFile } from './file-reconciliation-csv';
import {
  ColumnMapping,
  CsvRow,
  MatchMethod,
  ReconciliationResult,
  reconcile,
} from './file-reconciliation-engine';

type ResultTab = 'matched' | 'unmatchedFile1' | 'unmatchedFile2';

const EMPTY_MAPPING: ColumnMapping = { referenceCol: null, amountCol: null, dateCol: null };

/** Fixed generic-row shape the account's own transactions are converted
 *  into so they can feed the same `reconcile()` engine as the uploaded
 *  CSV — see `toOurDataRows()`. Column names are ours to pick since we
 *  control the field mapping directly (no user-facing column pickers
 *  are needed for this side). */
const OUR_DATA_HEADERS = ['Reference', 'Amount', 'Date'];
const OUR_DATA_MAPPING: ColumnMapping = { referenceCol: 'Reference', amountCol: 'Amount', dateCol: 'Date' };

/** Best-effort header-name matching so the uploaded file's column
 *  pickers start pre-filled when the header names are recognizable —
 *  the user can always override via the dropdowns. */
const REFERENCE_HINTS = ['reference', 'ref', 'rrn', 'retrieval', 'receipt', 'invoice', 'transaction id', 'txn id', 'trx id', 'auth code', 'approval code'];
const AMOUNT_HINTS = ['amount', 'amt', 'total', 'value', 'debit', 'credit', 'sum'];
const DATE_HINTS = ['date', 'datetime', 'timestamp', 'time'];

/** Hints are matched on whole words of the header (split on spaces,
 *  `_`, `-`, punctuation and camelCase), so `ref` hits "Ref No" but
 *  not "Referral Partner". Columns with no values at all are skipped —
 *  a correctly-named but empty column is never the right default. */
function guessColumn(headers: string[], rows: CsvRow[], hints: string[]): string | null {
  const candidates = headers
    .filter(h => rows.some(r => (r[h] ?? '').trim()))
    .map(h => ({ header: h, words: ` ${headerWords(h).join(' ')} ` }));

  for (const hint of hints) {
    const match = candidates.find(c => c.words.includes(` ${hint} `));
    if (match) return match.header;
  }
  return null;
}

function headerWords(header: string): string[] {
  return header
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * File Reconciliation — one uploaded bank-statement CSV compared against
 * THIS account's own transaction history for a chosen date range.
 *
 * Scoped to `:accountId` (see `banking-overview.routes.ts`): "our data"
 * is fetched live from `BankingOverviewService.getTransactions()` (the
 * same large-limit, single-page trick `reconciliation-form` uses to pull
 * a whole date range at once) and converted into the same generic
 * `{headers, rows}` shape the CSV parser produces for the uploaded file,
 * so the matching engine (`file-reconciliation-engine.ts`) doesn't need
 * to know or care which side came from a file and which came from the
 * API. Matching still runs entirely client-side and nothing is
 * saved/written back — only the "our data" side is now a live fetch
 * instead of a second upload.
 */
@Component({
  selector: 'app-file-reconciliation',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    BreadcrumbsComponent,
    SegmentedToggleComponent,
    SearchDropdownComponent,
    DatePickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './file-reconciliation.component.html',
  styleUrl: './file-reconciliation.component.scss',
})
export class FileReconciliationComponent implements OnInit {
  private route      = inject(ActivatedRoute);
  private service    = inject(BankingOverviewService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private toast      = inject(ToastService);

  private i18nTick = signal(0);

  accountId   = signal<string>('');
  accountName = signal<string>('');

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    const accId = this.accountId();
    return [
      { label: this.translate.instant('MENU.DASHBOARD'), routerLink: '/dashboard' },
      { label: this.translate.instant('BANKING_OVERVIEW.TITLE'), routerLink: '/account/banking-overview' },
      { label: this.accountName() || '—', routerLink: `/account/banking-overview/transactions/${accId}` },
      { label: this.translate.instant('BANKING_OVERVIEW.LIST.RECONCILIATIONS'), routerLink: `/account/banking-overview/reconciliations/${accId}` },
      { label: this.translate.instant('BANKING_OVERVIEW.FILE_RECONCILIATION.TITLE') },
    ];
  });

  // ─── Uploaded file (bank statement) ───────────────────────────────
  file1     = signal<ParsedCsv | null>(null);
  file1Name = signal<string>('');
  parsing1  = signal<boolean>(false);
  mapping1  = signal<ColumnMapping>({ ...EMPTY_MAPPING });

  // ─── Our transactions (fetched, not uploaded) ─────────────────────
  /** Generic-row view of the account's transactions — feeds `reconcile()`
   *  exactly like `file1` does, just built from an API response instead
   *  of a parsed CSV. */
  file2 = signal<ParsedCsv | null>(null);
  mapping2 = signal<ColumnMapping>({ ...OUR_DATA_MAPPING });

  /** Raw rows behind `file2` — kept so rows looked up by transaction
   *  number can be merged in (deduped by id) at reconcile time. */
  private ourTransactions = signal<ReconciliationTransaction[]>([]);

  /** True while the Run button is looking up the file's transaction
   *  numbers on the server. */
  matching = signal<boolean>(false);

  dateRange       = signal<DateRange | null>(null);
  loadingOurData  = signal<boolean>(false);
  ourDataError    = signal<boolean>(false);

  // ─── Match configuration ───────────────────────────────────────────
  method    = signal<MatchMethod>('reference');
  tolerance = signal<number>(0);

  methodOptions: SegmentedToggleOption<MatchMethod>[] = [
    { value: 'reference',   label: 'BANKING_OVERVIEW.FILE_RECONCILIATION.METHOD_REFERENCE' },
    { value: 'amount-date', label: 'BANKING_OVERVIEW.FILE_RECONCILIATION.METHOD_AMOUNT_DATE' },
    { value: 'both',        label: 'BANKING_OVERVIEW.FILE_RECONCILIATION.METHOD_BOTH' },
  ];

  usesAmountDate = computed(() => this.method() === 'amount-date' || this.method() === 'both');

  // ─── Results ────────────────────────────────────────────────────────
  result    = signal<ReconciliationResult | null>(null);
  resultTab = signal<ResultTab>('matched');

  resultTabOptions = computed<SegmentedToggleOption<ResultTab>[]>(() => {
    const r = this.result();
    return [
      { value: 'matched',        label: 'BANKING_OVERVIEW.FILE_RECONCILIATION.TAB_MATCHED',   count: r?.matched.length ?? 0 },
      { value: 'unmatchedFile1', label: 'BANKING_OVERVIEW.FILE_RECONCILIATION.TAB_UNMATCHED_1', count: r?.unmatchedFile1.length ?? 0 },
      { value: 'unmatchedFile2', label: 'BANKING_OVERVIEW.FILE_RECONCILIATION.TAB_UNMATCHED_2', count: r?.unmatchedFile2.length ?? 0 },
    ];
  });

  // ─── Derived readiness ──────────────────────────────────────────────
  /** The mapping fields required by the current match method must be
   *  set on the uploaded file (our side's mapping is always complete —
   *  it's fixed) before reconciliation can run. "Try Both" needs the
   *  full set — reference AND amount+date — since it attempts both per
   *  row. */
  canReconcile = computed<boolean>(() => {
    const f1 = this.file1(); const f2 = this.file2();
    if (!f1?.rows.length || this.matching()) return false;

    const m1 = this.mapping1();
    const method = this.method();

    // Reference matching looks the file's numbers up on the server, so it
    // doesn't need anything loaded for the date range; amount+date does.
    const referenceOk = !!m1.referenceCol;
    const amountDateOk = !!m1.amountCol && !!m1.dateCol && !!f2?.rows.length;

    if (method === 'reference')   return referenceOk;
    if (method === 'amount-date') return amountDateOk;
    return referenceOk && amountDateOk; // 'both'
  });

  constructor() {
    withTranslations('settings/banking-overview');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    this.accountId.set(this.route.snapshot.paramMap.get('accountId') || '');

    // Default to the last 90 days rather than leaving the range empty —
    // gives the tool something useful to fetch on first load.
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 90);
    this.dateRange.set({ start, end });

    try {
      this.accountName.set(await this.service.getAccountName(this.accountId()));
    } catch (e) {
      console.error('[file-reconciliation] getAccountName failed', e);
    }

    void this.fetchOurData();
  }

  // ─── Our transactions (fetch) ───────────────────────────────────────
  onDateRangeChange(value: DateRange | Date | null): void {
    // `mode="range"` always yields a DateRange (or null); the union is
    // only there because DatePickerComponent's output type isn't
    // mode-narrowed.
    this.dateRange.set(value && !(value instanceof Date) ? value : null);
  }

  async fetchOurData(): Promise<void> {
    const accountId = this.accountId();
    const range = this.dateRange();
    if (!accountId || !range?.start || !range?.end) return;

    this.loadingOurData.set(true);
    this.ourDataError.set(false);
    try {
      // Same large-limit, single-page trick `reconciliation-form`'s
      // `startReconciliation()` uses to fetch a whole date range's
      // transactions in one go, without pagination.
      const res = await this.service.getTransactions({
        accountId,
        fromDate:      this.toIsoDate(range.start),
        toDate:        this.toIsoDate(range.end),
        sortDirection: 'ASC',
        page:          1,
        limit:         100000,
      });
      this.ourTransactions.set(res.list);
      this.file2.set(this.toOurDataRows(res.list));
      this.mapping2.set({ ...OUR_DATA_MAPPING });
      this.result.set(null);
    } catch (e) {
      console.error('[file-reconciliation] fetchOurData failed', e);
      this.ourDataError.set(true);
      this.toast.error('BANKING_OVERVIEW.FILE_RECONCILIATION.ERROR_LOAD_TRANSACTIONS');
    } finally {
      this.loadingOurData.set(false);
    }
  }

  /** Converts the account's own transactions into the same generic
   *  `{headers, rows}` shape `parseGenericCsv()` produces, using fixed
   *  column names since we control the field mapping directly — no
   *  column-picker is needed for this side. A single unsigned `Amount`
   *  is used (matching a typical bank-statement CSV's single amount
   *  column) rather than inventing a signed-amount convention the
   *  uploaded file's own single amount column couldn't match against. */
  private toOurDataRows(transactions: ReconciliationTransaction[]): ParsedCsv {
    const rows: CsvRow[] = transactions.map(t => ({
      Reference: t.referenceNumber || t.reference || '',
      Amount:    String(Math.abs(t.Debit || 0) || Math.abs(t.Credit || 0)),
      // ISO `yyyy-MM-dd` — the engine's `normalizeDate()` re-parses
      // whatever lands here, and this format round-trips through
      // `new Date(...)` cleanly regardless of the viewer's locale.
      Date: t.date ? this.toIsoDate(new Date(t.date)) : '',
    }));
    return { headers: [...OUR_DATA_HEADERS], rows };
  }

  /** `yyyy-MM-dd`, local calendar date (not UTC) so day boundaries match
   *  what the user picked regardless of timezone offset. */
  private toIsoDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // ─── Uploaded file ──────────────────────────────────────────────────
  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.parsing1.set(true);
    try {
      const parsed = await parseReconciliationFile(file);
      if (!parsed.headers.length) {
        this.toast.error('BANKING_OVERVIEW.FILE_RECONCILIATION.ERROR_EMPTY_FILE');
        input.value = '';
        return;
      }

      this.file1.set(parsed);
      this.file1Name.set(file.name);
      // Best-effort default mapping from header names — the user can
      // still override any of these via the dropdowns.
      this.mapping1.set({
        referenceCol: guessColumn(parsed.headers, parsed.rows, REFERENCE_HINTS),
        amountCol:    guessColumn(parsed.headers, parsed.rows, AMOUNT_HINTS),
        dateCol:      guessColumn(parsed.headers, parsed.rows, DATE_HINTS),
      });
      // A new file invalidates any previous results.
      this.result.set(null);
    } catch (e) {
      console.error('[file-reconciliation] file parse failed', e);
      this.toast.error('BANKING_OVERVIEW.FILE_RECONCILIATION.ERROR_PARSE_FAILED');
    } finally {
      this.parsing1.set(false);
      input.value = '';
    }
  }

  clearFile(): void {
    this.file1.set(null); this.file1Name.set(''); this.mapping1.set({ ...EMPTY_MAPPING });
    this.result.set(null);
  }

  // ─── Column mapping (uploaded file only — the fetched side's mapping
  // is fixed) ──────────────────────────────────────────────────────────
  // `<app-search-dropdown>`'s `[(value)]` model is typed `T | T[] | null`
  // (it also supports multi-select), even though these pickers are
  // always single-select here — `toSingle` narrows the emitted value
  // back down to the single-column-name shape `ColumnMapping` wants.
  setReferenceCol(col: string | string[] | null): void { this.updateMapping({ referenceCol: this.toSingle(col) }); }
  setAmountCol(col: string | string[] | null): void { this.updateMapping({ amountCol: this.toSingle(col) }); }
  setDateCol(col: string | string[] | null): void { this.updateMapping({ dateCol: this.toSingle(col) }); }

  private toSingle(v: string | string[] | null): string | null {
    return Array.isArray(v) ? (v[0] ?? null) : v;
  }

  private updateMapping(patch: Partial<ColumnMapping>): void {
    this.mapping1.update(m => ({ ...m, ...patch }));
  }

  onMethodChange(method: MatchMethod): void {
    this.method.set(method);
    this.result.set(null);
  }

  onToleranceChange(value: string): void {
    const n = parseFloat(value);
    this.tolerance.set(Number.isFinite(n) && n >= 0 ? n : 0);
  }

  // ─── Reconcile ────────────────────────────────────────────────────────
  /** Reference matching goes through `getReconcilationByTransactionNumber`:
   *  every value in the file's reference column is looked up on the server
   *  (any date), and the hits are merged with the date-range rows before the
   *  client-side engine pairs them up. Amount+date matching still uses only
   *  the date-range rows. */
  async runReconciliation(): Promise<void> {
    const f1 = this.file1();
    if (!f1 || !this.canReconcile()) return;

    const m1 = this.mapping1();
    const method = this.method();
    let transactions = this.ourTransactions();

    this.matching.set(true);
    try {
      if (method !== 'amount-date' && m1.referenceCol) {
        const col = m1.referenceCol;
        const numbers = f1.rows.map(r => (r[col] ?? '').trim()).filter(Boolean);
        const found = await this.service.getTransactionsByTransactionNumber(this.accountId(), numbers);

        const byId = new Map<string, ReconciliationTransaction>();
        for (const t of [...transactions, ...found]) byId.set(t.id || `${t.reference}|${t.referenceNumber}|${t.date}`, t);
        transactions = [...byId.values()];
      }

      // Local only — the date-range rows (`file2`) stay as loaded, so a
      // later run with a different file doesn't inherit these lookups.
      const f2 = this.toOurDataRows(transactions);

      const res = reconcile(
        f1.rows, f2.rows,
        m1, this.mapping2(),
        method, this.tolerance(),
      );
      this.result.set(res);
      this.resultTab.set('matched');
    } catch (e) {
      console.error('[file-reconciliation] getReconcilationByTransactionNumber failed', e);
      this.toast.error('BANKING_OVERVIEW.FILE_RECONCILIATION.ERROR_LOAD_TRANSACTIONS');
    } finally {
      this.matching.set(false);
    }
  }

  resetAll(): void {
    this.file1.set(null);
    this.file1Name.set('');
    this.mapping1.set({ ...EMPTY_MAPPING });
    this.method.set('reference');
    this.tolerance.set(0);
    this.result.set(null);
  }

  // ─── Template helpers ─────────────────────────────────────────────────
  /** Row values in a file's own header order — used to render the
   *  unmatched-file tables generically regardless of the source
   *  export's column layout. */
  cellsFor(row: CsvRow, headers: string[]): string[] {
    return headers.map(h => row[h] ?? '');
  }

  readonly fileAccept = RECONCILIATION_FILE_ACCEPT;

  trackHeader = (_: number, h: string) => h;
}
