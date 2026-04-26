import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
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

/**
 * Shipping card — only exposes the "Shipping Weight" input per product
 * spec. The `shippingEnabled` + `weightUOM` fields are still carried on
 * the form so save payloads stay stable; they're seeded from the model
 * and only change when the weight is edited (shippingEnabled auto-flips
 * to `true` once a non-zero weight is set).
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

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  group!: FormGroup;

  ngOnInit(): void {
    const info = this.productInfo();
    this.group = this.fb.group({
      // `shippingEnabled` / `weightUOM` are hidden — they stay on the group
      // so valueChanges still syncs them, but the user only edits `weight`.
      shippingEnabled: [info.shippingEnabled ?? false],
      weight:          [info.weight ?? 0, [Validators.min(0)]],
      weightUOM:       [info.weightUOM ?? 'KG'],
    });
    this.productForm().setControl('shipping', this.group);

    this.group.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        const p = this.productInfo();
        const weight = Number(v.weight ?? 0);
        // Any weight > 0 implies the item ships, so flip the flag in lockstep.
        p.shippingEnabled = weight > 0 ? true : !!v.shippingEnabled;
        p.weight          = weight;
        p.weightUOM       = v.weightUOM ?? 'KG';
      });
  }

  c(name: 'shippingEnabled' | 'weight' | 'weightUOM') {
    return this.group.controls[name];
  }
}
