import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { WizardStepsComponent, WizardStepItem } from '@shared/components/wizard-steps/wizard-steps.component';
import { ModalRef } from '@shared/modal/modal.service';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { BranchConnectionService } from '@core/layout/services/branch.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { ProductListService } from '../../services/product-list.service';
import {
  EmptyCells,
  MAX_SHEET_ROWS,
  OnExisting,
  ProductSheetColumn,
  ProductSheetImportOptions,
  ProductSheetRegistry,
  ProductSheetReport,
} from '../../models/product-sheet/product-sheet.types';
import {
  ParsedProductSheet,
  groupColumns,
  isSheetFile,
  matchColumn,
  parseProductSheet,
} from '../../utils/product-sheet-parser';
import { ProductSheetExportComponent } from './components/product-sheet-export/product-sheet-export.component';
import { ProductSheetReportComponent } from './components/product-sheet-report/product-sheet-report.component';

type Tab = 'import' | 'export';
type Step = 'file' | 'preview' | 'importing' | 'done';
interface Item { label: string; value: any; group?: string; }

/** How long a column tick or mapping waits before the preview re-runs. */
const RERUN_DELAY_MS = 400;
const POLL_INTERVAL_MS = 1500;

/**
 * Product spreadsheet import & export (v2) — page port of the legacy
 * `product-sheet` modal (`/product/import`, `/product/export`,
 * `/product/import/columns`).
 *
 * Import: pick a file + options, then a dry run shows what would be created,
 * updated, cleared and rejected. Ticking columns off or mapping unknown
 * headers re-runs the dry run. Only then can the same request run for real.
 * Export: choose columns / preset / branch / format and download a file in the
 * layout the import reads back.
 */
