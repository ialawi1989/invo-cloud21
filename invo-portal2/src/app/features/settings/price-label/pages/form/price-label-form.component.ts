import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { CompanyService } from '@core/auth/company.service';
import { getProductTypeBadgeStyle } from '../../../../products/utils/product-type-badge';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import {
  PickProductPlModalComponent,
  PickProductPlModalData,
  PickProductPlModalResult,
} from '../../components/pick-product-modal/pick-product-pl-modal.component';
import { ImportWizardComponent } from '@shared/components/import-wizard/import-wizard.component';
import {
  ImportSummaryCounts,
  ImportWizardConfig,
} from '@shared/components/import-wizard/import-wizard.types';
import {
  buildPriceLabelImportConfig,
  buildPriceLabelOptionImportConfig,
} from '../../components/import-modal/price-label-import.config';
import {
  PickOptionModalComponent,
  PickOptionModalData,
  PickOptionResult,
  PickedOption,
} from '../../../../products/pages/product-form/components/options-tab/pick-option-modal.component';

import { PriceLabelService } from '../../services/price-label.service';
import {
  PriceLabel,
  PriceLabelOptionLine,
  PriceLabelProductLine,
  emptyPriceLabel,
} from '../../services/price-label.types';

/**
 * Price Label form — name + per-product price overrides.
 *
 * Flow:
 *   1. Pick a product via the shared `PickProductModal` (multi-select).
 *   2. Each picked product becomes a row: name + barcode chip + price
 *      input. The user types per-product prices directly.
 *   3. Save → POST `product/savePriceLabel`.
 *
 * Existing rows are kept on a Map keyed by productId so the picker's
 * `excludedIds` matches what's already on the form. Removal is per
 * row (× icon).
 *
 * Dirty tracking is a hash of `{ name, productsPrices }` snapshotted
 * on load; the unsaved-changes guard reads `hasUnsavedChanges()`
 * before allowing navigation.
 */
@Component({
  selector: 'app-price-label-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    TooltipDirective,
    DropdownMenuBtnComponent,
    MycurrencyPipe,
    SearchDropdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './price-label-form.component.html',
  styleUrl: './price-label-form.component.scss',
})
export class PriceLabelFormComponent implements OnInit, CanLeaveComponent {
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private translate = inject(TranslateService);
  private modal     = inject(ModalService);
  private toast     = inject(ToastService);
  private service   = inject(PriceLabelService);
  private companyService = inject(CompanyService);
  private destroyRef = inject(DestroyRef);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  /** Source of truth for the form. Mutated in place by the row
   *  handlers; the template pulls everything off it. */
  label = signal<PriceLabel>(emptyPriceLabel());

  /** Hash of the loaded state — compared with the live label on
   *  navigation to drive the unsaved-changes guard. */
  private cleanSnapshot = signal<string>('');

  // ─── Bulk "Increase by" tool ────────────────────────────────────
  // Row checkboxes are tracked here (not on the line objects) so the
  // "picked" state never round-trips to the server. Operand (+/-)
  // and mode (amount/percent) are dropdowns rather than a typed
  // string, so clicking Apply repeatedly can never compound into
  // something like "+15%+12%" — each click re-applies the same,
  // unambiguous delta to each checked row's *current* price.
  checkedProductIds = signal<Set<string>>(new Set());
  checkedOptionIds  = signal<Set<string>>(new Set());

  productPriceOperand = signal<'+' | '-'>('+');
  productPriceMode    = signal<'amount' | 'percent'>('amount');
  productPriceIncreaseBy = signal<number | null>(null);

  optionPriceOperand = signal<'+' | '-'>('+');
  optionPriceMode    = signal<'amount' | 'percent'>('amount');
  optionPriceIncreaseBy = signal<number | null>(null);

