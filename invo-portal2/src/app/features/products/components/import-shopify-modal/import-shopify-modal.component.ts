import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { SegmentedToggleComponent } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { BranchConnectionService } from '@core/layout/services/branch.service';

import {
  ShopifyImportRunnerService,
  ShopifyImportOptions,
  ShopifyReportItem,
  defaultShopifyOptions,
} from '../../services/shopify-import-runner.service';

type SourceMode = 'url' | 'file';
type ReportTab  = 'imported' | 'willUpdate' | 'updated' | 'skipped' | 'failed';

/**
 * Import from Shopify — modal (mirrors how the CSV Import/Export
 * dialog works; the legacy screen was a modal too).
 *
 * Drives `POST product/importShopifyProducts` per InvoCloudBack's
 * shopify-import-frontend.md: source → options → mandatory dry-run
 * preview → commit → report. The actual page-by-page loop (and its
 * "resume = just restart, it's idempotent" behavior) lives in the
 * root-provided `ShopifyImportRunnerService`, which keeps running
 * even if this modal is closed mid-import — reopening it re-attaches
 * to the same state instead of losing progress.
 */
@Component({
  selector: 'app-import-shopify-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    SearchDropdownComponent,
    SegmentedToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './import-shopify-modal.component.html',
  styleUrl: './import-shopify-modal.component.scss',
})
export class ImportShopifyModalComponent {
  private translate = inject(TranslateService);
  private branchSvc  = inject(BranchConnectionService);
  private toast      = inject(ToastService);
  ref    = inject<ModalRef<void>>(MODAL_REF);
  runner = inject(ShopifyImportRunnerService);

  constructor() {
    withTranslations('products');
    void this.branchSvc.load().catch(() => {});
  }

  // ─── Wizard step (source/options only — the runner's own status
  //     drives everything from "run" onward) ──────────────────────
  formStep = signal<'source' | 'options'>('source');

  // ─── Source ──────────────────────────────────────────────────────
  sourceMode = signal<SourceMode>('url');
  sourceModeOptions = [
    { value: 'url' as SourceMode,  label: 'PRODUCTS.SHOPIFY_IMPORT.SOURCE_MODE_URL' },
    { value: 'file' as SourceMode, label: 'PRODUCTS.SHOPIFY_IMPORT.SOURCE_MODE_FILE' },
  ];
  sourceUrl   = signal('');
  fileProducts = signal<any[] | null>(null);
  fileName     = signal('');
  fileError    = signal<string | null>(null);

