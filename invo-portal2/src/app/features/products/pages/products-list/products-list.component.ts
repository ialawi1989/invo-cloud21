import { Component, inject, OnInit, signal, HostListener, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import {
  TableColumn,
  FilterConfig,
  ActionConfig,
  BulkActionConfig,
  ListQueryParams
} from '@shared/components/list-page/interfaces/list-page.types';

import { ProductsService } from '../../services/products.service';
import { ProductsSidePanelService } from '../../services/products-side-panel.service';
import { ProductsListStateService } from '../../state/products-list.state';
import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [CommonModule, ListPageComponent, TranslateModule, ListCellTemplateDirective, ListRowActionsDirective],
  providers: [ProductsListStateService],
  templateUrl: './products-list.component.html',
  styleUrl: './products-list.component.scss'
})
export class ProductsListComponent implements OnInit {
  private router = inject(Router);
  private productsService = inject(ProductsService);
  private sidePanel = inject(ProductsSidePanelService);
  private state = inject(ProductsListStateService);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);
  private modalService = inject(ModalService);

  // Breadcrumbs
  breadcrumbs = [
    { label: 'Home', routerLink: '/', icon: 'home' as const, iconOnly: true },
    { label: 'Products', routerLink: '/products' },
    { label: 'Product List' }
  ];

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  // UI state
  expandedProductIds = signal<Set<string>>(new Set());
  openMenuRowId = signal<string | null>(null);
  addNewOpen = signal(false);
  moreMenuOpen = signal(false);

  // Split header actions
  addNewActions: ActionConfig[] = [];
  moreActions: ActionConfig[] = [];          // general (Import/Export, Logs)
  bulkOperationActions: ActionConfig[] = []; // grouped under "Bulk operations"

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

  sortingConfig = {
    enabled: true,
    defaultSort: {
      key: 'name',
      direction: 'asc' as const
    }
  };

  emptyState = {
    title: '',
    message: '',
    actionLabel: '',
    actionHandler: () => this.addNewProduct('inventory')
  };

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('products');
    this.initializeTranslations();
  }


  private initializeTranslations(): void {
    // Columns
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
        key: 'departmentName',
        label: this.lang.instant('PRODUCTS.FIELDS.DEPARTMENT'),
        sortable: true,
        width: '150px'
      },
      {
        key: 'categoryName',
        label: this.lang.instant('PRODUCTS.FIELDS.CATEGORY'),
        sortable: true,
        width: '150px'
      },
      {
        key: 'qtySum',
        label: this.lang.instant('PRODUCTS.FIELDS.QTY'),
        sortable: true,
        width: '100px',
        customTemplate: true
      },
      // Stock Value - conditional on permission
      ...(this.privileges.check('productSecurity.actions.viewStockValue.access') ? [{
        key: 'stockValue',
        label: this.lang.instant('PRODUCTS.FIELDS.STOCK_VALUE'),
        sortable: true,
        pipe: 'currency' as const,
        pipeArgs: { currency: 'BHD' },
        width: '150px'
      }] : []),
      {
        key: 'defaultPrice',
        label: this.lang.instant('PRODUCTS.FIELDS.PRICE'),
        sortable: true,
        pipe: 'currency' as const,
        pipeArgs: { currency: 'BHD' },
        width: '120px'
      },
      {
        key: 'type',
        label: this.lang.instant('PRODUCTS.FIELDS.TYPE'),
        sortable: true,
        customTemplate: true,
        width: '120px',
        locked: true,
        primary: true,
        visible: true
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
      console.log(permission, this.privileges.check(permission))
      if (!permission || this.privileges.check(permission)) {
        this.bulkOperationActions.push(action);
      }
    });

    // Bulk Actions
    this.bulkActions = [
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
      actionLabel: this.lang.instant('PRODUCTS.EMPTY_STATE.ACTION'),
      actionHandler: () => this.addNewProduct('inventory')
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
    const tags = filters.tags;
    return {
      type: filters.types || [],
      departments: filters.departmentId ? [filters.departmentId] : [],
      categories: filters.categoryId ? [filters.categoryId] : [],
      tags: Array.isArray(tags) ? tags : (tags ? [tags] : [])
    };
  }

  getTypeKey(type: string): string {
    return type.replace(/([A-Z])/g, '_$1').toUpperCase();
  }

  getTypeBadgeStyle(type: string): Record<string, string> {
    const styles: Record<string, { bg: string; color: string }> = {
      'inventory':     { bg: '#dbeafe', color: '#1d4ed8' },
      'serialized':    { bg: '#f3e8ff', color: '#7c3aed' },
      'batch':         { bg: '#fef9c3', color: '#a16207' },
      'kit':           { bg: '#dcfce7', color: '#15803d' },
      'service':       { bg: '#cffafe', color: '#0e7490' },
      'package':       { bg: '#ffedd5', color: '#c2410c' },
      'menuItem':      { bg: '#ede9fe', color: '#6d28d9' },
      'menuSelection': { bg: '#e0e7ff', color: '#4338ca' },
      'tailoring':     { bg: '#ccfbf1', color: '#0f766e' },
      'matrix':        { bg: '#f1f5f9', color: '#475569' }
    };
    const s = styles[type] || { bg: '#f1f5f9', color: '#475569' };
    return { background: s.bg, color: s.color };
  }

  onRowClick(event: any): void {
    if (event.row.type !== 'matrix') {
      this.openSidePanel(event.row);
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.addNewOpen.set(false);
    this.moreMenuOpen.set(false);
  }

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
    this.router.navigate(['/products/form', row.id]);
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
    this.router.navigate(['/products/form/0'], { queryParams: { type } });
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

  private openSidePanel(product: any): void {
    if (product.type !== 'matrix') {
      const showHistory = ['batch', 'serialized', 'inventory', 'kit'].includes(product.type);

      // Signal service - NO Store!
      this.sidePanel.open({
        productId: product.id,
        showHistory,
        supplierName: '',
        supplierId: ''
      });
    }
  }
}
