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

import { Product } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';
import { ShippingService } from '@features/settings/shipping/services/shipping.service';

/**
 * Shipping card — exposes "Shipping Weight" plus the L×W×H shipping size
 * used by `dimension` rate ranges. The `shippingEnabled` + `weightUOM`
 * fields are still carried on the form so save payloads stay stable;
 * they're seeded from the model and only change when the weight is edited
 * (shippingEnabled auto-flips to `true` once a non-zero weight is set).
 *
 * The dimension unit is NOT editable here — it's a single company-wide
 * setting on ThemeSettings.shippingOptions.dimensionUOM (Shipping settings),
 * shown read-only beside the inputs.
 */
@Component({
  selector: 'app-pf-shipping-options',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './shipping-options.component.html',
  styleUrl: './shipping-options.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShippingOptionsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private shipping = inject(ShippingService);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  group!: FormGroup;

  /** Read-only unit label beside the dimension inputs. */
  dimensionUom = signal<string>('cm');

  /** Per-field visibility for the L×W×H inputs — default to shown so a
   *  product type without an explicit `dimension` block still gets them. */
  showDimensions = computed<boolean>(
    () => this.fieldsOptions()?.shippingOptions?.dimension?.isVisible !== false,
  );

  ngOnInit(): void {
    const info = this.productInfo();
    const d = info.dimension ?? { length: 0, width: 0, height: 0, uom: 'cm' };
    this.group = this.fb.group({
      // `shippingEnabled` / `weightUOM` are hidden — they stay on the group
      // so valueChanges still syncs them, but the user only edits `weight`.
      shippingEnabled: [info.shippingEnabled ?? false],
      weight:          [info.weight ?? 0, [Validators.min(0)]],
      weightUOM:       [info.weightUOM ?? 'KG'],
      length:          [d.length ?? 0, [Validators.min(0)]],
      width:           [d.width ?? 0,  [Validators.min(0)]],
      height:          [d.height ?? 0, [Validators.min(0)]],
    });
    this.productForm().setControl('shipping', this.group);

    // Display-only, and deliberately not awaited before the controls are
    // built — a slow settings fetch must never delay the form bindings.
    void this.loadDimensionUom();

    this.group.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        const p = this.productInfo();
        const weight = Number(v.weight ?? 0);
        // Any weight > 0 implies the item ships, so flip the flag in lockstep.
        p.shippingEnabled = weight > 0 ? true : !!v.shippingEnabled;
        p.weight          = weight;
        p.weightUOM       = v.weightUOM ?? 'KG';
        p.dimension = {
          length: Number(v.length ?? 0) || 0,
          width:  Number(v.width ?? 0)  || 0,
          height: Number(v.height ?? 0) || 0,
          uom:    this.dimensionUom(),
        };
      });
  }

  private async loadDimensionUom(): Promise<void> {
    try {
      const opts = await this.shipping.loadOptions();
      this.dimensionUom.set(opts.dimensionUOM || 'cm');
    } catch {
      // Keep the default — the unit is a label, not a value we persist.
    }
    const p = this.productInfo();
    if (p.dimension) p.dimension.uom = this.dimensionUom();
  }

  c(name: 'shippingEnabled' | 'weight' | 'weightUOM' | 'length' | 'width' | 'height') {
    return this.group.controls[name];
  }
}
