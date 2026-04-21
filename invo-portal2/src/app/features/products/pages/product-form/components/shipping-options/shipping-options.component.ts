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

import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { Product } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';

interface UomItem { label: string; value: string; }

/** Shipping enablement + weight info for fulfilment. */
@Component({
  selector: 'app-pf-shipping-options',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, SearchDropdownComponent],
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

  weightUoms: UomItem[] = [
    { label: 'kg', value: 'KG' },
    { label: 'g',  value: 'G'  },
    { label: 'lb', value: 'LB' },
    { label: 'oz', value: 'OZ' },
  ];

  ngOnInit(): void {
    const info = this.productInfo();
    this.group = this.fb.group({
      shippingEnabled: [info.shippingEnabled ?? false],
      weight:          [info.weight ?? 0, [Validators.min(0)]],
      weightUOM:       [info.weightUOM ?? 'KG'],
    });
    this.productForm().setControl('shipping', this.group);

    this.group.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        const p = this.productInfo();
        p.shippingEnabled = !!v.shippingEnabled;
        p.weight          = Number(v.weight ?? 0);
        p.weightUOM       = v.weightUOM ?? 'KG';
      });
  }

  c(name: 'shippingEnabled' | 'weight' | 'weightUOM') {
    return this.group.controls[name];
  }

  displayLabel = (item: any): string => item?.label ?? String(item ?? '');
  compareByValue = (a: any, b: any): boolean => (a?.value ?? a) === (b?.value ?? b);
}