  readonly operandItems: { value: '+' | '-'; label: string }[] = [
    { value: '+', label: 'PRICE_LABEL.FORM.INCREASE' },
    { value: '-', label: 'PRICE_LABEL.FORM.DECREASE' },
  ];
  readonly modeItems: { value: 'amount' | 'percent'; label: string }[] = [
    { value: 'amount',  label: 'PRICE_LABEL.FORM.AMOUNT' },
    { value: 'percent', label: 'PRICE_LABEL.FORM.PERCENT' },
  ];
  displayDropdownItem = (item: any) => this.translate.instant(item?.label ?? '');
  compareDropdownItem = (a: any, b: any) => (a?.value ?? a) === (b?.value ?? b);

  // `<app-search-dropdown>`'s `[(value)]` model always holds the full
  // item object (not the toValue-transformed primitive), so the
  // operand/mode signals — which store the plain '+'/'-' or
  // 'amount'/'percent' value — are bridged through these helpers
  // rather than bound directly to the dropdown.
  operandDropdownValue(mode: 'product' | 'option') {
    const current = mode === 'product' ? this.productPriceOperand() : this.optionPriceOperand();
    return this.operandItems.find(o => o.value === current) ?? this.operandItems[0];
  }
  modeDropdownValue(mode: 'product' | 'option') {
    const current = mode === 'product' ? this.productPriceMode() : this.optionPriceMode();
    return this.modeItems.find(o => o.value === current) ?? this.modeItems[0];
  }
  setOperand(target: 'product' | 'option', item: any): void {
    const value: '+' | '-' = item?.value ?? '+';
    if (target === 'product') this.productPriceOperand.set(value);
    else this.optionPriceOperand.set(value);
  }
  setMode(target: 'product' | 'option', item: any): void {
    const value: 'amount' | 'percent' = item?.value ?? 'amount';
    if (target === 'product') this.productPriceMode.set(value);
    else this.optionPriceMode.set(value);
  }

  checkedProductCount = computed<number>(() => this.checkedProductIds().size);
  checkedOptionCount  = computed<number>(() => this.checkedOptionIds().size);

  isProductChecked(productId: string): boolean {
    return this.checkedProductIds().has(productId);
  }
  isOptionChecked(optionId: string): boolean {
    return this.checkedOptionIds().has(optionId);
  }

  toggleProductChecked(productId: string, checked: boolean): void {
    this.checkedProductIds.update(prev => {
      const next = new Set(prev);
      if (checked) next.add(productId); else next.delete(productId);
      return next;
    });
  }
  toggleOptionChecked(optionId: string, checked: boolean): void {
    this.checkedOptionIds.update(prev => {
      const next = new Set(prev);
      if (checked) next.add(optionId); else next.delete(optionId);
      return next;
    });
  }

  toggleSelectAllProducts(checked: boolean): void {
    this.checkedProductIds.set(
      checked ? new Set(this.label().productsPrices.map(p => p.productId)) : new Set(),
    );
  }
  toggleSelectAllOptions(checked: boolean): void {
    this.checkedOptionIds.set(
      checked ? new Set(this.label().optionsPrices.map(o => o.optionId)) : new Set(),
    );
  }
  allProductsChecked = computed<boolean>(() => {
    const lines = this.label().productsPrices;
    return lines.length > 0 && this.checkedProductCount() === lines.length;
  });
  allOptionsChecked = computed<boolean>(() => {
    const lines = this.label().optionsPrices;
    return lines.length > 0 && this.checkedOptionCount() === lines.length;
  });

  /** Rounds to the company's configured decimal places (same rule
   *  `MycurrencyPipe` uses), so a defaulted or bulk-adjusted price
   *  like 10 shows as 10.000 for a 3-decimal currency instead of a
   *  bare 10. */
  roundToCompanyDecimals(value: number): number {
    const decimals = this.companyService.settings()?.settings?.afterDecimal ?? 3;
    return Number((value ?? 0).toFixed(decimals));
  }

