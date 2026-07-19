import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { ShippingService } from '../../services/shipping.service';
import {
  ShippingOptions,
  ShippingType,
  TaxOption,
  WeightUomCode,
  DimensionUomCode,
  emptyShippingOptions,
} from '../../services/shipping.types';

export interface ShippingOptionsModalData {
  /** Optional. When omitted the modal loads via `ShippingService.loadOptions()`. */
  initial?: ShippingOptions;
}

export type ShippingOptionsModalResult = ShippingOptions | undefined;

interface DropOption<V extends string> { value: V; label: string; }

/**
 * Inline editor for the three shipping options that don't fit the
 * per-zone grid: shipping vs delivery framing, product weight UOM,
 * and the delivery-charge tax. Persists across two backends — the
 * service handles that — and emits the saved snapshot back to the
 * caller so the page can refresh its `weightUOM` adornment without
 * re-querying.
 */
@Component({
  selector: 'app-shipping-options-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    SearchDropdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shipping-options-modal.component.html',
  styleUrl: './shipping-options-modal.component.scss',
})
export class ShippingOptionsModalComponent {
  data = inject<ShippingOptionsModalData>(MODAL_DATA);
  private ref       = inject<ModalRef<ShippingOptionsModalResult>>(MODAL_REF);
  private service   = inject(ShippingService);
  private translate = inject(TranslateService);
  private toast     = inject(ToastService);

  loading = signal<boolean>(true);
  saving  = signal<boolean>(false);

  options = signal<ShippingOptions>(this.data.initial ?? emptyShippingOptions());
  taxes   = signal<TaxOption[]>([]);

  // Pre-translated picker options. Resolved lazily so they re-render
  // on language change without us wiring `onLangChange` here.
  typeOptions = computed<DropOption<ShippingType>[]>(() => [
    { value: 'delivery', label: this.translate.instant('SHIPPING.OPTIONS.TYPE_DELIVERY') },
    { value: 'shipping', label: this.translate.instant('SHIPPING.OPTIONS.TYPE_SHIPPING') },
  ]);
  weightOptions = computed<DropOption<WeightUomCode>[]>(() => [
    { value: 'kg',    label: this.translate.instant('SHIPPING.OPTIONS.UOM_KG') },
    { value: 'ounce', label: this.translate.instant('SHIPPING.OPTIONS.UOM_OUNCE') },
    { value: 'pound', label: this.translate.instant('SHIPPING.OPTIONS.UOM_POUND') },
  ]);

  /** Product dimension UOM — drives `dimension` rate ranges and the
   *  read-only unit shown on the product form. */
  dimensionOptions = computed<DropOption<DimensionUomCode>[]>(() => [
    { value: 'cm', label: this.translate.instant('SHIPPING.OPTIONS.UOM_CM') },
    { value: 'm',  label: this.translate.instant('SHIPPING.OPTIONS.UOM_M') },
    { value: 'in', label: this.translate.instant('SHIPPING.OPTIONS.UOM_IN') },
    { value: 'ft', label: this.translate.instant('SHIPPING.OPTIONS.UOM_FT') },
  ]);

  // SearchDropdown adapters — generic over `{ value, label }`.
  optDisplay = (o: { label?: string } | null) => o?.label ?? '';
  optCompare = (a: { value?: string } | null, b: { value?: string } | null) => (a?.value ?? null) === (b?.value ?? null);
  optToValue = (o: { value?: string } | null) => o?.value ?? '';

  // Tax picker: pick by id, render by name.
  taxDisplay = (t: TaxOption | null) => t?.name ?? '';
  taxCompare = (a: TaxOption | null, b: TaxOption | null) => (a?.id ?? null) === (b?.id ?? null);
  taxToValue = (t: TaxOption | null) => t?.id ?? '';

  selectedType   = computed(() => this.typeOptions().find(o => o.value === this.options().type)         ?? null);
  selectedWeight = computed(() => this.weightOptions().find(o => o.value === this.options().weightUOM)  ?? null);
  selectedTax    = computed(() => this.taxes().find(t => t.id === this.options().deliveryChargeTaxId)   ?? null);
  selectedDimension = computed(() => this.dimensionOptions().find(o => o.value === this.options().dimensionUOM) ?? null);

  constructor() {
    void this.boot();
  }

  private async boot(): Promise<void> {
    try {
      const [opts, taxes] = await Promise.all([
        this.data.initial ? Promise.resolve(this.data.initial) : this.service.loadOptions(),
        this.service.loadTaxes(),
      ]);
      this.options.set(opts);
      this.taxes.set(taxes);
    } finally {
      this.loading.set(false);
    }
  }

  onTypeChange(v: DropOption<ShippingType> | DropOption<ShippingType>[] | null): void {
    const opt = Array.isArray(v) ? v[0] ?? null : v;
    if (opt) this.options.update(o => ({ ...o, type: opt.value }));
  }
  onWeightChange(v: DropOption<WeightUomCode> | DropOption<WeightUomCode>[] | null): void {
    const opt = Array.isArray(v) ? v[0] ?? null : v;
    if (opt) this.options.update(o => ({ ...o, weightUOM: opt.value }));
  }
  onDimensionChange(v: DropOption<DimensionUomCode> | DropOption<DimensionUomCode>[] | null): void {
    const opt = Array.isArray(v) ? v[0] ?? null : v;
    if (opt) this.options.update(o => ({ ...o, dimensionUOM: opt.value }));
  }
  onTaxChange(v: TaxOption | TaxOption[] | null): void {
    // SearchDropdown emits `null` when cleared — we honour that as
    // "no delivery tax".
    const opt = Array.isArray(v) ? v[0] ?? null : v;
    this.options.update(o => ({ ...o, deliveryChargeTaxId: opt?.id ?? null }));
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      const res = await this.service.saveOptions(this.options());
      if (res.success) {
        this.toast.success('COMMON.SAVED_OK');
        this.ref.close(this.options());
      } else {
        this.toast.error('COMMON.SAVE_FAILED', res.msg);
      }
    } catch (err: any) {
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void { this.ref.close(undefined); }
}
