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

import { BrandService, BrandListRow } from '../../services/brand.service';

/**
 * Brands list — shared `<app-list-page>`. Ported from InvoCloudFront2's
 * `brands.component` (single Name column). Brands cannot be deleted in this
 * app, so the row offers Edit only (hover-revealed). URL `/products/brands`.
 */
@Component({
  selector: 'app-brands-list',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ListPageComponent,
    ListCellTemplateDirective,
    ListRowActionsDirective,
  ],
  templateUrl: './brands-list.component.html',
  styleUrl: './brands-list.component.scss',
})
export class BrandsListComponent implements OnInit {
  private service = inject(BrandService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  readonly canAdd = this.privileges.check('brandSecurity.actions.add.access');
  readonly canEdit = this.canAdd;

  columns: TableColumn[] = [];

  breadcrumbs = [
    { label: 'Home', routerLink: '/', icon: 'home' as const, iconOnly: true },
    { label: '', routerLink: '/products/brands' },
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
        label: this.lang.instant('PRODUCTS.BRANDS.COL_NAME'),
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
      { label: this.lang.instant('PRODUCTS.BRANDS.TITLE'), routerLink: '/products/brands' },
    ];
    this.searchConfig.placeholder = this.lang.instant('PRODUCTS.BRANDS.SEARCH_PLACEHOLDER');
    this.emptyState = { title: this.lang.instant('PRODUCTS.BRANDS.EMPTY'), message: '' };
  }

  loadBrands = async (params: ListQueryParams) => {
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

  onRowClick(event: any): void {
    if (event?.row) this.edit(event.row);
  }

  edit(row: BrandListRow): void {
    void this.router.navigate(['/products/brands', row.id]);
  }

  add(): void {
    void this.router.navigate(['/products/brands/new']);
  }
}
