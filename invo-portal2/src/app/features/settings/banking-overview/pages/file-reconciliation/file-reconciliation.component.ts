import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { parseGenericCsv, ParsedCsv } from './file-reconciliation-csv';
import {
  ColumnMapping,
  CsvRow,
  MatchMethod,
  ReconciliationResult,
  reconcile,
} from './file-reconciliation-engine';

type ResultTab = 'matched' | 'unmatchedFile1' | 'unmatchedFile2';
type Slot = 1 | 2;

const EMPTY_MAPPING: ColumnMapping = { referenceCol: null, amountCol: null, dateCol: null };

/**
 * File Reconciliation — generic two-file, client-side reconciliation.
 *
 * Deliberately NOT scoped to a bank account: it's a standalone utility
 * for comparing any two CSV exports (bank statement vs. ledger, POS
 * export vs. accounting export, etc.), so it lives as a top-level
 * sibling page under Banking Overview rather than under
 * `reconciliations/:accountId`. Nothing here is persisted — the two
 * files, the column mapping and the match results all live in page
 * state and disappear on navigation, by design (see
 * `file-reconciliation-engine.ts` for the matching algorithm).
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './file-reconciliation.component.html',
  styleUrl: './file-reconciliation.component.scss',
})
export class FileReconciliationComponent {
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private toast      = inject(ToastService);

  private i18nTick = signal(0);

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('MENU.DASHBOARD'), routerLink: '/dashboard' },
      { label: this.translate.instant('BANKING_OVERVIEW.TITLE'), routerLink: '/account/banking-overview' },
      { label: this.translate.instant('BANKING_OVERVIEW.FILE_RECONCILIATION.TITLE') },
    ];
  });

  // ─── Uploaded files ────────────────────────────────────────────────
  file1     = signal<ParsedCsv | null>(null);
  file2     = signal<ParsedCsv | null>(null);
  file1Name = signal<string>('');
  file2Name = signal<string>('');
  parsing1  = signal<boolean>(false);
  parsing2  = signal<boolean>(false);

  // ─── Column mapping (independent per file) ────────────────────────
  mapping1 = signal<ColumnMapping>({ ...EMPTY_MAPPING });
  mapping2 = signal<ColumnMapping>({ ...EMPTY_MAPPING });

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
   *  set on BOTH files before reconciliation can run. "Try Both" needs
   *  the full set — reference AND amount+date — since it attempts
   *  both per row. */
  canReconcile = computed<boolean>(() => {
    const f1 = this.file1(); const f2 = this.file2();
    if (!f1?.rows.length || !f2?.rows.length) return false;

    const m1 = this.mapping1(); const m2 = this.mapping2();
    const method = this.method();

    const referenceOk = !!m1.referenceCol && !!m2.referenceCol;
    const amountDateOk = !!m1.amountCol && !!m1.dateCol && !!m2.amountCol && !!m2.dateCol;

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

  // ─── File upload ────────────────────────────────────────────────────
  async onFileSelected(event: Event, slot: Slot): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const parsingFlag = slot === 1 ? this.parsing1 : this.parsing2;
    parsingFlag.set(true);
    try {
      const text = await file.text();
      const parsed = parseGenericCsv(text);
      if (!parsed.headers.length) {
        this.toast.error('BANKING_OVERVIEW.FILE_RECONCILIATION.ERROR_EMPTY_FILE');
        input.value = '';
        return;
      }

      if (slot === 1) {
        this.file1.set(parsed);
        this.file1Name.set(file.name);
        this.mapping1.set({ ...EMPTY_MAPPING });
      } else {
        this.file2.set(parsed);
        this.file2Name.set(file.name);
        this.mapping2.set({ ...EMPTY_MAPPING });
      }
      // A new file invalidates any previous results.
      this.result.set(null);
    } catch (e) {
      console.error('[file-reconciliation] CSV parse failed', e);
      this.toast.error('BANKING_OVERVIEW.FILE_RECONCILIATION.ERROR_PARSE_FAILED');
    } finally {
      parsingFlag.set(false);
      input.value = '';
    }
  }

  clearFile(slot: Slot): void {
    if (slot === 1) {
      this.file1.set(null); this.file1Name.set(''); this.mapping1.set({ ...EMPTY_MAPPING });
    } else {
      this.file2.set(null); this.file2Name.set(''); this.mapping2.set({ ...EMPTY_MAPPING });
    }
    this.result.set(null);
  }

  // ─── Column mapping ──────────────────────────────────────────────────
  // `<app-search-dropdown>`'s `[(value)]` model is typed `T | T[] | null`
  // (it also supports multi-select), even though these pickers are
  // always single-select here — `toSingle` narrows the emitted value
  // back down to the single-column-name shape `ColumnMapping` wants.
  setReferenceCol(slot: Slot, col: string | string[] | null): void { this.updateMapping(slot, { referenceCol: this.toSingle(col) }); }
  setAmountCol(slot: Slot, col: string | string[] | null): void { this.updateMapping(slot, { amountCol: this.toSingle(col) }); }
  setDateCol(slot: Slot, col: string | string[] | null): void { this.updateMapping(slot, { dateCol: this.toSingle(col) }); }

  private toSingle(v: string | string[] | null): string | null {
    return Array.isArray(v) ? (v[0] ?? null) : v;
  }

  private updateMapping(slot: Slot, patch: Partial<ColumnMapping>): void {
    const target = slot === 1 ? this.mapping1 : this.mapping2;
    target.update(m => ({ ...m, ...patch }));
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
  runReconciliation(): void {
    const f1 = this.file1(); const f2 = this.file2();
    if (!f1 || !f2 || !this.canReconcile()) return;

    const res = reconcile(
      f1.rows, f2.rows,
      this.mapping1(), this.mapping2(),
      this.method(), this.tolerance(),
    );
    this.result.set(res);
    this.resultTab.set('matched');
  }

  resetAll(): void {
    this.file1.set(null); this.file2.set(null);
    this.file1Name.set(''); this.file2Name.set('');
    this.mapping1.set({ ...EMPTY_MAPPING });
    this.mapping2.set({ ...EMPTY_MAPPING });
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

  trackHeader = (_: number, h: string) => h;
}
