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

import { Product, Nutrition } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';

/**
 * food-nutrition
 * ──────────────
 * Three input groups (serving / macros / vitamins) plus an FDA-style
 * "Nutrition Facts" preview that derives mass values for the four
 * mandatory micronutrients from %DV inputs and computes %DV for the
 * macros from raw masses.
 *
 * Daily Value reference numbers come from the 2016 FDA update — the same
 * set used by current US food labels. They're constants, not configurable.
 */

/** FDA Daily Value reference amounts (2016 update). */
const DV = {
  totalFat:     78,    // g
  saturatedFat: 20,    // g
  cholesterol:  300,   // mg
  sodium:       2300,  // mg
  totalCarbs:   275,   // g
  dietaryFiber: 28,    // g
  addedSugars:  50,    // g
  protein:      50,    // g
  vitaminD:     20,    // mcg
  calcium:      1300,  // mg
  iron:         18,    // mg
  potassium:    4700,  // mg
} as const;

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

  /** Snapshot of the form value, refreshed on each `valueChanges`, used by
   *  the preview computeds. The `productInfo` input signal can't track
   *  property mutations on its `Nutrition` instance, so the form value is
   *  the reactive source of truth here. */
  private value = signal<any>({});

  // ─── Preview-derived values ────────────────────────────────────────────
  // Macros: enter mass, derive %DV.
  totalFatPct      = computed(() => this.pct(this.value().fat,           DV.totalFat));
  saturatedFatPct  = computed(() => this.pct(this.value().saturatedFat,  DV.saturatedFat));
  cholesterolPct   = computed(() => this.pct(this.value().cholesterol,   DV.cholesterol));
  sodiumPct        = computed(() => this.pct(this.value().sodium,        DV.sodium));
  totalCarbsPct    = computed(() => this.pct(this.value().carb,          DV.totalCarbs));
  dietaryFiberPct  = computed(() => this.pct(this.value().dietaryFiber,  DV.dietaryFiber));
  addedSugarsPct   = computed(() => this.pct(this.value().addedSugars,   DV.addedSugars));
  proteinPct       = computed(() => this.pct(this.value().protien,       DV.protein));

  // Micros: enter %DV, derive mass for the label.
  vitaminDMcg      = computed(() => this.massFromPct(this.value().vitaminD,  DV.vitaminD));
  calciumMg        = computed(() => this.massFromPct(this.value().calcium,   DV.calcium));
  ironMg           = computed(() => this.massFromPct(this.value().iron,      DV.iron));
  potassiumMg      = computed(() => this.massFromPct(this.value().potassium, DV.potassium));

  ngOnInit(): void {
    const n: Nutrition = this.productInfo().nutrition ?? new Nutrition();
    this.group = this.fb.group({
      // Serving
      servingSize:          [n.servingSize ?? ''],
      servingsPerContainer: [n.servingsPerContainer ?? 0, [Validators.min(0)]],
      kcal:                 [n.kcal ?? 0,                 [Validators.min(0)]],

      // Macros
      fat:          [n.fat ?? 0,          [Validators.min(0)]],
      saturatedFat: [n.saturatedFat ?? 0, [Validators.min(0)]],
      transFat:     [n.transFat ?? 0,     [Validators.min(0)]],
      cholesterol:  [n.cholesterol ?? 0,  [Validators.min(0)]],
      sodium:       [n.sodium ?? 0,       [Validators.min(0)]],
      carb:         [n.carb ?? 0,         [Validators.min(0)]],
      protien:      [n.protien ?? 0,      [Validators.min(0)]],
      dietaryFiber: [n.dietaryFiber ?? 0, [Validators.min(0)]],
      totalSugars:  [n.totalSugars ?? 0,  [Validators.min(0)]],
      addedSugars:  [n.addedSugars ?? 0,  [Validators.min(0)]],

      // Vitamins & minerals (% Daily Value)
      vitaminA:  [n.vitaminA  ?? 0, [Validators.min(0)]],
      vitaminC:  [n.vitaminC  ?? 0, [Validators.min(0)]],
      vitaminD:  [n.vitaminD  ?? 0, [Validators.min(0)]],
      vitaminE:  [n.vitaminE  ?? 0, [Validators.min(0)]],
      calcium:   [n.calcium   ?? 0, [Validators.min(0)]],
      iron:      [n.iron      ?? 0, [Validators.min(0)]],
      potassium: [n.potassium ?? 0, [Validators.min(0)]],
      magnesium: [n.magnesium ?? 0, [Validators.min(0)]],
    });
    this.productForm().setControl('nutrition', this.group);
    this.value.set(this.group.getRawValue());

    this.group.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        this.value.set(v);
        const info = this.productInfo();
        if (!info.nutrition) info.nutrition = new Nutrition();
        // Mirror every field back to the model so consumers reading
        // `productInfo.nutrition` get fresh values without the FormGroup.
        for (const key of Object.keys(v) as (keyof Nutrition)[]) {
          const next = (v as any)[key];
          (info.nutrition as any)[key] = typeof next === 'string'
            ? next
            : Number(next ?? 0);
        }
      });
  }

  c(name: string) {
    return this.group.controls[name];
  }

  /** Round to nearest integer percent; treats missing/zero ref as 0 to avoid NaN. */
  private pct(value: any, dv: number): number {
    const n = Number(value ?? 0);
    if (!dv || !Number.isFinite(n)) return 0;
    return Math.round((n / dv) * 100);
  }

  /** mass = (%DV × DV reference) / 100, rounded to nearest int. */
  private massFromPct(pct: any, dv: number): number {
    const p = Number(pct ?? 0);
    if (!dv || !Number.isFinite(p)) return 0;
    return Math.round((p * dv) / 100);
  }
}
