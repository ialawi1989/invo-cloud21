import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { LanguageService } from '@core/i18n/language.service';
import { CompanyService } from '@core/auth/company.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';

import { ShippingService } from '../../shipping/services/shipping.service';
import {
  DeliveryMethod,
  ShippingOptions,
  ShippingType,
  emptyShippingOptions,
} from '../../shipping/services/shipping.types';
import {
  ShippingOptionsModalComponent,
  ShippingOptionsModalData,
  ShippingOptionsModalResult,
} from '../../shipping/components/shipping-options-modal/shipping-options-modal.component';

import { ShippingComponent }       from '../../shipping/pages/shipping.component';
import { CoveredAddressComponent } from '../../covered-address/pages/covered-address.component';
import { CoveredZoneComponent }    from '../../covered-zone/pages/covered-zone.component';

/**
 * Shipping & Delivery hub.
 *
 * One page, three sub-editors. The shipping options (`type` + when
 * delivery, `deliveryMethod`) drive which sub-editor is mounted:
 *
 *   • type=shipping            → <app-shipping/>          (country zones)
 *   • type=delivery, address   → <app-covered-address/>   (Govt/City/Block)
 *   • type=delivery, zone      → <app-covered-zone/>      (radius zones)
 *
 * The hub itself is "thin" — it owns:
 *   • breadcrumbs + page title
 *   • the inline mode segmented controls (type, then sub-method)
 *   • a "More options" button that opens the existing options modal
 *     for weight UOM and delivery-charge tax
 *
 * The mounted child component manages its OWN load + save lifecycle
 * (each one already has a fixed save bar and unsaved-changes guard),
 * so the hub doesn't need a footer of its own. Switching modes
 * destroys + remounts the child, which means a half-edited child
 * triggers its own guard before the hub allows the switch.
 *
 * The child's inner `<app-breadcrumbs/>` + page title are hidden via
 * scoped `::ng-deep` rules in the SCSS; we don't need to modify each
 * child to support an `embedded` flag.
 */
@Component({
  selector: 'app-shipping-delivery',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    SegmentedToggleComponent,
    ShippingComponent,
    CoveredAddressComponent,
    CoveredZoneComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shipping-delivery.component.html',
  styleUrl:    './shipping-delivery.component.scss',
})
export class ShippingDeliveryComponent implements OnInit, CanLeaveComponent {
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private service    = inject(ShippingService);
  private modal      = inject(ModalService);
  private toast      = inject(ToastService);
  private language   = inject(LanguageService);
  private company    = inject(CompanyService);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  /** Saved (persisted) options — what the server last confirmed.
   *  The modal reads/writes from here so its Save commits straight
   *  through. The hub's toggle changes do NOT touch this signal
   *  until the user clicks the inline Save button. */
  options = signal<ShippingOptions>(emptyShippingOptions());

  /** Draft mirror of `options` for the inline `type` + `deliveryMethod`
   *  pickers. The user is free to toggle around and preview the
   *  matching embedded editor; the toggle isn't persisted until the
   *  hub's Save button is clicked. Discard resets `draft → options`. */
  draft = signal<ShippingOptions>(emptyShippingOptions());

  /** Resolved view-mode: 'shipping' | 'delivery-address' | 'delivery-zone'.
   *  Drives the @switch in the template. Reads from the DRAFT so the
   *  embedded editor previews the picked mode immediately, even
   *  before the user commits. */
  activeMode = computed<'shipping' | 'delivery-address' | 'delivery-zone'>(() => {
    const o = this.draft();
    if (o.type === 'shipping') return 'shipping';
    return o.deliveryMethod === 'zone' ? 'delivery-zone' : 'delivery-address';
  });

  /** True when the draft picker state diverges from the saved state.
   *  Drives the inline Save / Discard action bar's visibility and
   *  the unsaved-changes guard. */
  isDirty = computed<boolean>(() => {
    const a = this.draft();
    const b = this.options();
    return a.type !== b.type || a.deliveryMethod !== b.deliveryMethod;
  });

  // Static option arrays for the shared `<app-segmented-toggle>`.
  // i18n keys; the toggle pipes them through translate.
  readonly typeOptions: SegmentedToggleOption<ShippingType>[] = [
    { value: 'delivery', label: 'SHIPPING_DELIVERY.TYPE_DELIVERY' },
    { value: 'shipping', label: 'SHIPPING_DELIVERY.TYPE_SHIPPING' },
  ];
  readonly methodOptions: SegmentedToggleOption<DeliveryMethod>[] = [
    { value: 'address', label: 'SHIPPING_DELIVERY.METHOD_ADDRESS' },
    { value: 'zone',    label: 'SHIPPING_DELIVERY.METHOD_ZONE' },
  ];

