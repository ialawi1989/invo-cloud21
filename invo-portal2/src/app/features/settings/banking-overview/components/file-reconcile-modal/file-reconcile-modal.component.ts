import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { ReconciliationTransaction } from '../../services/banking-overview.types';
import { ParsedCsv, RECONCILIATION_FILE_ACCEPT, parseReconciliationFile } from '../../pages/file-reconciliation/file-reconciliation-csv';
import {
  ColumnMapping,
  CsvRow,
  MatchMethod,
  MatchedPair,
  ReconciliationResult,
  normalizeAmount,
  normalizeDate,
  reconcile,
} from '../../pages/file-reconciliation/file-reconciliation-engine';

export interface FileReconcileModalData {
  /** The sheet's own rows (the reconciliation form's grid) — the statement is compared against these. */
  transactions: ReconciliationTransaction[];
}

type ResultTab = 'matched' | 'notInBooks' | 'outstanding';
type AmountMode = 'single' | 'split';

/** Both sides are converted to these columns so one engine call compares them. */
const COMMON: ColumnMapping = { referenceCol: 'Reference', amountCol: 'Amount', dateCol: 'Date' };
const ID_KEY = '__id';

const REFERENCE_HINTS = ['reference', 'ref', 'rrn', 'retrieval', 'receipt', 'invoice', 'transaction id', 'txn id', 'trx id', 'auth code', 'approval code'];
const AMOUNT_HINTS = ['amount', 'amt', 'total', 'value', 'sum'];
const DATE_HINTS = ['date', 'datetime', 'timestamp', 'time'];
const DESCRIPTION_HINTS = ['description', 'details', 'narration', 'narrative', 'memo', 'particulars', 'remarks', 'payee', 'name'];
const IN_HINTS = ['deposit', 'money in', 'paid in', 'received', 'credit'];
const OUT_HINTS = ['withdrawal', 'money out', 'paid out', 'payment', 'debit'];

