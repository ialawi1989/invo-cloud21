import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { BranchConnectionService } from '@core/layout/services/branch.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ModalService } from '@shared/modal';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DropdownLoadFn, DropdownLoadResult } from '@shared/components/dropdown/search-dropdown.types';
import { SkeletonComponent } from '@shared/components/skeleton/skeleton.component';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ImportWizardComponent } from '@shared/components/import-wizard/import-wizard.component';
import {
  ImportRow,
  ImportSummaryCounts,
  ImportWizardConfig,
} from '@shared/components/import-wizard/import-wizard.types';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { MynumberPipe } from '@core/pipes/mynumber.pipe';
import { ProductsService } from '../../../../services/products.service';

import {
  StockAdjustModalComponent,
  StockAdjustData,
  StockAdjustResult,
} from './stock-adjust-modal.component';
import {
  UnitCostAdjustModalComponent,
  UnitCostAdjustData,
  UnitCostAdjustResult,
} from '../product-pricing/unit-cost-adjust-modal.component';
import {
  BranchBulkEditModalComponent,
  BulkEditData,
  BulkEditField,
  BulkEditResult,
} from './branch-bulk-edit-modal.component';
import {
  BranchExportModalComponent,
  BranchExportData,
  BranchExportResult,
} from './branch-io/branch-export-modal.component';
import {
  BranchIoBucket,
  BranchIoKind,
  ExportScope,
  ImportMode,
  buildBranchImportConfig,
  columnsFor,
  exportBranchData,
} from './branch-io/branch-io.config';

import { Product, BranchProduct } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';
import { BranchPriceByQtyComponent } from './branch-price-by-qty/branch-price-by-qty.component';
import { BranchSerialsComponent }    from './branch-serials/branch-serials.component';
import { BranchBatchesComponent }    from './branch-batches/branch-batches.component';
import { ActivatedRoute } from '@angular/router';

type PricingType = '' | 'buyDownPrice' | 'priceBoundary' | 'priceByQty' | 'openPrice';

interface PricingTypeOption { value: PricingType; labelKey: string; }

/** One entry in the master list. `index` is the canonical FormArray index
 *  and never changes — filtering and paging only reorder *this* view model,
 *  never the FormArray itself. */
export interface BranchRow {
  index:    number;
  branchId: string;
  name:     string;
}

type ListFilter = 'all' | 'override' | 'errors' | 'low';
type DetailTab  = 'settings' | 'stock' | 'pricing' | 'serials' | 'batches';

/** Rows rendered per page in the master list. */
const PAGE_SIZE = 20;
const MOBILE_QUERY = '(max-width: 820px)';

/** Field → label key, used to name a branch's invalid controls in the
 *  detail pane's error alert and the header badge. */
const FIELD_LABELS: Record<string, string> = {
  price:              'PRODUCTS.PRICING.DEFAULT_PRICE',
  onHand:             'PRODUCTS.FORM.ON_HAND',
  unitCost:           'PRODUCTS.PRICING.UNIT_COST',
  reorderPoint:       'PRODUCTS.FORM.REORDER_POINT',
  reorderLevel:       'PRODUCTS.FORM.REORDER_LEVEL',
  openingBalance:     'PRODUCTS.FORM.OPENING_BALANCE',
  openingBalanceCost: 'PRODUCTS.FORM.OPENING_BALANCE_COST',
  buyDownPrice:       'PRODUCTS.FORM.BUY_DOWN_PRICE',
  buyDownQty:         'PRODUCTS.FORM.BUY_DOWN_QTY',
  priceBoundriesFrom: 'PRODUCTS.FORM.PRICE_FROM',
  priceBoundriesTo:   'PRODUCTS.FORM.PRICE_TO',
  serials:            'PRODUCTS.FORM.SERIALS',
  batches:            'PRODUCTS.FORM.BATCHES',
  priceByQty:         'PRODUCTS.FORM.PRICE_BY_QTY',
};

/**
 * branch-product-section — master/detail
 * ──────────────────────────────────────
 * Per-branch pricing + stock. A FormArray of FormGroups, one row per
 * branch, built once for *every* branch on init and never rebuilt: the
 * searchable list on the left is a view model (`BranchRow`) that carries
 * the canonical FormArray index, so filtering/paging can't detach a
 * control from its value.
 *
 * Layout:
 *   • master pane — search, filter chips, infinite-scrolling branch list,
 *     a standing "Bulk edit…" action, collapsible to a rail on desktop
 *   • detail pane — only the active branch is rendered (its controls are
 *     the only ones in the DOM), split into Settings / Stock / Pricing /
 *     Serials / Batches tabs
 *   • bulk edit modal — owns both which branches to write to and what to
 *     write (field values or a copy of the active branch), writing through
 *     the FormArray so it stays the single source of truth
 *
 * Under 820px the two panes alternate (list ⇄ detail) instead of sitting
 * side by side, and the desktop rail is disabled.
 */
