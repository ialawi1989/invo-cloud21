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
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
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
} from '@shared/components/list-page/interfaces/list-page.types';

import { MatrixItemService } from '../../services/matrix-item.service';
import { MatrixListRow } from '../../services/matrix-item.types';

/**
 * Matrix-item list — now built on the shared `<app-list-page>` (same chrome as
 * the products list): sortable columns, column customization, pagination,
 * debounced search and URL sync all owned by the shared component. Row click
 * and the row "⋯" menu both open the editor.
 */
@Component({
  selector: 'app-matrix-list',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ListPageComponent,
    ListCellTemplateDirective,
    ListRowActionsDirective,
    DropdownMenuBtnComponent,
    MycurrencyPipe,
  ],
  // Default change detection (matching products-list): `columns` is set
  // asynchronously in ngOnInit, and OnPush would not propagate that plain-field
  // change to `<app-list-page>`'s `[columns]` binding — leaving its initial
  // data load (and getMatrixList) undispatched.
  templateUrl: './matrix-list.component.html',
  styleUrl: './matrix-list.component.scss',
})
export class MatrixListComponent implements OnInit {
  private service = inject(MatrixItemService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  readonly canEdit = this.privileges.check('matrixItemSecurity.actions.add.access');

  columns: TableColumn[] = [];

  breadcrumbs = [
    { label: 'Home', routerLink: '/', icon: 'home' as const, iconOnly: true },
    { label: '', routerLink: '/matrix-item' },
  ];

  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 500 };
  sortingConfig = { enabled: true, defaultSort: { key: 'name', direction: 'asc' as const } };
  emptyState = { title: '', message: '' };

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('products/matrix-item');
    this.initTranslations();
  }

  private initTranslations(): void {
    this.columns = [
      {
        key: 'name',
        label: this.lang.instant('MATRIX.LIST.NAME'),
        sortable: true,
        primary: true,
        locked: true,
        interactive: true,
        width: '320px',
        visible: true,
        order: 0,
      },
      {
        key: 'barcode',
        label: this.lang.instant('MATRIX.LIST.BARCODE'),
        sortable: true,
        customTemplate: true,
        width: '200px',
        visible: true,
        order: 1,
      },
      {
        key: 'defaultPrice',
        label: this.lang.instant('MATRIX.LIST.PRICE'),
        sortable: true,
        customTemplate: true,
        align: 'end',
        width: '160px',
        visible: true,
        order: 2,
      },
    ];

    this.breadcrumbs = [
      { label: 'Home', routerLink: '/', icon: 'home' as const, iconOnly: true },
      { label: this.lang.instant('MATRIX.LIST.TITLE'), routerLink: '/matrix-item' },
    ];

    this.searchConfig.placeholder = this.lang.instant('MATRIX.LIST.SEARCH_PLACEHOLDER');
    this.emptyState = {
      title: this.lang.instant('MATRIX.LIST.EMPTY'),
      message: '',
    };
  }

  /** Data source for `<app-list-page>` — maps its query shape onto the
   *  service and returns `{ list, count, pageCount }`. */
  loadMatrix = async (params: ListQueryParams) => {
    const res = await this.service.getMatrixList({
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy
        ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection }
        : undefined,
    });
    return { list: res.list, count: res.count, pageCount: res.pageCount };
  };

  rowMenuItems(row: MatrixListRow): DropdownMenuBtnItem[] {
    return [{ label: 'COMMON.EDIT', click: () => this.edit(row) }];
  }

  onRowClick(event: any): void {
    if (event?.row) this.edit(event.row);
  }

  edit(row: MatrixListRow): void {
    void this.router.navigate(['/matrix-item', row.id]);
  }

  add(): void {
    void this.router.navigate(['/matrix-item/new']);
  }
}
