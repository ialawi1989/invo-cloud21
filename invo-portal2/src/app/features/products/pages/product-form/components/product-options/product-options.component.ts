import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import { AccountService, AccountMini } from '@core/layout/services/account.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DropdownLoadFn } from '@shared/components/dropdown/search-dropdown.types';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { ProductsService } from '../../../../services/products.service';
import { Product } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';

/**
 * product-options
 * ───────────────
 * Sidebar card with the "miscellaneous" product flags and per-channel
 * settings — order-by-weight, POS discountable, max-items-per-ticket,
 * preparation / service time, kitchen name, tags, warning / item-message
 * textareas, and the purchase / sale account pickers.
 *
 * Old project ported: `pages/products/product-form/components/inventory/
 * product-options/product-options.component.ts`. Two known bugs in the
 * old HTML are NOT carried over:
 *   - `itemMessage` and `afterServiceDescription` textareas had
 *     `[(ngModel)]="productInfo.warning"` instead of their own model
 *     fields. We write to `info.itemMessage` / `info.afterServiceDescription`.
 *   - The old component also ran `loadAccountPurchaseList()` twice (once
 *     unconditionally on `isPurchaseItem`, then again inside the
 *     `isPurchaseItem.isVisible` branch). The new service dedupes via an
 *     in-flight-promise cache, so there's no wasted request.
 *
 * Each sub-control is gated by the matching `fieldsOptions()` flag, so
 * per-type visibility (inventory, service, menuItem, …) stays identical
 * to the old form without branching in the component.
 */
interface PendingTag { display: string; value: string; }
interface TagOption { label: string; value: string; }
/** One row in the purchase / sale account dropdowns — flattened with a
 *  `group` tag so the `#item` template can subtly render the parent type. */
interface AccountOption { label: string; value: string; group: string; }

