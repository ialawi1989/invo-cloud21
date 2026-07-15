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

import { ProductCollectionService } from '../../services/product-collection.service';

/** Lightweight row for the collections list table (normalised from the
 *  `company/getCollectionList` wire shape). */
interface CollectionListRow {
  id: string;
  title: string;
  /** 'Manual' | 'Auto' — how the collection is populated. */
  type: string;
  thumbnailUrl: string | null;
  /** Manual collections carry the count of pinned products; Auto ones don't. */
  productsCount: number | null;
}

/**
 * Product-collections list — built on the shared `<app-list-page>` (same chrome
 * as the matrix-item, dimensions and products lists): sortable columns, column
 * customization, pagination, debounced search and URL sync all owned by the
 * shared component. Row click and the row "⋯" menu both open the editor.
 *
 * Ported from the legacy `products-collections.component` in InvoCloudFront2,
 * which was a single-column (Title) table with a soft-info Edit button.
 *
 * Columns: Title (cover thumbnail), Type (Manual/Auto) and product count.
 */
@Component({
  selector: 'app-products-collections-list',
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
  templateUrl: './products-collections-list.component.html',
  styleUrl: './products-collections-list.component.scss',
})
export class ProductsCollectionsListComponent implements OnInit {
  private service = inject(ProductCollectionService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  readonly canAdd = this.privileges.check('productsCollectionsSecurity.actions.add.access');

  columns: TableColumn[] = [];

  breadcrumbs = [
    { label: 'Home', routerLink: '/', icon: 'home' as const, iconOnly: true },
    { label: '', routerLink: '/products-collections' },
  ];

  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 500 };
  // No defaultSort — the list loads unsorted (sortBy: {}) and lets the backend
  // apply its own default order; sorting starts only when a header is clicked.
  sortingConfig = { enabled: true };
  emptyState = { title: '', message: '' };

  /** Compact one-row mobile cards (< 768px) — same style as the matrix list.
   *  Product count as the metric, collection type as the secondary line. */
  mobileCardConfig: MobileCardConfig = {
    showThumbnail: true,
    metricKeys: ['productsCount'],
    secondaryKey: 'type',
  };

  async ngOnInit(): Promise<void> {
    // Full-bleed layout is the default, owned by <app-list-page>.
    await this.lang.loadFeature('products');
    this.initTranslations();
  }

  private initTranslations(): void {
    this.columns = [
      {
        key: 'title',
        label: this.lang.instant('PRODUCTS.COLLECTIONS.COL_TITLE'),
        sortable: true,
        primary: true,
        locked: true,
        interactive: true,
        customTemplate: true,
        width: '420px',
        visible: true,
        order: 0,
      },
      {
        key: 'type',
        label: this.lang.instant('PRODUCTS.COLLECTIONS.COL_TYPE'),
        sortable: false,
        customTemplate: true,
        width: '180px',
        visible: true,
        order: 1,
      },
      {
        key: 'productsCount',
        label: this.lang.instant('PRODUCTS.COLLECTIONS.COL_PRODUCTS'),
        sortable: false,
        customTemplate: true,
        width: '160px',
        visible: true,
        order: 2,
      },
    ];

    this.breadcrumbs = [
      { label: 'Home', routerLink: '/', icon: 'home' as const, iconOnly: true },
      { label: this.lang.instant('PRODUCTS.COLLECTIONS.TITLE'), routerLink: '/products-collections' },
    ];

    this.searchConfig.placeholder = this.lang.instant('PRODUCTS.COLLECTIONS.SEARCH_PLACEHOLDER');
    this.emptyState = {
      title: this.lang.instant('PRODUCTS.COLLECTIONS.EMPTY'),
      message: '',
    };
  }

  /** Data source for `<app-list-page>` — maps its query shape onto the
   *  service and normalises rows to `{ list, count, pageCount }`. */
  loadCollections = async (params: ListQueryParams) => {
    const data = await this.service.getCollectionList({
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy
        ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection }
        : {},
    });
    const raw: any[] = Array.isArray(data?.list) ? data.list : Array.isArray(data) ? data : [];
    const list = raw.map((r) => this.normalizeRow(r));
    const count = Number(data?.count ?? list.length) || 0;
    const pageCount = Number(data?.pageCount ?? Math.ceil(count / (params.limit || 15))) || 1;
    return { list, count, pageCount };
  };

  private normalizeRow(r: any): CollectionListRow {
    const type = r?.type || 'Manual';
    // Backend `getCollectionList` returns `productsCount` for Manual collections
    // (length of data.ids); Auto collections are rule-based, so no fixed count.
    // Fall back to counting a locally-present ids array for older responses.
    const count =
      typeof r?.productsCount === 'number'
        ? r.productsCount
        : Array.isArray(r?.data?.ids)
          ? r.data.ids.length
          : null;
    return {
      id: String(r?.id ?? r?._id ?? ''),
      title: r?.title ?? r?.name ?? '',
      type,
      thumbnailUrl: r?.mediaUrl?.thumbnailUrl ?? r?.mediaUrl?.defaultUrl ?? null,
      productsCount: type === 'Auto' ? null : count,
    };
  }

  typeLabel(row: CollectionListRow): string {
    return this.lang.instant(
      row.type === 'Auto' ? 'PRODUCTS.COLLECTIONS.TYPE_AUTO' : 'PRODUCTS.COLLECTIONS.TYPE_MANUAL',
    );
  }

  productsLabel(row: CollectionListRow): string {
    return this.lang.instant('PRODUCTS.COLLECTIONS.PRODUCTS_COUNT', { count: row.productsCount ?? 0 });
  }

  rowMenuItems(row: CollectionListRow): DropdownMenuBtnItem[] {
    return [{ label: 'COMMON.EDIT', click: () => this.edit(row) }];
  }

  onRowClick(event: any): void {
    if (event?.row) this.edit(event.row);
  }

  edit(row: CollectionListRow): void {
    void this.router.navigate(['/products-collections', row.id]);
  }

  add(): void {
    void this.router.navigate(['/products-collections/new']);
  }
}
