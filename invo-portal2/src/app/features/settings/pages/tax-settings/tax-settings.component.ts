import { ChangeDetectionStrategy, Component, DestroyRef, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import type { ListQueryParams, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { ToastService } from '@shared/components/toast/toast.service';
import { ErrorService } from '@core/http/error.service';
import { ModalService } from '@shared/modal/modal.service';
import { AssignTaxModalComponent } from '@shared/components/assign-tax-modal/assign-tax-modal.component';

import { TaxSettingsService } from '../../services/tax-settings.service';

/** The built-in taxes: they can be neither edited nor are they offered an edit button. */
const BUILT_IN = ['Exempt Tax', 'Zero Tax'];

/**
 * Settings > Tax Setting > Manage Tax (`/settings/tax`): the company's taxes in the shared list page
 * (search, sort, paging in the URL). Add / Edit open the tax form; the row menu sets the default tax and
 * assigns a tax to products.
 */
@Component({
  selector: 'app-tax-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective, DropdownMenuBtnComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tax-settings.component.html',
})
export class TaxSettingsComponent {
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private taxService = inject(TaxSettingsService);
  private errorService = inject(ErrorService);
  private router     = inject(Router);
  private modal      = inject(ModalService);
  private toast      = inject(ToastService);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  private i18nTick = signal(0);

  constructor() {
    withTranslations('settings');
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update(n => n + 1));
  }

  private t = (k: string) => this.translate.instant(k);

  columns = computed<TableColumn[]>(() => {
    this.i18nTick();
    return [
      { key: 'name', label: this.t('SETTINGS.TAX.NAME'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'taxPercentage', label: this.t('SETTINGS.TAX.PERCENTAGE'), sortable: true, customTemplate: true, visible: true, order: 1 },
      { key: 'taxType', label: this.t('SETTINGS.TAX.GROUP_TYPE'), customTemplate: true, visible: true, order: 2 },
    ];
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: this.t('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.t('SETTINGS.ITEMS.TAX_SETTINGS') },
    ] as BreadcrumbItem[];
  });

  readonly paginationConfig = { enabled: true, pageLimits: [10, 25, 50, 100], default: 10 };
  readonly sortingConfig = { enabled: true };
  searchConfig = computed(() => { this.i18nTick(); return { enabled: true, placeholder: this.t('SETTINGS.SEARCH_PLACEHOLDER'), debounceMs: 500 }; });
  emptyState = computed(() => { this.i18nTick(); return { title: this.t('MESSAGE.NO_DATA_FOUND'), message: '', icon: 'receipt' }; });

  load = async (params: ListQueryParams) => {
    try {
      const res = await this.taxService.getTaxesList({
        page: params.page,
        limit: params.limit,
        searchTerm: params.searchTerm || '',
        sortBy: params.sortBy ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection } : undefined,
      });
      const list: any[] = res?.list ?? (Array.isArray(res) ? res : []);
      return { list, count: Number(res?.count ?? list.length), pageCount: Number(res?.pageCount ?? 1) || 1 };
    } catch (error) {
      await this.errorService.handleError(error);
      return { list: [], count: 0, pageCount: 1 };
    }
  };

  isGroup = (tax: any): boolean => Array.isArray(tax?.taxes) && tax.taxes.length > 0;
  canEdit = (tax: any): boolean => !BUILT_IN.includes(tax?.name) && !tax?.default;

  addTax(): void { void this.router.navigate(['/settings/tax/new']); }

  editTax(tax: any): void {
    if (this.canEdit(tax)) void this.router.navigate(['/settings/tax', tax.id]);
  }

  rowMenu(tax: any): DropdownMenuBtnItem[] {
    this.i18nTick();
    const items: DropdownMenuBtnItem[] = [];
    if (!tax.default) items.push({ label: 'SETTINGS.BRANCHES.SET_AS_DEFAULT', click: () => void this.setAsDefault(tax.id) });
    items.push({ label: 'SETTINGS.TAX.ASSIGN_TO', click: () => void this.assignTo(tax.id) });
    return items;
  }

  private async setAsDefault(taxId: string): Promise<void> {
    try {
      await this.taxService.setDefaultTax(taxId);
      this.listPage?.refresh();
    } catch (error) {
      await this.errorService.handleError(error);
    }
  }

  private async assignTo(taxId: string): Promise<void> {
    const ref = this.modal.open(AssignTaxModalComponent, { size: 'md', closeable: true, closeOnBackdrop: true, data: { taxId } });
    const params = await ref.afterClosed();
    if (!params) return;
    try {
      await this.taxService.assignTax(params);
      this.toast.success('COMMON.SAVED_OK');
      this.listPage?.refresh();
    } catch (error) {
      await this.errorService.handleError(error);
    }
  }
}
