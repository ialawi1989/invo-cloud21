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
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import { Product, ProductAttributes } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';
import { AttributeIconComponent } from './attribute-icon.component';

/**
 * Canonical roster of dietary / lifestyle labels seeded into the form. If
 * the backend doesn't return one of these, we inject it unchecked so the
 * user sees the full menu. Extra attributes from the backend are kept and
 * sorted after the canonical list.
 *
 * Order matches the visual reference (organic / vegan / vegetarian first,
 * then the diet-style group, then religious labels at the end).
 */
const CANONICAL_ATTRIBUTES: ReadonlyArray<{ key: string; title: string }> = [
  { key: 'organic',         title: 'Organic' },
  { key: 'vegan',           title: 'Vegan' },
  { key: 'vegetarian',      title: 'Vegetarian' },
  { key: 'gluten-free',     title: 'Gluten-Free' },
  { key: 'dairy-free',      title: 'Dairy-Free' },
  { key: 'sugar-free',      title: 'Sugar-Free' },
  { key: 'low-fat',         title: 'Low-Fat' },
  { key: 'low-sodium',      title: 'Low-Sodium' },
  { key: 'high-protein',    title: 'High-Protein' },
  { key: 'keto-friendly',   title: 'Keto-Friendly' },
  { key: 'paleo',           title: 'Paleo' },
  { key: 'raw',             title: 'Raw' },
  { key: 'non-gmo',         title: 'Non-GMO' },
  { key: 'kosher',          title: 'Kosher' },
  { key: 'halal',           title: 'Halal' },
  // Legacy / business-specific labels — kept so existing records that have
  // them checked don't lose state. They sit at the end of the list.
  { key: 'spicy',           title: 'Spicy' },
  { key: 'very-spicy',      title: 'Very Spicy' },
  { key: 'fresh',           title: 'Fresh' },
  { key: 'angus-beaf',      title: 'Angus Beaf' },
  { key: 'no-sugar',        title: 'No Sugar Added' },
  { key: 'lactose-free',    title: 'Lactose-Free' },
  { key: 'keto',            title: 'Keto' },
  { key: 'trans-fat-free',  title: 'Trans-Fat-Free' },
  { key: 'contain-alcohol', title: 'Contains Alcohol' },
  { key: 'non-alcoholic',   title: 'Non-Alcoholic' },
];

/**
 * product-attributes
 * ──────────────────
 * Flat list of named boolean attributes (e.g. "Halal", "Vegan", "Organic").
 * The attribute roster comes from the API on the product itself; we just
 * render checkboxes and maintain `checked` + `showInSearch` on each row.
 */
@Component({
  selector: 'app-pf-product-attributes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, AttributeIconComponent],
  templateUrl: './product-attributes.component.html',
  styleUrl: './product-attributes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductAttributesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  rows!: FormArray<FormGroup>;

  /** Certification text inputs — independent of the tile grid; written
   *  back to `productInfo.certificationBody` / `certificationNumber`. */
  certificationBody   = new FormControl<string>('', { nonNullable: true });
  certificationNumber = new FormControl<string>('', { nonNullable: true });

  /** Debounced search term — filters which rows are rendered by title match. */
  search = signal<string>('');

  /** Bumped after seeding / toggles so the filtered-view computed re-runs. */
  private rowsTick = signal(0);

  /**
   * Rows visible in the tile grid. Applies the search filter and respects
   * the `showInSearch` flag from the old project (null / true → visible,
   * explicit false → hidden). Stays synced with the FormArray via rowsTick.
   */
  visibleRows = computed<{ index: number; group: FormGroup }[]>(() => {
    void this.rowsTick();
    if (!this.rows) return [];
    const term = this.search().trim().toLowerCase();
    return this.rows.controls
      .map((g, index) => ({ index, group: g as FormGroup }))
      .filter(({ group }) => {
        const v = group.value as any;
        if (term && !(v.title ?? '').toLowerCase().includes(term)) return false;
        return true;
      });
  });

  ngOnInit(): void {
    const info = this.productInfo();
    if (!Array.isArray(info.productAttributes)) info.productAttributes = [];

    // Seed the canonical 15 attributes (old project's `setAttributes()`).
    // Anything already on the backend stays; missing ones are added unchecked.
    for (const canon of CANONICAL_ATTRIBUTES) {
      if (!info.productAttributes.some((a: any) => a.key === canon.key)) {
        const seed = new ProductAttributes() as any;
        seed.key = canon.key;
        seed.title = canon.title;
        seed.checked = false;
        info.productAttributes.push(seed);
      }
    }

    this.rows = this.fb.array(
      info.productAttributes.map((a: any) => this.fb.group({
        key:          [a['key'] ?? ''],
        title:        [a['title'] ?? ''],
        checked:      [!!a.checked],
        showInSearch: [a.showInSearch ?? null],
      })),
    );
    this.productForm().setControl('productAttributes', this.rows);
    this.rowsTick.update(n => n + 1);

    this.rows.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        info.productAttributes = this.rows.controls.map((g) => {
          const v = g.getRawValue() as any;
          return Object.assign(new ProductAttributes(), v);
        });
        this.rowsTick.update(n => n + 1);
      });

    // Certification fields — writes straight to the product model.
    this.certificationBody.setValue(info.certificationBody ?? '');
    this.certificationNumber.setValue(info.certificationNumber ?? '');
    this.productForm().setControl('certificationBody', this.certificationBody);
    this.productForm().setControl('certificationNumber', this.certificationNumber);

    this.certificationBody.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => { info.certificationBody = v ?? ''; });
    this.certificationNumber.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => { info.certificationNumber = v ?? ''; });
  }

  /** Tile click toggles the `checked` control on the row. */
  toggle(index: number): void {
    const ctrl = this.rows.at(index).get('checked');
    if (!ctrl) return;
    ctrl.setValue(!ctrl.value);
  }

  onSearchInput(value: string): void {
    this.search.set(value);
  }

  rowAt(i: number): FormGroup {
    return this.rows.at(i) as FormGroup;
  }
}
