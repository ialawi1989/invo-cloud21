import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import { Product } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';

/**
 * measurements
 * ────────────
 * Tailoring-specific card. Each boolean toggles whether a given body
 * measurement is requested when the garment is ordered. Visibility of
 * each row is still driven by `fieldsOptions.measurements.<field>`.
 */
@Component({
  selector: 'app-pf-measurements',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './measurements.component.html',
  styleUrl: './measurements.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeasurementsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  group!: FormGroup;

  /** The 15 body-measurement keys the old Measurement model carries. */
  readonly keys: (keyof typeof this.productInfo extends never ? never : string)[] = [
    'shoulder', 'sleeve', 'armholeGrith', 'upperarmGrith',
    'wristGrith', 'frontShoulderToWaist', 'bustGrith', 'waistGrith',
    'hipGrith', 'acrossShoulder', 'thigh', 'ankle',
    'bodyHeight', 'napeOfNeckToWaist', 'outsteam', 'insideLeg',
  ];

  atLeastOne = computed<boolean>(() => this.productInfo().measurements?.atLeastOne > 0);

  ngOnInit(): void {
    const m = this.productInfo().measurements as any;
    const controls: Record<string, any> = {};
    for (const k of this.keys) {
      controls[k] = [m?.[k] ?? true];
    }
    this.group = this.fb.group(controls);
    this.productForm().setControl('measurements', this.group);

    this.group.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        const tgt: any = this.productInfo().measurements;
        for (const k of this.keys) tgt[k] = !!v[k];
      });
  }

  isVisible(key: string): boolean {
    return !!(this.fieldsOptions()?.measurements as any)?.[key]?.isVisible;
  }

  labelKey(key: string): string {
    return 'PRODUCTS.MEASUREMENTS.' + key.toUpperCase();
  }
}