@Component({
  selector: 'app-product-sheet',
  standalone: true,
  imports: [
    TranslateModule,
    SearchDropdownComponent,
    SegmentedToggleComponent,
    ProductSheetExportComponent,
    ProductSheetReportComponent,
    ModalHeaderComponent,
    ModalFooterComponent,
    WizardStepsComponent,
  ],
  styleUrl: './product-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-sheet.component.html',
})
export class ProductSheetComponent implements OnDestroy {
  private readonly list = inject(ProductListService);
  private readonly branchSvc = inject(BranchConnectionService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  /** Present when opened from the Import/Export page as a modal; null when routed as a page. */
  private readonly modalRef = inject<ModalRef<void>>(MODAL_REF, { optional: true });
  private readonly modalData = inject<{ tab?: 'import' | 'export' } | null>(MODAL_DATA, { optional: true });
  readonly inModal = !!this.modalRef;

  constructor() {
    withTranslations('products');
    void this.init();
  }

  readonly maxRows = MAX_SHEET_ROWS;

  /** Same four steps as the shared import wizard (Upload → Preview → Import → Done). */
  readonly wizardSteps: WizardStepItem[] = [
    { key: 'file',      label: 'COMMON.IMPORT_WIZARD.STEP_UPLOAD' },
    { key: 'preview',   label: 'COMMON.IMPORT_WIZARD.STEP_PREVIEW' },
    { key: 'importing', label: 'COMMON.IMPORT_WIZARD.STEP_IMPORT' },
    { key: 'done',      label: 'COMMON.IMPORT_WIZARD.STEP_DONE' },
  ];

  tab = signal<Tab>(this.modalData?.tab ?? 'import');
  tabOptions: SegmentedToggleOption<Tab>[] = [
    { value: 'import', label: 'PRODUCTS.PRODUCT_SHEET.IMPORT' },
    { value: 'export', label: 'PRODUCTS.PRODUCT_SHEET.EXPORT' },
  ];

  /** Set when another import holds the lock: previews and exports still work, only the final write is refused. */
  importBusy = signal<string | null>(null);

  registry = signal<ProductSheetRegistry | null>(null);
  registryError = signal<string | null>(null);
  columnGroups = computed(() => (this.registry() ? groupColumns(this.registry()!) : []));
  branches = computed(() => this.branchSvc.branches().map(b => ({ id: b.id as string, name: b.name as string })));

  step = signal<Step>('file');

  // ── File + options ───────────────────────────────────────────
  fileName = signal('');
  sheet = signal<ParsedProductSheet | null>(null);
  fileError = signal<string | null>(null);
  parsing = signal(false);
  /** Bumped to reset the file input so the same file can be picked again. */
  fileKey = signal(0);

  onExisting = signal<OnExisting>('update');
  emptyCells = signal<EmptyCells>('keep');
  branchIds = signal<Set<string>>(new Set());
  stockBranchId = signal<string | null>(null);

  onExistingOptions: SegmentedToggleOption<OnExisting>[] = [
    { value: 'update', label: 'PRODUCTS.PRODUCT_SHEET.EXISTING_UPDATE' },
    { value: 'skip',   label: 'PRODUCTS.PRODUCT_SHEET.EXISTING_SKIP' },
  ];
  emptyCellsOptions: SegmentedToggleOption<EmptyCells>[] = [
    { value: 'keep',  label: 'PRODUCTS.PRODUCT_SHEET.EMPTY_KEEP' },
    { value: 'clear', label: 'PRODUCTS.PRODUCT_SHEET.EMPTY_CLEAR' },
  ];

  // ── Preview ──────────────────────────────────────────────────
  ignoreColumns = signal<Set<string>>(new Set());
  columnMapping = signal<Record<string, string>>({});
  /** Headers the server did not recognise, kept once seen (the dropdown must stay after mapping). */
  mappableHeaders = signal<string[]>([]);

  report = signal<ProductSheetReport | null>(null);
  result = signal<ProductSheetReport | null>(null);
  previewing = signal(false);
  requestError = signal<string | null>(null);
  progress = signal<string | null>(null);

  private previewSeq = 0;
  private rerunHandle: any = null;
  private pollHandle: any = null;

  // ── Derived ──────────────────────────────────────────────────
  private columnFor(header: string): ProductSheetColumn | null {
    const reg = this.registry();
    return reg ? matchColumn(header, reg.columns, this.columnMapping()) : null;
  }

  /** Headers that will actually be imported: recognised and not ticked off. */
  private activeColumns = computed<ProductSheetColumn[]>(() => {
    const ignore = this.ignoreColumns();
    return (this.sheet()?.headers ?? [])
      .filter(h => !ignore.has(h))
      .map(h => this.columnFor(h))
      .filter((c): c is ProductSheetColumn => !!c && !ignore.has(c.key));
  });

  hasBranchColumns = computed(() => this.activeColumns().some(c => c.target === 'branch'));
  hasStockColumn = computed(() => this.activeColumns().some(c => c.key === 'stock' || c.header === 'Stock'));
  /** With one branch the server picks it; with more, the user must. */
  needsStockBranch = computed(() => this.hasStockColumn() && this.branches().length > 1);
  allBranchesSelected = computed(() => this.branchIds().size === this.branches().length);

  optionsValid = computed(() =>
    !!this.sheet()?.rows.length
    && !this.fileError()
    && !!this.registry()
    && (!this.hasBranchColumns() || this.branches().length <= 1 || this.branchIds().size > 0)
    && (!this.needsStockBranch() || !!this.stockBranchId()));

  detectedColumns = computed(() =>
    (this.sheet()?.headers ?? [])
      .filter(h => !this.mappableHeaders().includes(h))
      .map(h => ({ header: h, column: this.columnFor(h), included: !this.ignoreColumns().has(h) })));

  commitCount = computed(() => (this.report()?.summary.created ?? 0) + (this.report()?.summary.updated ?? 0));
  canCommit = computed(() =>
    this.step() === 'preview' && !this.previewing() && !this.requestError()
    && this.commitCount() > 0 && this.optionsValid());

  progressPercent = computed(() => Math.min(100, parseInt((this.progress() ?? '0').replace('%', ''), 10) || 0));

  // Dropdown plumbing
  branchItems = computed<Item[]>(() => this.branches().map(b => ({ label: b.name || '—', value: b.id })));
  selectedStockBranchItem = computed(() => this.branchItems().find(i => i.value === this.stockBranchId()) ?? null);
  mappingItems = computed<Item[]>(() =>
    this.columnGroups().flatMap(g =>
      g.columns.map(c => ({
        label: c.header,
        value: c.key,
        group: this.translate.instant('PRODUCTS.PRODUCT_SHEET.GROUP.' + g.group),
      }))));
  display = (i: any) => i?.label ?? '';
  compare = (a: any, b: any) => (a?.value ?? a) === (b?.value ?? b);
  toValue = (i: any) => i?.value ?? i;
  groupBy = (i: any) => i?.group ?? '';
  mappingItemFor(header: string): Item | null {
    const key = this.columnMapping()[header];
    return key ? this.mappingItems().find(i => i.value === key) ?? null : null;
  }

  // ── Init ─────────────────────────────────────────────────────
  private async init(): Promise<void> {
    void this.branchSvc.load().catch(() => {});
    // Another import holding the lock only blocks the final write; failed check is not fatal.
    this.list.getBulkImportProgress()
      .then(r => { if (r && r.success === false) this.importBusy.set(r.msg || ''); })
      .catch(() => {});

    try {
      const reg = await this.list.getProductSheetColumns();
      this.registry.set(reg);
    } catch (e: any) {
      this.registryError.set(e?.error?.msg || e?.message || this.translate.instant('PRODUCTS.PRODUCT_SHEET.REGISTRY_ERROR'));
      return;
    }
    // Branch list may load after the registry; default selections once it's here.
    const waitBranches = async () => {
      for (let i = 0; i < 20 && this.branchSvc.branches().length === 0; i++) await new Promise(r => setTimeout(r, 150));
      const all = this.branches();
      this.branchIds.set(new Set(all.map(b => b.id)));
      if (all.length === 1) this.stockBranchId.set(all[0].id);
    };
    void waitBranches();
  }

  ngOnDestroy(): void {
    clearTimeout(this.rerunHandle);
    this.stopPolling();
  }

  // ── Step 1: file ─────────────────────────────────────────────
  async onFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.resetFile();
    if (!file) return;
    if (!isSheetFile(file.name)) { this.fileError.set('PRODUCTS.PRODUCT_SHEET.FILE_TYPE_ERROR'); return; }

    this.parsing.set(true);
    try {
      this.fileName.set(file.name);
      const sheet = await parseProductSheet(file);
      this.sheet.set(sheet);
      if (!sheet.rows.length) this.fileError.set('PRODUCTS.PRODUCT_SHEET.FILE_EMPTY');
      else if (sheet.rows.length > MAX_SHEET_ROWS) this.fileError.set('PRODUCTS.PRODUCT_SHEET.FILE_TOO_LARGE');
    } catch {
      this.sheet.set(null);
      this.fileError.set('PRODUCTS.PRODUCT_SHEET.FILE_READ_ERROR');
    } finally {
      this.parsing.set(false);
    }
  }

