import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import type { ListQueryParams, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ImportWizardComponent } from '@shared/components/import-wizard/import-wizard.component';
import { ImportSummaryCounts, ImportWizardConfig } from '@shared/components/import-wizard/import-wizard.types';

import { PriceLabelService } from '../../services/price-label.service';
import { PriceLabelSummary } from '../../services/price-label.types';
import { buildPriceLabelImportConfig, buildPriceLabelOptionImportConfig } from '../../components/import-modal/price-label-import.config';

/**
 * Price Label list, on the shared list page (search and paging live in the URL).
 * Each row is a named price list that can override a product's default price; its editor (separate route) keeps the per-product
 * entries. The row's "..." menu has Edit and the two imports (products / options).
 */
@Component({
  selector: 'app-price-label-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective, DropdownMenuBtnComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './price-label-list.component.html',
})
export class PriceLabelListComponent {
  private service    = inject(PriceLabelService);
  private translate  = inject(TranslateService);
  private router     = inject(Router);
  private modal      = inject(ModalService);
  private destroyRef = inject(DestroyRef);
  private listPage   = viewChild(ListPageComponent);

  private i18nTick = signal(0);

  constructor() {
    withTranslations('settings/price-label');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  private t = (k: string) => this.translate.instant(k);

  columns = computed<TableColumn[]>(() => {
    this.i18nTick();
    return [
      { key: 'name', label: this.t('PRICE_LABEL.LIST.NAME'), primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'productsCount', label: this.t('PRICE_LABEL.LIST.PRODUCTS'), customTemplate: true, visible: true, order: 1 },
      { key: 'optionsCount', label: this.t('PRICE_LABEL.LIST.OPTIONS'), customTemplate: true, visible: true, order: 2 },
    ];
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: this.t('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.t('PRICE_LABEL.LIST.TITLE') },
    ] as BreadcrumbItem[];
  });

  readonly paginationConfig = { enabled: true, pageLimits: [15, 30, 60], default: 15 };
  readonly sortingConfig = { enabled: false };
  searchConfig = computed(() => { this.i18nTick(); return { enabled: true, placeholder: this.t('PRICE_LABEL.LIST.SEARCH_PLACEHOLDER'), debounceMs: 500 }; });
  emptyState = computed(() => { this.i18nTick(); return { title: this.t('PRICE_LABEL.LIST.EMPTY'), message: '', icon: 'box' }; });

  load = async (params: ListQueryParams) => {
    const res = await this.service.getList({ page: params.page, limit: params.limit, searchTerm: (params.searchTerm || '').trim() });
    return { list: res.list, count: res.count, pageCount: Math.max(1, Math.ceil(res.count / (params.limit || 15))) };
  };

  /** The row's "..." menu. Import is split by target (products / options): each has its own backend endpoint and pre-flight check. */
  rowMenuItems(row: PriceLabelSummary): DropdownMenuBtnItem[] {
    return [
      { label: 'COMMON.EDIT', click: () => this.edit(row) },
      { label: 'PRICE_LABEL.IMPORT.IMPORT_PRODUCTS', click: () => void this.importRow(row, 'products') },
      { label: 'PRICE_LABEL.IMPORT.IMPORT_OPTIONS', click: () => void this.importRow(row, 'options') },
    ];
  }

  productsCount(r: PriceLabelSummary): number { return r.productsCount ?? r.productsPrices?.length ?? 0; }
  optionsCount(r: PriceLabelSummary): number { return r.optionsCount ?? r.optionsPrices?.length ?? 0; }

  edit(row: PriceLabelSummary): void { void this.router.navigate(['/settings/price-label', row.id || 'new']); }
  addNew(): void { void this.router.navigate(['/settings/price-label', 'new']); }

  /** Import: checks first that no import for this label is already running (the dialog re-checks before submitting). */
  async importRow(row: PriceLabelSummary, kind: 'products' | 'options' = 'products'): Promise<void> {
    const progress = kind === 'products'
      ? await this.service.getBulkImportProgress(row.id)
      : await this.service.getBulkOptionsImportProgress(row.id);
    if (progress && !progress.success) {
      await this.confirm({
        title: this.t('PRICE_LABEL.IMPORT.IN_PROGRESS_TITLE'),
        message: progress.msg || this.t('PRICE_LABEL.IMPORT.IN_PROGRESS_BODY'),
        confirm: this.t('COMMON.OK'),
      });
      return;
    }

    const config = kind === 'products'
      ? buildPriceLabelImportConfig({ id: row.id, name: row.name, service: this.service, translate: this.translate })
      : buildPriceLabelOptionImportConfig({ id: row.id, name: row.name, service: this.service, translate: this.translate });

    const ref = this.modal.open<ImportWizardComponent, ImportWizardConfig, ImportSummaryCounts | undefined>(
      ImportWizardComponent, { size: 'lg', data: config, closeOnBackdrop: false });
    const result = await ref.afterClosed();
    if (result?.successful) this.listPage()?.refresh();
  }

  private async confirm(data: ConfirmModalData): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, { size: 'sm', data, closeOnBackdrop: false });
    return (await ref.afterClosed()) === true;
  }
}
