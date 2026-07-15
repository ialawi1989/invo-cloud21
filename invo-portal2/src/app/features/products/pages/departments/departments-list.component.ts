import {
  Component,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

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
  ListRowActionsDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import {
  TableColumn,
  ListQueryParams,
  MobileCardConfig,
} from '@shared/components/list-page/interfaces/list-page.types';

import { DepartmentService, DepartmentListRow } from '../../services/department.service';

/**
 * Departments list — built on the shared `<app-list-page>` (same chrome as the
 * collections / matrix lists): sortable Name column, search, pagination, URL
 * sync. Row click / row menu edit; the ⋯ menu also deletes (with confirm).
 *
 * Ported from the legacy `departments.component` in InvoCloudFront2 (a
 * single-column Name table). URLs kept under `/products/department`.
 */
@Component({
  selector: 'app-departments-list',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ListPageComponent,
    ListCellTemplateDirective,
    ListRowActionsDirective,
    DropdownMenuBtnComponent,
  ],
  templateUrl: './departments-list.component.html',
  styleUrl: './departments-list.component.scss',
})
export class DepartmentsListComponent implements OnInit {
  private service = inject(DepartmentService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  readonly canAdd = this.privileges.check('departmentSecurity.actions.add.access');
  readonly canEdit = this.canAdd; // add/edit share the same privilege in this model
  readonly canDelete = this.privileges.check('departmentSecurity.actions.delete.access');

  columns: TableColumn[] = [];

  breadcrumbs = [
    { label: 'Home', routerLink: '/', icon: 'home' as const, iconOnly: true },
    { label: '', routerLink: '/products/department' },
  ];

  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 500 };
  sortingConfig = { enabled: true };
  emptyState = { title: '', message: '' };

  mobileCardConfig: MobileCardConfig = { showThumbnail: false, metricKeys: [], secondaryKey: '' };

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('products');
    this.initTranslations();
  }

  private initTranslations(): void {
    this.columns = [
      {
        key: 'name',
        label: this.lang.instant('PRODUCTS.DEPARTMENTS.COL_NAME'),
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
      { label: this.lang.instant('PRODUCTS.DEPARTMENTS.TITLE'), routerLink: '/products/department' },
    ];

    this.searchConfig.placeholder = this.lang.instant('PRODUCTS.DEPARTMENTS.SEARCH_PLACEHOLDER');
    this.emptyState = { title: this.lang.instant('PRODUCTS.DEPARTMENTS.EMPTY'), message: '' };
  }

  loadDepartments = async (params: ListQueryParams) => {
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
  overflowActions(row: DepartmentListRow): DropdownMenuBtnItem[] {
    const items: DropdownMenuBtnItem[] = [];
    if (this.canDelete) {
      items.push({ label: 'COMMON.DELETE', danger: true, click: () => this.remove(row) });
    }
    return items;
  }

  onRowClick(event: any): void {
    if (event?.row) this.edit(event.row);
  }

  edit(row: DepartmentListRow): void {
    void this.router.navigate(['/products/department', row.id]);
  }

  add(): void {
    void this.router.navigate(['/products/department/new']);
  }

  async remove(row: DepartmentListRow): Promise<void> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title: this.lang.instant('COMMON.DELETE'),
          message: this.lang.instant('PRODUCTS.DEPARTMENTS.CONFIRM_DELETE', { name: row.name }),
          note: this.lang.instant('PRODUCTS.DEPARTMENTS.DELETE_NOTE'),
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
