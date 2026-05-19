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
import { getProductTypeBadgeStyle } from '../../../../products/utils/product-type-badge';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

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
  private destroyRef = inject(DestroyRef);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  /** Source of truth for the form. Mutated in place by the row
   *  handlers; the template pulls everything off it. */
  label = signal<PriceLabel>(emptyPriceLabel());

  /** Hash of the loaded state — compared with the live label on
   *  navigation to drive the unsaved-changes guard. */
  private cleanSnapshot = signal<string>('');

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
        // Override price priority: user's prior override > picker
        // seed (which already considered existingPrices) > 0.
        price:        prior?.price ?? p.price ?? 0,
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
      .map(p => ({
        optionId:     p.id,
        // Prefer the localised display name when the option has
        // one — `getOptions` returns both `name` and `displayName`.
        name:         p.displayName || p.name,
        defaultPrice: Number(p.price ?? 0) || 0,
        // Seed the override with the catalog price so the user
        // lands on a sensible starting value instead of 0.
        price:        Number(p.price ?? 0) || 0,
      }));
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
