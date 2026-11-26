import { FormActionsComponent, FormActionPrimaryDirective, FormActionSecondaryDirective } from '@shared/components/form-actions/form-actions.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CompanyService } from '@core/auth/company.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { ShippingService } from '../../shipping/services/shipping.service';
import {
  DeliveryMethod, DimensionUomCode, ShippingOptions, ShippingType, TaxOption, WeightUomCode, emptyShippingOptions,
} from '../../shipping/services/shipping.types';

interface DropOption<V extends string> { value: V; label: string; }

/**
 * Shipping Options, its own page as in the legacy app (shipping type, weight and dimension units, delivery-charge tax).
 * The delivery method (by address / by radius) only applies when the type is Delivery and decides which of the
 * Covered Address / Covered Zone pages the storefront uses.
 */
@Component({
  selector: 'app-shipping-options-page',
  standalone: true,
  imports: [FormActionsComponent, FormActionPrimaryDirective, FormActionSecondaryDirective, PageHeaderComponent, CommonModule, TranslateModule, LoadingOverlayComponent, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shipping-options.component.html',
  styleUrl: './shipping-options.component.scss',
})
export class ShippingOptionsPageComponent implements OnInit, CanLeaveComponent {
  private service    = inject(ShippingService);
  private company    = inject(CompanyService);
  private translate  = inject(TranslateService);
  private toast      = inject(ToastService);
  private router     = inject(Router);
  private destroyRef = inject(DestroyRef);

  loading = signal(true);
  saving  = signal(false);
  saved   = signal<ShippingOptions>(emptyShippingOptions());
  options = signal<ShippingOptions>(emptyShippingOptions());
  taxes   = signal<TaxOption[]>([]);

  private i18nTick = signal(0);

  constructor() {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update(n => n + 1));
  }

  private t = (k: string) => this.translate.instant(k);

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.t('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.t('SHIPPING.OPTIONS.ACTION') },
    ];
  });

  typeOptions = computed<DropOption<ShippingType>[]>(() => { this.i18nTick(); return [
    { value: 'delivery', label: this.t('SHIPPING.OPTIONS.TYPE_DELIVERY') },
    { value: 'shipping', label: this.t('SHIPPING.OPTIONS.TYPE_SHIPPING') },
  ]; });
  methodOptions = computed<DropOption<DeliveryMethod>[]>(() => { this.i18nTick(); return [
    { value: 'address', label: this.t('SHIPPING.OPTIONS.METHOD_ADDRESS') },
    { value: 'zone',    label: this.t('SHIPPING.OPTIONS.METHOD_ZONE') },
  ]; });
  weightOptions = computed<DropOption<WeightUomCode>[]>(() => { this.i18nTick(); return [
    { value: 'kg',    label: this.t('SHIPPING.OPTIONS.UOM_KG') },
    { value: 'ounce', label: this.t('SHIPPING.OPTIONS.UOM_OUNCE') },
    { value: 'pound', label: this.t('SHIPPING.OPTIONS.UOM_POUND') },
  ]; });
  dimensionOptions = computed<DropOption<DimensionUomCode>[]>(() => { this.i18nTick(); return [
    { value: 'cm', label: this.t('SHIPPING.OPTIONS.UOM_CM') },
    { value: 'm',  label: this.t('SHIPPING.OPTIONS.UOM_M') },
    { value: 'in', label: this.t('SHIPPING.OPTIONS.UOM_IN') },
    { value: 'ft', label: this.t('SHIPPING.OPTIONS.UOM_FT') },
  ]; });

  selectedType      = computed(() => this.typeOptions().find(o => o.value === this.options().type) ?? null);
  selectedMethod    = computed(() => this.methodOptions().find(o => o.value === this.options().deliveryMethod) ?? null);
  selectedWeight    = computed(() => this.weightOptions().find(o => o.value === this.options().weightUOM) ?? null);
  selectedDimension = computed(() => this.dimensionOptions().find(o => o.value === this.options().dimensionUOM) ?? null);
  selectedTax       = computed(() => this.taxes().find(x => x.id === this.options().deliveryChargeTaxId) ?? null);

  isDirty = computed(() => JSON.stringify(this.options()) !== JSON.stringify(this.saved()));

  optDisplay = (o: { label?: string } | null) => o?.label ?? '';
  optCompare = (a: { value?: string } | null, b: { value?: string } | null) => (a?.value ?? null) === (b?.value ?? null);
  optToValue = (o: { value?: string } | null) => o?.value ?? '';
  taxDisplay = (x: TaxOption | null) => x?.name ?? '';
  taxCompare = (a: TaxOption | null, b: TaxOption | null) => (a?.id ?? null) === (b?.id ?? null);
  taxToValue = (x: TaxOption | null) => x?.id ?? '';

  async ngOnInit(): Promise<void> {
    try {
      // The weight unit and delivery tax live on the company doc; refresh it so a reload never shows stale values.
      await this.company.loadSettings(true);
      const [opts, taxes] = await Promise.all([this.service.loadOptions(), this.service.loadTaxes()]);
      this.saved.set(opts);
      this.options.set(opts);
      this.taxes.set(taxes);
    } finally {
      this.loading.set(false);
    }
  }

  private first<T>(v: T | T[] | null): T | null { return Array.isArray(v) ? v[0] ?? null : v; }

  setType(v: DropOption<ShippingType> | DropOption<ShippingType>[] | null): void {
    const o = this.first(v); if (o) this.options.update(s => ({ ...s, type: o.value }));
  }
  setMethod(v: DropOption<DeliveryMethod> | DropOption<DeliveryMethod>[] | null): void {
    const o = this.first(v); if (o) this.options.update(s => ({ ...s, deliveryMethod: o.value }));
  }
  setWeight(v: DropOption<WeightUomCode> | DropOption<WeightUomCode>[] | null): void {
    const o = this.first(v); if (o) this.options.update(s => ({ ...s, weightUOM: o.value }));
  }
  setDimension(v: DropOption<DimensionUomCode> | DropOption<DimensionUomCode>[] | null): void {
    const o = this.first(v); if (o) this.options.update(s => ({ ...s, dimensionUOM: o.value }));
  }
  setTax(v: TaxOption | TaxOption[] | null): void {
    this.options.update(s => ({ ...s, deliveryChargeTaxId: this.first(v)?.id ?? null }));
  }

  async save(): Promise<void> {
    if (this.saving() || !this.isDirty()) return;
    this.saving.set(true);
    try {
      const res = await this.service.saveOptions(this.options());
      if (res.success) {
        this.saved.set(this.options());
        this.toast.success('COMMON.SAVED_OK');
        void this.router.navigate(['/settings']);
      } else {
        this.toast.error('COMMON.SAVE_FAILED', res.msg);
      }
    } catch (err: any) {
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void { void this.router.navigate(['/settings']); }

  hasUnsavedChanges(): boolean { return this.isDirty(); }
}
