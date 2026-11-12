import { Component, computed, inject, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { DropdownLoadParams, DropdownLoadResult } from '@shared/components/dropdown/search-dropdown.types';
import { EmployeeService } from '../../../employees/services/employee.service';
import { CompanyService } from '@core/auth/company.service';
import { DiscountService } from '../../../settings/discount/services/discount.service';
import { SuppliersService } from '../../../account/suppliers/services/suppliers.service';
import { CustomersService } from '../../../account/customers/services/customers.service';
import { InventoryLocationService } from '../../../products/services/inventory-location.service';
import { pickIds } from '../../utils/dropdown-values';
import { ProductListService } from '../../../products/services/product-list.service';

export interface FilterBranchOption { value: string; label: string; }

export interface ReportFiltersModalData {
  /** Branch choices; empty → no branch section. */
  branches: FilterBranchOption[];
  /** Only one branch can be chosen (Daily Closing). */
  singleBranch?: boolean;
  /** A branch must be chosen before the dialog can be applied (the legacy required filter). */
  requireBranch?: boolean;
  selected: string[];
  /** Offer the "compare to previous period" switch. */
  compare: boolean;
  compareValue: boolean;
  /** Offer a period comparison (previous N months / years). */
  comparePeriods: boolean;
  comparisonValue: { period: 'Month' | 'Year'; qty: number } | null;
  /** Offer a product filter (multi-select). */
  products: boolean;
  /** Only one product can be chosen. */
  singleProduct?: boolean;
  /** A product must be chosen before the dialog can be applied. */
  requireProduct?: boolean;
  productIds: string[];
  /** Offer a category filter (multi-select). */
  categories: boolean;
  categoryIds: string[];
  /** Offer a single-choice "filter by" with these values (empty → none). */
  filterByOptions: string[];
  filterBy: string;
  filterByLabel: string;
  /** Offer the purchase-mode choice. */
  purchaseMode: boolean;
  mode: string;
  /** Offer a product-type multi-choice with these values (empty → none). */
  productTypeOptions: string[];
  productTypes: string[];
  /** Offer the customer-type choice. */
  customerTypeOn: boolean;
  customerType: string;
  /** Offer the customer filter. */
  customers: boolean;
  customerIds: string[];
  /** Offer the one-discount picker. */
  discount: boolean;
  requireDiscount?: boolean;
  discountIds: string[];
  /** Offer the supplier filter. */
  suppliers: boolean;
  supplierIds: string[];
  /** Offer the "only customers with a balance" checkbox. */
  balanceOnly: boolean;
  balanceOnlyValue: boolean;
  /** Offer the "sales employee" switch. */
  salesEmployeeOn: boolean;
  salesEmployeeValue: boolean;
  /** Offer the inventory-location filter. */
  locations: boolean;
  locationIds: string[];
  /** Offer the "hide deleted products" checkbox. */
  hideDeleted: boolean;
  hideDeletedValue: boolean;
  /** Offer the "voided by" employee filter. */
  voidedBy: boolean;
  /** Offer a one-employee picker (Attendance). */
  singleEmployee: boolean;
  /** The employee must be chosen before the dialog can be applied. */
  requireEmployee?: boolean;
  /** i18n key of the one-employee picker's heading. */
  employeeLabel?: string;
  employeeIds: string[];
  /** Offer the void-reason filter. */
  voidReasons: boolean;
  voidReasonValues: string[];
  /** Offer the void-timing filter (Voided Sales). */
  voidTimings: boolean;
  voidTimingValues: string[];
  /** Offer a source filter with these choices (empty → none). */
  sourceOptions: string[];
  sources: string[];
  /** i18n key of the choice list's heading. */
  sourceLabel?: string;
  /** i18n key prefix of the choices' labels. */
  sourceOptionPrefix?: string;
  /** Offer the "apply opening hours" switch. */
  openingHour: boolean;
  openingHourValue: boolean;
}
export interface ReportFiltersModalResult {
  branches: string[]; compare: boolean; applyOpeningHour: boolean;
  comparison: { period: 'Month' | 'Year'; qty: number } | null;
  productIds: string[];
  categoryIds: string[];
  sources: string[];
  voidTimings: string[];
  filterBy: string;
  employeeIds: string[];
  voidReasons: string[];
  mode: string;
  locationIds: string[];
  hideDeleted: boolean;
  productTypes: string[];
  customerIds: string[];
  supplierIds: string[];
  discountIds: string[];
  salesEmployee: boolean;
  hasBalanceOnly: boolean;
  customerType: string;
}

/**
 * "Filters" dialog of the shared report filter bar (the legacy report filter modal): Branches, then the report's
 * switches (apply opening hours, compare to previous period). Edits a draft; nothing changes until Apply.
 */
@Component({
  selector: 'app-report-filters-modal',
  standalone: true,
  imports: [TranslateModule, SearchDropdownComponent],
  templateUrl: './report-filters-modal.component.html',
  styles: [`
    /* radios and checkboxes in the brand colour */
    input[type='radio'], input[type='checkbox'] { accent-color: #167d8f; }
    :host { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; height: 100%; }
    .opt { transition: border-color .15s, background .15s, box-shadow .15s; }
    .opt.opt-on { border-color: var(--color-brand-500, #32acc1); background: rgba(50, 172, 193, .06); box-shadow: 0 0 0 3px rgba(50, 172, 193, .12); }
  `],
})
export class ReportFiltersModalComponent {
  private lang = inject(TranslateService);
  private productList = inject(ProductListService);
  private employees = inject(EmployeeService);
  private locationsApi = inject(InventoryLocationService);
  private customersApi = inject(CustomersService);
  private suppliersApi = inject(SuppliersService);
  private discountsApi = inject(DiscountService);
  private company = inject(CompanyService);
  private ref = inject(MODAL_REF) as ModalRef<ReportFiltersModalResult | undefined>;
  readonly data = inject(MODAL_DATA) as ReportFiltersModalData;

  selected = signal<string[]>([...this.data.selected]);
  compare = signal(this.data.compareValue);
  openingHour = signal(this.data.openingHourValue);
  productIds = signal<string[]>([...this.data.productIds]);
  categoryIds = signal<string[]>([...this.data.categoryIds]);
  sources = signal<string[]>([...this.data.sources]);

  /** Categories are searched on the server, a page at a time (the shared products helper, as the product pickers do). */
  readonly loadCategories = (p: DropdownLoadParams) => this.productList.getCategories({ page: p.page, pageSize: p.pageSize, search: p.search });
  readonly categoryLabel = (c: { label: string; value: string }) => c.label;
  readonly categoryValue = (c: { label: string; value: string }) => c.value;
  readonly sameCategory = (a: any, b: any) => (a?.value ?? a) === (b?.value ?? b);
  voidTimings = signal<string[]>([...this.data.voidTimingValues]);
  filterBy = signal<string>(this.data.filterBy);
  mode = signal<string>(this.data.mode);
  locationIds = signal<string[]>([...this.data.locationIds]);
  productTypes = signal<string[]>([...this.data.productTypes]);
  customerIds = signal<string[]>([...this.data.customerIds]);
  customerType = signal<string>(this.data.customerType);
  supplierIds = signal<string[]>([...this.data.supplierIds]);
  discountIds = signal<string[]>([...this.data.discountIds]);
  /** Discounts are searched on the server, a page at a time; the first page also offers "no discount". */
  readonly loadDiscounts = async (p: DropdownLoadParams): Promise<DropdownLoadResult<{ id: string; name: string }>> => {
    try {
      const d = await this.discountsApi.getList({ page: p.page, limit: p.pageSize, searchTerm: p.search });
      const items = d.list.map(x => ({ id: String((x as any).id), name: String((x as any).name ?? '') }));
      const none = p.page === 1 && !p.search ? [{ id: 'others', name: this.lang.instant('REPORTS.FILTER.NO_DISCOUNT') }] : [];
      return { items: [...none, ...items], hasMore: p.page < d.pageCount };
    } catch { return { items: [], hasMore: false }; }
  };
  readonly discountLabel = (c: { id: string; name: string }) => c.name;
  readonly discountId = (c: { id: string; name: string }) => c.id;
  readonly sameDiscount = (a: any, b: any) => (a?.id ?? a) === (b?.id ?? b);
  /** Suppliers are searched on the server, a page at a time. */
  readonly loadSuppliers = async (p: DropdownLoadParams): Promise<DropdownLoadResult<{ id: string; name: string }>> => {
    try {
      const d = await this.suppliersApi.getSuppliersList({ page: p.page, limit: p.pageSize, searchTerm: p.search, sortBy: {} });
      const list: any[] = d?.list ?? [];
      return { items: list.map(c => ({ id: c.id, name: c.name })), hasMore: p.page < Number(d?.pageCount ?? 1) };
    } catch { return { items: [], hasMore: false }; }
  };
  readonly supplierLabel = (c: { id: string; name: string }) => c.name;
  readonly supplierId = (c: { id: string; name: string }) => c.id;
  readonly sameSupplier = (a: any, b: any) => (a?.id ?? a) === (b?.id ?? b);
  readonly customerTypeOptions = ['', 'Individual', 'Business'];
  balanceOnly = signal<boolean>(this.data.balanceOnlyValue);
  salesEmployee = signal<boolean>(this.data.salesEmployeeValue);
  /** Customers are searched on the server, a page at a time; the chosen ones come first so they show their names. */
  readonly loadCustomers = async (p: DropdownLoadParams): Promise<DropdownLoadResult<{ id: string; name: string }>> => {
    try {
      const d = await this.customersApi.getCustomerList({
        page: p.page, limit: p.pageSize, searchTerm: p.search, sortBy: {}, filter: {},
        ...(p.page === 1 && !p.search && this.customerIds().length ? { customerIds: this.customerIds() } : {}),
      });
      const list: any[] = d?.list ?? [];
      return { items: list.map(c => ({ id: c.id, name: c.name })), hasMore: p.page < Number(d?.pageCount ?? 1) };
    } catch { return { items: [], hasMore: false }; }
  };
  readonly customerLabel = (c: { id: string; name: string }) => c.name;
  readonly customerId = (c: { id: string; name: string }) => c.id;
  readonly sameCustomer = (a: any, b: any) => (a?.id ?? a) === (b?.id ?? b);
  isType = (t: string) => this.productTypes().includes(t);
  toggleType(t: string): void {
    const set = new Set(this.productTypes());
    set.has(t) ? set.delete(t) : set.add(t);
    this.productTypes.set(this.data.productTypeOptions.filter(o => set.has(o)));
  }
  hideDeleted = signal<boolean>(this.data.hideDeletedValue);
  /** Locations of the chosen branches (all of them when none is chosen), a page at a time. */
  readonly loadLocations = async (p: DropdownLoadParams): Promise<DropdownLoadResult<{ id: string; name: string }>> => {
    const r = await this.locationsApi.getList({ page: p.page, limit: p.pageSize, searchTerm: p.search, branches: this.selected() });
    return { items: r.list.map(l => ({ id: l.id, name: l.branchName ? `${l.name} · ${l.branchName}` : l.name })), hasMore: p.page < r.pageCount };
  };
  readonly locationLabel = (l: { id: string; name: string }) => l.name;
  readonly locationId = (l: { id: string; name: string }) => l.id;
  readonly sameLocation = (a: any, b: any) => (a?.id ?? a) === (b?.id ?? b);
  readonly modeOptions = ['actual', 'planned', 'forecast'];
  employeeIds = signal<string[]>([...this.data.employeeIds]);
  voidReasons = signal<string[]>([...this.data.voidReasonValues]);
  /** The company's void reasons (plus any picked one since removed from settings). */
  reasonOptions = signal<string[]>([]);
  constructor() {
    if (this.data.voidReasons) {
      void this.company.loadSettings().then(c => {
        const fromSettings: string[] = Array.isArray(c?.voidReasons) ? c.voidReasons : [];
        this.reasonOptions.set(Array.from(new Set([...fromSettings, ...this.voidReasons()])).filter(r => typeof r === 'string' && r !== ''));
      }).catch(() => this.reasonOptions.set([...this.voidReasons()]));
    }
  }
  readonly loadEmployees = async (p: DropdownLoadParams): Promise<DropdownLoadResult<{ id: string; name: string }>> => {
    const r = await this.employees.searchEmployees({ page: p.page, limit: p.pageSize, searchTerm: p.search });
    return { items: r.items, hasMore: r.hasMore };
  };
  readonly employeeLabel = (e: { id: string; name: string }) => e.name;
  readonly employeeId = (e: { id: string; name: string }) => e.id;
  readonly sameEmployee = (a: any, b: any) => (a?.id ?? a) === (b?.id ?? b);
  isReason = (r: string) => this.voidReasons().includes(r);
  toggleReason(r: string): void {
    const set = new Set(this.voidReasons());
    set.has(r) ? set.delete(r) : set.add(r);
    this.voidReasons.set([...set]);
  }
  readonly timingOptions = ['sameDay', 'differentDay', 'differentMonth', 'differentYear'];
  isTiming = (t: string) => this.voidTimings().includes(t);
  toggleTiming(t: string): void {
    const set = new Set(this.voidTimings());
    set.has(t) ? set.delete(t) : set.add(t);
    this.voidTimings.set(this.timingOptions.filter(o => set.has(o)));
  }

  /** Products are searched on the server, a page at a time; the already-picked ones are always included so they show their names. */
  readonly loadProducts = async (p: DropdownLoadParams): Promise<DropdownLoadResult<{ id: string; name: string }>> => {
    const res = await this.productList.getProductsListByType({
      page: p.page, limit: p.pageSize, searchTerm: p.search, sortBy: {},
      ...(p.page === 1 && !p.search && this.productIds().length ? { selectedProductId: this.productIds() } : {}),
    });
    return { items: res.list.map(x => ({ id: x.id, name: x.name })), hasMore: res.list.length >= p.pageSize };
  };
  readonly productLabel = (p: { id: string; name: string }) => p.name;
  readonly productId = (p: { id: string; name: string }) => p.id;
  readonly sameProduct = (a: any, b: any) => (a?.id ?? a) === (b?.id ?? b);

  toggleSource(s: string): void {
    const set = new Set(this.sources());
    set.has(s) ? set.delete(s) : set.add(s);
    this.sources.set(this.data.sourceOptions.filter(o => set.has(o)));
  }
  isSource = (s: string) => this.sources().includes(s);

  /** Period comparison: null = none. */
  comparison = signal(this.data.comparisonValue);
  readonly qtyOptions = Array.from({ length: 10 }, (_, i) => i + 1);

  setComparison(on: boolean): void { this.comparison.set(on ? (this.comparison() ?? { period: 'Month', qty: 1 }) : null); }
  setPeriod(period: 'Month' | 'Year'): void { const c = this.comparison(); if (c) this.comparison.set({ ...c, period }); }
  setQty(qty: number): void { const c = this.comparison(); if (c) this.comparison.set({ ...c, qty }); }
  search = signal('');

  visibleBranches = computed(() => {
    const q = this.search().trim().toLowerCase();
    return q ? this.data.branches.filter(b => b.label.toLowerCase().includes(q)) : this.data.branches;
  });
  allVisibleSelected = computed(() => {
    const v = this.visibleBranches();
    return v.length > 0 && v.every(b => this.selected().includes(b.value));
  });

  isSelected = (id: string) => this.selected().includes(id);
  /** The required branch is not chosen yet — Apply stays disabled. */
  missingRequired = computed(() =>
    (!!this.data.requireBranch && this.selected().length === 0) || (!!this.data.requireProduct && this.productIds().length === 0) || (!!this.data.requireEmployee && this.employeeIds().length === 0) || (!!this.data.requireDiscount && this.discountIds().length === 0));
  /** The product dropdown hands back an id (single) or a list (multiple). */
  setProducts(v: unknown): void { this.productIds.set(pickIds(v)); }
  /** The dropdown's two-way value is its item objects — keep only their ids. */
  readonly ids = pickIds;

  toggleBranch(id: string): void {
    if (this.data.singleBranch) { this.selected.set(this.selected().includes(id) ? [] : [id]); return; }
    const set = new Set(this.selected());
    set.has(id) ? set.delete(id) : set.add(id);
    this.selected.set([...set]);
  }

  /** Select / clear every branch currently visible (respects the search box). */
  toggleAllVisible(): void {
    const set = new Set(this.selected());
    const ids = this.visibleBranches().map(b => b.value);
    if (this.allVisibleSelected()) ids.forEach(i => set.delete(i)); else ids.forEach(i => set.add(i));
    this.selected.set([...set]);
  }

  clearAll(): void {
    this.selected.set([]);
    this.compare.set(false);
    this.openingHour.set(false);
    this.comparison.set(null);
    this.productIds.set([]);
    this.sources.set([]);
    this.categoryIds.set([]);
    this.voidTimings.set([]);
    this.employeeIds.set([]);
    this.voidReasons.set([]);
    this.mode.set('actual');
    this.locationIds.set([]);
    this.hideDeleted.set(false);
    this.productTypes.set([]);
    this.customerIds.set([]);
    this.supplierIds.set([]);
    this.discountIds.set([]);
    this.balanceOnly.set(false);
    this.salesEmployee.set(false);
    this.customerType.set('');
    if (this.data.filterByOptions.length) this.filterBy.set(this.data.filterByOptions[0]);
  }
  cancel(): void { this.ref.dismiss(); }
  apply(): void {
    if (this.missingRequired()) return;
    this.ref.close({
      branches: this.selected(), compare: this.compare(), applyOpeningHour: this.openingHour(), comparison: this.comparison(),
      productIds: this.productIds(), categoryIds: this.categoryIds(), sources: this.sources(), voidTimings: this.voidTimings(), filterBy: this.filterBy(), employeeIds: this.employeeIds(), voidReasons: this.voidReasons(), mode: this.mode(), locationIds: this.locationIds(), hideDeleted: this.hideDeleted(), productTypes: this.productTypes(), customerIds: this.customerIds(), supplierIds: this.supplierIds(), discountIds: this.discountIds(), hasBalanceOnly: this.balanceOnly(), salesEmployee: this.salesEmployee(), customerType: this.customerType(),
    });
  }
}
