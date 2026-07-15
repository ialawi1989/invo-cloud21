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

import { MatrixItemService } from '../../services/matrix-item.service';
import { DimensionListRow } from '../../services/matrix-item.types';

/**
 * Dimension catalog list — now built on the shared `<app-list-page>` (same
 * chrome as the matrix-item and products lists): sortable columns, column
 * customization, pagination, debounced search and URL sync all owned by the
 * shared component. Row click and the row "⋯" menu both open the editor.
 */
@Component({
  selector: 'app-dimension-list',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ListPageComponent,
    ListCellTemplateDirective,
    ListRowActionsDirective,
    DropdownMenuBtnComponent,
  ],
  // Default change detection (matching matrix-list / products-list): `columns`
  // is set asynchronously in ngOnInit, and OnPush would not propagate that
  // plain-field change to `<app-list-page>`'s `[columns]` binding.
  templateUrl: './dimension-list.component.html',
  styleUrl: './dimension-list.component.scss',
})
export class DimensionListComponent implements OnInit {
  private service = inject(MatrixItemService);
  private router = inject(Router);
  private lang = inject(LanguageService);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  columns: TableColumn[] = [];

  breadcrumbs = [
    { label: 'Home', routerLink: '/', icon: 'home' as const, iconOnly: true },
    { label: '', routerLink: '/dimensions' },
  ];

  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 500 };
  // No defaultSort — the list loads unsorted (sortBy: {}) and lets the backend
  // apply its own default order; sorting starts only when a header is clicked.
  sortingConfig = { enabled: true };
  emptyState = { title: '', message: '' };

  /** Compact one-row mobile cards (< 768px) — same style as the matrix list.
   *  No thumbnail (dimensions have no image); attribute count as the metric,
   *  display type as the secondary line. */
  mobileCardConfig: MobileCardConfig = {
    showThumbnail: false,
    metricKeys: ['attributesCount'],
    secondaryKey: 'displayType',
  };

  async ngOnInit(): Promise<void> {
    // Full-bleed layout is the default, owned by <app-list-page>.
    await this.lang.loadFeature('products/matrix-item');
    this.initTranslations();
  }

  private initTranslations(): void {
    this.columns = [
      {
        key: 'name',
        label: this.lang.instant('DIMENSIONS.LIST.NAME'),
        sortable: true,
        primary: true,
        locked: true,
        interactive: true,
        customTemplate: true,
        width: '340px',
        visible: true,
        order: 0,
      },
      {
        key: 'displayType',
        label: this.lang.instant('DIMENSIONS.LIST.DISPLAY_TYPE'),
        sortable: false,
        customTemplate: true,
        width: '200px',
        visible: true,
        order: 1,
      },
      {
        key: 'attributesCount',
        label: this.lang.instant('DIMENSIONS.LIST.ATTRIBUTES'),
        sortable: false,
        customTemplate: true,
        width: '160px',
        visible: true,
        order: 2,
      },
    ];

    this.breadcrumbs = [
      { label: 'Home', routerLink: '/', icon: 'home' as const, iconOnly: true },
      { label: this.lang.instant('DIMENSIONS.LIST.TITLE'), routerLink: '/dimensions' },
    ];

    this.searchConfig.placeholder = this.lang.instant('DIMENSIONS.LIST.SEARCH_PLACEHOLDER');
    this.emptyState = {
      title: this.lang.instant('DIMENSIONS.LIST.EMPTY'),
      message: '',
    };
  }

  /** Data source for `<app-list-page>` — maps its query shape onto the
   *  service and returns `{ list, count, pageCount }`. */
  loadDimensions = async (params: ListQueryParams) => {
    const res = await this.service.getDimensionList({
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy
        ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection }
        : undefined,
    });
    return { list: res.list, count: res.count, pageCount: res.pageCount };
  };

  /** Human label for a dimension's display type, translated via the
   *  `MATRIX.DIMENSION.*` button/radio/dropdown keys. */
  displayTypeLabel(row: DimensionListRow): string {
    const key =
      row.displayType === 'radio'    ? 'MATRIX.DIMENSION.RADIO' :
      row.displayType === 'dropdown' ? 'MATRIX.DIMENSION.DROPDOWN' :
                                       'MATRIX.DIMENSION.BUTTONS';
    return this.lang.instant(key);
  }

  attributesLabel(row: DimensionListRow): string {
    return this.lang.instant('DIMENSIONS.LIST.ATTRIBUTES_COUNT', { count: row.attributesCount });
  }

  rowMenuItems(row: DimensionListRow): DropdownMenuBtnItem[] {
    return [{ label: 'COMMON.EDIT', click: () => this.edit(row) }];
  }

  onRowClick(event: any): void {
    if (event?.row) this.edit(event.row);
  }

  edit(row: DimensionListRow): void {
    void this.router.navigate(['/dimensions', row.id]);
  }

  add(): void {
    void this.router.navigate(['/dimensions/new']);
  }
}