  canGoToOptions = computed(() => {
    if (this.sourceMode() === 'url') return /^https:\/\/.+/i.test(this.sourceUrl().trim());
    return (this.fileProducts()?.length ?? 0) > 0;
  });

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fileError.set(null);
    this.fileName.set(file.name);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const products: any[] = Array.isArray(json)
        ? json
        : Array.isArray(json?.products)
          ? json.products
          : [];
      if (!products.length) {
        this.fileError.set(this.translate.instant('PRODUCTS.SHOPIFY_IMPORT.SOURCE_FILE_INVALID'));
        this.fileProducts.set(null);
        return;
      }
      this.fileProducts.set(products);
    } catch {
      this.fileError.set(this.translate.instant('PRODUCTS.SHOPIFY_IMPORT.SOURCE_FILE_INVALID'));
      this.fileProducts.set(null);
    } finally {
      input.value = '';
    }
  }

  // ─── Options ─────────────────────────────────────────────────────
  branchItems = computed(() =>
    this.branchSvc.branches().map(b => ({ label: b.name || '—', value: b.id })),
  );
  hasMultipleBranches = computed(() => this.branchSvc.branches().length > 1);

  branchId       = signal<string | null>(null);
  unitCost       = signal(0);
  importStock    = signal(true);
  defaultTax     = signal(true);
  departmentName = signal('');
  importImages   = signal(true);
  imageMode      = signal<'link' | 'download'>('link');
  onExisting     = signal<'skip' | 'update'>('skip');
  dropTagsText   = signal('keyword, parent');
  advancedOpen   = signal(false);

  imageModeOptions = [
    { value: 'link' as const,     label: 'PRODUCTS.SHOPIFY_IMPORT.OPTIONS_IMAGE_MODE_LINK' },
    { value: 'download' as const, label: 'PRODUCTS.SHOPIFY_IMPORT.OPTIONS_IMAGE_MODE_DOWNLOAD' },
  ];
  onExistingOptions = [
    { value: 'skip' as const,   label: 'PRODUCTS.SHOPIFY_IMPORT.OPTIONS_ON_EXISTING_SKIP' },
    { value: 'update' as const, label: 'PRODUCTS.SHOPIFY_IMPORT.OPTIONS_ON_EXISTING_UPDATE' },
  ];

  // Per the backend guide: with more than one branch, an unset
  // branchId silently imports every product at zero stock. Make it a
  // hard requirement rather than a warning the user can miss.
  canRunDryRun = computed(() => !this.hasMultipleBranches() || !!this.branchId());

  selectedBranchItem = computed(() =>
    this.branchItems().find(b => b.value === this.branchId()) ?? null,
  );
  onBranchChange(event: any): void {
    const id = event && typeof event === 'object' ? event.value : event;
    this.branchId.set(id ?? null);
  }
  display  = (item: any) => item?.label ?? '';
  compare  = (a: any, b: any) => (a?.value ?? a) === (b?.value ?? b);
  toValue  = (item: any) => item?.value ?? item;

  private buildOptions(): ShopifyImportOptions {
    return {
      ...defaultShopifyOptions(),
      branchId:          this.branchId(),
      unitCost:          Number(this.unitCost()) || 0,
      importStock:       this.importStock(),
      defaultTax:        this.defaultTax(),
      departmentName:    this.departmentName().trim(),
      importImages:      this.importImages(),
      imageMode:         this.imageMode(),
      onExisting:        this.onExisting(),
      dropTagNamespaces: this.dropTagsText().split(',').map(t => t.trim()).filter(Boolean),
    };
  }

  // ─── Run ─────────────────────────────────────────────────────────
  async runDryRun(): Promise<void> {
    this.runner.configure({
      sourceUrl: this.sourceMode() === 'url' ? this.sourceUrl().trim() : undefined,
      products:  this.sourceMode() === 'file' ? (this.fileProducts() ?? undefined) : undefined,
      options:   this.buildOptions(),
    });
    await this.runner.startPreview();
  }

  async commit(): Promise<void> {
    await this.runner.commit();
    if (this.runner.state().status === 'done') {
      this.toast.success('PRODUCTS.SHOPIFY_IMPORT.DONE_TITLE');
    }
  }

  async checkAgain(): Promise<void> {
    await this.runner.retry();
    if (this.runner.state().status === 'done') {
      this.toast.success('PRODUCTS.SHOPIFY_IMPORT.DONE_TITLE');
    }
  }

  async retry(): Promise<void> {
    await this.checkAgain();
  }

  backToOptions(): void {
    this.runner.reset();
  }

  startOver(): void {
    this.runner.reset();
    this.formStep.set('source');
  }

  /** "Done" — the import stays committed either way; this just closes
   *  the dialog and clears the runner so a future open starts fresh. */
  finish(): void {
    this.runner.reset();
    this.ref.close();
  }

  // ─── Report tabs ─────────────────────────────────────────────────
  activeTab = signal<ReportTab>('imported');

  reportTabs = computed(() => {
    const report = this.runner.state().preview ?? this.runner.state().final;
    if (!report) return [];
    const tabs: { key: ReportTab; labelKey: string; count: number }[] = [
      { key: 'imported',   labelKey: 'PRODUCTS.SHOPIFY_IMPORT.TAB_IMPORTED',    count: report.imported.length },
      { key: 'willUpdate', labelKey: 'PRODUCTS.SHOPIFY_IMPORT.TAB_WILL_UPDATE', count: report.willUpdate.length },
      { key: 'updated',    labelKey: 'PRODUCTS.SHOPIFY_IMPORT.TAB_UPDATED',     count: report.updated.length },
      { key: 'skipped',    labelKey: 'PRODUCTS.SHOPIFY_IMPORT.TAB_SKIPPED',     count: report.skipped.length },
      { key: 'failed',     labelKey: 'PRODUCTS.SHOPIFY_IMPORT.TAB_FAILED',      count: report.failed.length },
    ];
    return tabs.filter(t => t.count > 0 || t.key === 'imported' || t.key === 'skipped');
  });

  activeItems = computed<ShopifyReportItem[]>(() => {
    const report = this.runner.state().preview ?? this.runner.state().final;
    if (!report) return [];
    return report[this.activeTab()] ?? [];
  });
}