  /** Applies the "Increase by" tool to every CHECKED product/option
   *  row at once, off each row's *current* price (or its default
   *  price when it has none yet). Operand + mode are dropdowns
   *  (never typed), so re-clicking Apply is always a fresh, single
   *  delta — never compounds. */
  applyBulkPriceChange(type: 'product' | 'option'): void {
    const operand = type === 'product' ? this.productPriceOperand() : this.optionPriceOperand();
    const mode    = type === 'product' ? this.productPriceMode()    : this.optionPriceMode();
    const amount  = type === 'product' ? this.productPriceIncreaseBy() : this.optionPriceIncreaseBy();
    if (amount == null || isNaN(amount)) return;

    const isPercent = mode === 'percent';
    const sign = operand === '-' ? -1 : 1;
    const checkedIds = type === 'product' ? this.checkedProductIds() : this.checkedOptionIds();
    if (checkedIds.size === 0) return;

    const adjust = (base: number): number => {
      const delta = isPercent ? base * (amount / 100) : amount;
      return this.roundToCompanyDecimals(Math.max(0, base + sign * delta));
    };

    if (type === 'product') {
      this.label.update(l => ({
        ...l,
        productsPrices: l.productsPrices.map(p =>
          checkedIds.has(p.productId)
            ? { ...p, price: adjust(p.price ?? p.defaultPrice ?? 0) }
            : p,
        ),
      }));
    } else {
      this.label.update(l => ({
        ...l,
        optionsPrices: l.optionsPrices.map(o =>
          checkedIds.has(o.optionId)
            ? { ...o, price: adjust(o.price ?? o.defaultPrice ?? 0) }
            : o,
        ),
      }));
    }
  }

  isExisting = computed<boolean>(() => !!this.label().id);

  pageTitle = computed<string>(() => {
    this.i18nTick();
    const isNew = !this.isExisting();
    return isNew
      ? this.translate.instant('PRICE_LABEL.FORM.NEW_TITLE')
      : this.translate.instant('PRICE_LABEL.FORM.EDIT_TITLE', { name: this.label().name || '—' });
  });