  clearFile(): void { this.resetFile(); this.fileKey.update(k => k + 1); }

  toggleBranch(id: string, checked: boolean): void {
    const next = new Set(this.branchIds());
    if (checked) next.add(id); else next.delete(id);
    this.branchIds.set(next);
  }

  toggleAllBranches(checked: boolean): void {
    this.branchIds.set(new Set(checked ? this.branches().map(b => b.id) : []));
  }

  onStockBranchChange(ev: any): void {
    const id = ev && typeof ev === 'object' ? ev.value : ev;
    this.stockBranchId.set(id ?? null);
  }

  // ── Step 2: preview ──────────────────────────────────────────
  async preview(): Promise<void> {
    const sheet = this.sheet();
    if (!this.optionsValid() || !sheet) return;
    clearTimeout(this.rerunHandle);
    const seq = ++this.previewSeq;
    this.previewing.set(true);
    this.requestError.set(null);

    try {
      const response = await this.list.importProductSheet({ rows: sheet.rows, options: this.options(true) });
      if (seq !== this.previewSeq) return; // superseded by a newer preview
      if (response?.success && response.data) {
        this.report.set(response.data);
        this.rememberUnknown(response.data.columns?.unknownColumns ?? []);
        this.step.set('preview');
      } else {
        this.requestError.set(response?.msg || this.translate.instant('PRODUCTS.PRODUCT_SHEET.PREVIEW_FAILED'));
      }
    } catch (e: any) {
      if (seq === this.previewSeq) {
        this.requestError.set(e?.error?.msg || e?.message || this.translate.instant('PRODUCTS.PRODUCT_SHEET.PREVIEW_FAILED'));
      }
    } finally {
      if (seq === this.previewSeq) this.previewing.set(false);
    }
  }