@Component({
  selector: 'app-pf-product-options',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, SearchDropdownComponent, TooltipDirective],
  templateUrl: './product-options.component.html',
  styleUrl: './product-options.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductOptionsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private accountSvc = inject(AccountService);
  private productsService = inject(ProductsService);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  /** Min preparation/service time — was a static on the old ProductService. */
  readonly minServiceTime = 0;

  group!: FormGroup;

  // ─── Account pickers (load-once via AccountService) ────────────────────
  purchaseGroups = signal<Array<{ parentType: string; items: AccountMini[] }>>([]);
  saleGroups     = signal<Array<{ parentType: string; items: AccountMini[] }>>([]);
  purchaseReady  = signal<boolean>(false);
  saleReady      = signal<boolean>(false);

  /**
   * Flattened {label, value, group} rows for the custom search-dropdown.
   * The `group` field drives the subtle right-aligned parent-type tag in
   * each option (via the `#item` template slot).
   */
  purchaseItems = computed<AccountOption[]>(() =>
    this.purchaseGroups().flatMap((grp) =>
      grp.items.map((acc) => ({
        label: acc.name,
        value: acc.id,
        group: grp.parentType || 'Other',
      })),
    ),
  );
  saleItems = computed<AccountOption[]>(() =>
    this.saleGroups().flatMap((grp) =>
      grp.items.map((acc) => ({
        label: acc.name,
        value: acc.id,
        group: grp.parentType || 'Other',
      })),
    ),
  );

  /**
   * The AccountOption currently pinned in each dropdown — derived from the
   * form control's id value. We bind `[value]` / `(valueChange)` instead of
   * `formControlName` so the form only ever stores the raw id string (not
   * the whole option object) and downstream save / diff code doesn't break.
   */
  selectedPurchase = computed<AccountOption | null>(() => {
    const id = this.group?.get('purchaseAccountId')?.value as string | null;
    if (!id) return null;
    return this.purchaseItems().find((i) => i.value === id) ?? null;
  });
  selectedSale = computed<AccountOption | null>(() => {
    const id = this.group?.get('saleAccountId')?.value as string | null;
    if (!id) return null;
    return this.saleItems().find((i) => i.value === id) ?? null;
  });

  // Template helpers for the dropdown.
  accountDisplay  = (opt: any): string => opt?.label ?? '';
  compareByValue  = (a: any, b: any): boolean => (a?.value ?? a) === (b?.value ?? b);

  onPurchasePicked(opt: any): void {
    this.group.patchValue({ purchaseAccountId: opt?.value ?? opt ?? null });
  }
  onSalePicked(opt: any): void {
    this.group.patchValue({ saleAccountId: opt?.value ?? opt ?? null });
  }

  // ─── Tags ──────────────────────────────────────────────────────────────
  /**
   * Tags on the product. Stored as `{ display, value }` rows to mirror the
   * old `tagsArr` shape the Product model reads in `getTags`. We keep the
   * list outside the FormGroup because the chip UI is easier to reason
   * about as a signal — the form still learns about changes via
   * `productForm.markAsDirty()` on every mutation.
   */
  tags = signal<PendingTag[]>([]);

  /** Selected tags as `{label, value}` rows for the multi-select dropdown. */
  selectedTagItems = computed<TagOption[]>(() =>
    this.tags().map((t) => ({ label: t.display, value: t.value })),
  );

  /** Live search term in the dropdown — drives the "Create tag" footer button. */
  tagSearchTerm = signal<string>('');

  /** True when the typed term is non-empty AND not already a selected tag. */
  canCreateTypedTag = computed<boolean>(() => {
    const q = this.tagSearchTerm().trim();
    if (!q) return false;
    return !this.tags().some((t) => t.value.toLowerCase() === q.toLowerCase());
  });

  // ─── Visibility shorthands (derived, for cleaner template) ─────────────
  showOrderByWeight         = computed(() => !!this.fieldsOptions()?.orderByWeight?.isVisible);
  showDiscountableInPOS     = computed(() => !!this.fieldsOptions()?.discountableInPOS?.isVisible);
  showMaxItemPerTicket      = computed(() => !!this.fieldsOptions()?.maxItemPerTicket?.isVisible);
  showPreparationTime       = computed(() => !!this.fieldsOptions()?.preparationTime?.isVisible);
  showServiceTime           = computed(() => !!this.fieldsOptions()?.serviceTime?.isVisible);
  showKitchenName           = computed(() => !!this.fieldsOptions()?.kitchenName?.isVisible);
  showTags                  = computed(() => !!this.fieldsOptions()?.tags?.isVisible);
  showWarning               = computed(() => !!this.fieldsOptions()?.warning?.isVisible);
  showItemMessage           = computed(() => !!this.fieldsOptions()?.itemMessage?.isVisible);
  showAfterServiceDesc      = computed(() => !!this.fieldsOptions()?.afterServiceDescription?.isVisible);
  showPurchaseItem          = computed(() => !!this.fieldsOptions()?.isPurchaseItem?.isVisible);
  showSaleItem              = computed(() => !!this.fieldsOptions()?.isSaleItem?.isVisible);

  /**
   * True when the whole card has nothing to render for the current product
   * type. The parent form already gates the `<app-pf-product-options>`
   * instantiation on "inventory or type that owns any of these fields",
   * but a secondary guard inside the card avoids an empty shell if a
   * future type turns every flag off.
   */
  hasAnyVisible = computed(() =>
    this.showOrderByWeight() || this.showDiscountableInPOS() ||
    this.showMaxItemPerTicket() || this.showPreparationTime() ||
    this.showServiceTime() || this.showKitchenName() ||
    this.showTags() || this.showWarning() || this.showItemMessage() ||
    this.showAfterServiceDesc() || this.showPurchaseItem() ||
    this.showSaleItem()
  );

  ngOnInit(): void {
    const info = this.productInfo();
    const f = this.fieldsOptions();

    // Build FormGroup — every control is created but only the visible ones
    // end up bound in the template. Controls are cheap; branching on
    // visibility here would complicate the sync-back subscription.
    this.group = this.fb.group({
      orderByWeight:           [!!info.orderByWeight],
      discountableInPOS:       [info.isDiscountable !== false],   // null treated as true
      maxItemPerTicket:        [info.maxItemPerTicket ?? 0, [Validators.min(0)]],
      preparationTime:         [info.serviceTime ?? 0, [Validators.min(this.minServiceTime)]],
      serviceTime:             [info.serviceTime ?? 0, [Validators.min(this.minServiceTime)]],
      kitchenName:             [info.kitchenName ?? ''],
      warning:                 [info.warning ?? ''],
      itemMessage:             [(info as any).itemMessage ?? ''],
      afterServiceDescription: [(info as any).afterServiceDescription ?? ''],
      isPurchaseItem:          [info.isPurchaseItem !== false],
      purchaseAccountId:       [info.purchaseAccountId ?? null],
      isSaleItem:              [info.isSaleItem !== false],
      saleAccountId:           [info.saleAccountId ?? null],
    });

    this.productForm().setControl('productOptions', this.group);

    // Seed tags from whichever field the backend populated. `tagsArr` is
    // the UI-side shape (`{display, value}`) and `tags` is a plain string
    // array — prefer tagsArr if it already has entries, otherwise adapt
    // from `tags`.
    const seededTags: PendingTag[] = Array.isArray(info.tagsArr) && info.tagsArr.length
      ? info.tagsArr.map((t: any) => ({
          display: (t?.display ?? t?.value ?? String(t)) || '',
          value:   (t?.value   ?? t?.display ?? String(t)) || '',
        }))
      : (Array.isArray(info.tags) ? info.tags.map((v) => ({ display: v, value: v })) : []);
    this.tags.set(seededTags);
    this.syncTagsToModel();

    // One-way sync: form → model so save path + derived getters see fresh values.
    this.group.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        const p = this.productInfo();
        p.orderByWeight     = !!v.orderByWeight;
        p.isDiscountable    = !!v.discountableInPOS;
        p.maxItemPerTicket  = Number(v.maxItemPerTicket ?? 0);
        // preparationTime and serviceTime both ultimately feed into
        // `productInfo.serviceTime` on the model — whichever field is
        // visible for this product type wins. Visibility is mutually
        // exclusive by fieldsOptions so the two controls are never both
        // shown together.
        if (this.showPreparationTime()) p.serviceTime = Number(v.preparationTime ?? 0);
        else if (this.showServiceTime()) p.serviceTime = Number(v.serviceTime ?? 0);
        p.kitchenName       = v.kitchenName ?? '';
        p.warning           = v.warning ?? '';
        (p as any).itemMessage             = v.itemMessage ?? '';
        (p as any).afterServiceDescription = v.afterServiceDescription ?? '';
        p.isPurchaseItem    = !!v.isPurchaseItem;
        p.purchaseAccountId = v.purchaseAccountId ?? null;
        p.isSaleItem        = !!v.isSaleItem;
        p.saleAccountId     = v.saleAccountId ?? null;
      });

    // Load accounts when the section is visible. The AccountService caches
    // per-session so switching between products doesn't refetch.
    if (f?.isPurchaseItem?.isVisible) {
      this.accountSvc.loadPurchaseAccounts()
        .then((list) => {
          this.purchaseGroups.set(this.accountSvc.groupByParentType(list));
          this.purchaseReady.set(true);
          this.applyDefaultPurchaseAccount(list);
        })
        .catch(() => this.purchaseReady.set(true));
    }
    if (f?.isSaleItem?.isVisible) {
      this.accountSvc.loadSaleAccounts()
        .then((list) => {
          this.saleGroups.set(this.accountSvc.groupByParentType(list));
          this.saleReady.set(true);
          this.applyDefaultSaleAccount(list);
        })
        .catch(() => this.saleReady.set(true));
    }
  }

  /**
   * Seed the default purchase account — "Inventory Assets" — only for new
   * products that don't already have one saved. Matches old form behaviour.
   */
  private applyDefaultPurchaseAccount(list: AccountMini[]): void {
    const info = this.productInfo();
    if (info.purchaseAccountId) return;
    const defaultAcc = list.find((a) => a.name === 'Inventory Assets');
    if (!defaultAcc) return;
    this.group.patchValue({ purchaseAccountId: defaultAcc.id });
  }

  /** Seed the default sale account — "Sales" — for brand-new products. */
  private applyDefaultSaleAccount(list: AccountMini[]): void {
    const info = this.productInfo();
    if (info.saleAccountId) return;
    const defaultAcc = list.find((a) => a.name === 'Sales');
    if (!defaultAcc) return;
    this.group.patchValue({ saleAccountId: defaultAcc.id });
  }

  // ─── Tag picker ─────────────────────────────────────────────────────────

  /** Async page loader for the tag dropdown — calls the existing service. */
  loadTagOptions: DropdownLoadFn<TagOption> = async ({ page, pageSize, search }) => {
    try {
      const res = await this.productsService.getProductTags({ page, pageSize, search });
      return { items: res.items as TagOption[], hasMore: res.hasMore };
    } catch {
      return { items: [], hasMore: false };
    }
  };

  /** Display function for dropdown — renders the option's label. */
  tagItemLabel = (opt: TagOption): string => opt?.label ?? '';

  /** Equality check across freshly-loaded options vs. seeded selection. */
  tagItemEquals = (a: TagOption, b: TagOption): boolean =>
    (a?.value ?? a as unknown as string) === (b?.value ?? b as unknown as string);

  /** User checked/unchecked tags in the multi-select panel. */
  onTagsChanged(items: TagOption[]): void {
    const next: PendingTag[] = (items ?? []).map((i) => ({
      display: i.label,
      value:   i.value,
    }));
    this.tags.set(next);
    this.syncTagsToModel();
    this.productForm().markAsDirty();
  }

  /** Footer "+ Create tag" — adds a brand-new tag the user typed in search. */
  addCustomTag(raw: string): void {
    const v = raw?.trim();
    if (!v) return;
    if (this.tags().some((t) => t.value.toLowerCase() === v.toLowerCase())) return;
    this.tags.update((cur) => [...cur, { display: v, value: v }]);
    this.tagSearchTerm.set('');
    this.syncTagsToModel();
    this.productForm().markAsDirty();
  }

  /** Remove a tag from the chip strip below the dropdown. */
  removeTagAt(i: number): void {
    if (i < 0 || i >= this.tags().length) return;
    this.tags.update((cur) => cur.filter((_, idx) => idx !== i));
    this.syncTagsToModel();
    this.productForm().markAsDirty();
  }

  private syncTagsToModel(): void {
    const info = this.productInfo();
    info.tagsArr = this.tags().map((t) => ({ display: t.display, value: t.value }));
    info.tags    = this.tags().map((t) => t.value);
  }

  // Template convenience — returns the control or null so `?.` chains compile
  // under strictTemplates.
  c(name: string) {
    return this.group?.get(name);
  }
}
