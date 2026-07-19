import {
  Component,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import {
  ListCellTemplateDirective,
  ListMobileThumbDirective,
  ListRowActionsDirective,
  ListRowDetailDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import { EntityThumbComponent } from '@shared/components/entity-thumb/entity-thumb.component';
import { ImportWizardComponent } from '@shared/components/import-wizard/import-wizard.component';
import {
  ImportWizardConfig,
  ImportSummaryCounts,
} from '@shared/components/import-wizard/import-wizard.types';
import { PrepRecipePanelComponent } from '../../components/prep-recipe-panel/prep-recipe-panel.component';
import { buildOptionImportConfig } from './option-import.config';
import {
  TableColumn,
  ListQueryParams,
  MobileCardConfig,
} from '@shared/components/list-page/interfaces/list-page.types';

import { OptionService, OptionListRow } from '../../services/option.service';

/**
 * Departments list — built on the shared `<app-list-page>` (same chrome as the
 * collections / matrix lists): sortable Name column, search, pagination, URL
 * sync. Row click / row menu edit; the ⋯ menu also deletes (with confirm).
 *
 * Ported from the legacy `departments.component` in InvoCloudFront2 (a
 * single-column Name table). URLs kept under `/products/option`.
 */
@Component({
  selector: 'app-options-list',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ListPageComponent,
    ListCellTemplateDirective,
    ListRowActionsDirective,
    ListMobileThumbDirective,
    ListRowDetailDirective,
    DropdownMenuBtnComponent,
    EntityThumbComponent,
    PrepRecipePanelComponent,
  ],
  templateUrl: './options-list.component.html',
  styleUrl: './options-list.component.scss',
})
export class OptionsListComponent implements OnInit {
  private service = inject(OptionService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private translate = inject(TranslateService);
  private privileges = inject(PrivilegeService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  readonly canAdd = this.privileges.check('optionSecurity.actions.add.access');
  readonly canEdit = this.canAdd; // add/edit share the same privilege in this model
  readonly canDelete = this.privileges.check('optionSecurity.actions.delete.access');
  readonly canClone = this.privileges.check('optionSecurity.actions.clone.access');
  readonly canImportExport = this.privileges.check('optionSecurity.actions.importExport.access');
  readonly canManageAvailability = this.privileges.check('optionSecurity.actions.optionAvailable.access');

  /**
   * Header "⋯" menu. Import and the two export formats are separate entries —
   * the dropdown has no submenus, and a combined "Import/Export" item would
   * need a second modal just to pick a direction.
   */
  moreMenuItems = (): DropdownMenuBtnItem[] => {
    const items: DropdownMenuBtnItem[] = [];
    if (this.canImportExport) {
      items.push(
        { label: 'PRODUCTS.OPTIONS.IMPORT.MENU_IMPORT', click: () => void this.openImport() },
        { label: 'PRODUCTS.OPTIONS.IMPORT.MENU_EXPORT_CSV', click: () => void this.exportAs('csv') },
        { label: 'PRODUCTS.OPTIONS.IMPORT.MENU_EXPORT_XLSX', click: () => void this.exportAs('xlsx') },
      );
    }
    if (this.canManageAvailability) {
      items.push({
        label: 'PRODUCTS.OPTIONS.AVAILABILITY.MENU',
        separator: items.length > 0,
        click: () => void this.router.navigate(['/products/option-availability']),
      });
    }
    return items;
  };

  columns: TableColumn[] = [];

  breadcrumbs = [
    { label: 'Home', routerLink: '/', icon: 'home' as const, iconOnly: true },
    { label: '', routerLink: '/products/option' },
  ];

  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 500 };
  sortingConfig = { enabled: true };
  emptyState = { title: '', message: '' };

  mobileCardConfig: MobileCardConfig = { showThumbnail: true, metricKeys: [], secondaryKey: '' };

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('products');
    this.initTranslations();
  }

  private initTranslations(): void {
    this.columns = [
      {
        key: 'name',
        label: this.lang.instant('PRODUCTS.OPTIONS.COL_NAME'),
        sortable: true,
        primary: true,
        locked: true,
        interactive: true,
        customTemplate: true,
        visible: true,
        order: 0,
      },
    ];

    this.breadcrumbs = [
      { label: 'Home', routerLink: '/', icon: 'home' as const, iconOnly: true },
      { label: this.lang.instant('PRODUCTS.OPTIONS.TITLE'), routerLink: '/products/option' },
    ];

    this.searchConfig.placeholder = this.lang.instant('PRODUCTS.OPTIONS.SEARCH_PLACEHOLDER');
    this.emptyState = { title: this.lang.instant('PRODUCTS.OPTIONS.EMPTY'), message: '' };
  }

  loadOptions = async (params: ListQueryParams) => {
    const data = await this.service.getList({
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy
        ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection }
        : {},
    });
    return { list: data.list, count: data.count, pageCount: data.pageCount };
  };

  /** Overflow (⋯) menu items — everything except Edit, which is the hover pill. */
  overflowActions(row: OptionListRow): DropdownMenuBtnItem[] {
    const items: DropdownMenuBtnItem[] = [];
    if (this.canClone) {
      items.push({ label: 'COMMON.CLONE', click: () => this.clone(row) });
    }
    if (this.canDelete) {
      items.push({ label: 'COMMON.DELETE', danger: true, click: () => this.remove(row) });
    }
    return items;
  }

  onRowClick(event: any): void {
    if (event?.row) this.edit(event.row);
  }

  /**
   * Clone opens the source record's form with ?clone=true. The form loads that
   * record, blanks its id and prefixes the names, so saving creates a new one —
   * matching the legacy flow, which had no server-side clone endpoint.
   */
  clone(row: OptionListRow): void {
    void this.router.navigate(['/products/option', row.id], { queryParams: { clone: true } });
  }

  edit(row: OptionListRow): void {
    void this.router.navigate(['/products/option', row.id]);
  }

  add(): void {
    void this.router.navigate(['/products/option/new']);
  }

  /** Bulk import via the shared wizard; refresh the list if anything landed. */
  async openImport(): Promise<void> {
    const config = buildOptionImportConfig({ service: this.service, translate: this.translate });
    const ref = this.modal.open<ImportWizardComponent, ImportWizardConfig, ImportSummaryCounts | undefined>(
      ImportWizardComponent,
      { size: 'lg', data: config, closeOnBackdrop: false },
    );
    const res = await ref.afterClosed();
    if (res?.successful) this.listPage?.refresh();
  }

  async exportAs(type: 'csv' | 'xlsx'): Promise<void> {
    try {
      await this.service.exportOptions(type);
    } catch (e: any) {
      this.toast.error('COMMON.EXPORT_FAILED', e?.message);
    }
  }

  async remove(row: OptionListRow): Promise<void> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title: this.lang.instant('COMMON.DELETE'),
          message: this.lang.instant('PRODUCTS.OPTIONS.CONFIRM_DELETE', { name: row.name }),
          note: this.lang.instant('PRODUCTS.OPTIONS.DELETE_NOTE'),
          confirm: this.lang.instant('COMMON.DELETE'),
          danger: true,
        },
      },
    );
    if (!(await ref.afterClosed())) return;
    const res = await this.service.delete(row.id);
    if (res.success) {
      this.toast.success('COMMON.DELETED_OK');
      this.listPage?.refresh();
    } else {
      this.toast.error('COMMON.DELETE_FAILED');
    }
  }
}
