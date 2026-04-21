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

import { Product, Nutrition } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';

/** Simple nutritional-info card — kcal / fat / carb / protein. */
@Component({
  selector: 'app-pf-food-nutrition',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './food-nutrition.component.html',
  styleUrl: './food-nutrition.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoodNutritionComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  group!: FormGroup;

  ngOnInit(): void {
    const n: Nutrition = this.productInfo().nutrition ?? new Nutrition();
    this.group = this.fb.group({
      kcal:    [n.kcal ?? 0,    [Validators.min(0)]],
      fat:     [n.fat ?? 0,     [Validators.min(0)]],
      carb:    [n.carb ?? 0,    [Validators.min(0)]],
      protien: [n.protien ?? 0, [Validators.min(0)]],
    });
    this.productForm().setControl('nutrition', this.group);

    this.group.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        const info = this.productInfo();
        if (!info.nutrition) info.nutrition = new Nutrition();
        info.nutrition.kcal    = Number(v.kcal ?? 0);
        info.nutrition.fat     = Number(v.fat ?? 0);
        info.nutrition.carb    = Number(v.carb ?? 0);
        info.nutrition.protien = Number(v.protien ?? 0);
      });
  }

  c(name: 'kcal' | 'fat' | 'carb' | 'protien') {
    return this.group.controls[name];
  }
}
