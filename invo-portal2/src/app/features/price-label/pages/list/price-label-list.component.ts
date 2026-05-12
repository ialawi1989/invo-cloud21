import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { SkeletonComponent } from '@shared/components/skeleton/skeleton.component';
import { ListShellComponent } from '@shared/components/list-shell/list-shell.component';
import { ModalService } from '@shared/modal/modal.service';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';

import { PriceLabelService } from '../../services/price-label.service';
import { PriceLabelSummary } from '../../services/price-label.types';
import { ImportWizardComponent } from '@shared/components/import-wizard/import-wizard.component';
import {
  ImportSummaryCounts,
  ImportWizardConfig,
} from '@shared/components/import-wizard/import-wizard.types';
import {
  buildPriceLabelImportConfig,
  buildPriceLabelOptionImportConfig,
} from '../../components/import-modal/price-label-import.config';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import {
  QueryParamsService,
  ParamDef,
  IntCodec,
  intCodec,
  StringCodec,
} from '@shared/services/query-params.service';

const QP = {
  page:     { key: 'page',  codec: IntCodec }     as ParamDef<number>,
  pageSize: { key: 'limit', codec: intCodec(15) } as ParamDef<number>,
  search:   { key: 'q',     codec: StringCodec }  as ParamDef<string>,
};

/**
 * Price Label list — paginated, searchable table of named price
 * lists. Each row is a price label that can override a product's
 * default price at runtime; the editor (separate route) lets the
 * user maintain the per-product entries on each label.
 *
 * Same conventions as the receipt-builder list (signals + OnPush +
 * 300ms-debounced server-side search + ConfirmModal-driven delete +
 * CDK-overlay row-actions menu).
 */
@Component({
  selector: 'app-price-label-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule,
    OverlayModule,
    LoadingOverlayComponent,
    SkeletonComponent,
    DropdownMenuBtnComponent,
    ListShellComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './price-label-list.component.html',
  styleUrl: './price-label-list.component.scss',
})
export class PriceLabelListComponent implements OnInit {
  private service   = inject(PriceLabelService);
  private translate = inject(TranslateService);
  private router    = inject(Router);
  private modal     = inject(ModalService);
  private destroyRef = inject(DestroyRef);
  private qp        = inject(QueryParamsService);

  loading = signal<boolean>(false);
  rows    = signal<PriceLabelSummary[]>([]);

  search   = signal<string>('');
  page     = signal<number>(1);
  pageSize = signal<number>(15);
  total    = signal<number>(0);

  /** Items rendered in each row's `…` overflow menu. Built per-row
   *  so the click handlers close over the right `row`. The shared
   *  `<app-dropdown-menu-btn>` (with `appendToBody`) handles open
   *  state and outside-click. */
  rowMenuItems(row: PriceLabelSummary): DropdownMenuBtnItem[] {
    return [
      { label: 'COMMON.EDIT', click: () => this.edit(row) },
      // Import is split by target — same shape as the form's
      // header split menu, so the user picks Products vs. Options
      // before the wizard opens (each hits its own backend
      // endpoint and pre-flight gate).
      { label: 'PRICE_LABEL.IMPORT.IMPORT_PRODUCTS',
        click: () => this.importRow(row, 'products') },
      { label: 'PRICE_LABEL.IMPORT.IMPORT_OPTIONS',
        click: () => this.importRow(row, 'options') },
    ];
  }

  private i18nTick = signal(0);

  pageCount = computed<number>(() => {
    const t = this.total();
    const ps = this.pageSize();
    return t > 0 ? Math.ceil(t / ps) : 1;
  });

  rangeLabel = computed<string>(() => {
    this.i18nTick();
    const t = this.total();
    if (t === 0) return '';
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end   = Math.min(this.page() * this.pageSize(), t);
    return this.translate.instant('COMMON.PAGINATION_RANGE', { start, end, total: t });
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'),       routerLink: '/settings' },
      { label: this.translate.instant('PRICE_LABEL.LIST.TITLE') },
    ];
  });

  constructor() {
    withTranslations('price-label');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const p = this.qp.read(QP);
    this.page.set(p.page);
    this.pageSize.set(p.pageSize);
    this.search.set(p.search);
    await this.load();
  }

  private syncUrl(): void {
    this.qp.write(QP, {
      page:     this.page(),
      pageSize: this.pageSize(),
      search:   this.search(),
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.service.getList({
        page:       this.page(),
        limit:      this.pageSize(),
        searchTerm: this.search().trim(),
      });
      this.rows.set(res.list);
      this.total.set(res.count);
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Search + paging ────────────────────────────────────────────
  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
    this.syncUrl();
    void this.load();
  }

  clearSearch(): void {
    this.search.set('');
    this.page.set(1);
    this.syncUrl();
    void this.load();
  }

  goPrev(): void {
    if (this.page() <= 1 || this.loading()) return;
    this.page.update(p => p - 1);
    this.syncUrl();
    void this.load();
  }

  goNext(): void {
    if (this.page() >= this.pageCount() || this.loading()) return;
    this.page.update(p => p + 1);
    this.syncUrl();
    void this.load();
  }

  // ─── Row actions ────────────────────────────────────────────────
  edit(row: PriceLabelSummary): void {
    void this.router.navigate(['/settings/price-label', row.id || 'new']);
  }

  addNew(): void {
    void this.router.navigate(['/settings/price-label', 'new']);
  }

  /** Per-row Import action. The user picks `'products'` or
   *  `'options'` from the row menu — each routes through its own
   *  pre-flight gate + wizard config (separate Redis keys server-
   *  side, separate validators front-end). The modal also re-checks
   *  the gate before submitting (handles races). */
  async importRow(
    row: PriceLabelSummary,
    kind: 'products' | 'options' = 'products',
  ): Promise<void> {
    const progress = kind === 'products'
      ? await this.service.getBulkImportProgress(row.id)
      : await this.service.getBulkOptionsImportProgress(row.id);
    if (progress && !progress.success) {
      await this.confirm({
        title:   this.translate.instant('PRICE_LABEL.IMPORT.IN_PROGRESS_TITLE'),
        message: progress.msg || this.translate.instant('PRICE_LABEL.IMPORT.IN_PROGRESS_BODY'),
        confirm: this.translate.instant('COMMON.OK'),
      });
      return;
    }

    const config = kind === 'products'
      ? buildPriceLabelImportConfig({
          id: row.id, name: row.name, service: this.service, translate: this.translate,
        })
      : buildPriceLabelOptionImportConfig({
          id: row.id, name: row.name, service: this.service, translate: this.translate,
        });

    const ref = this.modal.open<
      ImportWizardComponent,
      ImportWizardConfig,
      ImportSummaryCounts | undefined
    >(ImportWizardComponent, {
      size: 'lg',
      data: config,
      closeOnBackdrop: false,
    });
    const result = await ref.afterClosed();
    if (result?.successful) await this.load();
  }

  trackRow = (_: number, r: PriceLabelSummary) => r.id;

  private async confirm(data: ConfirmModalData): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      { size: 'sm', data, closeOnBackdrop: false },
    );
    return (await ref.afterClosed()) === true;
  }
}