  private i18nTick = signal(0);
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.translate.instant('SHIPPING_DELIVERY.TITLE') },
    ];
  });

  constructor() {
    // The hub-specific keys live under SHIPPING_DELIVERY.* inside the
    // already-loaded `shipping` bundle (the route guard preloads it),
    // so no extra `withTranslations()` call is needed here. Keeping
    // the route guard as the single source of truth avoids the
    // Angular CLI's asset-watcher quirk where brand-new feature
    // directories aren't picked up until `ng serve` is fully
    // restarted.
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    // Pre-warm translations for whichever child we'll mount first so
    // the embedded view doesn't flash raw i18n keys.
    await Promise.all([
      this.language.loadFeature('shipping'),
      this.language.loadFeature('covered-address'),
      this.language.loadFeature('covered-zone'),
    ]);

    this.loading.set(true);
    try {
      // Force-refresh the company-settings cache before reading. The
      // `weightUOM` + `deliveryChargeTaxId` fields live on the company
      // doc; relying on the in-memory/localStorage cache means a hard
      // browser refresh after a prior save can show stale values if
      // the cache wasn't repopulated. One round-trip on hub mount
      // matches the BusinessSettings page pattern and keeps the
      // dropdowns honest.
      await this.company.loadSettings(true);
      const opts = await this.service.loadOptions();
      this.options.set(opts);
      // Seed the draft from the saved state so toggles start from
      // the persisted choice, not from the static defaults.
      this.draft.set(opts);
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Toggle handlers (draft-only) ───────────────────────────────
  // Pickers update the DRAFT signal only. Nothing hits the network
  // until the user clicks Save. Toggling either control still
  // immediately swaps the embedded editor (so the user can preview
  // their choice) — that's harmless since each child manages its
  // own dirty-state, and they read whichever data the toggle picked.

  setType(type: ShippingType): void {
    if (this.draft().type === type) return;
    this.draft.update(d => ({ ...d, type }));
  }

  setDeliveryMethod(method: DeliveryMethod): void {
    if (this.draft().deliveryMethod === method) return;
    this.draft.update(d => ({ ...d, deliveryMethod: method }));
  }

  // ─── Commit / discard ───────────────────────────────────────────
  /** Commit the draft to the server, then promote it to the saved
   *  state on success. The modal-only fields (weight UOM, tax) are
   *  carried through unchanged. */
  async save(): Promise<void> {
    if (this.saving() || !this.isDirty()) return;
    this.saving.set(true);
    try {
      const next = this.draft();
      const res  = await this.service.saveOptions(next);
      if (res.success) {
        this.options.set(next);
        this.toast.success('COMMON.SAVED_OK');
      } else {
        this.toast.error('COMMON.SAVE_FAILED', res.msg);
      }
    } catch (err: any) {
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
    } finally {
      this.saving.set(false);
    }
  }

  /** Throw away the picker changes and reset the draft to the
   *  saved state. The embedded editor re-mounts to match. */
  discard(): void {
    if (!this.isDirty()) return;
    this.draft.set(this.options());
  }

  /** Open the existing Options modal for the secondary fields
   *  (weight UOM + delivery-charge tax). The modal commits directly
   *  to the server; on close we push the new snapshot into both
   *  `options` and `draft` so the hub UI matches the persisted state
   *  and the dirty-check ignores those fields. */
  async openOptions(): Promise<void> {
    const ref = this.modal.open<
      ShippingOptionsModalComponent,
      ShippingOptionsModalData,
      ShippingOptionsModalResult
    >(ShippingOptionsModalComponent, {
      size: 'sm',
      data: { initial: this.options() },
      closeOnBackdrop: false,
    });
    const result = await ref.afterClosed();
    if (result) {
      // Keep the picker-driven fields from the draft (user might
      // have toggled type / method without saving yet) and accept
      // the modal-only fields from the modal result.
      this.options.set({
        ...this.options(),
        weightUOM:           result.weightUOM,
        deliveryChargeTaxId: result.deliveryChargeTaxId,
      });
      this.draft.update(d => ({
        ...d,
        weightUOM:           result.weightUOM,
        deliveryChargeTaxId: result.deliveryChargeTaxId,
      }));
    }
  }

  /** Required by `CanLeaveComponent` — the route's
   *  `unsavedChangesGuard` calls this to decide whether to prompt
   *  before navigating away. */
  hasUnsavedChanges(): boolean { return this.isDirty(); }
}