  backToFile(): void {
    clearTimeout(this.rerunHandle);
    this.previewSeq++;
    this.previewing.set(false);
    this.report.set(null);
    this.requestError.set(null);
    this.step.set('file');
  }

  toggleColumn(header: string, included: boolean): void {
    const next = new Set(this.ignoreColumns());
    if (included) next.delete(header); else next.add(header);
    this.ignoreColumns.set(next);
    this.scheduleRerun();
  }

  mapColumn(header: string, ev: any): void {
    const key = ev && typeof ev === 'object' ? ev.value : ev;
    if (key) {
      this.columnMapping.update(m => ({ ...m, [header]: key }));
    } else {
      this.columnMapping.update(m => { const { [header]: _, ...rest } = m; return rest; });
    }
    this.scheduleRerun();
  }

  // ── Step 3: import ───────────────────────────────────────────
  async commit(): Promise<void> {
    const sheet = this.sheet();
    if (!this.canCommit() || !sheet) return;
    this.step.set('importing');
    this.progress.set(null);
    this.requestError.set(null);
    this.startPolling();

    try {
      const response = await this.list.importProductSheet({ rows: sheet.rows, options: this.options(false) });
      if (response?.success && response.data) {
        this.result.set(response.data);
        this.step.set('done');
        this.toast.success('PRODUCTS.PRODUCT_SHEET.IMPORT_DONE_TOAST');
      } else {
        this.requestError.set(response?.msg || this.translate.instant('PRODUCTS.PRODUCT_SHEET.IMPORT_FAILED'));
        this.step.set('preview');
      }
    } catch (e: any) {
      this.requestError.set(e?.error?.msg || e?.message || this.translate.instant('PRODUCTS.PRODUCT_SHEET.IMPORT_FAILED'));
      this.step.set('preview');
    } finally {
      this.stopPolling();
    }
  }

  importAnother(): void {
    this.result.set(null);
    this.report.set(null);
    this.clearFile();
    this.step.set('file');
  }

  backToList(): void {
    if (this.modalRef) { this.modalRef.close(); return; }
    void this.router.navigate(['/products/list']);
  }

  // ── Internals ────────────────────────────────────────────────
  private options(dryRun: boolean): ProductSheetImportOptions {
    return {
      dryRun,
      onExisting: this.onExisting(),
      emptyCells: this.emptyCells(),
      // Left out when every branch is ticked: the server default is all
      // branches, which also covers one added since this page opened.
      branchIds: this.hasBranchColumns() && !this.allBranchesSelected() ? [...this.branchIds()] : undefined,
      stockBranchId: this.hasStockColumn() && this.stockBranchId() ? this.stockBranchId()! : undefined,
      ignoreColumns: [...this.ignoreColumns()],
      columnMapping: { ...this.columnMapping() },
    };
  }

  private scheduleRerun(): void {
    clearTimeout(this.rerunHandle);
    this.rerunHandle = setTimeout(() => void this.preview(), RERUN_DELAY_MS);
  }

  private rememberUnknown(headers: string[]): void {
    const known = this.mappableHeaders();
    const add = headers.filter(h => !known.includes(h));
    if (add.length) this.mappableHeaders.set([...known, ...add]);
  }

  private resetFile(): void {
    this.fileName.set('');
    this.sheet.set(null);
    this.fileError.set(null);
    this.report.set(null);
    this.requestError.set(null);
    this.ignoreColumns.set(new Set());
    this.columnMapping.set({});
    this.mappableHeaders.set([]);
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollHandle = setInterval(async () => {
      try {
        const r: any = await this.list.getBulkImportProgress();
        const progress = r?.data?.progress ?? r?.progress ?? null;
        if (progress) this.progress.set(String(progress));
      } catch { /* progress is cosmetic; the import request reports the outcome */ }
    }, POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    clearInterval(this.pollHandle);
    this.pollHandle = null;
  }
}
