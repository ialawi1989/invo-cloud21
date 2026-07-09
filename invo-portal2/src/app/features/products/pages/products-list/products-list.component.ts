import { Component, inject, OnInit, signal, HostListener, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { OverlayModule } from '@angular/cdk/overlay';
import { TranslateModule } from '@ngx-translate/core';

import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import {
  ListCellTemplateDirective,
  ListRowActionsDirective,
  ListMobileThumbDirective,
  ListMobileTitleDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import {
  TableColumn,
  FilterConfig,
  ActionConfig,
  BulkActionConfig,
  ListQueryParams,
  MobileCardConfig
} from '@shared/components/list-page/interfaces/list-page.types';

import { ProductsService } from '../../services/products.service';
import { ProductsListStateService } from '../../state/products-list.state';
import { LanguageService } from '@core/i18n/language.service';
import { withTranslations } from '@core/i18n/with-translations';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { PickTaxModalComponent } from '@shared/components/pick-tax-modal/pick-tax-modal.component';
import { ApiService } from '@core/http/api.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { getProductTypeBadgeStyle } from '../../utils/product-type-badge';
import { ProductDetailDrawerComponent, ProductDetailDrawerData } from '../../components/product-detail-drawer/product-detail-drawer.component';
import { ProductStockModalComponent, ProductStockModalData } from '../../components/product-stock-modal/product-stock-modal.component';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [
    CommonModule,
    OverlayModule,
    ListPageComponent,
    TranslateModule,
    ListCellTemplateDirective,
    ListRowActionsDirective,
    ListMobileThumbDirective,
    ListMobileTitleDirective,
    DropdownMenuBtnComponent,
    MycurrencyPipe
  ],
  providers: [ProductsListStateService],
  templateUrl: './products-list.component.html',
  styleUrl: './products-list.component.scss'
})
export class ProductsListComponent implements OnInit {
  private router = inject(Router);
  private productsService = inject(ProductsService);
  private state = inject(ProductsListStateService);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);
  private modalService = inject(ModalService);
  private api          = inject(ApiService);

  // ── Row-action privilege gates (used by the template) ─────────────────────
  // 1:1 port of the old product-list row-action gates. Note this privilege
  // model has no separate `edit` action — the `add` action is literally
  // "Add/Edit New Product" (see definitions/productSecurity.ts), so the Edit
  // menu item uses `add.access`. `clone` is its own privilege; don't reuse add.
  readonly canEdit       = this.privileges.check('productSecurity.actions.add.access');
  readonly canAdd        = this.privileges.check('productSecurity.actions.add.access');
  readonly canClone      = this.privileges.check('productSecurity.actions.clone.access');
  readonly canDelete     = this.privileges.check('productSecurity.actions.delete.access');
  readonly canPrintLabel = this.privileges.check('productSecurity.actions.printBarcode.access');

  // Breadcrumbs
  breadcrumbs = [
    { label: 'Home', routerLink: '/', icon: 'home' as const, iconOnly: true },
    { label: 'Products', routerLink: '/products' },
    { label: 'Product List' }
  ];

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  /** Whether a column key is currently visible in the list — used by the name
   * cell template to gate the image thumbnail and barcode badge, matching the
   * old InvoCloudFront2 behavior where these toggle as part of the name cell. */
  isColumnVisible = (key: string): boolean =>
    !!this.listPage?.visibleColumns().includes(key);

  // UI state
  expandedProductIds = signal<Set<string>>(new Set());
  openMenuRowId = signal<string | null>(null);

  // Split header actions
  addNewActions: ActionConfig[] = [];
  moreActions: ActionConfig[] = [];          // general (Import/Export, Logs)
  bulkOperationActions: ActionConfig[] = []; // grouped under "Bulk operations"

  /** Compact one-row mobile cards (< 768px), replacing the generic
   *  key/value grid. Line 1: thumb + title-cased name + type chip
   *  (listMobileTitle template). Line 2: qty + price metrics with
   *  department right-aligned as the secondary. Card tap → detail
   *  drawer; the "⋯" trigger reuses the same overflow menu as the
   *  table via the shared listRowActions template. */
  mobileCardConfig: MobileCardConfig = {
    showThumbnail: true,
    metricKeys: ['qty', 'defaultPrice'],
    secondaryKey: 'departmentName',
  };

  /** Map an `ActionConfig` (used by the list-page contract) onto
   *  the shared dropdown's `DropdownMenuBtnItem` shape. Carries
   *  `color: 'danger'` through as the danger flag. */
  private toMenuItem(a: ActionConfig): DropdownMenuBtnItem {
    return {
      label:    a.label,
      click:    () => a.handler?.(),
      disabled: typeof a.disabled === 'function' ? a.disabled() : !!a.disabled,
      danger:   a.color === 'danger',
    };
  }

  /** "+ Add New" menu items — one row per product type the user
   *  has permission to create. */
  addNewMenuItems(): DropdownMenuBtnItem[] {
    return this.addNewActions.map(a => this.toMenuItem(a));
  }

  /** "..." overflow menu items: general actions, then a divider +
   *  a "BULK OPERATIONS" header + the bulk action group. The
   *  divider/header only render when both groups are non-empty. */
  moreMenuItems(): DropdownMenuBtnItem[] {
    const out: DropdownMenuBtnItem[] = this.moreActions.map(a => this.toMenuItem(a));
    if (this.bulkOperationActions.length > 0) {
      this.bulkOperationActions.forEach((a, i) => {
        const it = this.toMenuItem(a);
        if (i === 0 && this.moreActions.length > 0) {
          it.separator = true;
          it.header    = 'MENU.SUB.BULK_OPERATIONS';
        } else if (i === 0) {
          it.header    = 'MENU.SUB.BULK_OPERATIONS';
        }
        out.push(it);
      });
    }
    return out;
  }

  private clickCloseListener = () => this.closeRowMenu();

  loadCustomFieldsFn = async (columns: TableColumn[]): Promise<TableColumn[]> => {
    const customFields = await this.productsService.getCustomFields();
    const existingKeys = new Set(columns.map(c => c.key));
    const newColumns = customFields
      .filter(cf => !existingKeys.has(cf.key))
      .map((cf, i) => ({
        key: cf.key,
        label: cf.label,
        visible: false,
        order: columns.length + i,
        sortable: false,
        isCustomField: true
      } as TableColumn));
    return [...columns, ...newColumns];
  };

  columns: TableColumn[] = [];
  filters: FilterConfig[] = [];
  headerActions: ActionConfig[] = [];
  bulkActions: BulkActionConfig[] = [];

  paginationConfig = {
    enabled: true,
    pageLimits: [15, 25, 50, 100],
    default: 15
  };

  searchConfig = {
    enabled: true,
    placeholder: '',
    debounceMs: 500
  };

  // No defaultSort — the list loads unsorted (sortBy: {}) and lets the backend
  // apply its own default order; sorting starts only when a header is clicked.
  sortingConfig = {
    enabled: true
  };

  emptyState = {
    title: '',
    message: '',
  };

  async ngOnInit(): Promise<void> {
    // Full-bleed layout is now the default, owned by <app-list-page> itself
    // (desktop-only, self-managed shell) — nothing to wire here.
    await this.lang.loadFeature('products');
    this.initializeTranslations();
  }


  private initializeTranslations(): void {
    // Columns
    // Numeric columns (`qty`, `stockValue`, `unitCost`, `defaultPrice`,
    // `weight`) carry `align: 'end'` so figures right-align and can be
    // compared down the list — RTL-safe via the shared component's
    // logical `text-end`.
    this.columns = [
      {
        key: 'name',
        label: this.lang.instant('PRODUCTS.FIELDS.NAME'),
        headerLabel: this.lang.instant('PRODUCTS.FIELDS.NAME'),
        sortable: true,
        width: '250px',
        customTemplate: true,
        locked: true,
        primary: true,
        interactive: true,
        visible: true,
        order: 0
      },
      {
        key: 'barcode',
        // Same label as `name` so both render inside the same table cell
        // (list-page groups by label). `displayStyle: 'newLine'` stacks the
        // barcode beneath the product name.
        label: this.lang.instant('PRODUCTS.FIELDS.NAME'),
        headerLabel: this.lang.instant('PRODUCTS.FIELDS.BARCODE'),
        sortable: false,
        customTemplate: true,
        displayStyle: 'newLine',
        visible: true,
        order: 1,
      },
      {
        key: 'SKU',
        label: this.lang.instant('PRODUCTS.FIELDS.SKU'),
        sortable: false,
        customTemplate: true,
        width: '110px',
        visible: false,
        order: 2,
      },
      {
        // Same label as `name` so list-page groups it into the
        // product cell (next to the name + barcode chip). Toggling
        // this column's visibility just shows/hides the UOM line in
        // the product cell — exactly the way `barcode` is wired
        // above. Mirrors the InvoCloudFront2 layout.
        key: 'UOM',
        label: this.lang.instant('PRODUCTS.FIELDS.NAME'),
        headerLabel: this.lang.instant('PRODUCTS.FIELDS.UOM'),
        sortable: false,
        customTemplate: true,
        displayStyle: 'newLine',
        visible: false,
        order: 3,
      },
      {
        key: 'departmentName',
        label: this.lang.instant('PRODUCTS.FIELDS.DEPARTMENT'),
        sortable: true,
        width: '150px',
        order: 4,
      },
      {
        key: 'categoryName',
        label: this.lang.instant('PRODUCTS.FIELDS.CATEGORY'),
        sortable: true,
        width: '150px',
        order: 5,
      },
      {
        key: 'brandName',
        label: this.lang.instant('PRODUCTS.FIELDS.BRAND'),
        sortable: false,
        width: '150px',
        visible: false,
        order: 6,
      },
      {
        // Backend recognises `qty` as the inventory aggregate
        // projection — sending `qtySum` (the field name on the
        // response) makes the API skip projection and return 0.
        // Keep the column key as `qty` and pull the value from the
        // nested `inventorySummary` in the cell template.
        key: 'qty',
        label: this.lang.instant('PRODUCTS.FIELDS.QTY'),
        sortable: true,
        width: '100px',
        customTemplate: true,
        interactive: true,
        align: 'end',
        order: 7,
      },
      // Stock Value - conditional on permission
      ...(this.privileges.check('productSecurity.actions.viewStockValue.access') ? [{
        key: 'stockValue',
        label: this.lang.instant('PRODUCTS.FIELDS.STOCK_VALUE'),
        // Not sortable: stockValue is a computed aggregate (qty × cost) the
        // backend can't ORDER BY — sorting it returns "Unknown sort column".
        sortable: false,
        pipe: 'currency' as const,
        pipeArgs: { currency: 'BHD' },
        width: '150px',
        align: 'end' as const,
        order: 8,
      }] : []),
      {
        key: 'unitCost',
        label: this.lang.instant('PRODUCTS.FIELDS.UNIT_COST'),
        sortable: false,
        customTemplate: true,
        width: '120px',
        align: 'end',
        visible: false,
        order: 9,
      },
      {
        key: 'defaultPrice',
        label: this.lang.instant('PRODUCTS.FIELDS.PRICE'),
        sortable: true,
        pipe: 'currency' as const,
        pipeArgs: { currency: 'BHD' },
        width: '120px',
        align: 'end',
        order: 10,
      },
      {
        key: 'taxName',
        label: this.lang.instant('PRODUCTS.FIELDS.TAX'),
        sortable: false,
        customTemplate: true,
        width: '120px',
        order: 11,
      },
      {
        key: 'weight',
        label: this.lang.instant('PRODUCTS.FIELDS.WEIGHT'),
        sortable: false,
        width: '100px',
        align: 'end',
        visible: false,
        order: 12,
      },
      {
        key: 'image',
        // Same label as `name` so it groups with the name cell (list-page
        // groups columns by label). The thumbnail itself renders inside the
        // `name` template, gated by `isColumnVisible('image')` — this column's
        // own template renders nothing, so toggling it just controls visibility
        // of the thumbnail in the name cell. Matches old InvoCloudFront2.
        label: this.lang.instant('PRODUCTS.FIELDS.NAME'),
        headerLabel: this.lang.instant('PRODUCTS.FIELDS.IMAGE'),
        sortable: false,
        customTemplate: true,
        visible: false,
        // Image is rendered from `imageUrl` / Cloudinary metadata
        // server-side; a bare `image` key isn't a real searchable
        // field. Including it in the API columns array makes the
        // backend match against a non-existent field and silently
        // return zero results.
        noApi: true,
        order: 13,
      },
      {
        key: 'createdAt',
        label: this.lang.instant('PRODUCTS.FIELDS.CREATED_AT'),
        sortable: false,
        pipe: 'date' as const,
        width: '150px',
        visible: false,
        order: 14,
      },
      {
        key: 'updatedDate',
        label: this.lang.instant('PRODUCTS.FIELDS.UPDATED_DATE'),
        sortable: false,
        pipe: 'date' as const,
        width: '150px',
        visible: false,
        order: 15,
      },
      {
        key: 'type',
        label: this.lang.instant('PRODUCTS.FIELDS.TYPE'),
        sortable: true,
        customTemplate: true,
        width: '120px',
        primary: true,
        visible: true,
        order: 16,
      }
    ];

    // Filters - FIXED: checkbox-group for tags
    this.filters = [
      {
        type: 'checkbox-group',
        key: 'types',
        label: this.lang.instant('PRODUCTS.FILTERS.TYPE'),
        options: [
          { value: 'inventory', label: this.lang.instant('PRODUCTS.TYPES.INVENTORY') },
          { value: 'serialized', label: this.lang.instant('PRODUCTS.TYPES.SERIALIZED') },
          { value: 'batch', label: this.lang.instant('PRODUCTS.TYPES.BATCH') },
          { value: 'kit', label: this.lang.instant('PRODUCTS.TYPES.KIT') },
          { value: 'service', label: this.lang.instant('PRODUCTS.TYPES.SERVICE') },
          { value: 'package', label: this.lang.instant('PRODUCTS.TYPES.PACKAGE') },
          { value: 'menuItem', label: this.lang.instant('PRODUCTS.TYPES.MENU_ITEM') },
          { value: 'menuSelection', label: this.lang.instant('PRODUCTS.TYPES.MENU_SELECTION') },
          { value: 'tailoring', label: this.lang.instant('PRODUCTS.TYPES.TAILORING') },
          { value: 'matrix', label: this.lang.instant('PRODUCTS.TYPES.MATRIX') }
        ]
      },
      {
        type: 'dropdown',
        key: 'departmentId',
        label: this.lang.instant('PRODUCTS.FILTERS.DEPARTMENT'),
        loadFn: (params: any) => this.productsService.getDepartments(params)
      },
      {
        type: 'dropdown',
        key: 'categoryId',
        label: this.lang.instant('PRODUCTS.FILTERS.CATEGORY'),
        loadFn: (params: any) => this.productsService.getCategories(params)
      },
      {
        type: 'dropdown',
        key: 'tags',
        label: this.lang.instant('PRODUCTS.FILTERS.TAGS'),
        multiple: true,
        position: 'top',
        loadFn: (params: any) => this.productsService.getProductTags(params)
      }
    ];

    // Header Actions - FIXED: Conditional adding
    this.headerActions = [];
    this.addNewActions = [];
    this.moreActions = [];

    // Add New actions
    {
      this.addNewActions.push(
        {
          id: 'add-inventory',
          label: this.lang.instant('PRODUCTS.TYPES.INVENTORY'),
          color: 'primary',
          handler: () => this.addNewProduct('inventory')
        },
        {
          id: 'add-serialized',
          label: this.lang.instant('PRODUCTS.TYPES.SERIALIZED'),
          color: 'primary',
          handler: () => this.addNewProduct('serialized')
        },
        {
          id: 'add-batch',
          label: this.lang.instant('PRODUCTS.TYPES.BATCH'),
          color: 'primary',
          handler: () => this.addNewProduct('batch')
        },
        {
          id: 'add-kit',
          label: this.lang.instant('PRODUCTS.TYPES.KIT'),
          color: 'primary',
          handler: () => this.addNewProduct('kit')
        },
        {
          id: 'add-service',
          label: this.lang.instant('PRODUCTS.TYPES.SERVICE'),
          color: 'primary',
          handler: () => this.addNewProduct('service')
        },
        {
          id: 'add-package',
          label: this.lang.instant('PRODUCTS.TYPES.PACKAGE'),
          color: 'primary',
          handler: () => this.addNewProduct('package')
        },
        {
          id: 'add-menuItem',
          label: this.lang.instant('PRODUCTS.TYPES.MENU_ITEM'),
          color: 'primary',
          handler: () => this.addNewProduct('menuItem')
        },
        {
          id: 'add-menuSelection',
          label: this.lang.instant('PRODUCTS.TYPES.MENU_SELECTION'),
          color: 'primary',
          handler: () => this.addNewProduct('menuSelection')
        },
        {
          id: 'add-tailoring',
          label: this.lang.instant('PRODUCTS.TYPES.TAILORING'),
          color: 'primary',
          handler: () => this.addNewProduct('tailoring')
        }
      );
    }

    // General actions (top of the More dropdown) — gated by permission.
    const generalCandidates: { action: ActionConfig; permission?: string }[] = [
      {
        action: {
          id: 'bulk-print',
          label: this.lang.instant('PRODUCTS.ACTIONS.BULK_BARCODE_PRINT'),
          color: 'secondary',
          handler: () => this.router.navigate(['/products/bulk-print']),
        },
        permission: 'productSecurity.actions.printBarcode.access',
      },
      {
        action: {
          id: 'import-export',
          label: this.lang.instant('PRODUCTS.ACTIONS.IMPORT_EXPORT'),
          color: 'secondary',
          handler: () => this.openImportExport(),
        },
        permission: 'productSecurity.actions.importExport.access',
      },
      {
        action: {
          id: 'logs',
          label: this.lang.instant('PRODUCTS.ACTIONS.SHOW_LOGS'),
          color: 'secondary',
          handler: () => this.openLogs(),
        },
        // No dedicated privilege; view access is enough to reach this list,
        // so we don't gate it further.
      },
    ];
    generalCandidates.forEach(({ action, permission }) => {
      if (!permission || this.privileges.check(permission)) {
        this.moreActions.push(action);
      }
    });

    // Bulk operations — gated by their respective view privileges.
    const bulkCandidates: { action: ActionConfig; permission?: string }[] = [
      {
        action: {
          id: 'price-change',
          label: this.lang.instant('PRODUCTS.ACTIONS.PRICE_CHANGE'),
          color: 'secondary',
          handler: () => this.openPriceChange(),
        },
        permission: 'priceChangeSecurity.actions.view.access',
      },
      {
        action: {
          id: 'products-availability',
          label: this.lang.instant('PRODUCTS.ACTIONS.PRODUCTS_AVAILABILITY'),
          color: 'secondary',
          handler: () => this.openProductsAvailability(),
        },
        permission: 'productsAvailabilitySecurity.actions.view.access',
      },
      {
        action: {
          id: 'bulk-image',
          label: this.lang.instant('PRODUCTS.ACTIONS.BULK_IMAGE'),
          color: 'secondary',
          handler: () => this.showBulkImage(),
        },
        // Falls under general product-edit access — anyone who can add/edit
        // products can bulk-update their images.
        permission: 'productSecurity.actions.add.access',
      },
      {
        action: {
          id: 'translation',
          label: this.lang.instant('PRODUCTS.ACTIONS.TRANSLATION'),
          color: 'secondary',
          handler: () => this.openTranslation(),
        },
        permission: 'productSecurity.actions.translation.access',
      },
      {
        action: {
          id: 'label-print-barcodes',
          label: this.lang.instant('PRODUCTS.ACTIONS.LABEL_PRINT_BARCODES'),
          color: 'secondary',
          handler: () => this.showBulkPrint(),
        },
        permission: 'productSecurity.actions.bulkPrint.access',
      },
    ];
    bulkCandidates.forEach(({ action, permission }) => {
      if (!permission || this.privileges.check(permission)) {
        this.bulkOperationActions.push(action);
      }
    });

    // Bulk Actions
    this.bulkActions = [
      {
        id: 'assign-tax',
        label: this.lang.instant('PRODUCTS.ACTIONS.ASSIGN_TAX'),
        requiresSelection: true,
        handler: (rows: any[]) => this.bulkAssignTax(rows)
      },
      {
        id: 'delete',
        label: this.lang.instant('PRODUCTS.ACTIONS.DELETE_SELECTED'),
        color: 'danger',
        requiresSelection: true,
        // No `confirmMessage` here — `bulkDeleteProducts` opens its own
        // confirmation modal with the stock-warning note, so relying on
        // list-page's built-in confirm would result in two dialogs.
        handler: (rows: any[]) => this.bulkDeleteProducts(rows)
      }
    ];

    this.searchConfig.placeholder = this.lang.instant('PRODUCTS.SEARCH_PLACEHOLDER');

    this.emptyState = {
      title: this.lang.instant('PRODUCTS.EMPTY_STATE.TITLE'),
      message: this.lang.instant('PRODUCTS.EMPTY_STATE.MESSAGE'),
    };
  }

  // Data Source
  loadProducts = async (params: ListQueryParams) => {
    const response = await this.productsService.getProductList({
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy ? {
        sortValue: params.sortBy.sortValue,
        sortDirection: params.sortBy.sortDirection
      } : {},
      filter: this.transformFilters(params.filter || {}),
      columns: params.columns
    });

    return {
      list: response.list,
      count: response.count,
      pageCount: response.pageCount
    };
  };

  private transformFilters(filters: any): any {
    // `types` is a checkbox-group filter — always serialize as an array. When
    // the URL restore sees a single value it hands back a bare string
    // (`filter_types=kit` → `"kit"`), so coerce here.
    return {
      type:        this.toArray(filters.types),
      departments: filters.departmentId ? [filters.departmentId] : [],
      categories:  filters.categoryId   ? [filters.categoryId]   : [],
      tags:        this.toArray(filters.tags),
    };
  }

  /** Accepts array / scalar / nullish and returns a clean string array. */
  private toArray(value: unknown): string[] {
    if (Array.isArray(value)) return value as string[];
    if (value === null || value === undefined || value === '') return [];
    return [String(value)];
  }

  getTypeKey(type: string): string {
    return type.replace(/([A-Z])/g, '_$1').toUpperCase();
  }

  /** Per-product-type chip palette — delegates to the shared util
   *  so every surface (this list, picker modals, price-label form,
   *  discount form) draws from the same source of truth. */
  getTypeBadgeStyle(type: string): Record<string, string> {
    return getProductTypeBadgeStyle(type);
  }

  onRowClick(event: any): void {
    // Matrix parents toggle their expansion via the chevron in the `name`
    // column template, so a click on the row body itself should do nothing.
    // Exception: the compact mobile cards have no chevron/expansion, so a
    // matrix tap there falls through to the drawer like everything else.
    if (event.row?.type === 'matrix' && !this.listPage?.useMobileCards()) return;

    // Route by column: the Qty badge opens the stock breakdown modal; every
    // other column (or a click outside a column) opens the details drawer.
    if (event.column?.key === 'qty') {
      this.openStockModal(event.row);
      return;
    }
    this.openProductDrawer(event.row);
  }

  private openStockModal(row: any): void {
    if (!row) return;
    const productId = row.id ?? row._id;
    if (!productId) return;
    this.modalService.open<ProductStockModalComponent, ProductStockModalData, any>(
      ProductStockModalComponent,
      {
        // Wider modal for the kit build/break flow which has a nested table.
        size: row.type === 'kit' ? 'lg' : 'md',
        data: {
          productId,
          productName: row.name,
          productType: row.type,
          qtySum: row.qty ?? row.inventorySummary?.qtySum ?? 0,
        },
      },
    );
  }

  private openProductDrawer(row: any): void {
    if (!row) return;
    // Parent rows carry `id`; child rows (matrix variants loaded lazily) may
    // carry `id` or `_id` depending on the API shape.
    const productId = row.id ?? row._id;
    if (!productId) return;

    this.modalService.open<ProductDetailDrawerComponent, ProductDetailDrawerData, void>(
      ProductDetailDrawerComponent,
      {
        drawer: true,
        drawerWidth: '905px',
        drawerResizable: true,
        drawerMinWidth: 905,
        data: {
          productId,
          isChild: !!row.parentId || !!row.parent_id,
          row,
        },
      }
    );
  }

  // Outside-click closing for the Add-new and More-menu dropdowns
  // is now owned by `<app-dropdown-menu-btn>`. The row "..." menu
  // continues to use the inline pattern below.

  toggleRowMenu(row: any, event: Event): void {
    event.stopPropagation();
    const id = row.id || row._id;
    if (this.openMenuRowId() === id) {
      this.closeRowMenu();
    } else {
      this.openMenuRowId.set(id);
      setTimeout(() => document.addEventListener('click', this.clickCloseListener, { once: true }));
    }
  }

  closeRowMenu(): void {
    this.openMenuRowId.set(null);
    document.removeEventListener('click', this.clickCloseListener);
  }

  editProduct(row: any, event: Event): void {
    event.stopPropagation();
    // Route pattern: /products/form/:type/:id
    const type = row.type || 'inventory';
    this.router.navigate(['/products/form', type, row.id]);
  }

  async printLabel(row: any, event: Event): Promise<void> {
    event.stopPropagation();
    const product = await this.productsService.getProduct(row.id);
    this.productsService.showGenerateBarcode(product);
  }

  async deleteProduct(row: any, event: Event): Promise<void> {
    event.stopPropagation();
    const ref = this.modalService.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title: this.lang.instant('COMMON.ACTIONS.DELETE'),
          message: this.lang.instant('PRODUCTS.MESSAGES.CONFIRM_DELETE', { name: row.name }),
          note: this.lang.instant('PRODUCTS.MESSAGES.DELETE_STOCK_WARNING'),
          confirm: this.lang.instant('COMMON.ACTIONS.DELETE'),
          danger: true,
        },
      }
    );
    const confirmed = await ref.afterClosed();
    if (!confirmed) return;

    await this.productsService.deleteProduct(row.id);
    this.listPage?.clearSelection();
    this.listPage?.refresh();
  }

  copyProduct(row: any, event: Event): void {
    event.stopPropagation();
    console.log('Copy product:', row.id);
  }

  async toggleProductExpansion(product: any, event: Event): Promise<void> {
    event.stopPropagation();

    const expanded = this.expandedProductIds();
    const newExpanded = new Set(expanded);

    if (expanded.has(product.id)) {
      newExpanded.delete(product.id);
    } else {
      newExpanded.add(product.id);
      await this.loadChildProducts(product);
    }

    this.expandedProductIds.set(newExpanded);
  }

  private async loadChildProducts(product: any): Promise<void> {
    const children = await this.productsService.productChildsList({
      page: 1,
      limit: 15,
      searchTerm: '',
      sortBy: {},
      filter: {},
      id: product.id
    });

    product.children = children.list;
    product.childrenCount = children.count;
  }

  async bulkAssignTax(rows: any[]): Promise<void> {
    const productIds = rows.map(r => r.id);
    const ref = this.modalService.open<PickTaxModalComponent, void, string>(
      PickTaxModalComponent,
      { size: 'sm', closeable: true, closeOnBackdrop: true }
    );
    const taxId = await ref.afterClosed();
    if (!taxId) return;

    await this.api.request(
      this.api.post('product/assignProductTax', { filterType: 'Product', productIds, taxId })
    );
    this.listPage?.clearSelection();
    this.listPage?.refresh();
  }

  async bulkDeleteProducts(rows: any[]): Promise<void> {
    const ids = rows.map(r => r.id);
    const ref = this.modalService.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title: this.lang.instant('PRODUCTS.ACTIONS.DELETE_SELECTED'),
          message: this.lang.instant('PRODUCTS.MESSAGES.CONFIRM_DELETE_SELECTED'),
          note: this.lang.instant('PRODUCTS.MESSAGES.DELETE_STOCK_WARNING_BULK'),
          confirm: this.lang.instant('COMMON.ACTIONS.DELETE'),
          danger: true,
        },
      }
    );
    const confirmed = await ref.afterClosed();
    if (!confirmed) return;

    for (const id of ids) {
      await this.productsService.deleteProduct(id);
    }
    this.listPage?.clearSelection();
    this.listPage?.refresh();
  }

  addNewProduct(type: string): void {
    // Route pattern: /products/form/:type/:id (id = 'new' to create)
    this.router.navigate(['/products/form', type, 'new']);
  }

  openImportExport(): void {
    this.router.navigate(['/products/import-export']);
  }

  showBulkPrint(): void {
    this.router.navigate(['/products/label-print'], { queryParams: this.bulkHandoffParams() });
  }

  showBulkImage(): void {
    this.router.navigate(['/products/bulk-image'], { queryParams: this.bulkHandoffParams() });
  }

  openPriceChange(): void {
    this.router.navigate(['/products/priceChange'], { queryParams: this.bulkHandoffParams() });
  }

  openTranslation(): void {
    this.router.navigate(['/products/translation'], { queryParams: this.bulkHandoffParams() });
  }

  openProductsAvailability(): void {
    this.router.navigate(['/products/products-availability'], { queryParams: this.bulkHandoffParams() });
  }

  openLogs(): void {
    console.log('Open logs');
  }

  /**
   * Build query params to carry the user's current list context into a bulk
   * operation page. Preference is given to the explicit selection (if any);
   * otherwise the active search + filter scope is forwarded so the bulk page
   * can pre-filter to the same working set the user was browsing.
   */
  private bulkHandoffParams(): Record<string, string> {
    const params: Record<string, string> = {};
    const selected = this.listPage?.selectedRows() ?? [];
    if (selected.length > 0) {
      params['ids'] = selected.map(r => (r as any).id).filter(Boolean).join(',');
      return params;
    }
    const search = this.listPage?.searchTerm();
    if (search) params['search'] = search;
    const filters = this.listPage?.activeFilters() ?? {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;
      if (Array.isArray(value) && value.length === 0) return;
      params[`filter_${key}`] = Array.isArray(value) ? value.join(',') : String(value);
    });
    return params;
  }

}
