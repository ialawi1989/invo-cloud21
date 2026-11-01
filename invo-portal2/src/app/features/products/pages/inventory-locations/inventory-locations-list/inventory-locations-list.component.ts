import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import {
  ListCellTemplateDirective,
  ListRowActionsDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import {
  TableColumn,
  ListQueryParams,
  MobileCardConfig,
  FilterConfig,
} from '@shared/components/list-page/interfaces/list-page.types';

import { InventoryLocationService, InventoryLocationListRow } from '../../../services/inventory-location.service';

const arr = (v: any): any[] => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v]);

/**
 * Inventory locations list — shared `<app-list-page>` (search, sortable
 * Location / Branch columns, branch multi-select filter, pagination, URL sync).
 *
 * Ported from the legacy `inventory-locations.component` in InvoCloudFront2.
 * Edit goes to `/inventory/locations/:id`; the list's current query
 * params ride along so the form can return to the same page/search/filter.
 */
@Component({
  selector: 'app-inventory-locations-list',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ListPageComponent,
    ListCellTemplateDirective,
    ListRowActionsDirective,
  ],
  templateUrl: './inventory-locations-list.component.html',
  styleUrl: './inventory-locations-list.component.scss',
})
export class InventoryLocationsListComponent implements OnInit {
  private service = inject(InventoryLocationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);

  readonly canAdd = this.privileges.check('inventoryLocationsSecurity.actions.add.access');
  readonly canEdit = this.canAdd; // add/edit share one privilege

  columns: TableColumn[] = [];
  filters: FilterConfig[] = [];

  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 500 };
  sortingConfig = { enabled: true };
  emptyState = { title: '', message: '' };

  mobileCardConfig: MobileCardConfig = { showThumbnail: false, metricKeys: [], secondaryKey: 'branchName' };

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('products');
    this.initTranslations();
  }

  private initTranslations(): void {
    this.columns = [
      {
        key: 'name',
        label: this.lang.instant('PRODUCTS.INVENTORY_LOCATIONS.COL_NAME'),
        sortable: true,
        primary: true,
        locked: true,
        interactive: true,
        customTemplate: true,
        visible: true,
        order: 0,
      },
      {
        key: 'branchName',
        label: this.lang.instant('PRODUCTS.INVENTORY_LOCATIONS.COL_BRANCH'),
        sortable: true,
        visible: true,
        order: 1,
      },
    ];

    this.filters = [
      {
        type: 'dropdown',
        key: 'branches',
        label: this.lang.instant('PRODUCTS.INVENTORY_LOCATIONS.FILTER_BRANCH'),
        multiple: true,
        loadFn: async (p: { page: number; pageSize: number; search: string }) => {
          const res = await this.service.getBranches({ page: p.page, limit: p.pageSize, searchTerm: p.search });
          return {
            items: res.list.map((b) => ({ value: b.id, label: b.name })),
            hasMore: p.page < res.pageCount,
          };
        },
      },
    ];

    this.searchConfig.placeholder = this.lang.instant('PRODUCTS.INVENTORY_LOCATIONS.SEARCH_PLACEHOLDER');
    this.emptyState = { title: this.lang.instant('PRODUCTS.INVENTORY_LOCATIONS.EMPTY'), message: '' };
  }

  loadLocations = async (params: ListQueryParams) => {
    const data = await this.service.getList({
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy
        ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection }
        : {},
      branches: arr(params.filter?.['branches']).map(String),
    });
    return { list: data.list, count: data.count, pageCount: data.pageCount };
  };

  onRowClick(event: any): void {
    if (event?.row && this.canEdit) this.edit(event.row);
  }

  edit(row: InventoryLocationListRow): void {
    void this.router.navigate(['/inventory/locations', row.id], {
      queryParams: this.route.snapshot.queryParams,
    });
  }

  add(): void {
    void this.router.navigate(['/inventory/locations/new']);
  }
}