  private i18nTick = signal(0);
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'),         routerLink: '/settings' },
      { label: this.translate.instant('PRICE_LABEL.LIST.TITLE'), routerLink: '/settings/price-label' },
      { label: this.isExisting()
                 ? (this.label().name || '—')
                 : this.translate.instant('PRICE_LABEL.FORM.NEW_TITLE') },
    ];
  });

  constructor() {
    withTranslations('settings/price-label');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new' && id !== '0') {
      this.loading.set(true);
      try {
        const loaded = await this.service.getById(id);
        if (loaded) this.label.set(loaded);
      } finally {
        this.loading.set(false);
      }
    }
    this.cleanSnapshot.set(this.snapshot());
  }

  // ─── Field handlers ─────────────────────────────────────────────
  setName(name: string): void {
    this.label.update(l => ({ ...l, name }));
  }

  setLinePrice(productId: string, price: number): void {
    const safe = Number.isFinite(price) ? price : 0;
    this.label.update(l => ({
      ...l,
      productsPrices: l.productsPrices.map(p =>
        p.productId === productId ? { ...p, price: Math.max(0, safe) } : p,
      ),
    }));
  }

  removeLine(productId: string): void {
    this.label.update(l => ({
      ...l,
      productsPrices: l.productsPrices.filter(p => p.productId !== productId),
    }));
    this.checkedProductIds.update(prev => {
      if (!prev.has(productId)) return prev;
      const next = new Set(prev);
      next.delete(productId);
      return next;
    });
  }

  // ─── Options handlers ───────────────────────────────────────────
  setOptionPrice(optionId: string, price: number): void {
    const safe = Number.isFinite(price) ? price : 0;
    this.label.update(l => ({
      ...l,
      optionsPrices: l.optionsPrices.map(o =>
        o.optionId === optionId ? { ...o, price: Math.max(0, safe) } : o,
      ),
    }));
  }

  removeOption(optionId: string): void {
    this.label.update(l => ({
      ...l,
      optionsPrices: l.optionsPrices.filter(o => o.optionId !== optionId),
    }));
    this.checkedOptionIds.update(prev => {
      if (!prev.has(optionId)) return prev;
      const next = new Set(prev);
      next.delete(optionId);
      return next;
    });
  }

  // ─── Picker ─────────────────────────────────────────────────────
  /** Open the price-label-specific product picker. Routed through
   *  `getProductsListByType` so the backend pins already-listed
   *  products at the top of page 1 (server-side `selectedProductId`
   *  filter), and so the picker can apply department/category/type
   *  filters without us re-implementing them. The result is the
   *  *complete* selection — we replace the form's products list
   *  with it (preserving any prior override prices the user typed). */
  pickProducts(): void {
    const cur = this.label().productsPrices;
    const existingPrices: Record<string, number> = {};
    for (const p of cur) existingPrices[p.productId] = p.price;

    const ref = this.modal.open<
      PickProductPlModalComponent,
      PickProductPlModalData,
      PickProductPlModalResult
    >(PickProductPlModalComponent, {
      size: 'md',
      data: {
        selectedIds:    cur.map(p => p.productId),
        existingPrices,
        title:          this.translate.instant('PRICE_LABEL.FORM.PICK_PRODUCTS'),
      },
    });
    ref.afterClosed().then((res) => {
      if (!res) return;
      this.applyProductSelection(res.selected);
    });
  }

  /** Replace the form's product lines with the modal's snapshot,
   *  keeping any override price the user previously typed (the
   *  modal seeds the override from `existingPrices` and returns it
   *  back unchanged when the row isn't reordered). */
  private applyProductSelection(picked: { productId: string; productName: string; barcode?: string; type?: string; defaultPrice?: number; price: number }[]): void {
    const previous = new Map(this.label().productsPrices.map(p => [p.productId, p]));
    const next: PriceLabelProductLine[] = picked.map(p => {
      const prior = previous.get(p.productId);
      return {
        productId:    p.productId,
        productName:  p.productName || prior?.productName || '',
        barcode:      p.barcode ?? prior?.barcode,
        type:         p.type    ?? prior?.type,
        defaultPrice: p.defaultPrice ?? prior?.defaultPrice,
        // A row the user already has (and may have manually edited)
        // keeps whatever price it carries. A newly picked row has no
        // price yet — default it to the product's defaultPrice
        // (rounded to the company's decimal places) rather than 0.
        price: prior
          ? prior.price
          : this.roundToCompanyDecimals(p.defaultPrice ?? p.price ?? 0),
      };
    });
    this.label.update(l => ({ ...l, productsPrices: next }));
  }

  pickOptions(): void {
    const ref = this.modal.open<
      PickOptionModalComponent,
      PickOptionModalData,
      PickOptionResult
    >(PickOptionModalComponent, {
      size: 'md',
      data: {
        excludedIds: this.label().optionsPrices.map(o => o.optionId),
        title:       this.translate.instant('PRICE_LABEL.FORM.PICK_OPTIONS'),
      },
    });
    ref.afterClosed().then((res) => {
      if (!res) return;
      this.appendOptionPicks(res.added);
    });
  }

  private appendOptionPicks(picks: PickedOption[]): void {
    if (!picks?.length) return;
    const existing = new Set(this.label().optionsPrices.map(o => o.optionId));
    const additions: PriceLabelOptionLine[] = picks
      .filter(p => !existing.has(p.id))
      .map(p => {
        const defaultPrice = Number(p.price ?? 0) || 0;
        return {
          optionId:     p.id,
          // Prefer the localised display name when the option has
          // one — `getOptions` returns both `name` and `displayName`.
          name:         p.displayName || p.name,
          defaultPrice,
          // Newly picked option — seed the override with the
          // catalog price (rounded to the company's decimal
          // places) so the user lands on a sensible starting value
          // instead of 0.
          price: this.roundToCompanyDecimals(defaultPrice),
        };
      });
    if (!additions.length) return;
    this.label.update(l => ({
      ...l,
      optionsPrices: [...l.optionsPrices, ...additions],
    }));
  }

  // ─── Save / Cancel ──────────────────────────────────────────────
  async save(): Promise<void> {
    const l = this.label();
    if (!l.name.trim() || this.saving()) return;
    this.saving.set(true);
    try {
      const res = await this.service.save(l);
      if (res?.id) {
        // Mark clean and navigate to the edit URL so the user can
        // see the saved state with proper id in the URL.
        this.label.update(prev => ({ ...prev, id: res.id }));
        this.cleanSnapshot.set(this.snapshot());
        if (l.id !== res.id) {
          void this.router.navigate(['/settings/price-label', res.id], { replaceUrl: true });
        }
        this.toast.success('COMMON.SAVED_OK');
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } catch (err: any) {
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
      throw err;
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    void this.router.navigate(['/settings/price-label']);
  }

  /** Items for the header Import `<app-dropdown-menu-btn>`. Recomputed
   *  every render — cheap, and `computed` here would just add
   *  ceremony for two static rows. */
  importMenuItems(): DropdownMenuBtnItem[] {
    return [
      { label: 'PRICE_LABEL.IMPORT.IMPORT_PRODUCTS', click: () => this.importLabel('products') },
      { label: 'PRICE_LABEL.IMPORT.IMPORT_OPTIONS',  click: () => this.importLabel('options')  },
    ];
  }

  /** Header Import action — only visible when editing an existing
   *  label (the bulk-import server endpoints require an `id`). The
   *  user picks `'products'` (price overrides keyed by barcode) or
   *  `'options'` (price overrides keyed by optionId); both routes
   *  go through the same `<app-import-wizard>` and reload the
   *  label on success. */
  async importLabel(kind: 'products' | 'options' = 'products'): Promise<void> {
    const l = this.label();
    if (!l.id) return;

    // Pick the right gate + config builder for the chosen target.
    // Both endpoints use separate Redis keys, so an in-flight
    // products import doesn't block an options import.
    const progress = kind === 'products'
      ? await this.service.getBulkImportProgress(l.id)
      : await this.service.getBulkOptionsImportProgress(l.id);
    if (progress && !progress.success) {
      window.alert(progress.msg || this.translate.instant('PRICE_LABEL.IMPORT.IN_PROGRESS_BODY'));
      return;
    }

    const config = kind === 'products'
      ? buildPriceLabelImportConfig({
          id: l.id, name: l.name, service: this.service, translate: this.translate,
        })
      : buildPriceLabelOptionImportConfig({
          id: l.id, name: l.name, service: this.service, translate: this.translate,
        });

    const ref = this.modal.open<
      ImportWizardComponent,
      ImportWizardConfig,
      ImportSummaryCounts | undefined
    >(ImportWizardComponent, {
      size: 'lg',
      data: config,
      closeOnBackdrop: false,
    });
    const result = await ref.afterClosed();
    if (result?.successful) {
      // Reload to pick up the imported lines.
      const fresh = await this.service.getById(l.id);
      if (fresh) {
        this.label.set(fresh);
        this.cleanSnapshot.set(this.snapshot());
      }
    }
  }

  // ─── Unsaved-changes guard plumbing ─────────────────────────────
  private snapshot(): string {
    const l = this.label();
    return JSON.stringify({
      name: l.name,
      productsPrices: l.productsPrices.map(p => ({ productId: p.productId, price: p.price })),
      optionsPrices:  l.optionsPrices.map(o => ({ optionId: o.optionId, price: o.price })),
    });
  }
  /** Reactive dirty-check for the Save button's `[disabled]`
   *  binding — `hasUnsavedChanges()` below stays as the
   *  CanLeaveComponent contract method the guard calls. */
  isDirty = computed<boolean>(() => this.snapshot() !== this.cleanSnapshot());
  hasUnsavedChanges(): boolean {
    return this.isDirty();
  }

  // ─── Cmd/Ctrl + S → save ────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      void this.save();
    }
  }


  trackLine   = (_: number, p: PriceLabelProductLine) => p.productId;
  trackOption = (_: number, o: PriceLabelOptionLine)  => o.optionId;

  /** Per-product-type chip palette — wraps the shared util so the
   *  template can call it via `[ngStyle]`. */
  getTypeBadgeStyle(type: string | undefined): Record<string, string> {
    return getProductTypeBadgeStyle(type);
  }
}
