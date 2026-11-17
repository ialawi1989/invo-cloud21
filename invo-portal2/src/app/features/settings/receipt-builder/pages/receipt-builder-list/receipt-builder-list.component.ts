import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import type { ListQueryParams, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

import { ReceiptBuilderService } from '../../services/receipt-builder.service';
import { ReceiptTemplateSummary, TemplateType } from '../../services/receipt-builder.types';
import { RenameTemplateModalComponent, RenameTemplateModalData } from './rename-template-modal/rename-template-modal.component';

/**
 * Receipt Builder list, on the shared list page (search and paging live in the URL).
 * The same list holds receipt and kitchen templates, so "Add new" asks which one. A row opens the editor;
 * its "..." menu has Edit, Rename and Delete.
 */
@Component({
  selector: 'app-receipt-builder-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective, DropdownMenuBtnComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './receipt-builder-list.component.html',
})
export class ReceiptBuilderListComponent {
  private service    = inject(ReceiptBuilderService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router     = inject(Router);
  private modal      = inject(ModalService);
  private listPage   = viewChild(ListPageComponent);

  private i18nTick = signal(0);

  constructor() {
    withTranslations('settings/receipt-builder');
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  private t = (k: string) => this.translate.instant(k);

  columns = computed<TableColumn[]>(() => {
    this.i18nTick();
    return [
      { key: 'name', label: this.t('RECEIPT_BUILDER.NAME'), primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'templateType', label: this.t('RECEIPT_BUILDER.TYPE'), customTemplate: true, visible: true, order: 1 },
      { key: 'elementsCount', label: this.t('RECEIPT_BUILDER.ELEMENTS_COUNT'), customTemplate: true, visible: true, order: 2 },
      { key: 'updatedDate', label: this.t('RECEIPT_BUILDER.UPDATED'), customTemplate: true, visible: true, order: 3 },
    ];
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: this.t('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.t('RECEIPT_BUILDER.TITLE') },
    ] as BreadcrumbItem[];
  });

  readonly paginationConfig = { enabled: true, pageLimits: [20, 50, 100], default: 20 };
  readonly sortingConfig = { enabled: false };
  searchConfig = computed(() => { this.i18nTick(); return { enabled: true, placeholder: this.t('RECEIPT_BUILDER.SEARCH_PLACEHOLDER'), debounceMs: 500 }; });
  emptyState = computed(() => { this.i18nTick(); return { title: this.t('RECEIPT_BUILDER.EMPTY'), message: '', icon: 'box' }; });

  load = async (params: ListQueryParams) => {
    const res = await this.service.getList({ page: params.page, limit: params.limit, searchTerm: (params.searchTerm || '').trim() });
    return { list: res.list, count: res.total, pageCount: Math.max(1, Math.ceil(res.total / (params.limit || 20))) };
  };

  /** "Add new" asks which flavour: the same list shows receipt and kitchen templates. */
  addMenuItems(): DropdownMenuBtnItem[] {
    return [
      { label: 'RECEIPT_BUILDER.TYPE_RECEIPT', click: () => this.addNew('recieptType') },
      { label: 'RECEIPT_BUILDER.TYPE_KITCHEN', click: () => this.addNew('kitchen') },
    ];
  }

  /** The "..." menu of a row. */
  rowMenuItems(t: ReceiptTemplateSummary): DropdownMenuBtnItem[] {
    return [
      { label: 'COMMON.EDIT', click: () => this.edit(t) },
      { label: 'RECEIPT_BUILDER.RENAME.TITLE', click: () => void this.renameRow(t) },
      { label: 'COMMON.DELETE', danger: true, separator: true, click: () => void this.removeRow(t) },
    ];
  }

  edit(row: ReceiptTemplateSummary): void { void this.router.navigate(['/settings/receipt-builder', row.id]); }

  /** `?type=` makes the editor start with the right template flavour. */
  addNew(type: TemplateType): void { void this.router.navigate(['/settings/receipt-builder', 'new'], { queryParams: { type } }); }

  async removeRow(row: ReceiptTemplateSummary): Promise<void> {
    const ok = await this.confirm({
      title: this.t('COMMON.DELETE'),
      message: this.translate.instant('RECEIPT_BUILDER.CONFIRM_DELETE', { name: row.name || '—' }),
      confirm: this.t('COMMON.DELETE'),
      danger: true,
    });
    if (ok && (await this.service.deleteTemplate(row.id))) this.listPage()?.refresh();
  }

  /** The rename dialog fetches the template, changes its name and saves it; the list reloads afterwards. */
  async renameRow(row: ReceiptTemplateSummary): Promise<void> {
    const ref = this.modal.open<RenameTemplateModalComponent, RenameTemplateModalData, { id: string; name: string } | undefined>(
      RenameTemplateModalComponent, { size: 'sm', data: { id: row.id, currentName: row.name }, closeOnBackdrop: false });
    if (await ref.afterClosed()) this.listPage()?.refresh();
  }

  private async confirm(data: ConfirmModalData): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, { size: 'sm', data, closeOnBackdrop: false });
    return (await ref.afterClosed()) === true;
  }
}