function headerWords(header: string): string[] {
  return header.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** First header (whole-word hint match, hint order = priority) whose column has at least one value. */
function guessColumn(headers: string[], rows: CsvRow[], hints: string[], exclude: (string | null)[] = []): string | null {
  const candidates = headers
    .filter(h => !exclude.includes(h) && rows.some(r => (r[h] ?? '').trim()))
    .map(h => ({ header: h, words: ` ${headerWords(h).join(' ')} ` }));
  for (const hint of hints) {
    const match = candidates.find(c => c.words.includes(` ${hint} `));
    if (match) return match.header;
  }
  return null;
}

/** A reference that is really just a placeholder ("—", "-", "n/a") counts as empty. */
function cleanReference(v: string | undefined): string {
  const s = (v ?? '').trim();
  return /^[-–—.\s]*$/.test(s) || /^n\/?a$/i.test(s) ? '' : s;
}

/**
 * "Reconcile by file" as a modal over the reconciliation form. The statement is compared with the sheet's rows and
 * the outcome is laid out the way an accountant reads a bank reconciliation:
 *   - matched            → ticked here (you can untick any)
 *   - on the statement, not in the books → missing entries (bank charges, interest …)
 *   - in the books, not on the statement → outstanding items (uncleared cheques / deposits)
 * Matching is live (no "run" button): change a column, the method or a tolerance and the result updates.
 * Nothing is saved here — "Tick N matched" closes the modal and the form ticks those rows.
 */
@Component({
  selector: 'app-file-reconcile-modal',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule, MycurrencyPipe,
    ModalHeaderComponent, ModalFooterComponent, SearchDropdownComponent, SegmentedToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './file-reconcile-modal.component.html',
  styleUrl: './file-reconcile-modal.component.scss',
})
export class FileReconcileModalComponent {
  data  = inject<FileReconcileModalData>(MODAL_DATA);
  ref   = inject<ModalRef<string[]>>(MODAL_REF);
  private toast = inject(ToastService);

  readonly fileAccept = RECONCILIATION_FILE_ACCEPT;

  // ─── Statement + column mapping ───────────────────────────────────────
  file     = signal<ParsedCsv | null>(null);
  fileName = signal<string>('');
  parsing  = signal<boolean>(false);

  dateCol   = signal<string | null>(null);
  refCol    = signal<string | null>(null);
  descCol   = signal<string | null>(null);
  amountMode = signal<AmountMode>('single');
  amountCol = signal<string | null>(null);
  inCol     = signal<string | null>(null);
  outCol    = signal<string | null>(null);

  amountModeOptions: SegmentedToggleOption<AmountMode>[] = [
    { value: 'single', label: 'BANKING_OVERVIEW.FILE_RECONCILIATION.AMOUNT_SINGLE' },
    { value: 'split',  label: 'BANKING_OVERVIEW.FILE_RECONCILIATION.AMOUNT_SPLIT' },
  ];

  // ─── Matching rules ───────────────────────────────────────────────────
  /** Reference first, then amount + date for what is left — the most matches with the fewest false ones. */
  method     = signal<MatchMethod>('both');
  amountTol  = signal<number>(0);
  /** Banks usually post a day or two after the books. */
  dateWindow = signal<number>(2);
  methodOptions: SegmentedToggleOption<MatchMethod>[] = [
    { value: 'both',        label: 'BANKING_OVERVIEW.FILE_RECONCILIATION.METHOD_BOTH' },
    { value: 'reference',   label: 'BANKING_OVERVIEW.FILE_RECONCILIATION.METHOD_REFERENCE' },
    { value: 'amount-date', label: 'BANKING_OVERVIEW.FILE_RECONCILIATION.METHOD_AMOUNT_DATE' },
  ];
  usesAmountDate = computed(() => this.method() !== 'reference');

  // ─── Statement → comparable lines ─────────────────────────────────────
  private hasAmount = computed(() =>
    this.amountMode() === 'single' ? !!this.amountCol() : !!(this.inCol() || this.outCol()));

  /** Whether the amount mapping is usable for the chosen method (reference matching needs no amount). */
  canMatch = computed(() => {
    if (!this.file()?.rows.length) return false;
    const m = this.method();
    const refOk = !!this.refCol();
    const amtOk = this.hasAmount() && !!this.dateCol();
    return m === 'reference' ? refOk : m === 'amount-date' ? amtOk : refOk || amtOk;
  });

  /**
   * Statement lines in the common shape. `signed`: money in is +, money out is − (two-column statements, or a single
   * column that carries negatives) so a deposit can never match a withdrawal of the same size; otherwise amounts are
   * compared without direction. Rows with no amount and no reference (headings, totals) are skipped.
   */
  prepared = computed(() => {
    const f = this.file();
    if (!f) return { lines: [] as CsvRow[], skipped: 0, signed: false };
    const split = this.amountMode() === 'split';
    const raw = f.rows.map(r => {
      let amount = 0;
      if (split) {
        const inn = this.inCol() ? Math.abs(normalizeAmount(r[this.inCol()!])) : 0;
        const out = this.outCol() ? Math.abs(normalizeAmount(r[this.outCol()!])) : 0;
        amount = inn - out;
      } else if (this.amountCol()) {
        amount = normalizeAmount(r[this.amountCol()!]);
      }
      return { r, amount, ref: this.refCol() ? cleanReference(r[this.refCol()!]) : '' };
    });
    const kept = raw.filter(x => x.amount !== 0 || x.ref);
    const signed = split || kept.some(x => x.amount < 0);
    const lines = kept.map(x => ({
      Reference:   x.ref,
      Amount:      String(signed ? x.amount : Math.abs(x.amount)),
      Date:        this.dateCol() ? normalizeDate(x.r[this.dateCol()!]) : '',
      Description: this.descCol() ? (x.r[this.descCol()!] ?? '') : '',
    }));
    return { lines, skipped: raw.length - kept.length, signed };
  });

  /** The sheet's rows in the same shape (Debit = money in, Credit = money out). */
  private books = computed<CsvRow[]>(() => {
    const signed = this.prepared().signed;
    return this.data.transactions.map(t => {
      const net = (t.Debit || 0) - (t.Credit || 0);
      return {
        Reference:   t.referenceNumber || '',
        Amount:      String(signed ? net : Math.abs(net)),
        Date:        t.date ? normalizeDate(String(t.date)) : '',
        Description: [t.reference, t.transactionDetails].filter(Boolean).join(' · '),
        [ID_KEY]:    t.id,
      };
    });
  });

  /** Share of statement lines with no reference — when nearly all are empty, reference matching can't work. */
  refBlankShare = computed(() => {
    const lines = this.prepared().lines;
    if (!this.refCol() || !lines.length) return 0;
    return lines.filter(l => !l['Reference']).length / lines.length;
  });
  refWarning = computed(() => !!this.refCol() && this.method() !== 'amount-date' && this.refBlankShare() >= 0.9);

  // ─── Result (live) ────────────────────────────────────────────────────
  result = computed<ReconciliationResult | null>(() => {
    if (!this.canMatch()) return null;
    const mapping1: ColumnMapping = { ...COMMON, referenceCol: this.refCol() ? 'Reference' : null };
    const method = this.method();
    // Without an amount/date mapping only reference matching is possible, whatever was chosen.
    const effective: MatchMethod = this.hasAmount() && this.dateCol() ? method : 'reference';
    return reconcile(this.prepared().lines, this.books(), mapping1, COMMON, effective, this.amountTol(), this.dateWindow());
  });

  resultTab = signal<ResultTab>('matched');

  private sum = (rows: CsvRow[]) => rows.reduce((s, r) => s + Math.abs(Number(r['Amount']) || 0), 0);
  tiles = computed(() => {
    const r = this.result();
    return {
      matched:     { count: r?.matched.length ?? 0,        total: r ? this.sum(r.matched.map(p => p.file1)) : 0 },
      notInBooks:  { count: r?.unmatchedFile1.length ?? 0, total: r ? this.sum(r.unmatchedFile1) : 0 },
      outstanding: { count: r?.unmatchedFile2.length ?? 0, total: r ? this.sum(r.unmatchedFile2) : 0 },
    };
  });

  // ─── Which matches to apply ───────────────────────────────────────────
  /** Matched ids the user has unticked (everything matched starts ticked). */
  excluded = signal<ReadonlySet<string>>(new Set());
  matchedIds = computed<string[]>(() => (this.result()?.matched ?? []).map(p => p.file2[ID_KEY]).filter(Boolean));
  checkedIds = computed<string[]>(() => this.matchedIds().filter(id => !this.excluded().has(id)));
  allChecked  = computed(() => this.matchedIds().length > 0 && this.checkedIds().length === this.matchedIds().length);
  someChecked = computed(() => this.checkedIds().length > 0 && !this.allChecked());

  isChecked(id: string): boolean { return !this.excluded().has(id); }
  toggle(id: string): void {
    this.excluded.update(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  toggleAll(on: boolean): void { this.excluded.set(on ? new Set() : new Set(this.matchedIds())); }
  idOf(row: CsvRow): string { return row[ID_KEY] ?? ''; }

  apply(): void { this.ref.close(this.checkedIds()); }

  // ─── File handling ────────────────────────────────────────────────────
  constructor() { withTranslations('settings/banking-overview'); }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await this.load(file);
    input.value = '';
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) await this.load(file);
  }

  private async load(file: File): Promise<void> {
    this.parsing.set(true);
    try {
      const parsed = await parseReconciliationFile(file);
      if (!parsed.headers.length) {
        this.toast.error('BANKING_OVERVIEW.FILE_RECONCILIATION.ERROR_EMPTY_FILE');
        return;
      }
      this.applyFile(parsed, file.name);
    } catch (e) {
      console.error('[file-reconcile-modal] parse failed', e);
      this.toast.error('BANKING_OVERVIEW.FILE_RECONCILIATION.ERROR_PARSE_FAILED');
    } finally {
      this.parsing.set(false);
    }
  }

  /** Sets the statement and pre-fills the column pickers from the header names (all editable). */
  applyFile(parsed: ParsedCsv, name: string): void {
    this.file.set(parsed);
    this.fileName.set(name);
    this.excluded.set(new Set());
    const { headers, rows } = parsed;
    const date = guessColumn(headers, rows, DATE_HINTS);
    const ref  = guessColumn(headers, rows, REFERENCE_HINTS, [date]);
    const amt  = guessColumn(headers, rows, AMOUNT_HINTS, [date, ref]);
    const inn  = guessColumn(headers, rows, IN_HINTS, [date, ref]);
    const out  = guessColumn(headers, rows, OUT_HINTS, [date, ref, inn]);
    this.dateCol.set(date);
    this.refCol.set(ref);
    this.descCol.set(guessColumn(headers, rows, DESCRIPTION_HINTS, [date, ref]));
    // Separate money-in / money-out columns beat a single "amount" guess.
    if (inn && out && !amt) {
      this.amountMode.set('split'); this.inCol.set(inn); this.outCol.set(out); this.amountCol.set(null);
    } else {
      this.amountMode.set('single'); this.amountCol.set(amt ?? inn ?? out); this.inCol.set(inn); this.outCol.set(out);
    }
    this.resultTab.set('matched');
  }

  clearFile(): void {
    this.file.set(null); this.fileName.set('');
    this.dateCol.set(null); this.refCol.set(null); this.descCol.set(null);
    this.amountCol.set(null); this.inCol.set(null); this.outCol.set(null);
    this.excluded.set(new Set());
  }

  private single(v: string | string[] | null): string | null { return Array.isArray(v) ? (v[0] ?? null) : v; }
  setDate(v: string | string[] | null): void   { this.dateCol.set(this.single(v)); }
  setRef(v: string | string[] | null): void    { this.refCol.set(this.single(v)); }
  setDesc(v: string | string[] | null): void   { this.descCol.set(this.single(v)); }
  setAmount(v: string | string[] | null): void { this.amountCol.set(this.single(v)); }
  setIn(v: string | string[] | null): void     { this.inCol.set(this.single(v)); }
  setOut(v: string | string[] | null): void    { this.outCol.set(this.single(v)); }

  private nonNegative(v: string): number { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : 0; }
  onAmountTol(v: string): void  { this.amountTol.set(this.nonNegative(v)); }
  onDateWindow(v: string): void { this.dateWindow.set(Math.min(30, Math.floor(this.nonNegative(v)))); }

  // ─── Template helpers ─────────────────────────────────────────────────
  num(row: CsvRow): number { return Number(row['Amount']) || 0; }
  /** Statement amount minus books amount of a matched pair (0 when they agree). */
  diff(p: MatchedPair): number { return Math.round((this.num(p.file1) - this.num(p.file2)) * 1000) / 1000; }
}