@Component({
  selector: 'app-pf-branch-product-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    SearchDropdownComponent,
    SkeletonComponent,
    ToggleComponent,
    DropdownMenuBtnComponent,
    BranchPriceByQtyComponent,
    BranchSerialsComponent,
    BranchBatchesComponent,
    MycurrencyPipe,
    MynumberPipe,
  ],
  templateUrl: './branch-product-section.component.html',
  styleUrl: './branch-product-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchProductSectionComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private branchesSvc = inject(BranchConnectionService);
  private modals = inject(ModalService);
  private productsService = inject(ProductsService);
  private privileges = inject(PrivilegeService);
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);
  private breakpoints = inject(BreakpointObserver);

  /** Deep-link target from `?branch=<id>` (matrix editor "open product") —
   *  the branch to focus on load. Applied once, after the rows are built. */
  private deepLinkBranchId: string | null = null;
  private deepLinkApplied = false;

  /**
   * Privilege gates — 1:1 port of the old project's branch component.
   *   - `canAdjust`           : `manualAdjustmentSecurity.access`
   *   - `canManageUnitCost`   : `productSecurity.actions.manageUnitCost.access`
   *   - `canViewStockValue`   : `productSecurity.actions.viewStockValue.access`
   */
  readonly canAdjust         = this.privileges.check('manualAdjustmentSecurity.access');
  readonly canManageUnitCost = this.privileges.check('productSecurity.actions.manageUnitCost.access');
  readonly canViewStockValue = this.privileges.check('productSecurity.actions.viewStockValue.access');

  /**
   * Mirrors the old project's `productInfo.branchesUnitCost != null` gate —
   * the unit-cost block is only meaningful when the backend has populated
   * per-branch cost overrides.
   */
  hasBranchesUnitCost = computed<boolean>(() => {
    const list = this.productInfo().branchesUnitCost;
    return Array.isArray(list) && list.length > 0;
  });

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  rows!: FormArray<FormGroup>;
  activeTab = signal<number>(0);

  /**
   * Ticks on every FormArray value/status emission. Computeds that read
   * form values must depend on this tick so they re-evaluate — signals
   * don't see `FormControl.value` mutations on their own.
   */
  private rowsTick = signal(0);

  // ─── Shell state ───────────────────────────────────────────────────────
  /** Whole-section collapse. The header summary + error badge stay visible
   *  when closed — a hidden error count leaves Save disabled with no clue. */
  sectionOpen = signal<boolean>(true);
  toggleSection(): void { this.sectionOpen.update(v => !v); }

  /** Master pane collapsed to a rail. Desktop only. */
  paneOpen = signal<boolean>(true);
  setPaneOpen(open: boolean): void { this.paneOpen.set(open); }

  /** Under 820px the panes alternate instead of sitting side by side. */
  isMobile   = signal<boolean>(false);
  mobileView = signal<'list' | 'detail'>('list');
  backToList(): void { this.mobileView.set('list'); }

  // ─── Master list state ─────────────────────────────────────────────────
  /** Raw input value (bound to the box) and its debounced twin. */
  searchInput = signal<string>('');
  private search = signal<string>('');
  private searchTimer: any = null;

  filter      = signal<ListFilter>('all');
  loadedCount = signal<number>(PAGE_SIZE);

  private listBox  = viewChild<ElementRef<HTMLElement>>('listBox');
  private sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  constructor() {
    // Prefetch the active branch's locations so the Location trigger can
    // resolve its label before the user ever opens the dropdown.
    effect(() => {
      const idx = this.activeTab();
      void this.rowsTick();
      if (this.rows) this.prefetchLocationsFor(idx);
    });

    // Deep-link (?branch=<id>): focus that branch once the rows exist.
    effect(() => {
      void this.rowsTick();
      if (!this.deepLinkBranchId || this.deepLinkApplied || !this.rows) return;
      const idx = this.rows.controls.findIndex(g => g.value['branchId'] === this.deepLinkBranchId);
      if (idx < 0) return;
      this.deepLinkApplied = true;
      this.activeTab.set(idx);
    });

    // Infinite scroll. The sentinel node is destroyed and recreated on every
    // re-render, so the observer is rebuilt (and the old one disconnected)
    // whenever the view child changes — a stale observer silently stops firing.
    effect((onCleanup) => {
      const el = this.sentinel()?.nativeElement;
      // The list only owns a scroll box on desktop; on mobile it scrolls with
      // the page, so the viewport (null root) is the right frame of reference.
      const root = this.isMobile() ? null : (this.listBox()?.nativeElement ?? null);
      if (!el) return;
      const io = new IntersectionObserver(
        (entries) => { if (entries[0]?.isIntersecting) this.loadMore(); },
        { root, rootMargin: '120px' },
      );
      io.observe(el);
      onCleanup(() => io.disconnect());
    });

    this.breakpoints.observe(MOBILE_QUERY)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        this.isMobile.set(state.matches);
        // Leaving mobile: both panes are visible again, so reset the view.
        if (!state.matches) this.mobileView.set('list');
      });
  }

  // ─── Master list — derived ─────────────────────────────────────────────
  /** Every branch, in FormArray order, with its canonical index. */
  allRows = computed<BranchRow[]>(() => {
    void this.rowsTick();
    if (!this.rows) return [];
    return this.rows.controls.map((g, index) => ({
      index,
      branchId: String(g.value['branchId'] ?? ''),
      name:     String(g.value['branchName'] ?? '') || this.translate.instant('PRODUCTS.FORM.UNNAMED_BRANCH'),
    }));
  });

  /** Rows matching the current chip + search. Paging slices this, so
   *  "select all matching" can still reach rows never scrolled into view. */
  visibleRows = computed<BranchRow[]>(() => {
    const term   = this.search().trim().toLowerCase();
    const filter = this.filter();
    return this.allRows().filter((r) => {
      if (filter === 'override' && !this.isOverride(r.index)) return false;
      if (filter === 'errors'   && !this.hasErrors(r.index))  return false;
      if (filter === 'low'      && !this.isLowStock(r.index)) return false;
      return !term || r.name.toLowerCase().includes(term);
    });
  });

  pagedRows = computed<BranchRow[]>(() => this.visibleRows().slice(0, this.loadedCount()));
  hasMore   = computed<boolean>(() => this.visibleRows().length > this.pagedRows().length);

  /** Position of the active branch within the current filter — the mobile
   *  detail header's "{{i}} of {{n}}" marker. */
  activePosition = computed<number>(() =>
    this.visibleRows().findIndex(r => r.index === this.activeTab()) + 1,
  );

  // ─── Row status helpers ────────────────────────────────────────────────
  private groupAt(index: number): FormGroup | null {
    return (this.rows?.at(index) as FormGroup | undefined) ?? null;
  }

  isOverride(index: number): boolean {
    return !!this.groupAt(index)?.value['has_different_price'];
  }

  isAvailable(index: number): boolean {
    return !!this.groupAt(index)?.value['available'];
  }

  isLowStock(index: number): boolean {
    const v = this.groupAt(index)?.getRawValue() as any;
    if (!v) return false;
    const rp = Number(v.reorderPoint ?? 0);
    return rp > 0 && Number(v.onHand ?? 0) <= rp;
  }

  hasErrors(index: number): boolean {
    return !!this.groupAt(index)?.invalid;
  }

  /** Field name + message per invalid control, for the detail alert. */
  rowErrors(index: number): { field: string; msg: string }[] {
    const grp = this.groupAt(index);
    if (!grp || grp.valid) return [];
    const out: { field: string; msg: string }[] = [];
    for (const [name, ctl] of Object.entries(grp.controls)) {
      if (ctl.valid) continue;
      const label = FIELD_LABELS[name];
      out.push({
        field: label ? this.translate.instant(label) : name,
        msg:   this.messageFor(ctl.errors),
      });
    }
    return out;
  }

  private messageFor(errors: Record<string, any> | null): string {
    if (!errors) return this.translate.instant('COMMON.INVALID');
    if (errors['required']) return this.translate.instant('COMMON.REQUIRED');
    if (errors['min'])      return this.translate.instant('PRODUCTS.FORM.MIN_VALUE', { value: errors['min'].min });
    return this.translate.instant('COMMON.INVALID');
  }

  /** One indicator per row — error beats low stock beats availability. */
  rowStatus(index: number): 'error' | 'low' | 'on' | 'off' {
    if (this.hasErrors(index))  return 'error';
    if (this.isLowStock(index)) return 'low';
    return this.isAvailable(index) ? 'on' : 'off';
  }

  // ─── Header summary / chips ────────────────────────────────────────────
  totalCount = computed<number>(() => this.allRows().length);

  overriddenCount = computed<number>(() =>
    this.allRows().filter(r => this.isOverride(r.index)).length,
  );
  errorCount = computed<number>(() =>
    this.allRows().filter(r => this.hasErrors(r.index)).length,
  );
  lowStockCount = computed<number>(() =>
    this.allRows().filter(r => this.isLowStock(r.index)).length,
  );
  availableCount = computed<number>(() =>
    this.allRows().filter(r => this.isAvailable(r.index)).length,
  );

  /** Header badge → filter to the failing branches and open the first. */
  jumpToErrors(): void {
    const first = this.allRows().find(r => this.hasErrors(r.index));
    this.sectionOpen.set(true);
    this.setFilter('errors');
    if (first) this.openBranch(first.index);
  }

  setFilter(f: ListFilter): void {
    this.filter.set(f);
    this.resetPaging();
  }

  onSearchInput(value: string): void {
    this.searchInput.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.search.set(value);
      this.resetPaging();
    }, 250);
  }

  clearFilters(): void {
    this.searchInput.set('');
    this.search.set('');
    this.filter.set('all');
    this.resetPaging();
  }

  private resetPaging(): void {
    this.loadedCount.set(PAGE_SIZE);
    const box = this.listBox()?.nativeElement;
    if (box) box.scrollTop = 0;
  }

  loadMore(): void {
    if (!this.hasMore()) return;
    this.loadedCount.update(n => n + PAGE_SIZE);
  }

  // ─── Bulk actions ──────────────────────────────────────────────────────
  /** Runs `fn` over the branches the bulk modal targeted. */
  private eachOf(targets: number[], fn: (grp: FormGroup, index: number) => void): void {
    targets.forEach((i) => {
      const grp = this.groupAt(i);
      if (grp) fn(grp, i);
    });
    if (targets.length) this.rows.markAsDirty();
  }

  /**
   * Fields the bulk editor offers — the columns the old bulk-edit table had,
   * filtered by the same visibility + privilege gates the detail pane uses.
   * Seeded from the active branch so the modal opens on sensible values.
   */
  private bulkEditFields(): BulkEditField[] {
    const f = this.f();
    const v = (this.groupAt(this.activeTab())?.getRawValue() ?? {}) as any;
    const isNew = !this.productInfo().id;
    const fields: BulkEditField[] = [];

    if (f?.available) {
      fields.push({ key: 'available', label: 'PRODUCTS.FORM.AVAILABLE', type: 'toggle', value: !!v.available });
    }
    if (f?.availableOnline) {
      fields.push({ key: 'availableOnline', label: 'PRODUCTS.FORM.AVAILABLE_ONLINE', type: 'toggle', value: !!v.availableOnline });
    }
    if (f?.reorderPoint?.isVisible) {
      fields.push({ key: 'reorderPoint', label: 'PRODUCTS.FORM.REORDER_POINT', type: 'number', value: Number(v.reorderPoint ?? 0) });
    }
    if (f?.reorderLevel?.isVisible) {
      fields.push({ key: 'reorderLevel', label: 'PRODUCTS.FORM.REORDER_LEVEL', type: 'number', value: Number(v.reorderLevel ?? 0) });
    }
    // Cost and opening balances are only writable while the product is new —
    // afterwards they move through the adjustment flow, same as the old table.
    if (isNew && f?.unitCost?.isVisible && this.canManageUnitCost) {
      fields.push({ key: 'unitCost', label: 'PRODUCTS.PRICING.UNIT_COST', type: 'number', value: Number(v.unitCost ?? 0) });
    }
    if (isNew && f?.openingBalance?.isVisible) {
      fields.push({ key: 'openingBalance', label: 'PRODUCTS.FORM.OPENING_BALANCE', type: 'number', value: Number(v.openingBalance ?? 0) });
    }
    if (isNew && f?.openingBalanceCost?.isVisible) {
      fields.push({ key: 'openingBalanceCost', label: 'PRODUCTS.FORM.OPENING_BALANCE_COST', type: 'number', value: Number(v.openingBalanceCost ?? 0) });
    }
    if (f?.differentPrice) {
      fields.push({ key: 'has_different_price', label: 'PRODUCTS.FORM.HAS_DIFFERENT_PRICE', type: 'toggle', value: !!v.has_different_price });
      if (f?.price?.isVisible) {
        fields.push({ key: 'price', label: 'PRODUCTS.PRICING.DEFAULT_PRICE', type: 'number', value: Number(v.price ?? 0) });
      }
    }
    return fields;
  }

  /**
   * Open the bulk editor. The modal owns both halves of the operation —
   * which branches to write to and what to write — so it needs no
   * pre-existing selection in the list.
   */
  async openBulkEdit(): Promise<void> {
    const fields = this.bulkEditFields();

    const ref = this.modals.open<BranchBulkEditModalComponent, BulkEditData, BulkEditResult | undefined>(
      BranchBulkEditModalComponent,
      {
        // Two columns (branch picker | fields) need the wider shell.
        size: 'lg',
        data: {
          branches:    this.allRows().map(r => ({ index: r.index, name: r.name })),
          preselected: [this.activeTab()],
          sourceIndex: this.activeTab(),
          sourceName:  this.activeBranchName(),
          fields,
        },
      },
    );

    const result = await ref.afterClosed();
    if (!result) return;

    if (result.mode === 'copy') {
      this.copySettingsTo(result.targets);
      return;
    }

    const patch = result.patch ?? {};
    this.eachOf(result.targets, (grp) => {
      grp.patchValue(patch);
      // The price override drags its validators along — same rule the
      // single-branch checkbox applies.
      if ('has_different_price' in patch) {
        this.applyPriceValidators(grp, !!patch['has_different_price']);
      }
      grp.markAsDirty();
    });
  }

  /** Price is required-and-positive while the override is on, unvalidated
   *  and null when it's off. Shared by the bulk editor and the copy action. */
  private applyPriceValidators(grp: FormGroup, override: boolean): void {
    const priceCtl = grp.get('price');
    if (!priceCtl) return;
    if (override) {
      priceCtl.setValidators([Validators.required, Validators.min(0)]);
      if (priceCtl.value == null || priceCtl.value === '') priceCtl.setValue(0, { emitEvent: false });
    } else {
      priceCtl.clearValidators();
      priceCtl.setValue(null, { emitEvent: false });
    }
    priceCtl.updateValueAndValidity({ emitEvent: false });
  }

  /** Copies the operational settings of the active branch onto the branches
   *  ticked in the bulk modal — the one bulk operation the old UI couldn't do. */
  private copySettingsTo(targets: number[]): void {
    const src = this.groupAt(this.activeTab());
    if (!src) return;
    const v = src.getRawValue() as any;
    this.eachOf(targets, (grp, i) => {
      if (i === this.activeTab()) return;
      grp.patchValue({
        available:           v.available,
        availableOnline:     v.availableOnline,
        reorderPoint:        v.reorderPoint,
        reorderLevel:        v.reorderLevel,
        has_different_price: v.has_different_price,
        price:               v.has_different_price ? v.price : null,
      });
      // Keep the price validators honest on the copy target.
      this.applyPriceValidators(grp, !!v.has_different_price);
      grp.markAsDirty();
    });
  }

  /** Same fallback the list rows use — a blank name reads as a broken label
   *  in the detail header, the export modal and the bulk-edit mode strip. */
  activeBranchName = computed<string>(() => {
    void this.rowsTick();
    return String(this.groupAt(this.activeTab())?.value['branchName'] ?? '')
      || this.translate.instant('PRODUCTS.FORM.UNNAMED_BRANCH');
  });

  // ─── Detail tabs ───────────────────────────────────────────────────────
  detailTab = signal<DetailTab>('settings');

  private f = computed(() => this.fieldsOptions()?.branchProduct ?? null);

  showSettingsTab = computed<boolean>(() => {
    const f = this.f();
    return !!(f?.available || f?.availableOnline || f?.reorderPoint?.isVisible ||
              f?.reorderLevel?.isVisible || f?.location?.isVisible);
  });
  showStockTab = computed<boolean>(() => {
    const f = this.f();
    return !!(f?.onHand?.isVisible || f?.openingBalance?.isVisible ||
              (f?.unitCost?.isVisible && this.canManageUnitCost));
  });
  showPricingTab = computed<boolean>(() => {
    const f = this.f();
    return !!(f?.differentPrice || f?.pricingType?.isVisible);
  });
  showSerialsTab = computed<boolean>(() =>
    this.productInfo().type === 'serialized' && !!this.f()?.serials?.isVisible,
  );
  showBatchesTab = computed<boolean>(() =>
    this.productInfo().type === 'batch' && !!this.f()?.batches?.isVisible,
  );

  visibleTabs = computed<{ key: DetailTab; label: string; count?: number }[]>(() => {
    const tabs: { key: DetailTab; label: string; count?: number }[] = [];
    if (this.showSettingsTab()) tabs.push({ key: 'settings', label: 'PRODUCTS.FORM.TAB_SETTINGS' });
    if (this.showStockTab())    tabs.push({ key: 'stock',    label: 'PRODUCTS.FORM.TAB_STOCK' });
    if (this.showPricingTab())  tabs.push({ key: 'pricing',  label: 'PRODUCTS.FORM.TAB_PRICING' });
    if (this.showSerialsTab())  tabs.push({ key: 'serials',  label: 'PRODUCTS.FORM.SERIALS', count: this.activeSerialsCount() });
    if (this.showBatchesTab())  tabs.push({ key: 'batches',  label: 'PRODUCTS.FORM.BATCHES', count: this.activeBatchesCount() });
    return tabs;
  });

  activeSerialsCount = computed<number>(() => {
    void this.rowsTick();
    return (this.activeGroup()?.get('serials') as FormArray | null)?.length ?? 0;
  });
  activeBatchesCount = computed<number>(() => {
    void this.rowsTick();
    return (this.activeGroup()?.get('batches') as FormArray | null)?.length ?? 0;
  });

  setDetailTab(tab: DetailTab): void { this.detailTab.set(tab); }

  /** Open a branch from the list (and switch panes on mobile). */
  openBranch(index: number): void {
    this.changeTab(index);
    // The picked branch may not expose the current tab (e.g. Serials on a
    // non-serialized product) — fall back to the first visible one.
    const tabs = this.visibleTabs();
    if (!tabs.some(t => t.key === this.detailTab())) {
      this.detailTab.set(tabs[0]?.key ?? 'settings');
    }
    if (this.isMobile()) this.mobileView.set('detail');
  }

  /** Pricing-type dropdown options — mirror old `branch.component.html`. */
  readonly PRICING_TYPE_OPTIONS: PricingTypeOption[] = [
    { value: '',             labelKey: 'PRODUCTS.FORM.PRICING_NONE' },
    { value: 'buyDownPrice', labelKey: 'PRODUCTS.FORM.BUY_DOWN' },
    { value: 'priceByQty',   labelKey: 'PRODUCTS.FORM.PRICE_BY_QTY' },
    { value: 'priceBoundary',labelKey: 'PRODUCTS.FORM.PRICE_BOUNDARY' },
    { value: 'openPrice',    labelKey: 'PRODUCTS.FORM.OPEN_PRICE' },
  ];
  pricingTypeDisplay = (o: PricingTypeOption | string): string => {
    if (!o || o === '') return this.translate.instant('PRODUCTS.FORM.PRICING_TYPE_PLACEHOLDER');
    const opt = typeof o === 'string' ? this.PRICING_TYPE_OPTIONS.find(x => x.value === o) : o;
    return opt ? this.translate.instant(opt.labelKey) : '';
  };

  selectedPricingTypeOption = computed<PricingTypeOption>(() => {
    const v = this.selectedPricingTypeValue();
    return this.PRICING_TYPE_OPTIONS.find(o => o.value === v) ?? this.PRICING_TYPE_OPTIONS[0];
  });

  /**
   * Set of serial strings (lowercased) that belong to branches OTHER than the
   * currently-active one — the serials editor warns on cross-branch reuse.
   */
  otherBranchesSerials = computed<Set<string>>(() => {
    this.rowsTick();
    const active = this.activeTab();
    const out = new Set<string>();
    if (!this.rows) return out;
    this.rows.controls.forEach((grp, i) => {
      if (i === active) return;
      const serials = (grp.value['serials'] ?? []) as Array<{ serial?: string }>;
      serials.forEach((s) => {
        const v = String(s?.serial ?? '').trim().toLowerCase();
        if (v) out.add(v);
      });
    });
    return out;
  });

  /** Kept — still used as `compareWith` on the pricing-type dropdown. */
  branchCompare = (a: any, b: any): boolean => (a?.value ?? a) === (b?.value ?? b);

  hasAnyDifferentPrice = computed<boolean>(() =>
    this.productInfo().branchProduct.some((b: any) => b.has_different_price),
  );
  totalStock = computed<number>(() => {
    this.rowsTick();
    if (!this.rows) return 0;
    return this.rows.controls.reduce((sum, g) => sum + Number(g.getRawValue()['onHand'] ?? 0), 0);
  });

  /** True until every init-time request the section depends on has settled. */
  initializing = signal<boolean>(true);

  async ngOnInit(): Promise<void> {
    this.deepLinkBranchId = this.route.snapshot.queryParamMap.get('branch');

    const info = this.productInfo();
    if (!Array.isArray(info.branchProduct)) info.branchProduct = [];

    if (!this.branchesSvc.loaded()) {
      try { await this.branchesSvc.load(); } catch { /* swallow — empty list = no branches */ }
    }
    this.mergeBranchesIntoProduct();

    // Built once, for every branch, in the incoming order. Never rebuilt.
    this.rows = this.fb.array(info.branchProduct.map((b) => this.buildRow(b)));
    this.productForm().setControl('branchProduct', this.rows);
    this.rowsTick.update(n => n + 1);

    this.rows.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.syncBackToModel();
        this.rowsTick.update(n => n + 1);
      });
    // Validity can flip without a value change (validators swapped by the
    // price override toggle) — the error chip/badge has to see that too.
    this.rows.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.rowsTick.update(n => n + 1));

    this.detailTab.set(this.visibleTabs()[0]?.key ?? 'settings');
    this.initializing.set(false);
  }

  /** Merge BranchConnectionService branches into productInfo.branchProduct. */
  private mergeBranchesIntoProduct(): void {
    const info = this.productInfo();
    const allBranches = this.branchesSvc.branches();
    if (!allBranches.length) return;

    const isNew = !info.id;

    allBranches.forEach((b) => {
      const existing = info.branchProduct.find((x: any) => x.branchId === b.id);
      if (existing) {
        (existing as any).branchName = b.name;
        return;
      }
      const seed: BranchProduct = {
        branchId: b.id,
        branchName: b.name,
        price: null,
        buyDownPrice: null,
        buyDownQty: null,
        priceBoundriesFrom: null,
        priceBoundriesTo: null,
        selectedPricingType: '',
        has_different_price: false,
        priceByQty: [],
        serials: [],
        batches: [],
        available: isNew ? true : false,
        availableOnline: isNew ? true : false,
        onHand: 0,
        openingBalance: 0,
        openingBalanceCost: 0,
        reorderPoint: 0,
        reorderLevel: 0,
        unitCost: 0,
        locationId: '',
      } as any;
      info.branchProduct.push(seed);
    });

    // Drop any branches that no longer exist in the company list — defensive.
    info.branchProduct = info.branchProduct.filter((bp: any) =>
      allBranches.some((b) => b.id === bp.branchId),
    );
  }

  private buildRow(b: BranchProduct): FormGroup {
    const f = this.fieldsOptions()?.branchProduct;
    const productHasId = !!this.productInfo().id;

    const priceByQtyArr = this.fb.array(
      (b.priceByQty ?? []).map((r: any) =>
        this.fb.group({
          qty:   [r.qty ?? null,   [Validators.min(0)]],
          price: [r.price ?? null, [Validators.min(0)]],
        }),
      ),
    );
    const serialsArr = this.fb.array(
      (b.serials ?? []).map((s: any) => this.buildSerialGroup(s)),
    );
    const batchesArr = this.fb.array(
      (b.batches ?? []).map((bt: any) => this.buildBatchGroup(bt)),
    );

    // `has_different_price` isn't always persisted — the old project derives
    // it on edit as "the branch overrode the default price iff price > 0".
    const hasDifferentPrice = !!b.has_different_price ||
      (b.price != null && Number(b.price) > 0);

    return this.fb.group({
      branchId:            [b.branchId ?? ''],
      branchName:          [b.branchName ?? ''],
      available:           [b['available'] ?? true],
      availableOnline:     [b['availableOnline'] ?? true],
      has_different_price: [hasDifferentPrice],
      price:               [b.price ?? null, hasDifferentPrice ? [Validators.required, Validators.min(0)] : [Validators.min(0)]],
      selectedPricingType: [(b.selectedPricingType ?? '') as PricingType],
      buyDownPrice:        [b.buyDownPrice ?? null, [Validators.min(0)]],
      buyDownQty:          [b.buyDownQty ?? null,   [Validators.min(0)]],
      priceBoundriesFrom:  [b.priceBoundriesFrom ?? null, [Validators.min(0)]],
      priceBoundriesTo:    [b.priceBoundriesTo ?? null,   [Validators.min(0)]],
      onHand:              [{ value: b['onHand'] ?? 0, disabled: !productHasId },
                            f?.onHand?.isRequired ? [Validators.required, Validators.min(0)] : [Validators.min(0)]],
      reorderPoint:        [b['reorderPoint'] ?? 0, [Validators.min(0)]],
      reorderLevel:        [b['reorderLevel'] ?? 0, [Validators.min(0)]],
      openingBalance:      [b['openingBalance'] ?? 0, [Validators.min(0)]],
      openingBalanceCost:  [b['openingBalanceCost'] ?? 0, [Validators.min(0)]],
      unitCost:            [b['unitCost'] ?? 0, [Validators.min(0)]],
      locationId:          [(b as any)['locationId'] ?? null],
      priceByQty:          priceByQtyArr,
      serials:             serialsArr,
      batches:             batchesArr,
    });
  }

  /** Shared with the importer so imported rows are built exactly like
   *  loaded ones (same validators, same defaults). */
  private buildSerialGroup(s: any): FormGroup {
    return this.fb.group({
      serial:    [s.serial ?? ''],
      status:    [s.status ?? 'Available'],
      invoiceId: [s.invoiceId ?? ''],
      unitCost:  [s.unitCost ?? null, [Validators.required, Validators.min(0)]],
    });
  }

  private buildBatchGroup(bt: any): FormGroup {
    const productBarcode = String(this.productInfo()?.barcode ?? '');
    // The backend doesn't persist a per-batch barcode — convention is
    // `<product barcode>-<batch name>`.
    const fallbackBarcode = productBarcode && bt.batch ? `${productBarcode}-${bt.batch}` : '';
    const grp = this.fb.group({
      id:         [bt.id ?? null],
      batch:      [bt.batch ?? '',    [Validators.required]],
      barcode:    [bt.barcode || fallbackBarcode],
      onHand:     [bt.onHand ?? null, [Validators.required, Validators.min(0)]],
      unitCost:   [bt.unitCost ?? 0,  [Validators.min(0)]],
      prodDate:   [bt.prodDate   ? new Date(bt.prodDate)   : null],
      expireDate: [bt.expireDate ? new Date(bt.expireDate) : null],
    });
    // Batches that already exist on the server are immutable here — stock
    // movements go through the dedicated adjust flow.
    if (bt.id) grp.disable({ emitEvent: false });
    return grp;
  }

  // ─── Location picker (per-branch) ──────────────────────────────────────
  private locationListRaw = signal<Record<string, any[]>>({});

  loadLocations: DropdownLoadFn<{ label: string; value: string }> = async ({ page, pageSize, search }) => {
    const grp = this.activeGroup();
    if (!grp) return { items: [], hasMore: false };
    const branchId = grp.value['branchId'] as string;
    const selected = (grp.value['locationId'] as string | null) ?? null;
    const locationId = page === 1 && !search ? selected : null;
    const res = await this.productsService.getInventoryLocationsList({
      page, pageSize, search, branchId, locationId,
    });
    if (page === 1) {
      this.locationListRaw.update(m => ({ ...m, [branchId]: res.raw as any[] }));
    } else {
      this.locationListRaw.update(m => ({
        ...m,
        [branchId]: [...(m[branchId] ?? []), ...(res.raw as any[])],
      }));
    }
    return { items: res.items, hasMore: res.hasMore } as DropdownLoadResult<{ label: string; value: string }>;
  };

  private async prefetchLocationsFor(branchIdx: number): Promise<void> {
    if (!this.rows || branchIdx < 0 || branchIdx >= this.rows.length) return;
    const grp = this.rows.at(branchIdx) as FormGroup;
    const branchId   = grp.value['branchId'] as string | undefined;
    const locationId = grp.value['locationId'] as string | null | undefined;
    if (!branchId || !locationId) return;
    if ((this.locationListRaw()[branchId] ?? []).length > 0) return;
    try {
      const res = await this.productsService.getInventoryLocationsList({
        page: 1, pageSize: 20, search: '', branchId, locationId,
      });
      this.locationListRaw.update(m => ({ ...m, [branchId]: res.raw as any[] }));
    } catch {
      // Silent — opening the dropdown triggers the loader anyway.
    }
  }

  locationDisplay = (item: any): string => {
    if (!item) return '';
    if (typeof item === 'object' && item.label) return item.label;
    if (typeof item === 'string') {
      const branchId = this.activeGroup()?.value['branchId'] as string | undefined;
      const list = (branchId && this.locationListRaw()[branchId]) || [];
      const hit = list.find((l: any) => (l.id || l._id) === item);
      if (hit?.name) return hit.name;
    }
    return String(item ?? '');
  };
  toValueId = (item: any): string => item?.value ?? '';

  private syncBackToModel(): void {
    const info = this.productInfo();
    this.rows.controls.forEach((grp, i) => {
      const v = grp.getRawValue() as any;
      const target: any = info.branchProduct[i];
      if (!target) return;
      target.available           = v.available;
      target.availableOnline     = v.availableOnline;
      target.has_different_price = v.has_different_price;
      target.price               = v.has_different_price ? (v.price ?? null) : null;
      target.selectedPricingType = v.selectedPricingType ?? '';
      target.buyDownPrice        = v.buyDownPrice ?? null;
      target.buyDownQty          = v.buyDownQty ?? null;
      target.priceBoundriesFrom  = v.priceBoundriesFrom ?? null;
      target.priceBoundriesTo    = v.priceBoundriesTo ?? null;
      target.onHand              = Number(v.onHand ?? 0);
      target.reorderPoint        = Number(v.reorderPoint ?? 0);
      target.reorderLevel        = Number(v.reorderLevel ?? 0);
      target.openingBalance      = Number(v.openingBalance ?? 0);
      target.openingBalanceCost  = Number(v.openingBalanceCost ?? 0);
      target.unitCost            = Number(v.unitCost ?? 0);
      target.locationId          = v.locationId ?? '';
      target.priceByQty = (v.priceByQty ?? []).map((r: any) => ({
        qty:   r.qty   ?? null,
        price: r.price ?? null,
      }));
      target.serials = (v.serials ?? []).map((s: any) => ({
        serial:    s.serial ?? '',
        status:    s.status ?? 'Available',
        invoiceId: s.invoiceId ?? '',
        unitCost:  s.unitCost ?? null,
      }));
      target.batches = (v.batches ?? []).map((b: any) => ({
        id:         b.id ?? null,
        batch:      b.batch ?? '',
        barcode:    b.barcode ?? '',
        onHand:     b.onHand ?? null,
        unitCost:   b.unitCost ?? 0,
        prodDate:   b.prodDate   ? this.toIsoDate(b.prodDate)   : null,
        expireDate: b.expireDate ? this.toIsoDate(b.expireDate) : null,
      }));
    });
  }

  private toIsoDate(v: any): string {
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  changeTab(i: number): void {
    if (!this.rows || i < 0 || i >= this.rows.length) return;
    this.activeTab.set(i);
  }

  activeGroup = computed<FormGroup | null>(() => {
    // Read `rowsTick` first so the computed keeps a live dependency even when
    // `this.rows` is still undefined on the first template pass — otherwise
    // the early null-return registers no deps and caches null forever.
    void this.rowsTick();
    const idx = this.activeTab();
    if (!this.rows) return null;
    return (this.rows.at(idx) as FormGroup | undefined) ?? null;
  });

  // Template convenience — safe accessor used by @if blocks.
  ctl(name: string) {
    return this.activeGroup()?.controls[name];
  }

  selectedPricingTypeValue = computed<PricingType>(() => {
    this.rowsTick();
    return (this.activeGroup()?.controls['selectedPricingType']?.value ?? '') as PricingType;
  });

  hasDifferentPriceValue = computed<boolean>(() => {
    this.rowsTick();
    return !!this.activeGroup()?.controls['has_different_price']?.value;
  });

  /** Product-level price the branch inherits when it has no override. */
  defaultPrice = computed<number>(() => Number(this.productInfo().defaultPrice ?? 0));

  buyDownPriceIsFree = computed<boolean>(() => {
    this.rowsTick();
    if (this.selectedPricingTypeValue() !== 'buyDownPrice') return false;
    const v = this.activeGroup()?.controls['buyDownPrice']?.value;
    return v == null || v === '' || Number(v) === 0;
  });

  branchPriceIsFree = computed<boolean>(() => {
    this.rowsTick();
    if (!this.hasDifferentPriceValue()) return false;
    const v = this.activeGroup()?.controls['price']?.value;
    if (v == null || v === '') return false;
    return Number(v) === 0;
  });

  priceBoundsInvalid = computed<boolean>(() => {
    this.rowsTick();
    if (this.selectedPricingTypeValue() !== 'priceBoundary') return false;
    const grp = this.activeGroup();
    if (!grp) return false;
    const from = grp.controls['priceBoundriesFrom']?.value;
    const to   = grp.controls['priceBoundriesTo']?.value;
    if (from == null || from === '' || to == null || to === '') return false;
    const f = Number(from);
    const t = Number(to);
    if (!Number.isFinite(f) || !Number.isFinite(t)) return false;
    return f >= t;
  });

  sellingPriceForActive = computed<number>(() => {
    this.rowsTick();
    const grp = this.activeGroup();
    const info = this.productInfo();
    if (!grp) return Number(info.defaultPrice ?? 0);
    const v = grp.value as any;
    const override = v.has_different_price ? Number(v.price ?? 0) : NaN;
    return Number.isFinite(override) ? override : Number(info.defaultPrice ?? 0);
  });

  activeBranchProfit = computed<number>(() => {
    this.rowsTick();
    const grp = this.activeGroup();
    const info = this.productInfo();
    if (!grp) return 0;
    const unitCost = Number(grp.getRawValue()['unitCost'] ?? 0);
    let sellingPrice = this.sellingPriceForActive();
    if ((info as any).isInclusiveTax) sellingPrice -= Number(info.taxAmount ?? 0);
    return sellingPrice - unitCost;
  });

  activeBranchMargin = computed<number>(() => {
    const price = this.sellingPriceForActive();
    if (!price) return 0;
    const m = (this.activeBranchProfit() / price) * 100;
    return Number.isFinite(m) ? m : 0;
  });

  /** Stock value of the active branch — on hand × unit cost. */
  activeStockValue = computed<number>(() => {
    this.rowsTick();
    const v = this.activeGroup()?.getRawValue() as any;
    if (!v) return 0;
    return Number(v.onHand ?? 0) * Number(v.unitCost ?? 0);
  });

  setPricingType(type: PricingType): void {
    const grp = this.activeGroup();
    if (!grp) return;
    grp.patchValue({ selectedPricingType: type });
  }

  /** Open the stock-adjust modal for the active branch. */
  openStockAdjustModal(): Promise<void> {
    return this.openStockAdjustModalFor(this.activeTab());
  }

  async openStockAdjustModalFor(rowIdx: number): Promise<void> {
    const info = this.productInfo();
    const grp = this.rows?.at(rowIdx) as FormGroup | undefined;
    if (!info?.id || !grp) return;

    const branchId = grp.value['branchId'] as string;
    const currentOnHand = Number(grp.getRawValue()['onHand'] ?? 0);

    const ref = this.modals.open<StockAdjustModalComponent, StockAdjustData, StockAdjustResult>(
      StockAdjustModalComponent,
      { size: 'sm', data: { productId: info.id, branchId, currentOnHand } },
    );

    const result = await ref.afterClosed();
    if (!result) return;
    grp.patchValue({ onHand: result.onHand });
  }

  async openUnitCostAdjustModalFor(rowIdx: number): Promise<void> {
    const info = this.productInfo();
    const grp = this.rows?.at(rowIdx) as FormGroup | undefined;
    if (!info?.id || !grp) return;

    const currentUnitCost = Number(grp.getRawValue()['unitCost'] ?? 0);

    const ref = this.modals.open<UnitCostAdjustModalComponent, UnitCostAdjustData, UnitCostAdjustResult>(
      UnitCostAdjustModalComponent,
      { size: 'sm', data: { productId: info.id, currentUnitCost } },
    );

    const result = await ref.afterClosed();
    if (!result) return;
    grp.patchValue({ unitCost: result.unitCost });
  }

  /**
   * Mirrors old `onChangeHasDifferentPrice` — price becomes required-and-
   * positive when the override is on, loses its validators and is nulled
   * out when it's off.
   */
  onChangeHasDifferentPrice(checked: boolean): void {
    const grp = this.activeGroup();
    const priceCtl = grp?.get('price');
    if (!priceCtl) return;

    if (checked) {
      priceCtl.setValidators([Validators.required, Validators.min(0)]);
      if (priceCtl.value == null || priceCtl.value === '') priceCtl.setValue(0, { emitEvent: false });
    } else {
      priceCtl.clearValidators();
      priceCtl.setValue(null, { emitEvent: false });
    }
    priceCtl.updateValueAndValidity();
  }

  getStockBadgeClass(onHand: number | null | undefined, reorderPoint: number | null | undefined): string {
    const on = Number(onHand ?? 0);
    const rp = Number(reorderPoint ?? 0);
    if (!on) return 'bad';
    if (on <= rp) return 'warn';
    return 'good';
  }

  // ─── Import / export ───────────────────────────────────────────────────
  /** Split-button menu shown in the Serials / Batches toolbars. */
  ioMenuItems = (kind: BranchIoKind): DropdownMenuBtnItem[] => ([
    { label: 'PRODUCTS.FORM.IO_IMPORT', click: () => void this.openImport(kind) },
    { label: 'PRODUCTS.FORM.IO_EXPORT', click: () => void this.openExport(kind) },
  ]);

  private arrayOf(index: number, kind: BranchIoKind): FormArray<FormGroup> | null {
    return (this.groupAt(index)?.get(kind) as FormArray<FormGroup> | null) ?? null;
  }

  /** Rows that can never be deleted by a `replace` import — a serial that's
   *  been sold / invoiced, or a batch that already exists on the server. */
  private isReferenceLinked(kind: BranchIoKind, value: any): boolean {
    return kind === 'serials'
      ? !!value?.invoiceId || value?.status === 'Sold'
      : !!value?.id;
  }

  async openImport(kind: BranchIoKind): Promise<void> {
    const activeIdx = this.activeTab();
    const config: ImportWizardConfig = buildBranchImportConfig(
      {
        kind,
        defaultBranchName: this.activeBranchName(),
        resolveBranch: (name: string) => this.resolveBranchByName(name, activeIdx),
        existsInBranch: (branchIndex: number, key: string) => this.keyExists(kind, branchIndex, key),
        apply: (rows, mode) => this.applyImportedRows(kind, rows, mode, activeIdx),
      },
      (key: string, params?: any) => this.translate.instant(key, params),
    );

    const ref = this.modals.open<ImportWizardComponent, ImportWizardConfig, ImportSummaryCounts | undefined>(
      ImportWizardComponent,
      { size: 'lg', data: config, closeOnBackdrop: false },
    );
    await ref.afterClosed();
  }

  /** Empty branch name → the branch the wizard was opened from. */
  private resolveBranchByName(name: string, fallbackIdx: number): number | null {
    const trimmed = (name ?? '').trim().toLowerCase();
    if (!trimmed) return fallbackIdx;
    const hit = this.allRows().find(r => r.name.trim().toLowerCase() === trimmed);
    return hit ? hit.index : null;
  }

  private keyExists(kind: BranchIoKind, branchIndex: number, key: string): boolean {
    const arr = this.arrayOf(branchIndex, kind);
    if (!arr) return false;
    const field = kind === 'serials' ? 'serial' : 'batch';
    return arr.controls.some(
      g => String((g.getRawValue() as any)[field] ?? '').trim().toLowerCase() === key,
    );
  }

  /**
   * Writes accepted rows into the FormArray. Nothing here touches the
   * server — imported rows land as dirty-but-unsaved, exactly like typing
   * them by hand, and only persist when the product is saved.
   */
  private applyImportedRows(
    kind: BranchIoKind,
    rows: ImportRow[],
    mode: ImportMode,
    fallbackIdx: number,
  ): { added: number; updated: number; skipped: number } {
    let added = 0, updated = 0, skipped = 0;

    // `replace` wipes the target branches first — but never rows that are
    // linked to a bill / invoice / transfer.
    if (mode === 'replace') {
      const touched = new Set<number>();
      rows.forEach((r) => {
        const idx = this.resolveBranchByName(String(r['branch'] ?? ''), fallbackIdx);
        if (idx !== null) touched.add(idx);
      });
      touched.forEach((idx) => {
        const arr = this.arrayOf(idx, kind);
        if (!arr) return;
        for (let i = arr.length - 1; i >= 0; i--) {
          if (this.isReferenceLinked(kind, arr.at(i).getRawValue())) continue;
          arr.removeAt(i, { emitEvent: false });
        }
      });
    }

    const field = kind === 'serials' ? 'serial' : 'batch';

    for (const row of rows) {
      const idx = this.resolveBranchByName(String(row['branch'] ?? ''), fallbackIdx);
      if (idx === null) { skipped++; continue; }
      const arr = this.arrayOf(idx, kind);
      if (!arr) { skipped++; continue; }

      const key = String(row[field] ?? '').trim();
      if (!key) { skipped++; continue; }

      const existingIdx = arr.controls.findIndex(
        g => String((g.getRawValue() as any)[field] ?? '').trim().toLowerCase() === key.toLowerCase(),
      );

      if (existingIdx >= 0) {
        // `add` never overwrites; `upsert`/`replace` update in place, and a
        // server-locked (disabled) row is left alone either way.
        if (mode === 'add' || arr.at(existingIdx).disabled) { skipped++; continue; }
        arr.at(existingIdx).patchValue(this.rowToValue(kind, row), { emitEvent: false });
        updated++;
        continue;
      }

      arr.push(
        kind === 'serials'
          ? this.buildSerialGroup(this.rowToValue(kind, row))
          : this.buildBatchGroup(this.rowToValue(kind, row)),
        { emitEvent: false },
      );
      added++;
    }

    if (added || updated) {
      this.rows.markAsDirty();
      // One emission for the whole batch — keeps the model sync + tick cheap.
      this.rows.updateValueAndValidity();
    }
    return { added, updated, skipped };
  }

  /** File cells → the shape `buildSerialGroup` / `buildBatchGroup` expect.
   *  Soft problems are normalised here rather than failing the row: a
   *  missing cost imports as 0, and a `Sold` status with no invoice comes
   *  in as available (there's nothing to link it to yet). */
  private rowToValue(kind: BranchIoKind, row: ImportRow): any {
    const num = (v: any, fallback = 0) => {
      const n = Number(String(v ?? '').trim());
      return Number.isFinite(n) ? n : fallback;
    };
    if (kind === 'serials') {
      return {
        serial:    String(row['serial'] ?? '').trim(),
        status:    'Available',
        invoiceId: '',
        unitCost:  num(row['unitCost'], 0),
      };
    }
    const batch = String(row['batch'] ?? '').trim();
    return {
      // Only an exported-and-edited file carries an id; a fresh one doesn't.
      id:         String(row['id'] ?? '').trim() || null,
      batch,
      onHand:     num(row['onHand'], 0),
      unitCost:   num(row['unitCost'], 0),
      prodDate:   String(row['prodDate'] ?? '').trim() || null,
      expireDate: String(row['expireDate'] ?? '').trim() || null,
    };
  }

  async openExport(kind: BranchIoKind): Promise<void> {
    const buckets: Record<ExportScope, BranchIoBucket[]> = {
      branch: this.bucketsFor(kind, [this.activeTab()]),
      all:    this.bucketsFor(kind, this.allRows().map(r => r.index)),
    };

    const ref = this.modals.open<BranchExportModalComponent, BranchExportData, BranchExportResult | undefined>(
      BranchExportModalComponent,
      {
        size: 'md',
        data: {
          kind,
          buckets,
          activeBranchName: this.activeBranchName(),
        },
      },
    );

    const choice = await ref.afterClosed();
    if (!choice) return;

    const headers: Record<string, string> = {};
    columnsFor(kind).forEach(c => { headers[c.key] = this.translate.instant(c.label); });

    exportBranchData({
      kind,
      buckets:  buckets[choice.scope],
      format:   choice.format,
      columns:  choice.columns,
      headers,
      fileBase: `${this.productInfo().name || 'product'}-${kind}`,
    });
  }

  /** Rows of one kind for the given branch indexes, name included. */
  private bucketsFor(kind: BranchIoKind, indexes: number[]): BranchIoBucket[] {
    return indexes
      .map((index) => {
        const grp = this.groupAt(index);
        if (!grp) return null;
        const v = grp.getRawValue() as any;
        return {
          index,
          name: String(v.branchName ?? ''),
          rows: (v[kind] ?? []) as any[],
        } as BranchIoBucket;
      })
      .filter((b): b is BranchIoBucket => b !== null);
  }
}
